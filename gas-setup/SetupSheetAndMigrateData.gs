/**
 * KY Data Center Map, one-time sheet setup + data migration
 * ============================================================
 * Run `setupSheetAndMigrateData()` ONCE from the Apps Script editor.
 * It creates every tab this system needs, with headers and dropdown data
 * validation on the columns that feed the map's coloring logic, and fills
 * in all 71 records currently on the live map (19 regulations, 27
 * projects, 25 datacentermap.com facilities) plus all 120 KY county
 * centroids used as the geocoding fallback. Every migrated row is marked
 * Status = "Published" since it's already-vetted live data; only NEW
 * submissions coming through the Form default to "Pending Review".
 *
 * Before running: create a new blank Google Sheet, copy its ID out of
 * the URL, and paste it into SHEET_ID in Code.gs (this script reuses
 * that same constant).
 */

function setupSheetAndMigrateData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  setupRegulationsTab(ss);
  setupProjectsTab(ss);
  setupDCFacilitiesTab(ss);
  setupPendingReviewTab(ss);
  setupCountyCentroidsTab(ss);
  setupHelpContentTab(ss);
  setupInstructionsTab(ss);
  Logger.log('Setup and migration complete.');
}

function setupRegulationsTab(ss) {
  let sheet = ss.getSheetByName(REG_SHEET);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(REG_SHEET);
  const headers = ['County','City','Level','Type','StartDate','Period','Expiration','Notes','Lat','Lng','Address','Sources','Status','NotifiedExpired'];
  sheet.appendRow(headers);
  const rows = [
    ["Fayette", "Lexington", "County", "Moratorium", '', "4 months, June 2026", "10/31/26", "Moratorium until Oct 31st, working on an ordinance, vote in Planning Commission July 30th 2026", 38.0406, -84.5037, '', "https://engage.lexingtonky.gov/datacenters", 'Published', false],
    ["Letcher", "Whitesburg", "County", "Moratorium", '', "2 years (start date unclear, verbal passage, no formal language yet)", "", "Passed verbally on July 20th with no formal document or language yet, per local reporting.", 37.1187, -82.8298, '', "https://www.themountaineagle.com/articles/county-orders-two-year-halt-on-data-centers/, https://www.youtube.com/watch?v=QFe8UgC_710", 'Published', false],
    ["Bell", "", "County", "Moratorium", '', "2 years", "07/02/28", "Passed July 2nd, 2026.", 36.7304, -83.6781, '', "https://drive.google.com/file/d/1dO-Q0dnMsT-EzzuNRo6zgd72ivIjf1-R/view", 'Published', false],
    ["Bullitt", "", "County", "Moratorium", '', "1 year, July 20th 2026", "07/20/27", "", 37.9731, -85.6857, '', "https://www.wave3.com/2026/07/21/bullitt-county-passes12-month-halt-consideration-new-data-center-projects/", 'Published', false],
    ["Daviess", "", "County", "Moratorium", '', "1 year, May 28th 2026", "05/28/27", "", 37.734, -87.0817, '', "https://kentuckylantern.com/2026/06/08/some-kentucky-counties-and-cities-are-hitting-pause-on-data-centers/", 'Published', false],
    ["Breckinridge", "", "County", "Moratorium", '', "1 year, December 15th 2025", "12/15/26", "", 37.7762, -86.4281, '', "https://breckinridgeky.com/wp-content/uploads/2025/12/AI-Data-Center-Moratorium-Ordinance-2025-1117A.pdf", 'Published', false],
    ["Nelson", "Bardstown", "County", "Moratorium", '', "1 year, starting July 7th, 2026", "7/7/27", "", 37.8072, -85.4669, '', "https://nelsoncountygazette.com/fiscal-court-approves-1-year-moratorium-on-data-centers-in-nelson-county/", 'Published', false],
    ["Barren", "Cave City", "City", "Moratorium", '', "1 year, starting May 20th, 2026", "5/20/27", "", 37.1387, -85.9591, '', "https://www.wnky.com/cave-city-approves-one-year-moratorium-with-second-reading/", 'Published', false],
    ["Oldham", "", "County", "Moratorium", '', "150 days", "11/28/26", "", 38.4001, -85.4498, '', "https://www.lpm.org/news/2025-07-02/oldham-county-passes-sweeping-data-center-moratorium-executive-fired-over-recording", 'Published', false],
    ["Scott", "", "County", "Moratorium", '', "6 months", "09/16/26", "", 38.2906, -84.5861, '', "https://www.meadeky.gov/DocumentCenter/View/427/", 'Published', false],
    ["Meade", "", "County", "Moratorium", '', "1 year", "12/10/26", "", 37.9587, -86.2047, '', "https://www.meadeky.gov/DocumentCenter/View/427/", 'Published', false],
    ["Simpson", "", "County", "Ordinance", '', "", "", "", 36.7396, -86.5759, '', "https://www.wkyufm.org/news/2026-01-07/simpson-co-passes-ordinance-placing-greater-restrictions-on-data-centers", 'Published', false],
    ["Boyd", "Ashland", "City", "Moratorium", '', "180 days", "08/25/26", "", 38.4767, -82.6382, '', "https://www.wsaz.com/2026/02/26/ordinance-passed-data-center-applications/", 'Published', false],
    ["Laurel", "London", "City", "Moratorium", '', "2 years", "09/30/28", "", 37.1289, -84.0833, '', "", 'Published', false],
    ["Kenton", "Ludlow", "City", "Moratorium", '', "1 year", "", "Ordinance No. 2026-13 defines a broad \"IT Infrastructure Facility\" category, covering data centers, cloud computing, and crypto or AI facilities, but excludes small business computer rooms. Ludlow asked the Kenton County Planning Commission to study impacts and recommend zoning standards. No reading or publication dates were filed, so an exact expiration can't be calculated.", 39.0895, -84.548, '', "https://www.ludlow.org/Portals/ludlow/Documents/Ord.%202026-13%20Moratorium%20on%20Data%20Centers.pdf", 'Published', false],
    ["Jefferson", "", "County", "Pending/Proposed", '', "Reported as a 6-month pause; final language pending Metro Council vote", "", "Louisville Metro Council's Planning and Zoning Committee voted 7-1 on Aug 4-5, 2026 to advance a moratorium, with a final vote expected around Aug 13. Mayor Craig Greenberg supports it. It would not apply retroactively to the approved Camp Ground Road project. On Aug 12, the Mayor paused review of a new Dermody Properties application pending the vote.", 38.2527, -85.7585, '', "https://www.lpm.org/news/2026-08-04/louisville-metro-council-advances-data-center-moratorium", 'Published', false],
    ["Mercer", "", "County", "Moratorium", '', "1 year, passed Aug 12, 2026 (unanimous Fiscal Court vote)", "8/12/27", "Covers new data center applications in unincorporated Mercer County only. Does not apply to the city of Burgin, which is separately considering annexing land (including the site of the proposed Panattoni 'Project Bluegrass' data center) that would place it outside county zoning entirely.", 37.7595, -84.8508, '', "https://www.lpm.org/news/2026-08-12/a-kentucky-county-passes-a-data-center-moratorium-with-a-city-sized-hole", 'Published', false],
    ["Allen", "", "County", "Moratorium", '', "2 years", "", "Per internal tracking spreadsheet.", 36.7484, -86.1935, '', "", 'Published', false],
    ["Woodford", "Versailles", "City", "Moratorium", '', "6 months", "12/31/26", "", 38.04861, -84.72583, '', "", 'Published', false],
  ];
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  applyValidation(sheet, 'Level', ['County', 'City'], headers, rows.length);
  applyValidation(sheet, 'Type', ['Moratorium', 'Ordinance', 'Pending/Proposed'], headers, rows.length);
  applyValidation(sheet, 'Status', [STATUS_PUBLISHED, STATUS_PENDING, STATUS_REJECTED], headers, rows.length);
}

/**
 * Adds a dropdown to the given column, covering both the migrated rows and
 * 200 rows beyond them, so new rows added later (by the Form, or by hand)
 * still get the dropdown without needing to re-run this setup. Existing
 * values outside the list are still allowed (allowInvalid = true), this
 * is meant to guide data entry, not lock the sheet, since a typo here
 * would otherwise silently break the map's type/stage-based coloring
 * without any obvious error.
 */
function applyValidation(sheet, columnName, choices, headers, dataRowCount) {
  const col = headers.indexOf(columnName) + 1;
  if (col === 0) return;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(choices, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, col, Math.max(dataRowCount, 1) + 200, 1).setDataValidation(rule);
}

function setupProjectsTab(ss) {
  let sheet = ss.getSheetByName(PROJ_SHEET);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(PROJ_SHEET);
  const headers = ['Name','City','County','Address','Size','Developer','PZ','Utility','Tariff','CompletionDate','Tenant','Sources','Notes','Stage','CountyWide','Lat','Lng','Status'];
  sheet.appendRow(headers);
  const rows = [
    ["Camp Ground Road data center, Louisville", "Louisville", "Jefferson", '', "525 MW", "Poe Companies / PowerHouse Data Centers", "approved", "TSR", "LG&E/KU 'Extremely High Load Factor' (EHLF) tariff for data centers using 100+ MW.", "Filed as three LG&E/KU transmission requests across three phases, totaling 525 MW.", "Not publicly disclosed as of Aug 2026, developers reportedly courting Amazon, Google, and Microsoft, per AOL reporting (unconfirmed)", "https://www.lpm.org/news/2026-03-05/west-louisville-data-center-approved-despite-opposition, https://psc.ky.gov/pscecf/2024-00326/rick.lovekamp%40lge-ku.com/06062025033227/03-PSC_DR_PH_LGE_KU_Attach_to_Q1_-_DataCenter_Location_Map.pdf", "CAT3 development plan approved twice. The city's overdue data center ordinance is still pending, but it will not affect this project since it is already approved. Kentucky Lantern (7/2026): Louisville Metro Council approved a 1.6 million sq ft Poe Companies/PowerHouse project in West Louisville in March 2026 despite opposition, and the city is now considering a draft data center ordinance.", "Proposed", false, 38.2527, -85.7585, 'Published'],
    ["Project Lincoln", "La Grange", "Oldham", '', "100 MW (downsized from an originally reported 600-650 MW plan at a different site)", "Western Hospitality Partners", "denied", "TSR", "LG&E/KU service area, EHLF tariff structure likely to apply; specific terms not yet public", "Target energized date: 2028, per LG&E/KU TSR LGE-TSR-2024-012 (filed 9/6/2024), if this is the same project, see note below", "Not publicly disclosed", "https://www.lpm.org/news/2025-06-03/oldham-county-data-center-switches-sites-reduces-size-amid-local-resistance, https://psc.ky.gov/pscecf/2024-00326/rick.lovekamp%40lge-ku.com/06062025033227/03-PSC_DR_PH_LGE_KU_Attach_to_Q1_-_DataCenter_Location_Map.pdf, https://www.datacentermap.com/usa/kentucky/louisville/project-lincoln-oc-data-center/", "Kentucky Lantern: the original plan (8 buildings, 2.5M sq ft, 267 acres along Highway 53) was denied; the developer relocated to a smaller site. Data Center Map's own listing, sourced independently, also uses the name \"Project Lincoln OC Data Center,\" further supporting the match to the LG&E/KU \"Meridian 2\" PSC filing.", "Proposed", false, 38.3926, -85.4073, 'Published'],
    ["West Point", "West Point", "Hardin", '', "360 acres", "Halloway Construction (land owner) / realty group", "", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "", "Potential $1 billion investment, per a West Point contact, though more information is still needed. The site sits across Dixie Highway from Fort Knox.", "Rumored", false, 37.9364, -85.9436, 'Published'],
    ["Maysville", "Maysville", "Mason", '', "2,080 acres rezoned from agricultural to rural industrial, reported at up to 1.2 GW.", "Undisclosed (hyperscaler)", "Fiscal Court approved a second reading in May 2026 to rezone 2,080 acres for the project.", "", "East Kentucky Power Cooperative's 'Data Center Power' tariff applies to loads of 15+ MW.", "Not yet announced, project still pending final local approval as of mid-2026", "Confidential under NDA, publicly described only as a \"Fortune 100\" technology company; name not disclosed for competitive reasons", "https://www.courier-journal.com, https://www.kentucky.com/news/business/article315925551.html", "Kentucky Lantern: Maysville-Mason County Industrial Development Authority Director Tyler McHugh has represented the project locally since August 2025. The operator is expected to cover road, sewer, water, and electricity infrastructure costs, and to mitigate site noise. Capacity estimates vary by source: up to 1.2 GW per Kentucky Lantern, up to 2,200 MW per earlier reporting.", "Proposed", false, 38.6412, -83.7452, 'Published'],
    ["Franklin", "Franklin", "Simpson", '', "550+ MW", "TenKey LandCo", "pending", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "https://www.lpm.org/news/2026-01-28/data-center-developer-sues-simpson-county-government-over-land-use-ordinance", "The developer is based in Pittsburgh and Nashville and plans a behind-the-meter gas setup to power the site. Citizens are suing over the approval, arguing the gas generation should not qualify as an accessory use. Kentucky Lantern (7/2026): TenKey LandCo wants to build a large data center here and is suing the county over its conditional-use-permit ordinance.", "Proposed", false, 36.722, -86.5772, 'Published'],
    ["Rockcastle County", "", "Rockcastle", '', "", "", "", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "", "Industrial park with potential for a data center, especially given EKPC's transmission work in the county.", "Rumored", true, 37.3672, -84.3152, 'Published'],
    ["Ekron", "Ekron", "Meade", '', "135 acres", "", "The city rejected the requested rezoning from Agriculture/Residential to Light Industrial in October 2025.", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "https://www.wave3.com/2025/10/14/meade-county-zoning-commission-votes-against-data-center/, https://www.change.org/p/stop-the-ai-data-center-construction-in-ekron-ky", "Opposition was organized locally by Bridget Blake, who lives across the street from the site. Her Change.org petition has over 3,000 signatures. Meade County Magistrate Trey Webb noted a broader concern: approving one data center makes it harder to stop future ones. Cited concerns included well-water impacts, noise, and property values.", "Proposed", false, 37.9095, -86.0139, 'Published'],
    ["Madison County", "", "Madison", '', "", "", "", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "", "Industrial park with potential for a data center, especially given the transmission work by EKPC in the county.", "Rumored", true, 37.7145, -84.2713, 'Published'],
    ["Pineville", "Pineville", "Bell", '', "350 MW", "Murray Industries", "moratorium", "TSR - Applied", "Transmission Service Request submitted 6/2/2025, per LG&E/KU's PSC filing.", "Target energized date: 2030, per LG&E/KU filing in PSC Case No. 2024-00326", "Not publicly disclosed", "https://psc.ky.gov/pscecf/2024-00326/rick.lovekamp%40lge-ku.com/06062025033227/03-PSC_DR_PH_LGE_KU_Attach_to_Q1_-_DataCenter_Location_Map.pdf, https://www.wymt.com/2026/06/26/bell-county-residents-pack-courthouse-oppose-data-center-construction/", "Bell County passed a data center moratorium halting construction for 2 years. Kentucky Lantern (7/2026): Murray Industries has said it wants to invest billions in a data center on land it owns. A June fiscal court meeting drew a large turnout over water and noise concerns.", "Proposed", false, 36.7615, -83.701, 'Published'],
    ["Cave City", "Cave City", "Barren", '', "", "", "moratorium", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "https://www.wbko.com/2026/05/13/cave-city-officials-divided-over-data-center-moratorium-decision/", "Kentucky Lantern (7/2026): Kentucky Industrial Alliance is assembling land for a hyperscale project and is in litigation with Cave City over its moratorium. Reported plans cite roughly 2 million square feet and up to 1.2 GW.", "Proposed", false, 37.1387, -85.9591, 'Published'],
    ["Muskie data center", "Ashland", "Boyd", '', "1 GW", "Terawulf", "already zoned I", "", "Kentucky Power's Large Load Tariff includes customer, energy, and demand charges with a 20-year contract.", "A 500 MW phase begins ramping in 2028, with another 500 MW targeted for 2030.", "Not publicly disclosed; TeraWulf typically leases to long-term tenants under 15-year agreements.", "https://www.courier-journal.com/story/news/local/2026/05/26/eastern-kentucky-gets-a-massive-new-data-center/90259401007/, https://www.kentuckypower.com/community/caring/view?id=11895", "Kentucky Lantern (7/2026): Terawulf's project sits at an industrial park spanning Boyd and Greenup counties. Original tracking data lists the arrangement as \"contracted under IGS.\"", "Proposed", false, 38.4767, -82.6382, 'Published'],
    ["Burgin", "Burgin", "Mercer", '', "1,000+ acres (annexation would roughly double Burgin's total size)", "Panattoni Data Centers (\"Project Bluegrass\")", "", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "https://www.lpm.org/news/2026-08-12/a-kentucky-county-passes-a-data-center-moratorium-with-a-city-sized-hole, https://kentuckylantern.com/2026/07/20/a-mercer-county-city-wants-to-annex-land-for-a-potential-data-center-another-city-has-concerns/", "Kentucky Lantern: this entry was originally pinned at Harrodsburg, then corrected to Burgin per LPM's reporting. Panattoni's pitch claims over 1,500 construction jobs, 100 permanent jobs, and $25-30 million a year in school tax revenue. The company has not held a public meeting for residents.", "Proposed", false, 37.75444, -84.76333, 'Published'],
    ["LexMark", "Lexington", "Fayette", '', "345,000+ sq ft across ~30 acres, two buildings; believed scalable to 70 MW power capacity", "DartPoints", "DartPoints never obtained a zoning permit before Fayette's moratorium began, so it cannot legally operate.", "", "Kentucky Utilities (KU), substation already on site; specific tariff terms not yet public", "Not yet announced", "Not publicly disclosed", "https://www.lex18.com/news/covering-kentucky/lexmark-data-center-on-new-circle-road-sells-for-29-million-to-dallas-based-company, https://spectrumnews1.com/ky/louisville/news/2026/06/08/texas-based-data-center-coming-to-lexington, https://www.kentucky.com/news/business/article316135683.html", "Kentucky Lantern: the site sits near Hollow Creek, a historically Black neighborhood, and has drawn concern over equity and environmental impact. Mayor Linda Gorton said her office learned of the sale only after it closed and won't support public incentives. The Planning Commission held a hearing on a new zoning ordinance July 30, 2026.", "Proposed", false, 38.07537860061169, -84.48733005767275, 'Published'],
    ["Carroll County (Deca)", "", "Carroll", '', "", "Deca Companies", "", "", "Owen Electric Cooperative territory, not LG&E/KU, per Data Center Dynamics reporting.", "Not yet announced, reporting as of Aug 2026 says construction timing is still unclear", "Not publicly disclosed", "https://kentuckylantern.com/wp-content/uploads/2026/07/KEDFA-Letter-of-Support.pdf, https://drive.google.com/drive/folders/1s2zdY7uxHHQVZBbePaPAXoVPmZNgreHf", "Already endorsed by fiscal court to KEDFA. Kentucky Lantern (7/2026): fiscal court moved to start state tax-break paperwork for this Deca Companies project. Separately, Poe Companies/PowerHouse Data Centers announced a roughly $9.6 billion project near the Kentucky River.", "Proposed", true, 38.6711, -85.1121, 'Published'],
    ["Bullitt County", "", "Bullitt", '', "n/a", "n/a", "1-year pause", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "Bullitt County passes 1-year pause on data center development", "As of July 21, 2026.", "Rumored", true, 37.9731, -85.6857, 'Published'],
    ["Carroll County (Poe/PowerHouse, $9.6B)", "", "Carroll", '', "300 acres", "Poe Companies/PowerHouse Data Centers", "", "", "LG&E/KU service area, Extremely High Load Factor (EHLF) tariff structure likely to apply; not yet confirmed for this specific project", "Not yet announced, reporting as of Aug 2026 says construction timing is still unclear", "Not publicly disclosed", "https://www.wdrb.com/news/business/louisville-based-development-team-announces-plans-for-9-6b-data-center-campus-in-carroll-county/article_fbadd4b9-3df3-4a85-8e1c-ed98165aec07.html, https://www.whas11.com/article/news/local/carrollton-massive-data-center-poe-companies/417-36b86470-3160-4fd7-ac24-a00af7e1148a", "Kentucky Lantern (7/2026): fiscal court separately moved to start state tax-break paperwork for the neighboring Deca Companies project. This one sits near the Kentucky River.", "Proposed", true, 38.6711, -85.1121, 'Published'],
    ["Rubix", "Ashland", "Boyd", '', "2 GW across 8 buildings, a record $12 billion investment at the former AK Steel site.", "Rubix Data Centers (subsidiary of Submer Group, based in Barcelona, Spain)", "", "", "Kentucky Power (AEP), which already faces supply shortages across the regional PJM grid.", "Not yet announced", "Not publicly disclosed", "https://kentuckylantern.com/2026/07/22/developer-proposes-hyperscale-data-center-at-the-site-at-former-eastern-kentucky-steel-mill/, https://www.kentucky.com/news/state/kentucky/article316609672.html", "Herald-Leader: the site, owned by Cleveland-Cliffs, once employed over 5,000 steelworkers and now has one security guard. The company says it won't affect residential electricity rates. It expects to use up to 150,000 gallons of water a day, mostly non-potable water from the Ohio River, via a closed-loop system with no sewer discharge. Acreage reported as 425-500 depending on source.", "Proposed", false, 38.4767, -82.6382, 'Published'],
    ["Cave Point Commerce Center (Kentucky Industrial Alliance)", "Cave City", "Barren", '', "600-acre campus, 10 buildings totaling about 2 million sq ft, 1.2 GW at full build-out.", "Kentucky Industrial Alliance (reported as both \"Inc.\" and \"LLC\" across sources)", "Annexed via Ordinance 24-9-9C in 2024; two lawsuits are now pending over the project.", "", "Reported 50/50 power split between Farmers RECC and an on-site natural gas plant.", "Not yet announced", "Not publicly disclosed", "https://www.kentucky.com/news/state/kentucky/article316670347.html, https://www.wcluradio.com/2026/07/07/second-lawsuit-seeks-to-void-cave-city-annexation-tied-to-proposed-data-center/", "The site sits just outside Mammoth Cave National Park, on a karst landscape where sinkholes are already a local concern. A neighboring farmer has become an outspoken organizer and is discussing a countywide moratorium with county leaders. The National Parks Conservation Association has flagged the project as a national concern. One lawsuit challenges the moratorium; another seeks to void the annexation over a Shaw Cemetery dispute.", "Proposed", false, 37.1326448181423, -85.97682345397207, 'Published'],
    ["Terawulf Boyd/Greenup", "", "Greenup", '', "up to 1 GW", "Terawulf", "", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "", "Kentucky Lantern (7/2026): Terawulf's proposal sits at an industrial park spanning Boyd and Greenup counties.", "Proposed", true, 38.5433, -82.9199, 'Published'],
    ["Terawulf Century Aluminum site", "", "Hancock", '', "482 MW", "Terawulf", "", "", "Special contract with Big Rivers Electric Corporation, pending PSC approval as of Aug 2026.", "Reported target year: 2028", "Anthropic, per a 20-year lease reported by Kentucky Lantern and WEKU in August 2026.", "https://www.courier-journal.com/story/news/local/2026/05/12/hancock-county-kentucky-terawulf-data-center-sparks-debate/89822141007/, https://kentuckylantern.com/2026/08/03/data-centers-need-massive-power-theyre-eyeing-kentuckys-idle-industrial-sites-to-get-it/, https://www.weku.org/amsn/2026-08-09/with-more-data-centers-on-the-horizon-communities-worry-about-rising-electricity-bills", "Kentucky Lantern (7/2026).", "Proposed", true, 37.8404, -86.7809, 'Published'],
    ["CoreScientific Calvert City", "Calvert City", "Marshall", '', "150 MW", "CoreScientific", "operating since 2019", "", "Not publicly disclosed", "Already operating (see Planning & zoning field for start year)", "Not applicable; CoreScientific operates the facility itself rather than leasing to a tenant.", "https://corescientific.com/high-density-data-centers/calvert-city-ky/", "Kentucky Lantern (7/2026): a second Bitcoin-mining data center, Riot Platforms, operates nearby, running 25 MW since a 2024 acquisition.", "Operating", false, 37.051592457972134, -88.39320119814532, 'Published'],
    ["Riot Platforms Calvert City", "Calvert City", "Marshall", '', "25 MW", "Riot Platforms", "operating, acquired 2024", "", "Not publicly disclosed", "Already operating (see Planning & zoning field for start year)", "Not applicable; Riot Platforms operates the facility itself rather than leasing to a tenant.", "https://www.datacentermap.com/usa/kentucky/calvert-city/riot-platforms-calvert-city/", "Kentucky Lantern (7/2026): a second Bitcoin-mining data center, CoreScientific, operates nearby, running 150 MW since 2019.", "Operating", false, 36.997, -88.3595, 'Published'],
    ["Riot Platforms McCracken Co.", "", "McCracken", '', "35 MW currently, with potential increase to 60-100 MW.", "Riot Platforms", "operating", "", "Not publicly disclosed", "Already operating (see Planning & zoning field for start year)", "Not applicable; Riot Platforms operates the facility itself rather than leasing to a tenant.", "https://www.kentucky.com/news/business/article315675473.html", "Kentucky Lantern (7/2026): Riot Platforms bought this site from a prior operator.", "Operating", true, 37.0558, -88.7106, 'Published'],
    ["MD Squared Pikeville", "Pikeville", "Pike", '', "25-30 MW", "MD Squared Power", "preliminary agreement", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "https://www.kentucky.com/news/state/kentucky/article316025546.html", "Kentucky Lantern (7/2026): the project is valued at roughly $250 million, proposed for an industrial park.", "Proposed", false, 37.4778, -82.5188, 'Published'],
    ["Wolfe Co. Bitcoin mining DC", "", "Wolfe", '', "", "Artemis Power Tech", "operating, reportedly shutting down", "", "Not publicly disclosed", "Not yet announced", "Not publicly disclosed", "https://kentuckylantern.com/2023/10/09/in-a-rural-kentucky-community-the-roar-of-a-suspected-crypto-mine-never-ends/", "Kentucky Lantern (7/2026): a Bitcoin-mining data center has operated in an unincorporated part of the county since 2023. Reports in July 2026 said it was shutting down.", "Operating", true, 37.7449, -83.4971, 'Published'],
    ["Kramers Lane data center (Dermody Properties), Louisville", "Louisville", "Jefferson", '', "350,000 sq ft (converting an existing vacant warehouse; no MW figure disclosed)", "Dermody Properties (via shell company DPIF4 KY 6 KRAMERS, LLC)", "Filed a Category 3 Development Plan to convert the warehouse into a 'telecommunications hotel.'", "", "", "Not yet announced, application on hold pending Metro Council moratorium vote", "Not publicly disclosed, filing does not name an operating technology company", "https://www.lpm.org/news/2026-08-12/images-another-data-center-proposed-for-louisvilles-rubbertown-neighborhood", "The 20-acre Rubbertown site was approved for warehouse use in 2024 but never built out. It sits next to the Poe Companies/PowerHouse campus already under construction, and beside the River Oaks Mobile Home Park. Dermody has prior data center experience: it sold land to Microsoft in Arizona and is building a campus in Georgia.", "Proposed", false, 38.2527, -85.7585, 'Published'],
    ["Paducah American Energy Hub", "", "McCracken", '', "1.8 GW campus with up to 1.2 GW compute capacity, backed by $100+ billion in investment.", "Brookfield Asset Management, with power supplied by NextEra Energy.", "Announced by the U.S. Department of Energy on July 29, 2026, at a federal Superfund site.", "", "Power from NextEra Energy, Big Rivers Electric, Jackson Purchase Energy Co-op, and Paducah Power.", "Compute capacity targeted by 2032, per Data Center Dynamics reporting.", "Not publicly disclosed; no anchor tenant named as of the announcement.", "https://kentuckylantern.com/2026/07/29/hyperscale-data-center-natural-gas-fired-project-planned-for-paducahs-former-nuclear-plant/, https://www.datacenterdynamics.com/en/news/brookfield-to-develop-gigawatt-scale-data-center-campus-at-does-kentucky-nuclear-enrichment-plant/, https://www.kentuckynewera.com/news/state/article_8cfd4c93-970a-5ba4-9989-e1247a1996f1.html", "$100B+ public-private partnership at a former uranium enrichment Superfund site. Would create 8,000 construction jobs and 600 permanent ones. Gov. Beshear said he wasn't briefed beforehand. Paducah's mayor, running for county judge-executive, has pledged transparency. The site also hosts General Matter's unrelated advanced nuclear fuel project.", "Proposed", false, 37.1083, -88.8062, 'Published'],
  ];
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  applyValidation(sheet, 'Stage', ['Rumored', 'Proposed', 'Operating'], headers, rows.length);
  applyValidation(sheet, 'Status', [STATUS_PUBLISHED, STATUS_PENDING, STATUS_REJECTED], headers, rows.length);
}

function setupDCFacilitiesTab(ss) {
  let sheet = ss.getSheetByName(DC_SHEET);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(DC_SHEET);
  const headers = ['Name','Operator','Developer','Status_Field','Size','Address','City','County','Lat','Lng','SourceLink','Status'];
  sheet.appendRow(headers);
  const rows = [
    ["Flexential Louisville, Downtown", "Flexential", "Flexential", "Operational", "", "752 Barret Avenue, Louisville, KY 40204", "Louisville", "Jefferson", 38.2447, -85.7391, "https://www.datacentermap.com/usa/kentucky/louisville/flexential-louisville-downtown/", 'Published'],
    ["Flexential Louisville, East", "Flexential", "Flexential", "Operational", "", "2101 Nelson Miller Parkway, Louisville, KY 40223", "Louisville", "Jefferson", 38.2478, -85.5691, "https://www.datacentermap.com/usa/kentucky/louisville/flexential-louisville/", 'Published'],
    ["Louisville Enterprise Data Center", "Aphorio Carter", "Aphorio Carter", "Operational (built 2011)", "30 acres, 102,500 sq ft, 1,000 kW critical power", "12901 Plantside Dr, Louisville, KY 40299", "Louisville", "Jefferson", 38.2258, -85.5379, "https://www.datacentermap.com/usa/kentucky/louisville/louisville-enterprise-data-center/", 'Published'],
    ["Simpsonville Enterprise Data Center", "Aphorio Carter", "Aphorio Carter", "Operational", "Tier III, LEED Gold certified", "70 Kingbrook Pkwy, Simpsonville, KY 40067", "Simpsonville", "Shelby", 38.21667, -85.35139, "https://www.datacentermap.com/usa/kentucky/louisville/simpsonville-enterprise-data-center/", 'Published'],
    ["332 W. Broadway (Heyburn Building)", "Multiple (Cogent Communications, Lumen)", "Multiple: Cogent Communications, Lumen", "Operational (Cogent, Lumen); Unknown (building overall)", "Cogent suite: 1,503 sq ft raised floor, 60KVA UPS", "332 W. Broadway, Louisville, KY 40202", "Louisville", "Jefferson", 38.2517, -85.7605, "https://www.datacentermap.com/usa/kentucky/louisville/332-w-broadway/", 'Published'],
    ["IgLou Data Center", "IgLou Internet Services", "IgLou Internet Services", "Operational", "", "3315 Gilmore Industrial Blvd, Louisville, KY 40213", "Louisville", "Jefferson", 38.1834, -85.7215, "https://www.datacentermap.com/usa/kentucky/louisville/iglou-colocation/", 'Published'],
    ["Uniti Louisville (nGenX Colocation)", "Uniti Wholesale", "Uniti Wholesale", "Operational", "", "929 Mason Ave, Louisville, KY 40204", "Louisville", "Jefferson", 38.2379, -85.7247, "https://www.datacentermap.com/usa/kentucky/louisville/ngenx---colocation/", 'Published'],
    ["BluegrassNet East Breckinridge", "BluegrassNet", "BluegrassNet", "Operational", "", "321 E Breckinridge St, Louisville, KY 40203", "Louisville", "Jefferson", 38.2469, -85.7521, "https://www.datacentermap.com/usa/kentucky/louisville/east-breckinridge/", 'Published'],
    ["Lumen Louisville 2", "Lumen", "Lumen", "Operational", "", "715 S 7th St, Louisville, KY 40203", "Louisville", "Jefferson", 38.2489, -85.7595, "https://www.datacentermap.com/usa/kentucky/louisville/lumen-louisville-2/", 'Published'],
    ["BluegrassNet Downtown Louisville", "BluegrassNet", "BluegrassNet", "Operational", "", "800 S 4th St, Louisville, KY 40201", "Louisville", "Jefferson", 38.2496, -85.7581, "https://www.datacentermap.com/usa/kentucky/louisville/bluegrassnet-downtown-louisville/", 'Published'],
    ["Silica Broadband", "Davey Holdings LLC", "Davey Holdings LLC", "Operational (inferred)", "", "12935 W U.S. Hwy 42, Prospect, KY 40059 (county uncertain: Prospect straddles Jefferson/Oldham)", "Prospect", "Jefferson", 38.34694, -85.61028, "https://www.datacentermap.com/usa/kentucky/louisville/davey-holdings/", 'Published'],
    ["Lumen Louisville 1", "Lumen", "Lumen (formerly Level 3 Communications)", "Operational (inferred)", "", "848 S. 8th Street, Louisville, KY 40203", "Louisville", "Jefferson", 38.2482, -85.7612, "https://www.datacentermap.com/usa/kentucky/louisville/level3-louisville/", 'Published'],
    ["Data Canopy, Louisville", "Data Canopy", "Data Canopy (HOSTING)", "Operational (inferred)", "", "1208 Quality Choice Pl, Louisville, KY 40202", "Louisville", "Jefferson", 38.2551, -85.7523, "https://www.datacentermap.com/usa/kentucky/louisville/hosting-louisville/", 'Published'],
    ["Quad State Internet PAH1 Data Center", "Quad State Internet", "Quad State Internet LLC", "Operational (inferred)", "", "1212 Helen St, Paducah, KY 42001", "Paducah", "McCracken", 37.0834, -88.6001, "https://www.datacentermap.com/usa/kentucky/paducah/quad-state-internet-data-center/", 'Published'],
    ["Lost River Data Center (LRDC)", "BGMU Fiber / Western Kentucky University", "BGMU Fiber / Western Kentucky University (joint venture)", "Operational", "Tier II", "2413 Nashville Rd, Bowling Green, KY 42101", "Bowling Green", "Warren", 36.98167, -86.44444, "https://www.datacentermap.com/usa/kentucky/bowling-green/", 'Published'],
    ["Ashland Technology Complex and Data Center", "ATCDC", "Ashland Technology Complex and Data Center", "Operational", "189,000+ sq ft, Tier III", "500 Diederich Blvd, Russell, KY 41169", "Russell", "Greenup", 38.51806, -82.69778, "https://www.datacentermap.com/usa/kentucky/ashland/atcdc_tenants.html", 'Published'],
    ["CBTS Florence", "CBTS", "CBTS", "Operational", "1 of 10 CBTS Midwest data centers", "987 Central Blvd, Florence, KY 41042", "Florence", "Boone", 38.99139, -84.64611, "https://www.datacentermap.com/usa/kentucky/florence-ky/", 'Published'],
    ["CyrusOne Florence", "CyrusOne", "CyrusOne Data Centers (NASDAQ: CONE)", "Operational", "140,000 sq ft", "7190-7200 Industrial Road, Florence, KY 41042", "Florence", "Boone", 38.9944, -84.6398, "https://www.datacentermap.com/usa/kentucky/florence-ky/", 'Published'],
    ["EnergyNet Data Center", "EnergyNet", "EnergyNet", "Operational", "", "1820 E. 9th Street, Hopkinsville, KY 42240", "Hopkinsville", "Christian", 36.85472, -87.48889, "https://www.datacentermap.com/usa/kentucky/hopkinsville/", 'Published'],
    ["East Kentucky Network Data Center", "East Kentucky Network", "East Kentucky Network", "Operational", "16,700 sq ft", "101 Technology Trail, Ivel, KY 41642", "Ivel", "Floyd", 37.59111, -82.66833, "https://www.datacentermap.com/usa/kentucky/ivel/east-kentucky-network-data-center/", 'Published'],
    ["KUSI Data Center (SUBTAC)", "Kentucky Underground Storage", "Kentucky Underground Storage", "Operational (inferred)", "2,300 sq ft, 130 ft underground", "3830 Highbridge Rd, Wilmore, KY 40390 (Jessamine County, not Lexington/Fayette)", "Wilmore", "Jessamine", 37.8873, -84.6472, "https://www.datacentermap.com/usa/kentucky/lexington/subtac/", 'Published'],
    ["Uniti Lexington (formerly Windstream)", "Uniti Wholesale", "Uniti Wholesale", "Operational (inferred)", "", "151 N Martin Luther King Blvd, Lexington, KY 40507", "Lexington", "Fayette", 38.0468, -84.5102, "https://www.datacentermap.com/usa/kentucky/lexington/windstream-lexington/", 'Published'],
    ["BluegrassNet Downtown Lexington", "BluegrassNet", "BluegrassNet", "Operational (inferred)", "", "535 W 2nd St, Lexington, KY 40508", "Lexington", "Fayette", 38.0512, -84.4967, "https://www.datacentermap.com/usa/kentucky/lexington/", 'Published'],
    ["QX.net Colocation", "QX.net", "QX.net", "Not confirmed in latest source, kept from earlier research", "", "333 W Vine St, Lexington, KY 40507", "Lexington", "Fayette", 38.0451, -84.5054, "https://www.datacentermap.com/usa/kentucky/lexington/", 'Published'],
    ["Gearheart Communications", "Gearheart Communications", "Gearheart Communications", "Operational (inferred)", "", "1003 Winchester Rd, Lexington, KY 40505", "Lexington", "Fayette", 38.0589, -84.4712, "https://www.datacentermap.com/usa/kentucky/lexington/gearheart-communications/", 'Published'],
  ];
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  // Status_Field is real-world facility status text (Operational, Proposed,
  // Under construction, Unknown...), matched by keyword in index.html's
  // otherDCStatusKey(), so this is a list of suggestions, not a strict
  // requirement, free text is expected and fine here.
  applyValidation(sheet, 'Status_Field', ['Operational', 'Proposed', 'Under construction', 'Unknown'], headers, rows.length);
  applyValidation(sheet, 'Status', [STATUS_PUBLISHED, STATUS_PENDING, STATUS_REJECTED], headers, rows.length);
}

function setupPendingReviewTab(ss) {
  let sheet = ss.getSheetByName(PENDING_SHEET);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(PENDING_SHEET);
  sheet.appendRow(['Timestamp','SubmissionType','TargetName','ProposedChange','Source','SubmitterEmail']);
}

function setupCountyCentroidsTab(ss) {
  let sheet = ss.getSheetByName(CENTROID_SHEET);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(CENTROID_SHEET);
  sheet.appendRow(['County','Lat','Lng']);
  const rows = [
    ["ohio", 37.4815, -86.8436],
    ["owen", 38.5209, -84.8275],
    ["owsley", 37.4256, -83.6836],
    ["pulaski", 37.1038, -84.5791],
    ["scott", 38.2906, -84.5861],
    ["todd", 36.8376, -87.1787],
    ["washington", 37.7539, -85.1768],
    ["allen", 36.7484, -86.1935],
    ["barren", 36.9655, -85.9292],
    ["bourbon", 38.2042, -84.2253],
    ["breathitt", 37.523, -83.3317],
    ["butler", 37.2097, -86.6815],
    ["carter", 38.3186, -83.0528],
    ["clinton", 36.7211, -85.1283],
    ["elliott", 38.1187, -83.0953],
    ["gallatin", 38.7534, -84.8579],
    ["green", 37.2616, -85.5529],
    ["hart", 37.3001, -85.886],
    ["henry", 38.4487, -85.116],
    ["johnson", 37.8489, -82.8347],
    ["knox", 36.8882, -83.854],
    ["lincoln", 37.4581, -84.6567],
    ["lyon", 37.0235, -88.083],
    ["madison", 37.7145, -84.2713],
    ["marshall", 36.8795, -88.3308],
    ["metcalfe", 36.9883, -85.6241],
    ["morgan", 37.9236, -83.2615],
    ["jefferson", 38.1871, -85.6615],
    ["jessamine", 37.8716, -84.5807],
    ["larue", 37.5464, -85.7008],
    ["lee", 37.5972, -83.7153],
    ["lewis", 38.5291, -83.3862],
    ["livingston", 37.2071, -88.3521],
    ["mccracken", 37.0558, -88.7106],
    ["magoffin", 37.7002, -83.0662],
    ["martin", 37.7985, -82.5087],
    ["mercer", 37.8166, -84.8702],
    ["monroe", 36.7086, -85.7217],
    ["montgomery", 38.0412, -83.9167],
    ["nelson", 37.8054, -85.4676],
    ["pendleton", 38.6968, -84.3582],
    ["perry", 37.2471, -83.2237],
    ["robertson", 38.5145, -84.0519],
    ["rowan", 38.1887, -83.4282],
    ["russell", 36.9905, -85.0596],
    ["taylor", 37.3693, -85.3271],
    ["trigg", 36.81, -87.8747],
    ["wayne", 36.803, -84.8222],
    ["webster", 37.5214, -87.6768],
    ["wolfe", 37.7449, -83.4971],
    ["woodford", 38.0466, -84.7395],
    ["bath", 38.1437, -83.7415],
    ["bell", 36.7304, -83.6781],
    ["boone", 38.9722, -84.7233],
    ["breckinridge", 37.7762, -86.4281],
    ["bullitt", 37.9731, -85.6857],
    ["calloway", 36.6205, -88.2721],
    ["carlisle", 36.8552, -88.9737],
    ["carroll", 38.6711, -85.1121],
    ["casey", 37.3293, -84.928],
    ["cumberland", 36.7873, -85.3897],
    ["estill", 37.6914, -83.9614],
    ["fayette", 38.0356, -84.4617],
    ["floyd", 37.5599, -82.742],
    ["garrard", 37.6441, -84.541],
    ["graves", 36.7235, -88.6505],
    ["grayson", 37.4622, -86.3442],
    ["hancock", 37.8404, -86.7809],
    ["harrison", 38.4417, -84.3359],
    ["henderson", 37.7959, -87.5715],
    ["hopkins", 37.3084, -87.5479],
    ["adair", 37.1077, -85.2779],
    ["anderson", 38.0093, -84.9898],
    ["ballard", 37.0583, -89.0],
    ["boyd", 38.351, -82.6828],
    ["campbell", 38.9463, -84.3765],
    ["clark", 37.9691, -84.1473],
    ["edmonson", 37.2107, -86.2392],
    ["fleming", 38.3688, -83.7006],
    ["grant", 38.6519, -84.6265],
    ["hardin", 37.6985, -85.9648],
    ["jackson", 37.4208, -83.9998],
    ["laurel", 37.1079, -84.1213],
    ["leslie", 37.0975, -83.3803],
    ["mccreary", 36.7349, -84.4835],
    ["menifee", 37.9406, -83.5999],
    ["nicholas", 38.3335, -84.0238],
    ["oldham", 38.4001, -85.4498],
    ["powell", 37.8299, -83.8204],
    ["rockcastle", 37.3672, -84.3152],
    ["spencer", 38.0315, -85.3171],
    ["warren", 36.9947, -86.4222],
    ["whitley", 36.7561, -84.1488],
    ["knott", 37.356, -82.9554],
    ["lawrence", 38.0656, -82.7388],
    ["letcher", 37.1221, -82.8539],
    ["logan", 36.8583, -86.8765],
    ["mclean", 37.5297, -87.2562],
    ["marion", 37.5538, -85.2757],
    ["meade", 37.9587, -86.2047],
    ["muhlenberg", 37.22, -87.1405],
    ["mason", 38.5948, -83.8278],
    ["hickman", 36.6788, -88.9773],
    ["caldwell", 37.1491, -87.8702],
    ["kenton", 38.9349, -84.534],
    ["clay", 37.1635, -83.7161],
    ["pike", 37.4642, -82.3934],
    ["shelby", 38.2148, -85.1996],
    ["simpson", 36.7396, -86.5759],
    ["trimble", 38.6174, -85.3343],
    ["union", 37.6607, -87.9461],
    ["boyle", 37.6271, -84.87],
    ["bracken", 38.6849, -84.0876],
    ["christian", 36.8939, -87.4896],
    ["crittenden", 37.3601, -88.0966],
    ["daviess", 37.734, -87.0817],
    ["franklin", 38.2404, -84.8772],
    ["fulton", 36.5528, -89.1898],
    ["greenup", 38.5433, -82.9199],
    ["harlan", 36.8593, -83.2229],
  ];
  if (rows.length) sheet.getRange(2, 1, rows.length, 3).setValues(rows);
}

/**
 * Run THIS one directly from the function dropdown if you only need to
 * (re)build the HelpContent tab without touching anything else, calling
 * setupHelpContentTab(ss) on its own fails, since it expects ss to be
 * passed in by setupSheetAndMigrateData() and gets nothing when run by
 * itself from the editor.
 */
function setupHelpContentTabOnly() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  setupHelpContentTab(ss);
  Logger.log('HelpContent tab created.');
}

function setupHelpContentTab(ss) {
  let sheet = ss.getSheetByName(HELP_SHEET);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(HELP_SHEET);
  sheet.appendRow(['Key', 'Text']);
  const rows = [
    ["colors-moratorium", "a temporary pause on new data center construction"],
    ["colors-ordinance", "a permanent zoning rule"],
    ["colors-pending", "not yet passed, still under consideration"],
    ["colors-amber", "a city inside has a regulation, but the county doesn't"],
    ["colors-gray", "nothing on file at any level"],
    ["colors-stripes", "both a county-wide and a separate city-level regulation"],
    ["icons-pins", "<strong>Teardrop pins</strong> mark individual data center projects. A solid pin means the exact site is known. A dashed pin means only the county is known so far, not the specific address."],
    ["icons-squares", "<strong>Gray squares</strong> mark listings from the separate \"DC from datacentermap.com\" layer, described below."],
    ["clicking-popups", "Click any county or pin to open a popup with the full details on file and a link to the source. If a popup is long, it scrolls instead of getting cut off, so there's no hidden information below the fold."],
    ["clicking-notavailable", "When a field like Utility status or Tenant says <strong>\"Not available\"</strong>, that means it genuinely isn't public yet, not that something's missing by mistake. This map doesn't guess or fill in gaps."],
    ["dclayer-p1", "This is a separate, toggleable layer pulled from datacentermap.com's general directory of Kentucky data center facilities. Most of these are ordinary commercial colocation and hosting providers that have existed for years, not part of the AI/hyperscale story the rest of this map tracks."],
    ["dclayer-p2", "It's kept as its own layer, off by default, rather than mixed into the main dataset, so it's always clear which pins are sourced, vetted community and regulatory data, and which are a general industry listing. Square markers in this layer are colored by status the same way project pins are: indigo for Proposed, magenta for Operating, orange for under construction, and gray where the status is unclear."],
    ["search-p1", "Type a county name, city name, project name, developer, or keyword like \"moratorium\" or a megawatt figure. Typing a city (even one with no tracked project of its own, like Wilmore) resolves to its county and zooms straight to that city."],
    ["search-p2", "A few things it handles automatically: minor typos, \"County\" as a suffix (\"Boyd County\" works the same as \"Boyd\"), units written different ways (\"500mw\" or \"500 MW\"), and phrases like \"county wide\" or \"city level\" to find every county in that state."],
    ["toggles-p1", "The <strong>Regulation</strong> row filters county shading by type. The <strong>Projects</strong> row filters pins by stage, and includes the datacentermap.com layer toggle. The <strong>Layers</strong> row adds live transmission line and gas pipeline data from public government sources."],
    ["toggles-p2", "Numbers in parentheses on each button show how many match that filter right now. The three numbers at the top of the page (counties with regulations, counties with none, and projects tracked) update the same way, live, as entries are added. When the datacentermap.com layer is on, that top project count shows the combined total, with a breakdown in parentheses of how many are tracked projects versus directory listings."],
    ["datacurrency-p1", "Regulations, projects, and the datacentermap.com layer are a periodically updated snapshot, not a live feed, someone checks the news and public filings and updates the map by hand. The two exceptions are the transmission line and gas pipeline layers, which fetch fresh data straight from public government sources every time you turn them on."],
    ["datacurrency-p2", "Even those two have limits worth knowing: about half of the transmission line data is missing voltage information at the source, and the gas pipeline dataset is a snapshot from January 2020, over six years old. Treat it as historically informative, not current."],
    ["report-p1", "Use the links in the banner above the map to share new information or report a problem, or reach the Mountain Association directly at <a href=\"mailto:energy@mtassociation.org\" style=\"color:#7d3c98;font-weight:600;\">energy@mtassociation.org</a>."],
  ];
  if (rows.length) sheet.getRange(2, 1, rows.length, 2).setValues(rows);
}

/**
 * Run THIS one directly from the function dropdown if you only need to
 * (re)build the instructions tab without touching anything else.
 */
function setupInstructionsTabOnly() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  setupInstructionsTab(ss);
  Logger.log('Instructions tab created.');
}

/**
 * A plain-language walkthrough of the review workflow, written directly
 * into the Sheet so it's discoverable by anyone who opens it, not just
 * whoever originally set this up. Placed as the very first tab (index 0)
 * so it's the first thing visible when the Sheet opens.
 */
function setupInstructionsTab(ss) {
  let sheet = ss.getSheetByName('How to Review');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('How to Review', 0);
  sheet.setColumnWidth(1, 720);

  const lines = [
    ['HOW TO REVIEW SUBMISSIONS, KY Data Center Map'],
    [''],
    ['WHEN SOMEONE SUBMITS THE ADD FORM (a new Regulation or Project):'],
    ['- A new row appears in the Regulations or Projects tab, highlighted yellow, Status = Pending Review.'],
    ['- You get an email. A new Moratorium also triggers a second, separate alert email.'],
    [''],
    ['WHEN SOMEONE SUBMITS THE REPORT FORM (a correction to something already on the map):'],
    ['- A new row appears in the PendingReview tab. It does NOT change the original entry automatically.'],
    ['- You get an email describing what they say needs to change.'],
    ['- Find the entry they mean in the right tab, and edit it by hand once you have checked the correction.'],
    [''],
    ['TO APPROVE OR REJECT A NEW SUBMISSION, THE EASY WAY:'],
    ['- Open this Sheet. Look for "Data Center Map Admin" in the menu bar at the top.'],
    ['- Click "Review next pending item". It shows the submission and asks: Approve, Reject, or Skip.'],
    ['- Click it again for the next one.'],
    [''],
    ['TO APPROVE OR REJECT BY HAND INSTEAD:'],
    ['- Find the yellow-highlighted row in Regulations, Projects, or DCFacilities.'],
    ['- Change its Status cell (there is a dropdown) to "Published" (goes live on the map) or "Rejected" (stays off).'],
    [''],
    ['WHAT EACH TAB IS FOR:'],
    ['Regulations: moratoriums, ordinances, and pending legislation shown on the map.'],
    ['Projects: individual data center projects shown on the map.'],
    ['DCFacilities: general colocation/hosting listings from datacentermap.com, a separate map layer.'],
    ['PendingReview: reported corrections to existing entries, waiting on someone to check and apply them by hand.'],
    ['CountyCentroids: fallback coordinates, used automatically when a submission has no address.'],
    ["HelpContent: the wording shown on the map's help page. Edit any row's Text to change it, no code needed."],
    [''],
    ['NOTHING GOES LIVE ON THE MAP UNTIL ITS STATUS SAYS "Published".'],
  ];
  sheet.getRange(1, 1, lines.length, 1).setValues(lines);
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  [3, 7, 12, 16, 20].forEach(r => sheet.getRange(r, 1).setFontWeight('bold'));
  sheet.getRange(lines.length, 1).setFontWeight('bold');
  sheet.setFrozenRows(1);
}
