---
phase: 34-rapid-capture-update-flows
plan: 05
subsystem: database
tags: [sqlite, contacts-dao, edit-contact, knowledge-subdomains, data-revision, adr-016]

# Dependency graph
requires:
  - phase: 34-03
    provides: "createContactFullCore enrichment composition + applyContactMethodDiffCore bumpRevision param + Create*Input semantic shapes"
provides:
  - "updateContactFull persists the FIVE editable knowledge subdomains (Memories, Key People/Relationships, Last Talked About, Current Location, Off Limits) atomically inside its single metadata transaction"
  - "UpdateContactFullInput extended with optional memories/relationships/currentStateEntries/offLimits diffs (KnowledgeCollectionDiff contract)"
  - "updateContactFull is the SOLE data_revision bumper for the composed edit (exactly-once, no under- or double-bump)"
  - "deleteFuelCore gains an optional bumpRevision param (default true) so an aggregate composer can suppress the tombstone self-bump"
  - "edit-contact-logic.buildEditInput assembles the seed-vs-draft {add,edit,delete} knowledge diffs (kind-scoped off_limits) + resolveErrorSection/EDIT_SECTION_FIELD_MAP/collectEditBlockingErrors"
affects: [34-08, edit-contact-screen, contact-knowledge, backup-freshness]

actuals:
  tokens: 11500
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Edit-path knowledge composition mirrors 34-03's create-path createContactFullCore enrichment: compose exec-scoped *Core writers inside ONE inWriteTransaction (ADR-016), single data_revision bump"
    - "Pinned {add,edit,delete} diff contract: the LOGIC layer computes lists keyed by row-identity id; the DAO applies and never re-diffs"
    - "Kind-scoped fuel diff (off_limits only) on both diff sides to prevent shared-table data loss"

key-files:
  created: []
  modified:
    - src/db/contacts-dao.ts
    - src/db/contacts-dao.test.ts
    - src/db/fuel-dao.ts
    - src/screens/edit-contact-logic.ts
    - src/screens/edit-contact-logic.test.ts

key-decisions:
  - "updateContactFull made the SOLE data_revision bumper: passes bumpRevision:false to applyContactMethodDiffCore and bumps exactly once — closes the knowledge-only under-bump and method double-bump gaps (Review cycle-3 MEDIUM)"
  - "deleteFuelCore composed with bumpRevision:false in the aggregate so an Off-Limits-delete edit advances data_revision by exactly 1 (Review cycle-4 MEDIUM #2)"
  - "Off Limits diff kind-scoped to off_limits on BOTH sides (seed filtered + adds/edits forced) so recent/topic/fact/gift fuel is never computed as a delete (Review cycle-4 MEDIUM #3, DATA LOSS)"
  - "Current-state values write via setCurrentStateValueCore only when changed from the stored current value (no spurious history row); clearing is out of scope, matching the create path"
  - "CAPT-04 NOT marked complete: 34-05 delivers the persistence foundation; the user-facing IA screen (top-level accordion sections) is 34-08, which consumes this DAO"

patterns-established:
  - "KnowledgeCollectionDiff<TAdd,TEdit> — the reusable {add,edit,delete} edit-diff shape keyed by row-identity id"
  - "diffKnowledgeCollection(seed, draft, toAdd, toEdit) — pure seed-vs-draft diff (signature comparison) returning undefined when untouched"

requirements-completed: []  # CAPT-04 is advanced (persistence foundation) but completes in 34-08 (IA screen)

coverage:
  - id: D1
    description: "updateContactFull persists a Memories add/edit/delete atomically inside its single edit transaction, round-tripping through listMemoriesForContact"
    requirement: "CAPT-04"
    verification:
      - kind: unit
        ref: "src/db/contacts-dao.test.ts#updateContactFull — Memories knowledge subdomain (CAPT-04, §E)"
        status: pass
    human_judgment: false
  - id: D2
    description: "updateContactFull persists Relationships, Last Talked About, Current Location, and kind-scoped Off Limits in the same transaction; off-limits edit leaves other fuel kinds intact; exactly-once data_revision bump; atomic rollback"
    requirement: "CAPT-04"
    verification:
      - kind: unit
        ref: "src/db/contacts-dao.test.ts#updateContactFull — remaining knowledge subdomains (CAPT-04, §E)"
        status: pass
      - kind: unit
        ref: "src/db/fuel-dao.test.ts (deleteFuelCore default bumpRevision preserved)"
        status: pass
    human_judgment: false
  - id: D3
    description: "edit-contact-logic.buildEditInput assembles the seed-vs-draft knowledge diffs (kind-scoped off_limits) and resolveErrorSection maps errors to sections"
    requirement: "CAPT-04"
    verification:
      - kind: unit
        ref: "src/screens/edit-contact-logic.test.ts#buildEditInput — knowledge-subdomain diffs (CAPT-04, §E)"
        status: pass
      - kind: unit
        ref: "src/screens/edit-contact-logic.test.ts#resolveErrorSection + collectEditBlockingErrors (reveal-and-focus)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-12
status: complete
---

# Phase 34 Plan 05: Edit Contact Knowledge Persistence Summary

**`updateContactFull` now persists the complete canonical editable record (dossier §E) — all five knowledge subdomains (Memories, Key People/Relationships, Last Talked About, Current Location, Off Limits) atomically inside its single metadata transaction, mirroring 34-03's create-path enrichment, with exactly-once backup-freshness bumping and a kind-scoped off-limits diff that cannot destroy other fuel kinds.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-12T21:50Z (approx)
- **Completed:** 2026-09-12
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Extended `updateContactFull`/`UpdateContactFullInput` to compose the five knowledge subdomains' exec-scoped `*Core` writers inside the ONE existing `inWriteTransaction` (ADR-016) — no new transaction, no mutexed wrapper, no migration.
- Made `updateContactFull` the sole `data_revision` bumper (bumps exactly once; passes `bumpRevision:false` to the method diff and to the composed off-limits `deleteFuelCore`), closing the knowledge-only under-bump and the off-limits-delete double-bump.
- Kind-scoped the Off Limits diff to `off_limits` on both sides so a contact's `recent`/`topic`/`fact`/`gift` fuel can never be computed as a delete (proven by a preservation test).
- `edit-contact-logic.buildEditInput` now assembles the pinned `{add,edit,delete}` knowledge diffs from seed-vs-draft, and re-exposes the shared `resolveErrorSection` plus `EDIT_SECTION_FIELD_MAP`/`collectEditBlockingErrors` for 34-08's reveal-and-focus.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): updateContactFull persists Memories end-to-end** - `6745656` (feat)
2. **Task 2: persist the remaining four subdomains + deleteFuelCore bumpRevision** - `81e2982` (feat)
3. **Task 3: edit-contact-logic diff assembly + resolveErrorSection** - `49ca6d1` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/db/contacts-dao.ts` - `KnowledgeCollectionDiff` + patch types; `UpdateContactFullInput` extended; `applyKnowledgeDiffsCore` composed in the single edit transaction; sole-bumper contract.
- `src/db/contacts-dao.test.ts` - per-subdomain round-trip, atomic rollback, exactly-once bump, single-BEGIN, kind-scoped data-loss guard (+11 tests).
- `src/db/fuel-dao.ts` - `deleteFuelCore` optional `bumpRevision` param (default true) threaded to `insertTombstoneCore`.
- `src/screens/edit-contact-logic.ts` - draft-row types, `diffKnowledgeCollection`, kind-scoped off_limits assembly, current-state change detection, `resolveErrorSection` re-export + edit section map.
- `src/screens/edit-contact-logic.test.ts` - assembly (untouched→omitted, add/edit/delete keying), kind-scoping, error→section (+ tests).

## Decisions Made
See `key-decisions` in the frontmatter. Notably: CAPT-04 is intentionally left unchecked — 34-05 is the persistence foundation; the user-facing IA screen (34-08) completes the requirement.

## Deviations from Plan

None material to behavior — plan executed as written. Two mechanical notes:

- **[Rule 3 - Blocking] fuel-dao `deleteFuelCore` param landed with Task 2, not split earlier.** The plan lists `src/db/fuel-dao.ts` under Task 2; the Task 1 DAO helper was trimmed to memories-only so the `bumpRevision` param (Task 2 territory) was not referenced until Task 2, keeping each commit self-consistent and compiling.
- **[Rule 1 - Nit] Biome export ordering** in `edit-contact-logic.ts` auto-fixed with `biome check --write` (scoped to the one file; HEAD had zero errors on it, so only the new re-export ordering was touched).

## Issues Encountered

**Pre-existing, out-of-scope test-suite failure (Phase 30 orrery).** `npm test` reports `1 failed | 346 passed` suites (all 3250 individual tests pass). The failing suite is `src/components/orrery/orrery-controls-render.test.tsx` (`SyntaxError: Unexpected token 'typeof'`), last touched in commit `5d38954` (Phase 29-11), untouched by 34-05, and failing identically in isolation. Logged to `.planning/phases/34-rapid-capture-update-flows/deferred-items.md`; already flagged in STATE.md for independent Phase-30 reconciliation. Not fixed (scope boundary).

## Verification

- `npx vitest run src/db/contacts-dao.test.ts` — pass (66 tests)
- `npx vitest run src/db/fuel-dao.test.ts` — pass
- `npx vitest run src/screens/edit-contact-logic.test.ts` — pass (29 tests)
- `npx tsc --noEmit` — exit 0
- `npm run check:colors` — exit 0
- `grep -cE "ALTER TABLE|migration0" src/db/contacts-dao.ts` → 0 (no migration authored)
- `grep -c "setCurrentStateValueCore\|addRelationshipCore\|addFuelCore" src/db/contacts-dao.ts` → 10 (≥3)
- Full `npm test`: 3250/3250 tests pass; 1 pre-existing unrelated suite load-failure (orrery, above).

## Known Stubs

None. Every knowledge subdomain has a real, tested write path and round-trip assertion.

## Self-Check: PASSED
