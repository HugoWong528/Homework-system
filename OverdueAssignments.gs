/**
 * 「帙雲」06 - OverdueAssignments
 *
 * 功用：整理逾期未交課業名單，供 Microsoft Power Automate 自動追收功課使用。
 * 方法：在「繳交紀錄及課業佈置」找出逾期未交的學生，
 *       對照「自動共用、收集位址」試算表取得學生的 Teams 電郵，
 *       將結果寫入「OverdueAssignments」試算表的「Overdue Assignments」分頁。
 *
 * 觸發器：generateOverdueAssignments，每 1 分鐘觸發一次。
 *         執行 createTrigger() 可自動建立觸發器。
 *
 * ⚠️ 此腳本應綁定至「OverdueAssignments」試算表（Container-bound），
 *    或以獨立腳本（Standalone）方式運行（已支援兩種方式）。
 */

// ─── 唯一需要手動設定的值 ────────────────────────────────────────────────────
const OVERDUE_ROOT_FOLDER_ID = 'YOUR_ROOT_FOLDER_ID_HERE'; // ← 只需填寫這個
// 學生 Microsoft Teams 電郵域名（格式：學號@域名）
const STUDENT_EMAIL_DOMAIN = 'ms.ccckyc.edu.hk'; // ← 按學校實際域名修改
/** 平台時區（香港時間）。
 * 注意：此腳本部署於獨立的 Apps Script 專案，無法存取主專案的 Shared.gs，
 * 因此在此重複宣告（與 Shared.gs 中的 TIMEZONE 常數相同）。
 */
const OVERDUE_TIMEZONE = 'Asia/Hong_Kong';
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 從 Script Properties 讀取設定，若尚未設定則自動從根文件夾探索並儲存。
 */
function getOverdueConfig() {
  const props = PropertiesService.getScriptProperties();
  let config = props.getProperties();

  if (!config.SUBMISSION_SHEET_ID || !config.SHARE_SHEET_ID || !config.OVERDUE_SHEET_ID) {
    const root = DriveApp.getFolderById(OVERDUE_ROOT_FOLDER_ID);

    const subIter = root.getFilesByName('繳交紀錄及課業佈置');
    if (!subIter.hasNext()) {
      throw new Error('找不到「繳交紀錄及課業佈置」試算表，請先執行 setup/Setup.gs 中的 setup()。');
    }
    config.SUBMISSION_SHEET_ID = subIter.next().getId();

    const shareIter = root.getFilesByName('自動共用、收集位址');
    if (!shareIter.hasNext()) {
      throw new Error('找不到「自動共用、收集位址」試算表，請先執行 setup/Setup.gs 中的 setup()。');
    }
    config.SHARE_SHEET_ID = shareIter.next().getId();

    const overdueIter = root.getFilesByName('OverdueAssignments');
    if (!overdueIter.hasNext()) {
      throw new Error('找不到「OverdueAssignments」試算表，請先執行 setup/Setup.gs 中的 setup()。');
    }
    config.OVERDUE_SHEET_ID = overdueIter.next().getId();

    props.setProperties({
      SUBMISSION_SHEET_ID: config.SUBMISSION_SHEET_ID,
      SHARE_SHEET_ID:      config.SHARE_SHEET_ID,
      OVERDUE_SHEET_ID:    config.OVERDUE_SHEET_ID
    });
    Logger.log('✅ 已自動探索並儲存資源 ID。');
  }

  return config;
}

// ─────────────────────────────────────────────────────────────────────────────
// 主函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 生成逾期未交課業名單並寫入「OverdueAssignments」試算表。
 * 條件：狀態為「未繳交」且已超過截止日期。
 */
function generateOverdueAssignments() {
  const config = getOverdueConfig();

  // 從「自動共用、收集位址」取得學號→電郵映射（讀取所有班別分頁）
  const studentSpreadsheet = SpreadsheetApp.openById(config.SHARE_SHEET_ID);
  const studentSheets = studentSpreadsheet.getSheets();

  const studentMap = {};
  studentSheets.forEach(function(sSheet) {
    const lastRow = sSheet.getLastRow();
    if (lastRow < 2) return;
    const studentData = sSheet.getRange('A2:B' + lastRow).getValues();
    studentData.forEach(function(row) {
      const studentNumber = row[0];
      const studentName   = row[1];
      if (studentNumber && studentName) {
        studentMap[studentName] = studentNumber + '@' + STUDENT_EMAIL_DOMAIN;
      }
    });
  });

  // 開啟「OverdueAssignments」試算表，清空並重寫
  const overdueSpreadsheet = SpreadsheetApp.openById(config.OVERDUE_SHEET_ID);
  let overdueSheet = overdueSpreadsheet.getSheetByName('Overdue Assignments');
  if (!overdueSheet) {
    overdueSheet = overdueSpreadsheet.insertSheet('Overdue Assignments');
  }
  overdueSheet.clear();
  overdueSheet.appendRow(['班別', '學生姓名', '學生電郵', '課業名稱', '截止日期']);

  const currentDate = new Date();

  // 讀取「繳交紀錄及課業佈置」各班別的繳交狀態
  const submissionSpreadsheet = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);
  const sheets = submissionSpreadsheet.getSheets();

  sheets.forEach(function(sheet) {
    const className = sheet.getRange('A1').getValue().toString().trim();
    if (!className) return;

    const lastColumn = sheet.getLastColumn();
    if (lastColumn < 2) return;

    const assignmentNames = sheet.getRange(1, 2, 1, lastColumn - 1).getValues()[0];
    const deadlines       = sheet.getRange(2, 2, 1, lastColumn - 1).getValues()[0];
    const studentNames    = sheet.getRange('A4:A' + sheet.getLastRow()).getValues()
      .flat().filter(String);

    if (studentNames.length === 0) return;

    const statuses = sheet.getRange(4, 2, studentNames.length, lastColumn - 1).getValues();

    studentNames.forEach(function(student, rowIndex) {
      assignmentNames.forEach(function(assignment, colIndex) {
        if (!assignment) return;
        const status      = statuses[rowIndex][colIndex];
        const deadlineRaw = deadlines[colIndex];
        const deadline = (deadlineRaw instanceof Date)
          ? deadlineRaw
          : Utilities.parseDate(deadlineRaw.toString(), OVERDUE_TIMEZONE, 'yyyy-MM-dd HH:mm');

        if (status === '未繳交' && currentDate > deadline) {
          const studentEmail = studentMap[student];
          const deadlineFormatted = Utilities.formatDate(deadline, OVERDUE_TIMEZONE, 'yyyy-MM-dd HH:mm');
          if (studentEmail) {
            overdueSheet.appendRow([className, student, studentEmail, assignment, deadlineFormatted]);
          }
        }
      });
    });
  });

  Logger.log('✅ 已更新逾期課業名單。');
}

// ─────────────────────────────────────────────────────────────────────────────
// 觸發器設置
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 建立每 1 分鐘觸發一次 generateOverdueAssignments 的時間觸發器。
 */
function createTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'generateOverdueAssignments') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('generateOverdueAssignments')
    .timeBased()
    .everyMinutes(1)
    .create();
  Logger.log('✅ 已建立觸發器：generateOverdueAssignments，每 1 分鐘觸發一次。');
}
