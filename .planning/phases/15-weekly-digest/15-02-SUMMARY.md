---
phase: 15-weekly-digest
plan: 02
subsystem: database
tags: [sqlite, migration, app-settings, digest, expo-sqlite, node-sqlite]

# Dependency graph
requires:
  - phase: 14-ai (migration 004)
    provides: "The app_settings ADD COLUMN migration pattern (004-ai-settings) and the DAO threading idiom (decayEnabled/birthdayEnabled) that 005 + digestEnabled mirror exactly."
  - phase: 11-notify (migration 002)
    provides: "The single-row app_settings table, the assertToggle 0/1 write guard, and the getAppSettings/updateAppSettings read/write layer."
provides:
  - "Migration 005: app_settings.digest_enabled INTEGER NOT NULL DEFAULT 1 (digest ON by default; forward-only, additive, start-state-independent)."
  - "TARGET_VERSION advanced 4 -> 5; migration005 registered in database.ts runMigrations list."
  - "digestEnabled (0|1) threaded through the app-settings DAO: readable via getAppSettings, writable + assertToggle-guarded via updateAppSettings."
affects: [15-03 (schedule service reads digest_enabled + must bump its harness to v5), 15-05 (Settings toggle row writes digestEnabled), 16-sync (backup exports digest_enabled as a settings row; sync_tombstones renumbered to 006)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive single-column app_settings migration mirroring 004-ai-settings (exported DDL const + Migration object, deps unused)."
    - "Toggle field threaded through all six DAO lists (AppSettings, AppSettingsRow, WritableSettingsKey, TOGGLE_FIELDS, COLUMN_OF, getAppSettings SELECT+return) with assertToggle validation."
    - "In-place test-harness version bump (migrateToV4 -> migrateToV5) to keep every getAppSettings case on the current schema with no dead helper."

key-files:
  created:
    - src/db/migrations/005-digest-settings.ts
    - src/db/migrations/005-digest-settings.test.ts
  modified:
    - src/db/database.ts
    - src/db/app-settings-dao.ts
    - src/db/app-settings-dao.test.ts

key-decisions:
  - "Migration 005 = ALTER TABLE app_settings ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 1 — the owner ruling (15-CONTEXT §Persistence), NOT a schema violation to remove."
  - "digestEnabled defaults ON (1) — a durable OFF the launch sweep cannot re-enable (RESEARCH Pitfall 1)."
  - "Test harness migrated IN PLACE (migrateToV4 renamed migrateToV5 + migration005 appended); migration-002 historical tests stay at v2."

patterns-established:
  - "Digest master toggle persists as a global app_settings column, not per-contact state — the digest stays a pure read surface."

requirements-completed: [DGST-01]

coverage:
  - id: D1
    description: "Migration 005 adds app_settings.digest_enabled (INTEGER NOT NULL DEFAULT 1), forward-only + additive + start-state-independent; registered in database.ts with TARGET_VERSION 5."
    requirement: DGST-01
    verification:
      - kind: unit
        ref: "src/db/migrations/005-digest-settings.test.ts#migration 005 — digest toggle column (forward-only, additive)"
        status: pass
    human_judgment: false
  - id: D2
    description: "digestEnabled (0|1, default ON) is readable via getAppSettings and writable via updateAppSettings, guarded to exactly 0/1 by assertToggle (T-15-05)."
    requirement: DGST-01
    verification:
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#round-trips the digest toggle: write 0 reads 0, write 1 reads 1 (DGST-01)"
        status: pass
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#rejects a non-0/1 digestEnabled before any UPDATE (assertToggle guard, T-15-05)"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-08-23
status: complete
---

# Phase 15 Plan 02: Digest Toggle Persistence Summary

**Migration 005 adds `app_settings.digest_enabled` (INTEGER NOT NULL DEFAULT 1, digest ON by default) and threads `digestEnabled` through the app-settings DAO as an assertToggle-guarded 0/1 setting — the durable, backup-exportable home DGST-01's "defaults on, independently toggleable" requires.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-23T17:44Z
- **Completed:** 2026-08-23T17:50Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Migration 005 (`005-digest-settings.ts`): one `ALTER TABLE app_settings ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 1`, mirroring `004-ai-settings.ts` — forward-only, additive, start-state-independent (v0→v5 and v4→v5 land identically). Registered in `database.ts`; `TARGET_VERSION` advanced 4→5.
- node:sqlite proof (`005-digest-settings.test.ts`, 5 cases): v0→v5 lands the column defaulting to 1, v4→v5 adds exactly the one column and defaults to 1, idempotent re-run keeps one id=1 row.
- `digestEnabled` (0|1, default ON) threaded through all six DAO lists — `AppSettings`, `AppSettingsRow` (`digest_enabled`), `WritableSettingsKey`, `TOGGLE_FIELDS`, `COLUMN_OF`, and the `getAppSettings` SELECT + return. `assertToggle` now guards it to exactly 0/1 before any UPDATE (T-15-05 mitigation).
- DAO test harness migrated IN PLACE (`migrateToV4` → `migrateToV5`, `migration005` appended, version 4→5); every `getAppSettings` caller repointed; `digestEnabled: 1` spliced into both full-object `toEqual` expectations; digest round-trip + non-0/1 reject cases added. The historical `migration 002` (`migrateToV2`) tests stay at v2.

## Task Commits

1. **Task 1: Migration 005 + registration + test** - `1826edd` (feat)
2. **Task 2: Thread digestEnabled through the app-settings DAO** - `3c2f8f4` (feat)

## Files Created/Modified
- `src/db/migrations/005-digest-settings.ts` - The `ADD_DIGEST_ENABLED` DDL const + `migration005` (version 5, adds the digest toggle column).
- `src/db/migrations/005-digest-settings.test.ts` - node:sqlite forward-migrate proof (v0→v5, v4→v5, default 1, idempotent).
- `src/db/database.ts` - Imports `migration005`, appends it to `runMigrations`, bumps `TARGET_VERSION` 4→5.
- `src/db/app-settings-dao.ts` - `digestEnabled` threaded through all six lists + assertToggle guard.
- `src/db/app-settings-dao.test.ts` - Harness bumped v4→v5 in place; digest round-trip + reject tests; expectations spliced.

## Decisions Made
- **Migration 005 is the owner ruling, not a schema violation.** 15-CONTEXT §Persistence records the owner's decision that the digest toggle persists as `app_settings.digest_enabled` via migration 005. "Adds no new schema" was ruled to mean no new TABLES and no new per-contact state — the digest remains a pure read surface. This migration was implemented as ruled, not questioned.
- **Defaults ON (1).** DGST-01 requires a durable OFF that the launch sweep cannot re-enable; the persisted column with a constant DEFAULT 1 provides exactly that.
- **In-place harness migration (review M1/L4).** `migrateToV4` was renamed to `migrateToV5` and repointed at every call site, rather than adding a second helper — leaving no dead v4 helper (Biome `noUnusedVariables`) and no getAppSettings case on the stale v4 schema.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Out-of-scope discovery — pre-existing Biome formatter errors (NOT fixed, per scope boundary).**
`npx biome check` reports 2 formatter errors in `src/db/app-settings-dao.test.ts`, both in the untouched Phase-14 `acknowledgeProvider` / `CASES` region (line-width wraps). They are present in the committed HEAD version and were not introduced by this plan — confirmed by running Biome against `git show HEAD:` of the file. Per the executor scope-boundary rule they were left alone; my own new code (migration 005, database.ts, the DAO threading, and my test additions) is Biome-clean. No pre-commit hook runs Biome in this repo (no husky/lefthook/custom git hooks), so the commit was not blocked.

## Handoff to 15-03 (expected, documented — do NOT treat as a regression I introduced)

Making `getAppSettings` SELECT `digest_enabled` turns `src/services/notifications/notification-schedule.test.ts` red: its `beforeEach` migrates only to **v4** while the reconcile-under-test now reads the v5 column, so 21 of its 27 cases fail with the single identical cause `Error: no such column: digest_enabled`. This is the exact case the plan's project-rules anticipated ("the notification-schedule.test.ts v5 bump is 15-03's job... if your DAO change makes it red, note it for 15-03, don't half-fix it here"). The fix is a one-line harness bump: import `migration005`, append it to the `runMigrations` array in that file's `beforeEach`, and change the target version `4 → 5`. I deliberately did NOT touch it. That suite lives outside `src/db/`, so my plan's gate (the full `src/db/` suite) stays green.

## Gate Results

- `npx vitest run src/db/migrations/005-digest-settings.test.ts` — **5 passed**.
- `npx vitest run src/db/app-settings-dao.test.ts` — **56 passed**.
- `npx vitest run src/db/` (full db suite, run because harnesses were migrated) — **42 files, 524 passed**. No app_settings suite regressed.
- `npx tsc --noEmit` — **clean (exit 0)**.
- `npm run check:colors` — **clean**.
- Biome — my new/changed code clean; 2 pre-existing Phase-14 formatter errors in an untouched region left out of scope (see Issues Encountered).

## Next Phase Readiness
- `digest_enabled` persistence is live and validated. 15-03's schedule service can READ `getAppSettings().digestEnabled` and re-register / cancel the weekly trigger accordingly.
- **Action required in 15-03:** bump the `notification-schedule.test.ts` harness to v5 (one-line, described above) before that suite goes green again.
- 15-05's Settings toggle row can WRITE `updateAppSettings({ digestEnabled })` — the guarded 0/1 path is in place.

## Self-Check: PASSED

- Created files verified on disk: `005-digest-settings.ts`, `005-digest-settings.test.ts`, `15-02-SUMMARY.md`.
- Task commits verified in git log: `1826edd` (Task 1), `3c2f8f4` (Task 2).
- STATE.md / ROADMAP.md deliberately NOT staged (orchestrator-owned per plan rules).

---
*Phase: 15-weekly-digest*
*Completed: 2026-08-23*
