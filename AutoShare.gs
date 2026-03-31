/**
 * 「帙雲」03 - 自動共用、收集位址
 *
 * 功用：將「04_已發還課業」中每位學生的專屬文件夾共用給學生，
 *       並將文件夾位址記錄至「自動共用、收集位址」試算表的 C 欄，
 *       方便批量分發給學生。
 *
 * 方法：在試算表中手動輸入學號（A 欄）及學生姓名（B 欄），
 *       然後手動執行 shareAllClasses() 或針對特定班別執行 shareFoldersForClass()。
 *
 * 觸發器：不設觸發器，手動執行。
 *
 * 試算表格式（每個分頁對應一個班別）：
 *   A1=學號, B1=姓名, C1=文件夾位址
 *   A2 起：實際學號, B2 起：實際姓名, C2 起（自動填入）：文件夾 URL
 *
 * 注意：ROOT_FOLDER_ID、SCHOOL_EMAIL_DOMAIN、getConfig() 及 getOrCreateFolder()
 *       定義於 Shared.gs，此處直接使用。
 */

// ─────────────────────────────────────────────────────────────────────────────
// 主函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 針對試算表中所有班別，共用學生專屬文件夾並收集位址。
 * 試算表中每個分頁（Sheet）對應一個班別，分頁名稱即班別名稱（如 1C）。
 */
function shareAllClasses() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.SHARE_SHEET_ID);
  const returnedFolder = DriveApp.getFolderById(config.RETURNED_FOLDER_ID);

  // 取得「04_已發還課業」下所有班別文件夾
  const classFolderIter = returnedFolder.getFolders();
  while (classFolderIter.hasNext()) {
    const classFolder = classFolderIter.next();
    const classKey = classFolder.getName().replace(/【|】/g, ''); // 去除【】
    Logger.log('處理班別：' + classKey);
    shareFoldersForClass(classKey, classFolder, spreadsheet);
  }
}

/**
 * 針對特定班別，共用學生專屬文件夾並收集位址。
 *
 * @param {string} className 班別名稱，如 "1C"
 * @param {GoogleAppsScript.Drive.Folder} [classFolderOverride] 可選，直接傳入班別文件夾
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [spreadsheetOverride] 可選，直接傳入試算表
 */
function shareFoldersForClass(className, classFolderOverride, spreadsheetOverride) {
  const config = getConfig();
  const spreadsheet = spreadsheetOverride || SpreadsheetApp.openById(config.SHARE_SHEET_ID);
  const returnedFolder = DriveApp.getFolderById(config.RETURNED_FOLDER_ID);

  // 找到對應的班別文件夾（名稱格式為「【1C】」）
  let classFolder = classFolderOverride;
  if (!classFolder) {
    const iter = returnedFolder.getFoldersByName('【' + className + '】');
    if (!iter.hasNext()) {
      throw new Error('找不到班別文件夾：【' + className + '】');
    }
    classFolder = iter.next();
  }

  // 取得或建立試算表分頁
  let sheet = spreadsheet.getSheetByName(className);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(className);
    sheet.getRange('A1:C1').setValues([['學號', '姓名', '文件夾位址']]);
    sheet.getRange('A1:C1').setFontWeight('bold');
  }

  // 獲取學號及姓名（A2:B 往下）
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('班別 ' + className + ' 的試算表中尚未輸入學生資料，跳過。');
    return;
  }
  const values = sheet.getRange('A2:B' + lastRow).getValues();
  const students = values.filter(function(row) { return row[0] && row[1]; });

  // 建立姓名→文件夾映射
  const folderMap = {};
  const studentFolderIter = classFolder.getFolders();
  while (studentFolderIter.hasNext()) {
    const folder = studentFolderIter.next();
    const match = folder.getName().match(/【(.*?)】/);
    if (match) folderMap[match[1]] = folder;
  }

  // 共用並填入 URL
  students.forEach(function(student, index) {
    const studentId   = student[0];
    const studentName = student[1];
    const email = studentId + '@' + SCHOOL_EMAIL_DOMAIN;
    const folder = folderMap[studentName];

    if (folder) {
      try {
        folder.addEditor(email);
        sheet.getRange(index + 2, 3).setValue(folder.getUrl());
        Logger.log('已共用文件夾給 ' + studentName + ' (' + email + ')');
      } catch (e) {
        Logger.log('共用失敗：' + studentName + ' - ' + e.message);
      }
    } else {
      Logger.log('找不到學生文件夾：' + studentName);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 輔助函數
// ─────────────────────────────────────────────────────────────────────────────

