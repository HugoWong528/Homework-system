/**
 * 「帙雲」學生入口 — 獨立部署版本 (StudentPortal.gs)
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 部署說明：
 * 此檔案設計為於「獨立的 Google Apps Script 專案」中部署，
 * 與教師面板（WebInterface.gs）分開，以確保安全隔離。
 *
 * 步驟：
 * 1. 新增一個 GAS 專案（名稱：帙雲_學生入口）
 * 2. 將以下檔案複製至此新專案：
 *    - StudentPortal.gs（本檔案，重命名為 Code.gs 或保持原名）
 *    - Shared.gs（共用常數與工具函數）
 *    - ErrorLogger.gs（日誌工具）
 *    - student.html（學生入口 HTML）
 * 3. 在 Script Properties 中設定（與教師面板相同的 Properties）：
 *    - SUBMISSION_SHEET_ID、RETURNED_FOLDER_ID 等（可由 setup() 自動設定）
 *    - ALLOWED_STUDENT_DOMAINS（JSON 陣列，如 ["ccckyc.edu.hk"]）
 *    - ALLOWED_STUDENT_EMAILS（JSON 陣列，個別開放的電郵）
 * 4. 部署為 Web App：
 *    - Execute as: Me（以你的帳號執行）
 *    - Who has access: Anyone with a Google Account（需登入）
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 注意：若使用單一 GAS 專案（合併部署），請改用 WebInterface.gs 的 doGet()，
 *       並移除本檔案，以避免 doGet 函數名稱衝突。
 */

// ─────────────────────────────────────────────────────────────────────────────
// 學生入口存取控制（本地版本，與 WebInterface.gs 邏輯相同）
// ─────────────────────────────────────────────────────────────────────────────

function sp_getAllowedStudentDomains_() {
  const json = PropertiesService.getScriptProperties().getProperty('ALLOWED_STUDENT_DOMAINS');
  if (json) { try { return JSON.parse(json); } catch (e) {} }
  const domain = PropertiesService.getScriptProperties()
    .getProperty('SCHOOL_EMAIL_DOMAIN') || SCHOOL_EMAIL_DOMAIN;
  return [domain];
}

function sp_getAllowedStudentEmails_() {
  const json = PropertiesService.getScriptProperties().getProperty('ALLOWED_STUDENT_EMAILS');
  if (json) { try { return JSON.parse(json); } catch (e) {} }
  return [];
}

function sp_isStudentAuthorized_(email) {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  if (sp_getAllowedStudentEmails_().some(function(e) {
    return e.toLowerCase() === emailLower;
  })) return true;
  return sp_getAllowedStudentDomains_().some(function(d) {
    return emailLower.endsWith('@' + d.toLowerCase());
  });
}

function sp_makeAccessDeniedPage_(userEmail) {
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
    '<p>您目前登入的帳號 ' + emailDisplay + ' 不是本校學生帳號。</p>' +
    '<p>請使用學校電郵登入後再試。</p>' +
    '<p style="font-size:13px;color:#888;">如需協助，請聯絡老師或系統管理員。</p>' +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('存取被拒絕');
}

// ─────────────────────────────────────────────────────────────────────────────
// 學生入口 Web App 入口函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 學生入口 Web App 入口。
 * 部署設定：Execute as: Me / Anyone with a Google Account。
 * 只提供學生入口頁面，不提供教師面板。
 */
function doGet(e) {
  const baseUrl = ScriptApp.getService().getUrl();
  const userEmail = Session.getActiveUser().getEmail();

  if (!sp_isStudentAuthorized_(userEmail)) {
    return sp_makeAccessDeniedPage_(userEmail);
  }

  const template = HtmlService.createTemplateFromFile('student');
  template.baseUrl = baseUrl;
  template.currentUserEmail = userEmail;
  return template.evaluate().setTitle('學生課業上傳 — 帙雲');
}

// ─────────────────────────────────────────────────────────────────────────────
// 以下函數供 student.html 透過 google.script.run 呼叫
// （與 WebInterface.gs 中的同名函數相同，此處為學生入口獨立部署所需的複本）
// ─────────────────────────────────────────────────────────────────────────────

// 注意：getStudentPageData、getStudentsForClass、getStudentHomeworkStatus、
//       uploadHomeworkFile、getMarkedWorkAccess 已定義於 WebInterface.gs。
// 若此為獨立部署，請將 WebInterface.gs 中相關函數複製至此，
// 或直接將 WebInterface.gs 的學生相關函數複製到此專案中（替代方案）。
