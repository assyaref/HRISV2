/**
 * AttendanceService.gs - Layanan Absensi dengan Verifikasi Wajah
 * 
 * Perbaikan: Jika faceVerified=true dari frontend, langsung proses tanpa verifikasi ulang.
 */

var AttendanceService = (function() {

  // ================================
  //  CHECK IN
  // ================================
  function checkIn(params, session) {
    var employeeId = session.employeeId;
    if (!employeeId) {
      logError('checkIn', 'employeeId kosong', session);
      return { success: false, message: 'Employee ID tidak ditemukan. Silakan login ulang.' };
    }

    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var now = new Date();
    var timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');

    // Cek apakah sudah check-in hari ini
    var existing = findAttendance(employeeId, today);
    if (existing && existing.checkIn) {
      return { success: false, message: 'Anda sudah check-in hari ini.' };
    }

    // ============================================================
    // 🔥 VERIFIKASI WAJAH (hanya jika faceVerified !== true)
    // ============================================================
    var faceVerified = (params.faceVerified === true);
    logInfo('checkIn', 'faceVerified = ' + faceVerified + ', employeeId=' + employeeId);

    if (!faceVerified) {
      // Jika tidak ada verifikasi dari frontend, lakukan pengecekan stored descriptor
      var stored = getStoredDescriptor(employeeId, session.email);
      if (!stored) {
        logError('checkIn', 'Tidak ada stored descriptor untuk ' + employeeId + ' (email=' + session.email + ')');
        return { success: false, message: 'Wajah belum terdaftar. Silakan daftarkan wajah di menu Face ID.' };
      }

      var faceDescriptor = params.faceDescriptor;
      if (faceDescriptor && Array.isArray(faceDescriptor) && faceDescriptor.length > 0) {
        var similarity = compareFaceDescriptors(faceDescriptor, stored);
        if (similarity < CONFIG.FACE_SIMILARITY_THRESHOLD) {
          logError('checkIn', 'Similarity rendah: ' + similarity + ' (threshold: ' + CONFIG.FACE_SIMILARITY_THRESHOLD + ')');
          return { success: false, message: 'Verifikasi wajah gagal. Wajah tidak cocok.' };
        }
      } else {
        // Tidak ada descriptor dari frontend, kita hanya percaya stored (kurang aman)
        logWarn('checkIn', 'Tidak ada faceDescriptor, hanya mengandalkan stored descriptor.');
      }
    } else {
      // faceVerified=true dari frontend — tetap verifikasi similarity dengan stored descriptor
      logInfo('checkIn', 'faceVerified=true, verifikasi similarity dengan stored descriptor.');
      var stored2 = getStoredDescriptor(employeeId, session.email);
      if (!stored2) {
        logError('checkIn', 'Tidak ada stored descriptor untuk ' + employeeId);
        return { success: false, message: 'Wajah belum terdaftar. Silakan daftarkan wajah di menu Face ID.' };
      }
      if (params.faceDescriptor && Array.isArray(params.faceDescriptor) && params.faceDescriptor.length > 0) {
        var sim2 = compareFaceDescriptors(params.faceDescriptor, stored2);
        if (sim2 < CONFIG.FACE_SIMILARITY_THRESHOLD) {
          logError('checkIn', 'Similarity rendah (faceVerified path): ' + sim2);
          return { success: false, message: 'Verifikasi wajah gagal. Wajah tidak cocok (' + Math.round(sim2 * 100) + '%).' };
        }
      }
    }

    // ============================================================
    // 💾 SIMPAN ABSENSI
    // ============================================================
    var attendance = {
      id: generateId('att'),
      employeeId: employeeId,
      date: today,
      checkIn: timeStr,
      checkOut: null,
      checkInLat: params.lat || null,
      checkInLng: params.lng || null,
      checkOutLat: null,
      checkOutLng: null,
      checkInPhoto: params.photo || null,
      checkOutPhoto: null,
      status: 'Present',
      workHours: null,
      lateMinutes: calculateLateMinutes(timeStr),
      notes: faceVerified ? 'Verified by Face ID' : '',
      createdAt: new Date().toISOString()
    };

    saveAttendance(attendance);
    logActivity(session.userId, session.name, 'CHECK_IN', 'Attendance', 
                'Check-in ' + employeeId + ' at ' + timeStr + (faceVerified ? ' (faceVerified)' : ''));

    return { success: true, message: 'Check-in berhasil', data: attendance };
  }

  // ================================
  //  CHECK OUT
  // ================================
  function checkOut(params, session) {
    var employeeId = session.employeeId;
    if (!employeeId) {
      logError('checkOut', 'employeeId kosong', session);
      return { success: false, message: 'Employee ID tidak ditemukan. Silakan login ulang.' };
    }

    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var now = new Date();
    var timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');

    var existing = findAttendance(employeeId, today);
    if (!existing || !existing.checkIn) {
      return { success: false, message: 'Anda belum check-in hari ini.' };
    }
    if (existing.checkOut) {
      return { success: false, message: 'Anda sudah check-out hari ini.' };
    }

    // Verifikasi wajah (sama seperti checkIn)
    var faceVerified = (params.faceVerified === true);
    logInfo('checkOut', 'faceVerified = ' + faceVerified + ', employeeId=' + employeeId);

    if (!faceVerified) {
      var stored = getStoredDescriptor(employeeId, session.email);
      if (!stored) {
        logError('checkOut', 'Tidak ada stored descriptor untuk ' + employeeId + ' (email=' + session.email + ')');
        return { success: false, message: 'Wajah belum terdaftar. Silakan daftarkan wajah di menu Face ID.' };
      }
      var faceDescriptor = params.faceDescriptor;
      if (faceDescriptor && Array.isArray(faceDescriptor) && faceDescriptor.length > 0) {
        var similarity = compareFaceDescriptors(faceDescriptor, stored);
        if (similarity < CONFIG.FACE_SIMILARITY_THRESHOLD) {
          logError('checkOut', 'Similarity rendah: ' + similarity + ' (threshold: ' + CONFIG.FACE_SIMILARITY_THRESHOLD + ')');
          return { success: false, message: 'Verifikasi wajah gagal. Wajah tidak cocok.' };
        }
      } else {
        logWarn('checkOut', 'Tidak ada faceDescriptor, hanya mengandalkan stored descriptor.');
      }
    } else {
      // faceVerified=true dari frontend — tetap verifikasi similarity dengan stored descriptor
      logInfo('checkOut', 'faceVerified=true, verifikasi similarity dengan stored descriptor.');
      var stored3 = getStoredDescriptor(employeeId, session.email);
      if (!stored3) {
        logError('checkOut', 'Tidak ada stored descriptor untuk ' + employeeId);
        return { success: false, message: 'Wajah belum terdaftar. Silakan daftarkan wajah di menu Face ID.' };
      }
      if (params.faceDescriptor && Array.isArray(params.faceDescriptor) && params.faceDescriptor.length > 0) {
        var sim3 = compareFaceDescriptors(params.faceDescriptor, stored3);
        if (sim3 < CONFIG.FACE_SIMILARITY_THRESHOLD) {
          logError('checkOut', 'Similarity rendah (faceVerified path): ' + sim3);
          return { success: false, message: 'Verifikasi wajah gagal. Wajah tidak cocok (' + Math.round(sim3 * 100) + '%).' };
        }
      }
    }

    // Hitung jam kerja
    var diff = calculateWorkHours(existing.checkIn, timeStr);
    var workHours = diff.hours;

    existing.checkOut = timeStr;
    existing.checkOutLat = params.lat || null;
    existing.checkOutLng = params.lng || null;
    existing.checkOutPhoto = params.photo || null;
    existing.workHours = workHours;
    existing.status = workHours >= 8 ? 'Present' : 'Early Leave';
    existing.notes = (existing.notes || '') + (faceVerified ? ' Check-out verified' : '');
    updateAttendance(existing);

    logActivity(session.userId, session.name, 'CHECK_OUT', 'Attendance',
                'Check-out ' + employeeId + ' at ' + timeStr + ' (hours: ' + workHours + ')' +
                (faceVerified ? ' (faceVerified)' : ''));

    return { success: true, message: 'Check-out berhasil', data: existing };
  }

  // ================================
  //  FUNGSI PEMBANTU (sesuaikan dengan struktur sheet Anda)
  // ================================

  function findAttendance(employeeId, date) {
    var sheet = getSheet('ATTENDANCE');
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === employeeId && data[i][2] === date) {
        return {
          row: i + 1,
          id: data[i][0],
          employeeId: data[i][1],
          date: data[i][2],
          checkIn: data[i][3],
          checkOut: data[i][4],
          checkInLat: data[i][5],
          checkInLng: data[i][6],
          checkOutLat: data[i][7],
          checkOutLng: data[i][8],
          checkInPhoto: data[i][9],
          checkOutPhoto: data[i][10],
          status: data[i][11],
          workHours: data[i][12],
          lateMinutes: data[i][13],
          notes: data[i][14],
          createdAt: data[i][15]
        };
      }
    }
    return null;
  }

  function saveAttendance(att) {
    var sheet = getSheet('ATTENDANCE');
    if (!sheet) return;
    sheet.appendRow([
      att.id,
      att.employeeId,
      att.date,
      att.checkIn,
      att.checkOut,
      att.checkInLat,
      att.checkInLng,
      att.checkOutLat,
      att.checkOutLng,
      att.checkInPhoto,
      att.checkOutPhoto,
      att.status,
      att.workHours,
      att.lateMinutes,
      att.notes,
      att.createdAt
    ]);
  }

  function updateAttendance(att) {
    var sheet = getSheet('ATTENDANCE');
    if (!sheet) return;
    var row = att.row;
    // ATTENDANCE columns (1-indexed): id,employeeId,date,checkIn,checkOut,checkInLat,checkInLng,checkOutLat,checkOutLng,checkInPhoto,checkOutPhoto,status,workHours,lateMinutes,notes,createdAt
    sheet.getRange(row, 5).setValue(att.checkOut || '');
    sheet.getRange(row, 8).setValue(att.checkOutLat || '');
    sheet.getRange(row, 9).setValue(att.checkOutLng || '');
    sheet.getRange(row, 11).setValue(att.checkOutPhoto || '');
    sheet.getRange(row, 12).setValue(att.status || '');
    sheet.getRange(row, 13).setValue(att.workHours || '');
    sheet.getRange(row, 15).setValue(att.notes || '');
  }

  function getStoredDescriptor(employeeId, optEmail) {
    var sheet = getSheet('EMPLOYEE');
    if (!sheet) return null;
    
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) return null;
    
    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0];
    
    var idCol = headers.indexOf('id');
    var employeeIdCol = headers.indexOf('employeeId');
    var emailCol = headers.indexOf('email');
    var nikCol = headers.indexOf('nik');
    var faceDescCol = headers.indexOf('faceDescriptor');
    var faceRegCol = headers.indexOf('faceRegistered');
    
    if (faceDescCol < 0) return null;
    
    var searchKeys = [];
    if (employeeId) searchKeys.push(String(employeeId).trim().toLowerCase());
    if (optEmail) searchKeys.push(String(optEmail).trim().toLowerCase());
    
    for (var i = 1; i < values.length; i++) {
      var rowId = idCol >= 0 ? String(values[i][idCol]).trim().toLowerCase() : '';
      var rowEmp = employeeIdCol >= 0 ? String(values[i][employeeIdCol]).trim().toLowerCase() : '';
      var rowEmail = emailCol >= 0 ? String(values[i][emailCol]).trim().toLowerCase() : '';
      var rowNik = nikCol >= 0 ? String(values[i][nikCol]).trim().toLowerCase() : '';
      
      var matched = false;
      for (var si = 0; si < searchKeys.length; si++) {
        var sk = searchKeys[si];
        if (rowEmp === sk || rowId === sk || rowEmail === sk || rowNik === sk) {
          matched = true;
          break;
        }
      }
      
      if (matched) {
        var desc = values[i][faceDescCol];
        if (desc && desc.length > 2) {
          try {
            var parsed = JSON.parse(desc);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Auto-heal faceRegistered flag
              var regVal = String(values[i][faceRegCol]).trim().toLowerCase();
              if (regVal !== 'true' && regVal !== '1' && regVal !== 'yes') {
                sheet.getRange(i + 1, faceRegCol + 1).setValue('true');
                SpreadsheetApp.flush();
                logInfo('getStoredDescriptor', 'Auto-heal faceRegistered=true at row ' + (i + 1));
              }
              return parsed;
            }
          } catch (e) {
            logError('getStoredDescriptor', 'Gagal parse descriptor at row ' + (i + 1));
          }
        }
        // Jika ada descriptor tapi kosong/invalid, return null
        return null;
      }
    }
    return null;
  }

  function updateFaceDescriptor(employeeId, optEmail, descriptor) {
    var sheet = getSheet('EMPLOYEE');
    if (!sheet) return;
    
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) return;
    
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
      
      var matched = false;
      for (var si = 0; si < searchKeys.length; si++) {
        var sk = searchKeys[si];
        if (rowEmp === sk || rowId === sk || rowEmail === sk || rowNik === sk) {
          matched = true;
          break;
        }
      }
      
      if (matched) {
        var row = i + 1;
        sheet.getRange(row, faceDescCol + 1).setValue(JSON.stringify(descriptor));
        sheet.getRange(row, faceRegCol + 1).setValue('true');
        logInfo('updateFaceDescriptor', 'Updated descriptor at row ' + row + ' for employeeId=' + rowEmp + ', matchedBy multi-strategy');
        return;
      }
    }
    logWarn('updateFaceDescriptor', 'Employee not found for employeeId=' + employeeId + ', email=' + optEmail);
  }

  function compareFaceDescriptors(desc1, desc2) {
    if (!desc1 || !desc2 || desc1.length === 0 || desc2.length === 0) return 0;
    var len = Math.min(desc1.length, desc2.length);
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < len; i++) {
      dot += desc1[i] * desc2[i];
      na += desc1[i] * desc1[i];
      nb += desc2[i] * desc2[i];
    }
    if (na === 0 || nb === 0) return 0;
    return Math.max(0, Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb))));
  }

  function calculateLateMinutes(timeStr) {
    var parts = timeStr.split(':');
    var hours = parseInt(parts[0]);
    var minutes = parseInt(parts[1]);
    var totalMinutes = hours * 60 + minutes;
    var officeStart = 8 * 60 + 30; // 08:30
    return Math.max(0, totalMinutes - officeStart);
  }

  function calculateWorkHours(checkIn, checkOut) {
    var ci = checkIn.split(':').map(Number);
    var co = checkOut.split(':').map(Number);
    var inMinutes = ci[0]*60 + ci[1] + ci[2]/60;
    var outMinutes = co[0]*60 + co[1] + co[2]/60;
    var diff = (outMinutes - inMinutes) / 60;
    return { hours: Math.round(diff * 100) / 100 };
  }

  function generateId(prefix) {
    return prefix + '-' + Utilities.getUuid().substring(0, 8);
  }

  // ================================
  //  LOGGING KE SHEET LOGS
  // ================================
  function logInfo(action, message) {
    Logger.log('[INFO] ' + action + ': ' + message);
    writeLog('INFO', action, message);
  }

  function logWarn(action, message) {
    Logger.log('[WARN] ' + action + ': ' + message);
    writeLog('WARN', action, message);
  }

  function logError(action, message, session) {
    Logger.log('[ERROR] ' + action + ': ' + message);
    writeLog('ERROR', action, message + (session ? ' | user=' + session.email : ''));
  }

  function writeLog(level, action, message) {
    try {
      var sheet = getSheet('LOGS');
      if (!sheet) return;
      sheet.appendRow([
        generateId('log'),
        '',
        '',
        level,
        action,
        message,
        '',
        new Date().toISOString()
      ]);
    } catch (e) {
      // ignore
    }
  }

  function logActivity(userId, userName, action, module, details) {
    var sheet = getSheet('LOGS');
    if (!sheet) return;
    sheet.appendRow([
      generateId('log'),
      userId || '',
      userName || '',
      action,
      module,
      details || '',
      '',
      new Date().toISOString()
    ]);
  }

  // Uses global getSheet() from Config.gs which correctly uses SpreadsheetApp.openById()

  /**
   * List attendance records (for admin/history views)
   * @param {Object} params - { employeeId, dateFrom, dateTo }
   */
  function list(params) {
    var sheet = getSheet('ATTENDANCE');
    if (!sheet) return { success: true, data: [] };
    var data = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < data.length; i++) {
      var att = {
        id: data[i][0],
        employeeId: data[i][1],
        date: data[i][2],
        checkIn: data[i][3],
        checkOut: data[i][4],
        checkInLat: data[i][5],
        checkInLng: data[i][6],
        checkOutLat: data[i][7],
        checkOutLng: data[i][8],
        checkInPhoto: data[i][9],
        checkOutPhoto: data[i][10],
        status: data[i][11],
        workHours: data[i][12],
        lateMinutes: data[i][13],
        notes: data[i][14],
        createdAt: data[i][15]
      };
      // Filter by employeeId
      if (params.employeeId && att.employeeId !== params.employeeId) continue;
      // Filter by date range
      if (params.dateFrom && att.date < params.dateFrom) continue;
      if (params.dateTo && att.date > params.dateTo) continue;
      result.push(att);
    }
    // Sort by date desc
    result.sort(function(a, b) { return b.date > a.date ? 1 : -1; });
    return { success: true, data: result };
  }

  // ================================
  //  EKSPOR PUBLIK
  // ================================
  return {
    checkIn: checkIn,
    checkOut: checkOut,
    list: list
  };

})();