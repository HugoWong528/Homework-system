/**
 * 「帙雲」02 - 自動發還課業
 *
 * 功用：將老師批改完畢、放在「03_老師回饋區」的檔案，自動歸類至「04_已發還課業」。
 * 方法：提取檔案名稱中的【班別】、【姓名】及課業【關鍵詞】，並配對至對應的學生文件夾。
 *
 * 觸發器：distributeHomework，每 15 分鐘觸發一次。
 *         執行 createReturnTrigger() 可自動建立觸發器。
 *
 * 注意：ROOT_FOLDER_ID、getConfig() 及 getOrCreateFolder() 定義於 Shared.gs。
 */

// ─────────────────────────────────────────────────────────────────────────────
// 主函數
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 將「03_老師回饋區」中的批改課業，自動歸類至「04_已發還課業」對應的學生文件夾。
 *
 * 「04_已發還課業」的文件夾結構：
 *   04_已發還課業/
 *     【1C】/
 *       【陳大文】/
 *         寫作（長文）/
 *           《藏在泥土的【寶物】》/
 *         閱讀/
 *         寫作（實用文）/
 */
function distributeHomework() {
  try {
  const config = getConfig();
  const uploadFolderId = config.TEACHER_RETURN_FOLDER_ID; // 03_老師回饋區
  const returnFolderId = config.RETURNED_FOLDER_ID;       // 04_已發還課業

  const uploadFolder = DriveApp.getFolderById(uploadFolderId);
  const returnFolder = DriveApp.getFolderById(returnFolderId);

  // 步驟 1：獲取班別資料夾並建立映射（鍵：1C, 4A, ...）
  const classFolderIter = returnFolder.getFolders();
  const classMap = {};
  while (classFolderIter.hasNext()) {
    const classFolder = classFolderIter.next();
    const className = classFolder.getName(); // 例如 "【1C】"
    const classKey = className.replace(/【|】/g, ''); // 提取 "1C"
    classMap[classKey] = classFolder;
  }

  // 步驟 2：獲取學生資料夾並建立映射（鍵：classKey_studentKey）
  const studentMap = {};
  for (const classKey in classMap) {
    const classFolder = classMap[classKey];
    const studentFolderIter = classFolder.getFolders();
    while (studentFolderIter.hasNext()) {
      const studentFolder = studentFolderIter.next();
      const studentName = studentFolder.getName(); // 例如 "【陳大文】"
      const studentKey = studentName.replace(/【|】/g, ''); // 提取 "陳大文"
      if (!studentMap[classKey]) studentMap[classKey] = {};
      studentMap[classKey][studentKey] = studentFolder;
    }
  }

  // 步驟 3：在每位學生的所有課業類別子文件夾下，提取課業關鍵詞
  const assignmentMap = {};
  for (const classKey in studentMap) {
    for (const studentKey in studentMap[classKey]) {
      const studentFolder = studentMap[classKey][studentKey];
      // 遍歷學生文件夾下所有類別子文件夾（不限於「寫作（長文）」）
      const categoryFolderIter = studentFolder.getFolders();
      while (categoryFolderIter.hasNext()) {
        const categoryFolder = categoryFolderIter.next();
        const assignmentFolderIter = categoryFolder.getFolders();
        while (assignmentFolderIter.hasNext()) {
          const assignmentFolder = assignmentFolderIter.next();
          const match = assignmentFolder.getName().match(/【(.*?)】/);
          if (match) {
            const keyword = match[1];
            assignmentMap[classKey + '_' + studentKey + '_' + keyword] = assignmentFolder;
          }
        }
      }
    }
  }

  // 步驟 4：處理上傳資料夾中的所有檔案
  const files = uploadFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();

    // 提取班別
    let fileClassKey = null;
    for (const ck in classMap) {
      if (fileName.indexOf(ck) !== -1) {
        fileClassKey = ck;
        break;
      }
    }

    // 提取姓名
    let fileStudentKey = null;
    if (fileClassKey && studentMap[fileClassKey]) {
      for (const sk in studentMap[fileClassKey]) {
        if (fileName.indexOf(sk) !== -1) {
          fileStudentKey = sk;
          break;
        }
      }
    }

    // 提取課業關鍵詞
    let assignmentKeyword = null;
    if (fileClassKey && fileStudentKey) {
      for (const key in assignmentMap) {
        const parts = key.split('_');
        if (parts[0] === fileClassKey && parts[1] === fileStudentKey) {
          const keyword = parts[2];
          if (fileName.indexOf(keyword) !== -1) {
            assignmentKeyword = keyword;
            break;
          }
        }
      }
    }

    // 步驟 5：根據匹配情況移動檔案
    if (fileClassKey && fileStudentKey && assignmentKeyword) {
      // 完整匹配：移動到課業資料夾
      const targetFolder = assignmentMap[fileClassKey + '_' + fileStudentKey + '_' + assignmentKeyword];
      file.moveTo(targetFolder);
    } else if (fileClassKey && fileStudentKey) {
      // 缺少課業名稱：移動到學生資料夾
      file.moveTo(studentMap[fileClassKey][fileStudentKey]);
    } else if (fileClassKey) {
      // 只有班別：移動到班別資料夾
      file.moveTo(classMap[fileClassKey]);
    } else {
      logWarn('distributeHomework', '無法匹配班別，檔案留在原地：' + fileName);
    }
  }
  } catch (e) {
    logError('distributeHomework', e.message);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 輔助函數
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 觸發器設置
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 建立每 15 分鐘觸發一次 distributeHomework 的時間觸發器。
 */
function createReturnTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'distributeHomework') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('distributeHomework')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('✅ 已建立觸發器：distributeHomework，每 15 分鐘觸發一次。');
}
