---
phase: 30-orrery-systems
plan: "03"
subsystem: database
tags: [sqlite, systems, orrery, transactions, backup-policy]
requires:
  - phase: 30-orrery-systems
    provides: Durable System tables, ref grammar, cross-catalog name checks, and resolver reads
provides:
  - Guarded custom-System lifecycle and uid-stable Undo restoration
  - Atomic custom-definition and immutable-base override persistence
  - Validated System visibility and ordering preferences
affects: [30-06-systems-management, 30-07-manage-members, 30-08-system-builder, 30-36-backup]
actuals:
  tokens: 10246
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns:
    - Public System writers wrap a non-mutexed Core function in exactly one inWriteTransaction
    - Every ref-keyed System write validates the complete live catalog before persistence
key-files:
  created: []
  modified:
    - src/db/systems-dao.ts
    - src/db/systems-dao.test.ts
    - src/backup/phase-17-integration.test.ts
key-decisions:
  - "Deleted System snapshots preserve the custom uid and portable dependent values so Undo never replays stale local row ids."
  - "Systems remain explicitly non-mergeable until Phase 36 adds their owner-approved backup wire format."
patterns-established:
  - "Use Core helpers only inside System save composites; public DAO wrappers cannot be composed because the shared write mutex is non-reentrant."
  - "All Contacts is persisted at display order zero even when omitted from a submitted reorder list."
requirements-completed: [ORRS-02, ORRS-03, ORRS-09, ORRS-10]
coverage:
  - id: D1
    description: Guarded System lifecycle supports rename, contact-safe delete, uid-stable restore, and override reset.
    requirement: ORRS-10
    verification:
      - kind: unit
        ref: src/db/systems-dao.test.ts#deletes only System metadata and restores a uid-stable portable snapshot
        status: pass
    human_judgment: false
  - id: D2
    description: Any System kind duplicates into an editable custom definition, including All Contacts population scope.
    requirement: ORRS-03
    verification:
      - kind: integration
        ref: src/db/systems-dao.test.ts#duplicates All Contacts with scope:population and resolves the same members
        status: pass
    human_judgment: false
  - id: D3
    description: Custom definition saves and built-in/Category override-only saves are atomic and immutable-base safe.
    requirement: ORRS-02
    verification:
      - kind: unit
        ref: src/db/systems-dao.test.ts#saves custom definitions atomically and immutable-base overrides without mutating base rows
        status: pass
    human_judgment: false
  - id: D4
    description: Hide/show and reorder accept only the live catalog and preserve All Contacts as pinned first.
    requirement: ORRS-09
    verification:
      - kind: unit
        ref: src/db/systems-dao.test.ts#reorders a validated catalog while keeping All Contacts at order zero
        status: pass
    human_judgment: false
duration: 11min
completed: 2026-09-08
status: complete
---

# Phase 30 Plan 03: Systems DAO Summary

**A transaction-safe Systems DAO now owns lifecycle, duplication, override, visibility, and ordering writes without touching contacts.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-08T20:26:01Z
- **Completed:** 2026-09-08T20:36:59Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added custom-System rename/delete/Undo with CI name protection, immutable-base guards, portable snapshots, and stable `custom:<uid>` replay.
- Added deterministic cross-catalog duplication plus atomic custom-definition and built-in/Category override-only save composites.
- Added complete-catalog validation for every ref-keyed write, hide/show boundaries, and All-Contacts-pinned ordering.

## Task Commits

1. **Task 1: Rename, delete-with-fallback, override reset, immutability guards** — `f53fa0d`
2. **Task 2: Duplicate (deterministic naming) + built-in/Category predicate → editable rules** — `68fb560`
3. **Task 3: Reorder + hide/show over system_prefs (All Contacts protected)** — `da3548a`
4. **Backup integrity correction** — `09d0d23`

## DAO Surface for Consumer Plans

- Management (Plan 06): `renameSystem(exec,{systemRef,name,now})`, `deleteSystem(exec,{systemRef})`, `restoreDeletedSystem(exec,{snapshot,now})`, `duplicateSystem(exec,{systemRef,now})`, `reorderSystems(exec,{orderedRefs,now})`, `setSystemHidden(exec,{systemRef,hidden,now})`, and `resetSystemOverrides(exec,{systemRef})`.
- Manage Members (Plan 07): `setSystemOverride(exec,{systemRef,contactId,mode,now})` where `mode` is `include`, `exclude`, or `null` to delete.
- Builder (Plan 08): `saveSystemDefinition(exec,{systemRef:null|customRef,name,rules,overrideIntent,prunableExclusionContactIds,now})` for custom definitions; `saveMembershipOverrides(exec,{systemRef,overrideIntent,prunableExclusionContactIds,now})` for built-in/Category override-only saves.
- Every ref-keyed writer calls `assertKnownSystemRef`; it accepts built-in, live Category, and existing custom refs, and rejects phantom refs before an override or preference row can be created.

## Decisions Made

- `DeletedSystemSnapshot` is portable: `{ uid, name, rules: [{family,value}], overrides: [{contactId,mode}], prefs: {displayOrder,hidden} | null }`. Restore retains `uid`, takes the new `systems.id`, and uses that new id for every rule.
- `builtin:all-contacts` duplicates to the explicit `scope:population` rule, not an empty rule set, so it keeps the exact population membership semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Declared the temporary Systems backup merge policy**
- **Found during:** Overall verification
- **Issue:** The backup hard-delete coverage test correctly rejected new `system_overrides` deletion without a tombstone or explicit policy.
- **Fix:** Marked all four Systems tables explicitly non-mergeable until the already-planned Phase 36 serialization work, without changing the format-4 wire or inventing unsupported tombstones.
- **Files modified:** `src/backup/phase-17-integration.test.ts`
- **Verification:** `npx vitest run src/backup/phase-17-integration.test.ts` passed.
- **Commit:** `09d0d23`

**Total deviations:** 1 auto-fixed (Rule 3 - blocking verification failure)

## Known Stubs

None.

## Verification

- `npx vitest run src/db/systems-dao.test.ts` — passed (13 tests).
- `npx vitest run src/backup/phase-17-integration.test.ts` — passed (3 tests).
- `npx biome lint src/db/systems-dao.ts src/db/systems-dao.test.ts src/backup/phase-17-integration.test.ts` — passed.
- `npx tsc --noEmit -p tsconfig.json` — passed.
- DAO-only grep over `src/components` and `src/screens` — no Systems `INSERT`, `UPDATE`, or `DELETE` found.
- `npm test` — Plan 03 tests passed, but the suite remains non-green only because the pre-existing `restore-apply.test.ts` and `orrery-system-store.test.ts` React Native Flow parser imports fail. The new backup-policy failure was fixed and its isolated suite passes.

## Next Phase Readiness

Plans 06, 07, and 08 can call the documented DAO surface without nesting write transactions. Phase 36 must replace the temporary non-mergeable Systems policy with the planned serialized backup entities.

## Self-Check: PASSED

- Verified `src/db/systems-dao.ts`, `src/db/systems-dao.test.ts`, and `src/backup/phase-17-integration.test.ts` exist.
- Verified commits `f53fa0d`, `68fb560`, `da3548a`, and `09d0d23` exist in git history.

*Phase: 30-orrery-systems*
*Completed: 2026-09-08*
