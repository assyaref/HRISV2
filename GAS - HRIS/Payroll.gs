/**
 * Payroll.gs - Payroll Lite Service
 *
 * Versi batch: generate membaca & menulis spreadsheet dalam satu operasi besar
 * (bukan per-baris) agar tetap cepat walau karyawan banyak dan tidak melampaui
 * batas waktu eksekusi Apps Script.
 */

var PAYROLL_BASE_HEADERS = ['id', 'employeeId', 'period', 'basicSalary', 'allowance', 'overtime', 'deduction', 'bpjs', 'pph21', 'netSalary', 'status', 'generatedAt', 'paidAt', 'notes'];
var PAYROLL_FULL_HEADERS = PAYROLL_BASE_HEADERS.concat(['slipFileId', 'slipUrl', 'slipSentAt']);

function getOrCreateSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

/**
 * Pastikan kolom slip (file Drive + status) tersedia di sheet PAYROLL.
 * Kompatibel untuk spreadsheet lama — kolom ditambahkan tanpa menghapus data.
 */
function ensurePayrollSlipColumns() {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet_(ss, CONFIG.SHEETS.PAYROLL);
  return ensurePayrollHeaders_(sheet);
}

function ensurePayrollHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (headers.length === 0) {
    sheet.appendRow(PAYROLL_FULL_HEADERS);
    headers = PAYROLL_FULL_HEADERS.slice();
  } else {
    var toAdd = [];
    for (var i = 0; i < PAYROLL_FULL_HEADERS.length; i++) {
      if (headers.indexOf(PAYROLL_FULL_HEADERS[i]) < 0) toAdd.push(PAYROLL_FULL_HEADERS[i]);
    }
    if (toAdd.length > 0) {
      sheet.getRange(1, lastCol + 1, 1, toAdd.length).setValues([toAdd]);
      headers = headers.concat(toAdd);
    }
  }
  if (headers.length > 0) sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  return headers;
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

  /**
   * Generate payroll untuk satu periode, semua karyawan aktif.
   * Hapus baris lama periode tsb lalu tulis ulang seluruh sheet PAYROLL
   * dalam SATU operasi setValues (cepat walau ratusan karyawan).
   */
  generate: function (period, session) {
    if (!requireRole(session, ['Administrator', 'HR'])) return fail('Akses ditolak');
    if (!period) return fail('Periode wajib diisi (YYYY-MM)');

    var ss = getSpreadsheet();
    var paySheet = getOrCreateSheet_(ss, CONFIG.SHEETS.PAYROLL);
    var headers = ensurePayrollHeaders_(paySheet);

    // ---- 1) Baca data lama & sisakan baris periode lain -----------------
    var payData = paySheet.getDataRange().getValues();
    var periodCol = headers.indexOf('period');
    var kept = [];
    for (var r = 1; r < payData.length; r++) {
      var rowPeriod = periodCol >= 0 ? String(payData[r][periodCol] || '') : '';
      if (rowPeriod !== period) kept.push(payData[r]);
    }

    // ---- 2) Baca karyawan sekali ----------------------------------------
    var empSheet = getOrCreateSheet_(ss, CONFIG.SHEETS.EMPLOYEE);
    var empData = empSheet.getDataRange().getValues();
    var empHeaders = empData.length > 0 ? empData[0] : [];
    var cId = empHeaders.indexOf('id');
    var cStatus = empHeaders.indexOf('employmentStatus');
    var cSalary = empHeaders.indexOf('salary');

    var generated = [];
    var newRows = [];
    var nowIso = new Date().toISOString();

    for (var e = 1; e < empData.length; e++) {
      var empRow = empData[e];
      var statusVal = cStatus >= 0 ? String(empRow[cStatus]) : '';
      if (statusVal === 'Resigned') continue;

      var empId = cId >= 0 ? String(empRow[cId]) : '';
      var salary = Number((cSalary >= 0 ? empRow[cSalary] : 0)) || 0;
      var allowance = Math.round(salary * 0.1);
      var overtime = 0;
      var deduction = 0;
      var bpjs = Math.round(salary * 0.04);
      var pph21 = Math.round(salary * 0.05);
      var netSalary = salary + allowance + overtime - deduction - bpjs - pph21;

      var pay = {
        id: generateId('pay'),
        employeeId: empId,
        period: period,
        basicSalary: salary,
        allowance: allowance,
        overtime: overtime,
        deduction: deduction,
        bpjs: bpjs,
        pph21: pph21,
        netSalary: netSalary,
        status: 'Draft',
        generatedAt: nowIso,
        paidAt: '',
        slipFileId: '',
        slipUrl: '',
        slipSentAt: '',
        notes: ''
      };

      // Sesuaikan dengan urutan header sheet
      var row = headers.map(function (h) {
        var v = pay[h];
        if (v === undefined || v === null) return '';
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        return v;
      });
      newRows.push(row);
      generated.push(pay);
    }

    // ---- 3) Tulis ulang seluruh sheet sekali ----------------------------
    if (paySheet.getLastRow() > 0 || paySheet.getLastColumn() > 0) {
      var maxR = Math.max(paySheet.getMaxRows(), 1);
      var maxC = Math.max(paySheet.getMaxColumns(), headers.length);
      paySheet.getRange(1, 1, maxR, maxC).clearContent();
    }

    var all = [headers].concat(kept, newRows);
    paySheet.getRange(1, 1, all.length, headers.length).setValues(all);
    paySheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

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

