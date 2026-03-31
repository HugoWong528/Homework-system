「帙雲」系統功能
1.	一鍵下載全班的課業；

2.	一鍵發還全班學生的課業回饋；


3.	實時追蹤學生繳交課業的紀錄，方便追收功課；

4.	設有自動歸類的功能，讓師生妥善管理資料：
每位學生都有專屬文件夾，老師每次發還課業時，該回饋的文件都會自動分門別類（學生姓名—課業類別—課業名稱）存放於學生的專屬文件夾；老師亦能夠按「班別—課業類別—課業名稱」保存學生的課業。

5.	設有自動追收功課功能，同學如未準時繳交功課，每日早午晚會在TEAMS收到提醒。


「帙雲」建構平臺
Google Drive、JavaScript、Mircosoft Automate




「帙雲」建構方法

1.	在google drive開四個文件夾，並紀錄每個文件夾的LINK：

上傳課業Link（學生）
待批改課業
發還已批改課業Link （「已發還檔案」中的「【班級】」Link要獨立提取）
已發還課業

2.	在google sheet開三個試算表，並紀錄每個試算表的link

自動共用、收集位址
繳交紀錄及課業佈置
OverdueAssignments 

3.	在app script 開五個腳本

收集功課
自動發還課業
自動共用、收集位址
繳交紀錄及課業佈置
繳交紀錄及課業佈置界面
OverdueAssignments（綁定於上述同名的google sheet）


4.	在MIRCOSOFT AUTOMATE建立自動化雲端流程

自動追收功課
App script 腳本

收集功課
function sortStudentAssignments() {
  const sourceFolderId = "【上傳課業Link（學生）】"; // 上传课业Link（学生）文件夹ID
  const targetFolderId = "【待批改課業】"; // 待批改课业文件夹ID
  
  // 支持的文件类型（PDF + 常见图片格式）
  const supportedMimeTypes = [
    MimeType.PDF,
    MimeType.JPEG,
    MimeType.PNG,
    MimeType.GIF,
    MimeType.BMP,
    MimeType.WEBP
  ];
  
  // 获取目标文件夹下的所有层级班级结构（支持多级子文件夹）
  const classFolders = getClassFoldersRecursive(targetFolderId);
  
  // 获取源文件夹中的所有支持类型文件
  const sourceFolder = DriveApp.getFolderById(sourceFolderId);
  const allFiles = sourceFolder.getFiles();
  
  while (allFiles.hasNext()) {
    const file = allFiles.next();
    const fileName = file.getName();
    const fileMimeType = file.getMimeType();
    
    // 过滤不支持的文件类型
    if (!supportedMimeTypes.includes(fileMimeType)) {
      console.log(`跳过不支持的文件类型: ${fileName}`);
      continue;
    }
    
    // 提取班级信息（匹配类似于1C、4A等的格式）
    const classMatch = fileName.match(/(\d+[A-Z])/);
    if (!classMatch) {
      console.log(`跳过无班级信息的文件: ${fileName}`);
      continue;
    }
    const className = classMatch[0];
    const classInfo = classFolders[className];
    if (!classInfo) {
      console.log(`未找到班级文件夹: ${className}`);
      continue;
    }
    
    let targetSubfolderId = null;
    // 查找匹配关键词的子文件夹（支持多级子文件夹）
    for (const keyword in classInfo.keywordFolders) {
      if (fileName.includes(keyword) && classInfo.keywordFolders.hasOwnProperty(keyword)) {
        targetSubfolderId = classInfo.keywordFolders[keyword];
        break; // 找到第一个匹配的关键词即停止
      }
    }
    
    // 如果没有匹配的关键词，使用班级根文件夹
    if (!targetSubfolderId) {
      targetSubfolderId = classInfo.rootFolderId;
    }
    
    // 移动文件
    try {
      const targetFolder = DriveApp.getFolderById(targetSubfolderId);
      file.moveTo(targetFolder);
      console.log(`成功移动文件: ${fileName} -> ${targetFolder.getName()}`);
    } catch (e) {
      console.error(`移动文件失败: ${fileName} - ${e.message}`);
    }
  }
}

function getClassFoldersRecursive(parentFolderId) {
  const parentFolder = DriveApp.getFolderById(parentFolderId);
  const classFolders = parentFolder.getFolders();
  const result = {};
  
  while (classFolders.hasNext()) {
    const classFolder = classFolders.next();
    const className = classFolder.getName();
    // 不再限制特定班级，处理所有子文件夹
    const keywordFolders = {};
    // 递归获取该班级下的所有层级子文件夹（包括深层嵌套）
    collectKeywordsRecursive(classFolder, keywordFolders);
    
    result[className] = {
      rootFolderId: classFolder.getId(),
      keywordFolders: keywordFolders
    };
  }
  
  return result;
}

function collectKeywordsRecursive(folder, keywordFolders) {
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    const subfolder = subfolders.next();
    // 从子文件夹名称中提取关键词（【关键词】格式）
    const keywordMatch = subfolder.getName().match(/【(.*?)】/);
    if (keywordMatch) {
      const keyword = keywordMatch[1];
      keywordFolders[keyword] = subfolder.getId(); // 记录关键词对应的文件夹ID
    }
    // 递归处理子文件夹的子文件夹
    collectKeywordsRecursive(subfolder, keywordFolders);
  }
}


啟動觸發器sortStudentAssignments，一分鐘一次

功用：將「上傳課業Link（學生）」檔案移至「待批改課業」，並自動歸類。
方法：提取檔案中的關鍵詞「班級」及子文件夾以「【】」括起的關鍵詞，並作配對。

相關文件夾ID：上傳課業Link（學生）、待批改課業


自動發還課業
function distributeHomework() {
  var uploadFolderId = '【上傳課業Link（學生）】'; // 上傳課業Link（學生）
  var returnFolderId = '【已發還課業】'; // 發還已批改課業Link

  var uploadFolder = DriveApp.getFolderById(uploadFolderId);
  var returnFolder = DriveApp.getFolderById(returnFolderId);

  // 步驟 1：獲取班別資料夾並建立映射
  var classFolders = returnFolder.getFolders();
  var classMap = {};
  while (classFolders.hasNext()) {
    var classFolder = classFolders.next();
    var className = classFolder.getName(); // 例如 "【1C】"
    var classKey = className.replace(/【|】/g, ''); // 提取 "1C"
    classMap[classKey] = classFolder;
  }

  // 步驟 2：獲取人名資料夾並建立映射
  var studentMap = {};
  for (var classKey in classMap) {
    var classFolder = classMap[classKey];
    var studentFolders = classFolder.getFolders();
    while (studentFolders.hasNext()) {
      var studentFolder = studentFolders.next();
      var studentName = studentFolder.getName(); // 例如 "【ABC】"
      var studentKey = studentName.replace(/【|】/g, ''); // 提取 "ABC"
      if (!studentMap[classKey]) {
        studentMap[classKey] = {};
      }
      studentMap[classKey][studentKey] = studentFolder;
    }
  }

  // 步驟 3：獲取「寫作（長文）」下的課業資料夾並提取關鍵詞
  var assignmentMap = {};
  for (var classKey in studentMap) {
    for (var studentKey in studentMap[classKey]) {
      var studentFolder = studentMap[classKey][studentKey];
      var writingFolders = studentFolder.getFoldersByName('寫作（長文）');
      if (writingFolders.hasNext()) {
        var writingFolder = writingFolders.next();
        var assignmentFolders = writingFolder.getFolders();
        while (assignmentFolders.hasNext()) {
          var assignmentFolder = assignmentFolders.next();
          var assignmentName = assignmentFolder.getName(); // 例如 "《自此之後，我解開了【心結】》"
          var match = assignmentName.match(/【(.*?)】/);
          if (match) {
            var keyword = match[1]; // 提取 "心結"
            assignmentMap[classKey + '_' + studentKey + '_' + keyword] = assignmentFolder;
          }
        }
      }
    }
  }

  // 步驟 4：處理上傳資料夾中的所有檔案
  var files = uploadFolder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var fileName = file.getName(); // 例如 "1C ABC 自此之後，我解開了心結.jpg"

    // 提取檔名中的班別
    var classKey = null;
    for (var ck in classMap) {
      if (fileName.indexOf(ck) !== -1) {
        classKey = ck;
        break;
      }
    }

    // 提取檔名中的姓名
    var studentKey = null;
    if (classKey && studentMap[classKey]) {
      for (var sk in studentMap[classKey]) {
        if (fileName.indexOf(sk) !== -1) {
          studentKey = sk;
          break;
        }
      }
    }

    // 提取檔名中的課業關鍵詞
    var assignmentKeyword = null;
    if (classKey && studentKey) {
      for (var key in assignmentMap) {
        var parts = key.split('_');
        if (parts[0] === classKey && parts[1] === studentKey) {
          var keyword = parts[2];
          if (fileName.indexOf(keyword) !== -1) {
            assignmentKeyword = keyword;
            break;
          }
        }
      }
    }

    // 步驟 5：根據匹配情況移動檔案
    if (classKey && studentKey && assignmentKeyword) {
      // 完整匹配：移動到課業資料夾
      var targetFolder = assignmentMap[classKey + '_' + studentKey + '_' + assignmentKeyword];
      file.moveTo(targetFolder);
    } else if (classKey && studentKey) {
      // 缺少課業名稱：移動到學生資料夾
      var studentFolder = studentMap[classKey][studentKey];
      file.moveTo(studentFolder);
    } else if (classKey) {
      // 只有班別：移動到班別資料夾
      var classFolder = classMap[classKey];
      file.moveTo(classFolder);
    }
    // 如果只有課業名稱匹配或完全無法匹配，則留在原地
  }
}


啟動觸發器distributeHomework，十五分鐘一次

功用：將「發還已批改課業Link」檔案移至「已發還課業」，並自動歸類。
方法：提取檔案中的關鍵詞「【班級】」、「【姓名】」及子文件夾以「【】」括起的關鍵詞，並作配對。

相關文件夾ID：發還已批改課業Link 、已發還課業

自動共用、收集位址
function shareFoldersAndUpdateSheet() {
  // 試算表 ID
  const spreadsheetId = '【自動共用、收集位址】';
  // 班級文件夾 ID
  const classFolderId = '【班別文件夾，待手打】';
  // 學校域名，請替換為實際域名
  const domain = 'ccckyc.edu.hk';

  // 獲取試算表
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getActiveSheet();

  // 獲取 A 列（學號）和 B 列（姓名）的數據，從 A2 和 B2 開始
  const range = sheet.getRange('A2:B' + sheet.getLastRow());
  const values = range.getValues();

  // 過濾掉空行
  const students = values.filter(row => row[0] && row[1]);

  // 獲取班級文件夾
  const classFolder = DriveApp.getFolderById(classFolderId);

  // 獲取班級文件夾下的所有子文件夾
  const subFolders = classFolder.getFolders();

  // 創建姓名到文件夾的映射
  const folderMap = {};
  while (subFolders.hasNext()) {
    const folder = subFolders.next();
    const folderName = folder.getName();
    // 提取「【」和「】」之間的姓名
    const match = folderName.match(/【(.*?)】/);
    if (match) {
      const name = match[1];
      folderMap[name] = folder;
    }
  }

  // 遍歷學生數據
  students.forEach((student, index) => {
    const studentId = student[0]; // 學號
    const studentName = student[1]; // 姓名

    // 構建電子郵件地址
    const email = `${studentId}@${domain}`;

    // 查找對應的文件夾
    const folder = folderMap[studentName];
    if (folder) {
      // 分享文件夾給學生，設置為編輯者，不發送通知
      folder.addEditor(email);
      // 獲取文件夾 URL
      const folderUrl = folder.getUrl();
      // 填寫到 C 列（行號從 2 開始）
      sheet.getRange(index + 2, 3).setValue(folderUrl);
    } else {
      Logger.log(`未找到學生 ${studentName} 的文件夾`);
    }
  });
}


不設觸發器，要將「已發還課業」中「班級」的位址換到代碼中。在手動輸入好學生的學號及姓名後，則用APP SCRIPT手動RUN一次。A1輸入「學號」（下面輸入實際學號），B1輸入「學生名稱」（下面輸入實際名稱），C1輸入文件夾位址。（下面自動生成，不用輸入）

功用：收集學生「已發還檔案」個人專屬文件夾的位址，方便將位址批量分發給學生。
方法：手動輸入「學號」及「學生名稱」，用APP SCRIPT手動RUN一次，即可自動生成位址。
相關文件夾ID：「已發還課業」中的某班別文件夾
相關試算表ID：「自動共用、收集位址」



繳交紀錄及課業佈置（＋自動生成「待批改課業」及「已發還課業」的分層文件夾）
// 全局文件夾緩存
const folderCache = {};

function createFoldersAndUpdateSheet() {
  const spreadsheetId = '【繳交紀錄及課業佈置】';
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheets = spreadsheet.getSheets();
  
  const pendingFolderId = '【待批改課業】'; // 「待批改課業」 folder ID
  const returnedFolderId = '【已發還課業】'; // 「已發還課業」 folder ID
  
  sheets.forEach(sheet => {
    const className = sheet.getRange('A1').getValue().toString().trim();
    if (!className) return; // Skip if no class name
    
    // 檢查是否已創建文件夾
    const folderCreated = sheet.getRange('A2').getValue();
    if (folderCreated !== 'created') {
      // --- Handle 「待批改課業」 folder structure ---
      const classFolder = createFolderIfNotExists(pendingFolderId, className);
      const categoryFolders = {
        '閱讀': createFolderIfNotExists(classFolder.getId(), '閱讀'),
        '寫作（長文）': createFolderIfNotExists(classFolder.getId(), '寫作（長文）'),
        '寫作（實用文）': createFolderIfNotExists(classFolder.getId(), '寫作（實用文）')
      };
      
      const lastColumn = sheet.getLastColumn();
      if (lastColumn >= 2) {
        const homeworkRange = sheet.getRange(1, 2, 2, lastColumn - 1);
        const homeworkValues = homeworkRange.getValues();
        const homeworkNames = homeworkValues[0]; // B1, C1, ...
        homeworkNames.forEach((name, index) => {
          if (!name) return; // Skip empty cells
          
          // Extract category and homework title from name
          const categoryMatch = name.match(/「(.*?)」/);
          if (!categoryMatch) return; // Skip if no category found
          const category = categoryMatch[1];
          const homeworkTitle = name.replace(/「.*?」/, '').trim(); // Remove category part
          const categoryFolder = categoryFolders[category];
          if (categoryFolder) {
            const homeworkFolder = createFolderIfNotExists(categoryFolder.getId(), homeworkTitle);
            // Write folder ID to B3, C3, ...
            sheet.getRange(3, 2 + index).setValue(homeworkFolder.getId());
          }
        });
      }
      
      // --- Handle 「已發還課業」 folder structure ---
      const returnedClassFolder = createFolderIfNotExists(returnedFolderId, `【${className}】`);
      const studentNames = sheet.getRange('A4:A' + sheet.getLastRow()).getValues().flat().filter(String);
      studentNames.forEach(student => {
        const studentFolder = createFolderIfNotExists(returnedClassFolder.getId(), `【${student}】`);
        ['閱讀', '寫作（長文）', '寫作（實用文）'].forEach(category => {
          createFolderIfNotExists(studentFolder.getId(), category);
        });
      });
      
      // 標記文件夾已創建
      sheet.getRange('A2').setValue('created');
    }
    
    // --- Update submission status (only if homework exists) ---
    const lastColumn = sheet.getLastColumn();
    if (lastColumn >= 2) {
      const homeworkRange = sheet.getRange(1, 2, 2, lastColumn - 1);
      const homeworkValues = homeworkRange.getValues();
      const homeworkNames = homeworkValues[0];
      const deadlines = homeworkValues[1];
      const studentNames = sheet.getRange('A4:A' + sheet.getLastRow()).getValues().flat().filter(String);
      updateSubmissionStatus(sheet, studentNames, homeworkNames, deadlines);
    }
  });
}

// Helper function to create a folder if it doesn’t exist with caching
function createFolderIfNotExists(parentId, folderName) {
  const key = `${parentId}_${folderName}`;
  if (folderCache[key]) {
    return DriveApp.getFolderById(folderCache[key]);
  }
  
  const parentFolder = DriveApp.getFolderById(parentId);
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    const folder = folders.next();
    folderCache[key] = folder.getId();
    return folder;
  } else {
    const newFolder = parentFolder.createFolder(folderName);
    folderCache[key] = newFolder.getId();
    return newFolder;
  }
}

// Function to update submission status in the sheet with batch operations
function updateSubmissionStatus(sheet, studentNames, homeworkNames, deadlines) {
  const homeworkFolderIds = sheet.getRange(3, 2, 1, homeworkNames.length).getValues()[0];
  
  // 一次性搜索所有相關文件並緩存
  const fileMap = {};
  homeworkFolderIds.forEach((folderId, colIndex) => {
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
  
  studentNames.forEach((student, rowIndex) => {
    const rowValues = [];
    const rowBackgrounds = [];
    homeworkFolderIds.forEach((folderId, colIndex) => {
      if (!folderId || !homeworkNames[colIndex]) {
        rowValues.push('');
        rowBackgrounds.push('white');
        return;
      }
      
      const files = fileMap[folderId] || [];
      let submitted = false;
      let late = false;
      for (const file of files) {
        if (file.getName().includes(student)) {
          submitted = true;
          const uploadTime = file.getDateCreated();
          const deadline = new Date(deadlines[colIndex]);
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
  const range = sheet.getRange(4, 2, numRows, numCols);
  range.setValues(values);
  range.setBackgrounds(backgrounds);
}


啟動觸發器createFoldersAndUpdateSheet，五分鐘一次

功用： 方便老師查閱繳交紀錄及佈置課業，亦可自動生成「待批改課業」及「已發還課業」的分層文件夾。
方法：其一，在A1輸入「班別」，A4或以下輸入「學生姓名」，輸入完畢即會按既定格式自動生成相關分層文件夾；
其二，B1輸入課業名稱，格式必定如「「寫作（長文）」【藏在泥土】的寶物」，用開關引號「」去標題課業類別，用「【】」去標示關鍵詞，前者是為了將檔案歸到「已發還課業」中正確的課業類別，而後者是為了讓學生課業自動歸類至「待批改課業」及「已發還課業」相關的子文件夾中。在B2輸入截止繳交日期及時間（格式必須如2025-04-29 23:59），即可建立新課業；
其三，比對「待批改課業」的檔案名稱及A4或以下的「學生姓名」，匹配即「已繳交」（綠色），不匹配即「未繳交」（紅色），匹配但繳交日期和時間晚於截止日期和時間，即「遲交」（黃色）。

相關文件夾ID：「待批改課業」、「已發還課業」文件夾
相關試算表ID：「繳交紀錄及課業佈置」試算表






繳交紀錄及課業佈置介面

Code.gs
const spreadsheetId = '【繳交紀錄及課業佈置】';
const pendingFolderId = '【待批改課業】';

const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
const sheets = spreadsheet.getSheets();

function doGet(e) {
  if (e.parameter.page === 'record') {
    const template = HtmlService.createTemplateFromFile('record');
    template.classData = getClassData();
    return template.evaluate().setTitle('作業繳交紀錄查閱');
  } else if (e.parameter.page === 'homework') {
    const template = HtmlService.createTemplateFromFile('homework');
    return template.evaluate().setTitle('布置課業');
  } else {
    const template = HtmlService.createTemplateFromFile('Index');
    template.classData = getClassData();
    return template.evaluate().setTitle('帙雲 - 控制面板');
  }
}

// 獲取試算表資料（用於 HOMEWORK.HTML）
function getSpreadsheetData() {
  const data = {
    classes: [],
    homeworks: {}
  };

  sheets.forEach(sheet => {
    const className = sheet.getRange('A1').getValue().toString().trim();
    if (!className) return;

    data.classes.push(className);

    const lastColumn = sheet.getLastColumn();
    let homeworkNames = [];
    let deadlines = [];

    if (lastColumn >= 2) {
      const homeworkRange = sheet.getRange(1, 2, 2, lastColumn - 1);
      const values = homeworkRange.getValues();
      homeworkNames = values[0].filter(String); // B1, C1, ...
      deadlines = values[1].map(d => d.toString()); // 直接作為字符串處理
    }

    data.homeworks[className] = {
      names: homeworkNames,
      deadlines: deadlines
    };
  });

  return data;
}

// 更新試算表（用於 HOMEWORK.HTML）
function updateSpreadsheet(className, homeworkName, deadline) {
  const sheet = sheets.find(s => s.getRange('A1').getValue().toString().trim() === className);
  if (!sheet) {
    throw new Error('找不到指定的班別');
  }

  // 找到下一個可用欄位
  const row1Values = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];
  let nextColumn = 2; // 從 B 欄開始
  for (let col = 1; col < row1Values.length; col++) {
    if (!row1Values[col]) {
      nextColumn = col + 1;
      break;
    }
    if (col === row1Values.length - 1) {
      nextColumn = row1Values.length + 1;
    }
  }

  // 更新課業名稱 (B1, C1, ...)
  sheet.getRange(1, nextColumn).setValue(homeworkName);

  // 更新截止日期 (B2, C2, ...)，直接儲存為字符串
  sheet.getRange(2, nextColumn).setValue(deadline);
}

function getClassData() {
  const classData = [];
  sheets.forEach(sheet => {
    const className = sheet.getRange('A1').getValue().toString().trim();
    if (!className) return;
    
    const lastColumn = sheet.getLastColumn();
    const homeworkNames = lastColumn >= 2 ? sheet.getRange(1, 2, 1, lastColumn - 1).getValues()[0] : [];
    const deadlines = lastColumn >= 2 ? sheet.getRange(2, 2, 1, lastColumn - 1).getValues()[0].map(date => {
      if (date instanceof Date) {
        return Utilities.formatDate(date, Session.getScriptTimeZone(), "d-M-yyyy");
      } else {
        return date.toString();
      }
    }) : [];
    const studentNames = sheet.getRange('A4:A' + sheet.getLastRow()).getValues().flat().filter(String);
    
    const homeworkData = homeworkNames.map((name, index) => ({
      name: name,
      deadline: deadlines[index],
      folderId: sheet.getRange(3, 2 + index).getValue()
    }));
    
    const students = studentNames.map((student, rowIndex) => {
      const submissions = homeworkData.map((hw, colIndex) => {
        const cell = sheet.getRange(4 + rowIndex, 2 + colIndex);
        const background = cell.getBackground();
        return { homework: hw.name, color: background };
      });
      return { name: student, submissions: submissions };
    });
    
    classData.push({
      className: className,
      homework: homeworkData,
      students: students
    });
  });
  return classData;
}


Index.html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>帙雲 - 控制面板</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&family=Noto+Serif+TC:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body {
            background-image: url('https://i.ibb.co/ns80T5pr/4-5.png');
            background-size: cover;
            background-position: center;
            font-family: 'Noto Serif JP', 'Noto Serif TC', 'cwTeXHei';
            margin: 0;
            padding: 0;
            color: #333;
        }
        .main-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: rgba(255, 255, 255, 0.85);
            border-radius: 10px;
            min-height: 100vh;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            font-size: 48px;
            color: #2471a3; /* 淡藍色 */
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            animation: float 2s ease-in-out infinite;
        }
        @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0); }
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            font-size: 24px;
            font-family: 'Noto Serif TC', 'cwTeXHei';
            margin-bottom: 20px;
            color: #4682B4; /* 淡藍色 */
            border-bottom: 2px solid #4682B4;
            padding-bottom: 10px;
        }
        .links {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }
        .links a {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 10px;
            text-decoration: none;
            color: #333;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 150px;
            position: relative;
        }
        .links a:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 12px rgba(0,0,0,0.2);
        }
        .links a img {
            width: 48px;
            height: 48px;
            margin-bottom: 10px;
            transition: transform 0.3s ease;
        }
        .links a:hover img {
            transform: scale(1.15);
        }
        .links span {
            text-align: center;
            word-break: break-word;
            font-size: 14px;
        }
        .links a::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background-color: #4682B4; /* 淡藍色 */
            color: #fff;
            padding: 5px 10px;
            border-radius: 5px;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            font-size: 12px;
            margin-bottom: 5px;
        }
        .links a:hover::after {
            opacity: 1;
        }
        .light-blue-icon {
            filter: invert(45%) sepia(97%) saturate(302%) hue-rotate(180deg) brightness(94%) contrast(85%); /* 淡藍色 */
        }
        .dark-blue-icon {
            filter: invert(30%) hue-rotate(270deg) saturate(160%) brightness(85%) contrast(100%);
        }
        .teal-icon {
            filter: invert(82%) hue-rotate(200deg) saturate(200%) brightness(90%) contrast(95%); /* 清新淡藍 */
        }
    </style>
</head>
<body>
    <div class="main-container">
        <div class="header">
            <h1>帙雲</h1>
        </div>
        <section class="section">
            <h2>課業及回饋</h2>
            <div class="links">
                <a href="【上傳課業Link（學生）】 " rel="noopener" data-tooltip="學生上傳作業的區域">
                    <img src="https://img.icons8.com/ios-filled/50/000000/paper-plane.png" alt="提交" class="light-blue-icon">
                    <span>學生上傳區</span>
                </a>
                <a href="【待批改課業】" rel="noopener" data-tooltip="待老師批改的課業">
                    <img src="https://img.icons8.com/ios-filled/50/000000/documents.png" alt="待批改" class="light-blue-icon">
                    <span>待批改課業</span>
                </a>
                <a href="【老師回饋區】" rel="noopener" data-tooltip="老師上傳作業回饋的區域">
                    <img src="https://img.icons8.com/ios-filled/50/000000/speech-bubble.png" alt="回饋" class="light-blue-icon">
                    <span>老師回饋區</span>
                </a>
                <a href="【已發還課業】" rel="noopener" data-tooltip="已批改並發還的課業">
                    <img src="https://img.icons8.com/ios-filled/50/000000/checked.png" alt="已發還" class="light-blue-icon">
                    <span>已發還課業</span>
                </a>
            </div>
        </section>
        <section class="section">
            <h2>應用操作</h2>
            <div class="links">
                <a href="【record.html】" rel="noopener" data-tooltip="查看學生的繳交記錄">
                    <img src="https://img.icons8.com/ios-filled/50/000000/book.png" alt="繳交記錄" class="dark-blue-icon">
                    <span>繳交紀錄</span>
                </a>
                <div class="links">
                <a href="【homework.html】" target="_blank" rel="noopener" data-tooltip="B1課業名稱（「寫作（長文）」解開【心結】）/ B2截止繳交日期及時間（2025-04-25 23:59） / B3漏空">
                    <img src="https://img.icons8.com/ios-filled/50/000000/gear.png" alt="設置" class="dark-blue-icon">
                    <span>課業設置</span>
                </a>
            </div>
        </section>
        <section class="section">
            <h2>後臺設置</h2>
            <div class="links">
                <a href="【繳交課業及課業佈置】" rel="noopener" data-tooltip="A1班級（1C) / A4姓名（陳大文）">
                    <img src="https://img.icons8.com/ios-filled/50/000000/add-user-male.png" alt="批量建立" class="teal-icon">
                    <span>批量建立資料夾</span>
                </a>
<a href="https://docs.google.com/spreadsheets/d/1U_xoXKiyG0Pb3v3bqqkj9dDwzyTr9ajHRr-O45saP0U/edit?gid=0#gid=0" target="_blank" rel="noopener" data-tooltip="輸入姓名及學號後，共用專屬文件夾並獲取位址">
            <img src="https://img.icons8.com/ios-filled/50/000000/share.png" alt="自動共用" class="teal-icon">
            <span>自動共用專屬文件夾</span>
        </a>

            </div>
        </section>
    </div>

    <script type="text/javascript">
        var gk_isXlsx = false;
        var gk_xlsxFileLookup = {};
        var gk_fileData = {};
        function filledCell(cell) {
          return cell !== '' && cell != null;
        }
        function loadFileData(filename) {
        if (gk_isXlsx && gk_xlsxFileLookup[filename]) {
            try {
                var workbook = XLSX.read(gk_fileData[filename], { type: 'base64' });
                var firstSheetName = workbook.SheetNames[0];
                var worksheet = workbook.Sheets[firstSheetName];

                // Convert sheet to JSON to filter blank rows
                var jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: '' });
                // Filter out blank rows (rows where all cells are empty, null, or undefined)
                var filteredData = jsonData.filter(row => row.some(filledCell));

                // Heuristic to find the header row by ignoring rows with fewer filled cells than the next row
                var headerRowIndex = filteredData.findIndex((row, index) =>
                  row.filter(filledCell).length >= filteredData[index + 1]?.filter(filledCell).length
                );
                // Fallback
                if (headerRowIndex === -1 || headerRowIndex > 25) {
                  headerRowIndex = 0;
                }

                // Convert filtered JSON back to CSV
                var csv = XLSX.utils.aoa_to_sheet(filteredData.slice(headerRowIndex)); // Create a new sheet from filtered array of arrays
                csv = XLSX.utils.sheet_to_csv(csv, { header: 1 });
                return csv;
            } catch (e) {
                console.error(e);
                return "";
            }
        }
        return gk_fileData[filename] || "";
        }
    </script>
</body>
</html>




record.html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>作業繳交紀錄查閱</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&family=cwTeXHei&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Noto Serif TC', 'cwTeXHei', serif;
      background-image: url('https://i.ibb.co/YFcZbS9X/2.png');
      background-size: cover;
      background-attachment: fixed;
      background-position: center;
      margin: 0;
      padding: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      color: #f0f0f0; /* 淺色文字 */
    }

    .header {
      text-align: center;
      padding: 20px;
      background: rgba(51, 51, 51, 0.95); /* 深灰色 */
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
      color: #f0f0f0; /* 淺色文字 */
    }

    .header h1 {
      font-size: 48px;
      color: #2471a3;
      margin: 0;
      font-weight: 700;
      letter-spacing: 2px;
      animation: float 2s ease-in-out infinite;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
    }

    @keyframes float {
      0% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
      100% { transform: translateY(0); }
    }

    .main-content {
      flex: 1;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .class-buttons {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 30px;
    }

    .class-button {
      padding: 15px 30px;
      background: #4682B4; /* 保留原始顏色 */
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 18px;
      cursor: pointer;
      transition: background 0.3s ease, transform 0.2s ease;
    }

    .class-button:hover {
      background: #3670a1;
      transform: scale(1.05);
    }

    .class-table {
      background: rgba(51, 51, 51, 0.9); /* 深灰色 */
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      overflow-x: auto;
      display: none; /* 初始隱藏 */
      color: #f0f0f0; /* 淺色文字 */
    }

    .class-table:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
    }

    .class-title {
      font-size: 32px;
      color: #87CEEB; /* 淺藍色，與按鈕相呼應 */
      border-bottom: 3px solid #87CEEB;
      padding-bottom: 10px;
      margin-bottom: 20px;
      display: inline-block;
    }

    .status-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      border: 1px solid #555; /* 深色邊框 */
    }

    .status-table th,
    .status-table td {
      padding: 15px 20px;
      text-align: left;
      border: 1px solid #555; /* 深色邊框 */
      white-space: nowrap;
      color: #f0f0f0; /* 淺色文字 */
    }

    .status-table th {
      background: #4682B4; /* 保留原始顏色 */
      color: white;
      font-size: 18px;
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 2px solid #555; /* 深色邊框 */
    }

    .status-table th:first-child {
      position: sticky;
      left: 0;
      z-index: 15;
      background: #4682B4; /* 保留原始顏色 */
    }

    .status-table td {
      background: rgba(68, 68, 68, 0.3); /* 深色背景 */
      border-bottom: 1px solid #555; /* 深色邊框 */
      font-size: 16px;
    }

    .status-table td:first-child {
      position: sticky;
      left: 0;
      background: rgba(51, 51, 51, 0.9); /* 深色背景 */
      z-index: 5;
    }

    .status-table td div {
      width: 100%;
      height: 100%;
      min-height: 40px;
    }

    .hw-info {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .hw-name {
      font-weight: bold;
    }

    .deadline {
      font-size: 0.8em;
      color: #ddd; /* 更亮的灰色 */
    }

    /* 加粗課業列之間的邊框 */
    .status-table th:not(:first-child),
    .status-table td:not(:first-child) {
      border-right: 2px solid #555; /* 深色邊框 */
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 36px;
      }
      .class-title {
        font-size: 28px;
      }
      .status-table th,
      .status-table td {
        padding: 12px 15px;
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>作業繳交紀錄</h1>
  </div>

  <div class="main-content">
    <div class="class-buttons" id="class-buttons">
      <? for (const classInfo of classData) { ?>
      <button class="class-button" data-class="<?= classInfo.className ?>"><?= classInfo.className ?></button>
      <? } ?>
    </div>
    <div id="class-tables">
      <? for (const classInfo of classData) { ?>
      <div class="class-table" data-class="<?= classInfo.className ?>">
        <h2 class="class-title"><?= classInfo.className ?></h2>
        <div style="overflow: auto; max-height: 600px;">
          <table class="status-table">
            <thead>
              <tr>
                <th>學生姓名</th>
                <? for (const hw of classInfo.homework) { ?>
                <th>
                  <div class="hw-info">
                    <span class="hw-name"><?= hw.name ?></span><br>
                    <span class="deadline"><?= hw.deadline ?></span>
                  </div>
                </th>
                <? } ?>
              </tr>
            </thead>
            <tbody>
              <? for (const student of classInfo.students) { ?>
              <tr>
                <td><?= student.name ?></td>
                <? for (const submission of student.submissions) { ?>
                <td style="background-color: <?= submission.color ?>;"></td>
                <? } ?>
              </tr>
              <? } ?>
            </tbody>
          </table>
        </div>
      </div>
      <? } ?>
    </div>
  </div>

  <script>
    document.querySelectorAll('.class-button').forEach(button => {
      button.addEventListener('click', function() {
        const className = this.dataset.class;
        document.querySelectorAll('.class-table').forEach(table => {
          if (table.dataset.class === className) {
            table.style.display = 'block';
          } else {
            table.style.display = 'none';
          }
        });
      });
    });
  </script>
</body>
</html>



homework.html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>布置課業</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&family=cwTeXHei&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Noto Serif TC', 'cwTeXHei', serif;
      background-image: url('https://i.ibb.co/XZG0T6jR/6.png');
      background-size: cover;
      background-attachment: fixed;
      background-position: center;
      margin: 0;
      padding: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      color: #f0f0f0; /* 淺色文字 */
    }

    .header {
      text-align: center;
      padding: 20px;
      background: rgba(51, 51, 51, 0.95); /* 深灰色 */
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
      color: #f0f0f0; /* 淺色文字 */
    }

    .header h1 {
      font-size: 48px;
      color: #2471a3;
      margin: 0;
      font-weight: 700;
      letter-spacing: 2px;
      animation: float 2s ease-in-out infinite;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
    }

    @keyframes float {
      0% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
      100% { transform: translateY(0); }
    }

    .main-content {
      flex: 1;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .form-container {
      background: rgba(51, 51, 51, 0.9); /* 深灰色 */
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      color: #f0f0f0; /* 淺色文字 */
    }

    label {
      font-size: 18px;
      margin-bottom: 10px;
      display: block;
      color: #f0f0f0; /* 淺色文字 */
    }

    select, input {
      width: 100%;
      padding: 10px;
      margin-bottom: 20px;
      border: 1px solid #555; /* 深色邊框 */
      border-radius: 5px;
      font-size: 16px;
      background: #444; /* 深色背景 */
      color: #f0f0f0; /* 淺色文字 */
    }

    button {
      padding: 15px 30px;
      background: #4682B4; /* 保留原始顏色 */
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 18px;
      cursor: pointer;
      transition: background 0.3s ease, transform 0.2s ease;
    }

    button:hover {
      background: #3670a1;
      transform: scale(1.05);
    }

    /* 新增提交按鈕樣式 */
    #submit-btn {
      background: #4CAF50; /* 綠色 */
      color: white;
    }

    #submit-btn:hover {
      background: #45a049; /* 深綠色懸停效果 */
    }

 /* 新增確認按鈕樣式 */
    #confirm-btn {
      background: #4CAF50; /* 綠色 */
      color: white;
    }

    #confirm-btn:hover {
      background: #45a049; /* 深綠色懸停效果 */
    }

    /* 新增取消按鈕樣式 */
    #cancel-btn {
      background: #FF4444; /* 紅色 */
      color: white;
    }

    #cancel-btn:hover {
      background: #ff1a1a; /* 深紅色懸停效果 */
    }


    .homework-list {
      margin-top: 20px;
      color: #f0f0f0; /* 淺色文字 */
    }

    .homework-item {
      padding: 10px;
      border-bottom: 1px solid #555; /* 深色邊框 */
    }

    #deadline-error {
      color: red;
      font-size: 14px;
      margin-top: -15px;
      margin-bottom: 10px;
    }

    /* 確認視窗樣式 */
    .modal {
      display: none;
      position: fixed;
      z-index: 1001;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
    }

    .modal-content {
      background-color: #333; /* 深灰色 */
      margin: 15% auto;
      padding: 20px;
      border-radius: 10px;
      width: 50%;
      text-align: center;
      color: #f0f0f0; /* 淺色文字 */
    }

    .modal-buttons {
      margin-top: 20px;
    }

    .modal-buttons button {
      margin: 0 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>布置課業</h1>
  </div>

  <div class="main-content">
    <div class="form-container">
      <label for="class-select">選擇班別：</label>
      <select id="class-select"></select>

      <label for="category-select">選擇課業類別：</label>
      <select id="category-select">
        <option value="閱讀">閱讀</option>
        <option value="寫作（長文）">寫作（長文）</option>
        <option value="寫作（實用文）">寫作（實用文）</option>
      </select>

      <label for="homework-name">課業名稱：</label>
      <input type="text" id="homework-name" placeholder="例如：藏在泥土的寶物">

      <label for="keyword">關鍵詞：</label>
      <input type="text" id="keyword" placeholder="例如：寶物">

      <label for="deadline">截止日期和時間（格式：年-月-日 時-分，例如 2025-04-24 23:59）：</label>
      <input type="text" id="deadline" placeholder="2025-04-24 23:59">
      <div id="deadline-error"></div>

      <button id="submit-btn">提交</button>

      <div class="homework-list" id="homework-list"></div>
    </div>
  </div>

  <!-- 確認視窗 -->
  <div id="confirm-modal" class="modal">
    <div class="modal-content">
      <h2>確認課業資料</h2>
      <p id="confirm-class"></p>
      <p id="confirm-category"></p>
      <p id="confirm-homework-name"></p>
      <p id="confirm-keyword"></p>
      <p id="confirm-deadline"></p>
      <div class="modal-buttons">
        <button id="confirm-btn">確定</button>
        <button id="cancel-btn">取消</button>
      </div>
    </div>
  </div>

  <script>
    // 載入班別選項並初始化頁面
    function loadClassesAndData() {
      google.script.run.withSuccessHandler(function(data) {
        const classSelect = document.getElementById('class-select');
        classSelect.innerHTML = '';
        data.classes.forEach(cls => {
          const option = document.createElement('option');
          option.value = cls;
          option.textContent = cls;
          classSelect.appendChild(option);
        });
        if (data.classes.length > 0) {
          loadHomeworkData(data.classes[0]);
        }
      }).getSpreadsheetData();
    }

    // 根據選中的班別載入課業資料
    function loadHomeworkData(className) {
      google.script.run.withSuccessHandler(function(data) {
        const homeworkList = document.getElementById('homework-list');
        homeworkList.innerHTML = '<h3>現有課業</h3>';
        const classData = data.homeworks[className] || { names: [], deadlines: [] };
        classData.names.forEach((name, index) => {
          const deadline = classData.deadlines[index] || '未設定';
          const div = document.createElement('div');
          div.className = 'homework-item';
          div.textContent = `${name} - 截止日期：${deadline}`;
          homeworkList.appendChild(div);
        });
      }).getSpreadsheetData();
    }

    // 頁面載入時初始化
    window.onload = loadClassesAndData;

    // 當班別改變時，更新課業列表
    document.getElementById('class-select').addEventListener('change', function() {
      loadHomeworkData(this.value);
    });

    // 截止日期輸入控制
    const deadlineInput = document.getElementById('deadline');
    const deadlineError = document.getElementById('deadline-error');

    function formatDeadlineInput() {
      let value = this.value.replace(/\D/g, ''); // 移除非數字字符
      let formatted = '';

      if (value.length > 0) {
        formatted += value.substr(0, 4); // 年份：4位
        if (value.length >= 5) {
          formatted += '-' + value.substr(4, 2); // 月：2位
        }
        if (value.length >= 7) {
          formatted += '-' + value.substr(6, 2); // 日：2位
        }
        if (value.length >= 9) {
          formatted += ' ' + value.substr(8, 2); // 時：2位
        }
        if (value.length >= 11) {
          formatted += ':' + value.substr(10, 2); // 分：2位
        }
      }

      this.value = formatted;
    }

    function restrictInput(event) {
      const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
      if (allowedKeys.includes(event.key)) {
        return;
      }
      if (!/\d/.test(event.key)) {
        event.preventDefault();
      }
    }

    function validateDeadline() {
      const value = this.value;
      const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
      if (!regex.test(value)) {
        deadlineError.textContent = '格式錯誤，請使用「年-月-日 時-分」，例如「2025-04-24 23:59」';
        return;
      }
      const parts = value.split(/[- :]/);
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 月份從 0 開始
      const day = parseInt(parts[2], 10);
      const hour = parseInt(parts[3], 10);
      const minute = parseInt(parts[4], 10);
      const date = new Date(year, month, day, hour, minute);
      if (isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) {
        deadlineError.textContent = '無效的日期或時間';
      } else {
        deadlineError.textContent = '';
      }
    }

    deadlineInput.addEventListener('input', formatDeadlineInput);
    deadlineInput.addEventListener('keydown', restrictInput);
    deadlineInput.addEventListener('blur', validateDeadline);

    // 提交按鈕事件
    document.getElementById('submit-btn').addEventListener('click', function() {
      const className = document.getElementById('class-select').value;
      const category = document.getElementById('category-select').value;
      const homeworkName = document.getElementById('homework-name').value.trim();
      const keyword = document.getElementById('keyword').value.trim();
      const deadline = document.getElementById('deadline').value.trim();

      // 驗證輸入
      if (!className || !category || !homeworkName || !keyword || !deadline) {
        alert('請填寫所有欄位');
        return;
      }

      if (!homeworkName.includes(keyword)) {
        alert('關鍵詞必須是課業名稱的一部分');
        return;
      }

      // 驗證截止日期格式
      const deadlineRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
      if (!deadlineRegex.test(deadline)) {
        alert('截止日期格式錯誤，請使用「年-月-日 時-分」，例如「2025-04-24 23:59」');
        return;
      }

      // 進一步驗證日期和時間是否有效
      const parts = deadline.split(/[- :]/);
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 月份從 0 開始
      const day = parseInt(parts[2], 10);
      const hour = parseInt(parts[3], 10);
      const minute = parseInt(parts[4], 10);
      const date = new Date(year, month, day, hour, minute);
      if (isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) {
        alert('無效的日期或時間');
        return;
      }

      // 顯示確認視窗
      document.getElementById('confirm-class').textContent = `班別：${className}`;
      document.getElementById('confirm-category').textContent = `課業類別：${category}`;
      document.getElementById('confirm-homework-name').textContent = `課業名稱：${homeworkName}`;
      document.getElementById('confirm-keyword').textContent = `關鍵詞：${keyword}`;
      document.getElementById('confirm-deadline').textContent = `截止日期：${deadline}`;
      document.getElementById('confirm-modal').style.display = 'block';
    });

    // 確認按鈕事件
    document.getElementById('confirm-btn').addEventListener('click', function() {
      const className = document.getElementById('class-select').value;
      const category = document.getElementById('category-select').value;
      const homeworkName = document.getElementById('homework-name').value.trim();
      const keyword = document.getElementById('keyword').value.trim();
      const deadline = document.getElementById('deadline').value.trim();

      // 格式化課業名稱
      const finalHomeworkName = `「${category}」${homeworkName.replace(keyword, `【${keyword}】`)}`;

      // 提交資料到試算表
      google.script.run.withSuccessHandler(function() {
        alert('課業已成功添加');
        document.getElementById('homework-name').value = '';
        document.getElementById('keyword').value = '';
        document.getElementById('deadline').value = '';
        loadHomeworkData(className);
        document.getElementById('confirm-modal').style.display = 'none';
      }).updateSpreadsheet(className, finalHomeworkName, deadline);
    });

    // 取消按鈕事件
    document.getElementById('cancel-btn').addEventListener('click', function() {
      document.getElementById('confirm-modal').style.display = 'none';
    });
  </script>
</body>
</html>



不設觸發器，由WEB APP啟動

功用：建立使用者介面，能連結到不同文件夾，亦可供用家查閱繳情況及佈置課業，介面較試算表美觀及易用。
方法：設計介面，並使試算表與HTML達至雙向數據同步。

相關文件夾ID：「待批改課業」文件夾
相關試算表ID：「繳交紀錄及課業佈置」試算表
相關連結：上傳課業Link（學生）、待批改課業、老師回饋區、已發還課業、record.html、homework.html、繳交課業及課業佈置




OverdueAssignments

Code.gs

const studentSpreadsheetId = '【自動共用、收集位址】';
const overdueSpreadsheetId = '【OverdueAssignments
】'; // 請替換為新的試算表 ID

function generateOverdueAssignments() {
  const spreadsheetId = '【繳交紀錄及課業佈置】';
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheets = spreadsheet.getSheets();
  
  // 從學生資料試算表獲取學號和姓名
  const studentSpreadsheet = SpreadsheetApp.openById(studentSpreadsheetId);
  const studentSheet = studentSpreadsheet.getSheetByName('Sheet1'); // 如果頁面名稱不同，請調整
  const studentData = studentSheet.getRange('A2:B' + studentSheet.getLastRow()).getValues();
  const studentMap = {};
  studentData.forEach(row => {
    const studentNumber = row[0];
    const studentName = row[1];
    const email = `${studentNumber}@ms.ccckyc.edu.hk`;
    studentMap[studentName] = email;
  });
  
  // 打開新的試算表並獲取或創建「Overdue Assignments」頁面
  const overdueSpreadsheet = SpreadsheetApp.openById(overdueSpreadsheetId);
  let overdueSheet = overdueSpreadsheet.getSheetByName('Overdue Assignments');
  if (!overdueSheet) {
    overdueSheet = overdueSpreadsheet.insertSheet('Overdue Assignments');
  }
  overdueSheet.clear();
  overdueSheet.appendRow(['班別', '學生姓名', '學生電郵', '課業名稱', '截止日期']);
  
  const currentDate = new Date();
  
  sheets.forEach(sheet => {
    const className = sheet.getRange('A1').getValue().toString().trim();
    if (!className) return;
    const lastColumn = sheet.getLastColumn();
    if (lastColumn < 2) return;
    const assignmentNames = sheet.getRange(1, 2, 1, lastColumn - 1).getValues()[0];
    const deadlines = sheet.getRange(2, 2, 1, lastColumn - 1).getValues()[0];
    const studentRange = sheet.getRange('A4:A' + sheet.getLastRow());
    const studentNames = studentRange.getValues().flat().filter(String);
    const statusRange = sheet.getRange(4, 2, studentNames.length, lastColumn - 1);
    const statuses = statusRange.getValues();
    
    studentNames.forEach((student, rowIndex) => {
      assignmentNames.forEach((assignment, colIndex) => {
        const status = statuses[rowIndex][colIndex];
        const deadlineStr = deadlines[colIndex];
        const deadline = new Date(deadlineStr);
        if (status === '未繳交' && currentDate > deadline) {
          const studentEmail = studentMap[student];
          if (studentEmail) {
            overdueSheet.appendRow([className, student, studentEmail, assignment, deadlineStr]);
          }
        }
      });
    });
  });
}



設觸發器generateOverdueAssignments，每分鐘觸發一次

功用：整理欠交名單，供AUTOMATE自動追收功課用
方法：在「繳交紀錄及課業佈置」得到逾期未交課業的學生名單（須滿足兩個條件：其一，未繳交課業；其二，已過截止日期和時間），將有用的資料傳送至「OverdueAssignments」試算表，繼而又對照「自動共用、收集址」試算表，得出學生的學號，由此推知學生MS電郵（即TEAMS帳號），供AUTOMATE自動追收功課時填寫收件者用。

相關文件夾ID：「待批改課業」文件夾
相關試算表ID：「繳交紀錄及課業佈置」試算表、「自動共用、收集
位址」試算表、「OverdueAssignments」試算表



















在MIRCOSOFT AUTOMATE建立自動化雲端流程

主要流程（排程的自動雲端）
 




RECURRENCE
 

取得工作表
 
取得多個資料列
 

FOR EACH
 
要用「/」取得動態內容
POST TEAMS MESSAGE
 
要用「/」才能引用GOOGLE SHEET內容。



