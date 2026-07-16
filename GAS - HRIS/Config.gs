/**
 * HRIS Lite Enterprise - Google Apps Script Backend
 * Config.gs - Configuration & Spreadsheet IDs
 *
 * SETUP:
 * 1. Buat Google Spreadsheet baru
 * 2. Salin Spreadsheet ID ke SPREADSHEET_ID di bawah
 * 3. Buat folder Google Drive untuk foto, salin Folder ID
 * 4. Deploy as Web App (Execute as: Me, Who has access: Anyone)
 * 5. Salin Web App URL ke frontend config
 */

var CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  DRIVE_FOLDER_ID: 'YOUR_DRIVE_FOLDER_ID_HERE',
  API_TOKEN: 'hris-lite-secret-token-2026',
  SESSION_HOURS: 24,
  RATE_LIMIT_PER_MINUTE: 60,
  COMPANY_NAME: 'HRIS Lite Enterprise',
  WORK_START: '08:00',
  WORK_END: '17:00',
  LATE_TOLERANCE: 15,
  ANNUAL_LEAVE_QUOTA: 12,
  OFFICE_LAT: -6.2088,
  OFFICE_LNG: 106.8456,
  OFFICE_RADIUS: 200,

  SHEETS: {
    EMPLOYEE: 'EMPLOYEE',
    ATTENDANCE: 'ATTENDANCE',
    LEAVE: 'LEAVE',
    PERMISSION: 'PERMISSION',
    PAYROLL: 'PAYROLL',
    DEPARTMENT: 'DEPARTMENT',
    DIVISION: 'DIVISION',
    POSITION: 'POSITION',
    USERS: 'USERS',
    SETTING: 'SETTING',
    ANNOUNCEMENT: 'ANNOUNCEMENT',
    LOGS: 'LOGS',
    SESSIONS: 'SESSIONS'
  }
};

/**
 * Get Spreadsheet instance
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Get sheet by name, create if not exists
 */
function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}
