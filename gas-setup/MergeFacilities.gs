/**
 * KY Data Center Map: merge the datacentermap.com facilities into the
 * main Projects tab
 * ============================================================
 * Run `mergeFacilitiesIntoProjects()` ONCE from the Apps Script editor
 * (pick it in the function dropdown, then Run). What it does:
 *
 *   1. Adds two columns to the END of the Projects tab if they are not
 *      there yet: Category and Verification. (They go at the end so the
 *      Form and appendProject() keep working unchanged.)
 *   2. Copies every Published row of the DCFacilities tab into Projects,
 *      with Category = "Commercial facility", Stage = Operating (or
 *      Proposed if its listed status says proposed / under construction),
 *      the real-world status text in Notes, and a Verification value from
 *      the October 2026 independent check below.
 *   3. Skips any facility whose Name is already in Projects, so running it
 *      twice never creates duplicates.
 *   4. Renames DCFacilities to "DCFacilities (merged, archive)". Nothing
 *      is deleted. The map then reads facilities from Projects only.
 *
 * After running: Deploy > Manage deployments > edit the web app > New
 * version, so the live feed includes the new Category and Verification
 * fields. Until that is done the map still works, but facility popups
 * lose their verification wording.
 *
 * Verification values: confirmed = backed by an independent source
 * (operator site, PeeringDB, news); likely = independent sources point to
 * it but details are partly confirmed; unverified = weak or no
 * independent evidence. Edit the Verification cell any time.
 */

const FACILITY_CATEGORY = 'Commercial facility';
const DC_ARCHIVE_NAME = 'DCFacilities (merged, archive)';

// name in DCFacilities -> [verification, extra independent source links]
const FACILITY_VERIFICATION = {
  'Flexential Louisville, Downtown': ['confirmed', []],
  'Flexential Louisville, East': ['confirmed', []],
  'Louisville Enterprise Data Center': ['confirmed', ['https://www.datacenterdynamics.com/en/news/aphorio-carter-acquires-two-enterprise-data-centers-in-kentucky-for-35m']],
  'Simpsonville Enterprise Data Center': ['confirmed', ['https://www.datacenterdynamics.com/en/news/aphorio-carter-acquires-two-enterprise-data-centers-in-kentucky-for-35m']],
  '332 W. Broadway (Heyburn Building)': ['confirmed', ['https://inflect.com/building/332-west-broadway-louisville/cogent/datacenter/sdf01']],
  'IgLou Data Center': ['likely', []],
  'Uniti Louisville (nGenX Colocation)': ['confirmed', []],
  'BluegrassNet East Breckinridge': ['likely', []],
  'Lumen Louisville 2': ['likely', []],
  'BluegrassNet Downtown Louisville': ['likely', []],
  'Silica Broadband': ['unverified', []],
  'Lumen Louisville 1': ['likely', []],
  'Data Canopy, Louisville': ['likely', []],
  'Quad State Internet PAH1 Data Center': ['confirmed', ['https://www.peeringdb.com/fac/13029']],
  'Lost River Data Center (LRDC)': ['confirmed', ['https://www.peeringdb.com/fac/13629', 'https://www.wnky.com/?p=2663033']],
  'Ashland Technology Complex and Data Center': ['unverified', []],
  'CBTS Florence': ['unverified', []],
  'CyrusOne Florence': ['confirmed', []],
  'EnergyNet Data Center': ['confirmed', ['https://www.peeringdb.com/fac/13628']],
  'East Kentucky Network Data Center': ['confirmed', ['https://www.peeringdb.com/fac/15681']],
  'KUSI Data Center (SUBTAC)': ['unverified', []],
  'Uniti Lexington (formerly Windstream)': ['likely', []],
  'BluegrassNet Downtown Lexington': ['likely', []],
  'QX.net Colocation': ['unverified', []],
  'Gearheart Communications': ['unverified', []],
};

function mergeFacilitiesIntoProjects() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const dc = ss.getSheetByName(DC_SHEET);
  const proj = ss.getSheetByName(PROJ_SHEET);
  if (!proj) throw new Error('No "' + PROJ_SHEET + '" tab found.');
  if (!dc) { Logger.log('No "' + DC_SHEET + '" tab, nothing to merge.'); return; }

  const headers = ensureProjectColumns_(proj, ['Category', 'Verification']);
  const dcValues = dc.getDataRange().getValues();
  const dcHeaders = dcValues[0];

  const nameCol = headers.indexOf('Name');
  const existing = {};
  if (proj.getLastRow() > 1) {
    proj.getRange(2, nameCol + 1, proj.getLastRow() - 1, 1).getValues()
      .forEach(r => { existing[String(r[0]).trim().toLowerCase()] = true; });
  }

  const newRows = [];
  let skipped = 0;
  for (let i = 1; i < dcValues.length; i++) {
    const rec = rowToObject(dcHeaders, dcValues[i]);
    if (!rec.Name || rec.Status !== STATUS_PUBLISHED) continue;
    const key = String(rec.Name).trim().toLowerCase();
    if (existing[key]) { skipped++; continue; }
    newRows.push(facilityToProjectRow_(headers, rec));
    existing[key] = true;
  }

  if (newRows.length) {
    proj.getRange(proj.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }
  dc.setName(DC_ARCHIVE_NAME);
  Logger.log('Merged ' + newRows.length + ' facilities into Projects (' + skipped +
    ' already there). Old tab renamed to "' + DC_ARCHIVE_NAME + '". Now redeploy the web app as a new version.');
}

// Adds any missing columns to the end of the header row, returns the headers.
function ensureProjectColumns_(sheet, wanted) {
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  wanted.forEach(name => {
    if (headers.indexOf(name) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(name).setFontWeight('bold');
      headers = headers.concat([name]);
    }
  });
  return headers;
}

function facilityToProjectRow_(headers, rec) {
  const info = FACILITY_VERIFICATION[String(rec.Name).trim()] || ['unverified', []];
  const statusText = String(rec.Status_Field || '');
  const t = statusText.toLowerCase();
  const stage = (t.indexOf('proposed') >= 0 || t.indexOf('construction') >= 0) ? 'Proposed' : 'Operating';
  const sources = [rec.SourceLink].concat(info[1]).filter(Boolean).join('\n');
  const values = {
    Name: rec.Name,
    City: rec.City,
    County: rec.County,
    Address: rec.Address,
    Size: rec.Size,
    Developer: rec.Developer || rec.Operator,
    Sources: sources,
    Notes: statusText,
    Stage: stage,
    CountyWide: 'FALSE',
    Lat: rec.Lat,
    Lng: rec.Lng,
    Status: STATUS_PUBLISHED,
    Category: FACILITY_CATEGORY,
    Verification: info[0],
  };
  return headers.map(h => (values[h] === undefined ? '' : values[h]));
}
