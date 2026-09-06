---
phase: 28-dashboard-card-view
plan: "02"
subsystem: database
tags: [sqlite, transactions, bulk-actions, recency, lifecycle-events]
requires:
  - phase: 25-dashboard-data-state-foundation
    provides: shared dashboard data and write-transaction primitives
  - phase: 28-dashboard-card-view
    provides: card-view bulk-management requirements
provides:
  - Atomic dashboard bulk-action DAO composers and exact Quick Log undo receipts
  - Non-mutexed contact, favourite, snooze, and interaction-delete cores
affects: [28-04, 28-05, HomeScreen, dashboard-selection]
actuals:
  tokens: 7283
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns: [one outer transaction with non-mutexed cores, one data-revision bump per batch]
key-files:
  created: [src/db/bulk-actions-dao.ts, src/db/bulk-actions-dao.test.ts]
  modified: [src/db/contacts-dao.ts, src/db/favourites-dao.ts, src/db/snooze-dao.ts, src/db/recency-dao.ts, src/db/events-dao.ts]
key-decisions:
  - "Bulk operations compose existing single-contact cores under one outer transaction rather than set-based writes."
  - "Bulk Quick Log pins outbound/manual canonical interaction values and returns exact inserted-row receipts for undo."
patterns-established:
  - "Bulk writer: validate before transaction, short-circuit empty selections, loop non-mutexed cores, then bump data revision once."
requirements-completed: [CARDV-07, CARDV-08, CARDV-10, CARDV-11]
coverage:
  - id: D1
    description: Atomic bulk management composers for favourites, snooze, category, frequency, and archive.
    requirement: CARDV-07
    verification:
      - kind: unit
        ref: src/db/bulk-actions-dao.test.ts#other bulk action composers
        status: pass
    human_judgment: false
  - id: D2
    description: Bulk Quick Log writes canonical interactions, advances recency, and supports exact receipt-based undo.
    requirement: CARDV-08
    verification:
      - kind: unit
        ref: src/db/bulk-actions-dao.test.ts#bulkQuickLog
        status: pass
    human_judgment: false
  - id: D3
    description: Bulk archive updates contact state with one immutable archive event per contact and rolls back mixed-invalid batches.
    requirement: CARDV-10
    verification:
      - kind: unit
        ref: src/db/bulk-actions-dao.test.ts#other bulk action composers
        status: pass
    human_judgment: false
  - id: D4
    description: Bulk frequency accepts only positive integers and preserves the cadence schema invariant.
    requirement: CARDV-11
    verification:
      - kind: unit
        ref: src/db/bulk-actions-dao.test.ts#updates only category and validates positive integer frequencies
        status: pass
    human_judgment: false
duration: 8m
completed: 2026-09-06
status: complete
---

# Phase 28 Plan 02: Bulk action data-layer summary

**Atomic card-selection writes reuse the app's single-contact invariants for recency, lifecycle events, cadence, and exact Quick Log undo.**

## Performance

- **Duration:** 8m
- **Started:** 2026-09-06T08:35:42Z
- **Completed:** 2026-09-06T08:43:32Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Extracted non-mutexed archive, favourite, snooze, and interaction-delete cores while preserving existing public writers.
- Added nine bulk composers that each use one outer transaction and one revision bump, with no set-based mutation or mutex nesting.
- Added node:sqlite coverage for canonical Quick Log rows, receipt undo, recency, lifecycle events, atomic rollback, cadence guards, and empty batches.

## Task Commits

1. **Task 1: Extract transaction cores** — `6ab0b5b` (test), `0b7b866` (feat)
2. **Task 2: Implement bulk composers** — `39deed8` (test), `e947cd7` (feat)
3. **Task 3: Cover bulk-action behavior** — `31df11b` (test)

## Files Created/Modified

- `src/db/bulk-actions-dao.ts` — Atomic bulk write composers and Quick Log batch receipt type.
- `src/db/bulk-actions-dao.test.ts` — Node:sqlite behavior and rollback coverage.
- `src/db/contacts-dao.ts` — Archive plus category/frequency composition cores.
- `src/db/favourites-dao.ts`, `src/db/snooze-dao.ts`, `src/db/recency-dao.ts` — Extracted non-mutexed primitives.
- `src/db/events-dao.ts` — Corrected stale snooze/unsnooze producer documentation.

## Decisions Made

- Bulk Quick Log uses the canonical manual interaction shape with `direction: "outbound"`; it cannot rely on the recency core's nullable-direction default.
- Empty selections short-circuit without opening a transaction or changing data revision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mocked the native SQLite module in the new node test harness**
- **Found during:** Task 2
- **Issue:** Importing the bulk DAO transitively loaded React Native through the native SQLite module, which Vitest's Node transform cannot parse.
- **Fix:** Added the same `expo-sqlite` module mock used by the existing contacts DAO node suite.
- **Files modified:** `src/db/bulk-actions-dao.test.ts`
- **Verification:** `npm test -- src/db/bulk-actions-dao.test.ts` passes.
- **Committed in:** `e947cd7`

**Total deviations:** 1 auto-fixed (1 blocking)

## Verification

- `npx tsc --noEmit` passed.
- `npm test` passed: 246 files and 2,311 tests.
- Source scan confirmed one `inWriteTransaction` and one `bumpDataRevisionCore` call per bulk composer; stale no-producer event comments are absent.

## Known Stubs

None.

## Next Phase Readiness

Card-view selection UI can call the bulk DAO without bypassing recency or lifecycle-event invariants. The receipt returned by `bulkQuickLog` is ready for a UI-level Undo action.

## Self-Check: PASSED

*Phase: 28-dashboard-card-view*
*Completed: 2026-09-06*
