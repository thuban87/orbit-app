---
phase: 02-data-foundation-status-engine
plan: 02
subsystem: database
tags: [sqlite, migrations, schema, custom-fields, fuel, uuid, foreign-keys, wal, tdd]

# Dependency graph
requires:
  - phase: 02-data-foundation-status-engine
    plan: 01
    provides: "SqlExecutor/Migration/MigrationDeps contracts, crash-safe runMigrations (4-arg), node:sqlite testkit (openTestDb + nodeSqliteExecutor)"
  - phase: 01-foundation
    provides: "formatLocalDate, vitest config (@ alias, node env), module doc-comment convention"
provides:
  - "Migration 1 — the irreversible initial schema: all ten tables + every un-backfillable column, frozen from day one"
  - "newUid() dependency-free merge-key UUID generator"
  - "openAndMigrate() bootstrap — WAL + foreign_keys=ON + busy_timeout set BEFORE any transaction, then runMigrations to TARGET_VERSION"
  - "getDb() accessor for the opened, migrated connection"
  - "localDateTime() local wall-clock timestamp helper (never toISOString)"
affects: [02-03, 02-04, 02-05, 02-06, custom-fields, fuel, status-engine, recency-dao, merge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DDL transcribed VERBATIM from RESEARCH §Code Example 1b as exported per-table string constants (auditable against the authoritative source)"
    - "Seeds parameterized (bound with ?) inside the migration step; only the runner's integer user_version bump is interpolated"
    - "Explicit SqlExecutor adapter over expo SQLiteDatabase (normalises run result), not structural assignability"
    - "PRAGMA-before-transaction bootstrap ordering (foreign_keys is a per-connection no-op inside a txn — P1)"

key-files:
  created:
    - src/db/uid.ts
    - src/db/migrations/001-initial.ts
    - src/db/migrations/001-initial.test.ts
    - src/db/database.ts
  modified: []

key-decisions:
  - "Migration 1 creates ALL ten tables from day one — categories, profile, contacts, contact_links, interactions, events, custom_field_defs, contact_custom_values, field_history, fuel — because un-backfillable columns cannot be added later on unreachable devices"
  - "fuel ships EMPTY in migration 1 with FUEL-01's columns (owner decision 2026-08-14); the fuel feature is Phase 7"
  - "custom-fields TABLES ship here; the custom-fields LOGIC is Phase 3 (HANDOFF §15 #3 / §14.10)"
  - "contact_custom_values has NO value columns yet; the index/UNIQUE ban is VALUE-column-scoped (HANDOFF §14.11) — the merge-key uid UNIQUE autoindex is exempt and correct and STAYS"
  - "Timestamps are LOCAL wall-clock via localDateTime()/formatLocalDate(); never toISOString() (UTC evening off-by-one)"

patterns-established:
  - "Per-table CREATE constants + a CREATE_STATEMENTS ordered array (parents before FK children) applied in one migration step"
  - "localDateTime() = formatLocalDate() date half + local HH:MM:SS — the datetime analogue of the project's date convention"

requirements-completed: [DATA-02, DATA-03]

coverage:
  - id: S1
    description: "Migration 1 creates all ten tables and sets user_version=1 on a fresh DB"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#creates all ten tables"
        status: pass
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#sets user_version to 1"
        status: pass
    human_judgment: false
  - id: S2
    description: "Every un-backfillable column exists from day one (contacts full set, interactions recorded_at/source, defs display_order/share_with_ai, distinct uid+modified_at on every mergeable table)"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#contacts has every un-backfillable column"
        status: pass
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#interactions has recorded_at and source"
        status: pass
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#custom_field_defs has display_order and share_with_ai"
        status: pass
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#every mergeable table has a distinct uid + modified_at"
        status: pass
    human_judgment: false
  - id: S3
    description: "Seeds present: four categories Family/Friends/Work/Community (display_order 0..3) + single profile row id=1; fuel table empty"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#seeds exactly four categories Family/Friends/Work/Community in order"
        status: pass
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#seeds exactly one profile row with id=1"
        status: pass
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#creates the fuel table empty"
        status: pass
    human_judgment: false
  - id: S4
    description: "contact_custom_values carries no index/UNIQUE on any VALUE column; the merge-key uid UNIQUE autoindex is permitted (value-column-scoped ban, HANDOFF §14.11)"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#has no index/UNIQUE on any VALUE column of contact_custom_values"
        status: pass
    human_judgment: false
  - id: S5
    description: "foreign_keys ON: deleting a contact cascades to interactions, contact_links, events, and contact_custom_values"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "src/db/migrations/001-initial.test.ts#cascades a contact delete to its interactions, links, events and custom values"
        status: pass
    human_judgment: false
  - id: S6
    description: "openAndMigrate sets WAL + foreign_keys=ON + busy_timeout before the runner opens any transaction, then runs migration001 to TARGET_VERSION"
    requirement: "DATA-03"
    verification:
      - kind: static
        ref: "grep 'foreign_keys' src/db/database.ts | grep -i ON; PRAGMAs precede runMigrations in source order"
        status: pass
      - kind: manual
        ref: "On-device PRAGMA-before-transaction ordering + localtime asserted on the Pixel in Plan 06 (P1/P6)"
        status: deferred
    human_judgment: true

# Metrics
duration: 4min
completed: 2026-08-14
status: complete
---

# Phase 2 Plan 02: Migration 1 — the irreversible schema + PRAGMA bootstrap Summary

**Migration 1 freezes the entire ten-table data model with every un-backfillable column from day one (transcribed verbatim from RESEARCH §Code Example 1b), seeds the four categories + the self/profile row, and stands up `openAndMigrate()` which sets WAL + foreign_keys=ON + busy_timeout BEFORE any transaction — proven exhaustively node-side with an 11-case schema/seed/FK-cascade test.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-14T22:07:42Z
- **Completed:** 2026-08-14T22:11Z
- **Tasks:** 3
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments
- `src/db/uid.ts` — `newUid()` merge-key UUID generator (prefers `crypto.randomUUID()`, RFC-4122 v4 `Math.random` fallback). Zero new dependencies (RESEARCH A5); a uid is an identifier not a secret (Security Domain V6).
- `src/db/migrations/001-initial.ts` — migration 1 DDL as per-table string constants transcribed VERBATIM from RESEARCH §Code Example 1b, covering all ten tables: `categories`, `profile`, `contacts`, `contact_links`, `interactions` (+ `idx_interactions_recency`), `events`, `custom_field_defs`, `contact_custom_values`, `field_history`, and the EMPTY `fuel` table. Seeds four categories + the id=1 profile row inside the same step, every value bound with `?`.
- `src/db/migrations/001-initial.test.ts` — 11-case exhaustive proof: all ten tables, `user_version=1`, the full un-backfillable column set, every mergeable table's `uid`+`modified_at` (and `field_history` correctly without a `uid`), the four ordered category seeds + single profile row, the empty fuel table, the value-column-scoped index ban on `contact_custom_values`, and a real FK cascade.
- `src/db/database.ts` — `openAndMigrate()` sets WAL + `foreign_keys=ON` + `busy_timeout` BEFORE the runner opens any transaction, wraps the expo db in an explicit `SqlExecutor` adapter, runs `migration001` to `TARGET_VERSION`, caches the connection, and exposes `getDb()`. `localDateTime()` writes local wall-clock timestamps.

## Task Commits

Each task was committed atomically:

1. **Task 1: uid generator + migration-1 DDL and seeds** — `c8a9226` (feat)
2. **Task 2: migration-1 schema + seed + FK-cascade test** — `714163d` (test)
3. **Task 3: database bootstrap — PRAGMAs before any transaction** — `6dceae1` (feat)

_Plan-level `tdd` tags: Task 1 supplies the implementation whose behavioural proof the plan explicitly places in Task 2 ("Full behavioural proof lands in Task 2"), so the schema test is a separate `test(...)` commit immediately after the implementation rather than a pre-implementation RED — the irreversible schema must exist before it can be asserted. `tdd_mode` is false at the phase level (init), so the plan-level MVP+TDD gate does not apply._

## Files Created/Modified
- `src/db/uid.ts` — dependency-free merge-key UUID generator (`newUid`)
- `src/db/migrations/001-initial.ts` — migration-1 DDL constants + seed builder + `migration001` step
- `src/db/migrations/001-initial.test.ts` — 11-case schema + seed + FK-cascade proof
- `src/db/database.ts` — `openAndMigrate` + PRAGMA bootstrap + `SqlExecutor` adapter + `getDb`

## Decisions Made
- **All ten tables ship in migration 1.** Un-backfillable columns (distinct `uid`, `created_at`, `modified_at`, `ring_seq`, interaction `recorded_at`/`source`, defs `display_order`/`share_with_ai`) cannot be added later on devices with no remote access, so the whole model is frozen now.
- **`fuel` ships EMPTY with FUEL-01's columns** (owner decision 2026-08-14; RESEARCH Q1/A1). The table exists so a later table-add migration is unnecessary; the fuel feature itself is Phase 7.
- **Custom-fields TABLES ship; LOGIC is Phase 3.** `contact_custom_values` has only its `contact_id` PK + merge-key `uid` + `modified_at` — no value columns yet.
- **The index/UNIQUE ban on `contact_custom_values` is VALUE-column-scoped** (HANDOFF §14.11). `DROP COLUMN` fails on an indexed/UNIQUE column and only value columns are dropped at Phase-3 quarantine expiry, so the merge-key `uid TEXT UNIQUE` autoindex is exempt, correct, and STAYS. The test asserts no index covers a value column and positively asserts the `uid` autoindex exists (resolving review MEDIUM "index test contradicts uid UNIQUE"). Phase 3 (DROP COLUMN) inherits this scoping.
- **Timestamps are local wall-clock.** `localDateTime()` = `formatLocalDate()` date half + local `HH:MM:SS`; never `toISOString()` (UTC evening off-by-one, already fixed once in the plugin).

## Deviations from Plan

None — plan executed exactly as written. All file paths, exports, table set, seeds, PRAGMA ordering, and the value-column-scoped index assertion match the plan and RESEARCH §Code Example 1b. Biome applied formatting-only safe fixes (import sort + line wrapping) on the test and database files before their commits; no logic changed.

## Issues Encountered
- Biome flagged import-ordering + line-wrapping on `001-initial.test.ts` and `database.ts`; applied `biome check --write` (safe/formatting fixes only) before each commit. The pre-existing `biome.json` `recommended`-field deprecation INFO is out of scope (unrelated config file, noted in Plan 01) and was left untouched.

## Verification
- `npx tsc --noEmit` — clean.
- `npx biome check .` — clean (only the out-of-scope biome.json deprecation INFO).
- `npx vitest run` — 6 files / 73 tests pass (11 new in `001-initial.test.ts`).
- `grep -n foreign_keys src/db/database.ts | grep -i ON` — matches; PRAGMAs precede `runMigrations` in source order.
- `grep -rv '^\s*\*' src/db | grep -c "toISOString().split"` → 0 (no UTC date splitting anywhere in src/db).

## Next Phase Readiness
- The schema is frozen. Plans 03-06 read/write truthful columns against `migration001` and drive the real connection via `openAndMigrate()` / `getDb()`.
- Plan 06 owes the on-device assertions on the Pixel: PRAGMA-before-transaction ordering, FK cascade firing on device, and `date('now','localtime')` correctness on Android/bionic (P1/P6) — node:sqlite (3.51.2) is a semantics harness only.
- `newUid` and `localDateTime` are available to every DAO for mergeable-row inserts.

## Self-Check: PASSED

---
*Phase: 02-data-foundation-status-engine*
*Completed: 2026-08-14*
