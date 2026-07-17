/**
 * Router.gs - REST API entry points
 * Handles doGet and doPost from Google Apps Script Web App
 */

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    // CORS headers via JSONP-style or text output
    var params = e.parameter || {};
    var body = {};

    if (e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (err) {
        body = {};
      }
    }

    // Merge body into params
    for (var key in body) {
      if (body.hasOwnProperty(key)) {
        params[key] = body[key];
      }
    }

    var action = params.action || '';
    var token = params.token || params.apiToken || '';

    // Rate limit check
    if (!checkRateLimit(getClientIp(e))) {
      return jsonResponse({ success: false, message: 'Rate limit exceeded. Coba lagi nanti.' });
    }

    // Public actions (no auth required)
    var publicActions = ['login', 'health'];
    var session = null;

    if (publicActions.indexOf(action) === -1) {
      session = verifyToken(token);
      if (!session) {
        return jsonResponse({ success: false, message: 'Sesi tidak valid. Silakan login kembali.' });
      }
    }

    var result;

    switch (action) {
      // Auth
      case 'login':
        result = AuthService.login(params.email, params.password, params.remember);
        break;
      case 'logout':
        result = AuthService.logout(token);
        break;
      case 'verifySession':
        result = AuthService.verifySession(token);
        break;

      // Dashboard
      case 'dashboard':
        result = ReportService.getDashboard();
        break;

      // Employee
      case 'employee':
      case 'getEmployees':
        result = EmployeeService.list(params);
        break;
      case 'saveEmployee':
        result = EmployeeService.save(params, session);
        break;
      case 'updateEmployee':
        result = EmployeeService.update(params, session);
        break;
      case 'deleteEmployee':
        result = EmployeeService.remove(params.id, session);
        break;

      // Attendance
      case 'attendance':
      case 'getAttendances':
        result = AttendanceService.list(params);
        break;
      case 'checkin':
        result = AttendanceService.checkIn(params, session);
        break;
      case 'checkout':
        result = AttendanceService.checkOut(params, session);
        break;

      // Leave
      case 'leave':
      case 'getLeaves':
        result = LeaveService.list(params);
        break;
      case 'saveLeave':
        result = LeaveService.save(params, session);
        break;
      case 'approval':
        result = LeaveService.approve(params, session);
        break;

      // Permission
      case 'permission':
        result = LeaveService.listPermissions(params);
        break;
      case 'savePermission':
        result = LeaveService.savePermission(params, session);
        break;
      case 'approvePermission':
        result = LeaveService.approvePermission(params, session);
        break;

      // Department
      case 'department':
        result = DepartmentService.list();
        break;
      case 'saveDepartment':
        result = DepartmentService.save(params, session);
        break;
      case 'deleteDepartment':
        result = DepartmentService.remove(params.id, session);
        break;

      // Division
      case 'division':
        result = DivisionService.list();
        break;
      case 'saveDivision':
        result = DivisionService.save(params, session);
        break;
      case 'deleteDivision':
        result = DivisionService.remove(params.id, session);
        break;

      // Position
      case 'position':
        result = PositionService.list();
        break;
      case 'savePosition':
        result = PositionService.save(params, session);
        break;
      case 'deletePosition':
        result = PositionService.remove(params.id, session);
        break;

      // Payroll
      case 'payroll':
        result = PayrollService.list(params);
        break;
      case 'generatePayroll':
        result = PayrollService.generate(params.period, session);
        break;

      // Announcement
      case 'announcement':
        result = ReportService.getAnnouncements();
        break;
      case 'saveAnnouncement':
        result = ReportService.saveAnnouncement(params, session);
        break;
      case 'deleteAnnouncement':
        result = ReportService.deleteAnnouncement(params.id, session);
        break;

      // Setting
      case 'setting':
      case 'getSettings':
        result = ReportService.getSettings();
        break;
      case 'saveSetting':
        result = ReportService.saveSettings(params, session);
        break;

      // User Management
      case 'getUsers':
        result = UserService.list(params);
        break;
      case 'saveUser':
        result = UserService.save(params, session);
        break;
      case 'deleteUser':
        result = UserService.delete(params.id, session);
        break;
      case 'resetUserPassword':
        result = UserService.resetPassword(params, session);
        break;

      // Face Recognition
      case 'enrollFace':
        result = UserService.enrollFace(params, session);
        break;
      case 'getFaceEnrollmentStatus':
        result = UserService.getFaceStatus(params, session);
        break;
      case 'verifyAttendanceFace':
        result = UserService.verifyFace(params, session);
        break;

      // Upload
      case 'uploadPhoto':
        result = UploadService.uploadPhoto(params.base64, params.filename, params.mimeType);
        break;

      // Report
      case 'report':
        result = ReportService.generate(params);
        break;

      // Health
      case 'health':
        result = { success: true, message: 'HRIS Lite API is running', version: '1.0.0' };
        break;

      // Init sheets
      case 'initSheets':
        result = initAllSheets();
        break;

      default:
        result = { success: false, message: 'Action tidak dikenali: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    Logger.log('Error: ' + err.message + '\n' + err.stack);
    return jsonResponse({ success: false, message: 'Server error: ' + err.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getClientIp(e) {
  try {
    return e.parameter.ip || 'unknown';
  } catch (err) {
    return 'unknown';
  }
}

/**
 * Initialize all spreadsheet sheets with headers
 */
function initAllSheets() {
  var headers = {
    EMPLOYEE: ['id', 'employeeId', 'nik', 'fullName', 'gender', 'birthDate', 'religion', 'address', 'phone', 'email', 'departmentId', 'divisionId', 'positionId', 'joinDate', 'employmentStatus', 'salary', 'photo', 'managerId', 'faceDescriptor', 'faceRegistered', 'createdAt', 'updatedAt'],
    ATTENDANCE: ['id', 'employeeId', 'date', 'checkIn', 'checkOut', 'checkInLat', 'checkInLng', 'checkOutLat', 'checkOutLng', 'checkInPhoto', 'checkOutPhoto', 'status', 'workHours', 'lateMinutes', 'notes', 'createdAt'],
    LEAVE: ['id', 'employeeId', 'leaveType', 'startDate', 'endDate', 'days', 'reason', 'status', 'managerNote', 'hrNote', 'approvedByManager', 'approvedByHR', 'createdAt', 'updatedAt'],
    PERMISSION: ['id', 'employeeId', 'type', 'date', 'startTime', 'endTime', 'reason', 'status', 'approvedBy', 'note', 'createdAt'],
    PAYROLL: ['id', 'employeeId', 'period', 'basicSalary', 'allowance', 'overtime', 'deduction', 'bpjs', 'pph21', 'netSalary', 'status', 'generatedAt', 'paidAt', 'notes'],
    DEPARTMENT: ['id', 'code', 'name', 'description', 'headId', 'isActive', 'createdAt'],
    DIVISION: ['id', 'code', 'name', 'departmentId', 'description', 'isActive', 'createdAt'],
    POSITION: ['id', 'code', 'name', 'departmentId', 'level', 'description', 'isActive', 'createdAt'],
    USERS: ['id', 'email', 'password', 'role', 'employeeId', 'name', 'avatar', 'isActive', 'createdAt'],
    SETTING: ['key', 'value'],
    ANNOUNCEMENT: ['id', 'title', 'content', 'priority', 'targetRole', 'isActive', 'publishDate', 'expiryDate', 'createdBy', 'createdAt'],
    LOGS: ['id', 'userId', 'userName', 'action', 'module', 'details', 'ip', 'createdAt'],
    SESSIONS: ['token', 'userId', 'email', 'role', 'name', 'employeeId', 'avatar', 'expiresAt']
  };

  var ss = getSpreadsheet();
  var created = [];

  for (var sheetName in headers) {
    if (!headers.hasOwnProperty(sheetName)) continue;
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    // Set headers if empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers[sheetName]);
      sheet.getRange(1, 1, 1, headers[sheetName].length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    created.push(sheetName);
  }

  // Seed default admin
  var usersSheet = getSheet('USERS');
  if (usersSheet.getLastRow() <= 1) {
    usersSheet.appendRow(['usr-1', 'admin@hrislite.com', 'admin123', 'Administrator', '', 'System Admin', '', 'true', new Date().toISOString()]);
    usersSheet.appendRow(['usr-2', 'hr@hrislite.com', 'hr123', 'HR', '', 'HR Manager', '', 'true', new Date().toISOString()]);
    usersSheet.appendRow(['usr-3', 'manager@hrislite.com', 'manager123', 'Manager', '', 'Team Manager', '', 'true', new Date().toISOString()]);
    usersSheet.appendRow(['usr-4', 'employee@hrislite.com', 'employee123', 'Employee', '', 'Staff Employee', '', 'true', new Date().toISOString()]);
  }

  return { success: true, message: 'Sheets initialized', data: created };
}
