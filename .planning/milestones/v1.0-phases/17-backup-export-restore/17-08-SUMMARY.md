---
phase: 17-backup-export-restore
plan: 08
subsystem: backup-restore
tags: [restore, reconciliation, sqlite, photos, launch-sweep]
requires:
  - phase: 17-04
    provides: UID reconciliation actions, survivor sets, and incompatibility detection
  - phase: 17-07
    provides: verified automatic snapshot writer and encrypted backup format
provides:
  - validated aggregate restore preview and single-transaction Merge/Replace apply
  - durable restore-photo journal with committed-only launch recovery
  - forced configured-destination safety snapshot and non-blocking schedule resync reporting
affects: [17-09, restore-ui, backup-settings, future-sync]
actuals:
  tokens: 19250
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns:
    - stage durable filesystem inputs before DB BEGIN; authorize completion with rows committed in that transaction
    - injectable restore side effects expose non-blocking recovery instead of rolling back committed state
key-files:
  created:
    - src/db/migrations/008-restore-photo-journal.ts
    - src/db/restore-photo-journal-dao.ts
    - src/services/photos/restore-photo-finalize-sweep.ts
  modified:
    - src/backup/restore-apply.ts
    - src/services/photos/photo-storage.ts
    - App.tsx
key-decisions:
  - "Restore-pending files are finalized only after a matching committed journal row and a typed live-target check."
  - "Configured Replace-all fails closed until an injected verified pre-restore snapshot succeeds."
  - "Photo and schedule post-commit failures are counted/reported for launch-sweep recovery, not treated as a rolled-back restore."
patterns-established:
  - "Use target UID identity, never a staging filename, to validate recovery work."
  - "Verify actual canonical-file absence after best-effort deletion before removing its journal row."
requirements-completed: [BKP-04]
coverage:
  - id: D1
    description: "Validated backup preview and reconciliation-driven transactional restore"
    requirement: BKP-04
    verification:
      - kind: integration
        ref: "src/backup/restore-apply.test.ts"
        status: pass
      - kind: other
        ref: "npm test (1431 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Committed-only restore-photo staging, finalize/delete recovery, and launch sweep"
    requirement: BKP-04
    verification:
      - kind: unit
        ref: "src/services/photos/restore-photo-finalize-sweep.test.ts"
        status: pass
      - kind: unit
        ref: "src/services/photos/photo-storage.test.ts"
        status: pass
    human_judgment: false
status: complete
---

# Phase 17 Plan 08: Validated Restore Apply Summary

**Validated preview plus one-transaction UID reconciliation, committed-only photo recovery, and forced safety snapshots for Replace-all**

## Performance

- **Duration:** 2h 4m
- **Started:** 2026-08-25T19:14:29-05:00
- **Completed:** 2026-08-25T21:18:02-05:00
- **Tasks:** 3/3
- **Files modified:** 20

## Accomplishments

- Added a content-redacted, write-free encrypted/plaintext preview boundary with whole-file graph, settings, category, parent, and photo-byte validation.
- Applied reconciliation actions through one outer transaction, including tombstones, FK-safe Replace-all reset, UID parent/category/settings mapping, durable normalized clears, recency preservation, and a single data-revision bump.
- Made restore photos crash-recoverable: decode into a guarded durable namespace before DB writes, commit typed finalize/delete journal rows, then finalize or clean up individually after commit.
- Registered launch recovery for only committed journal work, garbage-collecting unjournaled staging files and verifying file absence before considering canonical deletion complete.
- Blocked configured Replace-all unless a forced verified safety snapshot succeeds; schedule rebuild failures now return a committed-with-resync-pending result for existing foreground reconcilers.

## Task Commits

1. **Task 1: Validated aggregate restore preview** — `d8d0472` (RED), `95d294d` (GREEN)
2. **Task 2: Transactional Merge/Replace apply and durable journal** — `3f29f60`, `995885b`, `c932e93`
3. **Task 3: Launch-sweep journal recovery** — `c3887d1`

## Files Created/Modified

- `src/backup/restore-apply.ts` — reconciliation plan, transactional apply, staged-photo journal entries, post-commit drains, snapshot/resync dependencies.
- `src/services/photos/photo-storage.ts` — base64-to-durable pending staging with stage-temp then rename.
- `src/services/photos/restore-photo-finalize-sweep.ts` — typed liveness-aware committed journal drain.
- `src/db/migrations/008-restore-photo-journal.ts` and `src/db/restore-photo-journal-dao.ts` — durable recovery evidence.
- `App.tsx` — ready-gated foreground registration for restore-photo recovery.

## Decisions Made

- The snapshot dependency is explicit at the restore boundary; a configured destination without a successful writer is a blocking safety failure.
- Canonical photo references are written in the same transaction as their journal rows; filesystem completion is independently retryable afterward.
- A custom-field photo recovery entry requires value, contact, and definition UID identity to still resolve to a live photo definition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Completed missing durable photo-apply boundary**

- **Found during:** Task 2
- **Issue:** The initial apply transaction neither action-gated/staged photo bytes nor committed journal rows, so recovery could not prove that photo work belonged to a successful restore.
- **Fix:** Added pre-BEGIN durable staging, in-transaction typed finalize/delete journal writes, canonical-reference writes, and individually reported post-commit drains.
- **Files modified:** `src/backup/restore-apply.ts`, `src/services/photos/photo-storage.ts`
- **Verification:** restore/photo focused tests, full Vitest suite, TypeScript.
- **Committed in:** `c932e93`

**2. [Rule 1 - Bug] Strengthened custom-photo sweep liveness identity**

- **Found during:** Task 3 completion audit
- **Issue:** A custom photo journal entry did not require its field-definition UID to match the live `photo` definition.
- **Fix:** Require contact, value, and field-definition UID identity before finalization.
- **Files modified:** `src/services/photos/restore-photo-finalize-sweep.ts`
- **Verification:** `src/services/photos/restore-photo-finalize-sweep.test.ts`.
- **Committed in:** `c932e93`

**Total deviations:** 2 auto-fixed (Rule 1)

## Issues Encountered

None. The Vitest run emits existing Vite native-config and Node SQLite experimental warnings only.

## Known Stubs

None.

## Self-Check: PASSED

- All restore, journal, staging, and launch-sweep files exist.
- Task commits `95d294d`, `3f29f60`, `c3887d1`, `995885b`, and `c932e93` exist.
- `npm test` passed: 121 files / 1431 tests; `npx tsc --noEmit` and `git diff --check` passed.

## Next Phase Readiness

Plan 17-09 can bind the preview/apply result surface to the restore UI. Replace-all callers must construct and pass `createVerifiedPreRestoreSnapshot` from the configured automatic-backup dependencies.
