---
phase: 04-contact-crud-lifecycle
plan: 05
subsystem: database
tags: [sqlite, dao, crud, recency, single-writer, tdd, expo-sqlite]

# Dependency graph
requires:
  - phase: 04-contact-crud-lifecycle (Plan 02)
    provides: "composed-core pattern (updateContactMetadataCore-style cores), recomputeLastContactCore + insertInteractionCore aliases, upsertValueCore, createContactFull, getContactHeader/isDuplicateName reads"
provides:
  - "updateContactFull — atomic contact-metadata edit writer (every contacts column EXCEPT last_contact) with conditional rarely_responds recompute + optional never-contacted-only first-interaction, all in ONE inWriteTransaction"
  - "updateContactMetadataCore — non-mutexed metadata UPDATE core (last_contact omitted), assertOneChange-guarded"
  - "getContactForEdit — edit-form initial-values assembly (contacts row incl. last_contact + category label + custom-value map)"
  - "ContactEditRow / ContactForEdit / UpdateContactFullInput types for the Plan 06 edit UI"
affects: [04-06 (edit form UI wires to updateContactFull + getContactForEdit), 04-08 (archived list), phase-6 (interaction log — owns already-contacted timeline edits)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compose extracted non-mutexed *Core functions inside ONE inWriteTransaction; never nest the non-reentrant mutex"
    - "Metadata edit routes recency changes through the single writer (recomputeLastContactCore) — never a direct last_contact UPDATE (DATA-04)"
    - "Read stored flag/last_contact FIRST inside the txn to (a) detect a rarely_responds flip and (b) enforce the never-contacted-only firstInteraction rule at the write boundary"

key-files:
  created: []
  modified:
    - "src/db/contacts-dao.ts — updateContactMetadataCore + updateContactFull + UpdateContactFullInput"
    - "src/db/contact-read.ts — getContactForEdit + ContactEditRow + ContactForEdit"
    - "src/db/contacts-dao.test.ts — edit/recompute/first-interaction/reject/rollback assertions"
    - "src/db/contact-read.test.ts — getContactForEdit assembly assertions"

key-decisions:
  - "updateContactFull's metadata UPDATE OMITS last_contact entirely; last_contact moves only via recomputeLastContactCore (single-writer DATA-04)"
  - "recompute fires iff incoming rarely_responds differs from the STORED value OR a first interaction was just inserted — read stored value before the UPDATE"
  - "firstInteraction honoured ONLY when stored last_contact IS NULL (re-checked inside the txn; throw→rollback for an already-contacted contact — timeline edits stay Phase 6); future occurredAt rejected pre-transaction"
  - "getContactForEdit by-id seek intentionally NOT archived_at-filtered (archived-reachable by design, documented) — archived-read reconciliation, Plan 05"

patterns-established:
  - "Metadata-edit core/wrapper: non-mutexed core UPDATE + composed wrapper transaction, mirroring create's composition contract"
  - "Order inside the edit txn: read stored → metadata UPDATE (writes new flag) → custom values → firstInteraction (never-contacted gate) → conditional recompute (reads new flag)"

requirements-completed: [CRUD-03]

coverage:
  - id: D1
    description: "updateContactFull edits every contacts column except last_contact atomically; last_contact untouched when rarely_responds unchanged"
    requirement: "CRUD-03"
    verification:
      - kind: unit
        ref: "src/db/contacts-dao.test.ts#updateContactFull — metadata edit (every col except last_contact)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A rarely_responds flip (1→0 and 0→1) recomputes last_contact through the single writer in the same transaction (Pitfall 2)"
    requirement: "CRUD-03"
    verification:
      - kind: unit
        ref: "src/db/contacts-dao.test.ts#updateContactFull — rarely_responds flip recomputes last_contact (Pitfall 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Never-contacted first-interaction-on-edit writes one manual/direction-null interaction via the single writer; already-contacted rejects (rollback); future occurredAt rejected pre-txn"
    requirement: "CRUD-03"
    verification:
      - kind: unit
        ref: "src/db/contacts-dao.test.ts#updateContactFull — first-interaction-on-edit (owner ruling 2026-08-14)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mid-composition failure (bad custom-value column) rolls back the whole edit — metadata row unchanged"
    requirement: "CRUD-03"
    verification:
      - kind: unit
        ref: "src/db/contacts-dao.test.ts#updateContactFull — mid-composition ROLLBACK (T-04-03 atomicity)"
        status: pass
    human_judgment: false
  - id: D5
    description: "getContactForEdit returns the contacts row (incl. last_contact) + category label (null when category_id null) + custom-value map"
    requirement: "CRUD-03"
    verification:
      - kind: unit
        ref: "src/db/contact-read.test.ts#getContactForEdit — row + category label + custom-value map"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 05: Contact-metadata edit writer Summary

**`updateContactFull` — atomic contact-metadata edit that omits `last_contact` (single-writer DATA-04), recomputes recency through the single writer on a `rarely_responds` flip, and writes a never-contacted contact's first interaction on edit; plus `getContactForEdit` edit-form assembly.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-15T00:56:00Z
- **Completed:** 2026-08-15T01:02:00Z
- **Tasks:** 3 (TDD: RED + 2 GREEN)
- **Files modified:** 4

## Accomplishments
- `updateContactFull` edits every mutable `contacts` column EXCEPT `last_contact` atomically, composing `updateContactMetadataCore` + `upsertValueCore` × N + conditional `recomputeLastContactCore` + optional (never-contacted-only) `insertInteractionCore` inside ONE `inWriteTransaction`.
- The `rarely_responds` flip recompute is proven end-to-end in both directions (1→0 widens to all rows; 0→1 narrows to connected rows only) — a plain metadata UPDATE would leave `last_contact` stale (Pitfall 2).
- First-interaction-on-edit (owner ruling 2026-08-14): a never-contacted contact records its first touchpoint through the single writer; an already-contacted contact's `firstInteraction` is rejected inside the transaction (rollback); a future `occurredAt` is rejected before the transaction opens.
- `getContactForEdit` assembles the edit form's initial values: the full `contacts` row (incl. `last_contact` for the last-spoke-control decision) + category label (null-safe) + custom-value map via `getValuesForContact(defsForEditForm(defs))`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing tests** - `44bca90` (test)
2. **Task 2 (GREEN): updateContactFull + metadata core** - `8dd8e91` (feat)
3. **Task 3 (GREEN): getContactForEdit assembly** - `904f0e0` (feat)
4. **Biome import-sort + formatting** - `cb34e5c` (style)

## Files Created/Modified
- `src/db/contacts-dao.ts` - Added `UpdateContactFullInput`, `updateContactMetadataCore` (UPDATE every contacts col except last_contact, assertOneChange guard), and `updateContactFull` (composed atomic edit + conditional recompute + first-interaction gate).
- `src/db/contact-read.ts` - Added `getContactForEdit` assembly + `ContactEditRow` / `ContactForEdit` types; by-id LEFT JOIN categories, archived-reachable-by-design comment.
- `src/db/contacts-dao.test.ts` - Edit/recompute (both flip directions)/first-interaction/reject-already-contacted/reject-future/rollback/custom-values assertions.
- `src/db/contact-read.test.ts` - Assembly assertions (row incl. last_contact, category label, value map, null-category, never-contacted, missing id).

## Decisions Made
None beyond the plan — executed as specified. The plan's owner ruling (first-interaction-on-edit for never-contacted only) and the archived-read reconciliation (no blanket archived filter on the by-id seek) were both implemented as written and documented in code comments.

## Deviations from Plan

None - plan executed exactly as written.

The only non-task commit is a `style` commit applying Biome's import-sort + line-wrap formatting to the four touched files (the new imports broke import ordering, and one recompute conditional exceeded the line width). No logic changed; tests and `tsc` re-verified green after the reformat.

## Issues Encountered
None. TDD flow was clean: RED failed genuinely (13 assertions against unimplemented functions, negated command exit 0), both GREEN steps passed their targeted suites, and the full suite stayed green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 06 (edit form UI) can now wire directly to `updateContactFull` (write) and `getContactForEdit` (read). The `last_contact` in the assembled row is the signal for whether to surface the tri-state last-spoke control (show only when `last_contact IS NULL`).
- Phase 6 (interaction log) still owns already-contacted timeline edits — `updateContactFull` deliberately rejects a `firstInteraction` for a contact that already has `last_contact` set.

## Self-Check: PASSED

- All modified files present on disk (contacts-dao.ts, contact-read.ts, both test files, SUMMARY.md).
- All 4 commits present in git history (44bca90, 8dd8e91, 904f0e0, cb34e5c).
- `updateContactFull` + `updateContactMetadataCore` exported from contacts-dao.ts; `getContactForEdit` exported from contact-read.ts.
- Full suite green (281 tests), `tsc --noEmit` exit 0, `check:colors` exit 0, `biome check` exit 0.

---
*Phase: 04-contact-crud-lifecycle*
*Completed: 2026-08-15*
