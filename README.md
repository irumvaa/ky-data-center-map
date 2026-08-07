# KY Data Center Map

Interactive map of proposed Kentucky data center projects, local moratoria/bans/ordinances,
and major electric transmission lines. Built in the same branded style as the Mountain
Association's eky-ev-map: county border shading, a search bar with autocomplete, a stats bar,
and pill-style filters.

## Data sources (live, refreshed on page load)
- Regulations: pulled from the Mountain Association's internal tracking sheet (not linked here)
- Proposed projects: pulled from the Mountain Association's internal tracking sheet (not linked here)
- Transmission lines: HIFLD Open (NASA NCCS ArcGIS mirror), queried live by KY bounding box
- County boundaries + centroids: static files (`county_centroids.json` here; county polygons are
  embedded directly in `index.html`), built from US Census county shapes

The two tracking-sheet URLs live only inside `index.html`'s `REGULATION_CSV` and `PROJECTS_CSV`
constants, not documented here, since this README may end up more widely shared than the sheets
themselves.

## Static enrichment (not live)
The Kentucky Lantern's July 7, 2026 roundup (updated July 24) of proposed/operating hyperscale
projects is baked into `index.html` as `LANTERN_STAGE` and `LANTERN_DESC`. It adds a development
stage (Speculated/Planned/Operating) and a short paraphrased description to matching counties, and
adds county-level markers for projects the article reported that aren't yet in the tracking
spreadsheet (Greenup, Hancock, Marshall, McCracken, Pike, Wolfe, and the Kentucky Industrial
Alliance project in Barren County). Since this came from a snapshot article rather than a live
source, it won't update itself — if the Lantern's map changes significantly, these sections need a
manual refresh.

## Fallback-then-live-refresh pattern
The map renders instantly from data embedded directly in `index.html` (`regulations` and
`projects` arrays), so it's never blank while waiting on a network request. It then quietly
fetches the live tracking sheets in the background; if that succeeds, the map updates in place. If
it fails for any reason, the embedded fallback data keeps the map fully functional.

## Project marker logic
- If a spreadsheet row has a known city, the project is pinned there (solid pin).
- If only a county is known, the marker is placed at that county's real geographic centroid
  (computed from the county polygon, not a stand-in city) and shown with a dashed outline, labeled
  "county-wide — exact site not yet public."

## Known limitations / things to watch
- **City geocoding is a hardcoded lookup**, not a real geocoder (`CITY_COORDS` in `index.html`).
  If a new city shows up in either sheet that isn't in that list, its marker falls back to the
  county centroid until you add coordinates for it.
- The "various" rollup row (linking to a Courier-Journal roundup article) is skipped from point
  mapping since it has no single location.
- Transmission line data comes from a third-party public ArcGIS service (not something we control),
  so if that service is down or renamed, that layer will silently fail to load (map still works,
  just without that layer).
- The regulation sheet has a stray reference URL in row 1 above the real header row; the loader
  strips it automatically, but if the sheet's structure changes significantly, re-check this.
- The Lantern enrichment (see above) is a one-time snapshot, not live. It will drift out of date.
- The Mountain Association logo isn't embedded here (see note below) — the banner uses a plain
  emoji badge instead.

## Branding note
This map reuses eky-ev-map's CSS/layout patterns but does not embed the actual Mountain
Association logo image (that would require retyping a large base64 string by hand, risking a
silent corruption). To add the real logo, copy the `<img src="data:image/png;base64,...">` line
from eky-ev-map's `.ma-banner` div and paste it in place of the `.ma-badge` div here.

## Deploy
Push to GitHub, enable GitHub Pages on the repo (same pattern as eky-ev-map).
