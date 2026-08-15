---
phase: 03-custom-fields
plan: 01
subsystem: database
tags: [sqlite, custom-fields, sql-injection, col_name, slugify, transaction, mutex, node-sqlite]

# Dependency graph
requires:
  - phase: 02-data-layer
    provides: "SqlExecutor contract, shared withMutex, migration001 schema, node:sqlite test harness"
provides:
  - "CustomFieldDef + NewFieldDef shared DB-row types (custom_field_defs shape)"
  - "RESERVED_COLUMN_NAMES — drift-guarded fixed-column whitelist"
  - "slugify / makeColName / isSafeColName — the single injection-safe col_name producer"
  - "src/db/transaction.ts — the single shared inWriteTransaction primitive with a non-reentrancy header"
affects: [03-custom-fields, 04-status, 05, 07, 08, contact-crud, ai-suggestions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whitelist-CONSTRUCTED SQL identifiers (never escaped) at a single chokepoint"
    - "Co-located drift test: whitelist proven superset-of live PRAGMA table_info"
    - "Single shared transaction primitive imported (never copied) — non-reentrancy documented where read"

key-files:
  created:
    - src/db/field-types.ts
    - src/db/reserved-columns.ts
    - src/db/reserved-columns.test.ts
    - src/db/col-name.ts
    - src/db/col-name.test.ts
    - src/db/transaction.ts
  modified:
    - src/db/recency-dao.ts

key-decisions:
  - "slugify guarantees [a-z][a-z0-9_]* by construction; empty/leading-non-letter results get an f_ prefix"
  - "col_name uniquifies against RESERVED_COLUMN_NAMES + caller's existing set (which must include quarantined defs)"
  - "inWriteTransaction extracted verbatim (byte-identical semantics) so recency-dao behaviour is unchanged"

patterns-established:
  - "Pattern 1: user label → SQL identifier safety is provable in pure Vitest (no DB) via slugify + isSafeColName"
  - "Pattern 2: reserved-column drift guard runs the real migration and asserts whitelist ⊇ live schema"
  - "Pattern 3: one transaction primitive; compose by extracting a non-mutexed core, never by nesting"

requirements-completed: [FLD-01, FLD-02]

coverage:
  - id: D1
    description: "CustomFieldDef + NewFieldDef shared DB-row types available for Plans 02–08"
    requirement: "FLD-01"
    verification:
      - kind: unit
        ref: "tsc --noEmit (types compile; consumed by reserved-columns.test.ts import graph)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RESERVED_COLUMN_NAMES reserves all contacts + contact_custom_values fixed columns + rowid aliases, drift-guarded against live schema"
    requirement: "FLD-02"
    verification:
      - kind: unit
        ref: "src/db/reserved-columns.test.ts#is a superset of the live contacts + contact_custom_values fixed columns"
        status: pass
      - kind: unit
        ref: "src/db/reserved-columns.test.ts#reserves the SQLite rowid aliases"
        status: pass
    human_judgment: false
  - id: D3
    description: "slugify/makeColName/isSafeColName turn any label (incl. injection payloads) into a safe, collision-free col_name"
    requirement: "FLD-02"
    verification:
      - kind: unit
        ref: "src/db/col-name.test.ts (12 tests: injection payload, reserved/duplicate/quarantined collision, f_ prefix, isSafeColName rejects quotes/spaces/leading-digit)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Single shared inWriteTransaction primitive; recency-dao imports it with byte-identical behaviour"
    verification:
      - kind: unit
        ref: "src/db/recency-dao.test.ts (22 tests, all green after refactor)"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-08-15
status: complete
---

# Phase 3 Plan 01: Custom-field col_name safety + shared transaction Summary

**Whitelist-constructed, injection-safe `col_name` producer (`slugify`/`makeColName`/`isSafeColName`) backed by a drift-guarded reserved-column whitelist, plus the single shared `inWriteTransaction` extracted from recency-dao — the Wave-1 leaves every later Phase-3 plan imports.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-15T01:40:35Z
- **Completed:** 2026-08-15T01:44:22Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- `col_name` is now produced at ONE chokepoint (`col-name.ts`), constructed from the `[a-z][a-z0-9_]*` charset rather than escaped — a SQL-injection payload label yields an ordinary slug with none of its punctuation (T-03-01 mitigated, provable in pure Vitest).
- `RESERVED_COLUMN_NAMES` reserves every fixed column of `contacts` + `contact_custom_values` plus the rowid aliases, and a co-located node:sqlite drift test proves the whitelist is a superset of the live schema — a future migration that adds a fixed column without updating the whitelist fails loudly (T-03-06 mitigated).
- `inWriteTransaction` now lives in a single `src/db/transaction.ts` with a non-reentrancy header (the structural fix for the sweep-deadlock class, review HIGH-1); `recency-dao.ts` imports it and its 22-test suite stays green byte-for-byte.
- Shared `CustomFieldDef` / `NewFieldDef` types shipped for Plans 02–08 to import.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared CustomFieldDef type + reserved-column whitelist (drift-guarded)** — `c67da47` (feat)
2. **Task 2: col_name slugifier + uniquifier (single producer, injection-safe)** — `1033f86` (feat)
3. **Task 3: Extract the single inWriteTransaction to transaction.ts + refactor recency-dao** — `7f5f7c5` (refactor)

## Files Created/Modified
- `src/db/field-types.ts` (created) — `CustomFieldDef` + `NewFieldDef` DB-row types; node-pure, imports `FieldType`.
- `src/db/reserved-columns.ts` (created) — `RESERVED_COLUMN_NAMES` transcribed from migration 001.
- `src/db/reserved-columns.test.ts` (created) — node:sqlite drift guard (whitelist ⊇ live PRAGMA table_info + rowid aliases).
- `src/db/col-name.ts` (created) — `slugify` / `makeColName` / `isSafeColName`, the single col_name producer.
- `src/db/col-name.test.ts` (created) — pure Vitest: injection payload, collisions, f_ prefix, guard rejections.
- `src/db/transaction.ts` (created) — the single `inWriteTransaction` with the non-reentrancy header.
- `src/db/recency-dao.ts` (modified) — deleted the private copy; imports the shared primitive; call sites unchanged.

## Decisions Made
- `slugify` guarantees a valid identifier for ALL inputs (empty / all-punctuation / leading-digit → `f_`-prefixed), so it never returns a non-identifier; `makeColName`'s `|| "field"` fallback is retained as a defensive belt.
- Reserved set stored lowercase (slugs are always lowercase), so the collision check needs no case folding.
- `inWriteTransaction` moved verbatim — same closed-over shared `mutex.ts`, so serialization semantics are identical and no recency test changed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Biome reformatted two test files on `--write` (long signatures / wrapped call) — cosmetic only; tests re-run green afterward.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `RESERVED_COLUMN_NAMES`, `makeColName`, `isSafeColName`, `CustomFieldDef`/`NewFieldDef`, and `inWriteTransaction` are all exported and ready for the remaining Wave-1+ Phase-3 plans (02–08) and Phase 4.
- Reminder carried forward for Plan 08: build the `existing` set passed to `makeColName` from `listDefs({ includeQuarantined: true })` so a still-present quarantined field's column is never re-collided (asserted by the quarantined-collision test here).
- No blockers.

## Self-Check: PASSED

---
*Phase: 03-custom-fields*
*Completed: 2026-08-15*
