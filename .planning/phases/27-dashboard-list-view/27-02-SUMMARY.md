---
phase: 27-dashboard-list-view
plan: 02
subsystem: database
tags: [sqlite, migration, app-settings, dashboard, backup]
requires:
  - phase: 25-dashboard-data-state-foundation
    provides: Migration 019 dashboard preferences and the dashboard DAO precedent.
provides:
  - Forward-only SQLite migration 020 for the durable Dashboard right-swipe action.
  - Closed write-time right-swipe action validation and portable-key allowlisting.
affects: [27-dashboard-list-view, 27-05, 36-ai-config]
actuals:
  tokens: 4536
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns: [additive SQLite migration, closed-union settings validation, allowlist-now emit-later]
key-files:
  created: [src/db/migrations/020-dashboard-swipe-pref.ts, src/db/migrations/020-dashboard-swipe-pref.test.ts]
  modified: [src/db/database.ts, src/db/app-settings-dao.ts, src/logic/dashboard-query-logic.ts, src/backup/backup-schema.ts]
key-decisions:
  - "Owner approved the irreversible v20 additive column with default quick-log and the quick-log/log-contact CHECK set."
  - "dashboardRightSwipeAction is writable through the optional PortableSettingsSnapshot key, while backup emission and format changes remain Phase 36 work."
patterns-established:
  - "Durable dashboard action preferences use a SQLite CHECK, a TypeScript closed union, and validation before UPDATE."
requirements-completed: [LISTV-08]
coverage:
  - id: D1
    description: Migration 020 adds and defaults the constrained right-swipe action column on an early forward upgrade.
    requirement: LISTV-08
    verification:
      - kind: integration
        ref: src/db/migrations/020-dashboard-swipe-pref.test.ts#adds the constrained column and seeds its default on an early forward jump
        status: pass
    human_judgment: false
  - id: D2
    description: DAO round-trip, closed-union rejection, and portable-key allowlisting.
    requirement: LISTV-08
    verification:
      - kind: integration
        ref: src/db/app-settings-dao.test.ts#round-trips the writable right-swipe action and rejects unknown values before writing
        status: pass
      - kind: unit
        ref: src/backup/backup-schema.test.ts#accepts the deferred right-swipe key while rejecting unknown siblings
        status: pass
    human_judgment: false
  - id: D3
    description: Physical DEBUG database readback of schema v20 and the seeded device row.
    requirement: LISTV-08
    verification:
      - kind: manual_procedural
        ref: docs/runbooks/desktop-build-pipeline.md
        status: unknown
    human_judgment: true
    rationale: Existing missing expo-web-browser dependency prevents the DEBUG app from starting; tracked in WINDOWS.md entry 35.
duration: 30min
completed: 2026-09-06
status: complete
---

# Phase 27 Plan 02: Dashboard right-swipe preference Summary

**A durable, default-Quick-Log Dashboard right-swipe preference with forward-only SQLite migration 020, validated DAO writes, and deferred-format backup allowlisting.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-06T02:05:00Z
- **Completed:** 2026-09-06T02:32:39Z
- **Tasks:** 2/2 implementation tasks completed after the approved decision gate
- **Files modified:** 12

## Accomplishments

- Added migration 020, registered it as the v20 schema target, and proved the real v2-to-v20 singleton-row upgrade path, default, and SQLite CHECK constraint.
- Added `RIGHT_SWIPE_ACTIONS` / `RightSwipeAction`, full DAO read/write plumbing, and pre-UPDATE rejection of unknown action values.
- Allowlisted the deferred portable key without changing the backup format, snapshot emission, or forward-migration registry.

## Task Commits

1. **Task 2: Migration 020 — additive right-swipe preference column** — `5366f88` (`feat`)
2. **Task 3: Preference DAO read/write/validate + backup allowlist** — `6aaddb1` (`feat`)
3. **Post-merge regression fix: current-schema test fixtures** — `623ec09` (`fix`)

## Files Created/Modified

- `src/db/migrations/020-dashboard-swipe-pref.ts` — v20 additive column with the approved default and CHECK set.
- `src/db/migrations/020-dashboard-swipe-pref.test.ts` — early forward-upgrade, default, and constraint coverage.
- `src/db/database.ts` — v20 target and ordered migration registration.
- `src/logic/dashboard-query-logic.ts` — right-swipe closed union.
- `src/db/app-settings-dao.ts` — typed read, writable patch, SQL mapping, and validator.
- `src/backup/backup-schema.ts` — allowlist-only portable key.
- `src/services/notifications/notification-schedule.test.ts` — current-schema notification fixture migrated through v20.
- `src/services/notifications/digest-schedule.test.ts` — current-schema digest fixture migrated through v20.
- `src/backup/restore-apply.test.ts` — explicit current-schema restore fixture migrated through v20.
- `src/db/migrations/full-chain.test.ts` — v20 migration-head and resulting-column regression coverage.

## Verification

- `npx vitest run src/db/migrations/020-dashboard-swipe-pref.test.ts src/db/app-settings-dao.test.ts src/backup/backup-schema.test.ts` — 103 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run check:colors` — passed.
- `npm test` — passed (242 files, 2,264 tests) after the post-merge fixture fix.
- Windows DEBUG build — completed after a clean Expo prebuild; physical database readback remains blocked by the pre-existing missing `expo-web-browser` dependency.

## Decisions Made

- Shipped the owner-approved irreversible migration shape exactly: `dashboard_right_swipe_action TEXT NOT NULL DEFAULT 'quick-log' CHECK(... IN ('quick-log','log-contact'))`.
- Kept the key allowlist-only this phase; Phase 36 still owns portable snapshot emission, backup-format changes, and forward wire migrations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test harness behavior] Corrected the migration CHECK assertion for node:sqlite.**
- **Found during:** Task 2
- **Issue:** The node test executor throws synchronously while its production-shaped type returns a Promise, so `.rejects` did not observe the expected SQLite constraint failure.
- **Fix:** Asserted the synchronous throw; the production constraint remains directly proven.
- **Files modified:** `src/db/migrations/020-dashboard-swipe-pref.test.ts`
- **Verification:** Targeted migration test passed.
- **Committed in:** `5366f88`

**Total deviations:** 1 auto-fixed (Rule 1). No source scope expansion.

### Post-merge Regression Fix

**2. [Rule 1 - Test fixture schema drift] Advanced explicit current-schema fixtures through migration 020.**
- **Found during:** Full-suite verification after Plan 27-02 merged.
- **Issue:** `notification-schedule.test.ts` stopped its in-memory migration chain at v19 while `getAppSettings()` now selects the v20 `dashboard_right_swipe_action` column, causing 33 notification tests to fail. Two sibling explicit-v19 fixtures and the full-chain head assertion had the same stale-current-schema assumption.
- **Fix:** Registered `migration020` and target version 20 in the notification, digest, and restore fixtures; updated the full-chain regression to require a single v20 migration, target 20, and the new column.
- **Files modified:** `src/services/notifications/notification-schedule.test.ts`, `src/services/notifications/digest-schedule.test.ts`, `src/backup/restore-apply.test.ts`, `src/db/migrations/full-chain.test.ts`
- **Verification:** Focused suites: 7 files / 162 tests passed; full suite: 242 files / 2,264 tests passed; TypeScript, color, and whitespace checks passed.
- **Committed in:** `623ec09`

## Issues Encountered

The physical DEBUG readback could not complete because existing `src/services/auth.ts` imports `expo-web-browser` but the locked dependencies do not contain it. This is outside Plan 27-02 and is recorded in `.planning/WINDOWS.md` and `deferred-items.md`.

## Known Stubs

None.

## Next Phase Readiness

Plan 27-05 can read `dashboardRightSwipeAction` at swipe commit. Resolve the missing `expo-web-browser` dependency before rerunning the tracked physical v20 database readback.

## Self-Check: PASSED

- Confirmed both created migration files and this summary exist on disk.
- Confirmed task commits `5366f88`, `6aaddb1`, and post-merge fix `623ec09` exist in git history.

---
*Phase: 27-dashboard-list-view*
*Completed: 2026-09-06*
