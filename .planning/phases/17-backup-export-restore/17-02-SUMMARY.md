---
phase: 17-backup-export-restore
plan: 02
subsystem: database
tags: [sqlite, migrations, tombstones, data-revision, purge]
requires:
  - phase: 16-custom-field-value-normalization
    provides: Stable normalized custom-field-value rows and the migration-006 schema.
provides:
  - Migration 007 tombstone storage and fixed singleton seed identities.
  - Transactional data-revision increments for every tombstone insertion.
  - Tombstone-aware archived-contact purge with merge-safe sun updates.
affects: [17-03, 17-04, 17-06, 17-08, backup-restore]
actuals:
  tokens: 6887
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns: [non-mutexed tombstone core, caller-supplied delete clocks, exported migration registry]
key-files:
  created: [src/db/migrations/007-tombstones.ts, src/db/tombstones-dao.ts, src/db/data-revision-dao.ts, src/db/migrations/full-chain.test.ts]
  modified: [src/db/database.ts, src/db/purge-dao.ts, src/screens/ArchivedContactsScreen.tsx]
key-decisions:
  - "D-01 remained approved: retain generic tombstones indefinitely in migration 007."
  - "Profile and seeded category UIDs converge to permanent reserved values on every installation."
  - "Purge timestamps are supplied by callers, never synthesized inside the DAO."
patterns-established:
  - "Tombstone writers compose insertTombstoneCore inside their existing outer transaction."
  - "Database bootstrap and migration-chain tests consume one exported MIGRATIONS registry."
requirements-completed: [BKP-04]
coverage:
  - id: D1
    description: "Migration 007 supplies unique, durable deletion evidence and stable reserved singleton identities."
    requirement: BKP-04
    verification:
      - kind: integration
        ref: "src/db/migrations/007-tombstones.test.ts and src/db/migrations/full-chain.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Archived-contact purge captures all mergeable fan-out tombstones and preserves merge-safe sun settings."
    requirement: BKP-04
    verification:
      - kind: integration
        ref: "src/db/purge-dao.test.ts"
        status: pass
    human_judgment: false
duration: 6m 20s
completed: 2026-08-25
status: complete
---

# Phase 17 Plan 02: Tombstone Migration and Contact Purge Summary

**Migration 007 establishes permanent deletion evidence, monotonic backup-change revisions, and transactional contact-purge tombstones.**

## Performance

- **Duration:** 6m 20s
- **Started:** 2026-08-25T21:11:40Z
- **Completed:** 2026-08-25T21:18:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Recorded the owner-approved D-01 migration scope and added migration 007 with unique indefinite tombstones, `data_revision`, and reserved profile/category UIDs.
- Exported one `MIGRATIONS` registry used by both app bootstrap and the fresh-database full-chain regression.
- Made archived purge capture every mergeable child UID before deletion, increment revision atomically, and explicitly clear a purged sun contact with the caller's timestamp.

## Task Commits

1. **Task 1: Record D-01 as the already-approved migration decision** — recorded against the existing owner approval; no code commit required.
2. **Task 2: Add and prove migration 007 tombstone storage and the data-revision counter** — `522d1fe` (test), `78a72eb` (feat).
3. **Task 3: Make archived-contact purge record all fan-out tombstones, keep the sun reference merge-safe, and thread a real clock into the modified_at bump** — `398e9a0` (test), `a33e819` (feat).

## Files Created/Modified

- `src/db/migrations/007-tombstones.ts` — forward-only tombstone schema, revision column, and reserved UIDs.
- `src/db/tombstones-dao.ts` — typed runtime-guarded insertion/query cores.
- `src/db/data-revision-dao.ts` — transaction-safe revision increment and reader.
- `src/db/database.ts` — exported authoritative migration registry and target version 7.
- `src/db/purge-dao.ts` — capture-before-delete evidence and explicit sun-reference update.
- `src/screens/ArchivedContactsScreen.tsx` — passes the local wall-clock timestamp to purge.
- `src/db/migrations/full-chain.test.ts` — validates the registered chain from a fresh database.

## Decisions Made

- D-01 remains approved as recorded: deletion evidence is permanent and unique per entity type/UID.
- Profile and the four seeded categories use fixed reserved UIDs, allowing ordinary UID reconciliation across installations.
- `PurgeOptions.now` is required, preventing a DAO-internal or omitted clock for merge-visible settings writes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Updated the migration-006 lifecycle regression for the required migration-007 purge dependency.**
- **Found during:** Task 3
- **Issue:** Its retained `purgeContact` integration call exercised a v6 fixture, where tombstone storage does not yet exist.
- **Fix:** Advance that one lifecycle scenario to migration 007 before exercising purge and supply its explicit clock.
- **Files modified:** `src/db/migrations/006-normalize-custom-field-values.test.ts`
- **Verification:** Focused migration and purge tests, full test suite, and TypeScript compilation passed.
- **Committed in:** `a33e819`

**Total deviations:** 1 auto-fixed (Rule 3).
**Impact on plan:** Required compatibility maintenance only; no scope expansion.

## Verification

- `npm test` — 107 files / 1354 tests passed.
- `npm run check:colors` — passed.
- `npx tsc --noEmit` — passed.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 17-03 and 17-04 can compose the tombstone core in their existing deletion transactions. Plans 17-06 and 17-08 can consume the monotonic `data_revision` reader and the registered migration chain.

## Self-Check: PASSED

- Migration, tombstone DAO, data-revision DAO, and full-chain test files exist.
- Task commits `522d1fe`, `78a72eb`, `398e9a0`, and `a33e819` exist.

---
*Phase: 17-backup-export-restore*
*Completed: 2026-08-25*
