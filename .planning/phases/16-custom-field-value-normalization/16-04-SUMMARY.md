---
phase: 16-custom-field-value-normalization
plan: "04"
subsystem: database
tags: [sqlite, custom-fields, normalized-values, type-change, sorting]
requires:
  - phase: 16-01
    provides: migration 006 normalized custom-field value rows
  - phase: 16-02
    provides: normalized custom-value DAO patterns
provides:
  - Bound field_def_id type/options preflight and audit snapshot queries
  - Static normalized-value sort expression with a documented join constraint
affects: [custom-fields, future-sort-filter-consumers, audit-history]
actuals:
  tokens: 9208
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - Bind normalized field_def_id values instead of interpolating col_name metadata.
    - Keep sort expressions static over the values_table.value alias.
key-files:
  created: []
  modified:
    - src/db/field-type-change.ts
    - src/db/field-type-change.test.ts
    - src/db/field-sort.ts
    - src/db/field-sort.test.ts
key-decisions:
  - "Retained field-object preflight APIs while widening their Pick to id and col_name."
  - "Retained col_name only for field_history compatibility; no col_name reaches SQL."
  - "Kept sortExpr latent and raw-TEXT based, requiring a future field_def_id-constrained join."
patterns-established:
  - "Normalized value reads select literal columns and bind field_def_id."
requirements-completed: [CFN-02, CFN-03, CFN-04]
coverage:
  - id: D1
    description: Type and options preflights preserve parser-driven raw normalized values and type-change audit history.
    requirement: CFN-02
    verification:
      - kind: unit
        ref: npm test -- src/db/field-type-change.test.ts src/db/field-parsers.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: false
  - id: D2
    description: sortExpr emits static normalized value SQL and ignores hostile col_name metadata.
    requirement: CFN-03
    verification:
      - kind: unit
        ref: npm test -- src/db/field-sort.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: false
  - id: D3
    description: Type changes retain immutable normalized value identities and field_history col_name compatibility keys.
    requirement: CFN-04
    verification:
      - kind: unit
        ref: src/db/field-type-change.test.ts#snapshots target raw values under col_name without changing value bytes or uids
        status: pass
    human_judgment: false
duration: 3min
completed: 2026-08-25
status: complete
---

# Phase 16 Plan 04: Custom Field Value Normalization Summary

**Type-change preflight and history now operate on bound normalized value rows, while sortExpr emits a fixed raw-TEXT expression for a future field-scoped join.**

## Performance

- **Duration:** 3 min
- **Tasks:** 2/2
- **Files modified:** 4
- **Verification:** 41 focused tests passed; TypeScript compilation passed.

## Accomplishments

- Re-keyed type and options preflights to `custom_field_values`, binding `field_def_id` and retaining the existing full-field call shape.
- Snapshotted only the selected field's non-null raw values under the durable `field_history.field_col_name` compatibility key, without rewriting values or their UIDs.
- Replaced dynamic sort-column interpolation with static `values_table.value` SQL, preserving number/toggle casts and raw text behavior for all other types.
- Documented that `sortExpr` is latent and that its first consumer must constrain `field_def_id` in the `values_table` join.

## Task Commits

1. **Task 1 RED: normalized type-change regressions** — `64af055` (`test`)
2. **Task 1 GREEN: normalized type-change preflights** — `b7f4443` (`feat`)
3. **Task 2 RED: static normalized sort expressions** — `fd01e46` (`test`)
4. **Task 2 GREEN: static sort expressions** — `cb46746` (`feat`)

## Decisions Made

- `preflightTypeChange` and `preflightOptionsChange` accept `Pick<CustomFieldDef, "id" | "col_name">`, preserving existing callers that pass a full definition.
- `col_name` remains history compatibility metadata, not SQL syntax.
- `sortExpr` uses the literal `values_table` alias and intentionally preserves raw-TEXT ordering without duplicating JavaScript parsers in SQL.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The expected RED tests failed before implementation because the old dynamic-column queries referenced the retired table; all focused tests pass after the normalized queries were introduced.

## Known Stubs

None.

## Next Phase Readiness

Future sort/filter consumers can use `sortExpr` only with `custom_field_values AS values_table` and a field_def_id-constrained join. Type-change flows now preserve raw values and immutable value identities on the normalized store.

## Self-Check: PASSED

- All four owned source/test files exist.
- All four TDD commits are present in Git history.
- No stub patterns found in owned files; no unrun verification remains.
