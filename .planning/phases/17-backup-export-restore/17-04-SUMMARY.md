---
phase: 17-backup-export-restore
plan: "04"
subsystem: database
tags: [backup, reconciliation, tombstones, sqlite, vitest]
requires:
  - phase: 17-02
    provides: migration 007 tombstone storage and fixed profile/category UIDs
provides:
  - Tombstones for permanent custom-field definition and normalized-value deletion
  - Pure UID reconciliation, parent-survival, and collision-rejection policy
affects: [17-08 restore apply, future sync apply, backup validation]
actuals:
  tokens: 6656
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns: ["UID-first pure reconciliation", "separate live/tombstone uniqueness domains"]
key-files:
  created: [src/backup/types.ts, src/backup/reconciliation.ts, src/backup/reconciliation.test.ts]
  modified: [src/db/field-ddl.ts, src/db/field-ddl.test.ts]
key-decisions:
  - "Tombstones are captured before custom-field deletes and roll back with a stale delete failure."
  - "Pair-key and col_name collisions reject the whole restore instead of alias-merging stable UIDs."
patterns-established:
  - "Call reconcileEntity parent-first and pass each parent result's survivors to dependent child calls."
  - "Use sameFileSurvivorUids for backup-file-only structural validation."
requirements-completed: [BKP-01, BKP-04]
coverage:
  - id: D1
    description: Permanent custom-field definition deletion creates durable definition and value tombstones while quarantine remains non-destructive.
    requirement: BKP-01
    verification:
      - kind: unit
        ref: npm test -- src/db/field-ddl.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: UID reconciliation provides deterministic LWW/tombstone, parent-survival, and incompatibility outcomes for restore callers.
    requirement: BKP-04
    verification:
      - kind: unit
        ref: npm test -- src/backup/reconciliation.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-08-25
status: complete
---

# Phase 17 Plan 04: Custom-field tombstones and reconciliation summary

**Permanent normalized-field deletion now leaves durable evidence, and a pure UID policy makes later Merge decisions deterministic and safe.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-25T21:27:07Z
- **Completed:** 2026-08-25T21:32:40Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Captured custom-field-definition and normalized-value UIDs before permanent removal, while preserving transient `field_history` behavior and rollback safety.
- Added a shared LWW/tombstone survivor primitive with deletion-winning equal-second ties and independent live/tombstone uniqueness domains.
- Added full entity policies, mandatory-parent blocking, nullable reference fallback, and whole-restore collision reporting for value pairs and definition column names.

## Task Commits

1. **Task 1: Preserve field-definition and value deletion evidence** — `c85a160` (feat)
2. **Task 2: Define and test caller-supplied reconciliation policy** — `2f495d4` (test), `023e2e1` (feat)

## Files Created/Modified

- `src/db/field-ddl.ts` — inserts definition/value tombstones in the permanent deletion transaction and asserts one definition deletion.
- `src/db/field-ddl.test.ts` — proves permanent, quarantine, and stale-delete tombstone behavior.
- `src/backup/types.ts` — defines UID-keyed backup wire records.
- `src/backup/reconciliation.ts` — exposes reconciliation policies, survivor helpers, action plan, parent blocking, and incompatibility checks.
- `src/backup/reconciliation.test.ts` — covers timestamp, parent, seed-identity, explicit-clear, and collision cases.

## Decisions Made

- `contacts.last_contact` is removed from reconciliation scalar actions because recency remains derived by its existing DAO.
- Non-empty incompatibilities are an all-or-nothing restore rejection signal; the caller must not apply partial actions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service or device setup is required for this plan.

## Next Phase Readiness

Plan 17-08 can reuse `sameFileSurvivorUids` during pre-write validation and call `reconcileEntity` in parent-first dependency order before applying a Merge.

## Self-Check: PASSED

- All five implementation/test files and the summary exist.
- Task commits `c85a160`, `2f495d4`, and `023e2e1` exist in Git history.
