---
phase: 12-home-screen-widget
plan: 05
subsystem: ui
tags: [react-native-android-widget, remoteviews, sqlite, recency-dao, headless, widget, node-sqlite]

# Dependency graph
requires:
  - phase: 12-02
    provides: react-native-android-widget install + FlexWidget/ImageWidget/TextWidget primitives
  - phase: 12-03
    provides: encodeWidgetThumb (base64 tile encoder) + widgetPalette/ringColor/ringWeight (headless colour resolver)
  - phase: 12-04
    provides: loadWidgetTiles/WidgetTile shaper + owner-ratified Log→Profile URI (orbit://contact/{id})
  - phase: 04-log
    provides: recordTouchpoint single-writer recency DAO + one-tap defaults
provides:
  - "widgetMarkContacted(exec, contactId, now) — headless single-writer widget mark seam (node:sqlite tested)"
  - "renderFavourites(widgetInfo?) — size-driven RemoteViews tree (small mark-grid / large action list / empty prompt)"
  - "pickLayout(widgetInfo?) — pure small/large size switch with per-bucket capacity"
affects: [12-06, 12-07, 12-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Headless write seam delegates to the mutexed recency DAO (widgetMarkContacted → recordTouchpoint), never a raw last_contact write, never a nested transaction — the widget analog of the notification headless mark"
    - "Fresh newUid() per widget tap (distinct rows) vs the notification path's deterministic exactly-once uid — genuine repeat taps are separate interactions"
    - "Headless RemoteViews render resolves every colour from widgetPalette() tokens (no ThemeProvider, no React theme hook, no hex literal); widget-lib ColorProp cast at the seam via asColor"
    - "Per-tile encode fault isolation (try/catch → initials swatch) so one corrupt master never blanks the whole grid"

key-files:
  created:
    - src/services/widget/widget-mark.ts
    - src/services/widget/widget-mark.test.ts
    - src/services/widget/widget-render.tsx
  modified: []

key-decisions:
  - "widgetMarkContacted delegates verbatim to recordTouchpoint with 04-log one-tap defaults (source=widget, outbound, unspecified, connected=1, quality null); no bespoke write path"
  - "Fresh uid per tap (newUid), NOT a deterministic dedup key — genuine repeat widget taps are distinct rows (LOG-06 / RESEARCH A1); deterministic backstop deferred until the 12-08 device spike shows WIDGET_CLICK double-delivery"
  - "renderFavourites takes widgetInfo and routes through pickLayout (Codex HIGH fix) so small vs large is selected from the resize width; defaults to small when no size info"
  - "Log button emits orbit://contact/{id} → Profile (the 12-04 Task-1 owner-ratified target), not a bespoke log route"
  - "SMALL_COLUMNS/capacities/AVATAR_PX/LARGE_MIN_WIDTH_DP are top-of-file tunables; exact grid geometry and breakpoint are device-UAT in 12-08"

patterns-established:
  - "Pattern: node-testable write core + device-UAT visual surface split within one plan (widget-mark.ts node:sqlite-proven; widget-render.tsx tsc/colours-proven, pixels deferred to 12-08)"
  - "Pattern: asColor() re-types resolved palette strings to the widget lib's template-literal ColorProp at the seam, keeping check:colors clean (no literal outside theme-presets)"

requirements-completed: [WDG-01, WDG-02]

coverage:
  - id: D1
    description: "Headless widget mark writes exactly one widget-sourced interactions row through the single-writer recency DAO, recomputes last_contact, and a repeat tap yields a distinct row"
    requirement: WDG-02
    verification:
      - kind: unit
        ref: "src/services/widget/widget-mark.test.ts#widget-mark — headless single-writer mark (WDG-02)"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "renderFavourites(widgetInfo?) selects small vs large via pickLayout and builds the small/large/empty RemoteViews trees with WIDGET_MARK + OPEN_URI actions, base64 avatars with per-tile initials fallback, palette-only colours"
    requirement: WDG-01
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (type-checks the tree against react-native-android-widget 0.22.0)"
        status: pass
      - kind: other
        ref: "npm run check:colors (no hex literal) + grep useTheme( == 0 (no theme hook)"
        status: pass
    human_judgment: true
    rationale: "The RemoteViews bitmap is rasterised off-screen natively; the actual visual render, the small↔large dp breakpoint, and the tap-rectangle geometry are only observable on the physical Pixel (12-08). tsc/check:colors prove the tree type-checks and is palette-clean, not that it looks or lays out correctly."

# Metrics
duration: 18 min
completed: 2026-08-17
status: complete
---

# Phase 12 Plan 05: Widget Mark Seam + RemoteViews Render Tree Summary

**Headless single-writer widget-mark seam (node:sqlite-proven, routes through recordTouchpoint) plus the size-driven RemoteViews render tree — small mark-grid, large Mark/Log/Message action list, and empty "Choose favourites" prompt — with per-tile base64 avatars and palette-only colours.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-17T07:50:00Z
- **Completed:** 2026-08-17T08:07:35Z
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments
- `widgetMarkContacted(exec, contactId, now)` — the WDG-02 write spine: exactly one widget-sourced interaction through the mutexed single-writer recency DAO, `last_contact` recomputed, a repeat tap a distinct row. Proven end-to-end over the `node:sqlite` harness (3 tests).
- `renderFavourites(widgetInfo?)` — the WDG-01 visual surface: a `pickLayout`-driven small/large/empty `FlexWidget`/`ImageWidget`/`TextWidget` tree with `WIDGET_MARK` + `OPEN_URI` click actions, status rings (colour + escalating weight), base64 `data:` avatars with a per-tile initials-swatch fallback, and the exact UI-SPEC copy — every colour from `widgetPalette()`, no theme hook, no hex literal.
- Full suite 890/890 green; `tsc --noEmit`, `check:colors`, and Biome all clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Headless mark write seam + node:sqlite test** (TDD) — `201a110` (test, RED) → `fdde615` (feat, GREEN)
2. **Task 2: RemoteViews render tree with size-driven layout** — `d6e8366` (feat)

_TDD Task 1: RED (`test`) then GREEN (`feat`); no refactor commit needed._

## Files Created/Modified
- `src/services/widget/widget-mark.ts` - `widgetMarkContacted`: delegates to `recordTouchpoint` with the 04-log one-tap defaults (source=widget, outbound, unspecified, connected=1, quality null), fresh `newUid()` per tap; no raw `last_contact` write, no nested transaction.
- `src/services/widget/widget-mark.test.ts` - node:sqlite behavioural proof: one widget-sourced row, `last_contact` recomputed, second tap a distinct row.
- `src/services/widget/widget-render.tsx` - `renderFavourites(widgetInfo?)`, pure `pickLayout`, and the small/large/empty tile components; per-tile `encodeWidgetThumb` fault isolation; `asColor`/`asImageSource` seam casts; opens the DB defensively (`openAndMigrate` before `getExecutor`) for the headless path.

## Decisions Made
- **Mark seam is a thin DAO delegate** — no bespoke write, mirroring `notification-actions.ts` so the single-writer invariant (T-12-06) holds by construction.
- **Fresh uid per tap** — a widget tap is a fresh user intent each time, so `newUid()` (distinct rows), NOT the notification path's deterministic exactly-once key. A double-delivery backstop is explicitly deferred to the 12-08 device spike.
- **`renderFavourites` takes `widgetInfo` and switches via `pickLayout`** (Codex HIGH) so neither layout is dead code; defaults to small when the size is absent (plain `WIDGET_UPDATE`).
- **Log → `orbit://contact/{id}` (Profile)** — emitted exactly as the 12-04 Task-1 owner-ratification recorded; not a silent planner choice.

## Deviations from Plan

None - plan executed exactly as written.

The one non-code adjustment worth recording: the plan's Task-2 `<verify>` snippet uses `grep -rc "useTheme("` on a single file, whose `-r` prefixes the path (`file:0`) and breaks the `-eq 0` test; a comment that literally wrote `useTheme()` also would have tripped it. Reworded the doc comment to remove the literal and verified with `grep -c` (count only) — the substantive gate (zero React theme-hook calls) passes cleanly (count 0). No behavioural change.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **12-06 (task handler):** wire `WIDGET_CLICK` → bootstrap the DB (`openAndMigrate` before `getExecutor`, mirroring notification H1) → `widgetMarkContacted` (committed BEFORE render) → invoke `renderFavourites(props.widgetInfo)` through a swallowing wrapper (best-effort, post-mark). `resolveWidgetUri` (12-04) already accepts the emitted `orbit://` URIs.
- **12-08 (device build/UAT):** the RemoteViews visual render, the small↔large dp breakpoint (`LARGE_MIN_WIDTH_DP`), per-resolution grid capacity, and the killed-app native mark round-trip are all physical-Pixel checks — the node harness cannot exercise the native rasteriser or task runtime.

---
*Phase: 12-home-screen-widget*
*Completed: 2026-08-17*

## Self-Check: PASSED

- Created files verified on disk: `widget-mark.ts`, `widget-mark.test.ts`, `widget-render.tsx`.
- Task commits verified in git log: `201a110` (test/RED), `fdde615` (feat/GREEN), `d6e8366` (feat/render).
- Gates re-run green: `widget-mark.test.ts` 3/3, full suite 890/890, `tsc --noEmit`, `check:colors`, Biome, `useTheme(` count 0, `pickLayout|widgetInfo` present.
