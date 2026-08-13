# KY Data Center Map

**Live map: https://irumvaa.github.io/ky-data-center-map/**

Interactive map of proposed Kentucky data center projects, local moratoria/ordinances/pending
legislation, and major transmission lines and gas pipelines. Built in the same branded style as
the Mountain Association's eky-ev-map: county border shading, a search bar with autocomplete, a
stats bar, and pill-style filters.

## This map is fully static — no spreadsheet connection at all
Every regulation and project record is baked directly into `index.html` as plain JavaScript
objects (`regulations` and `projects`). There is no reference to any spreadsheet URL, sheet ID,
or API key anywhere in this file, in view-source, or in the page's network traffic. Transmission
lines and gas pipelines still load live from public third-party government datasets, since
that's public infrastructure data, not anything from the Mountain Association's internal
tracking.

**Trade-off:** this map will not reflect new spreadsheet edits automatically. To update it,
regenerate the embedded `regulations` and `projects` data and rebuild `index.html` (or ask
Claude to do that from the current tracking sheets, the same way this version was built).

## Regulation categories
Moratorium, Ordinance, Pending/Proposed (per supervisor direction — "Ban" was dropped as a category
since no real entries used it; "Other" was later removed too, since it was redundant with the gray
"no known regulation" state — see the data convention note below). County shading has four states:
- **Colored by type** — an actual county-wide regulation
- **Diagonal stripes** (type color + amber) — the county has BOTH a county-wide regulation AND
  a separate city-level one inside it. A solid fill would hide one of those two facts, so this
  gets its own visual treatment. No county currently has both, but this is handled so it renders
  correctly if one ever does.
- **Amber** — at least one city inside the county has a regulation, but the county itself doesn't
- **Gray** — nothing on file at any level

**Data convention**: if a county appears on the tracking spreadsheet with no other information filled
in, that means there's no data yet — it should not be entered as a regulation record at all. An
"empty" entry and "not on the sheet" should look identical on the map: gray, "no known regulation."

**Duration convention**: when a regulation's known duration (e.g. "1 year") doesn't come with an
actual start or end date, just record the plain duration — "1 year", "2 years", "180 days" — rather
than restating it as a formula ("12 months from the effective date"). Keeps entries consistent, and
it's honest about what's actually known: a length of time, not a calendar date.

**Moratoria fall off the map automatically once they expire.** Each regulation's `expiration`
field (format `M/D/YY`) is checked against today's real date at page load; expired moratoria are
removed from the active dataset entirely before anything renders, so the county reverts to
whatever its next-true status is. Blank or unparseable expiration dates are left active rather
than guessed at.

## Project stages
Rumored, Proposed, Operating (per supervisor direction — renamed from Speculated/Planned/
Operating). Each stage has its own pin color, deliberately spread across different color
families (indigo, magenta, green) rather than shades of one hue, since early versions using
different lightnesses of purple were too easy to confuse from a distance.

## Project marker logic
- Known city → pinned there (solid pin).
- Only a county known → placed at that county's real geographic centroid (computed from the
  county polygon, not a stand-in city), shown with a dashed outline, labeled "county-wide —
  exact site not yet public."
- Where two distinct real projects share a county with no specific city (e.g. the two separate
  Carroll County projects), their display names are disambiguated by developer so they don't
  look like duplicate pins.

## Search
The search bar indexes every field on every record — developer, tenant, regulation type,
notes, tariff text, not just the name shown on the pin. Typing "TeraWulf" or "moratorium"
surfaces the matching projects/regulations directly, with a "matched: <field>" hint when the
match wasn't on the obvious name field. Multi-word queries require every word to appear
somewhere in the record (not necessarily together). Selecting a regulation result zooms straight
to it and opens its popup, the same way selecting a project does.

Also handles:
- **Typos** — a Levenshtein-distance fuzzy fallback catches things like "Terawlf" or
  "morotorium." Only kicks in for terms 5+ characters (shorter words collide too easily —
  "pipe" was accidentally matching "Pike" County before this limit was added, tested and fixed).
- **Units** — "500mw", "500 MW", and "500-MW" all match the same way; "megawatt"/"gigawatt"
  normalize to "mw"/"gw" so they match the abbreviated form actually used in the data.
- **Plurals** — mostly falls out of the typo tolerance above ("moratoriums" is edit-distance 1
  from "moratorium").
- **County search checks project data too** — previously a plain county-name search only looked
  at regulation records for that county, so a county with only a project (no regulation) and an
  unusual spelling wouldn't surface. Now it checks both.

## Popup fields
Regulations: Location, Type, Duration + Expiration (moratoria only), Source. (No individual
contact names are stored or shown — removed entirely from data, popups, and search.)
Projects: Location, Stage, Size, Developer, Planning & zoning, Utility status, Tariff,
Completion date, Tenant, Source. Every field always renders — missing data shows as
"Not available" (styled distinctly) rather than the row disappearing, so it's clear whether
something wasn't recorded versus doesn't apply. Tariff/Completion date/Tenant were researched
and filled in for the handful of best-documented projects; everywhere else, "Not publicly
disclosed" / "Not yet announced" is used rather than a guess.

## Color palette
Regulation types use the colorblind-safe Okabe-Ito palette (blue/teal/olive/crimson). Every
color on the map — regulation types, county states, project stages, transmission lines, gas
pipelines — was checked pairwise for hue/lightness separation to avoid look-alike colors. See
git history for the specific fixes made (e.g. Operating was originally green, which was too
close to Ordinance's teal; project stage colors were originally three shades of purple, which
read as near-identical from a distance).

## Transmission lines & gas pipelines (toggleable layers, off by default)
- **Transmission lines**: HIFLD's Electric Power Transmission Lines dataset, sourced via an
  Esri-hosted (`services2.arcgis.com`) copy rather than a single government agency's own server,
  for more reliable cross-origin loading. That copy's data was last edited **August 2025**.
  A known dataset-wide gap: a peer-reviewed review found ~52% of features are missing voltage
  data, which is why many popups show "unknown" there.
- **Gas pipelines**: EIA's natural gas transmission pipeline dataset, hosted via US DOT/BTS.
  This one is a static snapshot from **January 2020** — over six years old. No fresher
  Esri-hosted equivalent was found when checked.
- Both layers fail visibly (button text changes to "…unavailable") rather than silently, if the
  underlying government service is down or blocks the request.

## Known limitations
- **Two placeholder links need to be filled in**: the "share new information" and "report a
  problem" links in the banner under the header currently point to `#PLACEHOLDER-add-data-form`
  and `#PLACEHOLDER-report-problem-form` — search `index.html` for `PLACEHOLDER` to find and
  replace both once those Google Forms exist. The `energy@mtassociation.org` mailto link is
  already live.
- Static snapshot — needs manual regeneration to reflect new spreadsheet entries, Lantern
  updates, or newer transmission/pipeline data.
- Gas pipeline data is six-plus years old; treat it as historically informative, not current.

## Utility status vocabulary
**TSR = Transmission Service Request**, **ESA = Electric Service Agreement**. Going forward,
standardize new entries to one of: `TSR - Applied`, `TSR - Approved`, `ESA - Applied`,
`ESA - Approved`. A couple of existing entries just say a bare `TSR` (no applied/approved
distinction) since that's what the original source data had — left as-is rather than guessed
at, but the acronym itself is spelled out in the popup and searchable either way (e.g. searching
"transmission service request" finds them).

## Future: live data via Apps Script
The plan (same pattern as eky-ev-map) is a Google Apps Script Web App sitting in front of the
tracking sheets, so non-technical people can edit a spreadsheet directly, with a verification/
review step before anything reaches the public map — e.g. only rows marked "Approved" in a
status column get served. This map's code already has the fallback-then-live-refresh scaffolding
in place for that, currently inert:

- `DATA_SOURCE_URL` near the top of `index.html` is blank. As long as it's blank, the map runs
  exactly as it does today — 100% on the embedded data, zero network calls beyond map tiles and
  the transmission/pipeline layers. Nothing changes until someone deploys the Apps Script and
  pastes its URL in.
- Once that URL is filled in, the map renders instantly from the embedded fallback data (so it's
  never blank while waiting on a request), then quietly fetches the Apps Script endpoint in the
  background. If that succeeds, it swaps in the fresh data and re-renders. If it fails for any
  reason, the embedded data keeps the map fully working, silently.
- The Apps Script is expected to return JSON shaped exactly like this:
  ```json
  {
    "regulations": [ { "county": "...", "city": "...", "level": "County|City",
      "type": "Moratorium|Ordinance|Pending/Proposed", "period": "...",
      "expiration": "M/D/YY", "links": ["..."], "notes": "...", "lat": 0.0, "lng": 0.0 } ],
    "projects": [ { "name": "...", "city": "...", "county": "...", "size": "...",
      "developer": "...", "pz": "...", "utility": "...", "links": ["..."], "notes": "...",
      "stage": "Rumored|Proposed|Operating", "countyWide": false, "lat": 0.0, "lng": 0.0,
      "tariff": "...", "completionDate": "...", "tenant": "..." } ]
  }
  ```
  Same field names as the embedded `regulations`/`projects` arrays in `index.html` — that's not
  a coincidence, it means whoever builds the Apps Script can copy the shape directly from there.
- **No `contact` field** — that was removed from this map entirely (data, popups, search) and
  shouldn't be reintroduced through the live pipeline either.
- `lat`/`lng` need to be resolved before they reach the script (geocoded from city/county), the
  client doesn't do that itself.
- The client always uses the field values as-is; it does not re-verify anything. All review/
  approval logic needs to live in the Sheet + Apps Script, not here.

## Deploy
Pushed to GitHub Pages from the `main` branch of this repo — live at the URL at the top of this
file. No build step; `index.html` is the whole site.
