---
phase: 03-custom-fields
plan: 05
subsystem: database
tags: [sqlite, custom-fields, type-change, field-history, node-sqlite, preflight]

# Dependency graph
requires:
  - phase: 03-custom-fields (Plan 01)
    provides: inWriteTransaction (shared write-serialization boundary), isSafeColName (identifier guard), CustomFieldDef type, SqlExecutor contract
  - phase: 03-custom-fields (Plan 02)
    provides: parsers (7 read-time target parsers), isValueInOptions (dropdown membership)
  - phase: 03-custom-fields (migration 001)
    provides: custom_field_defs (type column), contact_custom_values (TEXT value columns), field_history (contact_id, field_col_name, old_value, operation, created_at)
provides:
  - preflightTypeChange — read-only convert/flag partition of stored values via the target parser
  - preflightOptionsChange — read-only keep/flag partition via isValueInOptions against the new options
  - applyTypeChange — UPDATE defs.type ONLY + same-transaction field_history audit snapshot; contact_custom_values never touched
affects: [phase-03-plan-08 (field editor / options edit), contact-profile (tap-to-fix flag rendering)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type change = ONE UPDATE custom_field_defs SET type; value columns are never rewritten (blast radius zero, §14.2)"
    - "Read-only pre-flight partitions stored values into convert/flag (type) or keep/flag (options) with NO transaction and NO write"
    - "field_history has no type column — the transition is encoded in operation (type_change:<old>-><new>), snapshotted in the same txn as the defs UPDATE"

key-files:
  created:
    - src/db/field-type-change.ts
    - src/db/field-type-change.test.ts
  modified: []

key-decisions:
  - "applyTypeChange writes exactly two statements — a field_history snapshot SELECT + UPDATE defs.type — inside ONE inWriteTransaction; contact_custom_values is untouched (T-03-02, §14.2)"
  - "The pre-change type is carried in the applyTypeChange signature (field.type) and encoded into operation because field_history has no type column (review MED)"
  - "Both pre-flights are strictly read-only (no BEGIN, no write) — Plan 08 runs them before committing an edit; the actual UPDATE options lives in changeFieldOptions (Plan 03), not here"
  - "Unconvertible values are FLAGGED (tap-to-fix), never coerced or cleared — the byte-identical-values invariant is asserted with hex() serialization"

patterns-established:
  - "Shared readValues helper: one guarded, double-quoted col_name read feeds both pre-flights"
  - "Byte-identical proof via hex(col) before/after the apply — asserts storage bytes, not merely equal strings"

requirements-completed: [FLD-04]

coverage:
  - id: D1
    description: "preflightTypeChange partitions stored values into convert (parse-clean under target) vs flag (unconvertible) via parsers[target], writing nothing"
    requirement: FLD-04
    verification:
      - kind: unit
        ref: "src/db/field-type-change.test.ts#preflightTypeChange — read-only convert/flag partition (FLD-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "preflightOptionsChange partitions stored values into keep vs flag by isValueInOptions against the NEW options, writing nothing"
    requirement: FLD-04
    verification:
      - kind: unit
        ref: "src/db/field-type-change.test.ts#preflightOptionsChange — read-only keep/flag by option membership"
        status: pass
    human_judgment: false
  - id: D3
    description: "applyTypeChange sets defs.type, snapshots the pre-change state to field_history (operation type_change:<old>-><new>) in the same txn, and leaves contact_custom_values value bytes BYTE-IDENTICAL"
    requirement: FLD-04
    verification:
      - kind: unit
        ref: "src/db/field-type-change.test.ts#applyTypeChange — defs.type UPDATE + same-txn snapshot, values untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "Only non-null values are snapshotted (a contact with no value gets no history row)"
    requirement: FLD-04
    verification:
      - kind: unit
        ref: "src/db/field-type-change.test.ts#snapshots ONLY non-null values"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-14
status: complete
---

# Phase 3 Plan 05: Type-change layer (FLD-04) Summary

**A read-only pre-flight that partitions a field's stored values into convert-vs-flag under the target parser (and keep-vs-flag for dropdown-option edits), plus an apply step that is ONE `UPDATE custom_field_defs SET type` and a same-transaction `field_history` audit snapshot — with `contact_custom_values` never touched (blast radius zero).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-14T21:05:00Z
- **Completed:** 2026-08-14T21:09:00Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `preflightTypeChange(exec, field, target)` — READ-ONLY. Reads every non-null stored value (col_name guarded + double-quoted), runs `parsers[target]` on each, and partitions the owning contact_ids into `convert` (parse-clean under the new type — already valid at read time) vs `flag` (unconvertible → the tap-to-fix error state). Opens no transaction and writes nothing; produces the §14.4 UI summary.
- `preflightOptionsChange(exec, field, nextOptions)` — READ-ONLY sibling for dropdown-option edits (review MED). Partitions on `isValueInOptions({ type: 'dropdown', options: nextOptions }, value)` into `keep` vs `flag` so an options edit shows the SAME convert/flag summary and renders out-of-list values as the same tap-to-fix state. Writes nothing.
- `applyTypeChange(exec, field, target, now)` — inside ONE `inWriteTransaction`: (a) INSERT one `field_history` row per contact with a non-null value capturing the pre-change `old_value` and `operation = type_change:<old>-><new>` (the transition, since `field_history` has no type column); (b) `UPDATE custom_field_defs SET type = ?, modified_at = ?`. That is the ENTIRE write — no `contact_custom_values` UPDATE, no ALTER COLUMN, no value normalization.
- `node:sqlite` proof over the real migration001 schema (7 tests), including the load-bearing **byte-identical value-column assertion** (via `hex(col)` before/after the apply) that forbids any value rewrite, and the read-only "writes nothing" assertions for both pre-flights. `tsc --noEmit` and `biome check` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2 implementation: field-type-change.ts** - `475ee21` (feat) — the two read-only pre-flights and `applyTypeChange`
2. **Task 2 proof: field-type-change.test.ts** - `a9d3c1a` (test) — node:sqlite behavioural proof incl. the blast-radius-zero byte-identical assertion

_The two plan tasks share one module (`field-type-change.ts`), so the source was committed as one atomic feat and the test proof as its own commit. See the structuring note under Deviations._

## Files Created/Modified
- `src/db/field-type-change.ts` - preflightTypeChange, preflightOptionsChange, applyTypeChange
- `src/db/field-type-change.test.ts` - node:sqlite proof (7 tests)

## Decisions Made
None beyond the plan. Every plan-specified contract was implemented as written: the pre-change type is carried in the `applyTypeChange` signature and encoded into `operation`; the pre-flights stay strictly read-only; the byte-identical invariant is asserted; unconvertible values are flagged, never cleared.

## Deviations from Plan

None - plan executed exactly as written.

One structuring note (not a deviation): the plan splits the work into Task 1 (pre-flights) and Task 2 (`applyTypeChange` + test), but all three functions live in one module `field-type-change.ts`. Git stages whole files, so the source module was committed as one atomic `feat` and the test as its own `test` commit. Both Task 1 and Task 2 verification gates (vitest + tsc + biome) were run green before committing. All plan-specified assertions are present.

## Issues Encountered
None. Biome reformatted long call/parameter wrapping once (auto-fixed with `biome check --write`); no logic changed, and tests were re-run green after the reformat.

## Known Stubs
None — every exported function is fully wired and proven against the real schema. The `photo` parser remains an identity pass-through (native picker deferred to Phase 5, per Plan 02), which does not affect the type-change layer.

## Threat Model Coverage
- **T-03-02 (data loss on type change, high)** — mitigated and tested: the byte-identical `hex(col)` assertion forbids any `contact_custom_values` write; the unconvertible `"about 60k"` value survives untouched after a number→text change.
- **T-03-03 (history/defs consistency, medium)** — mitigated: the `field_history` snapshot and the `defs` UPDATE share one `inWriteTransaction` (both or neither).
- **T-03-01 (col_name injection, high)** — mitigated: `col_name` is guarded by `isSafeColName` and double-quoted at every interpolation site; every runtime value is `?`-bound.

No new security surface introduced beyond the plan's threat model — no threat flags.

## Next Phase Readiness
- Plan 08's field editor calls `preflightTypeChange` / `preflightOptionsChange` to show the convert/flag summary before committing, then `applyTypeChange` (type edits) or `changeFieldOptions` (option edits, Plan 03) to persist.
- The contact profile (Phase 4+) renders `flag`-partitioned contact values as the tap-to-fix error state; clean/`convert` values render through the widget + `sortExpr` with no rewrite.

## Self-Check: PASSED

- FOUND: src/db/field-type-change.ts
- FOUND: src/db/field-type-change.test.ts
- FOUND: .planning/phases/03-custom-fields/03-05-SUMMARY.md
- FOUND commit: 475ee21 (Task 1 implementation)
- FOUND commit: a9d3c1a (Task 2 proof)

---
*Phase: 03-custom-fields*
*Completed: 2026-08-14*
