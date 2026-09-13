---
phase: 35-messaging-ai-compose
plan: 02
subsystem: database
tags: [sqlite, migration, app-settings, compose, message-mode, backup, dao]

# Dependency graph
requires:
  - phase: 34-rapid-capture
    provides: "migration 027 remember-sentinel template (default/remembered_interaction_channel) — the exact app_settings pattern migration 028 mirrors"
  - phase: 25-dashboard-data-state
    provides: "PORTABLE_SETTINGS_KEYS allowlist-not-emitted idiom + interactions channel vocabulary (migrated at 025; never re-touched)"
provides:
  - "migration 028: two additive app_settings columns — default_message_mode ('remember'|'text'|'email', NOT NULL DEFAULT 'remember', CHECK-constrained) and remembered_message_mode (NOT NULL DEFAULT 'text', no CHECK)"
  - "TARGET_VERSION bumped 27 -> 28 via COMPOSE_MESSAGE_MODE_SCHEMA_VERSION; migration028 registered in MIGRATIONS"
  - "app-settings-dao compose-mode accessors: DefaultMessageMode/RememberedMessageMode types, MESSAGE_MODES tuple, assertMessageMode write guard, both keys threaded through every coupled shape + getAppSettings read projection"
  - "PORTABLE_SETTINGS_KEYS gains defaultMessageMode/rememberedMessageMode (allowlisted-NOT-emitted; no backup-format bump)"
affects: [35-03 compose-logic, 35-06 research-side, ComposeScreen, 36 AI Config backup format bump]

# Actuals (#2632)
actuals:
  tokens: 7000    # chars/4 over the meaningful realized diff (27135 chars), excluding the incidental biome reformat of restore-apply.test.ts
  tasks: 2        # Task 1 was the owner decision checkpoint (resolved before this run); Tasks 2 + 3 executed
  commits: 3      # 2 task commits + this docs commit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compose message mode reuses the migration-027 remember-sentinel template verbatim: sentinel default column with CHECK + a concrete remembered column with no CHECK guarded by the DAO"
    - "Single assertMessageMode guard over the full vocabulary ('remember'|'text'|'email') applied to both patch fields; RememberedMessageMode's TS type excludes the sentinel at compile time"

key-files:
  created:
    - src/db/migrations/028-compose-message-mode.ts
    - src/db/migrations/028-compose-message-mode.test.ts
  modified:
    - src/db/database.ts
    - src/db/app-settings-dao.ts
    - src/backup/backup-schema.ts
    - src/db/migrations/full-chain.test.ts

key-decisions:
  - "Shipped the owner-approved Option A schema exactly (blocking-human decision checkpoint resolved before this run): default_message_mode CHECK IN ('remember','text','email') NOT NULL DEFAULT 'remember'; remembered_message_mode NOT NULL DEFAULT 'text' with NO CHECK"
  - "One assertMessageMode validator (not two like 027's split) — the plan specified a single guard; remembered's concrete-mode constraint is enforced by the RememberedMessageMode TS type + caller discipline, not a second runtime validator"
  - "COMP-02 marked NOT complete — this plan ships only the durable half (schema + DAO + backup allowlist); the per-session mode switch, remembered-mode-on-Transmit, and Compose UI land in later plans"

patterns-established:
  - "Message-mode preference persists via the generic updateAppSettings patch path (COLUMN_OF), never a standalone setter"

requirements-completed: []  # COMP-02 is only partially delivered (durable half); left unchecked in REQUIREMENTS.md

coverage:
  - id: D1
    description: "migration 028 adds default_message_mode + remembered_message_mode additively (app_settings only), with correct defaults and a CHECK that rejects out-of-vocabulary default_message_mode"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/db/migrations/028-compose-message-mode.test.ts (6 tests: version bump, v20->v28 defaults, raw round-trip, CHECK rejection, remembered CHECK-free, no interactions touch)"
        status: pass
    human_judgment: false
  - id: D2
    description: "full-chain v0->v28 applies additively — both compose columns present on the singleton row with defaults, no data loss"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/db/migrations/full-chain.test.ts#runs the database-owned migration list from v0 through the current target"
        status: pass
    human_judgment: false
  - id: D3
    description: "app-settings-dao exposes typed defaultMessageMode/rememberedMessageMode accessors, write-validated by assertMessageMode before the UPDATE opens; both threaded through AppSettings, AppSettingsRow, AppSettingsPatch, WritableSettingsKey, COLUMN_OF"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#app-settings-dao — compose message mode (migration 028, COMP-02) (8 tests incl. reject-before-write leaves row unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "both keys allowlisted in PORTABLE_SETTINGS_KEYS but NOT emitted by getPortableSettingsSnapshot; BACKUP_FORMAT_VERSION unchanged"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#does not emit the message-mode keys through the portable snapshot; #allowlists both message-mode keys in PORTABLE_SETTINGS_KEYS"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-09-13
status: complete
---

# Phase 35 Plan 02: Compose Default Message Mode (data layer) Summary

**Migration 028 adds the durable Compose message-mode preference (default_message_mode + remembered_message_mode) to app_settings, mirroring migration 027's remember-sentinel template, with typed write-validated DAO accessors and both keys allowlisted-not-emitted in the backup schema (no format bump).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-13T15:53:15Z
- **Tasks:** 2 executed (Task 1 was the owner decision checkpoint, resolved before this run)
- **Files modified:** 6 source (+ 4 test-helper/assertion touch-ups)

## Accomplishments
- New forward-only, additive, app_settings-only migration 028 with the owner-approved DDL exactly: `default_message_mode TEXT NOT NULL DEFAULT 'remember' CHECK(... IN ('remember','text','email'))` and `remembered_message_mode TEXT NOT NULL DEFAULT 'text'` (no CHECK). TARGET_VERSION bumped 27 -> 28; migration028 registered.
- Compose-mode DAO layer: `DefaultMessageMode`/`RememberedMessageMode` types, `MESSAGE_MODES` tuple, a single `assertMessageMode` write guard, and both keys threaded through every coupled shape (AppSettings, AppSettingsRow, PortableSettingsSnapshot/AppSettingsPatch, WritableSettingsKey, COLUMN_OF) + the getAppSettings SELECT/return — persisted through the generic `updateAppSettings` patch path, no standalone setter.
- Both keys added to `PORTABLE_SETTINGS_KEYS` (camelCase manifest keys) as allowlisted-NOT-emitted; `getPortableSettingsSnapshot` unchanged and no `BACKUP_FORMAT_VERSION` bump (D-03 — Phase 36 owns emission + the bump).

## Task Commits

1. **Task 2: migration 028 + register + bump TARGET_VERSION** — `b617998` (feat)
2. **Task 3: DAO accessors + assertMessageMode + backup allowlist** — `6c670b6` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `src/db/migrations/028-compose-message-mode.ts` — migration028 + `COMPOSE_MESSAGE_MODE_SCHEMA_VERSION = 28`; the two app_settings ALTER TABLEs.
- `src/db/migrations/028-compose-message-mode.test.ts` — 6 tests (defaults, CHECK rejection, remembered CHECK-free, no interactions touch).
- `src/db/database.ts` — imports migration028 + version const; TARGET_VERSION = COMPOSE_MESSAGE_MODE_SCHEMA_VERSION; migration028 in MIGRATIONS.
- `src/db/migrations/full-chain.test.ts` — v28 head + singleton-row default assertions for the two new columns.
- `src/db/app-settings-dao.ts` — types, MESSAGE_MODES, assertMessageMode, coupled-shape threading, read projection, patch-loop guard.
- `src/backup/backup-schema.ts` — PORTABLE_SETTINGS_KEYS additions (allowlisted-not-emitted).
- `src/db/app-settings-dao.test.ts` — MESSAGE_MODE_DEFAULTS fixture + a compose-message-mode describe block; migrateToV5 helper advanced to v28.
- `src/backup/restore-apply.test.ts`, `src/services/notifications/{notification,digest}-schedule.test.ts` — local migration-list helpers advanced to v28 so getAppSettings finds the new columns.
- `src/db/migrations/027-default-interaction-channel.test.ts` — relaxed the now-stale `TARGET_VERSION === 27` assertion (head has advanced; the migration's own version const still pins to 27).

## Decisions Made
- **Migration number re-verified on disk before writing:** highest registered migration was 027, TARGET_VERSION was 27, no 028 existed — head+1 = 028 confirmed.
- **Owner Option A shipped verbatim** (the blocking-human irreversible-schema decision was resolved before this run): exact column names, CHECK vocabulary, and NOT NULL defaults as approved.
- **Single `assertMessageMode` guard** over the full vocabulary applied to both patch fields, per the plan; remembered-mode's "never the sentinel" constraint is a compile-time TS-type guarantee, not a second validator.
- **COMP-02 left unchecked in REQUIREMENTS.md** — only the durable half shipped; the compose UI/logic complete the requirement in later plans.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Advanced four local test migration-list helpers to v28**
- **Found during:** Task 3 (DAO change)
- **Issue:** `getAppSettings` now SELECTs `default_message_mode`/`remembered_message_mode`. Four test suites build their own hardcoded migration list ending at 027 (target 27) and then call getAppSettings (directly or transitively) — those queries failed with `no such column: default_message_mode`.
- **Fix:** Added `migration028` to each helper's list and bumped its target to 28 (`app-settings-dao.test.ts` migrateToV5, `restore-apply.test.ts`, `notification-schedule.test.ts`, `digest-schedule.test.ts`).
- **Verification:** All four suites green.
- **Committed in:** `6c670b6`

**2. [Rule 1 - Bug] Relaxed migration 027 test's stale TARGET_VERSION assertion**
- **Found during:** Task 3 verification (full suite)
- **Issue:** `027-default-interaction-channel.test.ts` asserted `expect(TARGET_VERSION).toBe(27)`, which my legitimate Task 2 bump to 28 broke. The migration027.ts source file is byte-unchanged (only the test's head-coupled assertion was stale).
- **Fix:** Changed to `toBeGreaterThanOrEqual(27)` and kept `DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION === 27`; the current head is asserted by 028's own test.
- **Verification:** 027 + 028 + full-chain suites green.
- **Committed in:** `6c670b6`

**3. [Rule 3 - Blocking] Incidental biome reformat of restore-apply.test.ts**
- **Found during:** Task 3 (touching restore-apply.test.ts to advance its migration helper)
- **Issue:** The file was committed in a biome-non-conformant state; the commit hook / `biome check` requires conformance for any staged change to it, so touching two lines forced a whole-file reformat (~1600 lines of line-wrapping + import ordering).
- **Fix:** Applied `biome check --write` (formatting-only; no logic change). tsc clean and the full restore-apply suite passes.
- **Impact:** Inflates the Task 3 diff but changes no behavior. Called out here so the reformat noise is not mistaken for logic churn in review.
- **Committed in:** `6c670b6`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug). All necessary to keep the suite/type-gate green after a legitimate schema-head bump; no scope creep into product behavior.

## Issues Encountered
- **Two pre-existing test failures discovered, NOT caused by this plan** — logged to `35-messaging-ai-compose/deferred-items.md` and the WINDOWS ledger (out of scope per the SCOPE BOUNDARY rule; neither imports any module 35-02 touched and both reproduce with 35-02's changes reverted):
  1. `src/db/migrations/006-normalize-custom-field-values.test.ts` — "no such column: allow_ai" (a migration-025 column) in the v5-profile lifecycle test.
  2. `src/components/orrery/orrery-controls-render.test.tsx` — a render-test failure unrelated to the data layer.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 35-03 (compose-logic) and the ComposeScreen plans now have a real, typed, write-validated preference to read (`defaultMessageMode`) and update (`rememberedMessageMode` on Transmit/Copy).
- Phase 36 owns turning the allowlisted keys into emitted backup fields + the coordinated `BACKUP_FORMAT_VERSION` bump; nothing here pre-empts that.

## Self-Check: PASSED

- Created files exist: `028-compose-message-mode.ts`, `028-compose-message-mode.test.ts`, `35-02-SUMMARY.md` — all FOUND.
- Task commits exist in git history: `b617998` (Task 2), `6c670b6` (Task 3) — both FOUND.
- Verification gates: `028` + `full-chain` + `app-settings-dao` + `backup` + `notifications` suites green (342 tests); `tsc --noEmit` exit 0; migrations 001–027 byte-unchanged (only new 028 + full-chain.test.ts under `src/db/migrations/`).

---
*Phase: 35-messaging-ai-compose*
*Completed: 2026-09-13*
