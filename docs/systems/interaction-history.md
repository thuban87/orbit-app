# Interaction History & Insights

**Last updated:** 2026-10-08
**Updated by phase:** 38.8-history-navigation-ux
**Owners:** `src/db/history-read.ts`, `src/db/interaction-edit-read.ts`, `src/services/history/` (`window.ts`, `buckets.ts`, `cycles.ts`, `intensity-window.ts`), `src/components/history/`, `src/screens/EditInteractionScreen.tsx`, `src/screens/edit-interaction-logic.ts`

## Purpose

History & Insights is the dedicated temporal relationship-history experience reached from a Contact Profile. It replaces the old vertical timeline with an interaction Activity Heatmap, an Intensity chart over the same selected window, a Jump to date control, and an activity-first stream of the contact's actual records (newest first, grouped by year, month and day), plus a canonical Interaction Detail surface and a focused Edit Interaction route. Since 38.8 the stream replaces the Rolodex Month/Day/Year browser and the date Detail Sheet: records show immediately, and a heatmap tap or a month Jump lands on the right place in the stream. It reads entirely from on-device SQLite; there is no network on any of its read paths.

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
| `src/components/history/HistorySection.tsx` | The assembled Profile History section; owns lens/window/preset state + persistence, the stream view state, jump/highlight requests, the empty-day/span note, the empty-month state, place-keeping and detail mounting. |
| `src/components/history/history-stream-logic.ts` | Pure stream model: year → month → day grouping, cross-family order, collapsed-year counts, chunking (`STREAM_INITIAL_VISIBLE`/`STREAM_CHUNK`), heatmap/month jump resolution, nearest dates, place-keeping helpers (`streamStateOnModelChange`, `isDayRendered`, `nearestRemainingDay`), labels and notes. |
| `src/components/history/HistoryStream.tsx` | Renders the stream: year headers, collapsed year rows, month headers, day groups, Show older; registers measurable jump targets. |
| `src/components/history/HistoryStreamRows.tsx` | Interaction, lifecycle and knowledge rows (moved from the retired `DateDetailSheet`), with content-bearing accessible labels. |
| `src/components/history/HistoryHighlight.tsx` | The jump highlight: accent bar + faint tint fading over `HIGHLIGHT_FADE_MS` (Reanimated; holds then clears under reduced motion). |
| `src/components/history/HistoryTargetNote.tsx` | The dismissible empty-day/span note under the heatmap and the empty-month state under Jump to date (nearest dates, Log, ✕). |
| `src/components/history/JumpToDateSheet.tsx` | Jump to date bottom sheet: year stepper over a 3×4 month grid with record dots; future months disabled. |
| `src/components/history/history-section-logic.ts` | Pure `resolveActiveWindow`, `isEmptyHistory`, `buildLogRoute`, `countByCycle`. |
| `src/components/history/ActivityHeatmap.tsx` | Static count-only lens-switchable heatmap with structural current-cycle marking. |
| `src/components/history/heatmap-cell.ts` | Pure structural-blank vs real-zero cell classification. |
| ~~`src/components/history/HeatmapContextCard.tsx`~~ | Retired in 38.8 (D-22); its empty-day role is `HistoryTargetNote`. |
| `src/components/history/IntensityChart.tsx` | Window-scoped intensity chart extending `IntensityLine`. |
| `docs/archive/history-rolodex/` | Archived in 38.8 (D-12/D-13): `RolodexBrowser`, `RolodexWheel`, `rolodex-logic` and its test, kept as reference outside `src/` (no production imports; excluded from tsc, vitest, Biome and graphify). |
| ~~`src/components/history/DateDetailSheet.tsx`~~ | Retired in 38.8 (D-19/D-22); its rows moved to `HistoryStreamRows`. |
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
3. On the same revision/mount event, "today" is re-evaluated with `formatLocalDate()` through `advanceHistoryDay` (38.3 D-12). The explicit `followingToday` flag in `HistoryDayState`, kept separate from `refDate`, decides rollover. A view showing the current window advances to the new today. A past window the user picked (Prev, or Next that stops short of today) stays put. A lens change, or Next back into the window containing today, resumes following. Today-bound limits always follow the new day: next-window navigation, the stream's Today/Yesterday labels and current year, the empty-state Log prefill and cycles `now`. There is no timer (D-22). Day changes are seen on Profile focus, tab return, app resume and the shell tick.
4. `resolveActiveWindow` maps the lens to a `HistoryWindow` (day lenses) or `null` (Cycles); the Heatmap renders `buckets`+`heatmapLevel`, the Intensity chart renders `intensityWindow` over the same window, and the stream renders the `history-read` records.
5. `isEmptyHistory` is true only when there are zero interactions **and** no lifecycle records — a lifecycle-only contact still shows the zero-count surfaces.

### Heatmap and Intensity (shared window)

1. Changing the lens or preset writes it through `updateAppSettings({historyLens, historyCycleCount})` (global, not per contact) and re-renders both surfaces over the new window.
2. Tapping a cell resolves against all three record families (38.8 D-21). A day or cycle span holding any record jumps the stream to it and highlights it (see below); there is no count card and the stream is never filtered. A truly empty day shows a small note under the heatmap ("Nothing logged on Tue Oct 6") with `Log interaction` prefilled to that day; a truly empty cycle span shows the span note with an undated Log (D-28). The note has a ✕ and also clears on another tap, a lens change, paging and any Jump to date month choice (D-55, D-69). The stream never moves the heatmap window (D-56).
3. `Log interaction` routes the typed `LogContact { contactId, prefillDate }` contract to the canonical detailed form. The prefilled day remains editable.
4. The Year lens uses vertically flowing, weekday-aligned week rows rather than a horizontal scroll container. It reuses the same day-cell renderer, selection, classification, and accessible labels as the other lenses.
5. The day lenses (7 Days / Month, 7 columns) and the Cycles lens (5 columns) fit their measured width (38.4 RG-033, `ui-accessibility/AUD-UIA-010`, D-13). `ActivityHeatmap` measures its container with `onLayout` and sizes each lens's cells with the shared pure `fitHeatmapCell` (`src/components/heatmap-fit.ts`). The width is capped at `DAY_MAX_CELL` 38 or `CYCLE_MAX_CELL` 52 and shrinks below that whenever the width demands it. Both grids are centered, and neither renders until measured. The Cycles grid is exactly five cells plus four gaps wide, so it always wraps at five. The dense Year lens is deliberately unchanged at its fixed `yearCellEdge` 13dp — an accepted limitation.
6. Cell tap zones never overlap (owner default D-42 B). Every interactive cell (7 Days/Month, Cycles, Year) takes its `hitSlop` from the pure `cellHitSlop` (`src/components/heatmap-fit.ts`): each side grows toward 44dp but never past half the gap to the adjacent cell, and an outer side is capped as if a neighbour sat one gap away. With today's 4dp gaps a sub-44dp cell gains 2dp per side (a 32dp day cell has a 36dp zone); Year cells gain 4dp on the side facing the 8dp week gap. Cells at 44dp or more get no slop. The old symmetric `(44 − edge) / 2` slop overlapped neighbours in every lens (16dp across 4dp gaps in Year).

### Explicit timestamp presentation

Visible local timestamps use `formatDateTimeMinuteOrFallback()` from `src/utils/dates.ts`. It preserves stored local-wall-clock values and structured raw fields, renders a 12-hour minute-precision default, and displays `Unknown time` rather than exposing malformed raw storage. Relative language remains separate.

Rows that already sit within a known day render the clock alone through the paired time-only helper `formatTimeMinuteOrFallback()` (38.4, RG-038 `ui-accessibility/AUD-UIA-018`, D-07). Both helpers share one private clock renderer and the module-private `TIME_FORMAT`, so a time-only row and a date-time field can never disagree: `00:00` → `12:00 AM`, `12:00` → `12:00 PM`, `23:59` → `11:59 PM`, and seconds are truncated (`09:05:59` → `9:05 AM`, `09:06:00` → `9:06 AM`). The formatters are display-only — stored precision, native editing precision and local-date handling are unchanged, and there is no 12/24-hour preference. Never slice `HH:MM` out of the stored string: that yields 24-hour text that disagrees with every other surface.

Covered explicit-timestamp consumers (visible text **and** accessibility labels):

| Consumer | Helper |
|---|---|
| History stream rows in `HistoryStreamRows` (interaction, lifecycle, knowledge; was `DateDetailSheet` before 38.8) | `formatTimeMinuteOrFallback` |
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

### The History stream (38.8)

1. Below Intensity sits a single **Jump to date** button, then the stream (D-32). Records are newest first, grouped year → month header → day label, and only dates with records render (D-14, D-15). Day labels read Today / Yesterday / weekday + month + day; accessible labels carry the full date with the year (D-33).
2. Only the current year is expanded. Each older year with records is a collapsed row "<year> · <n> interaction(s)" (interaction rows only, singular/plural) that expands on tap (D-34, D-35). A current year with no records still shows its header with "Nothing logged in <year> yet" (D-36).
3. An expanded year shows its newest `STREAM_INITIAL_VISIBLE` records, then **Show older** adds `STREAM_CHUNK` more; a chunk boundary never splits a day, and the button disappears when the year is fully shown (D-39).
4. Rows: an interaction row shows the channel icon and label, minute time, direction / No reply / quality, up to two lines of note and, for a group-linked child, the group-event label; it opens `InteractionDetail` (D-16, D-41, D-42). Lifecycle rows are muted and read-only (D-40). Knowledge rows keep the pencil + field + value look and open `MemoryHistory` (D-43). No long-press, sparkle, duration or day counts (D-44..D-47). Equal timestamps order interactions, then lifecycle, then knowledge, then id descending.
5. Stream state (open years, loaded chunks) is transient: each new Profile visit starts fresh (D-62).

### Jump to date (38.8)

1. Jump to date opens `JumpToDateSheet`: a year stepper (earliest record's year to the current year) over a 3×4 month grid. Months holding any record get a dot, named in the accessible label; future months are disabled (D-48, D-49, D-52). It preselects the month in view, which under the non-sticky button is the current month in practice (D-50, D-68).
2. A month with records opens its year, loads chunks until the month header renders and scrolls the Profile to that header, with no highlight (D-17).
3. An empty month shows an explicit state **under the Jump to date button** (not under the heatmap): "No activity in <Month YYYY>." with the nearest dates after and before it, an undated `Log interaction`, and ✕ (D-17, D-28, D-64). Each nearest date jumps and highlights like a heatmap tap (D-65). Any month choice also clears the heatmap note, so only one empty note shows at a time (D-69).

### Jump and highlight (38.8)

1. A populated day tap, a populated cycle tap (it lands on the span's newest record) or a nearest date expands the target's year, grows its chunks until the target renders, and scrolls the Profile so the day sits just below the app bar (D-19, D-20, D-18). The target is measured against the History anchor in `ProfileModuleHost`; a later stream action cancels a pending jump.
2. The highlight is an accent bar down the left of the target day's (or span's) records plus a faint tint, from theme tokens, fading over `HIGHLIGHT_FADE_MS` (D-53, D-54). Under reduced motion the jump scroll is not animated and the highlight holds, then disappears without a fade (D-23, D-54).
3. Each jump announces "Showing <full date>" (or the month) once to screen readers; the rows have no live region, so focus is not pulled (D-23).

### Cycles paging and the no-cadence Month fallback (38.8)

1. Cycles has the same previous/next control as the day lenses. It moves one whole displayed page (the selected preset count); next is disabled on the page that ends today; Intensity follows the paged span; a lens or preset change returns to the current page (D-25, D-26). Cycle titles, cell labels and the empty-span note carry the year when a span is not wholly in the current year (D-70).
2. When the saved lens is Cycles and the contact has no cadence, History shows Month with the note "Showing Month: this contact has no set frequency, so Cycles aren't available." without writing `history_lens` (D-27). A Cycles tap there shows "Cycles need a set frequency for this contact." with the preset row still shown (D-71); a Month tap returns to the fallback; neither tap writes the global lens (D-66, D-67).
3. Lens labels use the opt-in `compact` density of `SegmentedControl` (`COMPACT_SEGMENT`) so "Cycles / 7 Days / Month / Year" read in full at default text size (D-24).

### Keeping the user's place (38.8)

1. A refresh keeps the Profile's numeric scroll offset. When the model changes, `streamStateOnModelChange` pins each open year's request to its previously rendered boundary, so records added above (a Log from the Profile + button, a MemoryHistory edit) never push the last rendered day out (review CR-01). Content inserted above still moves the view down by its own height.
2. Opening a row's `InteractionDetail` or `MemoryHistory` sets a one-shot anchor. After the next history read: a record redated to a newer day scrolls once to its new day; a day emptied by a redate or delete scrolls once to the nearest remaining day; a day no longer rendered is revealed and scrolled to; otherwise nothing moves (D-31). No highlight, never persisted.
3. On a New Year rollover the year the user was browsing stays open (review WR-03).

### Inspecting, editing, and deleting an interaction

1. A stream row → `InteractionDetail`, which renders only present fields, a restrained AI sparkle strictly when `allow_ai === 1`, and Edit/Delete.
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
| `STREAM_INITIAL_VISIBLE` / `STREAM_CHUNK` | `20` / `20` | `src/components/history/history-stream-logic.ts` | Records shown when a year opens / added per Show older (whole days only). |
| `HIGHLIGHT_FADE_MS` | `5000` | `src/components/history/HistoryHighlight.tsx` | Jump highlight fade, or the hold under reduced motion. |
| `HIGHLIGHT_TINT_OPACITY` | `0.14` | `src/components/history/HistoryHighlight.tsx` | Peak tint behind the highlighted records. |
| `COMPACT_SEGMENT` | `{ gap: 6, paddingHorizontal: 4, fontSize: 16 }` | `src/components/SegmentedControl.tsx` | Opt-in compact density used only by the History lens row (D-24; 16sp confirmed on device in 38.8). |
| Your Week periods | Rolling 7 Days / locale-aware Calendar Week | `src/services/history/week-window.ts` | Shared app-wide local-date window vocabulary. |
| `DAY_MAX_CELL` / `CYCLE_MAX_CELL` | `38` / `52` | `src/components/history/ActivityHeatmap.tsx` | Per-lens cell caps; the fitted edge never exceeds them (RG-033). |
| `HEATMAP_GEOMETRY.yearCellEdge` | `13` | `src/components/history/ActivityHeatmap.tsx` | Fixed dense Year cell; not width-fitted. |
| `DAY_ROW_GAP` / `YEAR_DAY_GAP` / `YEAR_WEEK_GAP` / `YEAR_ROW_GAP` | `4` / `4` / `8` / `4` | `src/components/history/ActivityHeatmap.tsx` | Grid gaps that both lay out the grid and cap each cell's tap-zone growth at half the gap (D-42 B). |

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
- **[ADR-165: In-Profile History Reveal, Today-Following Rollover, and Snapshot-Coherent History](../decisions/ADR-165-in-profile-history-reveal-today-following-rollover-and-snapshot-coherent-history.md)** — re-reads History from the parent Profile revision, follows today only on the current window, and holds a local lens choice over stale re-reads.
- **ADR-174:** Fit-to-Width Heatmaps and Large-Text Reachability for Dialogs and Sheets — measured, centred heatmaps with capped tap zones; dialog, sheet and prompt actions stay reachable at maximum text.
- **Phase 38.8 (pending KB extraction):** the stream supersedes ADR-121 in full and ADR-122/ADR-123 in part (D-10, D-19, D-20, D-25 in `38.8-CONTEXT.md` `<supersessions>`). The ADRs above are unchanged until `extract-phase-kb` records the supersessions.

## Gotchas

1. **Correctness-critical math lives in pure `.ts`, not the `.tsx`.** Window/bucket/cycle/intensity math and the wheel date math are node-tested in sibling `.ts` files because the animated/RN `.tsx` cannot load under vitest. Put new count/date logic there, not in a component.
2. **Intensity is genuinely window-scoped.** `intensity-window` filters to the window, sets `effectiveNow` = window end-of-day and `periodDays` = window day-span, and calls the pure `computeIntensity` core. The whole-history wrapper with real `now` reads ~0 for any past window — do not reuse it here.
3. **The Cycles lens has no date grid.** Intensity for Cycles is computed over a synthetic span window `[oldest.start, newest.end]`; day lenses use the real shared window.
4. **A structural blank is not a zero-count day.** `heatmapScale[0]` is a real logged-nothing plate; `heatmapCellEmpty` is a transparent Month/Year padding cell. Keep them distinct (node-tested) so a placeholder never reads as activity.
5. **The current cycle is marked structurally, never by a second hue.** Use the outline + `Current cycle` a11y label; the colour ramp means count only.
6. **Group context is local presentation only.** Keep Group Note distinct from the participant note; child Allow-AI never authorizes shared text.
7. **A heatmap tap never filters the stream (38.8).** A populated target jumps and highlights; only a truly empty day/span gets a note. Emptiness is decided across all three record families, never by the interaction count.
8. **Backfill routes detailed logging, never Quick Log.** `buildLogRoute` returns the typed `LogContact { contactId, prefillDate }` — Quick Log means "now" and must not be reused for a historical date.
9. **The History date is only an initial value.** The detailed Log Interaction form may edit it; a multi-day History range must never invent an exact day.
9. **Worklet-forward-ref safety.** Worklets (formerly the Rolodex depth worklet, now the `HistoryHighlight` animated styles) are defined above their callers; a worklet calling a helper defined later crashes undefined-on-device on Hermes and vitest cannot catch it.
10. **IntensityChart caption reads the contact cadence, not the window span.** A regression once made the caption describe the window; it now reflects the contact's true intended cadence (fixed live during UAT, commit `84e4013`).
11. **Do not make Digest a second History reader.** It can reuse presentation helpers and `week-window`, but its app-wide aggregate and group-parent deduplication remain a distinct read boundary.
12. **Do not display raw local timestamp storage.** Explicit timestamp consumers use the shared minute formatter; relative formatters and stored/structured values remain unchanged.
13. **Never re-read History independently of the parent revision — the two projections must share one trigger.** History reads only on mount and on the Profile's `revision`. An independent focus, timer or post-delete re-read lets the metrics and History disagree (38.3 RG-024).
14. **Detail sheets rely on the Sheet scroll body at large text (D-32, RG-034 follow-on, device-found).** `InteractionDetail` is a plain `detail` sheet: at font_scale 2.0 on a ≈320dp phone its Edit/Delete row now scrolls into reach inside the 60% cap instead of clipping. `JumpToDateSheet` is a plain `compact` sheet: at maximum text its last month row sits below the cap and scrolls into reach in the same bounded body (checked on device in 38.8). The retired `DateDetailSheet` was the one History opt-out (`scrollBody={false}`). Do not wrap either in another ScrollView (`sheet-consumers-contract.test.ts`).
15. **The reveal can land short when History was collapsed (38.8 device pass, open).** Last Interaction / View history fire the reveal scroll on the first layout of the newly expanded section, which can still be the short "Loading history…" placeholder; the page is then too short and the scroll stops at its end. Seen on every DEBUG try and intermittently on release; see the 38.8 phase-end report.

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
| 2026-09-26 | 38.4 | Heatmap tap zones never overlap (Plan 18, owner default D-42 B): cell `hitSlop` comes from `cellHitSlop`, capped at half the gap to each neighbour, in the 7 Days/Month, Cycles and Year lenses. |
| 2026-10-08 | 38.8 | History browsing became an activity-first stream (year → month → day, collapsed older years, Show older) with Jump to date (month grid with record dots, empty-month state with nearest dates), heatmap jump-and-highlight (no count card, no filtering; empty-day/span note under the heatmap; one empty note at a time), Cycles paging by whole page with years on off-year spans, the no-cadence Month fallback, place-keeping across edit/redate/delete/refresh and the visible title "History". The Rolodex is archived under `docs/archive/history-rolodex/`; `DateDetailSheet` and `HeatmapContextCard` are retired. |
