---
phase: 17-backup-export-restore
plan: 03
subsystem: database
tags: [sqlite, tombstones, transactions, backup, merge-safety]
requires:
  - phase: 17-02
    provides: durable tombstone table and insertion core
provides:
  - Interaction, fuel, and contact-link hard deletes retain durable merge evidence.
  - Edit-form link-diff removals write tombstones inside their existing transaction.
affects: [backup, export, restore, reconciliation]
actuals:
  tokens: 4555
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - Capture a target UID before a mergeable hard delete, then insert a tombstone in the caller-owned transaction.
    - Pass caller-supplied local wall-clock timestamps through deletion cores and wrappers.
key-files:
  created: []
  modified:
    - src/db/recency-dao.ts
    - src/db/fuel-dao.ts
    - src/db/contact-links-dao.ts
    - src/screens/ContactProfileScreen.tsx
key-decisions:
  - "Missing target rows throw before tombstone insertion, preserving the existing exact-change rollback contract."
  - "applyLinkDiff passes its existing local now timestamp to each compositional link removal."
patterns-established:
  - "Hard-delete evidence: select UID → insert tombstone core → delete → assert one change, all in one outer transaction."
requirements-completed: [BKP-04]
coverage:
  - id: D1
    description: Interaction deletes retain one UID-correct tombstone while preserving recency and rejection rollback.
    requirement: BKP-04
    verification:
      - kind: unit
        ref: npm test -- src/db/recency-dao.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Fuel and contact-link deletes, including applyLinkDiff removals, retain type-correct tombstones in one transaction.
    requirement: BKP-04
    verification:
      - kind: unit
        ref: npm test -- src/db/fuel-dao.test.ts src/db/contact-links-dao.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: false
duration: 4min
completed: 2026-08-25
status: complete
---

# Phase 17 Plan 03: Child Delete Tombstones Summary

**Interaction, fuel, and contact-link hard deletes now retain UID-correct tombstones atomically, including edit-form link removals.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-25T21:20:15Z
- **Completed:** 2026-08-25T21:24:12Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added an interaction target-read and tombstone insertion before its existing delete and recency recompute.
- Made fuel and link delete cores tombstone-aware using caller-supplied local timestamps.
- Threaded the existing edit-form timestamp through `applyLinkDiff` removals and updated the direct fuel UI caller.
- Added RED/GREEN unit coverage for successful deletion, rejected targets, rollback, and one-transaction ownership.

## Task Commits

1. **Task 1: Make one direct touchpoint deletion merge-safe**
   - `a130d09` — `test(17-03): add failing interaction tombstone coverage`
   - `534ee93` — `feat(17-03): tombstone deleted interactions`
2. **Task 2: Cover fuel and link hard-delete wrappers, including the applyLinkDiff compositional path and their production call sites**
   - `e191826` — `test(17-03): add failing fuel and link tombstone coverage`
   - `267cb94` — `feat(17-03): tombstone fuel and link deletes`

## Files Created/Modified

- `src/db/recency-dao.ts` — captures interaction UID and writes its tombstone before deletion.
- `src/db/recency-dao.test.ts` — proves interaction tombstone and rollback behavior.
- `src/db/fuel-dao.ts` — threads `now` through hard delete and records fuel evidence.
- `src/db/fuel-dao.test.ts` — proves fuel deletion evidence and failed-delete behavior.
- `src/db/contact-links-dao.ts` — makes standalone and diff-based link removals tombstone-aware.
- `src/db/contact-links-dao.test.ts` — proves standalone and compositional link deletion paths.
- `src/screens/ContactProfileScreen.tsx` — supplies local wall-clock time to the widened fuel deletion API.

## Decisions Made

- Tombstones are inserted only after the matching row’s UID is found, so a mismatched or missing pair cannot create false deletion evidence.
- The compositional `applyLinkDiff` path reuses its already-captured `now` value; it does not create a nested transaction or a second clock source.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`state.advance-plan` could not parse the repository's existing unscoped `STATE.md` format, so it did not advance a plan counter. The normal tracking commands still recorded the session, metrics, decisions, and ROADMAP plan count. `BKP-04` had already been marked complete by Plan 17-02, so this plan did not alter requirements traceability.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All currently discovered child hard-delete writers have atomic anti-resurrection evidence for backup reconciliation.

## Self-Check: PASSED

---
*Phase: 17-backup-export-restore*
*Completed: 2026-08-25*
