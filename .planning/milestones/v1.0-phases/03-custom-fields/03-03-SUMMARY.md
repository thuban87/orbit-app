---
phase: 03-custom-fields
plan: 03
subsystem: database
tags: [sqlite, custom-fields, ddl, transaction, mutex, quarantine, toctou, node-sqlite, sql-injection]

# Dependency graph
requires:
  - phase: 03-custom-fields
    provides: "inWriteTransaction primitive, makeColName/isSafeColName producer, RESERVED_COLUMN_NAMES, CustomFieldDef/NewFieldDef types, node:sqlite test harness (Plan 01)"
provides:
  - "createField — atomic INSERT def + ALTER TABLE ADD COLUMN in one transaction"
  - "dropFieldColumns — private non-mutexed snapshot-drop core (composed by three mutex-owning entries)"
  - "dropField — public snapshot-before-drop primitive (one inWriteTransaction)"
  - "deleteOrQuarantineField — atomic emptiness-check + drop-or-quarantine (single transaction)"
  - "expireFieldIfStale — sweep-specific expiry that re-verifies staleness under the lock (Plan 07 calls this)"
  - "field-defs-dao: renameField, reorderFields, changeFieldOptions, updateFieldCuration, quarantineField, restoreField, listDefs, isFieldEmpty"
affects: [03-custom-fields, 05, 07, 08, contact-crud, ai-suggestions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-mutexed transaction-body core composed by mutex-owning entries (never nest inWriteTransaction)"
    - "Under-the-lock re-verification closes a scan→drop TOCTOU (expireFieldIfStale)"
    - "Every def writer serialized through the shared mutex — completes the 'every writer through the mutex' contract"
    - "BEGIN-counting executor proxy proves single-transaction atomicity in node:sqlite tests"

key-files:
  created:
    - src/db/field-ddl.ts
    - src/db/field-ddl.test.ts
    - src/db/field-defs-dao.ts
    - src/db/field-defs-dao.test.ts
  modified: []

key-decisions:
  - "Drop logic split into a private non-mutexed core (dropFieldColumns) + three mutex-owning composers (dropField, deleteOrQuarantineField, expireFieldIfStale) — the HIGH-1 no-nesting structure"
  - "deleteOrQuarantineField runs its emptiness check AND drop inside ONE transaction so no write can land between check and drop (HIGH-2b)"
  - "expireFieldIfStale re-reads quarantined_at under the lock (strict < window) — a field restored after the sweep's scan survives (review cycle-2 TOCTOU)"
  - "Every def-metadata writer wrapped in its own inWriteTransaction (not just reorder) — completes the shared-mutex contract (review cycle-2 MED)"
  - "renameField edits label only; col_name stays a stable slug — no RENAME COLUMN churn, no field_history name-sync"
  - "col_name is the ONLY interpolated identifier; guarded by isSafeColName + double-quoted at every site; all values ?-bound"

patterns-established:
  - "core/wrapper composition: extract a non-mutexed core to compose transactional ops without nesting the non-reentrant mutex"
  - "single-BEGIN proxy assertion: wrap exec and count BEGINs to prove an op opens exactly one transaction"

requirements-completed: [FLD-01, FLD-02, FLD-03, FLD-05, FLD-06]

coverage:
  - id: D1
    description: "createField runs INSERT def + ALTER ADD COLUMN atomically; a failing ADD COLUMN rolls back the def INSERT too"
    requirement: "FLD-02"
    verification:
      - kind: unit
        ref: "src/db/field-ddl.test.ts#createField — atomic INSERT def + ADD COLUMN (FLD-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "dropField snapshots every value to field_history BEFORE DELETE def + DROP COLUMN, all in one transaction"
    requirement: "FLD-05"
    verification:
      - kind: unit
        ref: "src/db/field-ddl.test.ts#dropField — snapshot-before-drop (FLD-05 / FLD-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A populated-field DROP succeeds — proving no index/UNIQUE on any value column"
    requirement: "FLD-06"
    verification:
      - kind: unit
        ref: "src/db/field-ddl.test.ts#SUCCEEDS on a populated field — proves no index/UNIQUE on the value column (FLD-06)"
        status: pass
    human_judgment: false
  - id: D4
    description: "deleteOrQuarantineField does its emptiness check + drop in ONE transaction (single-BEGIN); empty→deleted, populated→quarantined with data intact"
    requirement: "FLD-05"
    verification:
      - kind: unit
        ref: "src/db/field-ddl.test.ts#deleteOrQuarantineField — dynamic action (FLD-05)"
        status: pass
    human_judgment: false
  - id: D5
    description: "expireFieldIfStale re-verifies staleness under the lock; a field restored since the sweep's scan is not dropped"
    requirement: "FLD-05"
    verification:
      - kind: unit
        ref: "src/db/field-ddl.test.ts#expireFieldIfStale — under-the-lock re-verification (review cycle-2)"
        status: pass
    human_judgment: false
  - id: D6
    description: "field-defs-dao: rename (label-only), reorder, changeFieldOptions, updateFieldCuration, quarantine/restore, listDefs, isFieldEmpty — each mutating op serialized through the shared mutex"
    requirement: "FLD-03"
    verification:
      - kind: unit
        ref: "src/db/field-defs-dao.test.ts (13 tests incl. single-BEGIN serialization proof)"
        status: pass
    human_judgment: false

# Metrics
metrics:
  duration: "~4 min"
  completed: "2026-08-15"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
  tests_added: 23

status: complete
---

# Phase 3 Plan 3: Transactional Custom-Field DDL Summary

Atomic create/drop/delete-or-quarantine of a custom field plus the serialized
def-metadata writers and the sweep-safe `expireFieldIfStale`, built on Plan 01's
shared `inWriteTransaction` and injection-safe `col_name` producer — the
correctness core of the custom-fields subsystem, node:sqlite-proven.

## Accomplishments

- **`src/db/field-ddl.ts`** — `createField` (INSERT def + ALTER ADD COLUMN in one
  transaction), the private non-mutexed `dropFieldColumns` core, the public
  `dropField`, the atomic `deleteOrQuarantineField`, and the sweep-specific
  `expireFieldIfStale`.
- **`src/db/field-defs-dao.ts`** — `renameField` (label-only), `reorderFields`,
  `changeFieldOptions`, `updateFieldCuration`, `quarantineField`, `restoreField`,
  plus the pure reads `listDefs` and `isFieldEmpty`. Every mutating op runs in its
  own `inWriteTransaction` and asserts `changes === 1`.
- **23 node:sqlite tests** across both modules, including an ADD-COLUMN-fails
  rollback fixture, a populated-field DROP-succeeds proof (FLD-06), a single-BEGIN
  atomicity proof for `deleteOrQuarantineField`, the TOCTOU re-verify proof for
  `expireFieldIfStale`, and a per-op single-BEGIN serialization proof.

## Concurrency structure (load-bearing)

The drop logic is split so it can be composed atomically WITHOUT nesting the
non-reentrant mutex (`mutex.ts:32-36` — a nested `inWriteTransaction` is a
permanent hang). `dropFieldColumns` is a private core that assumes the caller
already holds the transaction; `dropField`, `deleteOrQuarantineField`, and
`expireFieldIfStale` are the three mutex-owning entries, each opening exactly ONE
`inWriteTransaction` and calling the core directly. `expireFieldIfStale`
re-reads `quarantined_at` under the lock (strict `< datetime('now','localtime',
windowModifier)`) before dropping, so a `restoreField` that lands after the
sweep's candidate scan — now also serialized through the shared mutex — is
honoured and the field survives. Plan 07's sweep calls `expireFieldIfStale`,
never `dropField`.

## Deviations from Plan

None — plan executed exactly as written. `reorderFields`, `quarantineField`, and
`restoreField` also refresh `modified_at` from the caller-supplied `now` (the plan
specifies only the primary column each touches); this is consistent with every
other writer in the module and the recency DAO, and does not alter any documented
behavior.

## Verification

- `npx vitest run src/db/field-ddl.test.ts src/db/field-defs-dao.test.ts` — 23/23 pass
- `npx tsc --noEmit` — clean
- `npx biome check` on all four files — clean
- Grep confirmation: the only interpolated identifier in both modules is a
  guarded, double-quoted `col_name`; every runtime value is `?`-bound.

## Known Stubs

None.

## Self-Check: PASSED
