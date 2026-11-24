/**
 * One-time source fixes, Nov 24, 2026.
 * Run applySourceFixes() once from the Apps Script editor. It only edits the
 * specific rows named below, logs every change, and is safe to run twice
 * (it skips anything already applied). It does NOT touch Status, so published
 * rows stay published. Delete this file afterwards if you like.
 *
 * Not included on purpose (Chris's decisions): Silica removal, "unconfirmed"
 * labels, Rockcastle, Meade, Letcher, Calloway and the unverified counties.
 */
function applySourceFixes() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const log = [];

  // ---- Regulations ----
  const reg = ss.getSheetByName(REG_SHEET);
  let r = findRow_(reg, function (rec) { return rec.County === 'Oldham'; });
  if (r) {
    setCell_(reg, r, 'Expiration', '', log, 'Oldham: cleared Expiration (moratorium runs until regulations are adopted)');
    setCell_(reg, r, 'Period', 'Until data center regulations are adopted (original 150-day moratorium, passed July 2025, was extended Nov 18, 2025)', log, 'Oldham: Period');
    setCell_(reg, r, 'NotifiedExpiringSoon', '', log, 'Oldham: reset expiry email flag');
    addSources_(reg, r, ['https://www.wkms.org/2025-07-02/oldham-county-passes-sweeping-data-center-moratorium-executive-fired-over-recording', 'https://ground.news/article/court-halts-data-center-development-until-regulations-ready'], log, 'Oldham');
    appendNote_(reg, r, 'On Nov 18, 2025 the fiscal court approved a new moratorium that lasts until county data center regulations are approved. No fixed end date.', log, 'Oldham');
  } else log.push('Oldham regulation row NOT FOUND');

  r = findRow_(reg, function (rec) { return rec.County === 'Woodford' && rec.City === 'Versailles'; });
  if (r) setCell_(reg, r, 'Period', 'Through Dec 31, 2026', log, 'Woodford (Versailles): Period');
  else log.push('Woodford/Versailles regulation row NOT FOUND');

  // ---- Projects ----
  const proj = ss.getSheetByName(PROJ_SHEET);
  r = findRow_(proj, function (rec) { return rec.Name === 'West Point'; });
  if (r) {
    setCell_(proj, r, 'Developer', 'Not named. Owners of the Holloway property, per city council minutes', log, 'West Point: Developer');
    setCell_(proj, r, 'Size', 'About 150 acres, per city council minutes (earlier note said 360)', log, 'West Point: Size');
    setCell_(proj, r, 'Notes', 'West Point city council minutes (Aug 11, 2025): the owners of the Holloway property are exploring a data center on roughly 150 acres, a potential $1 billion investment. The developer is not named. More information is still needed.', log, 'West Point: Notes');
    addSources_(proj, r, ['https://westpoint.ky.gov/our-city/2025%20Meeting%20Minutes/August%2011%2C%202025%20Meeting%20Minutes.pdf'], log, 'West Point');
  } else log.push('West Point project row NOT FOUND');

  r = findRow_(proj, function (rec) { return rec.Name === 'Maysville'; });
  if (r) {
    setCell_(proj, r, 'Developer', 'Reported as Meta (Data Center Dynamics); earlier reporting said undisclosed', log, 'Maysville: Developer');
    replaceSource_(proj, r, 'https://www.courier-journal.com', ['https://www.weku.org/the-commonwealth/2026-05-26/mason-county-gives-final-approval-on-rezoning-properties-for-data-center-construction', 'https://datacenterdynamics.com/en/news/meta-named-as-company-behind-3000-acre-data-center-project-in-mason-county-kentucky'], log, 'Maysville');
    appendNote_(proj, r, 'Data Center Dynamics reports Meta as the company behind the campus (almost 3,000 acres, up to 2.2 GW, 40-year local tax break). WEKU (May 2026) still described the developer as undisclosed.', log, 'Maysville');
  } else log.push('Maysville project row NOT FOUND');

  r = findRow_(proj, function (rec) { return rec.Name === 'Bullitt County'; });
  if (r) {
    replaceSource_(proj, r, 'Bullitt County passes 1-year pause on data center development', ['https://spectrumnews1.com/ky/louisville/news/2026/07/21/bullitt-county-data-center-moratorium'], log, 'Bullitt County project');
  } else log.push('Bullitt County project row NOT FOUND');

  // ---- New regulation (pending review, not published) ----
  if (!findRow_(reg, function (rec) { return rec.County === 'Edmonson'; })) {
    const c = countyCentroid('Edmonson');
    appendRegulation(ss, {
      county: 'Edmonson', city: '', level: 'County', type: 'Moratorium',
      startDate: '6/8/26', duration: '1 year', expiration: '6/8/27',
      address: '',
      sources: 'https://www.wnky.com/?p=2656863',
      notes: 'Ordinance EC26-18 adopted June 8, 2026, effective immediately, for one year unless the fiscal court repeals, amends or extends it.',
    }, c);
    log.push('Edmonson: added as Pending Review (approve it from the admin menu to publish)');
  } else log.push('Edmonson already present, skipped');

  Logger.log(log.join('\n'));
  try { SpreadsheetApp.getUi().alert('Done. ' + log.length + ' log lines. See View > Logs / Executions.'); } catch (e) {}
}

function colIndex_(sheet, name) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(name) + 1; // 0 if missing
}
function findRow_(sheet, test) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  for (let i = 1; i < values.length; i++) {
    const rec = {};
    headers.forEach(function (h, j) { rec[h] = values[i][j]; });
    if (test(rec)) return i + 1;
  }
  return 0;
}
function setCell_(sheet, row, name, value, log, label) {
  const col = colIndex_(sheet, name);
  if (!col) { log.push(label + ': column "' + name + '" missing, skipped'); return; }
  const cell = sheet.getRange(row, col);
  if (String(cell.getValue()) === String(value)) { log.push(label + ': already set'); return; }
  cell.setValue(value);
  log.push(label + ': updated');
}
function appendNote_(sheet, row, text, log, label) {
  const col = colIndex_(sheet, 'Notes');
  const cell = sheet.getRange(row, col);
  const cur = String(cell.getValue() || '');
  if (cur.indexOf(text) !== -1) { log.push(label + ': note already present'); return; }
  cell.setValue(cur ? cur + ' ' + text : text);
  log.push(label + ': note added');
}
function addSources_(sheet, row, urls, log, label) {
  const col = colIndex_(sheet, 'Sources');
  const cell = sheet.getRange(row, col);
  const cur = splitSources(cell.getValue());
  let added = 0;
  urls.forEach(function (u) { if (cur.indexOf(u) === -1) { cur.push(u); added++; } });
  if (added) cell.setValue(cur.join('\n'));
  log.push(label + ': ' + added + ' source(s) added');
}
function replaceSource_(sheet, row, oldVal, newUrls, log, label) {
  const col = colIndex_(sheet, 'Sources');
  const cell = sheet.getRange(row, col);
  let cur = splitSources(cell.getValue());
  const had = cur.indexOf(oldVal) !== -1;
  cur = cur.filter(function (s) { return s !== oldVal; });
  newUrls.forEach(function (u) { if (cur.indexOf(u) === -1) cur.push(u); });
  cell.setValue(cur.join('\n'));
  log.push(label + ': sources ' + (had ? 'replaced' : 'added (old one not found)'));
}
