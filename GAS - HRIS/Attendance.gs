/**
 * Attendance.gs - Attendance Service (Check-in / Check-out)
 * Menggunakan FaceService untuk verifikasi wajah terpusat.
 * 
 * PERUBAHAN: Face verification logic dipindah ke FaceService.gs
 * untuk menghindari duplikasi kode dengan UserService.gs.
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

    var employeeId = faceResult.employeeId || session.employeeId;

    var today = todayStr();
    var existing = sheetToObjects(CONFIG.SHEETS.ATTENDANCE).filter(function (a) {
      return a.employeeId === employeeId && a.date === today;
    });
    if (existing.length > 0 && existing[0].checkIn) {
      return fail('Anda sudah check-in hari ini');
    }

    // FACE VERIFICATION - menggunakan FaceService terpusat (multi-strategy lookup)
    // Session.email digunakan sebagai fallback jika session.employeeId tidak match dengan EMPLOYEE sheet
    var faceResult = FaceService.verifyForAttendance(params, session);
    if (!faceResult.success) {
      return fail(faceResult.message);
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
      employeeId: employeeId, // FIXED: use resolved employeeId
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

    // FACE VERIFICATION - menggunakan FaceService terpusat
    var faceResult = FaceService.verifyForAttendance(params, session);
    if (!faceResult.success) {
      return fail(faceResult.message);
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