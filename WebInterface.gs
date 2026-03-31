/**
 * 「帙雲」05 - 繳交紀錄及課業佈置介面（Web App）
 *
 * 功用：建立網頁介面，連結至各文件夾，供老師查閱繳交紀錄及佈置課業。
 * 部署：以 Web App 方式部署（Deploy → New deployment → Web app）。
 *
 * 頁面：
 *   /         → Index.html  控制面板
 *   ?page=record   → record.html 繳交紀錄
 *   ?page=homework → homework.html 佈置課業
 */

// ─── 唯一需要手動設定的值 ────────────────────────────────────────────────────
const ROOT_FOLDER_ID = 'YOUR_ROOT_FOLDER_ID_HERE'; // ← 只需填寫這個
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 從 Script Properties 讀取設定，若尚未設定則自動從根文件夾探索並儲存。
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  let config = props.getProperties();

  if (!config.PENDING_FOLDER_ID || !config.SUBMISSION_SHEET_ID) {
    const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    config.UPLOAD_FOLDER_ID         = getOrCreateFolder(root, '01_學生上傳區').getId();
    config.PENDING_FOLDER_ID        = getOrCreateFolder(root, '02_待批改課業').getId();
    config.TEACHER_RETURN_FOLDER_ID = getOrCreateFolder(root, '03_老師回饋區').getId();
    config.RETURNED_FOLDER_ID       = getOrCreateFolder(root, '04_已發還課業').getId();

    const shareIter = root.getFilesByName('自動共用、收集位址');
    config.SHARE_SHEET_ID = shareIter.hasNext() ? shareIter.next().getId() : '';

    const subIter = root.getFilesByName('繳交紀錄及課業佈置');
    if (subIter.hasNext()) {
      config.SUBMISSION_SHEET_ID = subIter.next().getId();
    } else {
      throw new Error('找不到「繳交紀錄及課業佈置」試算表，請先執行 setup/Setup.gs 中的 setup()。');
    }

    props.setProperties(config);
    Logger.log('✅ 已自動探索並儲存資源 ID。');
  }

  return config;
}

// ─────────────────────────────────────────────────────────────────────────────
// Web App 入口
// ─────────────────────────────────────────────────────────────────────────────

function doGet(e) {
  const page = e.parameter.page;

  if (page === 'record') {
    const template = HtmlService.createTemplateFromFile('record');
    template.classData = getClassData();
    return template.evaluate().setTitle('作業繳交紀錄查閱');
  }

  if (page === 'homework') {
    const template = HtmlService.createTemplateFromFile('homework');
    return template.evaluate().setTitle('布置課業');
  }

  // 預設：控制面板
  const template = HtmlService.createTemplateFromFile('Index');
  template.classData = getClassData();
  template.folderUrls = getFolderUrls();
  return template.evaluate().setTitle('帙雲 - 控制面板');
}

// ─────────────────────────────────────────────────────────────────────────────
// 供 HTML 頁面呼叫的函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 獲取所有文件夾及試算表的 URL，供 Index.html 動態注入連結。
 * @returns {Object}
 */
function getFolderUrls() {
  const config = getConfig();
  return {
    UPLOAD_URL:         'https://drive.google.com/drive/folders/' + config.UPLOAD_FOLDER_ID,
    PENDING_URL:        'https://drive.google.com/drive/folders/' + config.PENDING_FOLDER_ID,
    TEACHER_RETURN_URL: 'https://drive.google.com/drive/folders/' + config.TEACHER_RETURN_FOLDER_ID,
    RETURNED_URL:       'https://drive.google.com/drive/folders/' + config.RETURNED_FOLDER_ID,
    SHARE_SHEET_URL:    config.SHARE_SHEET_ID
      ? 'https://docs.google.com/spreadsheets/d/' + config.SHARE_SHEET_ID
      : '#',
    SUBMISSION_SHEET_URL: 'https://docs.google.com/spreadsheets/d/' + config.SUBMISSION_SHEET_ID
  };
}

/**
 * 獲取試算表資料（用於 homework.html 的班別選單及現有課業列表）。
 * @returns {{classes: string[], homeworks: Object}}
 */
function getSpreadsheetData() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);
  const sheets = spreadsheet.getSheets();

  const data = { classes: [], homeworks: {} };

  sheets.forEach(function(sheet) {
    const className = sheet.getRange('A1').getValue().toString().trim();
    if (!className) return;

    data.classes.push(className);

    const lastColumn = sheet.getLastColumn();
    let homeworkNames = [];
    let deadlines = [];

    if (lastColumn >= 2) {
      const values = sheet.getRange(1, 2, 2, lastColumn - 1).getValues();
      homeworkNames = values[0].filter(String);
      deadlines = values[1].map(function(d) { return d.toString(); });
    }

    data.homeworks[className] = { names: homeworkNames, deadlines: deadlines };
  });

  return data;
}

/**
 * 將新課業寫入試算表（由 homework.html 呼叫）。
 * @param {string} className 班別
 * @param {string} homeworkName 課業名稱（含類別及關鍵詞）
 * @param {string} deadline 截止日期，格式：2025-04-29 23:59
 */
function updateSpreadsheet(className, homeworkName, deadline) {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);
  const sheets = spreadsheet.getSheets();

  const sheet = sheets.find(function(s) {
    return s.getRange('A1').getValue().toString().trim() === className;
  });
  if (!sheet) throw new Error('找不到指定的班別：' + className);

  // 找到下一個可用欄位
  const row1Values = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];
  let nextColumn = 2;
  for (let col = 1; col < row1Values.length; col++) {
    if (!row1Values[col]) {
      nextColumn = col + 1;
      break;
    }
    if (col === row1Values.length - 1) {
      nextColumn = row1Values.length + 1;
    }
  }

  sheet.getRange(1, nextColumn).setValue(homeworkName);
  sheet.getRange(2, nextColumn).setValue(deadline);
}

/**
 * 獲取所有班別的繳交紀錄資料（用於 record.html）。
 * @returns {Array}
 */
function getClassData() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);
  const sheets = spreadsheet.getSheets();
  const classData = [];

  sheets.forEach(function(sheet) {
    const className = sheet.getRange('A1').getValue().toString().trim();
    if (!className) return;

    const lastColumn = sheet.getLastColumn();
    const homeworkNames = lastColumn >= 2
      ? sheet.getRange(1, 2, 1, lastColumn - 1).getValues()[0]
      : [];
    const deadlines = lastColumn >= 2
      ? sheet.getRange(2, 2, 1, lastColumn - 1).getValues()[0].map(function(date) {
          if (date instanceof Date) {
            return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
          }
          return date.toString();
        })
      : [];
    const studentNames = sheet.getRange('A4:A' + sheet.getLastRow()).getValues()
      .flat().filter(String);

    const homeworkData = homeworkNames.map(function(name, index) {
      return {
        name:     name,
        deadline: deadlines[index],
        folderId: sheet.getRange(3, 2 + index).getValue()
      };
    });

    const students = studentNames.map(function(student, rowIndex) {
      const submissions = homeworkData.map(function(hw, colIndex) {
        const cell = sheet.getRange(4 + rowIndex, 2 + colIndex);
        return { homework: hw.name, color: cell.getBackground() };
      });
      return { name: student, submissions: submissions };
    });

    classData.push({
      className: className,
      homework:  homeworkData,
      students:  students
    });
  });

  return classData;
}

// ─────────────────────────────────────────────────────────────────────────────
// 輔助函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 在 parent 文件夾下取得或建立名為 name 的子文件夾（冪等）。
 */
function getOrCreateFolder(parent, name) {
  const iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(name);
}
