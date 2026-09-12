---
phase: 32-interaction-history-insights
plan: 03
subsystem: history-aggregation
tags: [history, heatmap, intensity, cycles, aggregation, dao, read-only, pure-functions, react-native]

requires:
  - phase: 32-interaction-history-insights
    plan: 01
    provides: "migration 025 (TARGET_VERSION=25): interactions.duration/allow_ai, Tone/channel remap, app_settings.history_lens/history_cycle_count"
  - phase: 06-impact
    provides: "impact.ts computeContactIntensity + the pure computeIntensity core, the { available:false } nullable-cadence guard, ImpactInputs shape"
  - phase: 24.1-contact-knowledge-foundation
    provides: "current-state-history-read.getCurrentStateHistory + memory-registry.CURRENT_STATE_FIELD_KEYS"
provides:
  - "src/services/history/window.ts — pure lens->date-window generation (7days/month/year) with future-flag + prev/next today-clamped navigation"
  - "src/services/history/buckets.ts — count-only per-cell bucketing + heatmapLevel(count, lens) with one tunable two-table object"
  - "src/services/history/cycles.ts — cadence cycle-block math (presets 5/10/15/20) with the verbatim nullable-cadence { available:false } fallback"
  - "src/services/history/intensity-window.ts — window-scoped intensity (filter to window, effectiveNow=window end-of-day, periodDays=window day-span, pure computeIntensity core)"
  - "src/db/history-read.ts — canonical single-contact ReadOnlyExecutor read: date-indexed interaction records + lifecycle events + per-date markers + hasLifecycleRecords + knowledge-change family; isGroupLinked inert seam (hard-false, D-12)"
affects: [phase-32-plan-04-edit-route, phase-32-plan-05-history-lens, phase-32-plan-06-heatmap, phase-32-plan-07-detail-sheet-allow-ai, phase-32-plan-08-browser, phase-33-group-logging]

actuals:
  tokens: 13540
  tasks: 3
  commits: 8

tech-stack:
  added: []
  patterns:
    - "Pure node-testable aggregation seam (window/buckets/cycles/intensity-window) separated from the .tsx renderers the node harness cannot load"
    - "Injected `today`/`now` (never wall-clock) for deterministic, node-testable local-date windows"
    - "Reuse of the impact.ts { available:false } nullable-cadence guard VERBATIM in both cycles.ts and intensity-window.ts (never a second divergent guard)"
    - "Inert code seam: a predicate keyed on a not-yet-existing column resolves hard-false without any early schema (D-12)"

key-files:
  created:
    - src/services/history/window.ts
    - src/services/history/window.test.ts
    - src/services/history/buckets.ts
    - src/services/history/buckets.test.ts
    - src/services/history/cycles.ts
    - src/services/history/cycles.test.ts
    - src/services/history/intensity-window.ts
    - src/services/history/intensity-window.test.ts
    - src/db/history-read.ts
    - src/db/history-read.test.ts
  modified:
    - src/db/current-state-history-read.ts

key-decisions:
  - "D-09 [DERIVED]: no-cadence Cycles/Intensity fallback returns the tagged { available:false } — consistent with the now-complete Phase 31's computeContactIntensity treatment; callers default the lens to 7 Days and render Cycles as unavailable. Not a new owner decision."
  - "intensity-window filters to the window bounds and passes effectiveNow = window end-of-day (23:59:59) + periodDays = window day-span (calendarDaysBetween(start,end)+1), calling the pure computeIntensity core — NOT the whole-history wrapper with real now (which reads ~0 for any past window)."
  - "The group-link discriminator (isGroupLinked) is an inert predicate hard-false in Phase 32; no group-event-id column is selected, joined, or assumed (D-12). Phase 33's migration 026+ makes it live."
  - "getCurrentStateHistory widened from SqlExecutor to a read-only Pick<SqlExecutor,'getAllAsync'> surface so the read layer composes it without a writable executor (Rule 3 blocking-issue)."

patterns-established:
  - "History aggregation lives in src/services/history/*.ts as pure functions; correctness-critical count/cycle/window math is fully node-tested there, not in .tsx"
  - "history-read is the canonical single-contact read superseding profile-history-read's renderer contract (no persistence change, no LIMIT 3)"

requirements-completed: [HIST-02, HIST-04, HIST-05, HIST-06, HIST-10, HIST-16]

duration: 8min
completed: 2026-09-11
status: complete
---

# Phase 32 Plan 03: Temporal aggregation seam + canonical history-read Summary

**A pure, node-tested aggregation seam — lens window generation, count-only heatmap bucketing, cadence cycle-block math, and genuinely window-scoped intensity — plus the canonical single-contact `history-read` DAO (date-indexed records, lifecycle markers, a distinct lifecycle-only signal, and a knowledge-change family), with the group-link discriminator an inert hard-false predicate that references no Phase-33 schema.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 3 (all `tdd="true"`, RED→GREEN per task)
- **Files created:** 10 (5 source + 5 test); 1 modified

## Accomplishments

- **Task 1 — window + buckets.** `window.ts` generates ordered local-date grids per lens: 7 Days (rolling 7 ending at min(ref,today)), Month (weekday-aligned grid with leading/trailing placeholders, in-month future dates flagged), Year (GitHub-style dense daily grid, weeks-as-columns). `prev/next` navigation shifts and clamps so a window can never advance wholly past today. `buckets.ts` maps a window + interaction rows to count-only per-cell counts (a date with no interaction row is structurally 0 — lifecycle records never reach the function), and `heatmapLevel(count, lens)` buckets to 0..3 (day lenses) / 0..4 (cycle lens) from one tunable two-table object at file top. All local-date; a UTC evening off-by-one test proves an evening `occurred_at` buckets to its local date.
- **Task 2 — cycles + intensity-window.** `cycles.ts` builds `count` contiguous interval-length blocks ending at `now` (newest = current = last, flagged `isCurrent`), reusing impact.ts's `{ available:false }` guard verbatim for a null interval / disabled tracking (never divides by null). `intensity-window.ts` is genuinely window-scoped: it filters interactions to `[window.start 00:00:00, window.end 23:59:59]`, passes `effectiveNow = window end-of-day` and `periodDays = window day-span`, and calls the pure `computeIntensity` core (never the whole-history wrapper with real now). The fixed-value regression pins `currentCount === 3` for a populated March-2020 window — the same inputs against real now read 0.
- **Task 3 — canonical history-read.** `history-read.ts` returns date-indexed interaction records (channel/occurred_at/direction/connected/quality/note/duration/allow_ai), read-only lifecycle events, per-date markers (interaction / lifecycle-only / multiple), a distinct `hasLifecycleRecords` signal (so Plan 08 tells zero-interactions-ever from lifecycle-only), and a knowledge-change family that unions **every** registered current-state field via `getCurrentStateHistory` (single-field-at-a-time — calling it once would drop the others), each record carrying its `fieldKey` for Plan 07 routing. Counts resolve only from `interactions` rows (D-10). The `isGroupLinked` predicate is an inert seam: hard-false for every Phase-32 row, no group-event-id column referenced (D-12).

## Task Commits

1. Task 1 RED — `6f2d308` (test): failing window/buckets specs
2. Task 1 GREEN — `4b0896e` (feat): window generation + count-only bucketing
3. Task 1 grep-gate tidy — `cf59ac6` (docs): drop literal banned-API token from comments
4. Task 2 RED — `31fb868` (test): failing cycles + window-scoped intensity specs
5. Task 2 GREEN — `78a123d` (feat): cycle-block math + window-scoped intensity
6. Task 3 RED — `6f13e0a` (test): failing history-read spec
7. Task 3 GREEN — `7e98c25` (feat): canonical history-read DAO + read-only widening

## TDD Gate Compliance

Each task followed RED (failing `test(...)` commit) → GREEN (`feat(...)` commit) in git log. All three RED commits precede their GREEN counterparts.

## Verification

- `window.test.ts` + `buckets.test.ts`: 18 pass. `cycles.test.ts` + `intensity-window.test.ts`: 12 pass. `history-read.test.ts`: 8 pass.
- Full suite: **3007 tests pass**; only the pre-existing, unrelated `src/components/orrery/orrery-controls-render.test.tsx` load failure remains (documented in 32-01, imports none of this plan's files).
- `npx tsc --noEmit`: clean (exit 0).
- Source-discipline greps all empty: `toISOString` (window/buckets/intensity-window), `group_event_id` + `inWriteTransaction` (history-read), and `computeContactIntensity` (intensity-window). `available: false` present in both cycles.ts and intensity-window.ts.

## Decisions Made

- **D-09 no-cadence fallback [DERIVED]:** both `cycles` and `intensityWindow` return the tagged `{ available:false }` for a null interval / disabled tracking — the same shape Phase 31's intensity treatment already uses. Callers default the lens to 7 Days and render Cycles as unavailable. Consistent with Phase 31 (complete); not an owner stop.
- **Window-scoped intensity derivation is pinned in code** (effectiveNow=window end-of-day, periodDays=window day-span, pure core), resolving the review cycle-2 HIGH that a naive whole-history wrapper reads ~0 for a past window.
- **Group seam stays inert** (D-12): no group-event-id schema referenced; the predicate is hard-false. Making it "exercisable" by adding the column early would reverse D-07 — not done.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `getCurrentStateHistory` typed for a writable executor**
- **Found during:** Task 3
- **Issue:** `history-read` is contractually a `ReadOnlyExecutor` read (must-have), but `getCurrentStateHistory` required a full `SqlExecutor`, so the read layer could not compose it without holding a writable executor.
- **Fix:** Widened its `exec` parameter to `Pick<SqlExecutor, "getAllAsync">` (the only method it uses). Backward-compatible — every existing caller passes a `SqlExecutor`, which satisfies the narrower surface.
- **Files modified:** `src/db/current-state-history-read.ts`
- **Verification:** `current-state-history-read.test.ts` green; full `tsc` clean.
- **Committed in:** `7e98c25`

**2. [Rule 1 - source discipline] Banned-API tokens in comments tripped the grep gates**
- **Issue:** Explanatory comments referenced `toISOString`, `computeContactIntensity`, and `group_event_id` by name (in the "never use / hard-false" sense). The plan's source-discipline grep gates expect those tokens to return nothing.
- **Fix:** Reworded the comments to describe the banned APIs without the literal tokens, keeping the gates empty. No behavior change.
- **Committed in:** `cf59ac6` (window/buckets), `78a123d` (intensity-window), `7e98c25` (history-read).

**Total deviations:** 2 (1× Rule 3, 1× source-discipline tidy). No scope creep; no architectural change.

## Known Stubs

None. The group-link discriminator (`isGroupLinked`) is an intentional **inert seam** per D-12 (hard-false until Phase 33's migration 026+), not a stub — documented in-file and asserted by test.

## Issues Encountered

None beyond the pre-existing orrery-controls-render load failure (unrelated, logged in 32-01).

## Next Plan Readiness

- Plans 04–08 can now consume the aggregation seam: Plan 05 (lens/preset) drives `buildWindow`/`cycles`; Plan 06 (heatmap) renders `buckets` + `heatmapLevel`; the Intensity surface consumes `intensityWindow` over the shared window; Plans 07/08 consume `readContactHistory` records/markers/`hasLifecycleRecords`/knowledge-change family.
- The group seam remains inert; Phase 33 owns the `group_event_id` migration that makes `isGroupLinked` live.

## Self-Check: PASSED

- Created files verified on disk: window.ts, buckets.ts, cycles.ts, intensity-window.ts, history-read.ts (+ their .test.ts), 32-03-SUMMARY.md.
- Commits verified in git log: 6f2d308, 4b0896e, cf59ac6, 31fb868, 78a123d, 6f13e0a, 7e98c25.

---
*Phase: 32-interaction-history-insights*
*Completed: 2026-09-11*
