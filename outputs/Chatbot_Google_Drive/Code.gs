const SPREADSHEET_ID = '1yOg9Z8V4hDKEPuaNrNnADbxHj6ugBpl0m-ThaCgPbkQ';
const REGISTERED_IDS = ['mch','fmejia','macontreras','mmena','jvortiz','asmartinez','rcuellar','ecisneros','argonzalez','guvega','cescobar','lvergara','mdiosda','nangeles','eruvalcaba','jescobar','mquiroa','cyasmina','tbocanegra','bcastro','cpalacios','cromero','vjcid'];
const HEADERS = ['question_id','question','source','proposed_intent_id','proposed_intent','proposed_answer','answer_source','rating','corrected_intent_id','corrected_intent_name','new_intent','correct_answer','comment','reviewer','reviewed_at','server_saved_at'];

function doGet(e) {
  const view = e && e.parameter && e.parameter.view;
  let output;
  if (view === 'report' || view === 'reports') {
    const template = HtmlService.createTemplateFromFile('Reports');
    template.mode = view;
    template.reviewUrl = ScriptApp.getService().getUrl();
    output = template.evaluate();
  } else {
    const url = ScriptApp.getService().getUrl();
    const link = '<div style="padding:12px 20px;text-align:right;background:#eaf0e5"><a target="_top" style="color:#315b49;font-weight:600" href="' + url + '?view=reports">Preguntas reportadas por el chatbot →</a></div>';
    output = HtmlService.createHtmlOutput(HtmlService.createHtmlOutputFromFile('Index').getContent().replace(/<body([^>]*)>/i, '<body$1>' + link));
  }
  return output.setTitle('Revisión de preguntas y respuestas BDCV').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function sheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Reviews');
  if (!sheet) throw new Error('No existe la pestaña Reviews.');
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (actual.some((v, i) => v !== HEADERS[i])) throw new Error('Los encabezados de Reviews fueron modificados.');
  return sheet;
}

function text_(value) { return String(value == null ? '' : value).trim(); }
function registeredReviewer_(value) {
  const id = text_(value).toLowerCase();
  if (!REGISTERED_IDS.includes(id)) throw new Error('Usuario no registrado.');
  return id;
}
function validateReviewer(id) { return {ok:true, id:registeredReviewer_(id)}; }
function key_(record) { return JSON.stringify([text_(record.reviewer).toLowerCase(), text_(record.question_id)]); }
function cell_(value) {
  const s = String(value == null ? '' : value);
  if (s.length > 45000) throw new Error('Un campo supera el tamaño permitido.');
  return /^\s*[=+@-]/.test(s) ? "'" + s : s;
}
function validate_(r) {
  if (!r || !/^(CAN-\d{3}|Q-\d{4}|REP-[a-f0-9-]{36})$/.test(text_(r.question_id))) throw new Error('Pregunta no válida.');
  if (!['green', 'yellow', 'red'].includes(r.rating)) throw new Error('Evaluación no válida.');
  registeredReviewer_(r.reviewer);
  if (!Number.isFinite(Date.parse(r.reviewed_at))) throw new Error('Fecha de evaluación no válida.');
  if (r.rating !== 'red' && !text_(r.correct_answer)) throw new Error('Falta la respuesta correcta.');
  if (r.rating === 'red' && !text_(r.corrected_intent_id)) throw new Error('Falta la intención correcta.');
  if (r.corrected_intent_id === '__NEW__' && !text_(r.new_intent)) throw new Error('Falta el nombre de la nueva intención.');
  HEADERS.forEach(h => cell_(r[h]));
}

function saveReview(record) {
  return saveReviews([record]);
}

// Updates one row per reviewer and question. A script lock serializes writes.
function saveReviews(records) {
  if (!Array.isArray(records) || !records.length || records.length > 50) throw new Error('Envía entre 1 y 50 evaluaciones.');
  records.forEach(validate_);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = sheet_();
    const count = sheet.getLastRow() - 1;
    const rows = count > 0 ? sheet.getRange(2, 1, count, HEADERS.length).getValues() : [];
    const index = new Map(rows.map((row, i) => [key_({question_id:row[0], reviewer:row[13]}), i]));
    const now = new Date().toISOString();
    for (const record of records) {
      const key = key_(record);
      const i = index.get(key);
      // A late retry must not overwrite a more recent review.
      if (i !== undefined && Date.parse(rows[i][14]) > Date.parse(record.reviewed_at)) {
        throw new Error('Google Sheets tiene una evaluación más reciente. Usa Cargar mis evaluaciones antes de volver a guardar.');
      }
      const clean = {...record, reviewer:registeredReviewer_(record.reviewer), server_saved_at:now};
      const row = HEADERS.map(h => cell_(clean[h]));
      if (i === undefined) { index.set(key, rows.length); rows.push(row); }
      else rows[i] = row;
    }
    // Write only changed rows, preserving unrelated sheet edits.
    for (const key of new Set(records.map(key_))) {
      const i = index.get(key);
      const rowNumber = i + 2;
      if (rowNumber > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), rowNumber - sheet.getMaxRows());
      sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([rows[i]]);
    }
    SpreadsheetApp.flush();
    return {ok:true, count:records.length, server_saved_at:now};
  } finally { lock.releaseLock(); }
}

function getReviews(reviewer) {
  const name = registeredReviewer_(reviewer);
  const sheet = sheet_();
  const count = sheet.getLastRow() - 1;
  if (count <= 0) return {};
  const out = {};
  sheet.getRange(2, 1, count, HEADERS.length).getValues().forEach(row => {
    if (text_(row[13]).toLowerCase() !== name || !/^(CAN-\d{3}|Q-\d{4})$/.test(text_(row[0]))) return;
    const r = Object.fromEntries(HEADERS.map((h, i) => [h, row[i] instanceof Date ? row[i].toISOString() : String(row[i] == null ? '' : row[i])]));
    out[r.question_id] = r;
  });
  return out;
}

const REPORT_HEADERS = ['report_id','question','ai_answer','reason','reported_at','status','reviewed_by','reviewed_at','rating','corrected_intent_id','corrected_intent_name','new_intent','correct_answer','comment'];
function reportsSheet_() {
  const book = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = book.getSheetByName('Reports');
  if (!sheet) {
    sheet = book.insertSheet('Reports');
    sheet.getRange(1,1,1,REPORT_HEADERS.length).setValues([REPORT_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,REPORT_HEADERS.length).setBackground('#315b49').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setColumnWidth(2,400); sheet.setColumnWidth(3,500); sheet.setColumnWidth(4,300);
  }
  const headers = sheet.getRange(1,1,1,REPORT_HEADERS.length).getValues()[0];
  if (headers.some((v,i)=>v !== REPORT_HEADERS[i])) throw new Error('Los encabezados de Reports fueron modificados.');
  return sheet;
}
function reportRows_(sheet) {
  return sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,REPORT_HEADERS.length).getValues() : [];
}
function reportObject_(row) {
  return Object.fromEntries(REPORT_HEADERS.map((h,i)=>[h,row[i] instanceof Date ? row[i].toISOString() : String(row[i] == null ? '' : row[i])]));
}
function submitQuestionReport(record) {
  if (!record || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(text_(record.report_id))) throw new Error('Reporte no válido.');
  if (!text_(record.question) || !text_(record.ai_answer)) throw new Error('Faltan la pregunta o la respuesta.');
  if (String(record.question).length > 4000 || String(record.ai_answer).length > 30000 || String(record.reason || '').length > 1000) throw new Error('El reporte supera el tamaño permitido.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = reportsSheet_();
    const existing = reportRows_(sheet).find(row=>String(row[0])===record.report_id);
    if (existing) return {ok:true,report_id:record.report_id};
    const clean = {report_id:record.report_id,question:record.question,ai_answer:record.ai_answer,reason:record.reason || '',reported_at:new Date().toISOString(),status:'pending'};
    sheet.appendRow(REPORT_HEADERS.map(h=>cell_(clean[h])));
    SpreadsheetApp.flush();
    return {ok:true,report_id:record.report_id};
  } finally {lock.releaseLock();}
}
function getReportedQuestions(reviewer) {
  registeredReviewer_(reviewer);
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {return reportRows_(reportsSheet_()).map(reportObject_).reverse();}
  finally {lock.releaseLock();}
}
function saveReportedReview(record) {
  const reviewer=registeredReviewer_(record && record.reviewer);
  const sheet=reportsSheet_();
  const row=reportRows_(sheet).find(r=>String(r[0])===text_(record.report_id));
  if (!row) throw new Error('No se encontró el reporte.');
  const report=reportObject_(row);
  const review={...record,question_id:'REP-'+report.report_id,question:report.question,source:'Chatbot report',proposed_intent_id:'',proposed_intent:'',proposed_answer:report.ai_answer,answer_source:'Gemini sandbox',reviewer:reviewer,reviewed_at:new Date().toISOString()};
  if (review.rating==='green') review.correct_answer=report.ai_answer;
  saveReview(review);
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const rows=reportRows_(sheet);
    const i=rows.findIndex(r=>String(r[0])===report.report_id);
    const current=reportObject_(rows[i]);
    const updated={...current,status:'reviewed',reviewed_by:reviewer,reviewed_at:review.reviewed_at};
    ['rating','corrected_intent_id','corrected_intent_name','new_intent','correct_answer','comment'].forEach(h=>updated[h]=review[h] || '');
    sheet.getRange(i+2,1,1,REPORT_HEADERS.length).setValues([REPORT_HEADERS.map(h=>cell_(updated[h]))]);
    SpreadsheetApp.flush(); return {ok:true};
  } finally {lock.releaseLock();}
}
