const SPREADSHEET_ID = '1yOg9Z8V4hDKEPuaNrNnADbxHj6ugBpl0m-ThaCgPbkQ';
const HEADERS = ['question_id','question','source','proposed_intent_id','proposed_intent','proposed_answer','answer_source','rating','corrected_intent_id','corrected_intent_name','new_intent','correct_answer','comment','reviewer','reviewed_at','server_saved_at'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Revisión de preguntas y respuestas BDCV')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function sheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Reviews');
  if (!sheet) throw new Error('No existe la pestaña Reviews.');
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (actual.some((v, i) => v !== HEADERS[i])) throw new Error('Los encabezados de Reviews fueron modificados.');
  return sheet;
}

function text_(value) { return String(value == null ? '' : value).trim(); }
function key_(record) { return JSON.stringify([text_(record.reviewer).toLowerCase(), text_(record.question_id)]); }
function cell_(value) {
  const s = String(value == null ? '' : value);
  if (s.length > 45000) throw new Error('Un campo supera el tamaño permitido.');
  return /^\s*[=+@-]/.test(s) ? "'" + s : s;
}
function validate_(r) {
  if (!r || !/^(CAN-\d{3}|Q-\d{4})$/.test(text_(r.question_id))) throw new Error('Pregunta no válida.');
  if (!['green', 'yellow', 'red'].includes(r.rating)) throw new Error('Evaluación no válida.');
  if (!text_(r.reviewer)) throw new Error('Escribe tu nombre o iniciales.');
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
      const clean = {...record, reviewer:text_(record.reviewer), server_saved_at:now};
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
  const name = text_(reviewer).toLowerCase();
  if (!name) throw new Error('Escribe tu nombre o iniciales.');
  const sheet = sheet_();
  const count = sheet.getLastRow() - 1;
  if (count <= 0) return {};
  const out = {};
  sheet.getRange(2, 1, count, HEADERS.length).getValues().forEach(row => {
    if (text_(row[13]).toLowerCase() !== name) return;
    const r = Object.fromEntries(HEADERS.map((h, i) => [h, row[i] instanceof Date ? row[i].toISOString() : String(row[i] == null ? '' : row[i])]));
    out[r.question_id] = r;
  });
  return out;
}
