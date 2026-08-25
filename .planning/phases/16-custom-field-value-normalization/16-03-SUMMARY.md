---
phase: 16-custom-field-value-normalization
plan: "03"
subsystem: database
tags: [sqlite, normalized-values, custom-fields, lifecycle, sweep]
requires:
  - phase: 16-custom-field-value-normalization
    provides: migration 006 normalized custom_field_values pairs and pair writers
provides:
  - Row-based custom-field creation, quarantine, deletion, and expiry lifecycle
  - Bound field-definition emptiness checks in the management screen
  - Normalized sweep regressions preserving expiry and restore-race behavior
affects: [custom-fields, custom-field-history, launch-sweep, backup-export]
actuals:
  tokens: 16111
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns:
    - Lifecycle writers compose non-mutexed pair cores inside one shared transaction.
    - field_history keeps col_name as a bound immutable compatibility key.
key-files:
  created: []
  modified:
    - src/db/field-ddl.ts
    - src/db/field-defs-dao.ts
    - src/screens/CustomFieldsScreen.tsx
    - src/services/field-sweep.test.ts
key-decisions:
  - "Permanent deletion snapshots non-NULL pair values under the immutable def col_name before deleting pairs and definition."
  - "Deleted custom-PHOTO fields may leave bounded local on-device orphans; existing contact purge cannot rediscover removed definitions."
  - "CustomFieldsScreen changes only its isFieldEmpty argument; its other lifecycle and preflight calls remain source-compatible."
patterns-established:
  - "Create fields by seeding durable NULL custom_field_values rows for every existing contact, including archived contacts."
requirements-completed: [CFN-02, CFN-04]
coverage:
  - id: D1
    description: Normalized custom-field create/delete/quarantine lifecycle preserves snapshots and durable blank pairs.
    requirement: CFN-02
    verification:
      - kind: unit
        ref: src/db/field-ddl.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Management screen calls the bound field-definition emptiness API without UI changes.
    requirement: CFN-02
    verification:
      - kind: other
        ref: npx tsc --noEmit && npm run check:colors
        status: pass
    human_judgment: false
  - id: D3
    description: Foreground field sweep retains strict 30-day expiry, history pruning, and the restore-race recheck.
    requirement: CFN-04
    verification:
      - kind: unit
        ref: src/services/field-sweep.test.ts
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-08-24
status: complete
---

# Phase 16 Plan 03: Normalized Field Lifecycle Summary

**Custom-field lifecycle now creates, reads, quarantines, expires, and permanently deletes normalized pair rows without runtime custom-field DDL.**

## Performance

- **Duration:** 9 min
- **Tasks:** 3/3
- **Files modified:** 7
- **Targeted verification:** 17 unit tests, TypeScript, and colour-token checks passed.

## Accomplishments

- Created definitions seed durable NULL value pairs for every existing contact, including archived contacts, under one serialized transaction.
- Permanent deletion snapshots non-NULL normalized values to `field_history`, deletes pairs before their definition atomically, and preserves quarantine/restore semantics.
- Re-keyed `isFieldEmpty` to a bound definition id, wired the sole management-screen caller, and retained strict expiry, history pruning, and restore-race safety in sweep coverage.

## Task Commits

1. **Task 1: Convert field creation and delete-or-quarantine decisions to normalized pairs** - `432eca7` (RED tests), `193614d` (implementation), `66716c3` (restored DAO coverage)
2. **Task 2: Wire CustomFieldsScreen to the re-keyed isFieldEmpty and audit its other reshaped calls** - `bceee3a`
3. **Task 3: Retain strict expiry and restore-race protection in the field sweep** - `0bc0da3`

## Files Created/Modified

- `src/db/field-ddl.ts` - Pair-row creation and atomic snapshot/delete lifecycle core.
- `src/db/field-defs-dao.ts` - Bound normalized `isFieldEmpty` read.
- `src/screens/CustomFieldsScreen.tsx` - Uses `d.id` for the emptiness check; all other audited DAO calls remain source-compatible.
- `src/db/field-ddl.test.ts`, `src/db/field-defs-dao.test.ts`, `src/services/field-sweep.test.ts` - Migration-006 lifecycle fixtures and regression coverage.

## Decisions Made

- `field_history.field_col_name` continues to store the immutable definition `col_name`, but no lifecycle SQL interpolates it.
- A permanently removed custom-PHOTO definition may leave one local file per contact. Existing purge cleanup enumerates only surviving definitions, so these bounded local orphans are not reclaimed until a future history-driven cleanup mechanism.
- The CustomFieldsScreen audit found only the `isFieldEmpty` argument change; Plan 04's wider preflight `Pick` still accepts the full definition objects already passed by the screen.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Subsequent custom-field lifecycle and type-change work can rely on one durable current-state pair per existing contact/definition, with no dynamic custom-field table alteration.

## Self-Check: PASSED

All six implementation/test files and the summary exist; all five task commits are present in git history.
