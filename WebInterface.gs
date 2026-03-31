/**
 * 「帙雲」05 - 繳交紀錄及課業佈置介面（Web App）
 *
 * 功用：建立網頁介面，連結至各文件夾，供老師查閱繳交紀錄及佈置課業。
 * 部署：以 Web App 方式部署（Deploy → New deployment → Web app）。
 *   - Execute as: Me（以你的帳號執行）
 *   - Who has access: Anyone with a Google Account（需登入）
 *
 * 頁面：
 *   /              → Index.html    控制面板（須在教師白名單）
 *   ?page=record   → record.html   繳交紀錄（須在教師白名單）
 *   ?page=homework → homework.html 佈置課業（須在教師白名單）
 *   ?page=setup    → setup.html    班別及學生管理（須在教師白名單）
 *   ?page=student  → student.html  學生課業入口（須通過學生驗證）
 *
 * 注意：ROOT_FOLDER_ID、getConfig() 及 getOrCreateFolder() 定義於 Shared.gs。
 */

// ─────────────────────────────────────────────────────────────────────────────
// 存取控制輔助函數（私用）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 從 Script Properties 取得教師白名單（電郵陣列）。
 * @returns {string[]}
 */
function getTeacherWhitelist_() {
  const json = PropertiesService.getScriptProperties().getProperty('TEACHER_WHITELIST');
  if (json) { try { return JSON.parse(json); } catch (e) {} }
  return [];
}

/**
 * 判斷指定電郵是否在教師白名單中。
 * @param {string} email
 * @returns {boolean}
 */
function isTeacherAuthorized_(email) {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  return getTeacherWhitelist_().some(function(e) {
    return e.toLowerCase() === emailLower;
  });
}

/**
 * 從 Script Properties 取得允許的學生電郵域名清單。
 * 若未設定，回退至 SCHOOL_EMAIL_DOMAIN。
 * @returns {string[]}
 */
function getAllowedStudentDomains_() {
  const json = PropertiesService.getScriptProperties().getProperty('ALLOWED_STUDENT_DOMAINS');
  if (json) { try { return JSON.parse(json); } catch (e) {} }
  const domain = PropertiesService.getScriptProperties()
    .getProperty('SCHOOL_EMAIL_DOMAIN') || SCHOOL_EMAIL_DOMAIN;
  return [domain];
}

/**
 * 從 Script Properties 取得允許的學生特殊電郵清單。
 * @returns {string[]}
 */
function getAllowedStudentEmails_() {
  const json = PropertiesService.getScriptProperties().getProperty('ALLOWED_STUDENT_EMAILS');
  if (json) { try { return JSON.parse(json); } catch (e) {} }
  return [];
}

/**
 * 判斷指定電郵是否有權使用學生入口。
 * 通過條件：(1) 在特殊電郵清單中，或 (2) 域名符合允許的學生域名。
 * @param {string} email
 * @returns {boolean}
 */
function isStudentAuthorized_(email) {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  if (getAllowedStudentEmails_().some(function(e) {
    return e.toLowerCase() === emailLower;
  })) return true;
  return getAllowedStudentDomains_().some(function(d) {
    return emailLower.endsWith('@' + d.toLowerCase());
  });
}

/**
 * 建立「存取被拒絕」HTML 頁面。
 * @param {string} userEmail  目前登入的電郵（可能為空）
 * @param {string} roleLabel  所需角色說明文字
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function makeAccessDeniedPage_(userEmail, roleLabel) {
  const emailDisplay = userEmail
    ? '<b>' + userEmail + '</b>'
    : '（未登入或無法取得電郵）';
  const html =
    '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>存取被拒絕</title>' +
    '<style>body{font-family:sans-serif;background:#1a1a2e;color:#f0f0f0;' +
    'display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}' +
    '.box{background:rgba(51,51,51,0.9);border-radius:16px;padding:40px;max-width:480px;' +
    'text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.4);}' +
    'h1{color:#e05252;font-size:28px;margin:0 0 16px;}' +
    'p{color:#ccc;font-size:15px;line-height:1.6;}</style></head><body>' +
    '<div class="box"><h1>⛔ 存取被拒絕</h1>' +
    '<p>您目前登入的帳號 ' + emailDisplay + ' 沒有存取此頁面的權限。</p>' +
    '<p>需要「' + roleLabel + '」存取權限。</p>' +
    '<p style="font-size:13px;color:#888;">如需協助，請聯絡系統管理員。</p>' +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('存取被拒絕');
}

// ─────────────────────────────────────────────────────────────────────────────
// Web App 入口
// ─────────────────────────────────────────────────────────────────────────────

function doGet(e) {
  const page = e.parameter.page;
  const baseUrl = ScriptApp.getService().getUrl();

  // 取得目前登入使用者的電郵
  // 需要 Web App 部署設定：「Anyone with a Google Account」（需登入）
  const userEmail = Session.getActiveUser().getEmail();

  if (page === 'student') {
    // 學生入口：須通過學生驗證（電郵域名或特殊電郵）
    if (!isStudentAuthorized_(userEmail)) {
      return makeAccessDeniedPage_(userEmail, '學生（學校電郵）');
    }
    const template = HtmlService.createTemplateFromFile('student');
    template.baseUrl = baseUrl;
    template.currentUserEmail = userEmail;
    return template.evaluate().setTitle('學生課業上傳');
  }

  // 所有其他頁面（教師面板）：須在教師白名單中
  // 若白名單為空，允許第一個使用者通過（初始化便利性），但記錄警告
  const whitelist = getTeacherWhitelist_();
  if (whitelist.length > 0 && !isTeacherAuthorized_(userEmail)) {
    return makeAccessDeniedPage_(userEmail, '教師（管理員白名單）');
  }

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
 * @returns {{classes: string[], homeworks: Object, categories: string[]}}
 */
function getSpreadsheetData() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);
  const sheets = spreadsheet.getSheets();

  const data = { classes: [], homeworks: {}, categories: getCategories() };

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

// ─────────────────────────────────────────────────────────────────────────────
// 課業類別管理函數（供 setup.html 呼叫）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 取得目前的課業類別清單。
 * @returns {string[]}
 */
function getCategoriesFromPanel() {
  return getCategories();
}

/**
 * 新增課業類別。
 * @param {string} categoryName 新類別名稱
 * @returns {string[]} 更新後的類別清單
 */
function addCategory(categoryName) {
  categoryName = categoryName.toString().trim();
  if (!categoryName) throw new Error('類別名稱不可為空');
  const cats = getCategories();
  if (cats.indexOf(categoryName) !== -1) throw new Error('類別「' + categoryName + '」已存在');
  cats.push(categoryName);
  saveCategories(cats);
  logInfo('addCategory', '已新增類別：' + categoryName);
  return cats;
}

/**
 * 刪除課業類別。
 * @param {string} categoryName 要刪除的類別名稱
 * @returns {string[]} 更新後的類別清單
 */
function removeCategory(categoryName) {
  const cats = getCategories().filter(function(c) { return c !== categoryName; });
  saveCategories(cats);
  logInfo('removeCategory', '已刪除類別：' + categoryName);
  return cats;
}

// ─────────────────────────────────────────────────────────────────────────────
// 學生入口函數（供 student.html 呼叫）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 取得學生入口頁面初始資料：所有班別名稱。
 * @returns {{ classes: string[] }}
 */
function getStudentPageData() {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);
  const classes = ss.getSheets()
    .map(function(s) { return s.getRange('A1').getValue().toString().trim(); })
    .filter(Boolean)
    .filter(function(n) { return n !== '系統日誌'; });
  return { classes: classes };
}

/**
 * 取得指定班別的學生名單。
 * @param {string} className 班別名稱
 * @returns {string[]} 學生姓名清單
 */
function getStudentsForClass(className) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);
  const sheet = ss.getSheets().find(function(s) {
    return s.getRange('A1').getValue().toString().trim() === className;
  });
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return [];
  return sheet.getRange('A4:A' + lastRow).getValues().flat().filter(String);
}

/**
 * 取得學生的課業清單及繳交狀態。
 * @param {string} className   班別名稱
 * @param {string} studentName 學生姓名
 * @returns {{ homeworks: Array<{name:string, deadline:string, submitted:boolean, late:boolean}> }}
 */
function getStudentHomeworkStatus(className, studentName) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);
  const sheet = ss.getSheets().find(function(s) {
    return s.getRange('A1').getValue().toString().trim() === className;
  });
  if (!sheet) return { homeworks: [] };

  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 2) return { homeworks: [] };

  const headerRow   = sheet.getRange(1, 2, 1, lastColumn - 1).getValues()[0];
  const deadlineRow = sheet.getRange(2, 2, 1, lastColumn - 1).getValues()[0];
  const folderRow   = sheet.getRange(3, 2, 1, lastColumn - 1).getValues()[0];

  const homeworks = [];
  headerRow.forEach(function(name, i) {
    if (!name) return;
    const folderId = folderRow[i] ? folderRow[i].toString() : '';
    let submitted = false;
    let late = false;
    if (folderId) {
      try {
        const files = DriveApp.getFolderById(folderId).getFiles();
        while (files.hasNext()) {
          const f = files.next();
          if (f.getName().indexOf(studentName) !== -1) {
            submitted = true;
            const deadlineRaw = deadlineRow[i];
            if (deadlineRaw) {
              const deadline = (deadlineRaw instanceof Date)
                ? deadlineRaw
                : Utilities.parseDate(deadlineRaw.toString(), TIMEZONE, 'yyyy-MM-dd HH:mm');
              if (f.getDateCreated() > deadline) late = true;
            }
            break;
          }
        }
      } catch (e) {
        logError('getStudentHomeworkStatus', '讀取文件夾失敗：' + folderId, e.message);
      }
    }

    let deadlineStr = '';
    const d = deadlineRow[i];
    if (d instanceof Date) {
      deadlineStr = Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd HH:mm');
    } else if (d) {
      deadlineStr = d.toString();
    }

    homeworks.push({
      index:    i,
      name:     name.toString(),
      deadline: deadlineStr,
      folderId: folderId,
      submitted: submitted,
      late:     late
    });
  });

  return { homeworks: homeworks };
}

/**
 * 接收學生上傳的課業檔案，以 Base64 編碼傳遞。
 * 自動以「班別_姓名_關鍵詞.副檔名」命名並存放至對應文件夾。
 *
 * @param {string} className    班別名稱
 * @param {string} studentName  學生姓名
 * @param {number} homeworkIndex 課業欄位索引（0-based，對應 B 欄起）
 * @param {string} originalName 原始檔案名稱（用於取得副檔名）
 * @param {string} base64Data   Base64 編碼的檔案內容
 * @param {string} mimeType     檔案 MIME 類型
 * @returns {string} 成功訊息
 */
function uploadHomeworkFile(className, studentName, homeworkIndex, originalName, base64Data, mimeType) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SUBMISSION_SHEET_ID);
  const sheet = ss.getSheets().find(function(s) {
    return s.getRange('A1').getValue().toString().trim() === className;
  });
  if (!sheet) throw new Error('找不到班別：' + className);

  const lastColumn = sheet.getLastColumn();
  const colIndex = 2 + homeworkIndex;
  if (colIndex > lastColumn) throw new Error('找不到指定課業');

  const homeworkName = sheet.getRange(1, colIndex).getValue().toString();
  const folderId     = sheet.getRange(3, colIndex).getValue().toString();
  if (!folderId) throw new Error('課業文件夾尚未建立，請稍後再試或聯絡老師。');

  // 從課業名稱提取關鍵詞（【關鍵詞】），或使用去除類別後的名稱
  const keywordMatch = homeworkName.match(/【(.*?)】/);
  const keyword = keywordMatch ? keywordMatch[1] : homeworkName.replace(/「.*?」/, '').trim();

  // 取得原始副檔名
  const extMatch = originalName.match(/\.([^.]+)$/);
  const ext = extMatch ? '.' + extMatch[1] : '';

  // 最終檔案名稱：班別_姓名_關鍵詞.副檔名
  const newFileName = className + '_' + studentName + '_' + keyword + ext;

  // 解碼 Base64 並建立 Blob
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data), mimeType, newFileName
  );

  const folder = DriveApp.getFolderById(folderId);

  // 若已存在同名檔案，移至垃圾桶（允許重新提交）
  const existing = folder.getFilesByName(newFileName);
  while (existing.hasNext()) {
    existing.next().setTrashed(true);
  }

  folder.createFile(blob);
  logInfo('uploadHomeworkFile', className + ' ' + studentName + ' 提交：' + newFileName);
  return '✅ 已成功提交「' + keyword + '」課業！';
}

/**
 * 取得學生已批改課業文件夾的 URL，並確保只共用給本人。
 * 若 studentEmail 符合學校域名，則自動將文件夾共用給該學生（檢視者）。
 *
 * @param {string} className    班別名稱
 * @param {string} studentName  學生姓名
 * @param {string} [studentEmail] 學生電郵（可選，提供則自動共用）
 * @returns {{ url: string|null, shared: boolean }}
 */
function getMarkedWorkAccess(className, studentName, studentEmail) {
  const config = getConfig();
  const returnedFolder = DriveApp.getFolderById(config.RETURNED_FOLDER_ID);

  const classIter = returnedFolder.getFoldersByName('【' + className + '】');
  if (!classIter.hasNext()) return { url: null, shared: false };
  const classFolder = classIter.next();

  const studentIter = classFolder.getFoldersByName('【' + studentName + '】');
  if (!studentIter.hasNext()) return { url: null, shared: false };
  const studentFolder = studentIter.next();

  let shared = false;
  if (studentEmail) {
    // 使用學生驗證邏輯（允許的域名或特殊電郵）
    if (!isStudentAuthorized_(studentEmail)) {
      throw new Error('電郵不符合允許的學生域名或特殊電郵清單，無法共用。');
    }
    try {
      studentFolder.addViewer(studentEmail);
      shared = true;
      logInfo('getMarkedWorkAccess', '已共用文件夾給 ' + studentEmail);
    } catch (e) {
      logError('getMarkedWorkAccess', '共用失敗', e.message);
    }
  }

  return { url: studentFolder.getUrl(), shared: shared };
}

// ─────────────────────────────────────────────────────────────────────────────
// 共用試算表純文字批量輸入（供 setup.html 呼叫）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 以純文字格式批量輸入共用試算表的學生資料（覆蓋現有資料）。
 * 每行格式：「學號 姓名」或「學號,姓名」（以空格、逗號或 Tab 分隔）。
 *
 * @param {string} className   班別名稱
 * @param {string} plainText   純文字學生資料
 */
function bulkImportShareStudentsText(className, plainText) {
  const lines = plainText.toString().split('\n');
  const students = [];
  lines.forEach(function(line) {
    line = line.trim();
    if (!line) return;
    // 支援空格、Tab、逗號分隔
    const parts = line.split(/[\s,，\t]+/);
    if (parts.length >= 2) {
      students.push({ id: parts[0].trim(), name: parts.slice(1).join(' ').trim() });
    }
  });
  if (students.length === 0) throw new Error('未找到有效的學生資料，請確認格式（每行：學號 姓名）。');
  setShareStudents(className, JSON.stringify(students));
  return '✅ 已成功匯入 ' + students.length + ' 位學生。';
}

// ─────────────────────────────────────────────────────────────────────────────
// 存取控制管理函數（供 setup.html 呼叫）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 取得存取控制設定（供面板顯示）。
 * @returns {{ teacherWhitelist: string[], studentDomains: string[], studentEmails: string[] }}
 */
function getAccessControlSettings() {
  return {
    teacherWhitelist: getTeacherWhitelist_(),
    studentDomains:   getAllowedStudentDomains_(),
    studentEmails:    getAllowedStudentEmails_()
  };
}

/**
 * 新增教師電郵至白名單。
 * @param {string} email
 * @returns {string[]} 更新後的白名單
 */
function addTeacherToWhitelist(email) {
  email = email.toString().trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('請輸入有效的電郵地址');
  const list = getTeacherWhitelist_();
  if (list.some(function(e) { return e.toLowerCase() === email; })) {
    throw new Error('電郵「' + email + '」已在白名單中');
  }
  list.push(email);
  PropertiesService.getScriptProperties().setProperty('TEACHER_WHITELIST', JSON.stringify(list));
  logInfo('addTeacherToWhitelist', '已新增教師：' + email);
  return list;
}

/**
 * 從教師白名單移除指定電郵。
 * @param {string} email
 * @returns {string[]} 更新後的白名單
 */
function removeTeacherFromWhitelist(email) {
  const list = getTeacherWhitelist_().filter(function(e) {
    return e.toLowerCase() !== email.toLowerCase();
  });
  PropertiesService.getScriptProperties().setProperty('TEACHER_WHITELIST', JSON.stringify(list));
  logInfo('removeTeacherFromWhitelist', '已移除教師：' + email);
  return list;
}

/**
 * 儲存學生存取控制設定（允許的域名 + 特殊電郵）。
 * @param {string[]} domains  允許的電郵域名陣列（如 ['ccckyc.edu.hk']）
 * @param {string[]} emails   允許的特殊電郵陣列
 */
function saveStudentAuthSettings(domains, emails) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ALLOWED_STUDENT_DOMAINS', JSON.stringify(domains || []));
  props.setProperty('ALLOWED_STUDENT_EMAILS',  JSON.stringify(emails  || []));
  logInfo('saveStudentAuthSettings',
    '已更新：域名 ' + (domains || []).length + ' 個，特殊電郵 ' + (emails || []).length + ' 個');
}

/**
 * 取得目前登入用戶的電郵（供前端顯示，不用作授權判斷）。
 * @returns {string}
 */
function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail() || '';
}
