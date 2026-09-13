---
phase: 34-rapid-capture-update-flows
plan: 01
subsystem: database
tags: [sqlite, migration, app-settings, backup, restore, interaction-channel]

# Dependency graph
requires:
  - phase: 32-history-and-insights
    provides: migration 025 frozen channel vocabulary (Message/Call/In Person, D-06)
  - phase: 33-group-interaction-logging
    provides: migration 026 (head verified on disk = 026 before this plan)
provides:
  - "Migration 027: app_settings.default_interaction_channel + remembered_interaction_channel (NOT NULL, seeded)"
  - "TARGET_VERSION bumped to 27; migration027 registered in MIGRATIONS"
  - "app-settings-dao read/write/validate for both channel columns (DEFAULT_INTERACTION_CHANNELS tuple + assert validators)"
  - "Declare-only backup portability: both camelCase MANIFEST keys allowlisted + boundary-validated, not emitted, no format bump"
affects: [34-04-log-interaction-screen, 36-ai-config-backup-format]

# Actuals (#2632)
actuals:
  tokens: 9724
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "app_settings-only additive migration via ALTER TABLE ADD COLUMN NOT NULL DEFAULT + CHECK (020/025 analog)"
    - "Declare-only backup portability: camelCase MANIFEST key allowlisted for restore, emission deferred to Phase 36"
    - "DAO assert validators reused at the backup restore boundary (defense in depth)"

key-files:
  created:
    - src/db/migrations/027-default-interaction-channel.ts
    - src/db/migrations/027-default-interaction-channel.test.ts
  modified:
    - src/db/database.ts
    - src/db/app-settings-dao.ts
    - src/db/app-settings-dao.test.ts
    - src/backup/backup-schema.ts
    - src/backup/backup-schema.test.ts
    - src/backup/restore-apply.test.ts

key-decisions:
  - "Migration 027 column shape ratified by owner at the Task 1 one-way-door checkpoint (approved as specified)"
  - "Channel validation added at BOTH the parse boundary (assertPortableSettings) and the write boundary (validateAppSettingsPatch) — defense in depth per T-34-03"
  - "remembered_interaction_channel vocabulary excludes the 'remember' sentinel (always a concrete channel)"

patterns-established:
  - "Declare-only channel keys mirror the Phase 23/25/32 allowlist-now/emit-later convention"

requirements-completed: [CAPT-11]

coverage:
  - id: D1
    description: "Migration 027 adds default_interaction_channel + remembered_interaction_channel to app_settings (NOT NULL, seeded 'remember'/'Message', CHECK vocabulary), bumps TARGET_VERSION to 27, no interactions change"
    requirement: CAPT-11
    verification:
      - kind: unit
        ref: "src/db/migrations/027-default-interaction-channel.test.ts (6 tests)"
        status: pass
      - kind: unit
        ref: "src/db/migrations/full-chain.test.ts#runs the database-owned migration list from v0 through the current target"
        status: pass
    human_judgment: false
  - id: D2
    description: "app-settings-dao reads/writes/validates both channel columns through the generic COLUMN_OF patch loop; validators reject out-of-vocabulary values"
    requirement: CAPT-11
    verification:
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#app-settings-dao — default interaction channel (migration 027, CAPT-11)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Declare-only backup portability: both camelCase keys allowlisted, boundary-validated, round-trip through COLUMN_OF on restore, malformed rejected before write, not emitted, no format bump"
    requirement: CAPT-11
    verification:
      - kind: unit
        ref: "src/backup/backup-schema.test.ts#default interaction channel portable allowlist (declare-only, CAPT-11)"
        status: pass
      - kind: integration
        ref: "src/backup/restore-apply.test.ts#restores the declare-only camelCase channel keys into their SQLite columns via COLUMN_OF (CAPT-11)"
        status: pass
      - kind: integration
        ref: "src/backup/restore-apply.test.ts#rejects an out-of-vocabulary restored channel value before writing (CAPT-11, T-34-03)"
        status: pass
    human_judgment: false

# Metrics
duration: 21min
completed: 2026-09-13
status: complete
---

# Phase 34 Plan 01: Default Interaction Channel Data Layer Summary

**Migration 027 adds durable, validated, declare-only-portable `default_interaction_channel` + `remembered_interaction_channel` app_settings columns (head-verified 026→027) with full DAO read/write/validate wiring and no `interactions` change or backup-format bump.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-13T01:31:58Z
- **Completed:** 2026-09-13T01:52:33Z
- **Tasks:** 3 executed (Task 1 was the owner-ratified one-way-door checkpoint, pre-approved)
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments
- Migration 027 (app_settings-only, additive): `default_interaction_channel TEXT NOT NULL DEFAULT 'remember' CHECK(... IN ('remember','Message','Call','In Person'))` and `remembered_interaction_channel TEXT NOT NULL DEFAULT 'Message'`; registered in MIGRATIONS with TARGET_VERSION bumped to 27. No `interactions` migration (D-07). CHECK literals match migration 025's frozen vocabulary (D-06).
- app-settings-dao threads both columns through all touchpoints (AppSettings, PortableSettingsSnapshot/AppSettingsPatch, WritableSettingsKey, AppSettingsRow, SELECT, COLUMN_OF, hydration) plus `DEFAULT_INTERACTION_CHANNELS`/`REMEMBERED_INTERACTION_CHANNELS` tuples and `assertDefaultInteractionChannel`/`assertRememberedInteractionChannel` wired into the updateAppSettings guard.
- Declare-only backup portability: both camelCase MANIFEST keys added to `PORTABLE_SETTINGS_KEYS`, validated at the restore boundary via the DAO validators, round-tripping through COLUMN_OF; NOT emitted by `getPortableSettingsSnapshot`; no `BACKUP_FORMAT_VERSION` bump (D-03; Phase 36 owns emission).

## Task Commits

Each task was committed atomically:

1. **Task 2: Migration 027 (tracer, TDD)** - `71f4b43` (feat)
2. **Task 3: Extend app-settings-dao (TDD)** - `2c8ef21` (feat)
3. **Task 4: Declare-only backup portability (TDD)** - `66ae92c` (feat)

**Plan metadata:** committed separately (docs: complete plan)

_Task 1 was a `checkpoint:decision` (one-way-door migration shape); ratified by the owner before this continuation and implemented in Task 2 exactly as approved._

_Note: TDD tasks used a RED→GREEN cycle within each atomic commit; the tracer (Task 2) verify was run end-to-end (6/6) before expansion._

## Files Created/Modified
- `src/db/migrations/027-default-interaction-channel.ts` - The migration + `DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION = 27`
- `src/db/migrations/027-default-interaction-channel.test.ts` - node:sqlite migration-runner coverage (PRAGMA table_info, CHECK, raw round-trip, v20→v27 jump, interactions-untouched)
- `src/db/database.ts` - Register migration027; `TARGET_VERSION = DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION`
- `src/db/app-settings-dao.ts` - Channel fields, tuples, validators, COLUMN_OF/SELECT/hydration/guard wiring
- `src/db/app-settings-dao.test.ts` - DAO read/write/validate coverage + migrateToV5 helper bumped to v27
- `src/backup/backup-schema.ts` - Allowlist both camelCase keys; boundary validation via DAO validators
- `src/backup/backup-schema.test.ts` - Set-membership, accept-on-parse, reject-malformed, parser-not-inject
- `src/backup/restore-apply.test.ts` - COLUMN_OF round-trip + reject-before-write; db() helper bumped to v27

## Decisions Made
- Followed the owner-ratified migration 027 shape verbatim (Task 1 approved as specified).
- Added channel validation at the parse boundary (`assertPortableSettings`) in addition to the write boundary (`validateAppSettingsPatch`), mirroring the Orrery precedent, to satisfy T-34-03 defense-in-depth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bumped coupled test harnesses broken by the TARGET_VERSION / getAppSettings change**
- **Found during:** Task 4 (full-suite verification)
- **Issue:** `getAppSettings` now SELECTs the two migration-027 columns, so any test whose migration harness stopped at v25 threw `no such column: default_interaction_channel` (notification-schedule, digest-schedule via `reconcileSchedule`/`readOrrerySystemSnapshot`). Separately, `full-chain.test.ts` hard-asserted `TARGET_VERSION === 26`.
- **Fix:** Extended the notification-schedule and digest-schedule migration arrays to include migration026/027 (target 27); updated full-chain to assert `TARGET_VERSION === 27`, added version-26/27 existence checks and the two new column-presence checks.
- **Files modified:** src/db/migrations/full-chain.test.ts, src/services/notifications/notification-schedule.test.ts, src/services/notifications/digest-schedule.test.ts
- **Verification:** Full suite green (3181 tests pass) after the fix.
- **Committed in:** `66ae92c` (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking). All directly caused by the in-scope TARGET_VERSION bump and getAppSettings SELECT extension — necessary to keep the suite green. No scope creep.
**Impact on plan:** None on deliverables; the migration/DAO/backup shape is exactly as planned.

## Issues Encountered
- The restore round-trip test initially did not apply settings because `applySettings` only triggers when the manifest's settings `modifiedAt` is newer than the destination's (or replace-all mode). Resolved by bumping the source settings stamp before export, mirroring the existing phone-region round-trip idiom.
- `biome format --write` initially reformatted two whole test files (the repo's committed test files are not biome-format-clean). Reverted the wholesale reformatting and re-applied only the scoped additions in the files' existing compact style to avoid out-of-scope churn.

## Known Stubs
None. `sortExpr()`-style dormancy note: the two columns are the durable data layer; the Log Interaction screen (34-04) is the runtime consumer — this is the planned foundation, not a stub.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 34-04 (Log Interaction screen) can initialize the channel from `defaultInteractionChannel` and persist `rememberedInteractionChannel` on a successful ordinary save.
- Phase 36 owns emission of the two keys from `getPortableSettingsSnapshot` + the coordinated `BACKUP_FORMAT_VERSION` bump (declare-only until then).
- Pre-existing, unrelated: `src/components/orrery/orrery-controls-render.test.tsx` fails to load (`Unexpected token 'typeof'`, confirmed at df0393a) — logged in deferred-items.md, triage with Phase 30 review reconciliation.

## Self-Check: PASSED

- Created files exist: `027-default-interaction-channel.ts`, `027-default-interaction-channel.test.ts`
- Task commits exist: `71f4b43`, `2c8ef21`, `66ae92c`
- SUMMARY.md present

---
*Phase: 34-rapid-capture-update-flows*
*Completed: 2026-09-13*
