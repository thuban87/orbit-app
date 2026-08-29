---
phase: 19-system-contact-import
plan: 16
subsystem: import photo lifecycle
tags: [import, sqlite, photo-storage, privacy, staging, vitest]
requires:
  - phase: 19-system-contact-import
    provides: durable import sessions, staged photo paths, and post-commit master-photo persistence
provides:
  - Durable retirement of successful import rows' staged-photo references
  - Post-success raw staging deletion while preserving retryable photo inputs
  - Resume-sweep liveness restricted to unresolved import rows
affects:
  - import retry
  - launch resume sweep
  - Phase 19-17 device UAT
tech_stack:
  added: []
  patterns:
    - Retire the durable staging reference before best-effort raw file cleanup
    - Keep staging live only for pending, needs_review, and failed import rows
key_files:
  created: []
  modified:
    - src/db/import-session-dao.ts
    - src/services/import/import-photo.ts
    - src/services/import/contact-import-resume-sweep.ts
decisions:
  - Successful photo cleanup runs only after the master is persisted and contacts.photo is durably set.
  - Retiring a staging reference is a separate mutexed write; file cleanup remains post-commit and best-effort.
  - pending, needs_review, and failed are the sole statuses that retain import photo staging for resume or Retry.
metrics:
  duration: 5m
  completed: 2026-08-29
  tasks: 3
  files: 10
status: complete
actuals:
  tokens: 4397
  tasks: 3
  commits: 4
requirements-completed: [IMP-04]
coverage:
  - id: D1
    description: A mutexed DAO writer clears only the successful row's staged-photo reference.
    requirement: IMP-04
    verification:
      - kind: unit
        ref: src/db/import-session-dao.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Successful master persistence retires and deletes raw staging, while failures preserve it for Retry.
    requirement: IMP-04
    verification:
      - kind: unit
        ref: src/services/import/import-photo.test.ts
        status: pass
    human_judgment: true
    rationale: App-private staging-file behavior is scheduled for Phase 19-17 device inspection.
  - id: D3
    description: The launch sweep retains only retryable row staging and reconciles completed or skipped staging.
    requirement: IMP-04
    verification:
      - kind: unit
        ref: src/services/import/contact-import-resume-sweep.test.ts
        status: pass
    human_judgment: true
    rationale: Relaunch behavior is scheduled for Phase 19-17 device verification.
---

# Phase 19 Plan 16: Import Photo Staging Privacy Summary

Successful system-contact photo imports now retire their database staging reference and remove the raw source file, while retryable rows preserve their staged input and the resume sweep clears resolved leftovers.

## Tasks Completed

1. **Durable staging-reference retirement writer** — Added mutexed `retireRowStagedPhoto` and core writer, with a transition-table entry and node coverage proving only `photo_rel_path` and `modified_at` change.
2. **Retire and delete after successful master persistence** — Threaded import row IDs through bulk, single, and consolidation photo flows. Success retires the row reference then performs best-effort staged-file deletion; missing or failed photos retain their retry input.
3. **Status-aware resume-sweep liveness** — Limited live staged paths to `pending`, `needs_review`, and `failed` rows, reconciling imported, linked, and skipped staging on launch.

## Verification

- `npx vitest run src/db/import-session-dao.test.ts src/services/import/import-photo.test.ts src/services/import/contact-import-resume-sweep.test.ts` — passed (20 tests).
- `npx vitest run src/services/import/source-consolidation.test.ts` — passed (5 tests).
- `npx tsc --noEmit --pretty false` — passed.
- `git diff --check` — passed.
- Device staging inspection remains assigned to Phase 19-17.

## TDD Gate Compliance

- RED behavior was exercised for all three tasks before implementation.
- The RED checks were not committed as separate `test(...)` commits; task commits contain their completed test and implementation changes. This is recorded for audit.

## Decisions Made

- The DB reference is retired after `setContactPhoto` succeeds, so any resize, master-persistence, or contact-photo failure keeps retryable input durable.
- Raw staging deletion is best-effort after the durable retirement; a filesystem cleanup error does not make the imported contact fail.
- Only unresolved or retryable row statuses protect staging during launch reconciliation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the consolidation photo filesystem fixture**
- **Found during:** Task 2
- **Issue:** Expanding `ImportedPhotoFs` made the existing typed `source-consolidation` test fixture incomplete, blocking TypeScript verification.
- **Fix:** Added the no-op injected `deleteImportStaging` implementation to that fixture.
- **Files modified:** `src/services/import/source-consolidation.test.ts`
- **Verification:** `npx vitest run src/services/import/source-consolidation.test.ts` and `npx tsc --noEmit --pretty false` passed.
- **Committed in:** `b9846c7`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required type-fixture maintenance only; no scope expansion or behavior change.

## Known Stubs

None.

## Next Phase Readiness

- IMP-04's raw-photo retention gap is covered by node tests and ready for the Phase 19-17 device UAT: successful imports should remove the staged file, while deliberate photo failures retain it for Retry.
- No migrations, packages, endpoints, or new trust boundaries were introduced.

## Self-Check: PASSED

All ten modified files exist, and task commits `c3f1502`, `b9846c7`, `ee37487`, and `d22115e` are present in Git history.

---
*Phase: 19-system-contact-import*
*Completed: 2026-08-29*
