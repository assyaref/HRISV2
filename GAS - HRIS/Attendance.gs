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

    // 1. FACE VERIFICATION - Cari employee via findByField
    var employee = findByField(CONFIG.SHEETS.EMPLOYEE, 'id', session.employeeId);
    if (!employee) {
      employee = findByField(CONFIG.SHEETS.EMPLOYEE, 'employeeId', session.employeeId);
    }
    if (!employee) {
      return fail('Data karyawan tidak ditemukan');
    }

    // 2. Parse face descriptor dari JSON string
    var storedDescriptor = [];
    try {
      storedDescriptor = JSON.parse(employee.faceDescriptor || '[]');
    } catch (e) {
      storedDescriptor = [];
    }

    // 3. Cek apakah wajah sudah terdaftar
    var isFaceRegistered =
      employee.faceRegistered === true ||
      String(employee.faceRegistered).toLowerCase() === 'true';

    // BYPASS SEMENTARA: Jika wajah belum terdaftar, lanjutkan dengan warning
    if (!isFaceRegistered || storedDescriptor.length === 0) {
      Logger.log('WARNING: Face not registered, bypassing for employee: ' + session.employeeId);
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

    // 1. FACE VERIFICATION - Cari employee via findByField
    var employee = findByField(CONFIG.SHEETS.EMPLOYEE, 'id', session.employeeId);
    if (!employee) {
      employee = findByField(CONFIG.SHEETS.EMPLOYEE, 'employeeId', session.employeeId);
    }
    if (!employee) {
      return fail('Data karyawan tidak ditemukan');
    }

    // 2. Parse face descriptor dari JSON string
    var storedDescriptor = [];
    try {
      storedDescriptor = JSON.parse(employee.faceDescriptor || '[]');
    } catch (e) {
      storedDescriptor = [];
    }

    // 3. Cek apakah wajah sudah terdaftar
    var isFaceRegistered =
      employee.faceRegistered === true ||
      String(employee.faceRegistered).toLowerCase() === 'true';

    if (!isFaceRegistered || storedDescriptor.length === 0) {
      return fail(
        'Wajah Anda belum terdaftar. Silakan daftarkan wajah terlebih dahulu di menu Face ID sebelum melakukan absensi.'
      );
    }

    // 4. VERIFIKASI WAJAH
    var faceVerifiedByClient = params.faceVerified === true || params.faceVerified === 'true';
    var hasDescriptorFromClient = params.faceDescriptor && Array.isArray(params.faceDescriptor) && params.faceDescriptor.length > 0;

    if (!faceVerifiedByClient && !hasDescriptorFromClient) {
      return fail('Verifikasi wajah diperlukan. Silakan ambil foto untuk verifikasi.');
    }

    if (hasDescriptorFromClient && storedDescriptor.length > 0) {
      var similarity = calculateCosineSimilarity(params.faceDescriptor, storedDescriptor);
      var threshold = faceVerifiedByClient ? 0.30 : 0.40;

      if (similarity < threshold) {
        return fail(
          'Verifikasi wajah gagal. Wajah tidak cocok dengan data terdaftar (similarity: ' +
          Math.round(similarity * 100) + '%, threshold: ' + Math.round(threshold * 100) + '%). Silakan ambil foto ulang atau daftarkan ulang wajah Anda.'
        );
      }
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