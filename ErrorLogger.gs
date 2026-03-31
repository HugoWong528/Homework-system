/**
 * 「帙雲」錯誤日誌系統
 *
 * 功用：將系統錯誤與資訊自動記錄至試算表，方便管理員追蹤與排查。
 *
 * 日誌會寫入「繳交紀錄及課業佈置」試算表的「系統日誌」分頁。
 * 最多保留 MAX_LOG_ROWS 行記錄（超出後自動刪除最舊記錄）。
 *
 * 注意：TIMEZONE 定義於 Shared.gs，此處直接使用。
 */

const LOG_SHEET_NAME = '系統日誌';
const MAX_LOG_ROWS   = 500;

// ─────────────────────────────────────────────────────────────────────────────
// 核心日誌函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 記錄一條日誌至「系統日誌」分頁。
 * @param {string} level   日誌等級：'ERROR' | 'INFO' | 'WARN'
 * @param {string} source  發生的函數名稱
 * @param {string} message 主要訊息
 * @param {string} [detail] 額外詳情（可選）
 */
function writeLog_(level, source, message, detail) {
  Logger.log('[' + level + '] ' + source + ': ' + message +
    (detail ? ' | ' + detail : ''));
  try {
    const props  = PropertiesService.getScriptProperties();
    const sheetId = props.getProperty('SUBMISSION_SHEET_ID') ||
                    props.getProperty('OVERDUE_SHEET_ID');
    if (!sheetId) return; // 尚未初始化，只寫入 Logger

    const ss = SpreadsheetApp.openById(sheetId);
    let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
      logSheet = ss.insertSheet(LOG_SHEET_NAME);
      logSheet.getRange('A1:E1').setValues([['時間', '等級', '來源函數', '訊息', '詳情']]);
      logSheet.getRange('A1:E1')
        .setFontWeight('bold')
        .setBackground('#4682B4')
        .setFontColor('#ffffff');
      logSheet.setFrozenRows(1);
    }

    const timeStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    logSheet.insertRowAfter(1);
    logSheet.getRange(2, 1, 1, 5).setValues([[
      timeStr, level, source, message, detail || ''
    ]]);

    // 設定顏色以便快速辨識等級
    const bgColors = { ERROR: '#ffe0e0', WARN: '#fff3cd', INFO: '#ffffff' };
    logSheet.getRange(2, 1, 1, 5)
      .setBackground(bgColors[level] || '#ffffff');

    // 超出上限時刪除最舊的記錄
    const lastRow = logSheet.getLastRow();
    if (lastRow > MAX_LOG_ROWS + 1) {
      logSheet.deleteRows(MAX_LOG_ROWS + 2, lastRow - MAX_LOG_ROWS - 1);
    }
  } catch (e) {
    Logger.log('⚠️ 日誌記錄失敗：' + e.message);
  }
}

/**
 * 記錄錯誤日誌（紅色背景）。
 * @param {string} source  發生錯誤的函數名稱
 * @param {string} message 錯誤訊息
 * @param {string} [detail] 額外詳情（如堆疊追蹤）
 */
function logError(source, message, detail) {
  writeLog_('ERROR', source, message, detail);
}

/**
 * 記錄警告日誌（黃色背景）。
 * @param {string} source  函數名稱
 * @param {string} message 警告訊息
 * @param {string} [detail] 額外詳情
 */
function logWarn(source, message, detail) {
  writeLog_('WARN', source, message, detail);
}

/**
 * 記錄一般資訊日誌（白色背景）。
 * @param {string} source  函數名稱
 * @param {string} message 訊息內容
 */
function logInfo(source, message) {
  writeLog_('INFO', source, message, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// 供 Web Panel 呼叫的函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 取得最近 100 筆日誌，供 Web Panel 顯示。
 * @returns {Array<{time:string, level:string, source:string, message:string, detail:string}>}
 */
function getRecentLogs() {
  try {
    const props   = PropertiesService.getScriptProperties();
    const sheetId = props.getProperty('SUBMISSION_SHEET_ID') ||
                    props.getProperty('OVERDUE_SHEET_ID');
    if (!sheetId) return [];

    const ss       = SpreadsheetApp.openById(sheetId);
    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet || logSheet.getLastRow() < 2) return [];

    const rowCount = Math.min(logSheet.getLastRow() - 1, 100);
    return logSheet.getRange(2, 1, rowCount, 5).getValues().map(function(row) {
      return {
        time:    row[0].toString(),
        level:   row[1].toString(),
        source:  row[2].toString(),
        message: row[3].toString(),
        detail:  row[4].toString()
      };
    });
  } catch (e) {
    return [{ time: '', level: 'ERROR', source: 'getRecentLogs',
              message: '無法讀取日誌：' + e.message, detail: '' }];
  }
}

/**
 * 清除日誌（保留標頭列）。
 */
function clearLogs() {
  try {
    const props   = PropertiesService.getScriptProperties();
    const sheetId = props.getProperty('SUBMISSION_SHEET_ID') ||
                    props.getProperty('OVERDUE_SHEET_ID');
    if (!sheetId) return;

    const ss       = SpreadsheetApp.openById(sheetId);
    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet || logSheet.getLastRow() < 2) return;
    logSheet.deleteRows(2, logSheet.getLastRow() - 1);
  } catch (e) {
    Logger.log('清除日誌失敗：' + e.message);
    throw e;
  }
}
