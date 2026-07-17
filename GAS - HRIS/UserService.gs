/**
 * UserService.gs - User Management & Face Recognition
 * Handles CRUD operations for users and face enrollment
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
            updates.password = params.password;
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
      password: params.password || '123456',
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
        data[i][passwordCol] = params.password;
        sheet.getDataRange().setValues(data);
        addLog(session.userId, session.name, 'RESET_PASSWORD', 'User', 'Reset password for ' + data[i][headers.indexOf('email')]);
        return ok(null, 'Password berhasil direset');
      }
    }

    return fail('User tidak ditemukan');
  },

  // Face Recognition
  enrollFace: function (params, session) {
    if (!session.employeeId) {
      return fail('Akun tidak terhubung ke data karyawan');
    }

    // Get employee
    var empSheet = getSheet('EMPLOYEE');
    var empData = empSheet.getDataRange().getValues();
    var empHeaders = empData[0];
    var empIdCol = empHeaders.indexOf('id');
    var empIdx = -1;

    for (var i = 1; i < empData.length; i++) {
      if (empData[i][empIdCol] === session.employeeId) {
        empIdx = i;
        break;
      }
    }

    if (empIdx < 0) {
      return fail('Karyawan tidak ditemukan');
    }

    // Update face descriptor
    var faceDescCol = empHeaders.indexOf('faceDescriptor');
    var faceRegCol = empHeaders.indexOf('faceRegistered');
    
    empData[empIdx][faceDescCol] = JSON.stringify(params.faceDescriptor);
    empData[empIdx][faceRegCol] = 'true';
    
    empSheet.getDataRange().setValues(empData);
    addLog(session.userId, session.name, 'ENROLL_FACE', 'Face Recognition', 'Face enrolled for employee ' + session.employeeId);
    
    return ok(null, 'Wajah berhasil didaftarkan');
  },

  getFaceStatus: function (params, session) {
    if (!session.employeeId) {
      return fail('Akun tidak terhubung ke data karyawan');
    }

    var empSheet = getSheet('EMPLOYEE');
    var empData = empSheet.getDataRange().getValues();
    var empHeaders = empData[0];
    var empIdCol = empHeaders.indexOf('id');
    var faceDescCol = empHeaders.indexOf('faceDescriptor');
    var faceRegCol = empHeaders.indexOf('faceRegistered');
    var nameCol = empHeaders.indexOf('fullName');

    for (var i = 1; i < empData.length; i++) {
      if (empData[i][empIdCol] === session.employeeId) {
        return ok({
          enrolled: empData[i][faceRegCol] === 'true',
          employeeName: empData[i][nameCol]
        });
      }
    }

    return fail('Karyawan tidak ditemukan');
  },

  verifyFace: function (params, session) {
    if (!session.employeeId) {
      return fail('Akun tidak terhubung ke data karyawan');
    }

    var empSheet = getSheet('EMPLOYEE');
    var empData = empSheet.getDataRange().getValues();
    var empHeaders = empData[0];
    var empIdCol = empHeaders.indexOf('id');
    var faceDescCol = empHeaders.indexOf('faceDescriptor');

    for (var i = 1; i < empData.length; i++) {
      if (empData[i][empIdCol] === session.employeeId) {
        var enrolledDescriptor = JSON.parse(empData[i][faceDescCol] || '[]');
        
        if (!enrolledDescriptor || enrolledDescriptor.length === 0) {
          return fail('Wajah belum terdaftar');
        }

        // Simple comparison (in production, use proper face matching algorithm)
        var similarity = calculateSimilarity(params.photo, enrolledDescriptor);
        
        return ok({
          match: similarity >= 0.65,
          similarity: Math.round(similarity * 100)
        });
      }
    }

    return fail('Karyawan tidak ditemukan');
  }
};

// Helper function to calculate similarity (simplified)
function calculateSimilarity(photoData, enrolledDescriptor) {
  // In production, this would use proper face recognition
  // For now, return a placeholder
  return 0.75;
}