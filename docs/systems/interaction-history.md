# Interaction History & Insights

**Last updated:** 2026-09-02
**Updated by phase:** 33-group-interaction-logging
**Owners:** `src/db/history-read.ts`, `src/db/interaction-edit-read.ts`, `src/services/history/` (`window.ts`, `buckets.ts`, `cycles.ts`, `intensity-window.ts`), `src/components/history/`, `src/screens/EditInteractionScreen.tsx`, `src/screens/edit-interaction-logic.ts`

## Purpose

History & Insights is the dedicated temporal relationship-history experience reached from a Contact Profile. It replaces the old vertical timeline with an interaction Activity Heatmap, an Intensity chart over the same selected window, and a Rolodex-style Month/Day/Year History Browser, plus one shared period/date Detail Sheet, a canonical Interaction Detail surface, and a focused Edit Interaction route. It reads entirely from on-device SQLite; there is no network on any of its read paths.

## Architecture

### Data Model

This subsystem owns no tables of its own — it reads the `interactions` and `events` tables (see `interaction-log.md`) and the current-state knowledge history (see `contact-knowledge.md`), and it persists two durable preferences as `app_settings` columns.

**Read/persisted state:**
- `app_settings.history_lens` (`TEXT`, default `'cycles'`) — the globally-persisted last-used Heatmap lens.
- `app_settings.history_cycle_count` (`INTEGER`, default `10`) — the globally-persisted Cycles preset (5/10/15/20).
- Both are added by migration 025, threaded through `app-settings-dao.ts` with bounded-value validators, and are **declare-only** for backup this phase (emission + format bump are Phase 36's).

**Types:**
- `HistoryDateMarker` (`src/db/history-read.ts`) — per-date marker kind (`interaction` / `lifecycle-only` / `multiple`) plus counts.
- `HistoryWindow` (`src/services/history/window.ts`) — an ordered local-date grid for a lens.
- `IntensityWindowResult` (`src/services/history/intensity-window.ts`) — window-scoped intensity figure/tier.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Canonical read | `src/db/history-read.ts` | Single-contact `ReadOnlyExecutor` read: date-indexed interaction records, read-only lifecycle events, per-date markers, `hasLifecycleRecords`, and the knowledge-change family. |
| Edit-seed read | `src/db/interaction-edit-read.ts` | Contact-scoped single-row read (`id = ? AND contact_id = ?`) of every editable field incl. `duration`/`allow_ai`. |
| Aggregation | `src/services/history/window.ts` | Pure lens → local-date-window generation (7 Days / Month / Year) with future-cell flags and today-clamped prev/next. |
| Aggregation | `src/services/history/buckets.ts` | Count-only per-cell bucketing and `heatmapLevel(count, lens)`. |
| Aggregation | `src/services/history/cycles.ts` | Contact-frequency cycle-block math with the nullable-cadence `{ available:false }` fallback. |
| Aggregation | `src/services/history/intensity-window.ts` | Window-scoped intensity over the pure `computeIntensity` core. |
| Edit logic | `src/screens/edit-interaction-logic.ts` | `buildEditInput`, `canSave`, `isOccurredAtRejected`, `resolveSave`. |

### Key Files

| File | Role |
|---|---|
| `src/components/history/HistorySection.tsx` | The assembled Profile History section; owns lens/window/preset state + persistence + sheet/card/detail mounting. |
| `src/components/history/history-section-logic.ts` | Pure `resolveActiveWindow`, `isEmptyHistory`, `buildLogRoute`, `countByCycle`. |
| `src/components/history/ActivityHeatmap.tsx` | Static count-only lens-switchable heatmap with structural current-cycle marking. |
| `src/components/history/heatmap-cell.ts` | Pure structural-blank vs real-zero cell classification. |
| `src/components/history/HeatmapContextCard.tsx` | Small anchored count-only context card. |
| `src/components/history/IntensityChart.tsx` | Window-scoped intensity chart extending `IntensityLine`. |
| `src/components/history/RolodexBrowser.tsx` | Three synchronized Month/Day/Year wheels + summary drawer; owns pause-on-blur. |
| `src/components/history/RolodexWheel.tsx` | One gesture-driven roller (Reanimated + Gesture Handler, no Skia). |
| `src/components/history/rolodex-logic.ts` | Pure `rollDate`/`clampDate`/`clampToToday`, `markerFor`, `formatDrawerSummary`. |
| `src/components/history/DateDetailSheet.tsx` | Shared period/date sheet interleaving the three record families. |
| `src/components/history/InteractionDetail.tsx` | Present-only inspection + AI sparkle + hard-delete + edit-scope gating. |
| `src/components/history/interaction-detail-logic.ts` | Pure `buildDetailRows` (no blanks), `showSparkle`, active `buildGroupContext`. |
| `src/components/history/GroupScopePrompt.tsx` | Explicit individual-vs-group edit scope prompt. |
| `src/screens/EditInteractionScreen.tsx` | The one canonical Edit Interaction route, saving via `editTouchpointFull`. |

## How It Works

### Rendering the History section

1. `ProfileModuleHost.renderHistory()` mounts `HistorySection` (the interim bounded timeline stub is gone; profile layout persistence is untouched).
2. On focus, `HistorySection` reads `getAppSettings` for the persisted lens/preset and calls `readContactHistory` for the contact's date-indexed records, markers, and `hasLifecycleRecords` signal.
3. `resolveActiveWindow` maps the lens to a `HistoryWindow` (day lenses) or `null` (Cycles); the Heatmap renders `buckets`+`heatmapLevel`, the Intensity chart renders `intensityWindow` over the same window, and the Rolodex renders `history-read` markers.
4. `isEmptyHistory` is true only when there are zero interactions **and** no lifecycle records — a lifecycle-only contact still shows the zero-count surfaces.

### Heatmap and Intensity (shared window)

1. Changing the lens or preset writes it through `updateAppSettings({historyLens, historyCycleCount})` (global, not per contact) and re-renders both surfaces over the new window.
2. Tapping a cell opens `HeatmapContextCard` first (count + `See details`, or `0 interactions` + `Log interaction`) — never the large sheet directly.
3. `See details` opens the shared `DateDetailSheet`; `Log interaction` routes the typed `LogContact { contactId, prefillDate }` contract (Phase 34 owns the form).

### Rolodex browsing

1. Day is the primary axis; rolling it carries Month/Year across boundaries; `clampDate` applies conventional leap-aware clamping and `clampToToday` blocks future dates.
2. The committed selection lifts to parent state only on settle (`runOnJS`) or a stepper press — never per-frame; the browser owns the `useIsFocused`+`AppState` pause-on-blur and conditionally mounts the animated subtree.
3. Pre-selection markers are silhouette-primary (filled dot = interaction, ring = lifecycle-only, filled + count = multiple) with counts/types in the accessibility label; the drawer summarizes the date (lifecycle-inclusive) and never auto-opens the sheet.

### Inspecting, editing, and deleting an interaction

1. A `DateDetailSheet` row → `InteractionDetail`, which renders only present fields, a restrained AI sparkle strictly when `allow_ai === 1`, and Edit/Delete.
2. Edit → `EditInteractionScreen`, seeded by `readInteractionForEdit`, saving every editable field through `editTouchpointFull` — the sole recency writer — with future dates rejected via the DAO's shared guard; a failed save preserves the form.
3. Delete opens a destructive `ConfirmDialog` and calls `deleteTouchpoint` (tombstone + recompute in one transaction); a failure leaves the row and derived metrics intact with the control re-enabled.
Group-linked context and edit-scope routing are active through the Group Event routes; standalone interactions continue using the canonical Edit Interaction route.

### Inspecting and editing group-linked history

`readContactHistory` projects Group Event identity, title, and Group Note as local context on the existing child Interaction row. The parent never becomes a second history record or an aggregation input. `InteractionDetail` shows the shared prose explicitly as Group Note alongside the unchanged participant note and offers View Group Event.

Linked Edit opens `GroupScopePrompt`: individual scope routes to `EditParticipant`, and group scope routes to `EditGroupEvent`. Those routes and `GroupEventDetail` exist in Dashboard, Orrery, and Settings profile-hosting stacks. Participant editing cannot change event title/date or Group Note. Conversion from an ordinary Interaction uses the nonblank `GroupTitlePromptSheet` and `convertInteractionToGroupEvent`, preserving the child ID/UID. Failed conversion retains the title prompt with visible retry feedback.

Group Event Detail’s participant card opens the same child Detail shape through `buildGroupEventDetailInteraction`, carrying the actual stored `allowAi`; `groupEventDurationLabel` delegates whole-second duration rendering to `formatDurationLabel`. Neither projection adds an AI permission control for Group Note.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| heatmap count thresholds | day `0/1/2/3+`, cycle `0/1/2/3/4+` | `src/services/history/buckets.ts` | The one tunable two-table object driving saturation levels. |
| `history_lens` default | `'cycles'` | `src/db/migrations/025-interaction-history-schema.ts` | Default Heatmap lens. |
| `history_cycle_count` default | `10` | `src/db/migrations/025-interaction-history-schema.ts` | Default Cycles preset (options 5/10/15/20). |
| Rolodex year range | 30 years back, capped at today's year | `src/components/history/rolodex-logic.ts` | Browsable Year span. |

## Decisions

- **ADR-119:** Reusable Count-Only History Aggregation and Canonical History Read — the pure aggregation seam and single-contact read serving every surface; heatmap counts resolve from `interactions` rows only; the group-link seam is inert.
- **ADR-120:** Shared-Window Heatmap and Intensity with Globally-Persisted Lenses — the static count-only heatmap, window-aligned intensity, structural current-cycle marking, and durable `app_settings` lens/preset with per-palette tokens.
- **ADR-121:** Rolodex Month/Day/Year History Browser — Reanimated/Gesture-only wheels (no Skia), Day-primary with leap-aware clamp and today-as-max, silhouette markers, and a no-auto-open drawer.
- **ADR-122:** Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet — one inspection/correction surface through the sole recency writer with hard-delete.
- **ADR-123:** Profile History Section Replacing the Vertical Timeline — the assembled section behind the ProfileModuleHost seam and the typed `LogContact` backfill contract. Partially supersedes ADR-024's profile-timeline refinement surface.
- **ADR-116 / ADR-117:** the interaction vocabulary/duration and Allow-AI gate this surface renders (see `interaction-log.md`, `ai-suggestions.md`).
- **[ADR-126: Explicit Group Lifecycle and Identity-Preserving Conversion](../decisions/ADR-126-explicit-group-lifecycle-and-identity-preserving-conversion.md)** — governs `src/components/history/HistorySection.tsx`.
- **[ADR-127: Canonical Event-First Group Logging and Explicit Child Edit Scope](../decisions/ADR-127-canonical-event-first-group-logging-and-explicit-child-edit-scope.md)** — governs `src/components/history/GroupScopePrompt.tsx`, `src/components/history/HistorySection.tsx`, `src/components/history/InteractionDetail.tsx`.

## Gotchas

1. **Correctness-critical math lives in pure `.ts`, not the `.tsx`.** Window/bucket/cycle/intensity math and the wheel date math are node-tested in sibling `.ts` files because the animated/RN `.tsx` cannot load under vitest. Put new count/date logic there, not in a component.
2. **Intensity is genuinely window-scoped.** `intensity-window` filters to the window, sets `effectiveNow` = window end-of-day and `periodDays` = window day-span, and calls the pure `computeIntensity` core. The whole-history wrapper with real `now` reads ~0 for any past window — do not reuse it here.
3. **The Cycles lens has no date grid.** Intensity for Cycles is computed over a synthetic span window `[oldest.start, newest.end]`; day lenses use the real shared window.
4. **A structural blank is not a zero-count day.** `heatmapScale[0]` is a real logged-nothing plate; `heatmapCellEmpty` is a transparent Month/Year padding cell. Keep them distinct (node-tested) so a placeholder never reads as activity.
5. **The current cycle is marked structurally, never by a second hue.** Use the outline + `Current cycle` a11y label; the colour ramp means count only.
Group-linked context and edit-scope routing are active through the Group Event routes; standalone interactions continue using the canonical Edit Interaction route.
7. **The drawer/context card never auto-open the sheet.** Scrolling or selecting a date updates only the committed selection; the sheet opens exclusively from an explicit `See details` / `Log interaction` action.
8. **Backfill routes detailed logging, never Quick Log.** `buildLogRoute` returns the typed `LogContact { contactId, prefillDate }` — Quick Log means "now" and must not be reused for a historical date.
9. **Worklet-forward-ref safety.** The Rolodex depth worklet is defined above its caller; a worklet calling a helper defined later crashes undefined-on-device on Hermes and vitest cannot catch it.
10. **IntensityChart caption reads the contact cadence, not the window span.** A regression once made the caption describe the window; it now reflects the contact's true intended cadence (fixed live during UAT, commit `84e4013`).

- **Truthful Detail projection.** The initial Group Event Detail supplied a static Allow-AI value and displayed seconds as minutes. Gap closure reads the stored child flag and reuses the shared duration formatter.

## Related Systems

- **Interaction log** — owns the `interactions`/`events` tables, the recency spine (`editTouchpointFull`/`deleteTouchpoint`), and the vocabulary map this surface reads and writes through.
- **Profile presentation** — hosts the History section via `ProfileModuleHost.renderHistory()` and owns show/hide/collapse/layout state.
- **Contact knowledge** — supplies the knowledge-change record family via `getCurrentStateHistory` and receives knowledge-row edit navigation.
- **AI suggestions** — owns the `allow_ai` egress posture the sparkle reflects; note transmission itself is a later phase.
- **Status engine** — Status/Gravity/Intensity semantics are unchanged; interaction `duration` never weights them.
- **Backup & restore** — the durable lens/preset preferences are declare-only until Phase 36 emits them.
- **App shell** — registers the Edit Interaction and LogContact routes and owns the heatmap/marker theme tokens.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-09-02 | 32 | Created the History & Insights subsystem: reusable count-only aggregation seam + canonical `history-read`, shared-window Heatmap/Intensity with globally-persisted lenses, the Rolodex Month/Day/Year Browser, the shared Date Detail Sheet + Interaction Detail + canonical Edit route with hard-delete, and the Profile History section replacing the vertical timeline. Group-linked routing is a dormant Phase-33 seam. |
| 2026-09-02 | 33 | Activated local group context, explicit child/event edit scope, identity-preserving conversion, and truthful participant Detail projection. |
