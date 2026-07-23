/**
 * FaceService.gs - Centralized Face Recognition Module
 * 
 * Menggabungkan pattern terbaik dari faceenrollment.txt dan faceverification.txt
 * dengan struktur project yang sudah ada (employeeId + faceDescriptor/faceRegistered).
 * 
 * PERUBAHAN KRITIS:
 * - TIDAK memaksa DESCRIPTOR_LENGTH=128 seperti file attached, karena frontend
 *   menggunakan lightweight Canvas pixel analysis (~70 elemen, bukan face-api.js).
 * - Strict 128-length validation menyebabkan "wajah tidak terbaca saat check-in".
 * - Normalisasi hanya validasi: array tidak kosong, semua elemen adalah angka finite.
 * - Panjang descriptor dibiarkan dinamis sesuai implementasi frontend.
 */

var FaceService = {
  // Threshold untuk cosine similarity (0-1)
  CONFIG: {
    COSINE_THRESHOLD: 0.65,
    COSINE_THRESHOLD_LOW: 0.30 // Untuk faceVerified=true dari client
  },

  /**
   * Validasi dan normalisasi face descriptor dari input apapun.
   * 
   * KRITIS: Tidak memaksa panjang tertentu! Frontend menggunakan
   * Canvas pixel analysis yang menghasilkan ~70 elemen, bukan 128.
   * Hanya validasi: array, angka finite, tidak kosong.
   * 
   * @param {any} value - bisa array, JSON string, atau null
   * @returns {number[]|null} array angka atau null jika invalid
   */
  normalizeDescriptor: function (value) {
    var descriptor = value;

    // Parse dari JSON string jika perlu
    if (typeof descriptor === 'string') {
      try { descriptor = JSON.parse(descriptor); }
      catch (err) { return null; }
    }

    // Harus array
    if (!Array.isArray(descriptor)) return null;

    // Harus array of numbers
    descriptor = descriptor.map(Number);
    
    // Tidak kosong
    if (descriptor.length === 0) return null;

    // Semua elemen harus finite numbers
    // Gunakan isFinite() global (ES5, compatible dengan GAS Rhino engine)
    // Number.isFinite() TIDAK didukung Rhino (ES6+)
    for (var i = 0; i < descriptor.length; i++) {
      var v = descriptor[i];
      if (typeof v !== 'number' || !isFinite(v) || isNaN(v)) return null;
    }

    return descriptor;
  },

  /**
   * Validasi face descriptor dengan pesan error yang jelas
   * @param {any} descriptor
   * @returns {{ valid: boolean, array?: number[], error?: string }}
   */
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

  /**
   * Cosine Similarity: 0 (berbeda) - 1 (identik)
   * Cocok untuk face descriptor yang sudah dinormalisasi.
   * Array dengan panjang berbeda -> 0 (tidak match).
   */
  cosineSimilarity: function (a, b) {
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

    return Math.max(0, Math.min(1, dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))));
  },

  /**
   * Euclidean Distance: 0 (identik) - ~2 (sangat berbeda)
   * Sebagai alternatif matching.
   */
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
   * Cari employee row dan dapatkan face descriptor tersimpan
   * Menggunakan session.employeeId sebagai key pencarian.
   * 
   * @param {string} employeeId - ID karyawan (EMP001, atau internal id)
   * @returns {object} { success, descriptor, row, sheet, headers, faceDescCol, faceRegCol }
   */
  getStoredDescriptor: function (employeeId) {
    if (!employeeId) {
      Logger.log('[FaceService] getStoredDescriptor: employeeId kosong');
      return { success: false, code: 'INVALID_EMPLOYEE', message: 'ID karyawan tidak valid' };
    }

    var sheet = getSheet(CONFIG.SHEETS.EMPLOYEE);
    ensureFaceColumns_(sheet);

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) {
      Logger.log('[FaceService] getStoredDescriptor: Sheet EMPLOYEE kosong');
      return { success: false, code: 'NO_DATA', message: 'Tidak ada data karyawan' };
    }

    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0];

    var idCol = headers.indexOf('id');
    var employeeIdCol = headers.indexOf('employeeId');
    var faceDescCol = headers.indexOf('faceDescriptor');
    var faceRegCol = headers.indexOf('faceRegistered');

    if (faceDescCol < 0 || faceRegCol < 0) {
      Logger.log('[FaceService] Kolom face tidak ditemukan. headers=' + headers.join(','));
      return { success: false, code: 'FACE_COLUMN_MISSING', message: 'Kolom face tidak ditemukan' };
    }

    var searchKey = String(employeeId).trim().toLowerCase();
    Logger.log('[FaceService] Mencari employeeId: "' + searchKey + '"');

    for (var i = 1; i < values.length; i++) {
      var id = idCol >= 0 ? String(values[i][idCol]).trim().toLowerCase() : '';
      var emp = employeeIdCol >= 0 ? String(values[i][employeeIdCol]).trim().toLowerCase() : '';

      if (id === searchKey || emp === searchKey) {
        Logger.log('[FaceService] Ditemukan employee di baris ' + (i + 1) + ' (id=' + id + ', employeeId=' + emp + ')');
        
        var rawDescriptor = values[i][faceDescCol];
        var registeredVal = String(values[i][faceRegCol]).trim().toLowerCase();
        var isRegistered = registeredVal === 'true' || registeredVal === 'yes' || registeredVal === '1';
        
        Logger.log('[FaceService] faceRegistered = "' + registeredVal + '" (parsed: ' + isRegistered + ')');
        Logger.log('[FaceService] rawDescriptor type = ' + typeof rawDescriptor + ', value = "' + String(rawDescriptor).substring(0, 50) + '..."');

        // Coba parsing descriptor dengan berbagai cara
        var descriptor = null;
        
        // Cara 1: normalizeDescriptor (handle JSON string dan array)
        descriptor = FaceService.normalizeDescriptor(rawDescriptor);
        
        // Jika masih null, coba fallback: parse langsung
        if (!descriptor && typeof rawDescriptor === 'string') {
          Logger.log('[FaceService] normalizeDescriptor gagal, coba fallback parsing');
          try {
            var parsed = JSON.parse(rawDescriptor);
            if (Array.isArray(parsed) && parsed.length > 0) {
              descriptor = parsed.map(Number);
              // Validasi manual: pastikan tidak ada NaN
              var valid = true;
              for (var k = 0; k < descriptor.length; k++) {
                if (typeof descriptor[k] !== 'number' || isNaN(descriptor[k])) {
                  valid = false;
                  break;
                }
              }
              if (!valid) descriptor = null;
              else Logger.log('[FaceService] Fallback berhasil, panjang=' + descriptor.length);
            }
          } catch (e) {
            Logger.log('[FaceService] Fallback parsing gagal: ' + e.message);
          }
        }

        // Jika deskriptor valid, auto-heal dan return success
        if (descriptor && descriptor.length > 0) {
          Logger.log('[FaceService] Descriptor valid! Panjang=' + descriptor.length + ', isRegistered=' + isRegistered);
          
          // Auto-heal: jika faceRegistered=false tapi ada descriptor valid
          if (!isRegistered) {
            Logger.log('[FaceService] Auto-heal: set faceRegistered=true untuk baris ' + (i + 1));
            sheet.getRange(i + 1, faceRegCol + 1).setValue('true');
            SpreadsheetApp.flush();
            isRegistered = true;
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
            descriptorLength: descriptor.length
          };
        }

        // Descriptor tidak bisa diparse
        Logger.log('[FaceService] Descriptor tidak valid. isRegistered=' + isRegistered + ', rawDescriptor length=' + String(rawDescriptor).length);
        
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

    Logger.log('[FaceService] Employee TIDAK DITEMUKAN dengan ID: "' + searchKey + '" (dari ' + (values.length - 1) + ' baris)');
    return { success: false, code: 'EMPLOYEE_NOT_FOUND', message: 'Data karyawan tidak ditemukan' };
  },

  /**
   * Verifikasi wajah untuk absensi (check-in/check-out)
   * Menggunakan aturan:
   * 1. Jika faceVerified=true dari client, cukup cek wajah terdaftar
   * 2. Jika ada faceDescriptor dari client, bandingkan dengan cosine similarity
   * 3. Jika tidak ada keduanya, tolak
   * 
   * @param {object} params - { faceDescriptor, faceVerified }
   * @param {object} session - session login (harus punya employeeId)
   * @returns {object} { success, match, similarity, message }
   */
  verifyForAttendance: function (params, session) {
    if (!session || !session.employeeId) {
      return { success: false, code: 'NO_SESSION', message: 'Sesi tidak valid' };
    }

    // 1. Dapatkan face descriptor tersimpan
    var stored = FaceService.getStoredDescriptor(session.employeeId);
    if (!stored.success) return stored;

    // 2. Cek apakah client mengirim faceVerified flag
    var faceVerifiedByClient = params.faceVerified === true || params.faceVerified === 'true';
    var hasDescriptorFromClient = params.faceDescriptor &&
      Array.isArray(params.faceDescriptor) &&
      params.faceDescriptor.length > 0;

    // Jika tidak ada data verifikasi dari client, tolak
    if (!faceVerifiedByClient && !hasDescriptorFromClient) {
      return {
        success: false,
        code: 'FACE_VERIFICATION_REQUIRED',
        message: 'Verifikasi wajah diperlukan. Silakan ambil foto untuk verifikasi.'
      };
    }

    // Jika client sudah melakukan verifikasi (faceVerified=true), lewati similarity check
    if (faceVerifiedByClient && !hasDescriptorFromClient) {
      return {
        success: true,
        match: true,
        similarity: 100,
        message: 'Wajah terverifikasi oleh client'
      };
    }

    // 3. Bandingkan descriptor
    if (hasDescriptorFromClient) {
      var liveDescriptor = FaceService.normalizeDescriptor(params.faceDescriptor);
      if (!liveDescriptor) {
        return {
          success: false,
          code: 'INVALID_LIVE_DESCRIPTOR',
          message: 'Data wajah dari kamera tidak valid (descriptor kosong atau invalid).'
        };
      }

      // Periksa panjang sama
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
        message: 'Wajah cocok'
      };
    }

    // Fallback
    return {
      success: true,
      match: true,
      similarity: 100,
      message: 'Wajah terverifikasi'
    };
  },

  /**
   * Daftarkan face descriptor untuk karyawan
   * @param {object} params - { faceDescriptor: number[] }
   * @param {object} session - session login
   * @returns {object} response
   */
  enroll: function (params, session) {
    if (!session || !session.employeeId) {
      return { success: false, message: 'Akun tidak terhubung ke data karyawan' };
    }

    // Validasi descriptor (tanpa paksa 128 length)
    var validation = FaceService.validateDescriptor(params && params.faceDescriptor);
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }

    var descriptor = validation.array;
    var sheet = getSheet(CONFIG.SHEETS.EMPLOYEE);
    ensureFaceColumns_(sheet);

    var employee = findEmployeeRow_(sheet, session.employeeId);
    if (!employee) {
      return { success: false, message: 'Karyawan tidak ditemukan dengan ID: ' + session.employeeId };
    }

    // Pastikan array tidak jagged
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) lastRow = 2;
    var empData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

    // Normalize semua baris ke jumlah kolom yang sama
    var numCols = empData[0].length;
    for (var r = 0; r < empData.length; r++) {
      while (empData[r].length < numCols) {
        empData[r].push('');
      }
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
   * Cek status pendaftaran wajah
   * @param {object} session - session login
   * @returns {object} { success, enrolled, employeeName }
   */
  getStatus: function (session) {
    if (!session || !session.employeeId) {
      return { success: false, message: 'Akun tidak terhubung ke data karyawan' };
    }

    var stored = FaceService.getStoredDescriptor(session.employeeId);

    // Jika wajah belum terdaftar, return enrolled=false
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
 * Pastikan kolom faceDescriptor dan faceRegistered ada di sheet EMPLOYEE
 * Dipanggil otomatis oleh getStoredDescriptor
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
 * Cari employee row berdasarkan ID atau employeeId
 * Dipanggil oleh FaceService.enroll dan fungsi internal lainnya
 */
function findEmployeeRow_(sheet, employeeKey) {
  ensureFaceColumns_(sheet);

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) lastRow = 2;

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];

  var idCol = headers.indexOf('id');
  var employeeIdCol = headers.indexOf('employeeId');
  var faceDescCol = headers.indexOf('faceDescriptor');
  var faceRegCol = headers.indexOf('faceRegistered');

  employeeKey = String(employeeKey).trim();

  for (var i = 1; i < values.length; i++) {
    var id = idCol >= 0 ? String(values[i][idCol]).trim() : '';
    var emp = employeeIdCol >= 0 ? String(values[i][employeeIdCol]).trim() : '';

    if (id === employeeKey || emp === employeeKey) {
      var descriptor = [];
      try {
        descriptor = FaceService.normalizeDescriptor(values[i][faceDescCol] || '[]');
      } catch (e) {
        descriptor = [];
      }

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

  return null;
}