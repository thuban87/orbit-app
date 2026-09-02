---
phase: 03-custom-fields
plan: 02
subsystem: database
tags: [custom-fields, parsers, sortExpr, text-storage, sql-injection, node-sqlite, type-semantics]

# Dependency graph
requires:
  - phase: 03-custom-fields
    provides: "CustomFieldDef row type (field-types.ts), isSafeColName guard + col_name producer (col-name.ts), node:sqlite test harness (Plan 01)"
provides:
  - "parsers: Record<FieldType,…> — 7 permissive read-time validators returning ParseResult (accept-with-canonical-form or flag)"
  - "isValueInOptions(field, value) — pure dropdown option-membership check (out-of-list → flaggable; parsers.dropdown stays identity)"
  - "sortExpr(field) — the single, isSafeColName-guarded TEXT-leak point for every custom-field sort/filter"
  - "ParseResult type — the accept/flag contract consumed by the type-change pre-flight and value renderer"
affects: [03-custom-fields, 05, 06, 08, dashboard-sort, orrery-ordering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-time validators over TEXT-forever storage: parse to canonical form or FLAG, never rewrite/clear (T-03-04)"
    - "Single interpolation chokepoint: sortExpr is the ONLY sort/filter col_name interpolation site, isSafeColName-guarded then quoted (T-03-01)"
    - "Exhaustiveness by Record<FieldType,…>: an 8th field type without a parser fails tsc"

key-files:
  created:
    - src/db/field-parsers.ts
    - src/db/field-parsers.test.ts
    - src/db/field-sort.ts
    - src/db/field-sort.test.ts
  modified: []

key-decisions:
  - "parsers.dropdown stays identity; option-membership is a SEPARATE pure function (isValueInOptions) so the out-of-list tap-to-fix state is reachable without compromising the identity parser"
  - "isValueInOptions returns true for non-dropdown / empty / null-or-malformed options — never fabricate an error state from an unclassifiable input"
  - "sortExpr carries its OWN isSafeColName guard (throws) despite col_name being Plan-01-safe, because Phase-8/13 feed it defs from unknown provenance — it is the app-wide permanent sort/filter site"

patterns-established:
  - "Pattern: canonical parser output ('1'/'0', YYYY-MM-DD, String(n)) is chosen to match sortExpr's CAST expectations — parser and sort agree by construction"
  - "Pattern: TEXT-storage observability is confined to one auditable expression; filters reuse it (WHERE CAST(col AS REAL) > ?)"

requirements-completed: [FLD-04, FLD-06]

coverage:
  - id: D1
    description: "7 permissive target-type parsers, exhaustive over FieldType, never throwing or clearing; canonical forms for number/date/toggle"
    requirement: "FLD-04"
    verification:
      - kind: unit
        ref: "src/db/field-parsers.test.ts (20 tests: exhaustiveness, canonical forms, flag cases, never-throw on hostile input)"
        status: pass
    human_judgment: false
  - id: D2
    description: "isValueInOptions — pure dropdown membership so an out-of-list value is flaggable; true for non-dropdown/empty/unclassifiable"
    requirement: "FLD-04"
    verification:
      - kind: unit
        ref: "src/db/field-parsers.test.ts#isValueInOptions (membership, empty, non-dropdown, null/malformed options)"
        status: pass
    human_judgment: false
  - id: D3
    description: "sortExpr() — the single TEXT-leak point; numeric text sorts numerically via CAST REAL, toggle via CAST INTEGER, date/text bare quoted col; isSafeColName-guarded (throws on unsafe)"
    requirement: "FLD-06"
    verification:
      - kind: unit
        ref: "src/db/field-sort.test.ts (6 node:sqlite tests: numeric order 2/9/10, toggle 0<1, date ISO order, bare-column shape, guard rejection on quote/space)"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-08-15
status: complete
---

# Phase 3 Plan 02: Type-semantics primitives (7 parsers + sortExpr) Summary

**The 7 permissive read-time parsers (accept-to-canonical or flag, never rewrite), the pure `isValueInOptions` dropdown-membership check, and the single `isSafeColName`-guarded `sortExpr()` through which every custom-field sort/filter observes TEXT-forever storage.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-08-15T01:47:04Z
- **Completed:** 2026-08-15T01:49:20Z
- **Tasks:** 2
- **Files modified:** 4 (4 created)

## Accomplishments
- `parsers: Record<FieldType, (raw) => ParseResult>` — exactly 7 entries, one per TARGET type (not 42 pairwise converters). Each is a READ-TIME validator: it accepts a stored string into its canonical TEXT form (`"1"`/`"0"`, `YYYY-MM-DD`, `String(n)`) or returns `{ ok: false }` to FLAG. No parser throws and none ever clears or coerces a failing value (T-03-04 — the tap-to-fix signal, never data loss). Exhaustiveness is a compile-time guarantee via the `Record<FieldType,…>` type.
- `isValueInOptions(field, value)` — a PURE dropdown option-membership check added so the out-of-list tap-to-fix state is reachable while `parsers.dropdown` stays identity (review MED). Returns `true` for non-dropdown types, empty/null values, and null-or-malformed options (never fabricates an error from an unclassifiable input); reused by `CustomFieldValue` (Plan 06) and the options-change pre-flight (Plan 05/08).
- `sortExpr(field)` — the §14.2 switch verbatim (`number → CAST(col AS REAL)`, `toggle → CAST(col AS INTEGER)`, `date`/else → bare quoted col) and the SINGLE place TEXT storage is observable. It calls `isSafeColName` and THROWS on an unsafe name before double-quoting — the sole sort/filter interpolation site, guarded at the boundary because Phase-8/13 feed it defs of unproven provenance (T-03-01).
- node:sqlite tests prove ordering against REAL SQLite: numeric TEXT sorts `2, 9, 10` (not lexicographic `10, 2, 9`), toggle groups `0` before `1`, ISO dates sort chronologically as text, and the guard fires on a col_name containing a double-quote or a space.

## Task Commits

Each task was committed atomically:

1. **Task 1: The 7 permissive target-type parsers + isValueInOptions** — `8b8d641` (feat)
2. **Task 2: sortExpr() — the sole TEXT-leak point** — `3e9f456` (feat)

## Files Created/Modified
- `src/db/field-parsers.ts` (created) — `ParseResult` type, `parsers` record (7 permissive read-time validators), `isValueInOptions` membership check. Node-pure.
- `src/db/field-parsers.test.ts` (created) — 20 pure Vitest tests: exhaustiveness, canonical forms, flag cases, never-throw on hostile input, membership rules.
- `src/db/field-sort.ts` (created) — `sortExpr()`, the single isSafeColName-guarded sort/filter interpolation site. Node-pure.
- `src/db/field-sort.test.ts` (created) — 6 node:sqlite tests proving numeric/toggle/date ordering, bare-column shape, and guard rejection.

## Decisions Made
- **`parsers.dropdown` stays identity; membership is a separate function.** A value dropped from a dropdown's option list is not "invalid under the type" — it is an options mismatch. Keeping the parser identity and adding `isValueInOptions` lets the caller flag out-of-list values with the SAME tap-to-fix state without special-casing the parser (CONTEXT consistency rule).
- **`isValueInOptions` never fabricates an error.** Non-dropdown, empty/null value, and null-or-malformed `options` all return `true` — an unclassifiable input must not render as "wrong."
- **`sortExpr` carries its own guard.** Even though Plan 01 constructs every `col_name` safely, `sortExpr` is designated the permanent app-wide sort/filter interpolation site (Phase-8 dashboard, Phase-13 orrery), so it re-guards with `isSafeColName` and throws — provenance cannot be assumed forever.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Biome reformatted the two test files and `field-sort.ts` on `--write` (wrapped long call/throw expressions) — cosmetic only; all 26 tests re-run green afterward.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `parsers`, `ParseResult`, `isValueInOptions`, and `sortExpr` are exported and ready for: the type-change pre-flight (Plan 04/05 — partitions values via `parsers[target]`), `CustomFieldValue` rendering (Plan 06 — read-time flag state + `isValueInOptions`), the options-change pre-flight (Plan 05/08), and every custom-field sort/filter query (routes through `sortExpr`).
- Canonical parser output (`"1"`/`"0"`, `YYYY-MM-DD`, `String(n)`) is aligned with `sortExpr`'s CASTs; new toggle/number/date widget writes MUST use the same canonical forms so sorting stays correct.
- Zero new dependencies; both modules node-pure (no expo/react-native import). No blockers.

## Self-Check: PASSED

---
*Phase: 03-custom-fields*
*Completed: 2026-08-15*
