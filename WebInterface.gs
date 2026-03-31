/**
 * 「帙雲」05 - 繳交紀錄及課業佈置介面（Web App）
 *
 * 功用：建立網頁介面，連結至各文件夾，供老師查閱繳交紀錄及佈置課業。
 * 部署：以 Web App 方式部署（Deploy → New deployment → Web app）。
 *
 * 頁面：
 *   /              → Index.html    控制面板
 *   ?page=record   → record.html   繳交紀錄
 *   ?page=homework → homework.html 佈置課業
 *   ?page=setup    → setup.html    班別及學生管理
 *
 * 注意：ROOT_FOLDER_ID、getConfig() 及 getOrCreateFolder() 定義於 Shared.gs。
 */

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

  if (page === 'setup') {
    const template = HtmlService.createTemplateFromFile('setup');
    return template.evaluate().setTitle('班別及學生管理');
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

  const sheet = spreadsheet.getSheets().find(function(s) {
    return s.getRange('A1').getValue().toString().trim() === className;
  });
  if (!sheet) throw new Error('找不到指定的班別：' + className);

  // 找到下一個可用欄位（欄 A 為班別名稱，課業從欄 B 起）
  const nextColumn = Math.max(2, sheet.getLastColumn() + 1);
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
            return Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd HH:mm');
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
// 設置面板後端函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 獲取設置面板所需的所有資料。
 * @returns {{ submissionClasses: Array, shareClasses: Array }}
 */
function getSetupData() {
  const config = getConfig();
  const submissionSS = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);

  const submissionClasses = submissionSS.getSheets().map(function(sheet) {
    const className = sheet.getRange('A1').getValue().toString().trim();
    if (!className) return null;
    const lastRow = sheet.getLastRow();
    const students = lastRow >= 4
      ? sheet.getRange('A4:A' + lastRow).getValues().flat().filter(String)
      : [];
    return { name: className, students: students };
  }).filter(Boolean);

  const shareClasses = [];
  if (config.SHARE_SHEET_ID) {
    const shareSS = SpreadsheetApp.openById(config.SHARE_SHEET_ID);
    shareSS.getSheets().forEach(function(sheet) {
      const sheetName = sheet.getName();
      const lastRow = sheet.getLastRow();
      const students = [];
      if (lastRow >= 2) {
        sheet.getRange('A2:C' + lastRow).getValues().forEach(function(row) {
          if (row[0] || row[1]) {
            students.push({ id: row[0].toString(), name: row[1].toString(), url: row[2].toString() });
          }
        });
      }
      shareClasses.push({ name: sheetName, students: students });
    });
  }

  return { submissionClasses: submissionClasses, shareClasses: shareClasses };
}

/**
 * 新增班別至繳交紀錄試算表。
 * @param {string} className 班別名稱（如 1C）
 */
function addClass(className) {
  className = className.toString().trim();
  if (!className) throw new Error('班別名稱不可為空');

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);

  const existing = ss.getSheets().some(function(s) {
    return s.getRange('A1').getValue().toString().trim() === className;
  });
  if (existing) throw new Error('班別「' + className + '」已存在');

  const sheet = ss.insertSheet(className);
  sheet.getRange('A1').setValue(className);
}

/**
 * 設定某班別的學生名單（覆蓋 A4 以下的現有名單）。
 * @param {string} className 班別名稱
 * @param {string} studentsText 學生姓名（每行一個）
 */
function setClassStudents(className, studentsText) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);

  const sheet = ss.getSheets().find(function(s) {
    return s.getRange('A1').getValue().toString().trim() === className;
  });
  if (!sheet) throw new Error('找不到班別：' + className);

  const names = studentsText.toString().split('\n')
    .map(function(n) { return n.trim(); })
    .filter(Boolean);

  // 清除現有學生名單（A4 以下）
  const lastRow = sheet.getLastRow();
  if (lastRow >= 4) {
    sheet.getRange('A4:A' + lastRow).clearContent();
  }

  if (names.length > 0) {
    sheet.getRange(4, 1, names.length, 1).setValues(names.map(function(n) { return [n]; }));
  }
}

/**
 * 設定共用試算表中某班別的學生帳號資料（覆蓋現有資料）。
 * @param {string} className 班別名稱
 * @param {string} studentsJson JSON 字串，格式：[{id, name}, ...]
 */
function setShareStudents(className, studentsJson) {
  const config = getConfig();
  if (!config.SHARE_SHEET_ID) throw new Error('找不到「自動共用、收集位址」試算表，請先執行 setup()。');

  const ss = SpreadsheetApp.openById(config.SHARE_SHEET_ID);
  let sheet = ss.getSheetByName(className);
  if (!sheet) {
    sheet = ss.insertSheet(className);
    sheet.getRange('A1:C1').setValues([['學號', '姓名', '文件夾位址']]);
    sheet.getRange('A1:C1').setFontWeight('bold');
  }

  const students = JSON.parse(studentsJson);

  // 清除現有資料（第 2 行以下）
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
  }

  if (students.length > 0) {
    const rows = students.map(function(s) { return [s.id || '', s.name || '', '']; });
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 面板操作觸發函數（供 HTML 頁面透過 google.script.run 呼叫）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 手動觸發文件夾建立及繳交狀態更新（由 Index.html 呼叫）。
 * 實際邏輯定義於 SubmissionRecord.gs 的 createFoldersAndUpdateSheet()。
 */
function triggerFolderCreation() {
  createFoldersAndUpdateSheet();
}

/**
 * 手動觸發自動共用專屬文件夾（由 Index.html 呼叫）。
 * 實際邏輯定義於 AutoShare.gs 的 shareAllClasses()。
 */
function triggerShareAll() {
  shareAllClasses();
}
