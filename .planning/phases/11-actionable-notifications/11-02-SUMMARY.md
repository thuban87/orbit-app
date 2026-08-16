---
phase: 11-actionable-notifications
plan: 02
subsystem: database
tags: [sqlite, migration, expo-sqlite, app-settings, notifications, dao]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "migration runner (PRAGMA user_version), SqlExecutor contract, node:sqlite test adapter, inWriteTransaction primitive"
provides:
  - "app_settings single-row table (migration 002) — backup-native SQLite home for app-level notification controls (OQ-1)"
  - "TARGET_VERSION bumped to 2 with migration002 registered in the runner array"
  - "app-settings-dao: getAppSettings (typed read) + updateAppSettings (validated partial write)"
affects: [11-05-scheduler, 11-06-settings-screen, 11-11-settings-ui, 16-backup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive forward-only migration since 001: new table + NOT NULL DEFAULT columns + same-transaction seed, migration 001 byte-unchanged"
    - "Validate-before-transaction: all input bounds checked before BEGIN so a malformed value never reaches SQL"
    - "Dynamic ?-bound partial UPDATE with a whitelisted column map and a changes===1 loud-failure guard"

key-files:
  created:
    - src/db/migrations/002-app-settings.ts
    - src/db/app-settings-dao.ts
    - src/db/app-settings-dao.test.ts
  modified:
    - src/db/database.ts

key-decisions:
  - "Booleans stored and returned as 0/1 integers end-to-end (no boolean mapping) for a single consistent representation across scheduler and UI."
  - "getAppSettings throws loudly when the id=1 row is absent — post-seed it always exists, so a missing row signals corruption, not empty state."
  - "Empty patch is an accepted no-op that still bumps modified_at (modified_at is always in the SET list), keeping the UPDATE well-formed."

patterns-established:
  - "App-level settings live in SQLite (OQ-1), never AsyncStorage, so Phase 16 backup exports them by table."
  - "Hour inputs validated to integer [0,23] and toggles to exactly 0/1 before any write (T-11-05 tampering mitigation)."

requirements-completed: [NOTIF-05]

coverage:
  - id: D1
    description: "Migration 002 creates the single-row app_settings table and seeds the decided defaults; a device on any prior version reaches user_version 2 in order."
    requirement: "NOTIF-05"
    verification:
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#migration 002 — app_settings (forward-only, additive)"
        status: pass
    human_judgment: false
  - id: D2
    description: "app-settings DAO reads the seeded defaults and writes only supplied fields with a changes===1 guard, bumping modified_at."
    requirement: "NOTIF-05"
    verification:
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#app-settings-dao — read / app-settings-dao — validated write"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hour writes are validated to 0-23 integers and toggles to 0/1 before any UPDATE (T-11-05 tampering mitigation); the row is unchanged on rejection."
    requirement: "NOTIF-05"
    verification:
      - kind: unit
        ref: "src/db/app-settings-dao.test.ts#rejects out-of-range/non-integer %s=%s before any UPDATE"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-08-16
status: complete
---

# Phase 11 Plan 02: app_settings migration + validated DAO Summary

**Forward-only additive migration 002 creating the single-row `app_settings` table (SQLite-native per OQ-1) with the decided notification defaults, plus a bounds-validated read/write DAO for the master/decay/birthday/lock-screen toggles and delivery/quiet hours.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-16T21:28:11Z
- **Tasks:** 2 (both TDD)
- **Files created:** 3, **modified:** 1

## Accomplishments
- New `002-app-settings.ts` migration: creates `app_settings (id INTEGER PRIMARY KEY CHECK (id=1), …)` and seeds one id=1 row with the decided defaults (master OFF, decay/birthday ON, lock-screen private, 9am delivery, 21→08 quiet). Purely additive — migration 001 is byte-unchanged.
- `database.ts` bumped to `TARGET_VERSION = 2` with `migration002` registered in the runner array (order-independent; the runner sorts by version).
- `app-settings-dao.ts`: `getAppSettings` typed read of the id=1 row and `updateAppSettings` partial write inside one `inWriteTransaction` with a `changes===1` guard, bumping `modified_at`.
- Hour bounds ([0,23] integer) and toggle (0/1) validation runs BEFORE the transaction opens (T-11-05), so a malformed value can never corrupt the scheduling inputs.

## Task Commits

Each task was committed atomically (TDD test → feat):

1. **Task 1 (RED): failing migration-002 suite** - `3e384f1` (test)
2. **Task 1 (GREEN): migration 002 table + seed, wired to v2** - `a138c0d` (feat)
3. **Task 2 (RED): failing DAO read/write/validation suite** - `773e67e` (test)
4. **Task 2 (GREEN): app-settings DAO with validated read/write** - `f72638e` (feat)

_TDD tasks have a test commit then a feat commit._

## Files Created/Modified
- `src/db/migrations/002-app-settings.ts` - `migration002` (version 2) + the `app_settings` DDL const and same-transaction seed.
- `src/db/database.ts` - `TARGET_VERSION` → 2; `migration002` added to the `runMigrations` array.
- `src/db/app-settings-dao.ts` - `AppSettings` interface, `getAppSettings`, `updateAppSettings` (validated partial write).
- `src/db/app-settings-dao.test.ts` - 23 node:sqlite tests: migration order/defaults/idempotence/single-row CHECK, read defaults, update roundtrip, out-of-range/non-integer rejection, per-contact non-interference.

## Decisions Made
- **0/1 integer booleans end-to-end** (not JS booleans) — one consistent representation the scheduler and UI both consume without mapping.
- **`getAppSettings` throws on a missing id=1 row** — loud by design; the seed guarantees the row, so absence is corruption.
- **Empty patch = no-op that still bumps `modified_at`** — `modified_at` is always in the SET list, so the UPDATE is always well-formed and the `changes===1` guard always meaningful.

## Deviations from Plan

None - plan executed exactly as written. The only adjustment was a test-harness detail (see Issues): assertions that expect a rejection wrap the call in an async IIFE because the synchronous node:sqlite adapter throws synchronously where the on-device expo executor rejects. This is a test-only normalisation, not a code deviation.

## Issues Encountered
- **node:sqlite sync throw vs. expo async reject.** The node:sqlite test adapter's `runAsync` executes synchronously, so a CHECK-constraint / DB error throws *before* a promise is returned, which `.rejects.toThrow()` cannot observe. The on-device expo executor is genuinely async and rejects. Resolved by wrapping the throwing call in `(async () => …)()` in the affected assertions so both executors normalise to a rejected promise. Production code is unaffected.

## User Setup Required
None - no external service configuration required. The migration runs automatically at app launch via the existing `PRAGMA user_version` runner; there is no db-push or CLI step.

## Next Phase Readiness
- The scheduler (11-05) has a validated read API (`getAppSettings`) for delivery/quiet hours and the per-type toggles.
- The Settings UI (11-06/11-11) has a validated write API (`updateAppSettings`).
- Settings are SQLite-resident, so Phase 16 backup can export them by table (OQ-1).
- No blockers.

## Verification
- `npx vitest run src/db/app-settings-dao.test.ts` — 23 passed.
- Full suite: `npx vitest run` — 744 passed (59 files), no regressions.
- `npx tsc --noEmit` clean; `npx biome check` clean on all changed files; `npm run check:colors` clean.
- `git diff HEAD -- src/db/migrations/001-initial.ts` — 0 lines (migration 001 byte-unchanged).

## Self-Check: PASSED

- All created files exist on disk (002-app-settings.ts, app-settings-dao.ts, app-settings-dao.test.ts, 11-02-SUMMARY.md).
- All task commits exist (3e384f1, a138c0d, 773e67e, f72638e).
- database.ts confirms `TARGET_VERSION = 2`.

---
*Phase: 11-actionable-notifications*
*Completed: 2026-08-16*
