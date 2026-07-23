/**
 * Attendance.gs - Attendance Service (Check-in / Check-out)
 * Includes face verification for secure attendance
 */

var AttendanceService = {
  list: function (params) {
    var list = sheetToObjects(CONFIG.SHEETS.ATTENDANCE);
    if (params.employeeId) {
      list = list.filter(function (a) { return a.employeeId === params.employeeId; });
    }
    if (params.dateFrom) {
      list = list.filter(function (a) { return a.date >= params.dateFrom; });
    }
    if (params.dateTo) {
      list = list.filter(function (a) { return a.date <= params.dateTo; });
    }
    // Sort by date desc
    list.sort(function (a, b) { return b.date > a.date ? 1 : -1; });
    return ok(list);
  },

  checkIn: function (params, session) {
    if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan');

    var today = todayStr();
    var existing = sheetToObjects(CONFIG.SHEETS.ATTENDANCE).filter(function (a) {
      return a.employeeId === session.employeeId && a.date === today;
    });
    if (existing.length > 0 && existing[0].checkIn) {
      return fail('Anda sudah check-in hari ini');
    }

    // 1. FACE VERIFICATION - Check if face is registered
    var empSheet = getSheet('EMPLOYEE');
    ensureFaceColumns_(empSheet);
    var empData = empSheet.getDataRange().getValues();
    var empHeaders = empData[0];
    var empIdCol = empHeaders.indexOf('id');
    var faceDescCol = empHeaders.indexOf('faceDescriptor');
    var faceRegCol = empHeaders.indexOf('faceRegistered');
    var employeeFound = false;
    var isFaceRegistered = false;
    var storedDescriptor = [];

    for (var ei = 1; ei < empData.length; ei++) {
      if (String(empData[ei][empIdCol]).trim() === String(session.employeeId).trim()) {
        employeeFound = true;
        try {
          storedDescriptor = JSON.parse(String(empData[ei][faceDescCol] || '[]'));
        } catch (e) {
          storedDescriptor = [];
        }
        isFaceRegistered = storedDescriptor.length > 0 ||
          (faceRegCol >= 0 && String(empData[ei][faceRegCol]).toLowerCase() === 'true');
        break;
      }
    }

    if (!employeeFound) {
      return fail('Data karyawan tidak ditemukan');
    }

    // 2. WAJIB DAFTAR WAJAH SEBELUM CHECK-IN
    if (!isFaceRegistered) {
      return fail(
        'Wajah Anda belum terdaftar. Silakan daftarkan wajah terlebih dahulu di menu Face ID sebelum melakukan absensi.'
      );
    }

    // 3. VERIFIKASI WAJAH - Jika ada face descriptor dari frontend, cocokkan
    if (params.faceDescriptor && Array.isArray(params.faceDescriptor) && params.faceDescriptor.length > 0) {
      if (storedDescriptor.length > 0) {
        var similarity = calculateCosineSimilarity(params.faceDescriptor, storedDescriptor);
        var threshold = CONFIG.FACE_SIMILARITY_THRESHOLD || 0.65;
        
        if (similarity < threshold) {
          return fail(
            'Verifikasi wajah gagal. Wajah tidak cocok dengan data terdaftar (similarity: ' + 
            Math.round(similarity * 100) + '%, threshold: ' + Math.round(threshold * 100) + '%).'
          );
        }
      }
    } else if (params.faceVerified !== true && params.faceVerified !== 'true') {
      // If no face data sent, require face verification
      return fail('Verifikasi wajah diperlukan. Silakan ambil foto untuk verifikasi.');
    }

    var now = new Date();
    var checkInTime = nowTime();
    var startParts = CONFIG.WORK_START.split(':');
    var workStartMin = Number(startParts[0]) * 60 + Number(startParts[1]) + CONFIG.LATE_TOLERANCE;
    var currentMin = now.getHours() * 60 + now.getMinutes();
    var lateMinutes = Math.max(0, currentMin - workStartMin);
    var status = lateMinutes > 0 ? 'Late' : 'Present';

    // Optional: upload selfie to Drive
    var photoUrl = '';
    if (params.photo) {
      try {
        var uploadRes = UploadService.uploadPhoto(params.photo, 'checkin_' + session.employeeId + '_' + today + '.jpg', 'image/jpeg');
        if (uploadRes.success) photoUrl = uploadRes.data.url;
      } catch (e) {
        // ignore photo upload errors
      }
    }

    var att = {
      id: generateId('att'),
      employeeId: session.employeeId,
      date: today,
      checkIn: checkInTime,
      checkOut: '',
      checkInLat: params.lat || '',
      checkInLng: params.lng || '',
      checkOutLat: '',
      checkOutLng: '',
      checkInPhoto: photoUrl,
      checkOutPhoto: '',
      status: status,
      workHours: '',
      lateMinutes: lateMinutes,
      notes: '',
      createdAt: new Date().toISOString()
    };

    appendObject(CONFIG.SHEETS.ATTENDANCE, att);
    addLog(session.userId, session.name, 'CHECK_IN', 'Attendance', status + (lateMinutes ? ' (' + lateMinutes + 'm late)' : ''));

    var msg = status === 'Late' ? 'Check-in berhasil (Terlambat ' + lateMinutes + ' menit)' : 'Check-in berhasil';
    return ok(att, msg);
  },

  checkOut: function (params, session) {
    if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan');

    var today = todayStr();
    var list = sheetToObjects(CONFIG.SHEETS.ATTENDANCE);
    var att = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].employeeId === session.employeeId && list[i].date === today) {
        att = list[i];
        break;
      }
    }

    if (!att || !att.checkIn) return fail('Anda belum check-in hari ini');
    if (att.checkOut) return fail('Anda sudah check-out hari ini');

    // 1. FACE VERIFICATION - Check if face is registered
    var empSheet = getSheet('EMPLOYEE');
    ensureFaceColumns_(empSheet);
    var empData = empSheet.getDataRange().getValues();
    var empHeaders = empData[0];
    var empIdCol = empHeaders.indexOf('id');
    var faceDescCol = empHeaders.indexOf('faceDescriptor');
    var faceRegCol = empHeaders.indexOf('faceRegistered');
    var isFaceRegistered = false;
    var storedDescriptor = [];

    for (var ei = 1; ei < empData.length; ei++) {
      if (String(empData[ei][empIdCol]).trim() === String(session.employeeId).trim()) {
        try {
          storedDescriptor = JSON.parse(String(empData[ei][faceDescCol] || '[]'));
        } catch (e) {
          storedDescriptor = [];
        }
        isFaceRegistered = storedDescriptor.length > 0 ||
          (faceRegCol >= 0 && String(empData[ei][faceRegCol]).toLowerCase() === 'true');
        break;
      }
    }

    // 2. WAJIB DAFTAR WAJAH SEBELUM CHECK-OUT
    if (!isFaceRegistered) {
      return fail(
        'Wajah Anda belum terdaftar. Silakan daftarkan wajah terlebih dahulu di menu Face ID sebelum melakukan absensi.'
      );
    }

    // 3. VERIFIKASI WAJAH - Jika ada face descriptor dari frontend, cocokkan
    if (params.faceDescriptor && Array.isArray(params.faceDescriptor) && params.faceDescriptor.length > 0) {
      if (storedDescriptor.length > 0) {
        var similarity = calculateCosineSimilarity(params.faceDescriptor, storedDescriptor);
        var threshold = CONFIG.FACE_SIMILARITY_THRESHOLD || 0.65;
        
        if (similarity < threshold) {
          return fail(
            'Verifikasi wajah gagal. Wajah tidak cocok dengan data terdaftar (similarity: ' + 
            Math.round(similarity * 100) + '%, threshold: ' + Math.round(threshold * 100) + '%).'
          );
        }
      }
    } else if (params.faceVerified !== true && params.faceVerified !== 'true') {
      return fail('Verifikasi wajah diperlukan. Silakan ambil foto untuk verifikasi.');
    }

    var checkOutTime = nowTime();
    var inParts = String(att.checkIn).split(':');
    var now = new Date();
    var workHours = ((now.getHours() + now.getMinutes() / 60) - (Number(inParts[0]) + Number(inParts[1]) / 60)).toFixed(2);

    var photoUrl = '';
    if (params.photo) {
      try {
        var uploadRes = UploadService.uploadPhoto(params.photo, 'checkout_' + session.employeeId + '_' + today + '.jpg', 'image/jpeg');
        if (uploadRes.success) photoUrl = uploadRes.data.url;
      } catch (e) { /* ignore */ }
    }

    updateObject(CONFIG.SHEETS.ATTENDANCE, att.id, {
      checkOut: checkOutTime,
      checkOutLat: params.lat || '',
      checkOutLng: params.lng || '',
      checkOutPhoto: photoUrl,
      workHours: workHours
    });

    att.checkOut = checkOutTime;
    att.workHours = workHours;

    addLog(session.userId, session.name, 'CHECK_OUT', 'Attendance', 'Work hours: ' + workHours + 'h');
    return ok(att, 'Check-out berhasil');
  }
};

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
  return Math.max(0, Math.min(1, similarity));
}
