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
Moratorium, Ordinance, Pending/Proposed, Other (per supervisor direction — "Ban" was dropped as
a category since no real entries used it). County shading has three states:
- **Colored by type** — an actual county-wide regulation
- **Amber** — at least one city inside the county has a regulation, but the county itself doesn't
- **Gray** — nothing on file at any level

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
The search bar indexes every field on every record — developer, tenant, contact name,
regulation type, notes, tariff text, not just the name shown on the pin. Typing "TeraWulf",
"Cara Cooper", or "moratorium" surfaces the matching projects/regulations directly, with a
"matched: <field>" hint when the match wasn't on the obvious name field. Multi-word queries
require every word to appear somewhere in the record (not necessarily together). Selecting a
regulation result zooms straight to it and opens its popup, the same way selecting a project
does.

## Popup fields
Regulations: Location, Type, Duration + Expiration (moratoria only), Contact, Source.
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
- Static snapshot — needs manual regeneration to reflect new spreadsheet entries, Lantern
  updates, or newer transmission/pipeline data.
- Gas pipeline data is six-plus years old; treat it as historically informative, not current.

## Deploy
Pushed to GitHub Pages from the `main` branch of this repo — live at the URL at the top of this
file. No build step; `index.html` is the whole site.
