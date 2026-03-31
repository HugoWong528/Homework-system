/**
 * 「帙雲」04 - 繳交紀錄及課業佈置
 *
 * 功用：
 *   1. 自動生成「02_待批改課業」及「04_已發還課業」的分層文件夾結構。
 *   2. 實時追蹤學生繳交課業的狀態（已繳交 / 未繳交 / 遲交）。
 *
 * 試算表格式（每個分頁對應一個班別）：
 *   A1    = 班別名稱（如 1C）
 *   A2    = "created"（文件夾建立後自動填入，請勿更改）
 *   B1, C1... = 課業名稱，格式：「寫作（長文）」藏在泥土的【寶物】
 *   B2, C2... = 截止日期，格式：2025-04-29 23:59
 *   B3, C3... = 課業文件夾 ID（自動填入）
 *   A4 以下 = 學生姓名
 *   B4 以下 = 繳交狀態（自動更新：已繳交 / 未繳交 / 遲交）
 *
 * 觸發器：createFoldersAndUpdateSheet，每 5 分鐘觸發一次。
 *         執行 createSubmissionTrigger() 可自動建立觸發器。
 *
 * 注意：ROOT_FOLDER_ID、getConfig() 及 getOrCreateFolder() 定義於 Shared.gs。
 */

// 全局文件夾緩存（減少 API 呼叫次數）。
// 注意：在 Apps Script 中，全局變數的生命週期與單次函數執行相同，
// 每次觸發器執行都會重建此物件，不存在跨執行週期的過時資料問題。
const folderCache = {};

// ─────────────────────────────────────────────────────────────────────────────
// 主函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 主函數：建立分層文件夾（如未建立）並更新繳交狀態。
 * 每 5 分鐘由觸發器自動執行。
 */
function createFoldersAndUpdateSheet() {
  try {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);
  const sheets = spreadsheet.getSheets();

  const pendingFolderId  = config.PENDING_FOLDER_ID;  // 02_待批改課業
  const returnedFolderId = config.RETURNED_FOLDER_ID; // 04_已發還課業

  sheets.forEach(function(sheet) {
    const className = sheet.getRange('A1').getValue().toString().trim();
    if (!className) return; // 跳過沒有班別名稱的分頁

    // 檢查是否已建立文件夾
    const folderCreated = sheet.getRange('A2').getValue();
    if (folderCreated !== 'created') {
      // 取得動態課業類別清單
      const categories = getCategories();

      // 建立「02_待批改課業」的班別及課業文件夾
      const classFolder = createFolderIfNotExists(pendingFolderId, className);
      const categoryFolders = {};
      categories.forEach(function(cat) {
        categoryFolders[cat] = createFolderIfNotExists(classFolder.getId(), cat);
      });

      const lastColumn = sheet.getLastColumn();
      if (lastColumn >= 2) {
        const homeworkValues = sheet.getRange(1, 2, 2, lastColumn - 1).getValues();
        const homeworkNames = homeworkValues[0]; // B1, C1, ...
        homeworkNames.forEach(function(name, index) {
          if (!name) return;
          const categoryMatch = name.match(/「(.*?)」/);
          if (!categoryMatch) return;
          const category = categoryMatch[1];
          const homeworkTitle = name.replace(/「.*?」/, '').trim();
          const categoryFolder = categoryFolders[category];
          if (categoryFolder) {
            const homeworkFolder = createFolderIfNotExists(categoryFolder.getId(), homeworkTitle);
            sheet.getRange(3, 2 + index).setValue(homeworkFolder.getId());
          }
        });
      }

      // 建立「04_已發還課業」的班別→學生→課業類別文件夾
      const returnedClassFolder = createFolderIfNotExists(returnedFolderId, '【' + className + '】');
      const studentNames = sheet.getRange('A4:A' + sheet.getLastRow()).getValues()
        .flat().filter(String);
      studentNames.forEach(function(student) {
        const studentFolder = createFolderIfNotExists(returnedClassFolder.getId(), '【' + student + '】');
        categories.forEach(function(cat) {
          createFolderIfNotExists(studentFolder.getId(), cat);
        });
      });

      // 標記文件夾已建立
      sheet.getRange('A2').setValue('created');
    }

    // 更新繳交狀態
    const lastColumn = sheet.getLastColumn();
    if (lastColumn >= 2) {
      const homeworkValues = sheet.getRange(1, 2, 2, lastColumn - 1).getValues();
      const homeworkNames = homeworkValues[0];
      const deadlines = homeworkValues[1];
      const studentNames = sheet.getRange('A4:A' + sheet.getLastRow()).getValues()
        .flat().filter(String);
      updateSubmissionStatus(sheet, studentNames, homeworkNames, deadlines);
    }
  });
  } catch (e) {
    logError('createFoldersAndUpdateSheet', e.message);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 輔助函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 在 parentId 文件夾下取得或建立名為 folderName 的子文件夾（冪等，含緩存）。
 * @param {string} parentId
 * @param {string} folderName
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function createFolderIfNotExists(parentId, folderName) {
  const key = parentId + '_' + folderName;
  if (folderCache[key]) {
    return DriveApp.getFolderById(folderCache[key]);
  }

  const parentFolder = DriveApp.getFolderById(parentId);
  const iter = parentFolder.getFoldersByName(folderName);
  if (iter.hasNext()) {
    const folder = iter.next();
    folderCache[key] = folder.getId();
    return folder;
  }

  const newFolder = parentFolder.createFolder(folderName);
  folderCache[key] = newFolder.getId();
  return newFolder;
}

/**
 * 批次更新試算表中的繳交狀態。
 * 比對「02_待批改課業」中對應課業文件夾的檔案與學生姓名：
 *   - 已繳交（綠色）：檔案名稱包含學生姓名且在截止日期前
 *   - 遲交（黃色）：  檔案名稱包含學生姓名但在截止日期後
 *   - 未繳交（紅色）：未找到對應檔案
 */
function updateSubmissionStatus(sheet, studentNames, homeworkNames, deadlines) {
  const homeworkFolderIds = sheet.getRange(3, 2, 1, homeworkNames.length).getValues()[0];

  // 一次性搜索所有相關文件並緩存
  const fileMap = {};
  homeworkFolderIds.forEach(function(folderId) {
    if (!folderId) return;
    const files = DriveApp.getFolderById(folderId).getFiles();
    fileMap[folderId] = [];
    while (files.hasNext()) {
      fileMap[folderId].push(files.next());
    }
  });

  const numRows = studentNames.length;
  const numCols = homeworkNames.length;
  const values = [];
  const backgrounds = [];

  studentNames.forEach(function(student) {
    const rowValues = [];
    const rowBackgrounds = [];
    homeworkFolderIds.forEach(function(folderId, colIndex) {
      if (!folderId || !homeworkNames[colIndex]) {
        rowValues.push('');
        rowBackgrounds.push('white');
        return;
      }

      const files = fileMap[folderId] || [];
      let submitted = false;
      let late = false;

      for (let i = 0; i < files.length; i++) {
        if (files[i].getName().includes(student)) {
          submitted = true;
          const uploadTime = files[i].getDateCreated();
          const deadlineRaw = deadlines[colIndex];
          const deadline = (deadlineRaw instanceof Date)
            ? deadlineRaw
            : Utilities.parseDate(deadlineRaw.toString(), TIMEZONE, 'yyyy-MM-dd HH:mm');
          if (uploadTime > deadline) late = true;
          break;
        }
      }

      if (submitted) {
        if (late) {
          rowValues.push('遲交');
          rowBackgrounds.push('yellow');
        } else {
          rowValues.push('已繳交');
          rowBackgrounds.push('green');
        }
      } else {
        rowValues.push('未繳交');
        rowBackgrounds.push('red');
      }
    });
    values.push(rowValues);
    backgrounds.push(rowBackgrounds);
  });

  // 一次性寫入值和背景色
  if (numRows > 0 && numCols > 0) {
    const range = sheet.getRange(4, 2, numRows, numCols);
    range.setValues(values);
    range.setBackgrounds(backgrounds);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 觸發器設置
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 建立每 5 分鐘觸發一次 createFoldersAndUpdateSheet 的時間觸發器。
 */
function createSubmissionTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'createFoldersAndUpdateSheet') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('createFoldersAndUpdateSheet')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('✅ 已建立觸發器：createFoldersAndUpdateSheet，每 5 分鐘觸發一次。');
}
