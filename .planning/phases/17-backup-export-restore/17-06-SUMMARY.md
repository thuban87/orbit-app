---
phase: 17-backup-export-restore
plan: "06"
subsystem: backup
tags: [backup, saf, data-revision, foreground-sweep, vitest]
requires:
  - phase: 17-05
    provides: validated portable manifest construction
  - phase: 17-12
    provides: local-only automatic backup bookkeeping core
provides:
  - Monotonic export-data revision tracking at outer write boundaries
  - Foreground-triggered, SAF read-back-verified automatic snapshots
affects: [17-07 encryption, 17-09 backup-health-ui]
actuals:
  tokens: 11200
  tasks: 3
  commits: 5
key-files:
  created: [src/backup/auto-backup-policy.ts, src/services/backup/saf-storage.ts, src/services/backup-sweep.ts, src/db/profile-dao.test.ts]
  modified: [src/db/data-revision-dao.ts, src/services/backup/backup-service.ts, App.tsx]
key-decisions:
  - "Only transaction-owning public writers advance data_revision; reusable SQL cores remain non-bumping."
  - "Automatic health is written only after SAF write/read-back verification through the local-only bookkeeping core."
status: complete
---

# Phase 17 Plan 06: Foreground automatic backup summary

Orbit now uses a monotonic data revision to detect exportable changes and starts verified SAF automatic backups only through the post-migration foreground launch sweep.

## Accomplishments

- Added one-per-logical-operation revision bumps to exportable write owners while preserving leaf-core composition and accepted no-op reorders.
- Added revision, fan-out, archive/restore, rollback, mixed-link-diff, and profile-photo regression coverage.
- Added strict automatic filenames, revision-based due policy, SAF write/read-back verification, single-flight service behavior, and foreground health bookkeeping.
- Prunes only strict owned expired SAF snapshots after a successful verified write, while protecting the newly written file if device time rolled back.

## Task Commits

1. `f95e570` — data-revision writer tracking
2. `beb1366` — automatic snapshot policy and SAF adapter
3. `c27a110` — foreground launch registration and truthful health persistence
4. `42d7feb` — legacy isolated DAO-fixture compatibility
5. `9f15dcb` — verified snapshot retention hardening

## Verification

- `npm test -- --run` — 114 files, 1392 tests passed
- `npx tsc --noEmit` — passed
- `npm run check:colors` — passed

## Deviations from Plan

### Auto-fixed Issues

1. [Rule 1 - Bug] Existing isolated DAO tests created pre-v7 schemas.
- **Fix:** The revision core tolerates only missing legacy `app_settings`/`data_revision` schema errors in those fixtures; migrated app writes still require the counter row.
- **Commit:** `42d7feb`

## Self-Check: PASSED

- All implementation and test files exist.
- All four commits are present in Git history.
