# Scriptline

Scriptline is a browser-based interactive timeline study aid that correlates Bible history with world history. It ships as a blank template — no history is pre-loaded — so each user researches and fills in their own timeline of events at their own pace, choosing their own chronology.

## Core Concept

- Dual-track timeline: biblical events and world-history events, viewable together on the same time axis.
- Continuous, smooth zoom (pinch, trackpad, mouse wheel) rather than discrete era screens.
- Entries carry a "tier" (1 = broadest, up to 4 = most specific). Tier's main job is controlling when an entry fades into view while zooming in. Higher tiers stay visible once shown; broader tiers don't disappear as you zoom further in.
- Entries can optionally nest under a "parent" entry (e.g. a person's lifespan as the broad container, with specific events from their life nested inside it). This is a thematic link, not a strict rule — a parent is optional at every tier, and an end date is optional too.
- Clicking an entry opens a rich card: a background image, date range, a "what happened" summary, a running (appendable, dated) research-notes log, an image/artwork gallery, and source notes.
- Every entry has a colour identifier — inherited from its broadest (tier 1) ancestor if nested, or defaulted by track (biblical / world-history) if standalone.

## Design Decisions

Decisions made and the reasoning behind them. Revisit deliberately, not by accident.

### Dates

- **Dates are stored in our own format, not the browser's date system** — year, era, precision (year / month / day), and an "approximate" flag.
- Why: the browser's dates have no year zero (year 0 *is* 1 BCE), so every BCE year would be stored one out from what the user typed, permanently, including in exported files. The browser's dates also demand a specific day and timezone, which most historical entries don't have.
- This buys: exports that read like English, honest recording of uncertainty ("c. 2348 BCE"), year-only dates with no invented month, and the freedom to change chronology later.
- Approximate dates should be drawn with a softer/fading edge so firm and estimated dates are visually distinguishable — valuable in a study aid about contested chronology.

### Era notation

- **BCE/CE is the default.** The project owner prefers it.
- Because era is stored per-date rather than baked into the numbers, notation is purely a display setting. Offer a preference toggle to BC/AD; changing it touches no stored data.

### Nesting and layout

- **Nesting is drawn visually**, not hidden behind interaction. A parent is a coloured band spanning its time range, acting as a header, with its children on the rows nearer the date ruler, within that span.
- A parent with no end date fades out at its right-hand edge rather than closing with a hard line — reads as "continues, or unknown".
- A child falling outside its parent's span is shown honestly rather than hidden. That's a real tension in the chronology and seeing it is the point.
- **Tier fixes vertical order.** Tier 1 on the rows furthest from the date ruler, deeper tiers on rows nearer it. Reading towards the ruler is reading broad → specific. (Changed 2026-09-19 at the owner's request — originally tier 1 sat next to the ruler.)
- **Zooming in, each new tier grows out of the ruler side and pushes the broader tiers outward.** Zoomed fully out, tier 1 sits right by the ruler.
- **The most detailed tier on screen is drawn larger** (about 1.6×) so it stands out; it shrinks back to normal as the next tier fades in. Zoomed out, tier 1 is big; zoomed in, the finest detail is. Owner's request, 2026-09-19.
- Each track has its own stack of rows.
- **The two tracks are mirrored around a central date ruler.** Biblical history above the ruler, stacking upward; world history below it, stacking downward. Chosen over stacking both tracks top-to-bottom: matching tiers sit mirrored across the ruler, so events of both histories are directly comparable — the core purpose of the app.
- **Tiers fade in by zoom level**: tier 1 always shows; tiers 2, 3 and 4 fade in as the visible span shrinks past roughly 2,500, 500 and 100 years. Starting defaults — tune by feel.
- **Zoom limits**: from about 12,000 years across the screen (fully out) to about 18 days (fully in). The ruler switches from years to months to days as you zoom.
- **Two tracks for now, more possible later.** Tracks are defined as a list in the code (`js/model.js`), so a third could be added without a rewrite; the mirrored layout would need rethinking at that point.
- Because tier decides the row, the hard row-packing problem mostly disappears. Only same-tier, same-family entries overlapping in time need nudging onto a half-row.

### Tier and parent fields

- Tier is a **selectable field**, auto-filled to one level deeper than the parent when a parent is chosen.
- **A parent must always be a shallower tier than its child** — otherwise a child would draw above its own parent. Enforced by only listing shallower-tier entries in the parent dropdown, so invalid combinations never appear rather than needing to be blocked.
- Zoom thresholds per tier: start with sensible defaults and tune by feel once it can be seen.

### Colour

- Colour is **family identity**, inherited from the broadest ancestor.
- The colour picker is only enabled on entries with no parent — that entry is the root of a family and defines its colour. Children show the inherited colour as a greyed-out swatch.
- Why: if children could pick freely, a family could end up in four colours and the whole scheme stops meaning anything.

### Rendering

- **The timeline is painted by us, not built on an off-the-shelf timeline library.**
- Why: every distinctive feature — our own date format, tier-based fading, drawn containment, soft edges for approximate dates — is something we'd write ourselves anyway. Using a library would mean using a fifth of it and fighting the rest, plus a dependency we don't control.
- Also: most timeline libraries create a page element per entry and start labouring in the hundreds. A filled-in Scriptline could carry thousands.
- **First run**: an empty timeline shows a short welcome with "Add your first entry" and an optional "Try it with sample entries". Samples are marked as such and can be removed in one go from Settings, so the app still ships blank.
- **A small helper library handles pan/zoom input only** (trackpad, pinch, momentum, scroll-vs-zoom). That part is fiddly to get right and has no opinions about timelines.
- For the first prototype, pan/zoom is hand-written (drag, wheel, trackpad, two-finger pinch) with no library. Swap in the helper library if the feel isn't right, especially momentum.
- Cards, forms and panels are ordinary HTML — real, selectable, accessible text.
- **A list view sits alongside the timeline**, searchable and sortable. Covers the accessibility gap left by a painted timeline, and is genuinely useful for finding a half-remembered entry.

### Interaction

- Short label painted on the timeline → click opens the card → edit button on the card opens the edit form.
- Reading and editing are separate modes, so research can't be altered by accident while browsing.
- **The card opens as a full overlay**, covering the timeline. Chosen over a side panel: it gives the background image and gallery room to breathe. Cost: the timeline is hidden while reading, so closing the card should return the user to exactly where they were.
- **The card's background image is a banner** across the top, with the card's text on a plain background beneath. Chosen over a full darkened background: long research notes stay easy to read, and the picture isn't obscured by text.
- **Research notes show newest first.** Later research often corrects earlier notes, so the current thinking should be what's seen first.
- **Research notes can be freely edited or deleted.** If a note turns out to be inaccurate, the owner wants to fix or remove it rather than leave it standing with a correction beneath.
- **Each gallery picture has an optional caption and an optional credit** (who made it, where it was found). Optional so a picture can be added quickly and described later; the credit matters for a study aid, especially when entries are shared.
- **Source notes are a list of sources**, each a single line of free text (e.g. "2 Kings 18:13") with an optional web link that becomes clickable. Chosen over one free text box (gets messy) and a detailed citation form (too slow to fill in).
- **Dropped:** hover/click to brighten an entry's family and dim the rest. The permanent colour banding does that job. Possible later if busy stretches prove hard to follow.

### Storage and files

- **Browser storage (IndexedDB) is the live store for everyone.** Not localStorage — it's far too small for artwork and only holds text.
- **Optional folder sync on Chrome/Edge desktop**: one file per entry, plus a pictures folder, with pictures referenced by name rather than embedded.
- Why one file per entry: corruption can't take everything; git gets a meaningful history ("added Hezekiah's reign") instead of one giant file changing every time; and sharing an entry is just sending that file.
- The folder can't be the only mode — Firefox and Safari can't write to a folder — hence browser storage as the universal base with folder sync as an extra.
- **Backup is one zip file** laid out like the sync folder: `backup.json`, `entries/<title>--<id>.json` (one per entry), `pictures/<id>.<ext>`. One download is all a browser can offer; the layout inside keeps it compatible with folder sync later. Zip handling is our own small code, so it works offline with no library.
- **Restore asks each time**: *Merge* (keep current entries; the backup's version wins where both have the same entry) or *Replace everything* (with a second confirmation). The owner chose this over a fixed behaviour.
- **Data carries a version stamp from the very first entry**, and the app quietly upgrades older data on load. Fields *will* be added once real entries are being written; this is what makes that cheap instead of frightening, and keeps old backups openable.

### Platform

- **Web app on GitHub Pages.** Others will use this — the owner has told people about it and they're keen — so "click a link and you're using it" beats "install this".
- Desktop app (Linux / Windows / macOS via Tauri) stays possible later from the same code, and nothing here forecloses it.
- Deferred because unsigned apps trigger OS security warnings; removing those costs money annually (~£75/year Apple, a couple of hundred for Windows). That's *more* friction for newcomers, not less.
- **Designed desktop-first** — four tiers of nested rows need width. Phones fall back to the list view rather than a cramped timeline.

## Tech Stack

- Static, browser-based site — no backend.
- Timeline rendering: painted by us (canvas). Pan/zoom is currently hand-written; a small helper library may replace it. Not vis-timeline or similar.
- UI (cards, forms, panels, list view): ordinary HTML.
- Data: JSON, versioned, stored in IndexedDB per-user — no accounts, no server.
- Hosting: GitHub Pages.
- Backup/restore: one zip file (JSON per entry + pictures folder inside), built with our own small zip code. Used for safety and for moving data between devices.
- No build step and no dependencies: plain HTML, CSS and classic `<script>` files, so `index.html` also works when double-clicked from a downloaded copy.
- For the project owner specifically: folder sync on Chrome → git commit to a personal repo as remote backup, rather than live API sync.

## Current State (2026-09-19)

- **Live:** https://8chubby8.github.io/scriptline/ — repo https://github.com/8chubby8/scriptline (public, GitHub Pages from `main`, root folder). Pushing to `main` updates the live site in a minute or two.
- **Built:** the first prototype, covering everything in CHANGELOG.md — timeline, cards, edit form, list view, settings, sample entries, backup/restore, and the persistent-storage request.
- **Files:** `index.html`, `css/style.css`, and `js/` — `dates.js` (our date format), `store.js` (IndexedDB, data version + upgrades), `model.js` (tracks, families, colours), `timeline.js` (canvas painter + input), `zip.js` + `backup.js` (backup/restore), `samples.js`, `app.js` (cards, form, list, settings).
- **Testing:** no Node on this machine. Tested with Playwright + headless Firefox in a throwaway Python venv in the session scratchpad, serving the folder with `python3 -m http.server`. Recreate as needed; never add test tooling to the repo.
- **Next up:** see ROADMAP.md — the owner is trying the prototype and will report what to tune.

## Open Questions

Still to decide:

1. **Sharing an entry** — pictures are referenced, not embedded, so a shared entry arrives without them. **Deferred to a later version** by the owner's choice; not needed for the first release. Leading idea when revisited: a "Share" button that packs the entry and its pictures into one bundle file.

## Notes

- This is a template, not a dataset — the app ships empty. Each user's chronology, entries, and structure are entirely their own.
- Maintain a ROADMAP.md for planned work and a CHANGELOG.md for released changes as the project develops.
