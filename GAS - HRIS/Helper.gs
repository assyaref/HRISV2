/**
 * Helper.gs - Utility functions for Google Apps Script
 */

/**
 * Read all rows from a sheet as objects
 */
function sheetToObjects(sheetName) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    var empty = true;
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      if (val !== '' && val !== null && val !== undefined) empty = false;
      // Convert date objects
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      // Convert boolean strings
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      obj[headers[j]] = val;
    }
    if (!empty) {
      obj._row = i + 1; // 1-indexed row number
      rows.push(obj);
    }
  }
  return rows;
}

/**
 * Append object as row to sheet
 */
function appendObject(sheetName, obj) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) {
    var val = obj[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return val;
  });
  sheet.appendRow(row);
  return obj;
}

/**
 * Update row by id
 */
function updateObject(sheetName, id, updates) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  if (idCol < 0) return null;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      for (var key in updates) {
        if (!updates.hasOwnProperty(key)) continue;
        var col = headers.indexOf(key);
        if (col >= 0) {
          var val = updates[key];
          if (typeof val === 'boolean') val = val ? 'true' : 'false';
          sheet.getRange(i + 1, col + 1).setValue(val !== undefined && val !== null ? val : '');
        }
      }
      return true;
    }
  }
  return false;
}

/**
 * Delete row by id
 */
function deleteObject(sheetName, id) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  if (idCol < 0) return false;

  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * Find object by field value
 */
function findByField(sheetName, field, value) {
  var rows = sheetToObjects(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][field]).toLowerCase() === String(value).toLowerCase()) {
      return rows[i];
    }
  }
  return null;
}

/**
 * Generate unique ID
 */
function generateId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
}

/**
 * Generate token
 */
function generateToken() {
  return 'tok_' + Utilities.getUuid().replace(/-/g, '') + '_' + Date.now();
}

/**
 * Today's date string YYYY-MM-DD
 */
function todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Current time HH:mm:ss
 */
function nowTime() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');
}

/**
 * Calculate leave days
 */
function calcDays(startDate, endDate) {
  var start = new Date(startDate);
  var end = new Date(endDate);
  var diff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

/**
 * Add activity log
 */
function addLog(userId, userName, action, module, details) {
  appendObject(CONFIG.SHEETS.LOGS, {
    id: generateId('log'),
    userId: userId || '',
    userName: userName || '',
    action: action || '',
    module: module || '',
    details: details || '',
    ip: '',
    createdAt: new Date().toISOString()
  });
}

/**
 * Verify session token
 */
function verifyToken(token) {
  if (!token) return null;
  var sessions = sheetToObjects(CONFIG.SHEETS.SESSIONS);
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].token === token) {
      if (Number(sessions[i].expiresAt) < Date.now()) {
        deleteObject(CONFIG.SHEETS.SESSIONS, sessions[i].token);
        return null;
      }
      return sessions[i];
    }
  }
  return null;
}

/**
 * Cleanup expired sessions from SESSIONS sheet.
 * Runs opportunistically on random requests (1-in-20 chance)
 * to avoid running on every single request.
 */
function cleanupExpiredSessions() {
  if (Math.random() > 0.05) return; // ~5% chance per request

  var sheet = getSheet(CONFIG.SHEETS.SESSIONS);
  if (!sheet || sheet.getLastRow() < 2) return;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var expiresAtCol = headers.indexOf('expiresAt');
  if (expiresAtCol < 0) return;

  var now = Date.now();
  var deleted = 0;
  // Iterate bottom-up so row indices stay valid
  for (var i = data.length - 1; i >= 1; i--) {
    if (Number(data[i][expiresAtCol]) < now) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }
  if (deleted > 0) {
    Logger.log('[Session Cleanup] Removed ' + deleted + ' expired sessions');
  }
}

/**
 * Simple rate limiting via CacheService
 */
function checkRateLimit(clientId) {
  var cache = CacheService.getScriptCache();
  var key = 'rate_' + clientId;
  var count = Number(cache.get(key) || 0);
  if (count >= CONFIG.RATE_LIMIT_PER_MINUTE) return false;
  cache.put(key, String(count + 1), 60);
  return true;
}

/**
 * Success response helper
 */
function ok(data, message) {
  return { success: true, message: message || 'Success', data: data };
}

/**
 * Fail response helper
 */
function fail(message) {
  return { success: false, message: message || 'Error' };
}

/**
 * Check role permission
 */
function requireRole(session, roles) {
  if (!session) return false;
  if (session.role === 'Administrator') return true;
  return roles.indexOf(session.role) >= 0;
}

/**
 * Hash password using SHA-256
 * Used for secure password storage (never store plaintext)
 */
function hashPassword(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest.map(function(b) {
    return ('0' + ((b & 0xFF).toString(16))).slice(-2);
  }).join('');
}
