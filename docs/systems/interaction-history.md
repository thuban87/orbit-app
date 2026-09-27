# Interaction History & Insights

**Last updated:** 2026-09-26
**Updated by phase:** 38.4-audit-remediation-ui-performance-release
**Owners:** `src/db/history-read.ts`, `src/db/interaction-edit-read.ts`, `src/services/history/` (`window.ts`, `buckets.ts`, `cycles.ts`, `intensity-window.ts`), `src/components/history/`, `src/screens/EditInteractionScreen.tsx`, `src/screens/edit-interaction-logic.ts`

## Purpose

History & Insights is the dedicated temporal relationship-history experience reached from a Contact Profile. It replaces the old vertical timeline with an interaction Activity Heatmap, an Intensity chart over the same selected window, and a Rolodex-style Month/Day/Year History Browser, plus one shared period/date Detail Sheet, a canonical Interaction Detail surface, and a focused Edit Interaction route. It reads entirely from on-device SQLite; there is no network on any of its read paths.

## Architecture

### Data Model

This subsystem owns no tables of its own — it reads the `interactions` and `events` tables (see `interaction-log.md`) and the current-state knowledge history (see `contact-knowledge.md`), and it persists two durable preferences as `app_settings` columns.

**Read/persisted state:**
- `app_settings.history_lens` (`TEXT`, default `'cycles'`) — the globally-persisted last-used Heatmap lens.
- `app_settings.history_cycle_count` (`INTEGER`, default `10`) — the globally-persisted Cycles preset (5/10/15/20).
- Both are added by migration 025, threaded through `app-settings-dao.ts` with bounded-value validators, and are emitted/restored as portable format-v5 preferences.

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
| `src/db/history-read.ts` | Projects canonical child rows plus local parent context without double counting. |
| `src/services/history/week-window.ts` | Defines the shared local Rolling 7 Days and locale-aware Calendar Week bounds consumed by Digest. |

## How It Works

### Rendering the History section

1. `ProfileModuleHost.renderHistory()` mounts `HistorySection` (the interim bounded timeline stub is gone; profile layout persistence is untouched).
2. `HistorySection` reads on mount and whenever the parent Profile's `revision` prop changes (38.3 RG-024). Profile focus always produces a new revision, so ADR-123's on-focus read is preserved; the shell tick and the post-sweep foreground tick now reach History the same way. Each read fetches `getAppSettings` for the persisted lens/preset and calls `readContactHistory` for the contact's date-indexed records, markers, and `hasLifecycleRecords` signal. Reads are latest-request gated (`createLatestRequestAuthority`). If the first read fails, History shows "Couldn't load history" with Retry rather than an endless "Loading history…". A failed re-read keeps the previous rows and shows a compact "Couldn't refresh history" notice with Retry (`historyReadStateOnFail` / `historyReadStateOnPublish`). A refresh never resets the open card, sheet or detail selection.
3. On the same revision/mount event, "today" is re-evaluated with `formatLocalDate()` through `advanceHistoryDay` (38.3 D-12). The explicit `followingToday` flag in `HistoryDayState`, kept separate from `refDate`, decides rollover. A view showing the current window advances to the new today. A past window the user picked (Prev, or Next that stops short of today) stays put. A lens change, or Next back into the window containing today, resumes following. Today-bound limits always follow the new day: next-window navigation, the Rolodex max day, the empty-state Log prefill and cycles `now`. There is no timer (D-22). Day changes are seen on Profile focus, tab return, app resume and the shell tick.
4. `resolveActiveWindow` maps the lens to a `HistoryWindow` (day lenses) or `null` (Cycles); the Heatmap renders `buckets`+`heatmapLevel`, the Intensity chart renders `intensityWindow` over the same window, and the Rolodex renders `history-read` markers.
5. `isEmptyHistory` is true only when there are zero interactions **and** no lifecycle records — a lifecycle-only contact still shows the zero-count surfaces.

### Heatmap and Intensity (shared window)

1. Changing the lens or preset writes it through `updateAppSettings({historyLens, historyCycleCount})` (global, not per contact) and re-renders both surfaces over the new window.
2. Tapping a cell opens `HeatmapContextCard` first (count + `See details`, or `0 interactions` + `Log interaction`) — never the large sheet directly.
3. `See details` opens the shared `DateDetailSheet`; `Log interaction` routes the typed `LogContact { contactId, prefillDate }` contract to the canonical detailed form. The prefilled day remains editable.
4. The Year lens uses vertically flowing, weekday-aligned week rows rather than a horizontal scroll container. It reuses the same day-cell renderer, selection, classification, and accessible labels as the other lenses.
5. The day lenses (7 Days / Month, 7 columns) and the Cycles lens (5 columns) fit their measured width (38.4 RG-033, `ui-accessibility/AUD-UIA-010`, D-13). `ActivityHeatmap` measures its container with `onLayout` and sizes each lens's cells with the shared pure `fitHeatmapCell` (`src/components/heatmap-fit.ts`). The width is capped at `DAY_MAX_CELL` 38 or `CYCLE_MAX_CELL` 52 and shrinks below that whenever the width demands it. Both grids are centered, and neither renders until measured. The Cycles grid is exactly five cells plus four gaps wide, so it always wraps at five. The dense Year lens is deliberately unchanged at its fixed `yearCellEdge` 13dp — an accepted limitation.

### Explicit timestamp presentation

Visible local timestamps use `formatDateTimeMinuteOrFallback()` from `src/utils/dates.ts`. It preserves stored local-wall-clock values and structured raw fields, renders a 12-hour minute-precision default, and displays `Unknown time` rather than exposing malformed raw storage. Relative language remains separate.

Rows that already sit within a known day render the clock alone through the paired time-only helper `formatTimeMinuteOrFallback()` (38.4, RG-038 `ui-accessibility/AUD-UIA-018`, D-07). Both helpers share one private clock renderer and the module-private `TIME_FORMAT`, so a time-only row and a date-time field can never disagree: `00:00` → `12:00 AM`, `12:00` → `12:00 PM`, `23:59` → `11:59 PM`, and seconds are truncated (`09:05:59` → `9:05 AM`, `09:06:00` → `9:06 AM`). The formatters are display-only — stored precision, native editing precision and local-date handling are unchanged, and there is no 12/24-hour preference. Never slice `HH:MM` out of the stored string: that yields 24-hour text that disagrees with every other surface.

Covered explicit-timestamp consumers (visible text **and** accessibility labels):

| Consumer | Helper |
|---|---|
| History `DateDetailSheet` rows (interaction, lifecycle, knowledge) | `formatTimeMinuteOrFallback` |
| Digest Your Week `DigestDayDetail` rows | `formatTimeMinuteOrFallback` |
| Group Event Detail "When" | `formatDateTimeMinuteOrFallback` |
| Touchpoint refine form date/time value (38.4 Plan 06) | `formatDateTimeMinuteOrFallback` |
| Restore preview source date (38.4 Plan 05) | `formatDateTimeMinuteOrFallback` |
| Group Events list row date-time (38.4 Plan 12; replaced the local 24-hour `displayDateTime` slice) | `formatDateTimeMinuteOrFallback` |

`src/utils/timestamp-consumer-contract.test.ts` pins the History, Digest, Group Event Detail and Group Events list consumers to the shared helpers.

### Sharing history language with Digest

1. Digest reuses `classifyHeatmapCell`, theme heatmap tokens, and accessible structural selection from this subsystem rather than recreating a second visual grammar.
2. `week-window.ts` owns Digest’s two app-wide period boundaries; it does not alter the Profile History lens or its contact-scoped reads.
3. Digest’s aggregate DAO owns its own app-wide metrics and group-parent projection, while this subsystem retains the contact-scoped history and detail contract.

### Rolodex browsing

1. Day is the primary axis; rolling it carries Month/Year across boundaries; `clampDate` applies conventional leap-aware clamping and `clampToToday` blocks future dates.
2. The committed selection lifts to parent state only on settle (`runOnJS`) or a stepper press — never per-frame; the browser owns the `useIsFocused`+`AppState` pause-on-blur and conditionally mounts the animated subtree.
3. Pre-selection markers are silhouette-primary (filled dot = interaction, ring = lifecycle-only, filled + count = multiple) with counts/types in the accessibility label; the drawer summarizes the date (lifecycle-inclusive) and never auto-opens the sheet.

### Inspecting, editing, and deleting an interaction

1. A `DateDetailSheet` row → `InteractionDetail`, which renders only present fields, a restrained AI sparkle strictly when `allow_ai === 1`, and Edit/Delete.
2. Edit → `EditInteractionScreen`, seeded by `readInteractionForEdit`, saving every editable field through `editTouchpointFull` — the sole recency writer — with future dates rejected via the DAO's shared guard; a failed save preserves the form.
3. Delete opens a destructive `ConfirmDialog` and calls `deleteTouchpoint` (tombstone + recompute in one transaction); a failure leaves the row and derived metrics intact with the control re-enabled. On success, `InteractionDetail` publishes once to the widget (`notifyWidgetDataChanged`) and the shell tick (`bumpShellRefresh`) before `onDeleted`. The Profile snapshot, its History revision, Home, Digest and Orrery therefore all converge (38.3, architecture/AUD-ARCH-004). History's own `onDeleted` only closes the detail.
4. Group-linked context and edit-scope routing are active through the Group Event routes; standalone interactions continue using the canonical Edit Interaction route.

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
| Your Week periods | Rolling 7 Days / locale-aware Calendar Week | `src/services/history/week-window.ts` | Shared app-wide local-date window vocabulary. |
| `DAY_MAX_CELL` / `CYCLE_MAX_CELL` | `38` / `52` | `src/components/history/ActivityHeatmap.tsx` | Per-lens cell caps; the fitted edge never exceeds them (RG-033). |
| `HEATMAP_GEOMETRY.yearCellEdge` | `13` | `src/components/history/ActivityHeatmap.tsx` | Fixed dense Year cell; not width-fitted. |

## Decisions

- **ADR-119:** Reusable Count-Only History Aggregation and Canonical History Read — the pure aggregation seam and single-contact read serving every surface; heatmap counts resolve from `interactions` rows only; the group-link seam is inert.
- **ADR-120:** Shared-Window Heatmap and Intensity with Globally-Persisted Lenses — the static count-only heatmap, window-aligned intensity, structural current-cycle marking, and durable `app_settings` lens/preset with per-palette tokens.
- **ADR-121:** Rolodex Month/Day/Year History Browser — Reanimated/Gesture-only wheels (no Skia), Day-primary with leap-aware clamp and today-as-max, silhouette markers, and a no-auto-open drawer.
- **ADR-122:** Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet — one inspection/correction surface through the sole recency writer with hard-delete.
- **ADR-123:** Profile History Section Replacing the Vertical Timeline — the assembled section behind the ProfileModuleHost seam and the typed `LogContact` backfill contract. Partially supersedes ADR-024's profile-timeline refinement surface.
- **ADR-148:** Portable Your Week Period and Group-Deduplicated Activity Aggregation — reuses this system’s heatmap language and owns the shared week-window definition without changing Profile History scope.
- **ADR-152:** Vertical History Heatmap and Minute-Precision Timestamps — preserves Year cell semantics while changing its mobile flow and centralizes explicit timestamp display formatting.
- **ADR-132:** Focused Rapid Capture Workflows — fulfills the typed detailed-log target while retaining the History-owned backfill route contract.
- **ADR-116 / ADR-117:** the interaction vocabulary/duration and Allow-AI gate this surface renders (see `interaction-log.md`, `ai-suggestions.md`).
- **[ADR-126: Explicit Group Lifecycle and Identity-Preserving Conversion](../decisions/ADR-126-explicit-group-lifecycle-and-identity-preserving-conversion.md)** — governs `src/components/history/HistorySection.tsx`.
- **[ADR-127: Canonical Event-First Group Logging and Explicit Child Edit Scope](../decisions/ADR-127-canonical-event-first-group-logging-and-explicit-child-edit-scope.md)** — governs `src/components/history/GroupScopePrompt.tsx`, `src/components/history/HistorySection.tsx`, `src/components/history/InteractionDetail.tsx`.
- **[ADR-124: Group Event Parents with Canonical Per-Contact Children](../decisions/ADR-124-group-event-parents-with-canonical-per-contact-children.md)** — governs `src/db/history-read.ts`.
- **[ADR-125: Three-Field Live Inheritance with Separate Local-Only Group Notes](../decisions/ADR-125-three-field-live-inheritance-with-separate-local-only-group-notes.md)** — governs `src/db/history-read.ts`.

## Gotchas

1. **Correctness-critical math lives in pure `.ts`, not the `.tsx`.** Window/bucket/cycle/intensity math and the wheel date math are node-tested in sibling `.ts` files because the animated/RN `.tsx` cannot load under vitest. Put new count/date logic there, not in a component.
2. **Intensity is genuinely window-scoped.** `intensity-window` filters to the window, sets `effectiveNow` = window end-of-day and `periodDays` = window day-span, and calls the pure `computeIntensity` core. The whole-history wrapper with real `now` reads ~0 for any past window — do not reuse it here.
3. **The Cycles lens has no date grid.** Intensity for Cycles is computed over a synthetic span window `[oldest.start, newest.end]`; day lenses use the real shared window.
4. **A structural blank is not a zero-count day.** `heatmapScale[0]` is a real logged-nothing plate; `heatmapCellEmpty` is a transparent Month/Year padding cell. Keep them distinct (node-tested) so a placeholder never reads as activity.
5. **The current cycle is marked structurally, never by a second hue.** Use the outline + `Current cycle` a11y label; the colour ramp means count only.
6. **Group context is local presentation only.** Keep Group Note distinct from the participant note; child Allow-AI never authorizes shared text.
7. **The drawer/context card never auto-open the sheet.** Scrolling or selecting a date updates only the committed selection; the sheet opens exclusively from an explicit `See details` / `Log interaction` action.
8. **Backfill routes detailed logging, never Quick Log.** `buildLogRoute` returns the typed `LogContact { contactId, prefillDate }` — Quick Log means "now" and must not be reused for a historical date.
9. **The History date is only an initial value.** The detailed Log Interaction form may edit it; a multi-day History range must never invent an exact day.
9. **Worklet-forward-ref safety.** The Rolodex depth worklet is defined above its caller; a worklet calling a helper defined later crashes undefined-on-device on Hermes and vitest cannot catch it.
10. **IntensityChart caption reads the contact cadence, not the window span.** A regression once made the caption describe the window; it now reflects the contact's true intended cadence (fixed live during UAT, commit `84e4013`).
11. **Do not make Digest a second History reader.** It can reuse presentation helpers and `week-window`, but its app-wide aggregate and group-parent deduplication remain a distinct read boundary.
12. **Do not display raw local timestamp storage.** Explicit timestamp consumers use the shared minute formatter; relative formatters and stored/structured values remain unchanged.
13. **Never re-read History independently of the parent revision — the two projections must share one trigger.** History reads only on mount and on the Profile's `revision`. An independent focus, timer or post-delete re-read lets the metrics and History disagree (38.3 RG-024).
14. **Detail sheets rely on the Sheet scroll body at large text (D-32, RG-034 follow-on, device-found).** `InteractionDetail` is a plain `detail` sheet: at font_scale 2.0 on a ≈320dp phone its Edit/Delete row now scrolls into reach inside the 60% cap instead of clipping. `DateDetailSheet` owns its list `ScrollView`, so it passes `scrollBody={false}`: its list is the single bounded scroll and the `Log interaction` footer stays fixed below it. Do not wrap either in another ScrollView (`sheet-consumers-contract.test.ts`).

- **Truthful Detail projection.** The initial Group Event Detail supplied a static Allow-AI value and displayed seconds as minutes. Gap closure reads the stored child flag and reuses the shared duration formatter.

## Related Systems

- **Interaction log** — owns the `interactions`/`events` tables, the recency spine (`editTouchpointFull`/`deleteTouchpoint`), and the vocabulary map this surface reads and writes through.
- **Profile presentation** — hosts the History section via `ProfileModuleHost.renderHistory()` and owns show/hide/collapse/layout state. Its Last Interaction tile and Orbit Status → View history reveal this section in place (scroll + persisted expand, no route); both are omitted when the layout hides History (38.3 RG-021, D-10/D-11).
- **Contact knowledge** — supplies the knowledge-change record family via `getCurrentStateHistory` and receives knowledge-row edit navigation.
- **AI suggestions** — owns the `allow_ai` egress posture the sparkle reflects and serializes only the bounded opted-in recent-note projection.
- **Status engine** — Status/Gravity/Intensity semantics are unchanged; interaction `duration` never weights them.
- **Backup & restore** — format v7 emits and restores the durable lens/preset preferences with the complete milestone settings set.
- **Digest** — reuses heatmap language and `week-window` for app-wide Your Week reflection.
- **App shell** — registers the Edit Interaction and LogContact routes and owns the heatmap/marker theme tokens.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-09-02 | 32 | Created the History & Insights subsystem: reusable count-only aggregation seam + canonical `history-read`, shared-window Heatmap/Intensity with globally-persisted lenses, the Rolodex Month/Day/Year Browser, the shared Date Detail Sheet + Interaction Detail + canonical Edit route with hard-delete, and the Profile History section replacing the vertical timeline. Group-linked routing is a dormant Phase-33 seam. |
| 2026-09-02 | 33 | Activated local group context, explicit child/event edit scope, identity-preserving conversion, and truthful participant Detail projection. |
| 2026-09-02 | 34 | Replaced the detailed-log placeholder with the canonical Log Interaction form while preserving typed date prefill. |
| 2026-09-02 | 36 | Emitted and restored the persisted History lens and cycle-preset preferences in backup format v5. |
| 2026-09-02 | 38 | Exposed shared local week-window and heatmap presentation seams for Digest without changing contact-scoped History reads. |
| 2026-09-19 | 38.1 | Made the Year heatmap vertical and routed the audited explicit timestamp displays through the shared minute-precision formatter. |
| 2026-09-25 | 38.3 | History now reads on the parent Profile revision rather than its own focus hook; ADR-123's on-focus read is preserved via that revision. Interaction deletes publish the shell tick. "Today" is re-evaluated per revision with `formatLocalDate`, and the explicit following-today state implements D-12 without timers. Read failures show error/refresh notices with Retry (RG-024). |
| 2026-09-25 | 38.3 | Reveal entry points (RG-021, D-10, D-11, D-28): the Profile's Last Interaction tile and Orbit Status → View history now scroll to this section and expand it through the persisted collapse toggle, instead of routing to Things to Remember. The section's period/selection is never reset by the reveal. Neither entry point exists when the layout hides History. |
| 2026-09-26 | 38.3 | The persisted lens and cycle preset are adopted from revision re-reads only until the user picks locally, so a re-read that started before the settings write committed can no longer revert the choice; a failed write logs content-free and reverts explicitly unless a newer choice superseded it (review A-WR-08). |
| 2026-09-26 | 38.4 | Shared minute timestamps for remaining consumers (RG-038, ui-accessibility/AUD-UIA-018): added the time-only `formatTimeMinute`/`formatTimeMinuteOrFallback` pair; History date-detail and Digest day-detail rows (text and a11y labels) and Group Event Detail "When" now render 12-hour minute-precision time instead of 24-hour slices or raw storage. |
| 2026-09-26 | 38.4 | Group Events list rows render their date-time through `formatDateTimeMinuteOrFallback` (Plan 12, RG-038 ui-accessibility/AUD-UIA-018); the local 24-hour slice helper is gone. |
| 2026-09-26 | 38.4 | Activity heatmap fit-to-width (Plan 09, RG-033 ui-accessibility/AUD-UIA-010, D-13): the 7 Days/Month and Cycles lenses size their cells from the measured width with `fitHeatmapCell` (caps 38/52) and are centered; the dense Year lens is unchanged. |
| 2026-09-26 | 38.4 | Detail sheets at large text (Plan 18, D-32, RG-034 follow-on): `InteractionDetail` actions scroll into reach in the Sheet's bounded body; `DateDetailSheet` opts out (`scrollBody={false}`) and keeps its footer fixed below its own list. |
