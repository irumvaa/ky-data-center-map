/**
 * KY Data Center Map — Apps Script backend
 * ==========================================
 * Serves the map's live data as JSON, processes new Google Form submissions,
 * geocodes addresses/Google Maps links, and sends email notifications.
 *
 * SETUP (do this once):
 * 1. Create a new Google Sheet. Run `setupSheet()` from this script once
 *    (Run > setupSheet) to create all the tabs and headers automatically.
 * 2. Paste this Sheet's ID (from its URL, the long string between /d/ and
 *    /edit) into SHEET_ID below.
 * 3. Build the Form using SetupForm.gs (run `createForm()` once — see that
 *    file for details), then link its responses to this same Sheet
 *    (Form > Responses > the green Sheets icon > select this Sheet).
 * 4. In the Apps Script editor: Triggers (clock icon) > Add Trigger:
 *      - onFormSubmitHandler, event source "From spreadsheet", event type
 *        "On form submit"
 *      - checkExpiredMoratoria, time-driven, "Day timer", once a day
 *      - sendMonthlyVisitReportIfFirstMonday, time-driven, "Week timer",
 *        every Monday
 * 5. Deploy > New deployment > Web app. Execute as "Me", who has access
 *    "Anyone". Copy the deployment URL — that's what goes into
 *    index.html's DATA_SOURCE_URL constant. The same URL with
 *    "?action=visit" appended is what the map pings to count a visit.
 *
 * IMPORTANT: none of this has been run in a live Apps Script environment,
 * since Claude doesn't have access to one. Test each piece after pasting
 * it in, starting with `doGet()` (deploy, then visit the deployment URL
 * directly in a browser — you should see JSON).
 */

// ====== CONFIG — fill these in ======
const SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';
const NOTIFY_EMAIL = 'energy@mtassociation.org';

// ====== SHEET TAB NAMES ======
const REG_SHEET = 'Regulations';
const PROJ_SHEET = 'Projects';
const DC_SHEET = 'DCFacilities';
const PENDING_SHEET = 'PendingReview';
const VISIT_SHEET = 'VisitLog';
const CENTROID_SHEET = 'CountyCentroids';
const FORM_RESPONSES_SHEET = 'Form Responses 1'; // Google's default name — check yours matches

// ==========================================================================
// WEB APP ENTRY POINT
// ==========================================================================
function doGet(e) {
  const action = e.parameter && e.parameter.action;
  if (action === 'visit') {
    logVisit();
    return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
  }
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
    if (rec.Status && rec.Status !== 'Published') continue; // skip pending/rejected rows
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
    status: String(rec.Status_Field || rec.FacilityStatus || ''), // see note in setupSheet()
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
    // Matches the map's existing M/D/YY convention
    return Utilities.formatDate(val, 'America/New_York', 'M/d/yy');
  }
  return String(val);
}

// ==========================================================================
// VISIT COUNTING
// ==========================================================================
function logVisit() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(VISIT_SHEET);
  sheet.appendRow([new Date()]);
}

/**
 * Run this daily is fine, but it's designed to be triggered weekly on
 * Mondays (Apps Script has no native "1st Monday of month" trigger type,
 * so this checks that condition itself and only sends when it's true).
 */
function sendMonthlyVisitReportIfFirstMonday() {
  const now = new Date();
  const isMonday = now.getDay() === 1;
  const isFirstWeek = now.getDate() <= 7;
  if (!isMonday || !isFirstWeek) return;

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(VISIT_SHEET);
  const values = sheet.getDataRange().getValues();
  const totalVisits = Math.max(0, values.length - 1); // minus header row, if you added one

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'KY Data Center Map — monthly visit count',
    body: 'Total visits recorded so far: ' + totalVisits,
  });
}

// ==========================================================================
// FORM SUBMISSION HANDLING
// ==========================================================================
/**
 * Attach this as an "On form submit" trigger (see setup notes at top).
 * Expects the form's first question to be named exactly "What would you
 * like to do?" with the 5 options listed in SetupForm.gs — this is how
 * submissions get routed to the right sheet tab.
 */
function onFormSubmitHandler(e) {
  const responses = e.namedValues; // { "Question text": ["answer"] }
  const action = getAnswer(responses, 'What would you like to do?');

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

  if (action === 'Add a new Regulation') {
    appendRegulation(ss, responses, geocoded);
    notifySubmission('New regulation submitted', responses);
    const type = getAnswer(responses, 'Type');
    if (type && type.toLowerCase().indexOf('moratorium') !== -1) {
      notifyMoratoriumAdded(responses);
    }
  } else if (action === 'Add a new Project') {
    appendProject(ss, responses, geocoded);
    notifySubmission('New project submitted', responses);
  } else if (action && action.indexOf('Report a change') === 0) {
    appendPendingReview(ss, action, responses);
    notifySubmission('Change reported (pending review)', responses);
  }
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
    getAnswer(r, 'Is this county-wide, city-level, or both?'),
    getAnswer(r, 'Type'),
    getAnswer(r, 'Start date'),
    getAnswer(r, 'Duration'),
    getAnswer(r, 'Expiration date (if known)'),
    getAnswer(r, 'Notes'),
    geocoded ? geocoded.lat : '',
    geocoded ? geocoded.lng : '',
    getAnswer(r, 'Address (optional)'),
    getAnswer(r, 'Source(s) — one or more links'),
    'Published',
  ]);
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
    getAnswer(r, 'Source(s) — one or more links'),
    getAnswer(r, 'Notes'),
    getAnswer(r, 'Stage'),
    address_or_link_present(r) ? 'FALSE' : 'TRUE', // countyWide: true only if no exact site given
    geocoded ? geocoded.lat : '',
    geocoded ? geocoded.lng : '',
    'Published',
  ]);
}

function address_or_link_present(r) {
  return !!(getAnswer(r, 'Address (optional)') || getAnswer(r, 'Google Maps link (optional)'));
}

function appendPendingReview(ss, action, r) {
  const sheet = ss.getSheetByName(PENDING_SHEET);
  sheet.appendRow([
    new Date(),
    action,
    getAnswer(r, 'Which one? (name or county)'),
    getAnswer(r, 'What needs to change?'),
    getAnswer(r, 'Source for this correction'),
    getAnswer(r, 'Your email (optional, in case we have questions)'),
  ]);
}

// ==========================================================================
// EMAIL NOTIFICATIONS
// ==========================================================================
function notifySubmission(subjectPrefix, responses) {
  const lines = Object.keys(responses).map(q => q + ': ' + responses[q][0]);
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'KY Data Center Map — ' + subjectPrefix,
    body: lines.join('\n'),
  });
}

function notifyMoratoriumAdded(r) {
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'KY Data Center Map — new moratorium added',
    body: 'A new moratorium was just submitted for ' + getAnswer(r, 'County') +
          ' County. Check the Regulations sheet to review it.',
  });
}

/**
 * Run daily. Compares each regulation's Expiration date to today; the map
 * itself already hides expired moratoria client-side (dropExpiredMoratoria
 * in index.html), this just sends the email the first time each one crosses
 * its expiration date, tracked via a "NotifiedExpired" column so it doesn't
 * re-send every day after.
 */
function checkExpiredMoratoria() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(REG_SHEET);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const expCol = headers.indexOf('Expiration');
  const typeCol = headers.indexOf('Type');
  const countyCol = headers.indexOf('County');
  const notifiedCol = headers.indexOf('NotifiedExpired');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row[typeCol] !== 'Moratorium') continue;
    if (row[notifiedCol] === true || row[notifiedCol] === 'TRUE') continue;
    const exp = row[expCol];
    if (!(exp instanceof Date)) continue;
    if (exp < today) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: 'KY Data Center Map — a moratorium has expired',
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
 * coordinates — Apps Script would need an extra UrlFetchApp.fetch() call
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
 * setupSheet() from the map's own county_centroids.json data).
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
