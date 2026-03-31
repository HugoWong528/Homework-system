/**
 * 「帙雲」共用常數與工具函數
 *
 * 在 Google Apps Script 中，同一專案的所有 .gs 檔案共用同一全域範疇。
 * 將共用常數與函數集中於此，避免重複宣告而導致的錯誤。
 *
 * ⚠️ 部署前，請將下方 ROOT_FOLDER_ID 替換為你的 Google Drive 根文件夾 ID。
 *
 * 注意：OverdueAssignments.gs 部署於獨立的 Apps Script 專案，
 *       因此不共用此檔案，並自行宣告所需常數。
 */

// ─── 需要手動設定的值 ─────────────────────────────────────────────────────────

/** Google Drive 根文件夾 ID（所有腳本共用） */
const ROOT_FOLDER_ID = 'YOUR_ROOT_FOLDER_ID_HERE';

/** 學生 Google 帳號電郵域名（AutoShare.gs 使用） */
const SCHOOL_EMAIL_DOMAIN = 'ccckyc.edu.hk';

/** 平台時區（香港時間） */
const TIMEZONE = 'Asia/Hong_Kong';

/** 預設課業類別（未自訂時使用） */
const DEFAULT_CATEGORIES = ['閱讀', '寫作（長文）', '寫作（實用文）'];

// ─────────────────────────────────────────────────────────────────────────────

/** Drive 文件夾名稱常數 */
const FOLDER_NAMES = {
  UPLOAD:         '01_學生上傳區',
  PENDING:        '02_待批改課業',
  TEACHER_RETURN: '03_老師回饋區',
  RETURNED:       '04_已發還課業'
};

/** 試算表名稱常數 */
const SHEET_NAMES = {
  SHARE:      '自動共用、收集位址',
  SUBMISSION: '繳交紀錄及課業佈置',
  OVERDUE:    'OverdueAssignments'
};

/** Script Properties 鍵名 */
const PROP_KEYS = {
  ROOT_FOLDER_ID:           'ROOT_FOLDER_ID',
  UPLOAD_FOLDER_ID:         'UPLOAD_FOLDER_ID',
  PENDING_FOLDER_ID:        'PENDING_FOLDER_ID',
  TEACHER_RETURN_FOLDER_ID: 'TEACHER_RETURN_FOLDER_ID',
  RETURNED_FOLDER_ID:       'RETURNED_FOLDER_ID',
  SHARE_SHEET_ID:           'SHARE_SHEET_ID',
  SUBMISSION_SHEET_ID:      'SUBMISSION_SHEET_ID',
  OVERDUE_SHEET_ID:         'OVERDUE_SHEET_ID'
};

// ─────────────────────────────────────────────────────────────────────────────
// 共用函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 從 Script Properties 讀取設定。
 * 若必要的 ID 尚未儲存，則自動從根文件夾探索並儲存至 Script Properties。
 * ROOT_FOLDER_ID 優先從 Script Properties 讀取（可透過控制面板設置），
 * 若尚未設定則回退至程式碼常數。
 * @returns {Object} 包含所有資源 ID 的設定物件
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  let config = props.getProperties();

  const needsDiscovery = !config.UPLOAD_FOLDER_ID ||
    !config.PENDING_FOLDER_ID ||
    !config.TEACHER_RETURN_FOLDER_ID ||
    !config.RETURNED_FOLDER_ID ||
    !config.SUBMISSION_SHEET_ID;

  if (needsDiscovery) {
    // 優先使用 Script Properties 中儲存的 ROOT_FOLDER_ID（透過 Web Panel 設置），
    // 若沒有則使用程式碼常數
    const effectiveRootId = config.ROOT_FOLDER_ID || ROOT_FOLDER_ID;
    if (!effectiveRootId || effectiveRootId === 'YOUR_ROOT_FOLDER_ID_HERE') {
      throw new Error(
        '尚未設定根文件夾 ID。請透過控制面板的「系統設定」頁面輸入您的 Google Drive 根文件夾 ID 並執行初始設置，' +
        '或直接修改 Shared.gs 中的 ROOT_FOLDER_ID 常數後執行 Setup.gs 的 setup()。'
      );
    }
    const root = DriveApp.getFolderById(effectiveRootId);

    config.UPLOAD_FOLDER_ID         = getOrCreateFolder(root, FOLDER_NAMES.UPLOAD).getId();
    config.PENDING_FOLDER_ID        = getOrCreateFolder(root, FOLDER_NAMES.PENDING).getId();
    config.TEACHER_RETURN_FOLDER_ID = getOrCreateFolder(root, FOLDER_NAMES.TEACHER_RETURN).getId();
    config.RETURNED_FOLDER_ID       = getOrCreateFolder(root, FOLDER_NAMES.RETURNED).getId();

    const shareIter = root.getFilesByName(SHEET_NAMES.SHARE);
    config.SHARE_SHEET_ID = shareIter.hasNext() ? shareIter.next().getId() : '';

    const subIter = root.getFilesByName(SHEET_NAMES.SUBMISSION);
    if (subIter.hasNext()) {
      config.SUBMISSION_SHEET_ID = subIter.next().getId();
    } else {
      throw new Error(
        '找不到「' + SHEET_NAMES.SUBMISSION + '」試算表，請先執行 setup()。'
      );
    }

    props.setProperties(config);
    Logger.log('✅ 已自動探索並儲存資源 ID。');
  }

  return config;
}

/**
 * 在 parent 文件夾下取得或建立名為 name 的子文件夾（冪等）。
 * @param {GoogleAppsScript.Drive.Folder} parent
 * @param {string} name
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getOrCreateFolder(parent, name) {
  const iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(name);
}

// ─────────────────────────────────────────────────────────────────────────────
// 課業類別管理
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 從 Script Properties 讀取課業類別清單。
 * 若尚未設定，回傳 DEFAULT_CATEGORIES。
 * @returns {string[]}
 */
function getCategories() {
  const json = PropertiesService.getScriptProperties().getProperty('HOMEWORK_CATEGORIES');
  if (json) {
    try { return JSON.parse(json); } catch (e) {}
  }
  return DEFAULT_CATEGORIES.slice();
}

/**
 * 將課業類別清單儲存至 Script Properties。
 * @param {string[]} categories
 */
function saveCategories(categories) {
  PropertiesService.getScriptProperties()
    .setProperty('HOMEWORK_CATEGORIES', JSON.stringify(categories));
}
