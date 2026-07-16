/**
 * Leave.gs - Leave & Permission Service
 */

var LeaveService = {
  list: function (params) {
    var list = sheetToObjects(CONFIG.SHEETS.LEAVE);
    if (params.employeeId) list = list.filter(function (l) { return l.employeeId === params.employeeId; });
    if (params.status) list = list.filter(function (l) { return l.status === params.status; });
    list.sort(function (a, b) { return b.createdAt > a.createdAt ? 1 : -1; });
    return ok(list);
  },

  save: function (params, session) {
    if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan');
    if (!params.startDate || !params.endDate || !params.reason) return fail('Lengkapi semua field');

    var days = calcDays(params.startDate, params.endDate);
    var leave = {
      id: generateId('leave'),
      employeeId: session.employeeId,
      leaveType: params.leaveType || 'Annual',
      startDate: params.startDate,
      endDate: params.endDate,
      days: days,
      reason: params.reason,
      status: 'Pending',
      managerNote: '',
      hrNote: '',
      approvedByManager: '',
      approvedByHR: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    appendObject(CONFIG.SHEETS.LEAVE, leave);
    addLog(session.userId, session.name, 'CREATE', 'Leave', leave.leaveType + ' ' + days + ' days');
    return ok(leave, 'Pengajuan cuti berhasil dikirim');
  },

  approve: function (params, session) {
    if (!requireRole(session, ['Administrator', 'HR', 'Manager'])) return fail('Akses ditolak');
    if (!params.id) return fail('ID cuti wajib diisi');

    var updates = { updatedAt: new Date().toISOString() };

    if (params.action === 'reject') {
      updates.status = 'Rejected';
      if (session.role === 'HR' || session.role === 'Administrator') updates.hrNote = params.note || '';
      else updates.managerNote = params.note || '';
    } else if (params.action === 'approve_manager') {
      updates.status = 'Approved Manager';
      updates.approvedByManager = session.employeeId || session.userId;
      updates.managerNote = params.note || '';
    } else {
      updates.status = 'Approved HR';
      updates.approvedByHR = session.employeeId || session.userId;
      updates.hrNote = params.note || '';
    }

    var success = updateObject(CONFIG.SHEETS.LEAVE, params.id, updates);
    if (!success) return fail('Data cuti tidak ditemukan');

    addLog(session.userId, session.name, (params.action || 'APPROVE').toUpperCase(), 'Leave', params.id);
    return ok(updates, 'Status cuti diperbarui');
  },

  // Permissions (Izin/Sakit/Dinas/WFH)
  listPermissions: function (params) {
    var list = sheetToObjects(CONFIG.SHEETS.PERMISSION);
    if (params.employeeId) list = list.filter(function (p) { return p.employeeId === params.employeeId; });
    list.sort(function (a, b) { return b.createdAt > a.createdAt ? 1 : -1; });
    return ok(list);
  },

  savePermission: function (params, session) {
    if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan');
    if (!params.date || !params.reason) return fail('Lengkapi field wajib');

    var perm = {
      id: generateId('perm'),
      employeeId: session.employeeId,
      type: params.type || 'Izin',
      date: params.date,
      startTime: params.startTime || '',
      endTime: params.endTime || '',
      reason: params.reason,
      status: 'Pending',
      approvedBy: '',
      note: '',
      createdAt: new Date().toISOString()
    };

    appendObject(CONFIG.SHEETS.PERMISSION, perm);
    return ok(perm, 'Pengajuan izin berhasil dikirim');
  },

  approvePermission: function (params, session) {
    if (!requireRole(session, ['Administrator', 'HR', 'Manager'])) return fail('Akses ditolak');
    if (!params.id) return fail('ID izin wajib diisi');

    var updates = {
      status: params.action === 'approve' ? 'Approved' : 'Rejected',
      approvedBy: session.employeeId || session.userId,
      note: params.note || ''
    };

    var success = updateObject(CONFIG.SHEETS.PERMISSION, params.id, updates);
    if (!success) return fail('Data izin tidak ditemukan');
    return ok(updates, 'Status izin diperbarui');
  }
};
