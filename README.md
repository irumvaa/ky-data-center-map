# KY Data Center Map

Interactive map of proposed Kentucky data center projects, local moratoria/bans/ordinances,
and major electric transmission lines. Built in the same branded style as the Mountain
Association's eky-ev-map: county border shading, a search bar with autocomplete, a stats bar,
and pill-style filters.

## This map is fully static — no spreadsheet connection at all
Earlier versions of this map fetched the tracking sheets live so it would auto-update. That's
been removed. Every regulation and project record is baked directly into `index.html` as plain
JavaScript objects (`regulations` and `projects`). There is no reference to any spreadsheet URL,
sheet ID, or API key anywhere in this file, in view-source, or in the page's network traffic.
Transmission lines still load from a public third-party grid dataset (HIFLD, via a NASA-hosted
mirror) since that's public infrastructure data, not anything from the Mountain Association's
internal tracking.

**Trade-off:** this map will not reflect new spreadsheet edits automatically anymore. To update
it, regenerate the embedded `regulations` and `projects` data and rebuild `index.html` (or ask
Claude to do that from the current tracking sheets, the same way this version was built).

## Static enrichment
The Kentucky Lantern's July 7, 2026 roundup (updated July 24) of proposed/operating hyperscale
projects is folded into the `notes` and `stage` fields for matching projects, and several
counties from that article that weren't yet in the tracking sheet (Greenup, Hancock, Marshall,
McCracken, Pike, Wolfe, and the Kentucky Industrial Alliance project in Barren County) are
included as their own entries. This is a one-time snapshot, not live — it will drift out of date
as the underlying situation changes.

## Project marker logic
- If a project has a known city, it's pinned there (solid pin).
- If only a county is known, the marker is placed at that county's real geographic centroid
  (computed from the county polygon, not a stand-in city) and shown with a dashed outline, labeled
  "county-wide — exact site not yet public."

## Known limitations
- Since this is now a static snapshot, it needs to be manually regenerated to include new
  spreadsheet entries or Lantern updates.
- Transmission line data comes from a third-party public ArcGIS service (not something we
  control), so if that service is down or renamed, that layer will silently fail to load (map
  still works, just without that layer).
- The Mountain Association logo isn't embedded here — the banner uses a plain emoji badge
  instead (see branding note below).

## Branding note
This map reuses eky-ev-map's CSS/layout patterns but does not embed the actual Mountain
Association logo image (that would require retyping a large base64 string by hand, risking a
silent corruption). To add the real logo, copy the `<img src="data:image/png;base64,...">` line
from eky-ev-map's `.ma-banner` div and paste it in place of the `.ma-badge` div here.

## Deploy
Push to GitHub, enable GitHub Pages on the repo (same pattern as eky-ev-map).
