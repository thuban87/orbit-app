---
phase: 26-dashboard-control-surface
plan: 03
subsystem: database
tags: [sqlite, dashboard, search, vitest, tdd]
requires:
  - phase: 25-dashboard-data-state
    provides: Dashboard query-state population, filter, gravity, and sort primitives
  - phase: 26-dashboard-control-surface
    provides: Dashboard control-state integration context
provides:
  - Population-aware, bound-only Dashboard search preserving A3 scope semantics
  - Bound-only birthday, favourite, and all-contact population count helpers
affects: [HomeScreen, dashboard-empty-state, Phase 26 Plan 07]
actuals:
  tokens: 4095
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns: [shared population read composition, post-query gravity and birthday parity]
key-files:
  created: []
  modified: [src/db/dashboard-read.ts, src/db/dashboard-read.test.ts]
key-decisions:
  - "Search applies A3's archived-only relaxation only for the implicit Active population."
  - "Population search and no-term reads share birthday resolution, population SQL composition, sorting, and gravity post-processing."
  - "Dashboard empty-state counts are bound-only and filters-naive, matching their named population universes."
requirements-completed: [DASHC-07]
coverage:
  - id: D1
    description: Population-aware Dashboard search with A3 scope, literal LIKE escaping, filters, birthday ordering, and gravity parity.
    requirement: DASHC-07
    verification:
      - kind: unit
        ref: src/db/dashboard-read.test.ts#listDashboardSearch — population-aware search + A3 scope
        status: pass
      - kind: integration
        ref: npm test
        status: pass
    human_judgment: false
  - id: D2
    description: Bound-only birthday, favourite, and all-contact empty-state count helpers.
    requirement: DASHC-07
    verification:
      - kind: unit
        ref: src/db/dashboard-read.test.ts#listDashboardSearch — population-aware search + A3 scope
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-09-05
status: complete
---

# Phase 26 Plan 03: Population-Aware Dashboard Search Summary

**Dashboard search now composes persisted populations and filters with safe term matching while retaining A3 scope behavior and the exact birthday/gravity semantics of the population list.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-05T12:29:03Z
- **Completed:** 2026-09-05T12:34:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `listDashboardSearch`, keeping archived contacts and Unbound contacts out while relaxing only implicit Active search to include matching never-contacted and snoozed contacts.
- Shared population composition, upcoming-birthday resolution, default sort handling, and gravity post-processing between list and search reads to prevent behavior drift.
- Added bound-only birthday, favourites, and all-contact counts for the Dashboard empty-state population record.
- Added 15 focused tests for A3 behavior, snippets, escaping, filters, ordering, birthday/gravity parity, and count parity.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED test contract** - `0c305fb` (test)
2. **Task 1: GREEN search and count implementation** - `41d6ab7` (feat)
3. **Task 2: parity and injection hardening** - `ec26e6d` (test)

## Files Created/Modified

- `src/db/dashboard-read.ts` - Shared population read internals, safe dashboard search, and bound-only count helpers.
- `src/db/dashboard-read.test.ts` - Search, parity, injection, ordering, and count coverage.

## Decisions Made

- The A3 relaxation is confined to a term with no explicit population; explicit populations remain scoped by `buildPopulationWhere` and filters continue to AND-compose.
- Count helpers intentionally omit filters, matching the empty-state resolver's population-size inputs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a stale local reference after extracting shared population composition**
- **Found during:** Task 1
- **Issue:** `listDashboardPopulation` still referenced the removed `matches` local, causing its pre-existing parity suite to fail.
- **Fix:** Read match columns through the shared composition object.
- **Files modified:** `src/db/dashboard-read.ts`
- **Verification:** Focused dashboard-read suite, TypeScript, and color checks passed.
- **Committed in:** `41d6ab7`

**2. [Rule 1 - Bug] Typed parity-test query objects as mutable dashboard state**
- **Found during:** Task 2
- **Issue:** `as const` population arrays were incompatible with mutable `DashboardQueryState` arrays under TypeScript.
- **Fix:** Declared the test query objects as `DashboardQueryState`.
- **Files modified:** `src/db/dashboard-read.test.ts`
- **Verification:** `npx tsc --noEmit` passed.
- **Committed in:** `ec26e6d`

**Total deviations:** 2 auto-fixed Rule 1 issues. All were directly caused by the planned refactor/tests; no scope expansion.

## Verification

- `npx vitest run src/db/dashboard-read.test.ts` — 64 passed
- `npx tsc --noEmit` — passed
- `npm run check:colors` — passed
- `npm test` — 236 files / 2,268 tests passed

## Known Stubs

None.

## Self-Check: PASSED

- Summary and both modified source/test files exist.
- Task commits `0c305fb`, `41d6ab7`, and `ec26e6d` exist in git history.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 07 can consume `listDashboardSearch`, `countBirthdayPopulation`, `countFavourites`, and `countAllContacts` without another dashboard data-layer read fork.

---
*Phase: 26-dashboard-control-surface*
*Completed: 2026-09-05*
