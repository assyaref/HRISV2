/**
 * Payroll.gs - Payroll Lite Service
 */

var PayrollService = {
  list: function (params) {
    var list = sheetToObjects(CONFIG.SHEETS.PAYROLL);
    if (params.period) list = list.filter(function (p) { return p.period === params.period; });
    if (params.employeeId) list = list.filter(function (p) { return p.employeeId === params.employeeId; });
    list.sort(function (a, b) { return b.period > a.period ? 1 : -1; });
    return ok(list);
  },

  generate: function (period, session) {
    if (!requireRole(session, ['Administrator', 'HR'])) return fail('Akses ditolak');
    if (!period) return fail('Periode wajib diisi (YYYY-MM)');

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
        status: 'Generated',
        generatedAt: new Date().toISOString(),
        paidAt: '',
        notes: ''
      };
      appendObject(CONFIG.SHEETS.PAYROLL, pay);
      generated.push(pay);
    });

    addLog(session.userId, session.name, 'GENERATE', 'Payroll', 'Period ' + period + ': ' + generated.length + ' slips');
    return ok(generated, 'Payroll ' + period + ' berhasil digenerate (' + generated.length + ' slip)');
  }
};
