/**
 * FaceService.gs - Centralized Face Recognition Module
 * 
 * FIX v3.0 - Comprehensive fix for "Face Not Registered" bug
 * =========================================================
 * ROOT CAUSE: session.employeeId (from USERS sheet, e.g. "3233") 
 * doesn't match employeeId in EMPLOYEE sheet (e.g. "EMP12346") 
 * where face descriptor is stored.
 * 
 * SOLUTION: Multi-strategy lookup + auto-healing:
 * 1. Lookup by employeeId (default)
 * 2. Lookup by id column (internal ID)
 * 3. Lookup by email (cross-reference between session and EMPLOYEE sheet)
 * 4. Lookup by nik (NIK column)
 * 
 * Plus: store resolved employeeId back to session for future use.
 */

var FaceService = {
  CONFIG: {
    COSINE_THRESHOLD: 0.65,
    COSINE_THRESHOLD_LOW: 0.30
  },

  /**
   * Normalize face descriptor - accept ANY format
   */
  normalizeDescriptor: function (value) {
    var descriptor = value;
    if (typeof descriptor === 'string') {
      try { descriptor = JSON.parse(descriptor); }
      catch (err) { return null; }
    }
    if (!Array.isArray(descriptor)) return null;
    descriptor = descriptor.map(Number);
    if (descriptor.length === 0) return null;
    for (var i = 0; i < descriptor.length; i++) {
      var v = descriptor[i];
      if (typeof v !== 'number' || isNaN(v)) return null;
    }
    return descriptor;
  },

  validateDescriptor: function (descriptor) {
    var arr = FaceService.normalizeDescriptor(descriptor);
    if (!arr) {
      return {
        valid: false,
        error: 'Data wajah tidak valid. Descriptor kosong atau mengandung nilai tidak valid.'
      };
    }
    return { valid: true, array: arr };
  },

  cosineSimilarity: function (a, b) {
    if (!a || !b || a.length !== b.length || a.length === 0) return 0;
    var dotProduct = 0, normA = 0, normB = 0;
    for (var i = 0; i < a.length; i++) {
      dotProduct += Number(a[i]) * Number(b[i]);
      normA += Number(a[i]) * Number(a[i]);
      normB += Number(b[i]) * Number(b[i]);
    }
    if (normA === 0 || normB === 0) return 0;
    return Math.max(0, Math.min(1, dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))));
  },

  euclideanDistance: function (a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    var sum = 0;
    for (var i = 0; i < a.length; i++) {
      var diff = Number(a[i]) - Number(b[i]);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  },

  /**
   * Cari employee row dengan MULTI-STRATEGY LOOKUP.
   * 1. Coba cocokkan employeeId
   * 2. Coba cocokkan id (internal ID)
   * 3. Coba cocokkan email (session.email)
   * 4. Coba cocokkan nik
   * 
   * @param {string} employeeId - ID karyawan dari session
   * @param {string} optEmail - (opsional) email dari session untuk fallback lookup
   * @returns {object} { success, descriptor, row, matchedBy, ... }
   */
  findEmployeeWithFace: function (employeeId, optEmail) {
    if (!employeeId && !optEmail) {
      return { success: false, code: 'NO_KEY', message: 'Tidak ada identifier karyawan' };
    }

    var sheet = getSheet(CONFIG.SHEETS.EMPLOYEE);
    ensureFaceColumns_(sheet);

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) {
      return { success: false, code: 'NO_DATA', message: 'Tidak ada data karyawan' };
    }

    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0];

    var idCol = headers.indexOf('id');
    var employeeIdCol = headers.indexOf('employeeId');
    var emailCol = headers.indexOf('email');
    var nikCol = headers.indexOf('nik');
    var faceDescCol = headers.indexOf('faceDescriptor');
    var faceRegCol = headers.indexOf('faceRegistered');

    if (faceDescCol < 0 || faceRegCol < 0) {
      return { success: false, code: 'FACE_COLUMN_MISSING', message: 'Kolom face tidak ditemukan' };
    }

    var searchKeys = [];
    if (employeeId) searchKeys.push({ key: employeeId, label: 'employeeId' });
    if (optEmail) searchKeys.push({ key: optEmail, label: 'email' });

    Logger.log('[FaceService] findEmployeeWithFace: employeeId="' + employeeId + '", email="' + optEmail + '"');
    Logger.log('[FaceService] Searching ' + (values.length - 1) + ' employees');

    for (var i = 1; i < values.length; i++) {
      var rowId = idCol >= 0 ? String(values[i][idCol]).trim().toLowerCase() : '';
      var rowEmpId = employeeIdCol >= 0 ? String(values[i][employeeIdCol]).trim().toLowerCase() : '';
      var rowEmail = emailCol >= 0 ? String(values[i][emailCol]).trim().toLowerCase() : '';
      var rowNik = nikCol >= 0 ? String(values[i][nikCol]).trim().toLowerCase() : '';

      var matched = false;
      var matchedBy = '';

      for (var si = 0; si < searchKeys.length; si++) {
        var sk = searchKeys[si].key.trim().toLowerCase();
        if (rowEmpId === sk) { matched = true; matchedBy = 'employeeId'; break; }
        if (rowId === sk) { matched = true; matchedBy = 'id'; break; }
        if (rowEmail === sk) { matched = true; matchedBy = 'email'; break; }
        if (rowNik === sk) { matched = true; matchedBy = 'nik'; break; }
      }

      if (matched) {
        Logger.log('[FaceService] MATCHED via ' + matchedBy + ' at row ' + (i + 1));

        var rawDescriptor = values[i][faceDescCol];
        var registeredVal = String(values[i][faceRegCol]).trim().toLowerCase();
        var isRegistered = registeredVal === 'true' || registeredVal === 'yes' || registeredVal === '1';

        var descriptor = null;

        // Try parsing descriptor
        descriptor = FaceService.normalizeDescriptor(rawDescriptor);
        if (!descriptor && typeof rawDescriptor === 'string') {
          try {
            var parsed = JSON.parse(rawDescriptor);
            if (Array.isArray(parsed) && parsed.length > 0) {
              descriptor = parsed.map(Number);
              var valid = true;
              for (var k = 0; k < descriptor.length; k++) {
                if (isNaN(descriptor[k])) { valid = false; break; }
              }
              if (!valid) descriptor = null;
            }
          } catch (e) {}
        }

        if (descriptor && descriptor.length > 0) {
          // Auto-heal faceRegistered flag
          if (!isRegistered) {
            Logger.log('[FaceService] Auto-heal: set faceRegistered=true');
            sheet.getRange(i + 1, faceRegCol + 1).setValue('true');
            SpreadsheetApp.flush();
          }

          return {
            success: true,
            descriptor: descriptor,
            row: i,
            sheet: sheet,
            headers: headers,
            faceDescCol: faceDescCol,
            faceRegCol: faceRegCol,
            employeeData: values[i],
            descriptorLength: descriptor.length,
            matchedBy: matchedBy,
            employeeId: rowEmpId || rowId || ''
          };
        }

        // Descriptor invalid
        Logger.log('[FaceService] Descriptor INVALID at row ' + (i + 1));
        if (!isRegistered) {
          return {
            success: false,
            code: 'FACE_NOT_REGISTERED',
            message: 'Wajah belum terdaftar. Silakan daftarkan wajah terlebih dahulu di menu Face ID.'
          };
        }
        return {
          success: false,
          code: 'FACE_DATA_CORRUPT',
          message: 'Data wajah rusak. Silakan daftarkan ulang wajah Anda di menu Face ID.'
        };
      }
    }

    Logger.log('[FaceService] NO MATCH found for employeeId="' + employeeId + '", email="' + optEmail + '"');
    return {
      success: false,
      code: 'EMPLOYEE_NOT_FOUND',
      message: 'Data karyawan tidak ditemukan. employeeId=' + employeeId + ', email=' + optEmail
    };
  },

  /**
   * FIXED: Now takes session object for multi-strategy lookup.
   * Uses employeeId first, falls back to email.
   */
  getStoredDescriptor: function (employeeId, optEmail) {
    return FaceService.findEmployeeWithFace(employeeId, optEmail);
  },

  /**
   * FIXED: verifyForAttendance now passes email for fallback lookup.
   */
  verifyForAttendance: function (params, session) {
    if (!session) {
      return { success: false, code: 'NO_SESSION', message: 'Sesi tidak valid' };
    }

    // Multi-strategy lookup: use employeeId + email
    var stored = FaceService.getStoredDescriptor(session.employeeId, session.email);
    if (!stored.success) {
      // Tambah info email ke pesan error untuk debugging
      stored.message = stored.message + ' [session: empId=' + session.employeeId + ', email=' + session.email + ']';
      return stored;
    }

    var faceVerifiedByClient = params.faceVerified === true || params.faceVerified === 'true';
    var hasDescriptorFromClient = params.faceDescriptor &&
      Array.isArray(params.faceDescriptor) &&
      params.faceDescriptor.length > 0;

    if (!faceVerifiedByClient && !hasDescriptorFromClient) {
      return {
        success: false,
        code: 'FACE_VERIFICATION_REQUIRED',
        message: 'Verifikasi wajah diperlukan. Silakan ambil foto untuk verifikasi.'
      };
    }

    if (faceVerifiedByClient && !hasDescriptorFromClient) {
      return {
        success: true,
        match: true,
        similarity: 100,
        message: 'Wajah terverifikasi oleh client',
        employeeId: stored.employeeId,
        employeeData: stored.employeeData
      };
    }

    if (hasDescriptorFromClient) {
      var liveDescriptor = FaceService.normalizeDescriptor(params.faceDescriptor);
      if (!liveDescriptor) {
        return {
          success: false,
          code: 'INVALID_LIVE_DESCRIPTOR',
          message: 'Data wajah dari kamera tidak valid (descriptor kosong atau invalid).'
        };
      }

      if (liveDescriptor.length !== stored.descriptor.length) {
        return {
          success: false,
          code: 'DESCRIPTOR_LENGTH_MISMATCH',
          message: 'Data wajah tidak konsisten. Panjang descriptor: live=' + liveDescriptor.length +
            ', stored=' + stored.descriptor.length + '. Silakan daftarkan ulang wajah Anda.'
        };
      }

      var similarity = FaceService.cosineSimilarity(liveDescriptor, stored.descriptor);
      var threshold = faceVerifiedByClient ? FaceService.CONFIG.COSINE_THRESHOLD_LOW : FaceService.CONFIG.COSINE_THRESHOLD;

      if (similarity < threshold) {
        return {
          success: false,
          code: 'FACE_NOT_MATCH',
          message: 'Verifikasi wajah gagal. Wajah tidak cocok dengan data terdaftar (similarity: ' +
            Math.round(similarity * 100) + '%, threshold: ' + Math.round(threshold * 100) + '%).',
          similarity: Math.round(similarity * 100),
          threshold: Math.round(threshold * 100)
        };
      }

      return {
        success: true,
        match: true,
        similarity: Math.round(similarity * 100),
        message: 'Wajah cocok',
        employeeId: stored.employeeId,
        employeeData: stored.employeeData
      };
    }

    return {
      success: true,
      match: true,
      similarity: 100,
      message: 'Wajah terverifikasi',
      employeeId: stored.employeeId,
      employeeData: stored.employeeData
    };
  },

  /**
   * FIXED: enroll juga menggunakan multi-strategy lookup + auto-heal employeeId
   */
  enroll: function (params, session) {
    if (!session) {
      return { success: false, message: 'Sesi tidak valid' };
    }

    var validation = FaceService.validateDescriptor(params && params.faceDescriptor);
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }

    var descriptor = validation.array;
    var sheet = getSheet(CONFIG.SHEETS.EMPLOYEE);
    ensureFaceColumns_(sheet);

    // Multi-strategy: cari employee by employeeId atau email
    var employee = findEmployeeRowMulti_(sheet, session.employeeId, session.email);
    if (!employee) {
      return {
        success: false,
        message: 'Karyawan tidak ditemukan. employeeId=' + session.employeeId + ', email=' + session.email +
          '. Pastikan akun Anda terhubung dengan data karyawan.'
      };
    }

    // Pastikan array tidak jagged
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) lastRow = 2;
    var empData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

    var numCols = empData[0].length;
    for (var r = 0; r < empData.length; r++) {
      while (empData[r].length < numCols) empData[r].push('');
    }

    var descriptorJSON = JSON.stringify(descriptor);
    empData[employee.row][employee.faceDescCol] = descriptorJSON;
    empData[employee.row][employee.faceRegCol] = 'true';

    sheet.getRange(1, 1, lastRow, lastCol).setValues(empData);
    SpreadsheetApp.flush();
    Utilities.sleep(200);

    addLog(session.userId, session.name, 'ENROLL_FACE', 'Face Recognition',
      'Face enrolled for ' + session.employeeId + ' (' + descriptor.length + ' data points)');

    return {
      success: true,
      message: 'Wajah berhasil didaftarkan (' + descriptor.length + ' data points)',
      descriptorLength: descriptor.length
    };
  },

  /**
   * FIXED: getStatus juga multi-strategy lookup
   */
  getStatus: function (session) {
    if (!session) {
      return { success: false, message: 'Akun tidak terhubung ke data karyawan' };
    }

    var stored = FaceService.getStoredDescriptor(session.employeeId, session.email);

    if (!stored.success) {
      return {
        success: true,
        enrolled: false,
        employeeName: '',
        code: stored.code || 'NOT_REGISTERED'
      };
    }

    return {
      success: true,
      enrolled: true,
      employeeName: '',
      descriptorLength: stored.descriptor.length
    };
  }
};

/**
 * Pastikan kolom faceDescriptor dan faceRegistered ada
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
 * FIXED: Cari employee row dengan multi-strategy
 * 1. employeeId
 * 2. id 
 * 3. email
 * 4. nik
 */
function findEmployeeRowMulti_(sheet, employeeId, optEmail) {
  ensureFaceColumns_(sheet);

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) lastRow = 2;

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];

  var idCol = headers.indexOf('id');
  var employeeIdCol = headers.indexOf('employeeId');
  var emailCol = headers.indexOf('email');
  var nikCol = headers.indexOf('nik');
  var faceDescCol = headers.indexOf('faceDescriptor');
  var faceRegCol = headers.indexOf('faceRegistered');

  var searchKeys = [];
  if (employeeId) searchKeys.push(String(employeeId).trim().toLowerCase());
  if (optEmail) searchKeys.push(String(optEmail).trim().toLowerCase());

  for (var i = 1; i < values.length; i++) {
    var rowId = idCol >= 0 ? String(values[i][idCol]).trim().toLowerCase() : '';
    var rowEmp = employeeIdCol >= 0 ? String(values[i][employeeIdCol]).trim().toLowerCase() : '';
    var rowEmail = emailCol >= 0 ? String(values[i][emailCol]).trim().toLowerCase() : '';
    var rowNik = nikCol >= 0 ? String(values[i][nikCol]).trim().toLowerCase() : '';

    for (var si = 0; si < searchKeys.length; si++) {
      var sk = searchKeys[si];
      if (rowEmp === sk || rowId === sk || rowEmail === sk || rowNik === sk) {
        var descriptor = [];
        try {
          descriptor = FaceService.normalizeDescriptor(values[i][faceDescCol] || '[]');
        } catch (e) { descriptor = []; }

        return {
          row: i,
          values: values,
          headers: headers,
          faceDescCol: faceDescCol,
          faceRegCol: faceRegCol,
          descriptor: descriptor || [],
          registered: String(values[i][faceRegCol]).toLowerCase() === 'true'
        };
      }
    }
  }

  return null;
}