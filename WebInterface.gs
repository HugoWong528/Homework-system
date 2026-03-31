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
  const baseUrl = ScriptApp.getService().getUrl();

  if (page === 'record') {
    const template = HtmlService.createTemplateFromFile('record');
    let classData = [];
    let loadError = '';
    try { classData = getClassData(); } catch (err) {
      logError('doGet[record]', err.message);
      loadError = err.message;
    }
    template.classData = classData;
    template.loadError = loadError;
    template.baseUrl = baseUrl;
    return template.evaluate().setTitle('作業繳交紀錄查閱');
  }

  if (page === 'homework') {
    const template = HtmlService.createTemplateFromFile('homework');
    template.baseUrl = baseUrl;
    return template.evaluate().setTitle('布置課業');
  }

  if (page === 'setup') {
    const template = HtmlService.createTemplateFromFile('setup');
    template.baseUrl = baseUrl;
    return template.evaluate().setTitle('班別及學生管理');
  }

  // 預設：控制面板（即使資料載入失敗也要讓頁面渲染，按鈕仍可使用）
  let classData = [];
  let folderUrls = {
    UPLOAD_URL: '#',
    PENDING_URL: '#',
    TEACHER_RETURN_URL: '#',
    RETURNED_URL: '#',
    SHARE_SHEET_URL: '#',
    SUBMISSION_SHEET_URL: '#'
  };
  try { classData = getClassData(); } catch (err) {
    logError('doGet[index]', 'getClassData 失敗：' + err.message);
  }
  try { folderUrls = getFolderUrls(); } catch (err) {
    logError('doGet[index]', 'getFolderUrls 失敗：' + err.message);
  }
  const template = HtmlService.createTemplateFromFile('Index');
  template.classData = classData;
  template.folderUrls = folderUrls;
  template.baseUrl = baseUrl;
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
      // 以索引對齊，避免 filter 後 names/deadlines 錯位
      values[0].forEach(function(name, i) {
        if (name) {
          homeworkNames.push(String(name));
          deadlines.push(values[1][i] ? values[1][i].toString() : '');
        }
      });
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

  // 讀取現有資料，保留已填入的文件夾位址（C 欄）。
  // 鍵使用 id 和 name 的複合 Map，避免分隔符號衝突。
  const existingUrlMap = {};
  const existingLastRow = sheet.getLastRow();
  if (existingLastRow >= 2) {
    sheet.getRange(2, 1, existingLastRow - 1, 3).getValues().forEach(function(row) {
      const id   = row[0].toString();
      const name = row[1].toString();
      const url  = row[2].toString();
      if (url) existingUrlMap[id + '|' + name] = url;
    });
    sheet.getRange(2, 1, existingLastRow - 1, 3).clearContent();
  }

  if (students.length > 0) {
    const rows = students.map(function(s) {
      const key = (s.id || '') + '|' + (s.name || '');
      return [s.id || '', s.name || '', existingUrlMap[key] || ''];
    });
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

// ─────────────────────────────────────────────────────────────────────────────
// 系統設定函數（供 setup.html 的「系統設定」分頁呼叫）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 取得目前系統設定及各資源的存在狀態，供 Web Panel 顯示。
 * @returns {Object}
 */
function getSystemConfig() {
  const props  = PropertiesService.getScriptProperties();
  const config = props.getProperties();
  return {
    rootFolderId:        config.ROOT_FOLDER_ID          || '',
    schoolEmailDomain:   config.SCHOOL_EMAIL_DOMAIN     || SCHOOL_EMAIL_DOMAIN,
    studentEmailDomain:  config.STUDENT_EMAIL_DOMAIN    || '',
    hasUploadFolder:     !!config.UPLOAD_FOLDER_ID,
    hasPendingFolder:    !!config.PENDING_FOLDER_ID,
    hasTeacherFolder:    !!config.TEACHER_RETURN_FOLDER_ID,
    hasReturnedFolder:   !!config.RETURNED_FOLDER_ID,
    hasShareSheet:       !!config.SHARE_SHEET_ID,
    hasSubmissionSheet:  !!config.SUBMISSION_SHEET_ID,
    hasOverdueSheet:     !!config.OVERDUE_SHEET_ID,
    uploadUrl:           config.UPLOAD_FOLDER_ID         ? 'https://drive.google.com/drive/folders/' + config.UPLOAD_FOLDER_ID : '',
    shareSheetUrl:       config.SHARE_SHEET_ID           ? 'https://docs.google.com/spreadsheets/d/' + config.SHARE_SHEET_ID : '',
    submissionSheetUrl:  config.SUBMISSION_SHEET_ID      ? 'https://docs.google.com/spreadsheets/d/' + config.SUBMISSION_SHEET_ID : '',
    overdueSheetUrl:     config.OVERDUE_SHEET_ID         ? 'https://docs.google.com/spreadsheets/d/' + config.OVERDUE_SHEET_ID : ''
  };
}

/**
 * 僅儲存電郵域名設定（不需要重新 setup）。
 * @param {string} schoolEmailDomain  Google Drive 共用域名
 * @param {string} studentEmailDomain Microsoft Teams 通知域名
 */
function saveEmailDomains(schoolEmailDomain, studentEmailDomain) {
  const props = PropertiesService.getScriptProperties();
  if (schoolEmailDomain)  props.setProperty('SCHOOL_EMAIL_DOMAIN',  schoolEmailDomain.trim());
  if (studentEmailDomain) props.setProperty('STUDENT_EMAIL_DOMAIN', studentEmailDomain.trim());
  logInfo('saveEmailDomains', '電郵域名設定已更新。');
}

/**
 * 從 Web Panel 執行初始設置（等同於 Setup.gs 的 setup()，但接受動態 rootFolderId）。
 * 設置完成後所有資源 ID 均儲存至 Script Properties，後續呼叫 getConfig() 即可使用。
 * @param {string} rootFolderId       Google Drive 根文件夾 ID
 * @param {string} schoolEmailDomain  Google Drive 共用域名（可空，沿用現有值）
 * @param {string} studentEmailDomain Microsoft Teams 通知域名（可空，沿用現有值）
 * @returns {string} 完成訊息
 */
function runInitialSetup(rootFolderId, schoolEmailDomain, studentEmailDomain) {
  if (!rootFolderId || !rootFolderId.trim()) {
    throw new Error('請輸入 Google Drive 根文件夾 ID。');
  }
  rootFolderId = rootFolderId.trim();

  try {
    // 1. 驗證根文件夾可存取
    const root = DriveApp.getFolderById(rootFolderId);

    // 2. 儲存設定至 Script Properties
    const props = PropertiesService.getScriptProperties();
    const updates = { ROOT_FOLDER_ID: rootFolderId };
    if (schoolEmailDomain)  updates.SCHOOL_EMAIL_DOMAIN  = schoolEmailDomain.trim();
    if (studentEmailDomain) updates.STUDENT_EMAIL_DOMAIN = studentEmailDomain.trim();
    props.setProperties(updates);

    // 3. 清除舊的資源 ID，強制重新探索
    ['UPLOAD_FOLDER_ID', 'PENDING_FOLDER_ID', 'TEACHER_RETURN_FOLDER_ID',
     'RETURNED_FOLDER_ID', 'SHARE_SHEET_ID', 'SUBMISSION_SHEET_ID', 'OVERDUE_SHEET_ID'
    ].forEach(function(k) { props.deleteProperty(k); });

    // 4. 建立四個文件夾（冪等）
    getOrCreateFolder(root, FOLDER_NAMES.UPLOAD);
    getOrCreateFolder(root, FOLDER_NAMES.PENDING);
    getOrCreateFolder(root, FOLDER_NAMES.TEACHER_RETURN);
    getOrCreateFolder(root, FOLDER_NAMES.RETURNED);

    // 5. 建立三個試算表（冪等）
    var shareSS      = getOrCreateSpreadsheetInFolder(root, SHEET_NAMES.SHARE);
    var submissionSS = getOrCreateSpreadsheetInFolder(root, SHEET_NAMES.SUBMISSION);
    var overdueSS    = getOrCreateSpreadsheetInFolder(root, SHEET_NAMES.OVERDUE);

    // 初始化試算表標頭
    initShareSheet_(shareSS);
    initOverdueSheet_(overdueSS);

    // 6. 觸發 getConfig() 進行完整探索並儲存所有 ID
    getConfig();

    logInfo('runInitialSetup', '初始設置完成，根文件夾：' + root.getName());
    return '✅ 設置完成！已在「' + root.getName() + '」內建立所有文件夾及試算表。';
  } catch (e) {
    logError('runInitialSetup', e.message);
    throw e;
  }
}

/**
 * 在指定文件夾下取得或建立試算表（冪等），並移至該文件夾。
 * @param {GoogleAppsScript.Drive.Folder} parent
 * @param {string} name
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getOrCreateSpreadsheetInFolder(parent, name) {
  const iter = parent.getFilesByName(name);
  if (iter.hasNext()) {
    return SpreadsheetApp.openById(iter.next().getId());
  }
  const ss     = SpreadsheetApp.create(name);
  const ssFile = DriveApp.getFileById(ss.getId());
  parent.addFile(ssFile);
  DriveApp.getRootFolder().removeFile(ssFile);
  return ss;
}

/** 初始化「自動共用、收集位址」試算表標頭（冪等）。 */
function initShareSheet_(ss) {
  const sheet = ss.getSheets()[0];
  if (!sheet.getRange('A1').getValue()) {
    sheet.getRange('A1:C1').setValues([['學號', '姓名', '文件夾位址']]);
    sheet.getRange('A1:C1').setFontWeight('bold');
  }
}

/** 初始化「OverdueAssignments」試算表（冪等）。 */
function initOverdueSheet_(ss) {
  let sheet = ss.getSheetByName('Overdue Assignments');
  if (!sheet) {
    sheet = ss.insertSheet('Overdue Assignments');
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
  }
  if (!sheet.getRange('A1').getValue()) {
    sheet.getRange('A1:E1').setValues([['班別', '學生姓名', '學生電郵', '課業名稱', '截止日期']]);
    sheet.getRange('A1:E1').setFontWeight('bold');
  }
}

/**
 * 建立所有觸發器（從 Web Panel 呼叫）。
 * @returns {string[]} 已建立的觸發器清單
 */
function createAllTriggersFromPanel() {
  try {
    createCollectTrigger();    // 收集功課（每 1 分鐘）
    createSubmissionTrigger(); // 繳交狀態更新（每 5 分鐘）
    createReturnTrigger();     // 自動發還（每 15 分鐘）
    logInfo('createAllTriggersFromPanel', '已建立所有觸發器。');
    return getTriggerStatus();
  } catch (e) {
    logError('createAllTriggersFromPanel', e.message);
    throw e;
  }
}

/**
 * 取得目前所有觸發器的狀態。
 * @returns {Array<{handler:string, intervalMinutes:string}>}
 */
function getTriggerStatus() {
  return ScriptApp.getProjectTriggers().map(function(t) {
    return {
      handler: t.getHandlerFunction(),
      type:    t.getEventType().toString(),
      source:  t.getTriggerSource().toString()
    };
  });
}
