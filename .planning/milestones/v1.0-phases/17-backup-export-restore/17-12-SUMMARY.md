---
phase: 17-backup-export-restore
plan: "12"
subsystem: database
tags: [backup, sqlite, settings, restore, vitest]
requires:
  - phase: 17-02
    provides: migration 007 data_revision counter
provides:
  - Durable non-secret automatic-backup settings and local health metadata
  - Disjoint portable settings projection and local-only bookkeeping core
  - Transaction-composable settings update core for restore
affects: [17-05 export manifest, 17-06 automatic backup, 17-08 restore apply, 17-09 backup settings]
actuals:
  tokens: 7967
  tasks: 2
  commits: 6
tech-stack:
  added: []
  patterns: [explicit portable SQL projection, structurally disjoint bookkeeping patch, non-mutexed DAO cores]
key-files:
  created: []
  modified: [src/db/migrations/007-tombstones.ts, src/db/migrations/007-tombstones.test.ts, src/db/app-settings-dao.ts, src/db/app-settings-dao.test.ts]
key-decisions:
  - "Automatic backup freshness stores the monotonic data_revision snapshot, never a timestamp."
  - "SAF, encryption, nudge, and health metadata stay device-local and cannot enter the portable settings type."
  - "Backup bookkeeping does not alter data_revision or modified_at."
patterns-established:
  - "Use getPortableSettingsSnapshot for any export path; never project getAppSettings wholesale."
  - "Call updateAppSettingsCore and recordAutomaticBackupHealthCore only inside an already-open write transaction."
requirements-completed: [BKP-01, BKP-02, BKP-04]
coverage:
  - id: D1
    description: Migration 007 creates non-secret automatic-backup defaults and durable local diagnostic state without secret columns.
    requirement: BKP-02
    verification:
      - kind: unit
        ref: npm test -- src/db/migrations/007-tombstones.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: false
  - id: D2
    description: Portable settings export excludes all device-local bookkeeping while validated cores support atomic restore and automatic-health writes.
    requirement: BKP-01
    verification:
      - kind: unit
        ref: npm test -- src/db/app-settings-dao.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-08-25
status: complete
---

# Phase 17 Plan 12: Backup settings persistence and DAO seams summary

**Migration 007 and the settings DAO now preserve safe automatic-backup state while strictly separating portable preferences from device-local backup bookkeeping.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-25T21:35:09Z
- **Completed:** 2026-08-25T21:41:23Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Added durable cadence, retention, SAF destination/access diagnostics, verified-success revision, encryption flag, and nudge state to migration 007 without introducing any secret SQLite column.
- Added an explicit `PortableSettingsSnapshot` projection containing all portable notification, orrery, AI configuration, and backup-day settings while excluding all local backup mechanism fields at runtime and compile time.
- Factored transaction-composable settings and backup-health cores; the endpoint acknowledgement reset remains identical in both settings paths and bookkeeping cannot self-inflate `data_revision`.

## Task Commits

1. **Task 1: Persist one safe automatic-backup settings path in migration 007** — `e6c0c87` (test), `40c9415` (feat), `5e2bbda` (test), `cd24a89` (fix)
2. **Task 2: Split the settings snapshot into two disjoint allowlists — a portable wire projection and a local-only bookkeeping core** — `c206713` (test), `13a4451` (feat)

## Files Created/Modified

- `src/db/migrations/007-tombstones.ts` — adds non-secret backup settings, local health metadata, and folder access status.
- `src/db/migrations/007-tombstones.test.ts` — verifies v6 upgrades receive safe defaults and no secret-shaped settings column.
- `src/db/app-settings-dao.ts` — adds the explicit portable projection, day validator, non-mutexed settings core, and disjoint bookkeeping core.
- `src/db/app-settings-dao.test.ts` — proves projection exclusions, type disjointness, validation, endpoint-reset parity, and no bookkeeping revision bump.

## Decisions Made

- `last_backup_data_revision` snapshots the monotonic counter, so same-second edits remain eligible for automatic backup.
- `modified_at` changes only with portable settings updates; local backup-health writes cannot affect restore LWW decisions.
- A saved SAF URI is retained with diagnostic/access state when access fails, rather than being cleared.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Persisted explicit SAF folder access state.**
- **Found during:** Task 2
- **Issue:** URI/name/diagnostic data alone could not represent the access-probe result required by automatic backup health.
- **Fix:** Added `backup_folder_accessible` with a safe default and restricted it to the local bookkeeping type/core.
- **Files modified:** `src/db/migrations/007-tombstones.ts`, `src/db/migrations/007-tombstones.test.ts`, `src/db/app-settings-dao.ts`, `src/db/app-settings-dao.test.ts`
- **Verification:** Focused migration/DAO suites and TypeScript compilation pass.
- **Committed in:** `5e2bbda`, `cd24a89`, `13a4451`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Required local health state only; it remains structurally excluded from portable export and restore.

## Issues Encountered

`state.advance-plan` could not parse this repository's legacy unscoped Current Plan/Total Plans format. The remaining state/session, roadmap progress, metric, and decision updates completed normally.

## User Setup Required

None - no external service or device setup is required for this plan.

## Next Phase Readiness

Plan 17-05 can consume only `getPortableSettingsSnapshot`; Plan 17-06 can record automatic health through `recordAutomaticBackupHealthCore` inside its existing write transaction; Plan 17-08 can use `updateAppSettingsCore` under its one restore transaction.

## Self-Check: PASSED

- All four implementation/test files and this summary exist.
- Task commits `e6c0c87`, `40c9415`, `5e2bbda`, `cd24a89`, `c206713`, and `13a4451` exist in Git history.
- `npm test -- src/db/migrations/007-tombstones.test.ts src/db/app-settings-dao.test.ts` and `npx tsc --noEmit` pass.
