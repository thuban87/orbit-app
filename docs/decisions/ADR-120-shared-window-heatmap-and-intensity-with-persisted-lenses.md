# ADR-120: Shared-Window Heatmap and Intensity with Globally-Persisted Lenses

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 32-interaction-history-insights
**Source decisions:** D-11 (32-CONTEXT.md) from dossier §C, §E, §F, §G, §K, §N
**Reversibility:** reversible
**Migration:** 025
**Supersedes:** None
**Superseded by:** None

## Context

History & Insights presents two aligned views of the same period: an Activity Heatmap and an Intensity chart. They must share one selected time window (changing the heatmap lens re-renders Intensity over the same span), persist the last-used lens and cycle-count globally rather than per contact, distinguish the in-progress cycle without inventing a second colour, and render through theme tokens in both Galaxy and Standard.

## Decision

The Heatmap is a static, **count-only**, DB-free presentational component with four lenses (Cycles default, 7 Days, Month, Year); Cycles renders `count` frequency blocks (presets 5/10/15/20, default 10) newest-bottom-right in 5-per-row grids, marking the current incomplete cycle **structurally** (a `borderStrong` outline plus a `Current cycle` accessibility label — never a second hue, dossier §G). Saturation uses simple count thresholds from one tunable two-table object (day lenses 0/1/2/3+, cycle lens 0/1/2/3/4+). The Intensity chart consumes the window-scoped `IntensityWindowResult` over the same shared window using neutral tokens only (no warning hue, no prediction). Last-used `history_lens` and `history_cycle_count` persist **globally** as `app_settings` columns (added by migration 025), portable via the backup manifest — declared as optional keys so the runtime lens switch writes through `updateAppSettings`, but **not emitted** by `getPortableSettingsSnapshot` and carrying **no** `BACKUP_FORMAT_VERSION` bump (Phase 36 owns emission and the format bump). Four new per-palette tokens carry the visuals: `heatmapScale` (a 5-entry ascending ramp whose `[0]` is a real zero-count plate), `heatmapCellEmpty` (a distinct transparent structural blank for Month/Year padding), `markerInteraction`, and `markerLifecycle`.

## Alternatives Considered

- **A second hue (e.g. blue) for the current cycle** — Rejected; the in-progress cycle is distinguished structurally so the colour ramp keeps meaning count only.
- **Independent time-range logic in each component** — Rejected; a single shared window state keeps the two views aligned.
- **One token for both a zero-count day and an out-of-window blank** — Rejected; a Month/Year placeholder must never masquerade as a logged-nothing day, so the two are distinct tokens (node-tested).
- **Persist lens/preset per contact, or in AsyncStorage** — Rejected; the preference is global and belongs in `app_settings` (portable), never AsyncStorage.
- **Emit the new keys in the portable snapshot now** — Rejected; emission and the format bump are Phase 36's, so the keys are declare-only this phase.

## Consequences

### Positive

- Heatmap and Intensity always visualize the same period; the lens/preset choice survives app restarts and is portable.
- The static View/Pressable heatmap needs no GPU-canvas draw layer or render loop, sidestepping the worklet-forward-ref hazard.

### Negative

- The durable prefs are written but not yet serialized, so a backup taken before Phase 36 will not carry them.

### Risks

- Adding the two columns to the runtime `getAppSettings` SELECT breaks any test DB migrated below v25; the tests' migration chains were bumped to 25.

## Implementation

**Key files:**
- `src/components/history/ActivityHeatmap.tsx` — the static count-only lens-switchable heatmap with structural current-cycle marking.
- `src/components/history/heatmap-cell.ts` — pure classification of a structural blank vs a real zero-count cell.
- `src/components/history/HeatmapContextCard.tsx` — the small anchored count-only context card.
- `src/components/history/IntensityChart.tsx` — window-scoped intensity extending the base line primitive.
- `src/components/IntensityLine.tsx` — the base intensity presentation primitive it composes.
- `src/theme/theme-types.ts` — the `heatmapScale`/`heatmapCellEmpty`/`markerInteraction`/`markerLifecycle` palette tokens.
- `src/theme/theme-presets.ts` — seeds those tokens per palette (galaxy luminous / standard flatter).
- `src/db/app-settings-dao.ts` — threads `historyLens`/`historyCycleCount` through every closed seam with bounded-value validators; emission deferred.

**Depends on:** ADR-119 (Reusable Count-Only History Aggregation and Canonical History Read); ADR-084 (Four Semantic Theme Palettes, Curated Accents, and Contrast Validation)
**Required by:** ADR-123 (Profile History Section Replacing the Vertical Timeline); ADR-148 (Portable Your Week Period and Group-Deduplicated Activity Aggregation)
