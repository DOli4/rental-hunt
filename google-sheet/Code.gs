/**
 * Rental Hunt – shared saves backend (Google Apps Script bound to a Google Sheet in your Drive).
 *
 * Stores the "interested" marks, status, phone numbers, emails, viewing dates and notes that
 * you and your partner add on the website. Everything lives in the sheet's "track" tab,
 * so you can also open the sheet in Google Drive and see/edit it directly.
 *
 * Setup: see google-sheet/SETUP.md
 */

const SHEET = 'track';
const COLS = ['id', 'status', 'phone', 'email', 'note', 'viewing', 'updatedBy', 'updatedAt'];

/** Run once from the editor (Run > setup) after typing your passcode below. */
function setup() {
  const PASSCODE = 'change-me';            // <- choose a passcode you'll share with your partner
  PropertiesService.getScriptProperties().setProperty('PASSCODE', PASSCODE);
  sheet_();
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function ok_(pass) {
  const want = PropertiesService.getScriptProperties().getProperty('PASSCODE');
  return want && pass === want;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function rows_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, COLS.length).getValues().map(r => {
    const o = {};
    COLS.forEach((c, i) => { o[c] = r[i] instanceof Date ? r[i].toISOString() : String(r[i] ?? ''); });
    return o;
  }).filter(o => o.id);
}

/** GET ?pass=...  -> { ok: true, rows: [...] } */
function doGet(e) {
  const pass = (e && e.parameter && e.parameter.pass) || '';
  if (!ok_(pass)) return json_({ ok: false, error: 'wrong_passcode' });
  return json_({ ok: true, rows: rows_() });
}

/** POST (text/plain JSON) { pass, id, patch: {status, phone, ...}, by } -> { ok: true, row } */
function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  if (!ok_(body.pass)) return json_({ ok: false, error: 'wrong_passcode' });
  const id = String(body.id || '').trim();
  if (!/^[\w.:@+~-]{1,120}$/.test(id)) return json_({ ok: false, error: 'bad_id' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    let rowIdx = ids.indexOf(id);
    let cur = {};
    if (rowIdx >= 0) {
      const vals = sh.getRange(rowIdx + 2, 1, 1, COLS.length).getValues()[0];
      COLS.forEach((c, i) => cur[c] = vals[i]);
    }
    const patch = body.patch || {};
    const next = Object.assign({}, cur, { id });
    ['status', 'phone', 'email', 'note', 'viewing'].forEach(k => {
      if (k in patch) next[k] = String(patch[k] ?? '').slice(0, 4000);
    });
    next.updatedBy = String(body.by || '').slice(0, 40);
    next.updatedAt = new Date().toISOString();
    const out = COLS.map(c => next[c] ?? '');
    if (rowIdx >= 0) sh.getRange(rowIdx + 2, 1, 1, COLS.length).setValues([out]);
    else sh.appendRow(out);
    return json_({ ok: true, row: next });
  } finally {
    lock.releaseLock();
  }
}
