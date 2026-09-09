/**
 * Payroll.gs - Payroll Lite Service
 */

/**
 * Pastikan kolom slip (file Drive + status) tersedia di sheet PAYROLL.
 * Kompatibel untuk spreadsheet lama — kolom ditambahkan tanpa menghapus data.
 */
function ensurePayrollSlipColumns() {
  var sheet = getSheet(CONFIG.SHEETS.PAYROLL);
  var lastCol = sheet.getLastColumn();
  var headers = [];
  if (lastCol > 0) headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var needed = ['slipFileId', 'slipUrl', 'slipSentAt'];
  var toAdd = [];
  for (var i = 0; i < needed.length; i++) {
    if (headers.indexOf(needed[i]) < 0) toAdd.push(needed[i]);
  }
  if (toAdd.length > 0) {
    if (lastCol === 0) sheet.appendRow(toAdd);
    else sheet.getRange(1, lastCol + 1, 1, toAdd.length).setValues([toAdd]);
  }
  var total = lastCol + toAdd.length;
  sheet.getRange(1, 1, 1, Math.max(total, 1)).setFontWeight('bold');
  return total;
}

var PayrollService = {
  list: function (params) {
    ensurePayrollSlipColumns();
    var list = sheetToObjects(CONFIG.SHEETS.PAYROLL);
    if (params.period) list = list.filter(function (p) { return p.period === params.period; });
    if (params.employeeId) list = list.filter(function (p) { return p.employeeId === params.employeeId; });
    list.sort(function (a, b) { return b.period > a.period ? 1 : -1; });
    return ok(list);
  },

  generate: function (period, session) {
    if (!requireRole(session, ['Administrator', 'HR'])) return fail('Akses ditolak');
    if (!period) return fail('Periode wajib diisi (YYYY-MM)');
    ensurePayrollSlipColumns();

    var employees = sheetToObjects(CONFIG.SHEETS.EMPLOYEE).filter(function (e) {
      return e.employmentStatus !== 'Resigned';
    });

    // Remove existing for period
    var existing = sheetToObjects(CONFIG.SHEETS.PAYROLL);
    existing.forEach(function (p) {
      if (p.period === period) deleteObject(CONFIG.SHEETS.PAYROLL, p.id);
    });

    var generated = [];
    employees.forEach(function (e) {
      var salary = Number(e.salary) || 0;
      var allowance = Math.round(salary * 0.1);
      var overtime = 0;
      var deduction = 0;
      var bpjs = Math.round(salary * 0.04);
      var pph21 = Math.round(salary * 0.05);
      var netSalary = salary + allowance + overtime - deduction - bpjs - pph21;

      var pay = {
        id: generateId('pay'),
        employeeId: e.id,
        period: period,
        basicSalary: salary,
        allowance: allowance,
        overtime: overtime,
        deduction: deduction,
        bpjs: bpjs,
        pph21: pph21,
        netSalary: netSalary,
        status: 'Draft',
        generatedAt: new Date().toISOString(),
        paidAt: '',
        slipFileId: '',
        slipUrl: '',
        slipSentAt: '',
        notes: ''
      };
      appendObject(CONFIG.SHEETS.PAYROLL, pay);
      generated.push(pay);
    });

    addLog(session.userId, session.name, 'GENERATE', 'Payroll', 'Period ' + period + ': ' + generated.length + ' slips');
    return ok(generated, 'Payroll ' + period + ' berhasil digenerate (' + generated.length + ' slip)');
  },

  /**
   * Kirim slip gaji (simulasi distribusi). Guard: slip harus sudah diupload.
   * Status berubah: "Slip Tersedia" -> "Terkirim".
   */
  send: function (id, session) {
    if (!requireRole(session, ['Administrator', 'HR'])) return fail('Akses ditolak');
    if (!id) return fail('ID payroll wajib diisi');
    ensurePayrollSlipColumns();

    var pays = sheetToObjects(CONFIG.SHEETS.PAYROLL);
    var pay = null;
    for (var i = 0; i < pays.length; i++) {
      if (String(pays[i].id) === String(id)) { pay = pays[i]; break; }
    }
    if (!pay) return fail('Payroll tidak ditemukan');

    if (String(pay.status) !== 'Slip Tersedia' && !pay.slipUrl) {
      return fail('Upload slip gaji terlebih dahulu!');
    }

    var now = new Date().toISOString();
    updateObject(CONFIG.SHEETS.PAYROLL, id, { status: 'Terkirim', slipSentAt: now });
    addLog(session.userId, session.name, 'SEND', 'Payroll', 'Sent slip period ' + pay.period);

    var emp = findByField(CONFIG.SHEETS.EMPLOYEE, 'id', String(pay.employeeId));
    if (!emp) emp = findByField(CONFIG.SHEETS.EMPLOYEE, 'employeeId', String(pay.employeeId));

    var email = '';
    var fullName = String(pay.employeeId);
    var password = '';
    if (emp) {
      email = String(emp.email || '');
      fullName = String(emp.fullName || fullName);
      var base = String(emp.nik || emp.employeeId || '');
      var m = String(emp.birthDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (base && m) password = base + m[3] + m[2] + m[1];
    }

    var msg = 'Slip gaji untuk ' + fullName + ' berhasil dikirim' + (email ? ' ke ' + email : '') + '.';
    if (password) msg += ' Password: ' + password;

    return ok({ id: id, status: 'Terkirim', slipSentAt: now }, msg);
  }
};

