/**
 * FaceTemplateService.gs - FACE ID v2
 * =====================================
 * Arsitektur baru yang menggantikan total flow face lama.
 *
 * Prinsip:
 * 1. SATU SUMBER KEBENARAN: sheet FACE_TEMPLATES (bukan kolom di EMPLOYEE,
 *    bukan localStorage frontend).
 * 2. IDENTITAS IMMUTABLE: lookup HANYA by USER_ID (USERS.id).
 *    EmployeeId / email hanya metadata pelengkap, bukan kunci pencarian.
 * 3. 1 EMPLOYEE = 0 ATAU 1 TEMPLATE ACTIVE. Register ulang => lama INACTIVE.
 * 4. REGISTRATION TRANSAKSIONAL: WRITE -> READ BACK -> VALIDATE -> SUCCESS.
 *    Tidak ada pesan sukses sebelum data benar-benar bisa dibaca kembali.
 * 5. VERIFIKASI SERVER-SIDE: client TIDAK dipercaya. Tidak ada bypass
 *    faceVerified=true dari frontend.
 * 6. RESULT CODES TERSTANDAR - tidak ada lagi semua kegagalan dilaporkan
 *    sebagai "belum terdaftar".
 * 7. LOGGING dengan requestId; descriptor biometrik TIDAK PERNAH di-log.
 */

var FaceTemplateService = (function () {

  var SCHEMA = [
    'FACE_TEMPLATE_ID',   // Primary key face (immutable)
    'USER_ID',            // Immutable identity (USERS.id)
    'EMPLOYEE_ID',        // Business identifier (metadata)
    'EMAIL',              // Metadata
    'MODEL',              // e.g. CANVAS_HISTOGRAM
    'MODEL_VERSION',      // e.g. 1.0
    'DESCRIPTOR_VERSION', // e.g. 1
    'DESCRIPTOR_LENGTH',  // Jumlah elemen descriptor
    'DESCRIPTOR',         // JSON array of numbers
    'STATUS',             // ACTIVE | INACTIVE | INVALID | MIGRATED
    'CREATED_AT',
    'UPDATED_AT'
  ];

  var RESULT_CODES = {
    VERIFIED: 'VERIFIED',
    FACE_NOT_REGISTERED: 'FACE_NOT_REGISTERED',
    FACE_NOT_DETECTED: 'FACE_NOT_DETECTED',
    FACE_NOT_MATCHED: 'FACE_NOT_MATCHED',
    INVALID_TEMPLATE: 'INVALID_TEMPLATE',
    INVALID_DESCRIPTOR: 'INVALID_DESCRIPTOR',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
    TEMPLATE_VERSION_MISMATCH: 'TEMPLATE_VERSION_MISMATCH',
    VERIFICATION_ERROR: 'VERIFICATION_ERROR',
    REGISTRATION_FAILED: 'REGISTRATION_FAILED'
  };

  // ============================================================
  //  DESCRIPTOR HELPERS (canonical)
  // ============================================================

  function normalizeDescriptor(value) {
    var d = value;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e) { return null; }
    }
    if (!Array.isArray(d)) return null;
    if (d.length === 0) return null;
    var out = [];
    for (var i = 0; i < d.length; i++) {
      var n = Number(d[i]);
      if (!isFinite(n)) return null; // NaN / Infinity / string aneh
      out.push(n);
    }
    return out;
  }

  function validateDescriptor(value) {
    var arr = normalizeDescriptor(value);
    if (!arr) {
      return { valid: false, error: 'Descriptor kosong, bukan array, atau mengandung nilai non-finite.' };
    }
    return { valid: true, array: arr };
  }

  function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length || a.length === 0) return 0;
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return Math.max(0, Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb))));
  }

  // ============================================================
  //  SHEET ACCESS
  // ============================================================

  function ensureSheet_() {
    var sheet = getSheet(CONFIG.SHEETS.FACE_TEMPLATES);
    var lastCol = sheet.getLastColumn();
    if (lastCol < SCHEMA.length && sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, SCHEMA.length).setValues([SCHEMA]);
      sheet.getRange(1, 1, 1, SCHEMA.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  function readAllTemplates_() {
    var sheet = ensureSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var values = sheet.getRange(2, 1, lastRow - 1, SCHEMA.length).getValues();
    var templates = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (!row[0]) continue;
      templates.push({
        row: i + 2, // 1-indexed sheet row
        FACE_TEMPLATE_ID: String(row[0]),
        USER_ID: String(row[1]),
        EMPLOYEE_ID: String(row[2]),
        EMAIL: String(row[3]),
        MODEL: String(row[4]),
        MODEL_VERSION: String(row[5]),
        DESCRIPTOR_VERSION: Number(row[6]) || 0,
        DESCRIPTOR_LENGTH: Number(row[7]) || 0,
        DESCRIPTOR_RAW: row[8],
        STATUS: String(row[9]).toUpperCase(),
        CREATED_AT: String(row[10]),
        UPDATED_AT: String(row[11])
      });
    }
    return templates;
  }

  function setStatus_(row, status) {
    var sheet = getSheet(CONFIG.SHEETS.FACE_TEMPLATES);
    sheet.getRange(row, SCHEMA.indexOf('STATUS') + 1).setValue(status);
    sheet.getRange(row, SCHEMA.indexOf('UPDATED_AT') + 1).setValue(new Date().toISOString());
  }

  // ============================================================
  //  LOOKUP (single strategy: USER_ID saja - tidak menebak)
  // ============================================================

  /**
   * Ambil ACTIVE template milik user. Jika karena data historis ada lebih
   * dari satu ACTIVE, pakai yang terbaru dan tandai sisanya INACTIVE (heal).
   */
  function getActiveTemplateByUserId(userId) {
    var all = readAllTemplates_();
    var actives = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].USER_ID === String(userId) && all[i].STATUS === 'ACTIVE') {
        actives.push(all[i]);
      }
    }
    if (actives.length === 0) return null;
    if (actives.length > 1) {
      logWarn_('getActiveTemplateByUserId',
        'Duplikat ACTIVE untuk USER_ID=' + userId + ' (' + actives.length +
        '). Menggunakan terbaru, lainnya dinonaktifkan.');
      actives.sort(function (a, b) { return b.row - a.row; }); // terbaru = row paling bawah
      for (var j = 1; j < actives.length; j++) setStatus_(actives[j].row, 'INACTIVE');
    }
    return actives[0];
  }

  function findUserById_(userId) {
    var users = sheetToObjects(CONFIG.SHEETS.USERS);
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].id) === String(userId)) return users[i];
    }
    return null;
  }

  function findEmployeeByUserId_(userId, email) {
    // 1. USERS.employeeId -> EMPLOYEE.id / EMPLOYEE.employeeId
    var user = findUserById_(userId);
    if (user && user.employeeId) {
      var employees = sheetToObjects(CONFIG.SHEETS.EMPLOYEE);
      for (var i = 0; i < employees.length; i++) {
        if (String(employees[i].id) === String(user.employeeId)) return employees[i];
      }
      for (var j = 0; j < employees.length; j++) {
        if (String(employees[j].employeeId) === String(user.employeeId)) return employees[j];
      }
    }
    // 2. Email (fallback metadata)
    if (email) {
      var emps2 = sheetToObjects(CONFIG.SHEETS.EMPLOYEE);
      for (var k = 0; k < emps2.length; k++) {
        if (String(emps2[k].email).toLowerCase() === String(email).toLowerCase()) return emps2[k];
      }
    }
    return null;
  }

  // ============================================================
  //  LOGGING (request-scoped, tanpa data biometrik)
  // ============================================================

  function makeRequestId_(prefix) {
    return prefix + '-' + new Date().getTime() + '-' + Utilities.getUuid().substring(0, 8);
  }

  function logInfo_(action, message) {
    Logger.log('[FACE INFO] ' + action + ': ' + message);
  }

  function logWarn_(action, message) {
    Logger.log('[FACE WARN] ' + action + ': ' + message);
    try {
      appendObject('LOGS', {
        id: 'log-' + Utilities.getUuid().substring(0, 8),
        userId: '', userName: '', action: action, module: 'FaceTemplate',
        details: message, ip: '', createdAt: new Date().toISOString()
      });
    } catch (e) { /* logging tidak boleh mematahkan flow */ }
  }

  // ============================================================
  //  PUBLIC: ENROLL (transaksional + read-back)
  // ============================================================

  function enroll(params, session) {
    var requestId = makeRequestId_('FACEREG');
    logInfo_('enroll', requestId + ' start userId=' + (session ? session.userId : '?'));

    if (!session || !session.userId) {
      return failCoded_('USER_NOT_FOUND', 'Sesi tidak memiliki identitas user.', requestId);
    }

    // 1. Validasi user benar-benar ada di sheet USERS
    var user = findUserById_(session.userId);
    if (!user) {
      return failCoded_('USER_NOT_FOUND', 'User tidak ditemukan di database.', requestId);
    }

    // 2. Validasi descriptor
    var v = validateDescriptor(params.faceDescriptor);
    if (!v.valid) {
      return failCoded_('INVALID_DESCRIPTOR',
        'Data wajah tidak valid. Silakan ambil foto ulang. (' + v.error + ')', requestId);
    }
    var descriptor = v.array;

    // 3. Nonaktifkan semua template ACTIVE lama milik user ini (1 user = 1 active)
    var oldActive = getActiveTemplateByUserId(session.userId);
    if (oldActive) {
      setStatus_(oldActive.row, 'INACTIVE');
      logInfo_('enroll', requestId + ' old template ' + oldActive.FACE_TEMPLATE_ID + ' -> INACTIVE');
    }

    // 4. Generate TEMPLATE_ID & tulis baris baru
    var templateId = 'FT-' + Utilities.getUuid();
    var nowIso = new Date().toISOString();
    var employee = findEmployeeByUserId_(session.userId, session.email);

    var row = {};
    row['FACE_TEMPLATE_ID'] = templateId;
    row['USER_ID'] = session.userId;
    row['EMPLOYEE_ID'] = employee ? String(employee.employeeId || employee.id || '') : '';
    row['EMAIL'] = session.email || '';
    row['MODEL'] = CONFIG.FACE_MODEL;
    row['MODEL_VERSION'] = CONFIG.FACE_MODEL_VERSION;
    row['DESCRIPTOR_VERSION'] = CONFIG.FACE_DESCRIPTOR_VERSION;
    row['DESCRIPTOR_LENGTH'] = descriptor.length;
    row['DESCRIPTOR'] = JSON.stringify(descriptor);
    row['STATUS'] = 'ACTIVE';
    row['CREATED_AT'] = nowIso;
    row['UPDATED_AT'] = nowIso;

    appendObject(CONFIG.SHEETS.FACE_TEMPLATES, row);
    SpreadsheetApp.flush();
    logInfo_('enroll', requestId + ' [FACE ENROLL WRITE] success templateId=' + templateId);

    // 5. READ BACK - wajib berhasil sebelum boleh bilang sukses
    var all = readAllTemplates_();
    var written = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].FACE_TEMPLATE_ID === templateId) { written = all[i]; break; }
    }
    logInfo_('enroll', requestId + ' [FACE ENROLL READBACK] found=' + (written !== null));

    if (!written) {
      return failCoded_('REGISTRATION_FAILED',
        'Registrasi gagal: template tidak ditemukan setelah disimpan. Coba lagi.', requestId);
    }

    var back = validateDescriptor(written.DESCRIPTOR_RAW);
    var readBackOk =
      written.USER_ID === String(session.userId) &&
      written.STATUS === 'ACTIVE' &&
      back.valid &&
      back.array.length === descriptor.length &&
      written.MODEL === String(CONFIG.FACE_MODEL);

    if (!readBackOk) {
      try { setStatus_(written.row, 'INVALID'); } catch (e2) {}
      logWarn_('enroll', requestId + ' READ-BACK FAILED untuk ' + templateId);
      return failCoded_('REGISTRATION_FAILED',
        'Registrasi gagal: data tersimpan tidak dapat dibaca kembali dengan benar. Coba lagi.', requestId);
    }

    logInfo_('enroll', requestId + ' SUCCESS templateId=' + templateId +
      ' length=' + descriptor.length + ' (read-back OK)');

    return {
      success: true,
      code: RESULT_CODES.VERIFIED,
      message: 'Wajah berhasil didaftarkan dan sudah diverifikasi dapat dibaca kembali.',
      userId: session.userId,
      faceTemplateId: templateId,
      descriptorLength: descriptor.length,
      model: CONFIG.FACE_MODEL,
      modelVersion: CONFIG.FACE_MODEL_VERSION,
      descriptorVersion: CONFIG.FACE_DESCRIPTOR_VERSION,
      readBackValidated: true,
      requestId: requestId
    };
  }

  // ============================================================
  //  PUBLIC: STATUS
  // ============================================================

  function getStatus(params, session) {
    var requestId = makeRequestId_('FACESTATUS');
    if (!session || !session.userId) {
      return failCoded_('USER_NOT_FOUND', 'Sesi tidak memiliki identitas user.', requestId);
    }
    var t = getActiveTemplateByUserId(session.userId);
    if (!t) {
      return Object.assign({ success: true, code: RESULT_CODES.TEMPLATE_NOT_FOUND, requestId: requestId },
        { enrolled: false, userId: session.userId });
    }
    var v = validateDescriptor(t.DESCRIPTOR_RAW);
    var versionOk = t.MODEL === CONFIG.FACE_MODEL &&
      Number(t.DESCRIPTOR_VERSION) === CONFIG.FACE_DESCRIPTOR_VERSION;

    return Object.assign({ success: true, code: RESULT_CODES.VERIFIED, requestId: requestId }, {
      enrolled: v.valid && t.STATUS === 'ACTIVE',
      userId: session.userId,
      faceTemplateId: t.FACE_TEMPLATE_ID,
      descriptorLength: t.DESCRIPTOR_LENGTH,
      descriptorValid: v.valid,
      modelCompatible: versionOk,
      model: t.MODEL,
      modelVersion: t.MODEL_VERSION,
      descriptorVersion: t.DESCRIPTOR_VERSION,
      createdAt: t.CREATED_AT
    });
  }

  // ============================================================
  //  PUBLIC: VERIFY LIVE (dipakai UI pre-check & attendance)
  // ============================================================

  /**
   * params.faceDescriptor: array angka hasil ekstraksi kamera.
   * Selalu server-side compare vs ACTIVE template milik session.userId.
   */
  function verifyLive(params, session) {
    var requestId = makeRequestId_('FACEVERIFY');
    logInfo_('verifyLive', requestId + ' start');

    if (!session || !session.userId) {
      return failCoded_('USER_NOT_FOUND', 'Sesi tidak memiliki identitas user.', requestId);
    }

    // 1. Descriptor live valid?
    var live = validateDescriptor(params.faceDescriptor);
    if (!live.valid) {
      return failCoded_('INVALID_DESCRIPTOR',
        'Wajah tidak terdeteksi dengan baik. Ambil foto ulang.', requestId);
    }

    // 2. Template ada? (kondisi 1: belum terdaftar)
    var t = getActiveTemplateByUserId(session.userId);
    if (!t) {
      return failCoded_(RESULT_CODES.FACE_NOT_REGISTERED,
        'Wajah Anda belum terdaftar. Daftarkan lewat menu Face ID terlebih dahulu.', requestId);
    }

    // 3. Template utuh? (kondisi 2: corrupt)
    var stored = validateDescriptor(t.DESCRIPTOR_RAW);
    if (!stored.valid) {
      return failCoded_(RESULT_CODES.INVALID_TEMPLATE,
        'Data wajah terdaftar rusak. Silakan daftarkan ulang wajah Anda di menu Face ID.', requestId);
    }

    // 4. Versi model kompatibel?
    if (t.MODEL !== CONFIG.FACE_MODEL ||
        Number(t.DESCRIPTOR_VERSION) !== CONFIG.FACE_DESCRIPTOR_VERSION ||
        stored.array.length !== live.array.length) {
      return failCoded_(RESULT_CODES.TEMPLATE_VERSION_MISMATCH,
        'Versi model wajah tidak kompatibel. Daftarkan ulang wajah Anda di menu Face ID.', requestId);
    }

    // 5. Compare (kondisi 3 & 4)
    var similarity = cosineSimilarity(live.array, stored.array);
    var threshold = CONFIG.FACE_SIMILARITY_THRESHOLD;

    logInfo_('verifyLive', requestId + ' template=' + t.FACE_TEMPLATE_ID +
      ' similarity=' + similarity.toFixed(4) + ' threshold=' + threshold);

    return {
      success: similarity >= threshold,
      code: similarity >= threshold ? RESULT_CODES.VERIFIED : RESULT_CODES.FACE_NOT_MATCHED,
      message: similarity >= threshold
        ? '✅ Wajah terverifikasi (' + Math.round(similarity * 100) + '%)'
        : '❌ Wajah tidak cocok (' + Math.round(similarity * 100) + '%). Gunakan wajah yang terdaftar.',
      userId: session.userId,
      faceTemplateId: t.FACE_TEMPLATE_ID,
      similarity: similarity,
      similarityPercent: Math.round(similarity * 100),
      threshold: threshold,
      requestId: requestId
    };
  }

  // ============================================================
  //  PUBLIC: DIAGNOSE (test database sebelum test camera)
  // ============================================================

  function diagnose(params, session) {
    var requestId = makeRequestId_('FACEDBG');
    if (!session || !session.userId) {
      return { success: false, code: 'USER_NOT_FOUND', message: 'Tidak ada sesi.', requestId: requestId };
    }
    var checks = {
      userFound: false,
      employeeFound: false,
      templateFound: false,
      templateActive: false,
      descriptorValid: false,
      modelCompatible: false,
      readBackSuccess: false
    };

    checks.userFound = !!findUserById_(session.userId);
    checks.employeeFound = !!findEmployeeByUserId_(session.userId, session.email);

    var all = readAllTemplates_();
    var mine = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].USER_ID === String(session.userId)) mine.push(all[i]);
    }
    checks.templateFound = mine.length > 0;

    var active = getActiveTemplateByUserId(session.userId);
    checks.templateActive = !!active;

    if (active) {
      // read-back: parse ulang langsung dari nilai sheet
      var v = validateDescriptor(active.DESCRIPTOR_RAW);
      checks.descriptorValid = v.valid;
      checks.modelCompatible = active.MODEL === CONFIG.FACE_MODEL &&
        Number(active.DESCRIPTOR_VERSION) === CONFIG.FACE_DESCRIPTOR_VERSION;
      checks.readBackSuccess = v.valid;
    }

    var healthy = checks.userFound && checks.templateFound && checks.templateActive &&
      checks.descriptorValid && checks.modelCompatible && checks.readBackSuccess;

    return Object.assign({ success: true, code: RESULT_CODES.VERIFIED, requestId: requestId }, {
      healthy: healthy,
      summary: healthy ? 'DATABASE LAYER = HEALTHY' : 'DATABASE LAYER = PROBLEM DETECTED',
      checks: checks,
      templateCount: mine.length,
      activeTemplateId: active ? active.FACE_TEMPLATE_ID : '',
      descriptorLength: active ? active.DESCRIPTOR_LENGTH : 0,
      expectedModel: CONFIG.FACE_MODEL,
      expectedModelVersion: CONFIG.FACE_MODEL_VERSION,
      expectedDescriptorVersion: CONFIG.FACE_DESCRIPTOR_VERSION,
      threshold: CONFIG.FACE_SIMILARITY_THRESHOLD
    });
  }

  // ============================================================
  //  PUBLIC: DEACTIVATE (reset wajah)
  // ============================================================

  function deactivate(params, session) {
    var requestId = makeRequestId_('FACEDEACT');
    if (!session || !session.userId) {
      return failCoded_('USER_NOT_FOUND', 'Sesi tidak memiliki identitas user.', requestId);
    }
    var active = getActiveTemplateByUserId(session.userId);
    if (!active) {
      return { success: true, code: RESULT_CODES.VERIFIED, deactivated: false,
        message: 'Tidak ada template aktif.', requestId: requestId };
    }
    setStatus_(active.row, 'INACTIVE');
    logInfo_('deactivate', requestId + ' ' + active.FACE_TEMPLATE_ID + ' -> INACTIVE');
    return { success: true, code: RESULT_CODES.VERIFIED, deactivated: true,
      faceTemplateId: active.FACE_TEMPLATE_ID, requestId: requestId };
  }

  // ============================================================
  //  PUBLIC: MIGRATION dari schema lama (kolom EMPLOYEE)
  // ============================================================

  /**
   * Jalankan SEKALI dari editor GAS atau via API action=migrateFaceTemplates.
   * - Backup seluruh kolom EMPLOYEE ke sheet FACE_MIGRATION_BACKUP
   * - Tiap EMPLOYEE dengan descriptor valid -> buat FACE_TEMPLATES baru
   * - Read-back verify tiap template
   * - Data lama TIDAK dihapus (read-only legacy)
   */
  function migrateFromLegacy() {
    var requestId = makeRequestId_('FACEMIG');
    var ss = getSpreadsheet();
    var empSheet = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEE);
    if (!empSheet) {
      return { success: false, message: 'Sheet EMPLOYEE tidak ditemukan.' };
    }

    ensureSheet_();

    // --- Backup ---
    var lastCol = empSheet.getLastColumn();
    var backupName = 'FACE_MIGRATION_BACKUP';
    var lastRowAll = empSheet.getLastRow();
    if (lastRowAll >= 1) {
      if (ss.getSheetByName(backupName)) ss.deleteSheet(ss.getSheetByName(backupName));
      var backup = ss.insertSheet(backupName);
      var range = empSheet.getRange(1, 1, lastRowAll, lastCol);
      backup.getRange(1, 1, lastRowAll, lastCol).setValues(range.getValues());
    }

    // --- Mapping USERS utk resolve userId immutable ---
    var users = sheetToObjects(CONFIG.SHEETS.USERS);

    // --- Buat template dari descriptor lama yang valid ---
    var employees = sheetToObjects(CONFIG.SHEETS.EMPLOYEE);
    var migrated = 0, skipped = 0, failed = 0;
    var existing = readAllTemplates_();
    var existingKeys = {};
    for (var e = 0; e < existing.length; e++) existingKeys[existing[e].USER_ID] = true;

    for (var i = 0; i < employees.length; i++) {
      var emp = employees[i];
      if (!emp.faceDescriptor) { skipped++; continue; }
      var v = validateDescriptor(emp.faceDescriptor);
      if (!v.valid) { skipped++; continue; }

      // resolve userId untuk employee ini
      var userId = '';
      for (var u = 0; u < users.length; u++) {
        var ue = String(users[u].employeeId || '');
        if ((ue && (ue === String(emp.id) || ue === String(emp.employeeId))) ||
            (String(users[u].email).toLowerCase() === String(emp.email || '').toLowerCase())) {
          userId = String(users[u].id);
          break;
        }
      }
      if (!userId) { skipped++; continue; }       // tidak bisa dipetakan ke user immutable
      if (existingKeys[userId]) { skipped++; continue; } // sudah punya template

      appendObject(CONFIG.SHEETS.FACE_TEMPLATES, {
        FACE_TEMPLATE_ID: 'FT-' + Utilities.getUuid(),
        USER_ID: userId,
        EMPLOYEE_ID: String(emp.employeeId || emp.id || ''),
        EMAIL: String(emp.email || ''),
        MODEL: CONFIG.FACE_MODEL,
        MODEL_VERSION: CONFIG.FACE_MODEL_VERSION,
        DESCRIPTOR_VERSION: CONFIG.FACE_DESCRIPTOR_VERSION,
        DESCRIPTOR_LENGTH: v.array.length,
        DESCRIPTOR: JSON.stringify(v.array),
        STATUS: 'ACTIVE',
        CREATED_AT: new Date().toISOString(),
        UPDATED_AT: new Date().toISOString()
      });
      SpreadsheetApp.flush();

      // read-back verify
      var check = getActiveTemplateByUserId(userId);
      if (check && validateDescriptor(check.DESCRIPTOR_RAW).valid) { migrated++; }
      else { failed++; }
    }

    var msg = 'Migration selesai: migrated=' + migrated + ', skipped=' + skipped +
      ', failed=' + failed + '. Data lama dibackup ke sheet ' + backupName + ' dan tidak dihapus.';
    logWarn_('migrateFromLegacy', requestId + ' ' + msg);
    return { success: true, message: msg, migrated: migrated, skipped: skipped, failed: failed };
  }

  // ============================================================
  //  INTERNAL HELPERS
  // ============================================================

  function failCoded_(code, message, requestId) {
    return { success: false, code: code, message: message, requestId: requestId };
  }

  // Public API
  return {
    enroll: enroll,
    getStatus: getStatus,
    verifyLive: verifyLive,
    diagnose: diagnose,
    deactivate: deactivate,
    migrateFromLegacy: migrateFromLegacy,
    normalizeDescriptor: normalizeDescriptor,
    validateDescriptor: validateDescriptor,
    cosineSimilarity: cosineSimilarity,
    RESULT_CODES: RESULT_CODES
  };
})();