/**
 * UserService.gs - User Management
 * 
 * PERUBAHAN: Face Recognition dipindah ke FaceService.gs (terpusat).
 * Semua method face recognition di sini adalah delegasi ke FaceService.
 * 
 * Alasan refactor:
 * - Menghindari duplikasi kode (sebelumnya ada di UserService.gs DAN Attendance.gs)
 * - Konsistensi validasi descriptor (128 angka + normalisasi)
 * - FaceService bisa digunakan oleh module lain (Attendance, Admin, dll)
 * 
 * Mapping:
 * - UserService.enrollFace     -> FaceService.enroll(params, session)
 * - UserService.getFaceStatus  -> FaceService.getStatus(session)
 * - UserService.verifyFace     -> FaceService.verifyForAttendance(params, session)
 */

var UserService = {
  list: function (params) {
    var session = verifyToken(params.token);
    if (!session) return fail('Sesi tidak valid');

    // Only admin can list users
    if (session.role !== 'Administrator') {
      return fail('Akses ditolak');
    }

    var sheet = getSheet('USERS');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var users = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var user = {};
      for (var j = 0; j < headers.length; j++) {
        user[headers[j]] = row[j];
      }
      users.push(user);
    }

    return ok(users);
  },

  save: function (params, session) {
    if (session.role !== 'Administrator') {
      return fail('Akses ditolak');
    }

    var sheet = getSheet('USERS');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var now = new Date().toISOString();

    if (params.id) {
      // Update existing user
      var idCol = headers.indexOf('id');
      for (var i = 1; i < data.length; i++) {
        if (data[i][idCol] === params.id) {
          var updates = {
            email: params.email,
            role: params.role,
            name: params.name,
            employeeId: params.employeeId || '',
            isActive: params.isActive ? 'true' : 'false',
            updatedAt: now
          };
          
          if (params.password && params.password.length >= 4) {
            updates.password = hashPassword(params.password);
          }

          for (var key in updates) {
            if (updates.hasOwnProperty(key)) {
              var col = headers.indexOf(key);
              if (col >= 0) {
                data[i][col] = updates[key];
              }
            }
          }

          sheet.getDataRange().setValues(data);
          addLog(session.userId, session.name, 'UPDATE', 'User', 'Updated user ' + params.email);
          return ok({ id: params.id, ...updates }, 'User berhasil diperbarui');
        }
      }
      return fail('User tidak ditemukan');
    }

    // Create new user
    var id = generateId('usr');
    var newUser = {
      id: id,
      email: params.email,
      password: hashPassword(params.password || '123456'),
      role: params.role,
      name: params.name,
      employeeId: params.employeeId || '',
      avatar: '',
      isActive: params.isActive ? 'true' : 'false',
      createdAt: now
    };

    // Check duplicate email
    var emailCol = headers.indexOf('email');
    for (var i = 1; i < data.length; i++) {
      if (data[i][emailCol] === params.email) {
        return fail('Email sudah terdaftar');
      }
    }

    var newRow = headers.map(function (h) { return newUser[h] || ''; });
    sheet.appendRow(newRow);
    addLog(session.userId, session.name, 'CREATE', 'User', 'Created user ' + params.email);
    
    return ok(newUser, 'User berhasil ditambahkan');
  },

  delete: function (id, session) {
    if (session.role !== 'Administrator') {
      return fail('Akses ditolak');
    }

    if (id === session.userId) {
      return fail('Tidak dapat menghapus akun sendiri');
    }

    var sheet = getSheet('USERS');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idCol = headers.indexOf('id');

    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][idCol] === id) {
        sheet.deleteRow(i + 1);
        addLog(session.userId, session.name, 'DELETE', 'User', 'Deleted user ' + id);
        return ok(null, 'User berhasil dihapus');
      }
    }

    return fail('User tidak ditemukan');
  },

  resetPassword: function (params, session) {
    if (session.role !== 'Administrator') {
      return fail('Akses ditolak');
    }

    var sheet = getSheet('USERS');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idCol = headers.indexOf('id');
    var passwordCol = headers.indexOf('password');

    for (var i = 1; i < data.length; i++) {
      if (data[i][idCol] === params.id) {
        data[i][passwordCol] = hashPassword(params.password);
        sheet.getDataRange().setValues(data);
        addLog(session.userId, session.name, 'RESET_PASSWORD', 'User', 'Reset password for ' + data[i][headers.indexOf('email')]);
        return ok(null, 'Password berhasil direset');
      }
    }

    return fail('User tidak ditemukan');
  },

  // ========== FACE RECOGNITION (delegasi ke FaceService) ==========

  /**
   * Daftarkan wajah untuk absensi.
   * FIX: Tidak guard session.employeeId karena FaceService.enroll 
   * melakukan multi-strategy lookup (employeeId + email fallback).
   * 
   * Delegasi ke FaceService.enroll() untuk konsistensi.
   */
  enrollFace: function (params, session) {
    if (!session) {
      return fail('Sesi tidak valid');
    }

    return FaceService.enroll(params, session);
  },

  /**
   * Cek status pendaftaran wajah.
   * FIX: Tidak guard session.employeeId - FaceService punya fallback email lookup.
   * 
   * Delegasi ke FaceService.getStatus() untuk konsistensi.
   */
  getFaceStatus: function (params, session) {
    if (!session) {
      return fail('Sesi tidak valid');
    }

    return FaceService.getStatus(session);
  },

  /**
   * Verifikasi wajah untuk absensi.
   * FIX: Tidak guard session.employeeId - FaceService punya fallback email lookup.
   * 
   * Delegasi ke FaceService.verifyForAttendance() untuk konsistensi.
   */
  verifyFace: function (params, session) {
    if (!session) {
      return fail('Sesi tidak valid');
    }

    var result = FaceService.verifyForAttendance(params, session);
    if (!result.success) {
      // Map error codes ke format response UserService
      if (result.code === 'FACE_NOT_REGISTERED') {
        return fail(result.message);
      }
      if (result.code === 'FACE_NOT_MATCH') {
        return fail(result.message);
      }
      return fail(result.message);
    }

    return ok({
      match: result.match,
      similarity: result.similarity || 100
    }, result.message);
  }
};