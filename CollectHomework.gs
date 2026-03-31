/**
 * 「帙雲」01 - 收集功課
 *
 * 功用：將「01_學生上傳區」的檔案移至「02_待批改課業」，並自動歸類。
 * 方法：提取檔案名稱中的班別（如 1C、4A）及子文件夾以「【】」括起的關鍵詞，並作配對。
 *
 * 觸發器：sortStudentAssignments，每 1 分鐘觸發一次。
 *         執行 createCollectTrigger() 可自動建立觸發器。
 *
 * 注意：ROOT_FOLDER_ID、getConfig() 及 getOrCreateFolder() 定義於 Shared.gs。
 */

// ─────────────────────────────────────────────────────────────────────────────
// 主函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 將「01_學生上傳區」中的檔案，依班別及【關鍵詞】歸類至「02_待批改課業」。
 * 支援的檔案格式：PDF、JPEG、PNG、GIF、BMP、WEBP。
 */
function sortStudentAssignments() {
  try {
  const config = getConfig();
  const sourceFolderId = config.UPLOAD_FOLDER_ID;  // 01_學生上傳區
  const targetFolderId = config.PENDING_FOLDER_ID; // 02_待批改課業

  const supportedMimeTypes = [
    MimeType.PDF,
    MimeType.JPEG,
    MimeType.PNG,
    MimeType.GIF,
    MimeType.BMP,
    MimeType.WEBP
  ];

  // 取得目標文件夾下所有班別的文件夾結構（支援多層子文件夾）
  const classFolders = getClassFoldersRecursive(targetFolderId);

  const sourceFolder = DriveApp.getFolderById(sourceFolderId);
  const allFiles = sourceFolder.getFiles();

  while (allFiles.hasNext()) {
    const file = allFiles.next();
    const fileName = file.getName();
    const fileMimeType = file.getMimeType();

    // 過濾不支援的檔案格式
    if (!supportedMimeTypes.includes(fileMimeType)) {
      Logger.log('跳過不支援的檔案格式: ' + fileName);
      continue;
    }

    // 提取班別資訊（配對如 1C、4A 等格式）
    const classMatch = fileName.match(/(\d+[A-Z])/);
    if (!classMatch) {
      Logger.log('跳過無班別資訊的檔案: ' + fileName);
      continue;
    }
    const className = classMatch[0];
    const classInfo = classFolders[className];
    if (!classInfo) {
      Logger.log('未找到班別文件夾: ' + className);
      continue;
    }

    let targetSubfolderId = null;
    // 查找配對【關鍵詞】的子文件夾
    for (const keyword in classInfo.keywordFolders) {
      if (Object.prototype.hasOwnProperty.call(classInfo.keywordFolders, keyword) &&
          fileName.includes(keyword)) {
        targetSubfolderId = classInfo.keywordFolders[keyword];
        break;
      }
    }

    // 若沒有配對的關鍵詞，使用班別根文件夾
    if (!targetSubfolderId) {
      targetSubfolderId = classInfo.rootFolderId;
    }

    try {
      const targetFolder = DriveApp.getFolderById(targetSubfolderId);
      file.moveTo(targetFolder);
      Logger.log('成功移動檔案: ' + fileName + ' → ' + targetFolder.getName());
    } catch (e) {
      logError('sortStudentAssignments', '移動檔案失敗: ' + fileName, e.message);
    }
  }
  } catch (e) {
    logError('sortStudentAssignments', e.message);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 輔助函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 遞迴取得 parentFolderId 下所有班別文件夾及其【關鍵詞】子文件夾。
 * @param {string} parentFolderId
 * @returns {Object} 班別名稱 → { rootFolderId, keywordFolders }
 */
function getClassFoldersRecursive(parentFolderId) {
  const parentFolder = DriveApp.getFolderById(parentFolderId);
  const classFolderIter = parentFolder.getFolders();
  const result = {};

  while (classFolderIter.hasNext()) {
    const classFolder = classFolderIter.next();
    const className = classFolder.getName();
    const keywordFolders = {};
    collectKeywordsRecursive(classFolder, keywordFolders);

    result[className] = {
      rootFolderId: classFolder.getId(),
      keywordFolders: keywordFolders
    };
  }

  return result;
}

/**
 * 遞迴收集 folder 下所有【關鍵詞】格式子文件夾的關鍵詞與 ID。
 */
function collectKeywordsRecursive(folder, keywordFolders) {
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    const subfolder = subfolders.next();
    const keywordMatch = subfolder.getName().match(/【(.*?)】/);
    if (keywordMatch) {
      keywordFolders[keywordMatch[1]] = subfolder.getId();
    }
    collectKeywordsRecursive(subfolder, keywordFolders);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 觸發器設置
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 建立每 1 分鐘觸發一次 sortStudentAssignments 的時間觸發器。
 * 執行前會先刪除舊有的同名觸發器，避免重複。
 */
function createCollectTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'sortStudentAssignments') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('sortStudentAssignments')
    .timeBased()
    .everyMinutes(1)
    .create();
  Logger.log('✅ 已建立觸發器：sortStudentAssignments，每 1 分鐘觸發一次。');
}
