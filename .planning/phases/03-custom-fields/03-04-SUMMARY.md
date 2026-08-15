---
phase: 03-custom-fields
plan: 04
subsystem: database
tags: [sqlite, custom-fields, upsert, dynamic-sql, node-sqlite, visibility]

# Dependency graph
requires:
  - phase: 03-custom-fields (Plan 01)
    provides: inWriteTransaction (shared write-serialization boundary), isSafeColName (identifier guard), CustomFieldDef type, SqlExecutor contract
  - phase: 03-custom-fields (migration 001)
    provides: contact_custom_values table (contact_id PK, uid UNIQUE merge key, modified_at)
provides:
  - getValuesForContact — dynamic whitelist-built read of a contact's custom values
  - upsertValue — INSERT-or-UPDATE keyed on contact_id, serialized through the shared mutex
  - defsForCreateForm / defsForEditForm / visibleDefsForProfile — the three §14.7 placement selectors
affects: [phase-04-contact-crud, contact-profile, contact-forms]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic SELECT column list built ONLY from isSafeColName-guarded, double-quoted col_names; all runtime values ?-bound"
    - "Value UPSERT keyed on contact_id (ON CONFLICT DO UPDATE) inside the shared inWriteTransaction"
    - "Pure visibility selectors over already-loaded defs (+ value map) — no DB access, reusable by Phase 4 forms/profile"

key-files:
  created:
    - src/db/field-values-dao.ts
    - src/db/field-values-dao.test.ts
  modified: []

key-decisions:
  - "upsertValue runs inside inWriteTransaction, not as a bare UPSERT — serialized with DDL/sweep on the one connection (review HIGH-2a)"
  - "getValuesForContact early-returns {} for an empty defs array to avoid a malformed SELECT on a fresh install (review LOW)"
  - "uid is the contact_custom_values ROW uid (one per contact), written on INSERT only; DO UPDATE never rewrites it (review MED)"
  - "Profile visibility = value-present OR always_show; create = show_on_new; edit = all non-quarantined; quarantined hidden everywhere (§14.7)"

patterns-established:
  - "Single interpolation boundary: assertSafeCol throws on an unsafe col_name before any col reaches SQL"
  - "Selectors return a new display_order-sorted array and never mutate their input"

requirements-completed: [FLD-01, FLD-07]

coverage:
  - id: D1
    description: "getValuesForContact reads a contact's custom values via a whitelist-built dynamic SELECT; {} on empty defs and on an absent row"
    requirement: FLD-01
    verification:
      - kind: unit
        ref: "src/db/field-values-dao.test.ts#getValuesForContact — dynamic whitelist-built read (FLD-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "upsertValue INSERT-or-UPDATEs keyed on contact_id inside the shared mutex, always bumps modified_at, writes uid on INSERT only, and a per-contact uid works across contacts"
    requirement: FLD-01
    verification:
      - kind: unit
        ref: "src/db/field-values-dao.test.ts#upsertValue — INSERT-or-UPDATE keyed on contact_id (FLD-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The three §14.7 visibility selectors (create=show_on_new, edit=all non-quarantined, profile=value-present OR always_show) resolve exactly with quarantined fields hidden everywhere"
    requirement: FLD-07
    verification:
      - kind: unit
        ref: "src/db/field-values-dao.test.ts#visibility selectors — the three §14.7 surfaces (FLD-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Injection boundary — an unsafe col_name is rejected before reaching SQL in both read and UPSERT paths (T-03-01)"
    requirement: FLD-01
    verification:
      - kind: unit
        ref: "src/db/field-values-dao.test.ts#rejects an unsafe col_name"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-14
status: complete
---

# Phase 3 Plan 04: Per-contact custom-value read/UPSERT + field visibility Summary

**Whitelist-built dynamic read + contact_id-keyed UPSERT of `contact_custom_values` (serialized through the shared mutex), plus the three pure §14.7 placement selectors that decide where each custom field appears.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-14T21:00:00Z
- **Completed:** 2026-08-14T21:03:00Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `getValuesForContact(exec, contactId, defs)` — builds its SELECT column list only from `isSafeColName`-guarded, double-quoted col_names (contactId `?`-bound); returns `{}` for an empty defs array (fresh-install case, no malformed `SELECT  FROM …`) and for a contact with no value row yet.
- `upsertValue(exec, contactId, uid, colName, value, now)` — INSERT-or-UPDATE keyed on `contact_id` via `ON CONFLICT(contact_id) DO UPDATE`, wrapped in the shared `inWriteTransaction`; always bumps `modified_at`; writes `uid` on INSERT only (DO UPDATE never rewrites it).
- Three pure visibility selectors implementing HANDOFF §14.7 exactly: `defsForCreateForm` (show_on_new only), `defsForEditForm` (every non-quarantined field), `visibleDefsForProfile` (value-present OR always_show). Quarantined fields excluded from all three; each returns a new display_order-sorted array without mutating its input.
- Full `node:sqlite` proof over the real migration001 schema (17 tests), including the per-contact-uid-across-multiple-contacts case and the two T-03-01 injection-rejection cases; `tsc --noEmit` and `biome check` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: field-values-dao.ts — dynamic read + UPSERT** - `034e82d` (feat)
2. **Task 2: visibility selectors + full node:sqlite proof** - `ca0405e` (feat)

_Task 1's commit already included a passing test file so its verification gate was green; Task 2 extended both the DAO and the test file with the selectors and their proof._

## Files Created/Modified
- `src/db/field-values-dao.ts` - getValuesForContact, upsertValue, and the three §14.7 visibility selectors
- `src/db/field-values-dao.test.ts` - node:sqlite behavioural proof (17 tests)

## Decisions Made
None beyond the plan — every review-flagged contract (HIGH-2a mutex wrap, LOW empty-defs guard, MED uid contract, T-03-01/T-03-04 injection boundary) was implemented as specified.

## Deviations from Plan

None - plan executed exactly as written.

One structuring note (not a deviation): the plan listed `field-values-dao.test.ts` as a Task 2 artifact, but the Task 1 verification gate runs `vitest` on that file. To keep every atomic commit green, the read/UPSERT tests were written and committed alongside the Task 1 code, then Task 2 extended the same file with the selector/visibility tests. All plan-specified assertions are present.

## Issues Encountered
None. Biome reformatted long call/expression wrapping twice (auto-fixed with `biome check --write`); no logic changed.

## Known Stubs
None — every exported function is fully wired and proven against the real schema. Phase 4 is the primary creator of the `contact_custom_values` row; `upsertValue` creates the row on first custom value when absent (given the contact's own uid).

## Next Phase Readiness
- Phase 4's contact forms/profile can call `defsForCreateForm` / `defsForEditForm` / `visibleDefsForProfile` with already-loaded defs, and `getValuesForContact` / `upsertValue` for the value layer.
- Caller contract to honour: mint ONE per-contact uid (e.g. `newUid()` once per contact) and pass the contact's own uid to `upsertValue` — never a fresh uid per write (a per-field uid collides on `UNIQUE(uid)` and RAISES rather than taking the DO UPDATE branch).

## Self-Check: PASSED

- FOUND: src/db/field-values-dao.ts
- FOUND: src/db/field-values-dao.test.ts
- FOUND: .planning/phases/03-custom-fields/03-04-SUMMARY.md
- FOUND commit: 034e82d (Task 1)
- FOUND commit: ca0405e (Task 2)

---
*Phase: 03-custom-fields*
*Completed: 2026-08-14*
