/**
 * KY Data Center Map - Apps Script backend
 * ==========================================
 * Serves the map's live data as JSON, processes new Google Form submissions,
 * geocodes addresses/Google Maps links, and sends email notifications.
 *
 * Publishing workflow: nothing a visitor submits goes live on the map
 * automatically. Every new regulation or project lands in its sheet tab
 * with Status = "Pending Review" (highlighted light yellow so it's easy to
 * spot). The map only ever shows rows marked Status = "Published". To
 * publish something, either change that row's Status cell by hand (there's
 * a dropdown) from "Pending Review" to "Published", or use the "Data
 * Center Map Admin > Review next pending item" menu inside the Sheet,
 * which shows one pending item at a time and lets you Approve, Reject, or
 * Skip it without hunting for the row yourself. Reported corrections to
 * existing entries land in the separate PendingReview tab instead, since
 * those are proposed edits to already-published rows, not new rows of
 * their own; apply them by hand in the relevant tab once reviewed.
 *
 * SETUP (do this once):
 * 1. Create a new Google Sheet, then open its Extensions > Apps Script
 *    menu to create this script project (this matters: doing it this way,
 *    rather than starting fresh at script.google.com, makes the script
 *    "container-bound" to the Sheet, which is what lets the admin menu
 *    below appear automatically every time the Sheet is opened). Paste
 *    in Code.gs, SetupForm.gs, and SetupSheetAndMigrateData.gs as
 *    separate files in that project.
 * 2. Run `setupSheetAndMigrateData()` from SetupSheetAndMigrateData.gs
 *    once, to create all the tabs, headers, data-validation dropdowns,
 *    and load in the map's current data.
 * 3. Paste this Sheet's ID (from its URL, the long string between /d/ and
 *    /edit) into SHEET_ID below.
 * 4. Build the two forms from SetupForm.gs: run `createAddForm()` once,
 *    then `createReportForm()` once. They're kept separate on purpose,
 *    adding something new and reporting a problem are different enough
 *    tasks to warrant their own forms rather than one long branching one.
 *    Link EACH form's responses to this same Sheet (Form > Responses >
 *    the green Sheets icon > select this Sheet).
 * 5. In the Apps Script editor: Triggers (clock icon) > Add Trigger:
 *      - onAddFormSubmit, event source "From spreadsheet", pick the ADD
 *        form's spreadsheet/sheet, event type "On form submit"
 *      - onReportFormSubmit, same but pointing at the REPORT form
 *      - checkExpiredMoratoria, time-driven, "Day timer", once a day
 *      - onOpen, event source "From spreadsheet", event type "On open"
 *        (only needed if step 1 wasn't done as container-bound; skip this
 *        if the admin menu already appears on its own when you open the
 *        Sheet)
 * 6. Deploy > New deployment > Web app. Execute as "Me", who has access
 *    "Anyone". Copy the deployment URL, that's what goes into
 *    index.html's DATA_SOURCE_URL constant. The two form public URLs go
 *    into index.html's ADD_FORM_URL and REPORT_FORM_URL constants.
 *
 * IMPORTANT: none of this has been run in a live Apps Script environment,
 * since Claude doesn't have access to one. Test each piece after pasting
 * it in, starting with `doGet()` (deploy, then visit the deployment URL
 * directly in a browser, you should see JSON).
 */

// ====== CONFIG, fill these in ======
const SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';
const NOTIFY_EMAIL = 'energy@mtassociation.org';

// ====== SHEET TAB NAMES ======
const REG_SHEET = 'Regulations';
const PROJ_SHEET = 'Projects';
const DC_SHEET = 'DCFacilities';
const PENDING_SHEET = 'PendingReview';
const CENTROID_SHEET = 'CountyCentroids';

const STATUS_PENDING = 'Pending Review';
const STATUS_PUBLISHED = 'Published';
const STATUS_REJECTED = 'Rejected';
const PENDING_ROW_COLOR = '#fff7cc'; // light yellow, so new rows stand out for review

// ==========================================================================
// WEB APP ENTRY POINT
// ==========================================================================
function doGet(e) {
  const data = buildMapData();
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildMapData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return {
    regulations: readPublishedRows(ss, REG_SHEET, rowToRegulation),
    projects: readPublishedRows(ss, PROJ_SHEET, rowToProject),
    otherDataCenters: readPublishedRows(ss, DC_SHEET, rowToDCFacility),
  };
}

function readPublishedRows(ss, sheetName, mapFn) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rec = rowToObject(headers, row);
    if (!rec.County && !rec.Name) continue; // skip blank rows
    if (rec.Status !== STATUS_PUBLISHED) continue; // only published rows reach the map
    out.push(mapFn(rec));
  }
  return out;
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

// ==========================================================================
// ROW -> MAP DATA SHAPE (matches index.html's embedded array field names)
// ==========================================================================
function rowToRegulation(rec) {
  return {
    county: String(rec.County || ''),
    city: String(rec.City || ''),
    level: String(rec.Level || ''),
    type: String(rec.Type || ''),
    startDate: formatDateField(rec.StartDate),
    period: String(rec.Period || ''),
    expiration: formatDateField(rec.Expiration),
    notes: String(rec.Notes || ''),
    lat: rec.Lat ? Number(rec.Lat) : null,
    lng: rec.Lng ? Number(rec.Lng) : null,
    address: String(rec.Address || ''),
    links: splitSources(rec.Sources),
  };
}

function rowToProject(rec) {
  return {
    name: String(rec.Name || ''),
    city: String(rec.City || ''),
    county: String(rec.County || ''),
    address: String(rec.Address || ''),
    size: String(rec.Size || ''),
    developer: String(rec.Developer || ''),
    pz: String(rec.PZ || ''),
    utility: String(rec.Utility || ''),
    links: splitSources(rec.Sources),
    notes: String(rec.Notes || ''),
    stage: String(rec.Stage || ''),
    countyWide: String(rec.CountyWide).toUpperCase() === 'TRUE',
    lat: rec.Lat ? Number(rec.Lat) : null,
    lng: rec.Lng ? Number(rec.Lng) : null,
    tariff: String(rec.Tariff || ''),
    completionDate: String(rec.CompletionDate || ''),
    tenant: String(rec.Tenant || ''),
  };
}

function rowToDCFacility(rec) {
  return {
    name: String(rec.Name || ''),
    operator: String(rec.Operator || ''),
    developer: String(rec.Developer || ''),
    status: String(rec.Status_Field || ''),
    size: String(rec.Size || ''),
    address: String(rec.Address || ''),
    city: String(rec.City || ''),
    county: String(rec.County || ''),
    lat: rec.Lat ? Number(rec.Lat) : null,
    lng: rec.Lng ? Number(rec.Lng) : null,
    link: String(rec.SourceLink || ''),
  };
}

function splitSources(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function formatDateField(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'America/New_York', 'M/d/yy'); // matches the map's existing convention
  }
  return String(val);
}

// ==========================================================================
// FORM SUBMISSION HANDLING
// ==========================================================================
/**
 * Attach as an "On form submit" trigger on the ADD form (see setup notes
 * at top). Expects that form's first question to be named exactly "What
 * would you like to add?" with the 2 options from createAddForm() in
 * SetupForm.gs.
 */
function onAddFormSubmit(e) {
  const responses = e.namedValues; // { "Question text": ["answer"] }
  const action = getAnswer(responses, 'What would you like to add?');

  let geocoded = null;
  const address = getAnswer(responses, 'Address (optional)');
  const mapsLink = getAnswer(responses, 'Google Maps link (optional)');
  const county = getAnswer(responses, 'County');
  if (address || mapsLink) {
    geocoded = geocodeFromAddressOrLink(address, mapsLink);
  }
  if (!geocoded && county) {
    geocoded = countyCentroid(county);
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);

  if (action.indexOf('A new Regulation') === 0) {
    appendRegulation(ss, responses, geocoded);
    notifySubmission('New regulation submitted, pending review', responses);
    const type = getAnswer(responses, 'Type');
    if (type && type.toLowerCase().indexOf('moratorium') !== -1) {
      notifyMoratoriumAdded(responses);
    }
  } else if (action.indexOf('A new Project') === 0) {
    appendProject(ss, responses, geocoded);
    notifySubmission('New project submitted, pending review', responses);
  }
}

/**
 * Attach as an "On form submit" trigger on the REPORT form (see setup
 * notes at top). Expects that form's first question to be named exactly
 * "What would you like to report a change to?" with the 3 options from
 * createReportForm() in SetupForm.gs.
 */
function onReportFormSubmit(e) {
  const responses = e.namedValues;
  const action = getAnswer(responses, 'What would you like to report a change to?');
  const ss = SpreadsheetApp.openById(SHEET_ID);

  let targetType = '';
  if (action.indexOf('A Regulation') === 0) targetType = 'Regulation';
  else if (action.indexOf('A Project') === 0) targetType = 'Project';
  else if (action.indexOf('A DC from datacentermap.com') === 0) targetType = 'DC facility';
  if (!targetType) return;

  appendPendingReview(ss, targetType, responses);
  notifySubmission('Change reported (' + targetType + '), pending review', responses);
}

function getAnswer(responses, question) {
  const val = responses[question];
  return val && val[0] ? val[0] : '';
}

function appendRegulation(ss, r, geocoded) {
  const sheet = ss.getSheetByName(REG_SHEET);
  sheet.appendRow([
    getAnswer(r, 'County'),
    getAnswer(r, 'City (optional)'),
    getAnswer(r, 'Is this county-wide, or specific to one city within the county?'),
    getAnswer(r, 'Type'),
    getAnswer(r, 'Start date'),
    getAnswer(r, 'Duration'),
    getAnswer(r, 'Expiration date (if known)'),
    getAnswer(r, 'Notes'),
    geocoded ? geocoded.lat : '',
    geocoded ? geocoded.lng : '',
    getAnswer(r, 'Address (optional)'),
    getAnswer(r, 'Source(s), one or more links'),
    STATUS_PENDING,
    false,
  ]);
  highlightLastRow(sheet);
}

function appendProject(ss, r, geocoded) {
  const sheet = ss.getSheetByName(PROJ_SHEET);
  sheet.appendRow([
    getAnswer(r, 'Project name'),
    getAnswer(r, 'City (optional)'),
    getAnswer(r, 'County'),
    getAnswer(r, 'Address (optional)'),
    getAnswer(r, 'Size/Capacity'),
    getAnswer(r, 'Developer'),
    getAnswer(r, 'Planning & zoning status'),
    getAnswer(r, 'Utility status'),
    getAnswer(r, 'Tariff'),
    getAnswer(r, 'Estimated completion date'),
    getAnswer(r, 'Tenant'),
    getAnswer(r, 'Source(s), one or more links'),
    getAnswer(r, 'Notes'),
    getAnswer(r, 'Stage'),
    addressOrLinkPresent(r) ? 'FALSE' : 'TRUE', // countyWide: true only if no exact site given
    geocoded ? geocoded.lat : '',
    geocoded ? geocoded.lng : '',
    STATUS_PENDING,
  ]);
  highlightLastRow(sheet);
}

function addressOrLinkPresent(r) {
  return !!(getAnswer(r, 'Address (optional)') || getAnswer(r, 'Google Maps link (optional)'));
}

function appendPendingReview(ss, targetType, r) {
  const sheet = ss.getSheetByName(PENDING_SHEET);
  sheet.appendRow([
    new Date(),
    targetType,
    getAnswer(r, 'Which one? (name or county)'),
    getAnswer(r, 'What needs to change?'),
    getAnswer(r, 'Source for this correction'),
    getAnswer(r, 'Your email (optional, in case we have questions)'),
  ]);
  highlightLastRow(sheet);
}

function highlightLastRow(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  sheet.getRange(lastRow, 1, 1, lastCol).setBackground(PENDING_ROW_COLOR);
}

/**
 * Lists everything still waiting on a decision, across all three tabs plus
 * the reported-change queue. Run this manually (Run > listPendingItems)
 * any time to check what needs attention, results show in the Execution
 * Log. Not wired to anything automatic, added since a running list is
 * easier to work from than scrolling every tab looking for yellow rows.
 */
function listPendingItems() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  [REG_SHEET, PROJ_SHEET, DC_SHEET].forEach(name => {
    const sheet = ss.getSheetByName(name);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const statusCol = headers.indexOf('Status');
    const nameCol = headers.indexOf('Name') >= 0 ? headers.indexOf('Name') : headers.indexOf('County');
    for (let i = 1; i < values.length; i++) {
      if (values[i][statusCol] === STATUS_PENDING) {
        Logger.log(name + ' row ' + (i + 1) + ': ' + values[i][nameCol] + ' (pending)');
      }
    }
  });
  const pendingSheet = ss.getSheetByName(PENDING_SHEET);
  const pendingCount = Math.max(0, pendingSheet.getLastRow() - 1);
  Logger.log('Reported changes waiting in PendingReview: ' + pendingCount);
}

// ==========================================================================
// ONE-BY-ONE REVIEW (custom Sheet menu)
// ==========================================================================
/**
 * Adds a menu to the Sheet itself when it's opened, so reviewing doesn't
 * require going into the Apps Script editor at all. This only fires
 * automatically if the script was opened via the Sheet's own Extensions >
 * Apps Script menu (making it container-bound). If you built this script
 * separately at script.google.com instead, add an installable "onOpen"
 * trigger pointing at this function (Triggers > Add Trigger > onOpen,
 * event source "From spreadsheet", event type "On open").
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Data Center Map Admin')
    .addItem('Review next pending item', 'reviewNextPendingItem')
    .addItem('List all pending items (log only)', 'listPendingItems')
    .addToUi();
}

/**
 * Finds the first row across Regulations, Projects, then DCFacilities
 * still marked "Pending Review" (checked in that order; rows are always
 * appended at the bottom, so within a tab this is already submission
 * order), shows its key fields in a dialog, and lets you Approve, Reject,
 * or Skip it right there. Click the menu item again for the next one,
 * this handles one at a time rather than looping through all of them in
 * a single run, so nothing happens without a person actively deciding it.
 */
function reviewNextPendingItem() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ui = SpreadsheetApp.getUi();

  const target = findFirstPendingRow(ss);
  if (!target) {
    ui.alert('Nothing pending', 'No items are currently waiting for review.', ui.ButtonSet.OK);
    return;
  }

  const summary = summarizeRowForReview(target.sheetName, target.headers, target.row);
  const response = ui.alert(
    'Review: ' + target.label,
    summary + '\n\nApprove this and publish it to the map?\n' +
    '(Yes = Approve & Publish, No = Reject, Cancel = Skip for now)',
    ui.ButtonSet.YES_NO_CANCEL
  );

  if (response === ui.Button.YES) {
    setRowStatus(target.sheet, target.rowIndex, target.statusCol, STATUS_PUBLISHED);
    ui.alert('Published. It will show on the map the next time it refreshes.');
  } else if (response === ui.Button.NO) {
    setRowStatus(target.sheet, target.rowIndex, target.statusCol, STATUS_REJECTED);
    ui.alert('Marked as rejected. It will not appear on the map.');
  }
  // CANCEL (Skip): leave it exactly as-is, still Pending Review, still highlighted.
}

function findFirstPendingRow(ss) {
  for (const sheetName of [REG_SHEET, PROJ_SHEET, DC_SHEET]) {
    const sheet = ss.getSheetByName(sheetName);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const statusCol = headers.indexOf('Status');
    const nameCol = headers.indexOf('Name') >= 0 ? headers.indexOf('Name') : headers.indexOf('County');
    for (let i = 1; i < values.length; i++) {
      if (values[i][statusCol] === STATUS_PENDING) {
        return {
          sheet: sheet,
          sheetName: sheetName,
          rowIndex: i + 1, // 1-indexed sheet row
          row: values[i],
          headers: headers,
          statusCol: statusCol,
          label: sheetName + ': ' + values[i][nameCol],
        };
      }
    }
  }
  return null;
}

function summarizeRowForReview(sheetName, headers, row) {
  // Show every non-empty field except Status/NotifiedExpired/Lat/Lng, so the
  // reviewer sees the actual submitted content without wading through
  // coordinates or bookkeeping columns.
  const skip = ['Status', 'NotifiedExpired', 'Lat', 'Lng'];
  const lines = [];
  headers.forEach((h, i) => {
    if (skip.indexOf(h) !== -1) return;
    if (row[i] === '' || row[i] === null || row[i] === undefined) return;
    lines.push(h + ': ' + row[i]);
  });
  return lines.join('\n');
}

function setRowStatus(sheet, rowIndex, statusCol, newStatus) {
  sheet.getRange(rowIndex, statusCol + 1).setValue(newStatus);
  const lastCol = sheet.getLastColumn();
  sheet.getRange(rowIndex, 1, 1, lastCol).setBackground(null); // clear the pending highlight
}

// ==========================================================================
// EMAIL NOTIFICATIONS
// ==========================================================================
function notifySubmission(subjectPrefix, responses) {
  const lines = Object.keys(responses).map(q => q + ': ' + responses[q][0]);
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'KY Data Center Map, ' + subjectPrefix,
    body: lines.join('\n'),
  });
}

function notifyMoratoriumAdded(r) {
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'KY Data Center Map, new moratorium submitted (pending review)',
    body: 'A new moratorium was just submitted for ' + getAnswer(r, 'County') +
          ' County. It will not appear on the map until its row in the ' +
          'Regulations sheet is changed from "Pending Review" to "Published".',
  });
}

/**
 * Run daily. Compares each PUBLISHED moratorium's Expiration date to
 * today (pending ones aren't live yet, so there's nothing to notify about
 * for those). The map itself already hides expired moratoria client-side
 * (dropExpiredMoratoria in index.html); this just sends the email the
 * first time each one crosses its expiration date, tracked via a
 * "NotifiedExpired" column so it doesn't re-send every day after.
 */
function checkExpiredMoratoria() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(REG_SHEET);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const expCol = headers.indexOf('Expiration');
  const typeCol = headers.indexOf('Type');
  const countyCol = headers.indexOf('County');
  const statusCol = headers.indexOf('Status');
  const notifiedCol = headers.indexOf('NotifiedExpired');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row[typeCol] !== 'Moratorium') continue;
    if (row[statusCol] !== STATUS_PUBLISHED) continue;
    if (row[notifiedCol] === true || row[notifiedCol] === 'TRUE') continue;
    const exp = row[expCol];
    if (!(exp instanceof Date)) continue;
    if (exp < today) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: 'KY Data Center Map, a moratorium has expired',
        body: 'The moratorium in ' + row[countyCol] + ' County expired on ' +
              Utilities.formatDate(exp, 'America/New_York', 'M/d/yyyy') + '.',
      });
      sheet.getRange(i + 1, notifiedCol + 1).setValue(true);
    }
  }
}

// ==========================================================================
// GEOCODING
// ==========================================================================
/**
 * Tries, in order: parsing lat/lng directly out of a Google Maps link,
 * then Apps Script's built-in geocoder on a typed address. Returns
 * {lat, lng} or null if neither worked.
 */
function geocodeFromAddressOrLink(address, mapsLink) {
  if (mapsLink) {
    const fromLink = parseGoogleMapsLink(mapsLink);
    if (fromLink) return fromLink;
  }
  if (address) {
    try {
      const result = Maps.newGeocoder().setRegion('us').geocode(address + ', KY');
      if (result.results && result.results.length) {
        const loc = result.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng };
      }
    } catch (err) {
      Logger.log('Geocoding failed for "' + address + '": ' + err);
    }
  }
  return null;
}

/**
 * Handles the common Google Maps URL shapes, e.g.
 *   https://www.google.com/maps/@37.123,-84.456,15z
 *   https://www.google.com/maps?q=37.123,-84.456
 *   https://maps.google.com/maps/place/.../@37.123,-84.456,17z
 * Does NOT resolve shortened goo.gl/maps.app.goo.gl links to their real
 * coordinates, Apps Script would need an extra UrlFetchApp.fetch() call
 * to follow the redirect, not implemented here. If you're pasting a
 * shortened link, expand it in a browser first and paste the full URL.
 */
function parseGoogleMapsLink(url) {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  return null;
}

/**
 * Fallback when there's no address/link at all: use the county's centroid,
 * the same coordinates the map already uses for "county-wide, exact site
 * unknown" projects. Reads from the CountyCentroids tab (pre-populated by
 * setupSheetAndMigrateData() from the map's own county_centroids.json data).
 */
function countyCentroid(countyName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(CENTROID_SHEET);
  const values = sheet.getDataRange().getValues();
  const key = String(countyName).trim().toLowerCase();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === key) {
      return { lat: Number(values[i][1]), lng: Number(values[i][2]) };
    }
  }
  return null;
}
