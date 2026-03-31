/**
 * 「帙雲」一次性設置腳本
 *
 * 使用方法：
 *   1. 在 Google Drive 建立一個根文件夾（例如「帙雲」），複製其 ID。
 *   2. 將 Shared.gs 中的 ROOT_FOLDER_ID 替換為你的根文件夾 ID。
 *   3. 在 Apps Script 編輯器中執行 setup()。
 *   4. 查看執行紀錄（View → Logs），複製所有 ID 以供其他腳本使用。
 *
 * 注意：ROOT_FOLDER_ID、FOLDER_NAMES、SHEET_NAMES、PROP_KEYS 及 getOrCreateFolder()
 *       定義於 Shared.gs，此處直接使用。
 */

// ─────────────────────────────────────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 一次性設置函數。
 * 在根文件夾下建立四個文件夾及三個試算表，並將所有 ID 儲存至 Script Properties。
 */
function setup() {
  if (ROOT_FOLDER_ID === 'YOUR_ROOT_FOLDER_ID_HERE') {
    throw new Error(
      '❌ 請先將 Shared.gs 中的 ROOT_FOLDER_ID 替換為你的 Google Drive 根文件夾 ID，然後再執行 setup()。'
    );
  }

  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  Logger.log('✅ 根文件夾：' + root.getName() + ' (' + ROOT_FOLDER_ID + ')');

  // 建立文件夾
  const uploadFolder        = getOrCreateFolder(root, FOLDER_NAMES.UPLOAD);
  const pendingFolder       = getOrCreateFolder(root, FOLDER_NAMES.PENDING);
  const teacherReturnFolder = getOrCreateFolder(root, FOLDER_NAMES.TEACHER_RETURN);
  const returnedFolder      = getOrCreateFolder(root, FOLDER_NAMES.RETURNED);

  // 建立試算表
  const shareSS      = getOrCreateSpreadsheet(root, SHEET_NAMES.SHARE);
  const submissionSS = getOrCreateSpreadsheet(root, SHEET_NAMES.SUBMISSION);
  const overdueSS    = getOrCreateSpreadsheet(root, SHEET_NAMES.OVERDUE);

  // 初始化試算表標頭
  setupShareSheet(shareSS);
  setupOverdueSheet(overdueSS);

  // 儲存所有 ID 至 Script Properties
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    [PROP_KEYS.ROOT_FOLDER_ID]:           ROOT_FOLDER_ID,
    [PROP_KEYS.UPLOAD_FOLDER_ID]:         uploadFolder.getId(),
    [PROP_KEYS.PENDING_FOLDER_ID]:        pendingFolder.getId(),
    [PROP_KEYS.TEACHER_RETURN_FOLDER_ID]: teacherReturnFolder.getId(),
    [PROP_KEYS.RETURNED_FOLDER_ID]:       returnedFolder.getId(),
    [PROP_KEYS.SHARE_SHEET_ID]:           shareSS.getId(),
    [PROP_KEYS.SUBMISSION_SHEET_ID]:      submissionSS.getId(),
    [PROP_KEYS.OVERDUE_SHEET_ID]:         overdueSS.getId()
  });

  Logger.log('✅ 所有 ID 已儲存至 Script Properties。');
  printSummary();
}

// ─────────────────────────────────────────────────────────────────────────────
// 輔助函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 在 parent 文件夾下取得或建立名為 name 的試算表（冪等）。
 */
function getOrCreateSpreadsheet(parent, name) {
  const iter = parent.getFilesByName(name);
  if (iter.hasNext()) {
    const file = iter.next();
    Logger.log('📊 已存在試算表：' + name + ' (' + file.getId() + ')');
    return SpreadsheetApp.openById(file.getId());
  }
  const ss = SpreadsheetApp.create(name);
  // 將新建的試算表移至根文件夾
  const ssFile = DriveApp.getFileById(ss.getId());
  parent.addFile(ssFile);
  DriveApp.getRootFolder().removeFile(ssFile);
  Logger.log('📊 已建立試算表：' + name + ' (' + ss.getId() + ')');
  return ss;
}

/**
 * 初始化「自動共用、收集位址」試算表的標頭列。
 * A1=學號, B1=姓名, C1=文件夾位址
 */
function setupShareSheet(ss) {
  const sheet = ss.getSheets()[0];
  sheet.setName('Sheet1');
  if (!sheet.getRange('A1').getValue()) {
    sheet.getRange('A1:C1').setValues([['學號', '姓名', '文件夾位址']]);
    sheet.getRange('A1:C1').setFontWeight('bold');
    Logger.log('📝 已設置「自動共用、收集位址」標頭。');
  }
}

/**
 * 初始化「OverdueAssignments」試算表，建立「Overdue Assignments」頁面並設定標頭。
 * 欄位：班別, 學生姓名, 學生電郵, 課業名稱, 截止日期
 */
function setupOverdueSheet(ss) {
  let sheet = ss.getSheetByName('Overdue Assignments');
  if (!sheet) {
    sheet = ss.insertSheet('Overdue Assignments');
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }
  }
  if (!sheet.getRange('A1').getValue()) {
    sheet.getRange('A1:E1').setValues([['班別', '學生姓名', '學生電郵', '課業名稱', '截止日期']]);
    sheet.getRange('A1:E1').setFontWeight('bold');
    Logger.log('📝 已設置「OverdueAssignments」標頭。');
  }
}

/**
 * 印出所有已建立資源的 ID 及 URL。
 */
function printSummary() {
  const props = PropertiesService.getScriptProperties().getProperties();
  Logger.log('\n══════════════════════════════════════════════');
  Logger.log('           「帙雲」設置摘要');
  Logger.log('══════════════════════════════════════════════');
  Logger.log('📌 請將以下 ROOT_FOLDER_ID 複製到各腳本中：');
  Logger.log('   ROOT_FOLDER_ID = ' + ROOT_FOLDER_ID);
  Logger.log('');
  Logger.log('📁 文件夾 ID：');
  Logger.log('   01_學生上傳區    UPLOAD_FOLDER_ID         = ' + props[PROP_KEYS.UPLOAD_FOLDER_ID]);
  Logger.log('   02_待批改課業    PENDING_FOLDER_ID        = ' + props[PROP_KEYS.PENDING_FOLDER_ID]);
  Logger.log('   03_老師回饋區    TEACHER_RETURN_FOLDER_ID = ' + props[PROP_KEYS.TEACHER_RETURN_FOLDER_ID]);
  Logger.log('   04_已發還課業    RETURNED_FOLDER_ID       = ' + props[PROP_KEYS.RETURNED_FOLDER_ID]);
  Logger.log('');
  Logger.log('📊 試算表 ID：');
  Logger.log('   自動共用、收集位址    SHARE_SHEET_ID      = ' + props[PROP_KEYS.SHARE_SHEET_ID]);
  Logger.log('   繳交紀錄及課業佈置    SUBMISSION_SHEET_ID = ' + props[PROP_KEYS.SUBMISSION_SHEET_ID]);
  Logger.log('   OverdueAssignments    OVERDUE_SHEET_ID    = ' + props[PROP_KEYS.OVERDUE_SHEET_ID]);
  Logger.log('');
  Logger.log('🔗 文件夾連結：');
  Logger.log('   學生上傳區：https://drive.google.com/drive/folders/' + props[PROP_KEYS.UPLOAD_FOLDER_ID]);
  Logger.log('   待批改課業：https://drive.google.com/drive/folders/' + props[PROP_KEYS.PENDING_FOLDER_ID]);
  Logger.log('   老師回饋區：https://drive.google.com/drive/folders/' + props[PROP_KEYS.TEACHER_RETURN_FOLDER_ID]);
  Logger.log('   已發還課業：https://drive.google.com/drive/folders/' + props[PROP_KEYS.RETURNED_FOLDER_ID]);
  Logger.log('');
  Logger.log('🔗 試算表連結：');
  Logger.log('   自動共用：https://docs.google.com/spreadsheets/d/' + props[PROP_KEYS.SHARE_SHEET_ID]);
  Logger.log('   繳交紀錄：https://docs.google.com/spreadsheets/d/' + props[PROP_KEYS.SUBMISSION_SHEET_ID]);
  Logger.log('   逾期課業：https://docs.google.com/spreadsheets/d/' + props[PROP_KEYS.OVERDUE_SHEET_ID]);
  Logger.log('══════════════════════════════════════════════');
}
