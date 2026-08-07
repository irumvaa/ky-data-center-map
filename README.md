# KY Data Center Map

Interactive map of proposed Kentucky data center projects, local moratoria/bans/ordinances,
and major electric transmission lines.

## Data sources (live, refreshed on page load)
- Regulations: [Google Sheet](https://docs.google.com/spreadsheets/d/1GFwP3z1mrcX-drzTPJm6TnAbb7NWQ-nVpfIZ21jGlGs)
- Proposed projects: [Google Sheet](https://docs.google.com/spreadsheets/d/12N9YO7LCQTfqThe5cWLLlG-5kKpePWFBX3Jw3xRbrJI)
- Transmission lines: HIFLD Open (NASA NCCS ArcGIS mirror), queried live by KY bounding box
- County boundaries + centroids: static files (`ky_counties.json`, `county_centroids.json`), built from US Census county shapes

## Static enrichment (not live)
The Kentucky Lantern's July 7, 2026 roundup (updated July 24) of proposed/operating hyperscale
projects is baked into `index.html` as `LANTERN_STAGE`, `LANTERN_DESC`, and `LANTERN_ONLY_PROJECTS`.
It adds a development stage (Speculated/Planned/Operating) and a short paraphrased description to
matching counties, and adds county-level markers for projects the article reported that aren't yet
in the tracking spreadsheet (Greenup, Hancock, Marshall, McCracken, Pike, Wolfe, and the Kentucky
Industrial Alliance project in Barren County). Since this came from a snapshot article rather than
a live source, it won't update itself — if the Lantern's map changes significantly, these sections
need a manual refresh.

## Project marker logic
- If a spreadsheet row has a known city, the project is pinned there (solid purple diamond).
- If only a county is known, the marker is placed at that county's real geographic centroid
  (computed from the county polygon, not a stand-in city) and shown as a dashed circle, labeled
  "county-wide — exact site not yet public." This replaced an earlier version that guessed the
  county seat, which was misleading since a lot of these projects aren't anywhere near the seat.

## How live sync works
The map fetches both Google Sheets as CSV on every page load (`export?format=csv&gid=...`).
Whoever edits the sheets doesn't need to tell you — it picks up changes automatically. There is
no caching step and no API key involved, since both sheets are shared as "anyone with the link
can view."

## Known limitations / things to watch
- **City geocoding is a hardcoded lookup**, not a real geocoder (`CITY_COORDS` in `index.html`).
  If a new city shows up in either sheet that isn't in that list, its marker falls back to the
  county centroid until you add coordinates for it.
- The "various" rollup row (linking to the Courier-Journal roundup article) is skipped from point
  mapping since it has no single location.
- Transmission line data comes from a third-party public ArcGIS service (not something we control),
  so if that service is down or renamed, that layer will silently fail to load (map still works,
  just without that layer — a status message will note it).
- The regulation sheet has a stray reference URL in row 1 above the real header row; the loader
  strips it automatically, but if the sheet's structure changes significantly, re-check this.
- The Lantern enrichment (see above) is a one-time snapshot, not live. It will drift out of date.

## Deploy
Push to GitHub, enable GitHub Pages on the repo (same pattern as eky-ev-map).
