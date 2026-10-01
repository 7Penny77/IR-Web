/**
 * 各系所減授評估｜Google Apps Script
 *
 * 使用方式：
 * 1. 建立一份 Google 試算表，開啟「擴充功能 → Apps Script」。
 * 2. 將本檔內容貼入 Apps Script。
 * 3. 部署 → 新增部署 → 網頁應用程式。
 * 4. 執行身分選「我」，誰可以存取依校內需求設定。
 * 5. 將部署後的 Web App URL 填入網站 evaluation.js：
 *    const EVALUATION_GOOGLE_APPS_SCRIPT_URL = '你的 Web App URL';
 */

const SUMMARY_SHEET_NAME = 'Analysis';
const COURSE_SHEET_NAME = 'Course Details';

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'NTPU evaluation endpoint is running.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const summarySheet = getOrCreateSheet_(ss, SUMMARY_SHEET_NAME);
    const courseSheet = getOrCreateSheet_(ss, COURSE_SHEET_NAME);
    const submissionId = Utilities.getUuid();

    ensureHeaders_(summarySheet, [
      'Submission ID', '提交時間', '學年度', '學院', '系所', '姓名', '減授措施',
      '教授人數', '副教授人數', '助理教授人數', '講師人數', '兼任教師人數', '兼任教師每人授課時數',
      '教授每人授課時數', '副教授每人授課時數', '助理教授每人授課時數', '講師每人授課時數',
      '必修總學分', '選修總學分', '通識總學分', '支援外系總學分', '彈性調整總學分',
      '總供給時數', '總需求時數', '供需差額', '評估'
    ]);

    const counts = payload.teacherCounts || {};
    const hours = payload.teachingHoursAfterReduction || {};
    summarySheet.appendRow([
      submissionId,
      payload.submittedAt || new Date().toISOString(),
      payload.academicYear || '',
      payload.college || '',
      payload.department || '',
      payload.name || '',
      payload.reduction || '',
      counts.professor || 0,
      counts.associate || 0,
      counts.assistant || 0,
      counts.lecturer || 0,
      counts.adjunct || 0,
      counts.adjunctHours || 0,
      hours.professor || 0,
      hours.associate || 0,
      hours.assistant || 0,
      hours.lecturer || 0,
      payload.requiredTotalCredits || 0,
      payload.electiveTotalCredits || 0,
      payload.generalTotalCredits || 0,
      payload.supportTotalCredits || 0,
      payload.flexibleTotalCredits || 0,
      payload.totalSupplyHours || 0,
      payload.totalDemandHours || 0,
      payload.difference || 0,
      payload.evaluation || ''
    ]);

    ensureHeaders_(courseSheet, [
      'Submission ID', '學年度', '學院', '系所', '姓名', '類別', '年級', '課程名稱', '學分', '開課總門數', '課程總學分'
    ]);

    const details = Array.isArray(payload.courseDetails) ? payload.courseDetails : [];
    if (details.length) {
      const values = details.map(course => [
        submissionId,
        payload.academicYear || '',
        payload.college || '',
        payload.department || '',
        payload.name || '',
        course.category || '',
        course.grade || '',
        course.courseName || '',
        course.credits ?? '',
        course.sections ?? '',
        course.totalCredits ?? ''
      ]);
      courseSheet.getRange(courseSheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, submissionId }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}
