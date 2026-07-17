/**
 * UploadService.gs - File Upload Service
 * Handles uploading files to Google Drive
 */

var UploadService = {
  uploadPhoto: function (base64Data, filename, mimeType) {
    try {
      var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      var blob = Utilities.newBlob(Utilities.base64Decode(base64Data.replace(/^data:[^;]+;base64,/, '')), mimeType, filename);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return ok({
        url: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
        fileId: file.getId()
      });
    } catch (e) {
      return fail('Gagal upload foto: ' + e.message);
    }
  },

  uploadPayslip: function (base64Data, filename, employeeId, period) {
    try {
      var folderId = '1JRQt7gzY5wrIKLPaLZ6Ma3q1qJyjZoYc';
      var folder = DriveApp.getFolderById(folderId);
      
      var yearMonth = period;
      var payrollFolder = folder.createFolder(yearMonth);
      var employeeFolder = payrollFolder.createFolder(employeeId);
      
      var blob = Utilities.newBlob(Utilities.base64Decode(base64Data.replace(/^data:[^;]+;base64,/, '')), 'application/pdf', filename);
      var file = employeeFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return ok({
        url: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
        fileId: file.getId(),
        folderPath: yearMonth + '/' + employeeId + '/' + filename
      });
    } catch (e) {
      return fail('Gagal upload slip gaji: ' + e.message);
    }
  }
};