---
phase: 17-backup-export-restore
plan: "05"
subsystem: backup
tags: [backup, export, sharing, sqlite, vitest]
requires:
  - phase: 17-03
    provides: interaction, fuel, and link tombstone coverage
  - phase: 17-04
    provides: reconciliation policy and custom-field tombstones
  - phase: 17-12
    provides: portable settings snapshot excluding local backup bookkeeping
provides:
  - Versioned, validated plaintext backup manifest read inside one mutex-held SQLite snapshot
  - Verified manual JSON export through the native share sheet without automatic-backup health effects
affects: [17-06 automatic backup, 17-07 encryption, 17-08 restore, 17-09 backup landing]
actuals:
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [read-back parse before sharing, injected file/share adapters, reentrancy guard]
key-files:
  created: [src/backup/types.ts, src/backup/backup-schema.ts, src/backup/export-manifest.ts, src/services/backup/backup-service.ts, src/services/backup/share-export.ts]
  modified: [src/db/transaction.ts, src/db/app-settings-dao.ts]
key-decisions:
  - "backupFormatVersion is independent of SQLite user_version; only a newer backup wire format is update-first rejected."
  - "Manual sharing never reads or updates automatic-backup health, folder, rotation, or success metadata."
patterns-established:
  - "Build every multi-table export through inReadSnapshot and consume only its ReadOnlyExecutor."
  - "Write a local export, parse its read-back bytes, then open the platform share sheet."
requirements-completed: [BKP-01]
coverage:
  - id: D1
    description: A complete non-secret UID-based manifest validates independently of SQLite schema version, with tombstones and embedded photo bytes.
    requirement: BKP-01
    verification:
      - kind: unit
        ref: npm test -- src/db/transaction.test.ts src/backup/backup-schema.test.ts src/backup/export-manifest.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: false
  - id: D2
    description: Manual export writes and validates a local JSON file before the native share sheet, returning safe outcomes for unavailable, failed, and overlapping shares.
    requirement: BKP-01
    verification:
      - kind: unit
        ref: npm test -- src/services/backup/backup-service.test.ts
        status: pass
      - kind: other
        ref: npm run check:colors
        status: pass
    human_judgment: false
completed: 2026-08-25
status: complete
---

# Phase 17 Plan 05: Validated plaintext export and manual sharing summary

**Orbit can now create one portable, verified JSON backup and hand it to Android's share sheet without treating that action as automatic protection.**

## Accomplishments

- Added an independent, forward-migrating backup wire-format parser and a full export manifest that uses stable UIDs, exports photo bytes, captures tombstones, and rejects missing photos rather than silently emitting partial data.
- Added `inReadSnapshot`, sharing the app's non-reentrant write mutex so all export reads see one coherent database snapshot while the callback receives a structurally read-only executor.
- Added a node-testable manual export service and native Expo file/share adapters. The service writes JSON, reads and parses it back before sharing, returns non-sensitive recoverable outcomes, and rejects overlapping requests.
- Preserved the portable/local settings split: manual exports neither read nor update SAF, encryption, health, rotation, or automatic-success metadata.

## Task Commits

1. **Task 1: Export one complete plaintext manifest inside a real read snapshot and validate it back** — `73105bc` (feat)
2. **Task 2: Create and share a verified manual export without affecting health** — `3321a78` (feat)

## Files Created/Modified

- `src/db/transaction.ts` and `src/db/transaction.test.ts` — mutex-held read snapshots and ordering coverage.
- `src/backup/types.ts`, `src/backup/backup-schema.ts`, and their tests — backup wire versions, validation, and forward-migration boundary.
- `src/backup/export-manifest.ts` and tests — deterministic UID-based full-state manifest construction with photo-byte reads and exclusion assertions.
- `src/services/backup/backup-service.ts` and test — verified manual export orchestration, share result mapping, and reentrancy protection.
- `src/services/backup/share-export.ts` — Expo file-system/photo/share adapters isolated from node-tested orchestration.

## Decisions Made

- SQLite `user_version` remains diagnostic metadata only; it never determines backup compatibility.
- A manual share is intentionally not a backup-health event, even after its file is read back and validated.

## Deviations from Plan

None.

## Issues Encountered

The prior executor was interrupted mid-Task 2 by its account limit. Its three untracked files were inspected and completed in place; no partial work was discarded.

## User Setup Required

None. Device validation is deferred to the Phase 17 Pixel UAT plan.

## Next Phase Readiness

Plan 17-06 can reuse the manifest and post-write parse-verification boundary for automatic SAF snapshots while keeping its success bookkeeping separate from this manual-share path.

## Self-Check: PASSED

- Task commits `73105bc` and `3321a78` exist in Git history.
- `npm test -- src/services/backup/backup-service.test.ts`, `npx tsc --noEmit`, `npm run check:colors`, and Biome checks for the three Task 2 files pass.
