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

    var empSheet = getSheet('EMPLOYEE');
    
    // Pastikan kolom face ada. Jika baru ditambahkan, isi semua baris dengan string kosong.
    var headersBefore = empSheet.getRange(1, 1, 1, empSheet.getLastColumn()).getValues()[0];
    var needsFaceCols = headersBefore.indexOf('faceDescriptor') < 0 || headersBefore.indexOf('faceRegistered') < 0;
    ensureFaceColumns_(empSheet);
    
    // Re-read data AFTER ensuring columns exist.
    // CRITICAL: after ensureFaceColumns_ added new columns, getDataRange() may still
    // return old column count if no data exists below the new headers. We force the
    // range to include all header columns by reading the full header row first.
    var lastCol = empSheet.getLastColumn();
    var lastRow = empSheet.getLastRow();
    if (lastRow < 2) lastRow = 2; // minimal ada header + 1 baris kosong agar range valid
    
    var empData = empSheet.getRange(1, 1, lastRow, lastCol).getValues();
    var empHeaders = empData[0];
    var empIdCol = empHeaders.indexOf('id');
    var faceDescCol = empHeaders.indexOf('faceDescriptor');
    var faceRegCol = empHeaders.indexOf('faceRegistered');
    
    // Safety check - pastikan kolom face ada
    if (faceDescCol < 0 || faceRegCol < 0) {
      return fail('Kolom faceDescriptor/faceRegistered tidak ditemukan. Jalankan migrasi terlebih dahulu.');
    }
    
    // Normalize semua baris ke jumlah kolom yang sama (cegah array jagged)
    var numCols = empHeaders.length;
    for (var r = 0; r < empData.length; r++) {
      while (empData[r].length < numCols) {
        empData[r].push('');
      }
    }
    
    var empIdx = -1;
    for (var i = 1; i < empData.length; i++) {
      if (String(empData[i][empIdCol]).trim() === String(session.employeeId).trim()) {
        empIdx = i;
        break;
      }
    }

    if (empIdx < 0) {
      return fail('Karyawan tidak ditemukan dengan ID: ' + session.employeeId);
    }

    // Store face descriptor as JSON string in spreadsheet
    var descriptor = Array.isArray(params.faceDescriptor) ? params.faceDescriptor : [];
    if (descriptor.length === 0) {
      return fail('Data wajah tidak valid (descriptor kosong). Silakan ambil foto ulang.');
    }
    
    var descriptorJSON = JSON.stringify(descriptor);
    empData[empIdx][faceDescCol] = descriptorJSON;
    empData[empIdx][faceRegCol] = 'true';
    
    // Tulis kembali ke sheet - gunakan range yang sama dengan pembacaan
    empSheet.getRange(1, 1, lastRow, lastCol).setValues(empData);
    
    addLog(session.userId, session.name, 'ENROLL_FACE', 'Face Recognition', 
      'Face enrolled for employee ' + session.employeeId + ' (descriptor length: ' + descriptor.length + ')');
    
    return ok({ descriptorLength: descriptor.length }, 'Wajah berhasil didaftarkan (' + descriptor.length + ' data points)');
  },

  getFaceStatus: function (params, session) {
    if (!session.employeeId) {
      return fail('Akun tidak terhubung ke data karyawan');
    }

    var empSheet = getSheet('EMPLOYEE');
    ensureFaceColumns_(empSheet);
    
    // Baca data dengan range eksplisit untuk menghindari array jagged
    var lastCol = empSheet.getLastColumn();
    var lastRow = empSheet.getLastRow();
    if (lastRow < 2) lastRow = 2;
    
    var empData = empSheet.getRange(1, 1, lastRow, lastCol).getValues();
    var empHeaders = empData[0];
    var empIdCol = empHeaders.indexOf('id');
    var faceDescCol = empHeaders.indexOf('faceDescriptor');
    var faceRegCol = empHeaders.indexOf('faceRegistered');
    var nameCol = empHeaders.indexOf('fullName');
    
    // Normalize rows untuk mencegah array jagged
    var numCols = empHeaders.length;
    for (var r = 0; r < empData.length; r++) {
      while (empData[r].length < numCols) {
        empData[r].push('');
      }
    }

    var fixedInconsistency = false;
    for (var i = 1; i < empData.length; i++) {
      if (String(empData[i][empIdCol]).trim() === String(session.employeeId).trim()) {
        var descriptorText = String(empData[i][faceDescCol] || '').trim();
        var faceRegVal = String(empData[i][faceRegCol] || '').trim().toLowerCase();
        var isEnrolled = descriptorText.length > 2 && descriptorText !== '[]';
        
        // AUTO-HEALING: jika faceRegistered=true tapi descriptor kosong/rusak, reset flag
        if (faceRegVal === 'true' && !isEnrolled) {
          empData[i][faceRegCol] = 'false';
          empData[i][faceDescCol] = '';
          fixedInconsistency = true;
          addLog(session.userId, session.name, 'AUTO_FIX', 'Face Recognition', 
            'Auto-fixed inconsistent face data for ' + String(empData[i][nameCol] || session.employeeId) + ' (faceRegistered=true but descriptor empty)');
        }
        
        // Simpan perubahan jika ada auto-healing
        if (fixedInconsistency) {
          empSheet.getRange(1, 1, lastRow, lastCol).setValues(empData);
        }
        
        return ok({
          enrolled: isEnrolled,
          employeeName: empData[i][nameCol] || '',
          autoFixed: fixedInconsistency
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
    ensureFaceColumns_(empSheet);
    
    // Baca data dengan range eksplisit untuk menghindari array jagged
    var lastCol = empSheet.getLastColumn();
    var lastRow = empSheet.getLastRow();
    if (lastRow < 2) lastRow = 2;
    
    var empData = empSheet.getRange(1, 1, lastRow, lastCol).getValues();
    var empHeaders = empData[0];
    var empIdCol = empHeaders.indexOf('id');
    var faceDescCol = empHeaders.indexOf('faceDescriptor');
    var faceRegCol = empHeaders.indexOf('faceRegistered');
    
    // Normalize rows
    var numCols = empHeaders.length;
    for (var r = 0; r < empData.length; r++) {
      while (empData[r].length < numCols) {
        empData[r].push('');
      }
    }

    for (var i = 1; i < empData.length; i++) {
      if (String(empData[i][empIdCol]).trim() === String(session.employeeId).trim()) {
        // Check if face is registered
        var faceDescriptorText = String(empData[i][faceDescCol] || '').trim();
        var faceRegistered = faceDescriptorText.length > 2 && faceDescriptorText !== '[]';
        if (!faceRegistered) {
          return fail('Wajah belum terdaftar. Silakan daftarkan wajah Anda terlebih dahulu.');
        }

        var enrolledJSON = empData[i][faceDescCol] || '[]';
        var enrolledDescriptor;
        try {
          enrolledDescriptor = JSON.parse(enrolledJSON);
        } catch (e) {
          return fail('Data wajah rusak. Silakan daftarkan ulang.');
        }
        
        if (!enrolledDescriptor || enrolledDescriptor.length === 0) {
          return fail('Data wajah tidak valid. Silakan daftarkan ulang.');
        }

        // If frontend sends a face descriptor, compare it with stored one
        if (params.faceDescriptor && Array.isArray(params.faceDescriptor) && params.faceDescriptor.length > 0) {
          var similarity = calculateCosineSimilarity(params.faceDescriptor, enrolledDescriptor);
          var threshold = CONFIG.FACE_SIMILARITY_THRESHOLD || 0.65;
          
          return ok({
            match: similarity >= threshold,
            similarity: Math.round(similarity * 100)
          });
        }

        // If frontend sends pre-computed match result, just verify face exists
        if (params.faceVerified === true || params.faceVerified === 'true') {
          return ok({
            match: true,
            similarity: 100
          });
        }

        // Default: face is registered
        return ok({
          match: true,
          similarity: 100
        });
      }
    }

    return fail('Karyawan tidak ditemukan');
  }
};

/**
 * Pastikan instalasi spreadsheet lama sudah memiliki kolom Face ID.
 * Dipanggil dari semua endpoint Face ID agar migrasi manual tidak wajib.
 */
function ensureFaceColumns_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var changed = false;

  if (headers.indexOf('faceDescriptor') < 0) {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue('faceDescriptor');
    changed = true;
  }
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf('faceRegistered') < 0) {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue('faceRegistered');
    changed = true;
  }
  return changed;
}

/**
 * Calculate cosine similarity between two face descriptor arrays
 * Range: 0 (berbeda) - 1 (identik)
 */
function calculateCosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  
  var dotProduct = 0;
  var normA = 0;
  var normB = 0;
  
  for (var i = 0; i < a.length; i++) {
    dotProduct += Number(a[i]) * Number(b[i]);
    normA += Number(a[i]) * Number(a[i]);
    normB += Number(b[i]) * Number(b[i]);
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  var similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Clamp between 0-1
  return Math.max(0, Math.min(1, similarity));
}
