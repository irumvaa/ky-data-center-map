# KY Data Center Map

**Live map: https://irumvaa.github.io/ky-data-center-map/**
**Help page: https://irumvaa.github.io/ky-data-center-map/help.html**
**Add new information: https://docs.google.com/forms/d/e/1FAIpQLSd58xrJlaw8Q4p_KKFLgcYCe-b4aMT24aTg-RXbaSpQYIkjGA/viewform**
**Report a problem: https://docs.google.com/forms/d/e/1FAIpQLSdesw2Kg_b3gLVBDlniFzPOf9B7ms_Qsz_Ar0fnIjoIYCh3jg/viewform**

Interactive map of proposed Kentucky data center projects, local moratoria/ordinances/pending
legislation, and major transmission lines and gas pipelines. Built in the same branded style as
the Mountain Association's eky-ev-map: county border shading, a search bar with autocomplete, a
stats bar, and pill-style filters.

## Live data, with a static fallback
This map is backed by a Google Sheet through a Google Apps Script Web App (see "Live data via
Apps Script" below), so non-technical people can add or correct information through a form
without anyone editing this file directly. Every regulation, project, and datacentermap.com
facility is *also* baked directly into `index.html` as plain JavaScript objects, this is the
fallback the map renders immediately on load and falls back to completely if the live source is
ever unreachable, so a Sheet/Apps Script outage never breaks the public map. Transmission lines
and gas pipelines still load live from public third-party government datasets, unrelated to the
Mountain Association's own Sheet.

**Trade-off:** the embedded fallback data is a snapshot, not automatically kept in sync with the
Sheet. If the live pipeline is ever down for a while, the map keeps working but may show slightly
stale data until the fallback is manually regenerated (ask Claude to pull the current Sheet data
and rebuild `index.html`'s embedded arrays, the same way this version was built).

## Regulation categories
Moratorium, Ordinance, Pending/Proposed (per supervisor direction, "Ban" was dropped as a category
since no real entries used it; "Other" was later removed too, since it was redundant with the gray
"no known regulation" state, see the data convention note below). County shading has four states:
- **Colored by type**: an actual county-wide regulation
- **Diagonal stripes** (type color + amber): the county has BOTH a county-wide regulation AND
  a separate city-level one inside it. A solid fill would hide one of those two facts, so this
  gets its own visual treatment. No county currently has both, but this is handled so it renders
  correctly if one ever does.
- **Amber**: at least one city inside the county has a regulation, but the county itself doesn't
- **Gray**: nothing on file at any level

**Data convention**: if a county appears on the tracking spreadsheet with no other information filled
in, that means there's no data yet. It should not be entered as a regulation record at all. An
"empty" entry and "not on the sheet" should look identical on the map: gray, "no known regulation."

**Duration convention**: when a regulation's known duration (e.g. "1 year") doesn't come with an
actual start or end date, just record the plain duration, such as "1 year", "2 years", or "180 days",
rather than restating it as a formula ("12 months from the effective date"). Keeps entries consistent,
and it's honest about what's actually known: a length of time, not a calendar date.

**Moratoria fall off the map automatically once they expire.** Each regulation's `expiration`
field (format `M/D/YY`) is checked against today's real date at page load; expired moratoria are
removed from the active dataset entirely before anything renders, so the county reverts to
whatever its next-true status is. Blank or unparseable expiration dates are left active rather
than guessed at.

## Project stages
Rumored, Proposed, Operating (per supervisor direction, renamed from Speculated/Planned/
Operating). Each stage has its own pin color, deliberately spread across different color
families (indigo, magenta, green) rather than shades of one hue, since early versions using
different lightnesses of purple were too easy to confuse from a distance.

## Project marker logic
- Known city: pinned there (solid pin).
- Only a county known: placed at that county's real geographic centroid (computed from the
  county polygon, not a stand-in city), shown with a dashed outline, labeled "county-wide,
  exact site not yet public."
- Where two distinct real projects share a county with no specific city (e.g. the two separate
  Carroll County projects), their display names are disambiguated by developer so they don't
  look like duplicate pins.

## Search
The search bar indexes every field on every record, including developer, tenant, regulation type,
notes, tariff text, and now the datacentermap.com directory layer too, not just the name shown
on the pin. Typing "TeraWulf" or "moratorium" surfaces the matching projects/regulations/
facilities directly, with a "matched: <field>" hint when the match wasn't on the obvious name
field. Multi-word queries require every word to appear somewhere in the record (not necessarily
together). Selecting any result zooms straight to it and opens its popup.

**City search**: every city mentioned anywhere across regulations, projects, or the directory
layer (27 cities total) is independently searchable, resolves to its actual county, and zooms
directly to that city's real coordinates rather than the county centroid. This works even for
cities with no tracked project or regulation of their own, like Wilmore or Prospect, which are
only on the map because a directory-layer facility happens to be there.

Also handles:
- **Typos**: a Levenshtein-distance fuzzy fallback catches things like "Terawlf" or
  "morotorium." Only kicks in for terms 5+ characters, since shorter words collide too easily
  ("pipe" was accidentally matching "Pike" County before this limit was added, tested and fixed).
- **Units**: "500mw", "500 MW", and "500-MW" all match the same way; "megawatt"/"gigawatt"
  normalize to "mw"/"gw" so they match the abbreviated form actually used in the data.
- **Comma-formatted numbers**: "140,000" and "140000" match either way.
- **Plurals**: mostly falls out of the typo tolerance above ("moratoriums" is edit-distance 1
  from "moratorium").
- **County search checks all three datasets**: previously a plain county-name search only
  looked at regulation records for that county. Now it checks regulations, projects, and the
  directory layer, so e.g. Jessamine County (which has no tracked regulation or project) still
  surfaces when searched, because KUSI Data Center is there.
- **"County" suffix, everywhere**: "Boyd County" matches the same as "Boyd" alone, and this
  holds even in combined searches like "Ordinance Fayette County" or "moratorium Boyd County",
  not just a bare county name. The word "county" is stripped as filler from every search term,
  since most project records don't literally contain the word "county" and would otherwise fail
  to match once it's added to the query (tested and fixed after finding this exact case broke
  project matching while regulation matching stayed fine). The dedicated county-wide/city-level
  phrase detection above reads the raw typed text directly, not this filtered term list, so
  stripping "county" here doesn't affect it.
- **Minimum query length**: suggestions only appear once you've typed at least 2 characters. A
  single letter matches almost any text as a substring, so typing "a" was flooding the dropdown
  with nearly the entire map (all 38 relevant counties, all 27 projects, all 25 facilities)
  before this was added.
- **County-wide vs. city-level, as structured concepts**: searching "county wide", "county-wide",
  "countywide", "city level", "city-level" surfaces every county with a matching regulation
  (checked against the actual `level` field) or, for county-wide, a project's `countyWide` flag.
  This is checked against real data, not fuzzy text, since regulation notes often say things
  like "Daviess County Fiscal Court approved..." regardless of whether that regulation is
  actually county-wide or city-only, so text matching alone would give false positives. The
  county suggestion list itself was also capped at 4 results no matter how many actually
  matched, so a broad search like "moratorium" (which matches roughly 18 counties) was only
  ever showing the first 4; raised the cap and added scroll to the dropdown to support it.

## Popup fields
Regulations: Location, Type, Duration + Expiration (moratoria only), Source. (No individual
contact names are stored or shown; that data was removed entirely from data, popups, and search.)
Projects: Location, Stage, Size, Developer, Planning & zoning, Utility status, Tariff,
Completion date, Tenant, Source. Every field always renders; missing data shows as
"Not available" (styled distinctly) rather than the row disappearing, so it's clear whether
something wasn't recorded versus doesn't apply. Tariff/Completion date/Tenant were researched
and filled in for the handful of best-documented projects; everywhere else, "Not publicly
disclosed" / "Not yet announced" is used rather than a guess. Notes fields are capped at 70
words. Every other popup field (Size, Developer, Planning & zoning, Utility status, Tariff,
Completion date, Tenant, Duration) is capped at one sentence, 20 words or fewer. When something
important doesn't fit in that space, it goes in Notes instead, not into the field itself. The
idea: fields stay scannable, and anyone who wants more detail can check the source link.

## Color palette
Regulation types: Moratorium is blue, Ordinance is turquoise, Pending/Proposed is crimson.
Every color on the map, including regulation types, county states, project stages, transmission
lines, and gas pipelines, was checked pairwise for hue/lightness separation to avoid look-alike
colors. See git history for the specific fixes made. Both Ordinance and Pending/Proposed were
originally shades of green, colliding with the unrelated project-stage "Rumored" green on a
different map layer. Fixing that took several iterations, checked with actual hue-angle and
RGB-distance math each time rather than just eyeballing it: Ordinance went green (too close to
Rumored) → violet (too close to Moratorium's blue and the Proposed-stage indigo, still in the
same blue-purple hue family) → turquoise, chosen after mapping every hue currently in use and
picking the one genuinely open gap on the color wheel (between green at 142° and blue at 202°).
Pending/Proposed went green (same original problem) → vermillion → gold (both too close to the
existing amber "city-only" color) → crimson, chosen after checking worst-case RGB distance
against the full palette.

## General colocation/hosting listing (toggleable layer, off by default)
"DC from datacentermap.com" shows 25 facilities pulled from all 12 of datacentermap.com's
Kentucky markets, ordinary commercial colocation/hosting providers (Flexential, Lumen, Cogent,
BluegrassNet, CBTS, CyrusOne, etc.), not the tracked hyperscale/AI projects this map otherwise
covers. Popups show Operator, Developer, Status, Size/Capacity, Address, and a source link.
Rendered as a square marker (never confused with the teardrop project pins), colored by the
Status field: indigo for Proposed and magenta for Operational, reusing the exact same colors
as the matching project stage since they're the same real-world concept on a different data
layer; orange for Under construction; muted stone-gray for Unknown/unconfirmed (also the
fallback for any unrecognized status text). Status text in the underlying data is inconsistent
free text rather than a clean enum, so this is classified by keyword
(`otherDCStatusKey()`), not an exact match. Both the marker color and the legend counts derive
from that single classifier function, so they can't drift out of sync with each other.
Coordinates are approximate for facilities without a specific address (city-level with
manual jitter), exact where a street address was confirmed. Cross-checked against a manually
researched spreadsheet, which caught a real error (an entry called "SUBTAC" was actually a
different facility, KUSI Data Center, in Wilmore/Jessamine County, not Lexington/Fayette as
originally listed) and added one facility (Gearheart Communications, Lexington) not previously
found. Maysville, Harrodsburg, and Cave City's single listing still aren't included,
datacentermap.com's page-view limit blocked enough direct access to confirm real facility
names/addresses for those three; adding them from the spreadsheet risked pulling in listings
that actually duplicate already-tracked projects there (Mason County Campus, Project Bluegrass,
and 2001 Doyle Avenue all turned out to be the same real projects already on the main map).
9 listings that duplicate already-tracked projects (TeraWulf/Hawesville, Carrollton/PowerHouse,
Camp Ground Road, Project Lincoln, both Calvert City facilities, Riot Platforms Paducah,
DartPoints Lexington/LexMark, TeraWulf Muskie/Ashland) were excluded.

## Transmission lines & gas pipelines (toggleable layers, off by default)
- **Transmission lines**: HIFLD's Electric Power Transmission Lines dataset, sourced via an
  Esri-hosted (`services2.arcgis.com`) copy rather than a single government agency's own server,
  for more reliable cross-origin loading. That copy's data was last edited **August 2025**.
  A known dataset-wide gap: a peer-reviewed review found ~52% of features are missing voltage
  data, which is why many popups show "unknown" there.
- **Gas pipelines**: EIA's natural gas transmission pipeline dataset, hosted via US DOT/BTS.
  This one is a static snapshot from **January 2020**, over six years old. No fresher
  Esri-hosted equivalent was found when checked.
- **Both layers always check the live source first**, every time the toggle is clicked, so
  updates to either government dataset show up automatically with no code changes needed here.
  If the live fetch fails (source down, moved, or its structure changed), the map falls back to
  the last successfully fetched copy, cached in the visitor's browser via `localStorage`, and
  the button label says so ("cached 3 days ago, live source unavailable") rather than silently
  showing stale data as if it were current. Only shows "...unavailable" when there's truly
  nothing to fall back on, e.g. the very first time anyone loads the map after the source goes
  down. This fetch-with-cache-fallback pattern is deliberately not used for the
  datacentermap.com directory layer below, since that source isn't a public API meant for
  repeated automated access the way these two are (see that section for why).

## Known limitations
- Embedded fallback data is a snapshot; needs manual regeneration to reflect new Sheet entries,
  Lantern updates, or newer transmission/pipeline data if the live pipeline is ever down for a
  while.
- Gas pipeline data is six-plus years old; treat it as historically informative, not current.

## Utility status vocabulary
**TSR = Transmission Service Request**, **ESA = Electric Service Agreement**. Going forward,
standardize new entries to one of: `TSR - Applied`, `TSR - Approved`, `ESA - Applied`,
`ESA - Approved`. A couple of existing entries just say a bare `TSR` (no applied/approved
distinction) since that's what the original source data had, left as-is rather than guessed
at, but the acronym itself is spelled out in the popup and searchable either way (e.g. searching
"transmission service request" finds them).

**This field is for status only, never a utility company name.** That distinction got blurred
for a while (several entries had things like "Owen Electric Cooperative" or "LG&E/KU" sitting in
Utility status), which doesn't fit the TSR/ESA convention above and isn't actually a status. The
utility's name belongs in the Tariff field instead, since tariffs are utility-specific anyway
(e.g. "Owen Electric Cooperative service territory... EHLF tariff"). If a project's utility is
known but its TSR/ESA status isn't, leave Utility status blank ("Not available") rather than
putting the company name there as a stand-in.

## Live data via Apps Script (Regulations, Projects, DC facilities, and help.html's wording)
A Google Apps Script Web App sits in front of a Google Sheet. The map renders instantly from
the data embedded in `index.html` (so it's never blank while waiting on a network request),
then quietly fetches the live Sheet in the background and swaps in the fresh data if that
succeeds. If the fetch fails for any reason, the embedded data keeps the map fully working,
silently, nothing breaks. `help.html`'s wording works the same way, with its own fallback text
built into the page.

Two separate Google Forms feed the Sheet: **Add new information** (a new Regulation or a new
Project) and **Report a problem** (a correction to an existing Regulation, Project, or DC
facility). They're kept separate on purpose, "add something new" and "something's wrong with
what's already here" are different enough tasks that one long branching form made the first
question do too much work. Both write into the same Sheet, just different tabs.

**Nothing submitted goes live automatically.** New regulations and projects land in their sheet
tab marked Status = "Pending Review" (highlighted light yellow), and only appear on the map once
someone flips that cell to "Published." Reported corrections land in a separate PendingReview
tab instead, since those are proposed edits to already-published rows, not new rows of their
own; apply them by hand in the relevant tab once reviewed. Data-validation dropdowns on the
Level/Type/Stage/Status columns help prevent typos there from silently breaking the map's
coloring logic. A "Data Center Map Admin" menu inside the Sheet (Review next pending item) walks
through pending submissions one at a time, showing the real submitted fields and letting you
Approve, Reject, or Skip right there, so nobody has to scroll hunting for the yellow rows
themselves.

**Geocoding**: when a Project submission includes an address or a Google Maps link, the backend
tries to resolve real coordinates for it (address via Apps Script's built-in geocoder, a Maps
link by parsing the `@lat,lng` or `q=lat,lng` pattern out of the URL). If neither is given, or
geocoding fails, it falls back to the submitted county's centroid, the same coordinates the map
already uses for "county-wide, exact site unknown" projects.

The full backend lives in `gas-setup/` in this repo:
- **Code.gs**: the Web App (serves map data and help.html's content as JSON), form-submission
  handling, geocoding, the admin review menu, and email notifications (a submission confirmation
  and a moratorium-specific alert on every new regulation submission, plus a daily check that
  emails when a published moratorium expires).
- **SetupForm.gs**: run once to programmatically build both Forms (`createAddForm()` and
  `createReportForm()`), branching logic included, so nobody hand-builds 30+ questions in
  Google's UI.
- **SetupSheetAndMigrateData.gs**: run once to create every tab this system needs (Regulations,
  Projects, DCFacilities, PendingReview, CountyCentroids, HelpContent) with headers and
  data-validation dropdowns, pre-populated with the map's full current dataset and all 120 KY
  county centroids. `setupHelpContentTab(ss)` needs an `ss` argument and will error if run
  directly from the function dropdown; use `setupHelpContentTabOnly()` instead if you only need
  to (re)build that one tab without touching anything else.

See that folder's file-level comments for full setup steps (creating the Sheet, running the
setup functions, linking both Forms' responses to it, setting the triggers, deploying). A few
things worth knowing if you're troubleshooting a deployment:
- **Updating an existing deployment can silently fail to take effect.** If Deploy → Manage
  deployments → New version doesn't seem to change what the URL serves even after saving and
  confirming the code is correct, don't keep retrying the same path, create a genuinely new
  deployment instead (Deploy → New deployment), which gives a new URL guaranteed to run the
  current code.
- **A brand new deployment can 404 immediately after creation** for some external, non-browser
  fetch tools, even while working correctly for real visitors (confirmed both logged in and in
  a private/incognito window). If an automated check gets a 404 right after deploying, that
  doesn't necessarily mean anything is wrong, check it in an actual browser before assuming the
  deployment is broken.
- **`SpreadsheetApp.openById()` on a slightly wrong Sheet ID throws "Illegal spreadsheet id or
  key"** naming the exact bad ID in the error, useful for spotting a copy-paste slip (an extra
  or missing character) by comparing it directly against the Sheet's real URL.

The Apps Script's `doGet()` returns JSON shaped exactly like this for the main map data:
```json
{
  "regulations": [ { "county": "...", "city": "...", "level": "County|City",
    "type": "Moratorium|Ordinance|Pending/Proposed", "startDate": "...", "period": "...",
    "expiration": "M/D/YY", "address": "...", "links": ["..."], "notes": "...",
    "lat": 0.0, "lng": 0.0 } ],
  "projects": [ { "name": "...", "city": "...", "county": "...", "address": "...",
    "size": "...", "developer": "...", "pz": "...", "utility": "...", "links": ["..."],
    "notes": "...", "stage": "Rumored|Proposed|Operating", "countyWide": false,
    "lat": 0.0, "lng": 0.0, "tariff": "...", "completionDate": "...", "tenant": "..." } ],
  "otherDataCenters": [ { "name": "...", "operator": "...", "developer": "...",
    "status": "...", "size": "...", "address": "...", "city": "...", "county": "...",
    "lat": 0.0, "lng": 0.0, "link": "..." } ]
}
```
Same field names as the embedded arrays in `index.html`, not a coincidence, the Apps Script
reads directly off these names, so this file and that backend can't drift apart. With
`?content=help` appended to the URL, it instead returns a flat `{key: text}` object read from
the HelpContent sheet tab, which is what `help.html`'s own fetch script consumes.

**No `contact` field**: that was removed from this map entirely (data, popups, search) and isn't
reintroduced through the live pipeline either. Submitters can optionally leave their own email
for follow-up questions, but that stays in the Sheet, it's never published to the map.

The client always uses fetched field values as-is; it does not re-verify anything. All review/
approval logic lives in the Sheet + Apps Script, not in `index.html` or `help.html`.

## Deploy
Pushed to GitHub Pages from the `main` branch of this repo, live at the URL at the top of this
file. No build step; `index.html` is the whole site. `DATA_SOURCE_URL`, `ADD_FORM_URL`,
`REPORT_FORM_URL` (in `index.html`) and `HELP_DATA_SOURCE_URL` (in `help.html`) are currently
set to a live deployment, updating any of them means redeploying the Apps Script and pasting
the new URL into both files.
