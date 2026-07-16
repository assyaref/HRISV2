/**
 * Employee.gs - Employee CRUD Service
 */

var EmployeeService = {
  list: function (params) {
    var employees = sheetToObjects(CONFIG.SHEETS.EMPLOYEE);
    if (params.search) {
      var q = String(params.search).toLowerCase();
      employees = employees.filter(function (e) {
        return (
          String(e.fullName).toLowerCase().indexOf(q) >= 0 ||
          String(e.employeeId).toLowerCase().indexOf(q) >= 0 ||
          String(e.email).toLowerCase().indexOf(q) >= 0 ||
          String(e.nik).indexOf(q) >= 0
        );
      });
    }
    if (params.departmentId) {
      employees = employees.filter(function (e) { return e.departmentId === params.departmentId; });
    }
    if (params.status) {
      employees = employees.filter(function (e) { return e.employmentStatus === params.status; });
    }
    return ok(employees);
  },

  save: function (params, session) {
    if (!requireRole(session, ['Administrator', 'HR'])) return fail('Akses ditolak');
    if (!params.fullName) return fail('Nama lengkap wajib diisi');

    var now = new Date().toISOString();
    var employees = sheetToObjects(CONFIG.SHEETS.EMPLOYEE);

    // Auto-generate employee ID
    var employeeId = params.employeeId;
    if (!employeeId) {
      var maxNum = 0;
      employees.forEach(function (e) {
        var num = parseInt(String(e.employeeId).replace(/\D/g, ''), 10);
        if (num > maxNum) maxNum = num;
      });
      employeeId = 'EMP' + String(maxNum + 1).padStart(3, '0');
    }

    var emp = {
      id: generateId('emp'),
      employeeId: employeeId,
      nik: params.nik || '',
      fullName: params.fullName,
      gender: params.gender || 'Male',
      birthDate: params.birthDate || '',
      religion: params.religion || '',
      address: params.address || '',
      phone: params.phone || '',
      email: params.email || '',
      departmentId: params.departmentId || '',
      divisionId: params.divisionId || '',
      positionId: params.positionId || '',
      joinDate: params.joinDate || todayStr(),
      employmentStatus: params.employmentStatus || 'Active',
      salary: Number(params.salary) || 0,
      photo: params.photo || '',
      managerId: params.managerId || '',
      createdAt: now,
      updatedAt: now
    };

    appendObject(CONFIG.SHEETS.EMPLOYEE, emp);
    addLog(session.userId, session.name, 'CREATE', 'Employee', 'Created ' + emp.employeeId);
    return ok(emp, 'Karyawan berhasil ditambahkan');
  },

  update: function (params, session) {
    if (!requireRole(session, ['Administrator', 'HR'])) return fail('Akses ditolak');
    if (!params.id) return fail('ID karyawan wajib diisi');

    params.updatedAt = new Date().toISOString();
    var success = updateObject(CONFIG.SHEETS.EMPLOYEE, params.id, params);
    if (!success) return fail('Karyawan tidak ditemukan');

    addLog(session.userId, session.name, 'UPDATE', 'Employee', 'Updated ' + params.id);
    return ok(params, 'Karyawan berhasil diperbarui');
  },

  remove: function (id, session) {
    if (!requireRole(session, ['Administrator', 'HR'])) return fail('Akses ditolak');
    if (!id) return fail('ID wajib diisi');

    var success = deleteObject(CONFIG.SHEETS.EMPLOYEE, id);
    if (!success) return fail('Karyawan tidak ditemukan');

    addLog(session.userId, session.name, 'DELETE', 'Employee', 'Deleted ' + id);
    return ok(null, 'Karyawan berhasil dihapus');
  }
};
