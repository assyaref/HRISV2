/**
 * Migration.gs - Script untuk menambahkan kolom face recognition ke spreadsheet yang sudah ada
 * 
 * Cara menjalankan:
 * 1. Buka https://script.google.com
 * 2. Buka project HRIS Anda
 * 3. Jalankan fungsi addFaceColumnsToExistingSheets()
 * 4. Atau panggil via API: ?action=migrateFaceColumns
 */

/**
 * Menambahkan kolom faceDescriptor dan faceRegistered ke EMPLOYEE sheet yang sudah ada
 */
function addFaceColumnsToExistingSheets() {
  var ss = getSpreadsheet();
  var results = [];
  
  // 1. EMPLOYEE sheet - tambah kolom face
  var empSheet = ss.getSheetByName('EMPLOYEE');
  if (empSheet) {
    var empHeaders = empSheet.getRange(1, 1, 1, empSheet.getLastColumn()).getValues()[0];
    var added = [];
    
    if (empHeaders.indexOf('faceDescriptor') < 0) {
      var lastCol = empSheet.getLastColumn() + 1;
      empSheet.getRange(1, lastCol).setValue('faceDescriptor');
      empSheet.getRange(1, lastCol).setFontWeight('bold');
      added.push('faceDescriptor');
    }
    
    if (empHeaders.indexOf('faceRegistered') < 0) {
      var lastCol2 = empSheet.getLastColumn() + 1;
      empSheet.getRange(1, lastCol2).setValue('faceRegistered');
      empSheet.getRange(1, lastCol2).setFontWeight('bold');
      added.push('faceRegistered');
    }
    
    if (added.length > 0) {
      results.push('EMPLOYEE: added ' + added.join(', '));
    } else {
      results.push('EMPLOYEE: columns already exist');
    }
  }
  
  // 2. SETTING sheet - tambah default face threshold jika belum ada
  var settingSheet = ss.getSheetByName('SETTING');
  if (settingSheet) {
    var settingData = settingSheet.getDataRange().getValues();
    var hasThreshold = false;
    for (var i = 1; i < settingData.length; i++) {
      if (settingData[i][0] === 'faceSimilarityThreshold') {
        hasThreshold = true;
        break;
      }
    }
    if (!hasThreshold) {
      settingSheet.appendRow(['faceSimilarityThreshold', '0.65']);
      results.push('SETTING: added faceSimilarityThreshold=0.65');
    }
  }
  
  // Log hasil
  Logger.log('Migration results: ' + JSON.stringify(results));
  
  return {
    success: true,
    message: 'Migration completed',
    data: results
  };
}

/**
 * Cek status kolom face recognition di EMPLOYEE sheet
 */
function checkFaceColumns() {
  var ss = getSpreadsheet();
  var empSheet = ss.getSheetByName('EMPLOYEE');
  if (!empSheet) return { success: false, message: 'EMPLOYEE sheet not found' };
  
  var headers = empSheet.getRange(1, 1, 1, empSheet.getLastColumn()).getValues()[0];
  var hasFaceDesc = headers.indexOf('faceDescriptor') >= 0;
  var hasFaceReg = headers.indexOf('faceRegistered') >= 0;
  
  var data = empSheet.getDataRange().getValues();
  var registeredCount = 0;
  var faceDescCol = headers.indexOf('faceDescriptor');
  var faceRegCol = headers.indexOf('faceRegistered');
  
  for (var i = 1; i < data.length; i++) {
    if (faceRegCol >= 0 && String(data[i][faceRegCol]).toLowerCase() === 'true') {
      registeredCount++;
    }
  }
  
  return {
    success: true,
    data: {
      hasFaceDescriptorColumn: hasFaceDesc,
      hasFaceRegisteredColumn: hasFaceReg,
      totalEmployees: data.length - 1,
      faceRegistered: registeredCount,
      columns: headers
    }
  };
}
