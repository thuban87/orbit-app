---
phase: 02-data-foundation-status-engine
plan: 01
subsystem: database
tags: [sqlite, expo-sqlite, node-sqlite, migrations, user_version, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "vitest config (node env, @ alias, passWithNoTests), formatLocalDate, module doc-comment convention"
provides:
  - "SqlExecutor / Migration / MigrationDeps contracts decoupling the data layer from expo-sqlite"
  - "Crash-safe PRAGMA user_version migration runner (per-step atomic, forward-only, original-error-preserving)"
  - "node:sqlite test harness (openTestDb + nodeSqliteExecutor) for node-side SQL verification"
  - "test script (vitest run) in package.json"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, custom-fields, status-engine, recency-dao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SqlExecutor interface abstraction so SQL is node-testable without the expo async API"
    - "Hand-rolled BEGIN/try-COMMIT/catch-ROLLBACK+rethrow transaction wrapper (never expo withTransactionAsync)"
    - "node:sqlite (built-in, zero-dep) in-memory fixture harness for Tier-A SQL tests"

key-files:
  created:
    - src/db/types.ts
    - src/db/__testkit__/node-sqlite.ts
    - src/db/migrations/runner.ts
    - src/db/migrations/runner.test.ts
  modified:
    - package.json

key-decisions:
  - "runMigrations(exec, migrations, targetVersion, deps) — the single canonical 4-arg signature; deps is REQUIRED and threaded into every migration.apply"
  - "PRAGMA user_version bump interpolated as an integer literal (never bound), guarded by Number.isInteger so no dynamic SQL can reach the statement"
  - "Runner performs NO PRAGMA bootstrap (WAL/foreign_keys/busy_timeout) — that is the caller's job in Plan 02 openAndMigrate"

patterns-established:
  - "Hand-rolled per-step transaction: BEGIN; apply; PRAGMA user_version=N; COMMIT; on throw ROLLBACK().catch() then re-throw the ORIGINAL error"
  - "node:sqlite SqlExecutor adapter normalises lastInsertRowid/changes to numbers and undefined rows to null"

requirements-completed: [DATA-01]

coverage:
  - id: D1
    description: "Migration runner applies pending versions in strict ascending order and stops at the target version"
    requirement: "DATA-01"
    verification:
      - kind: unit
        ref: "src/db/migrations/runner.test.ts#applies version 1 from a fresh DB and advances user_version"
        status: pass
      - kind: unit
        ref: "src/db/migrations/runner.test.ts#applies pending steps in strict ascending version order regardless of array order"
        status: pass
      - kind: unit
        ref: "src/db/migrations/runner.test.ts#stops at the target version, leaving later steps unapplied"
        status: pass
    human_judgment: false
  - id: D2
    description: "A migration step that throws leaves user_version unchanged with no partially-applied schema, re-throwing the ORIGINAL error (crash-safe)"
    requirement: "DATA-01"
    verification:
      - kind: unit
        ref: "src/db/migrations/runner.test.ts#rolls back a throwing step, re-throwing the ORIGINAL error with user_version unadvanced"
        status: pass
    human_judgment: false
  - id: D3
    description: "Forward-only re-run is a no-op; deps are threaded into every migration.apply so seeds receive now/newUid"
    requirement: "DATA-01"
    verification:
      - kind: unit
        ref: "src/db/migrations/runner.test.ts#is a forward-only no-op when already at the target version"
        status: pass
      - kind: unit
        ref: "src/db/migrations/runner.test.ts#threads deps into every migration.apply call"
        status: pass
    human_judgment: false
  - id: D4
    description: "node:sqlite test harness drives the real runner against an in-memory DB with foreign_keys ON"
    requirement: "DATA-01"
    verification:
      - kind: unit
        ref: "src/db/__testkit__/node-sqlite.ts (openTestDb + nodeSqliteExecutor) exercised by all 6 runner.test.ts cases"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-08-14
status: complete
---

# Phase 2 Plan 01: Crash-safe migration runner + node:sqlite harness Summary

**Hand-rolled `PRAGMA user_version` migration runner that advances DDL and version bump in one atomic per-step transaction and re-throws the original error on failure, decoupled from expo-sqlite via a `SqlExecutor` interface and proven node-side with a zero-dependency `node:sqlite` harness.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-14T22:00:36Z
- **Completed:** 2026-08-14T22:04Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `SqlExecutor` / `Migration` / `MigrationDeps` contracts (`src/db/types.ts`) — the whole phase's SQL is now node-testable without the expo async API; no expo import.
- Crash-safe `runMigrations` (`src/db/migrations/runner.ts`): forward-only, strict ascending order, per-step atomic (`BEGIN; apply; PRAGMA user_version=N; COMMIT`), `ROLLBACK` then re-throw the ORIGINAL error so an unreachable device never wedges on a half-applied step.
- `node:sqlite` test harness (`src/db/__testkit__/node-sqlite.ts`): `openTestDb` (in-memory, `foreign_keys=ON`) + `nodeSqliteExecutor` adapter — zero new runtime dependencies.
- 6 runner tests (`runner.test.ts`) driving the real runner, including the load-bearing crash-safety assertion (throwing step → `user_version` unadvanced, partial DDL rolled back).
- `"test": "vitest run"` script added to package.json (RESEARCH Wave-0 gap), existing scripts preserved.

## Task Commits

Each task was committed atomically:

1. **Task 1: Test script + SqlExecutor contracts + node:sqlite testkit** - `ae8b45f` (feat)
2. **Task 2: Crash-safe migration runner (TDD)** - `9d4b7ac` (test, RED) → `b8671b3` (feat, GREEN)

_TDD: RED test committed separately before the GREEN implementation. No refactor commit — implementation was clean on first pass._

## Files Created/Modified
- `src/db/types.ts` - SqlExecutor/Migration/MigrationDeps contracts (no expo import)
- `src/db/__testkit__/node-sqlite.ts` - node:sqlite DatabaseSync adapter + in-memory fixture
- `src/db/migrations/runner.ts` - crash-safe user_version runner (`runMigrations`)
- `src/db/migrations/runner.test.ts` - 6 forward-only + crash-safety assertions
- `package.json` - added `test` script

## Decisions Made
- **Canonical 4-arg signature** `runMigrations(exec, migrations, targetVersion, deps)` with `deps` REQUIRED — resolves the review MEDIUM "signature contradiction"; deps is passed straight through to each `migration.apply`, never fabricated by the runner.
- **`user_version` bump interpolated as an integer literal, never bound** (PRAGMA cannot bind); an added `Number.isInteger(next)` guard (Rule 2, defense-in-depth) makes it impossible for any non-integer to reach the interpolated statement, keeping T-02-02 (tampering via SQL construction) closed even against a mis-authored migration.
- **Runner sets no bootstrap PRAGMA** — WAL/foreign_keys/busy_timeout belong to the caller (Plan 02 `openAndMigrate`), so the runner stays a pure, node-testable control-flow unit. `foreign_keys=ON` is asserted by the test harness on the fixture connection.
- **Per-step atomicity via hand-rolled transaction** — deliberately NOT expo `withTransactionAsync`/`withExclusiveTransactionAsync` (pitfall P3: their catch issues an unconditional ROLLBACK that throws and masks the real error).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `Number.isInteger` guard on the interpolated `user_version` bump**
- **Found during:** Task 2 (runner implementation)
- **Issue:** The plan mandates the version be an integer literal (never bound), but nothing enforced integer-ness at the interpolation site — a mis-authored `migration.version` could in principle inject SQL into the PRAGMA statement.
- **Fix:** Guard `if (!Number.isInteger(next)) throw` before interpolating. Values still come only from app code, so this is defense-in-depth, not a behavior change — matches threat T-02-02's intent (runner builds no dynamic SQL from external data).
- **Files modified:** src/db/migrations/runner.ts
- **Verification:** All 6 runner tests pass; tsc + biome clean; integer versions unaffected.
- **Committed in:** b8671b3 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical/security hardening)
**Impact on plan:** No scope creep — a one-line guard reinforcing an existing plan constraint. Signature, control flow, and file set match the plan exactly.

## Issues Encountered
- Biome flagged import-ordering + line-length formatting on the RED test file after it was written; applied `biome check --write` (safe fixes only, formatting) before the GREEN commit. The pre-existing `biome.json` `recommended`-field deprecation INFO is out of scope (unrelated config file) and was left untouched.

## Verification
- `npx tsc --noEmit` — clean.
- `npx biome check .` — clean (only the out-of-scope biome.json deprecation INFO).
- `npx vitest run` — 5 files / 62 tests pass (6 new in runner.test.ts).
- `grep -cE "^import .*from ['\"]expo-sqlite['\"]" src/db/migrations/runner.ts` → 0 (no expo import).
- Crash-safety case is an explicit assertion (`rejects.toBe(boom)` + `user_version` still 1 + `t2` absent).

## Next Phase Readiness
- Plan 02 (`openAndMigrate`) can now supply the PRAGMA bootstrap (WAL/foreign_keys/busy_timeout set BEFORE the runner opens any transaction) and pass `deps = { now, newUid }`.
- Migration 1 DDL (categories/profile/contacts/interactions/custom-fields/fuel per RESEARCH §Code Ex 1b + CONTEXT overrides) plugs in as a `Migration` with `version: 1`.
- On-device FK/localtime behaviour and PRAGMA-before-transaction ordering remain to be asserted on the Pixel in Plan 06 (P1/P6).

## Self-Check: PASSED

---
*Phase: 02-data-foundation-status-engine*
*Completed: 2026-08-14*
