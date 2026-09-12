---
phase: 32-interaction-history-insights
plan: 05
subsystem: history-presentation
tags: [history, heatmap, intensity, theme-tokens, app-settings, react-native, presentational]

requires:
  - phase: 32-interaction-history-insights
    plan: 01
    provides: "migration 025 (TARGET_VERSION=25): app_settings.history_lens (default 'cycles') / history_cycle_count (default 10)"
  - phase: 32-interaction-history-insights
    plan: 03
    provides: "pure aggregation seam — window/buckets(heatmapLevel)/cycles/intensity-window + canonical history-read"
provides:
  - "src/theme: heatmapScale (5-entry ascending ramp) / heatmapCellEmpty / markerInteraction / markerLifecycle tokens, seeded per-palette in all four theme-presets slots"
  - "app-settings-dao: historyLens/historyCycleCount threaded through every closed seam (AppSettings, AppSettingsRow, getAppSettings runtime SELECT+mapping, WritableSettingsKey, COLUMN_OF, OPTIONAL PortableSettingsSnapshot keys → AppSettingsPatch) + bounded-value validators; getPortableSettingsSnapshot emission untouched"
  - "src/components/history/ActivityHeatmap.tsx — static, count-only, lens-switchable (Cycles/7 Days/Month/Year), globally-persisted-by-parent heatmap; structural current-cycle marking; full cell a11y"
  - "src/components/history/heatmap-cell.ts — pure node-tested cell classification (structural blank vs real zero-count level)"
  - "src/components/history/HeatmapContextCard.tsx — small anchored count-only card (never lifecycle)"
  - "src/components/history/IntensityChart.tsx — neutral, window-scoped intensity over the shared window (extends IntensityLine)"
affects: [phase-32-plan-08-profile-integration]

actuals:
  tokens: 9500
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Presentational, parent-owned-state history surfaces (DB-free, callback props) mirroring IntensityLine/SegmentedControl — the parent (Plan 08) owns persistence + sheet/card mounting"
    - "Static count heatmap built from plain RN View/Pressable cells (no GPU-canvas draw layer, no render loop) — deliberately sidesteps the worklet-forward-ref hazard"
    - "Pure cell-classification extracted to a node-testable .ts (heatmap-cell.ts) so the correctness-critical structural-blank vs real-zero decision is tested outside the un-loadable .tsx (repo convention)"
    - "New durable prefs threaded through EVERY closed app-settings-dao seam with a bounded-value validator (accessors alone are insufficient)"

key-files:
  created:
    - src/components/history/ActivityHeatmap.tsx
    - src/components/history/HeatmapContextCard.tsx
    - src/components/history/IntensityChart.tsx
    - src/components/history/heatmap-cell.ts
    - src/components/history/heatmap-cell.test.ts
  modified:
    - src/theme/theme-types.ts
    - src/theme/theme-presets.ts
    - src/db/app-settings-dao.ts
    - src/db/app-settings-dao.test.ts
    - src/components/icons/icon-registry.ts
    - src/services/notifications/notification-schedule.test.ts
    - src/services/notifications/digest-schedule.test.ts

key-decisions:
  - "heatmapScale[0] (real zero-count plate) and heatmapCellEmpty (structural out-of-window blank, transparent) are DISTINCT tokens per-palette — a Month/Year placeholder never masquerades as a logged-nothing day (review Plan-05 MEDIUM), verified by the pure classifyHeatmapCell test."
  - "historyLens/historyCycleCount are OPTIONAL PortableSettingsSnapshot keys (so AppSettingsPatch includes them and the runtime lens switch persists via updateAppSettings) but NOT emitted by getPortableSettingsSnapshot and NO BACKUP_FORMAT_VERSION bump — the Phase-23/25/31 declare-optional/emission-deferred shape; Phase 36 owns emission (D-11 portability, D-03)."
  - "Did NOT add the two keys to PORTABLE_SETTINGS_KEYS (backup-schema.ts): with nothing emitted there is nothing to restore, and the runtime write path this phase needs is satisfied purely at the type level — kept within plan scope, backup wire allowlist untouched."
  - "Current cycle distinguished STRUCTURALLY (borderStrong outline + 'Current cycle' a11y label), never a second hue (dossier §G)."
  - "IntensityChart consumes Plan 03's window-scoped IntensityWindowResult and composes IntensityLine for the neutral copy (reuse, not duplication); neutral tokens only (textPrimary/textSecondary/border), never a warning hue."

patterns-established:
  - "History presentational surfaces live in src/components/history/*.tsx as DB-free parent-owned-state components; their correctness-critical pure logic lives in a co-located node-tested .ts"

requirements-completed: [HIST-02, HIST-03, HIST-04, HIST-05, HIST-06, HIST-07]

duration: 12min
completed: 2026-09-11
status: complete
---

# Phase 32 Plan 05: Activity Heatmap, Intensity chart, context card + heatmap/marker tokens Summary

**The presentational History surfaces — a static COUNT-ONLY Activity Heatmap switchable across Cycles/7 Days/Month/Year with globally-persisted lens/preset, an anchored count-only cell context card, and a neutral Intensity chart over the shared window — plus the four new per-palette heatmap/marker theme tokens they render through, all built as DB-free parent-owned-state components with the correctness-critical cell classification node-tested outside the .tsx.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 (all `type="auto"`)
- **Files:** 5 created (3 components + 1 pure helper + 1 test), 7 modified

## Accomplishments

- **Task 1 — tokens + persistence.** Added `heatmapScale` (readonly 5-entry ascending ramp), `heatmapCellEmpty`, `markerInteraction`, `markerLifecycle` to `ThemePalette` and seeded one authored entry per palette slot in `theme-presets.ts` (galaxy luminous / standard flatter; `heatmapScale[0]` a real zero-count plate distinct from the transparent structural blank). Threaded `historyLens`/`historyCycleCount` through EVERY closed app-settings-dao seam by explicit name: OPTIONAL `PortableSettingsSnapshot` keys (→ `AppSettingsPatch`), the `AppSettings` interface, the `AppSettingsRow` row type, the `getAppSettings` RUNTIME SELECT + return mapping (:496 — NOT the Phase-36-reserved `getPortableSettingsSnapshot`), the `WritableSettingsKey` union, `COLUMN_OF`, plus `assertHistoryLens`/`assertHistoryCycleCount` bounded-value guards. `getPortableSettingsSnapshot` emission and `BACKUP_FORMAT_VERSION` are untouched (region-scoped negative grep-gate passes).
- **Task 2 — ActivityHeatmap.** A presentational, parent-owned-state, DB-free heatmap: static RN `View`/`Pressable` cells coloured via `heatmapScale` through the pure `heatmapLevel` helper — no GPU-canvas draw layer, no render loop, no animation, no `toISOString`. Lens `SegmentedControl` (Cycles default) + a Cycles-only 5/10/15/20 preset selector; prev/next window navigation with future blocked; `onLensChange`/`onPresetChange`/`onCellPress` callbacks. Cycles render 5-per-row newest-bottom-right with the current cycle marked by a `borderStrong` outline + `Current cycle` a11y label (never a second hue) and a no-cadence unavailable state; Month/Year placeholders render `heatmapCellEmpty` distinctly from a real zero-count day. Every real cell is a11y-labelled `{date/range}, {n} interactions` with a 44px-floor `hitSlop` on dense cells.
- **Task 3 — context card + intensity.** `HeatmapContextCard.tsx`: a small anchored (non-sheet) card, interaction-count-only (never mentions lifecycle, D-10), with the exact copy `{n} interactions` + `See details` (count>0) / `0 interactions` + `Log interaction` (count===0), exposing `onSeeDetails`/`onLog`. `IntensityChart.tsx`: extends `IntensityLine`, consumes Plan 03's window-scoped `IntensityWindowResult` (never `computeContactIntensity`) so it re-renders over the selected window, neutral only (textPrimary figure / textSecondary caption / neutral `border`+`textSecondary` bar), no prediction, with an unavailable state for a no-cadence contact.

## Task Commits

1. Task 1 — `0afde65` feat(32-05): per-palette heatmap/marker tokens + history lens/preset persistence
2. Task 2 — `ef26fe2` feat(32-05): static count-only ActivityHeatmap across all four lenses
3. Task 3 — `cd62229` feat(32-05): anchored HeatmapContextCard + window-scoped IntensityChart

## Verification

- **Task 1:** `app-settings-dao.test.ts` 90 pass (defaults 'cycles'/10, round-trip, out-of-range rejection, non-emission through the portable snapshot); `check:colors` PASS; region-scoped negative grep-gate on `getPortableSettingsSnapshot` PASS; `BACKUP_FORMAT_VERSION` unchanged.
- **Task 2:** `tsc --noEmit` clean; `check:colors` PASS; source-discipline grep (`Skia`/`useClock`/`toISOString`) EMPTY; `heatmap-cell.test.ts` 4 pass (structural blank vs real zero-count level, day/cycle ramps).
- **Task 3:** `tsc --noEmit` clean; `check:colors` PASS; context-card exact copy + no rendered lifecycle mention; IntensityChart neutral tokens only + consumes `IntensityWindowResult`.
- **Full suite:** **3032 tests pass**; the only failing suite is the PRE-EXISTING, unrelated `src/components/orrery/orrery-controls-render.test.tsx` load failure (documented in 32-01/32-03; imports none of this plan's files — verified 0 references). `tsc --noEmit` clean; `check:colors` PASS.

## Decisions Made

- **Distinct zero-count vs structural-blank tokens** (review Plan-05 MEDIUM): `heatmapScale[0]` is a faint per-palette plate for a real zero-count day; `heatmapCellEmpty` is a transparent structural blank for Month/Year padding. The pure `classifyHeatmapCell` returns `{kind:"blank"}` for any placeholder and `{kind:"scale",level:0}` for a real zero-count day — node-tested so they can never be conflated.
- **Emission-deferred persistence** (D-11/D-03): the two new keys are OPTIONAL in `PortableSettingsSnapshot` (making the runtime `updateAppSettings({historyLens})` write typecheck) but are NOT emitted by `getPortableSettingsSnapshot` and carry no format bump — exactly the Phase-23/25/31 shape. Phase 36 owns emission.
- **Backup wire allowlist untouched:** deliberately did NOT add the keys to `PORTABLE_SETTINGS_KEYS` — nothing is emitted, so there is nothing to restore, and the phase's real consumer (the runtime lens-switch write) is satisfied at the type level. Kept within plan scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened `getAppSettings` SELECT broke v24-migrated test DBs**
- **Found during:** Task 1
- **Issue:** Adding `history_lens, history_cycle_count` to the `getAppSettings` runtime SELECT makes any test whose DB is migrated below v25 fail with "no such column". Three helpers migrated only to v24: `migrateToV5` in `app-settings-dao.test.ts`, and the inline chains in `notification-schedule.test.ts` / `digest-schedule.test.ts` (both call `getAppSettings`).
- **Fix:** Imported `migration025` and appended it to all three chains, bumping the target 24→25. All other getAppSettings callers already migrate via `MIGRATIONS`/`TARGET_VERSION` (=25) or mock the DAO, so no further fallout.
- **Files modified:** `app-settings-dao.test.ts`, `notification-schedule.test.ts`, `digest-schedule.test.ts`
- **Committed in:** `0afde65`

**2. [Rule 2 - Missing critical functionality] Added a `forward` chevron to the icon registry**
- **Found during:** Task 2
- **Issue:** The registry had only `back` (chevron-back); the heatmap's prev/next window controls need a forward glyph.
- **Fix:** Added `forward: { outline: "chevron-forward", filled: "chevron-forward" }` (a valid Ionicons name; tsc-validated at the call site).
- **Files modified:** `src/components/icons/icon-registry.ts`
- **Committed in:** `ef26fe2`

**3. [Rule 2 - satisfy stated acceptance criterion] Extracted pure cell classification + test**
- **Found during:** Task 2
- **Issue:** The acceptance criterion requires the structural-blank vs real-zero classification to be "logic-tested at the cell-classification level", but the `.tsx` cannot load in the node harness.
- **Fix:** Extracted `classifyHeatmapCell`/`classifyCycleBlock` into a pure `src/components/history/heatmap-cell.ts` (imported by the `.tsx`) and added `heatmap-cell.test.ts` — the repo's pure-logic-in-`.ts` convention, mirroring `services/history/*`.
- **Files created:** `heatmap-cell.ts`, `heatmap-cell.test.ts`
- **Committed in:** `ef26fe2`

**Total deviations:** 3 (1× Rule 3 blocking, 2× Rule 2). No scope creep beyond the acceptance criteria; no architectural change; no owner-bucket decision triggered.

## Known Stubs

None. The components are presentational by design (parent owns persistence + sheet/card mounting per the plan's key_links) — the callback props are the intended seam for Plan 08, not stubs. Device-UAT verification (on-Pixel lens re-render, tappability, dense-grid density/large-text) is deferred to the end-of-phase Pixel gate / Phase 40, per the plan's backstop and CLAUDE.md (the device is not attached and the orrery render-loop caveat does not apply to a static heatmap).

## Issues Encountered

None beyond the pre-existing, unrelated `orrery-controls-render.test.tsx` load failure (logged in 32-01/32-03).

## Next Plan Readiness

- Plan 08 (profile integration) can mount `ActivityHeatmap` + `HeatmapContextCard` + `IntensityChart` as presentational children, wiring: lens/preset persistence via `updateAppSettings({historyLens, historyCycleCount})` and read-back via `getAppSettings`; window/counts/cycles from Plan 03's `buildWindow`/`buckets`/`cycles`; intensity via `intensityWindow`; and the context card's `onSeeDetails`/`onLog` to the shared Detail Sheet / logging route.

## Self-Check: PASSED

- Created files verified on disk: ActivityHeatmap.tsx, HeatmapContextCard.tsx, IntensityChart.tsx, heatmap-cell.ts, heatmap-cell.test.ts, 32-05-SUMMARY.md.
- Commits verified in git log: 0afde65, ef26fe2, cd62229.

---
*Phase: 32-interaction-history-insights*
*Completed: 2026-09-11*
