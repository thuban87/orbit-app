---
phase: 25-dashboard-data-state-foundation
plan: 02
subsystem: database
tags: [sqlite, dashboard, population-query, zustand, birthday-logic]
requires:
  - phase: 25-dashboard-data-state-foundation
    provides: Plan 01 durable Dashboard query state, Active predicate, and population read seam
provides:
  - Closed, scoped OR-union predicates for all Dashboard populations
  - Population-aware Default ordering and injected-time Birthday selection
  - Persisted population-axis integration coverage through the Dashboard store
affects: [25-03, 25-04, 25-05, 25-06, 25-07, 26-dashboard-control-surface, 27-dashboard-list-view, 28-dashboard-card-view]
actuals:
  tokens: 4918
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: [closed population SQL fragments, single-SELECT OR-union, injected local read time, JS birthday post-sort]
key-files:
  created: []
  modified:
    - src/logic/dashboard-query-logic.ts
    - src/logic/dashboard-query-logic.test.ts
    - src/db/dashboard-read.ts
    - src/db/dashboard-read.test.ts
    - src/stores/dashboard-query-store.test.ts
key-decisions:
  - "Every explicit population is constrained by archived and Bound scope before its OR-union predicate is evaluated."
  - "Birthday eligibility uses the shared local-midnight parser from injected read time; birthday Default ordering is a JS post-query sort."
  - "Default remains a persisted sentinel: single Not Contacted and Snoozed populations resolve to natural order, while multi-population selections resolve to status."
patterns-established:
  - "Population tokens select only closed SQL fragments and all runtime ids use ? bindings."
  - "One dashboard SELECT retains selected-population match flags while SQLite dedupes overlapping membership naturally."
requirements-completed: [DASHQ-02, DASHQ-03, DASHQ-04, DASHQ-05, DASHQ-07, DASHQ-14]
coverage:
  - id: D1
    description: "All Dashboard populations compose as a scoped, deduped OR-union with retained membership reasons."
    requirement: DASHQ-02
    verification:
      - kind: integration
        ref: "src/db/dashboard-read.test.ts#returns a deduped Favourites and Not Contacted OR-union with match reasons"
        status: pass
    human_judgment: false
  - id: D2
    description: "All Contacts preserves Active and Not Contacted semantics, including snoozed real status and never-contacted null status."
    requirement: DASHQ-03
    verification:
      - kind: integration
        ref: "src/db/dashboard-read.test.ts#keeps snoozed status-bearing contacts in Active and All Contacts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Population-aware Default ordering and the injected 30-day Birthday window are deterministic."
    requirement: DASHQ-04
    verification:
      - kind: unit
        ref: "src/logic/dashboard-query-logic.test.ts and src/db/dashboard-read.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Persisted population selection rehydrates into the same OR-union and an empty selection returns to Active."
    requirement: DASHQ-07
    verification:
      - kind: integration
        ref: "src/stores/dashboard-query-store.test.ts#persists the population axis into the OR-union read and rehydrates an empty selection as Active"
        status: pass
    human_judgment: false
duration: 6m 47s
completed: 2026-09-05
status: complete
---

# Phase 25 Plan 02: Dashboard Data & State Foundation Summary

**Six Dashboard populations now resolve through one scoped OR-union read, with population-aware Default sorting and a parser-backed 30-day Birthday window.**

## Performance

- **Duration:** 6m 47s
- **Started:** 2026-09-05T03:52:02Z
- **Completed:** 2026-09-05T03:58:49Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Built a closed SQL predicate model for Favourites, Birthdays, Not Contacted, Snoozed, and All Contacts while retaining the empty-selection Active universe.
- Expanded `listDashboardPopulation` into one parameterized, dedupe-friendly SELECT with membership flags, natural Default orders, and never-contacted null status projection.
- Computed Birthday eligibility through the shared parser using injected local read time, then applied the sole-Birthday Default order in JavaScript.
- Proved population persistence, rehydration, OR-union reading, and deselect-last-to-Active behavior through the Zustand store.

## Task Commits

1. **Task 1: Population predicate model — all six universes + OR-union + Default resolution** - `5e2a9a2` (feat)
2. **Task 2: dashboard-read OR-union population read + Birthdays 30-day window** - `a87cfd4` (feat)
3. **Task 3: Wire the population axis into the query store + full-suite guard** - `a6cf934` (test)

## Files Created/Modified

- `src/logic/dashboard-query-logic.ts` - Closed population predicates, safe bound-id construction, and Default-sort resolution.
- `src/logic/dashboard-query-logic.test.ts` - Pure OR-union, unknown-token, Birthday bind, and Default resolution coverage.
- `src/db/dashboard-read.ts` - Scoped one-SELECT population query, match-reason flags, injected birthday window, and natural ordering.
- `src/db/dashboard-read.test.ts` - Node SQLite coverage for unions, scoping, status handling, natural orders, and Birthday sorting.
- `src/stores/dashboard-query-store.test.ts` - Durable population selection integration coverage.

## Decisions Made

- Active remains exactly the ADR-011 three-clause predicate; snoozed contacts are eligible in Active and All Contacts, with Needs Attention suppression remaining Plan 03 work.
- All Contacts is encoded as `Active OR Not Contacted` beneath one archived-and-Bound scope, rather than weakening Active or using a SQL UNION.
- The read takes `now` from its caller and never reads the wall clock itself; Birthday IDs are `?`-bound and only Birthday-as-sole-population receives post-query soonest-first ordering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Completed the population sort map while adding internal Default tokens**

- **Found during:** Task 1
- **Issue:** The new natural Default tokens widened `resolveDefaultSort`'s return type, leaving the existing read-layer map non-exhaustive and TypeScript unable to compile.
- **Fix:** Added the closed natural Snoozed, Not Contacted, and temporary deterministic Birthday map entries; Task 2 then activated their population-read behavior.
- **Files modified:** `src/db/dashboard-read.ts`
- **Verification:** `npx tsc --noEmit` passed.
- **Committed in:** `5e2a9a2`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required to preserve compilation while introducing the internal sort outcomes; no product-scope expansion.

## TDD Gate Compliance

Task 1 and Task 2 each ran a RED verification before implementation, followed by passing focused tests and TypeScript checks. Their RED test edits were committed with the corresponding feature commit rather than as separate `test(...)` commits, so no standalone RED commit exists in git history.

## Issues Encountered

None. The standard Vitest Vite-config and node:sqlite experimental warnings were non-failing and pre-existing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 can compose filters and Gravity over the same injected `now` population read without reintroducing a wall-clock read. The control and renderer phases can consume the retained population flags and shared persisted query state.

## Self-Check: PASSED

- Confirmed all five changed source/test files and this summary exist.
- Confirmed task commits `5e2a9a2`, `a87cfd4`, and `a6cf934` exist in git history.
