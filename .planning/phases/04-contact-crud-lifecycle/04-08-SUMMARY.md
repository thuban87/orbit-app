---
phase: 04-contact-crud-lifecycle
plan: 08
subsystem: database
tags: [sqlite, archive, soft-delete, react-native, navigation, lifecycle]

# Dependency graph
requires:
  - phase: 04-01
    provides: native-stack navigation shell + Settings Archived route placeholder
  - phase: 04-04
    provides: createContactFull (contact rows the archive/restore tests seed)
  - phase: 04-05
    provides: updateContactMetadataCore assertOneChange guard shape; getContactForEdit archived-reachable by-id seek
  - phase: 04-06
    provides: DropdownFieldWidget Modal action-sheet pattern reused by OverflowMenu
provides:
  - archiveContact / restoreContact — reversible archived_at flag writers (metadata-only, assertOneChange, last_contact untouched)
  - listArchived — the sole inverse read (archived_at IS NOT NULL, newest-archived first)
  - OverflowMenu — low-emphasis ⋯ action-sheet component (profile header)
  - ArchivedContactsScreen — real Settings → Archived home (list + count + per-row Restore)
affects: [phase-04-09-purge, phase-08-dashboard, contact-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Soft-delete via archived_at flag: archive sets it, restore nulls it, listArchived is the single inverse read; every live/list read keeps archived_at IS NULL"
    - "OverflowMenu reuses the DropdownFieldWidget Modal sheet (surfaceElevated + background scrim 0.85) — no icon dependency, glyph-only trigger with 44px hit area"

key-files:
  created:
    - src/components/OverflowMenu.tsx
    - src/screens/ArchivedContactsScreen.tsx
  modified:
    - src/db/contacts-dao.ts
    - src/db/contacts-dao.test.ts
    - src/screens/ContactProfileScreen.tsx
    - src/navigation/RootNavigator.tsx

key-decisions:
  - "Restore is a pure archived_at flag flip in v1 — the RESEARCH-A3 events-row contract is DEFERRED (no events writer/type-vocabulary exists in src yet); documented in an in-file comment, no ad-hoc events insert fabricated"
  - "No auto-purge launch-sweep registered — archived retention is INDEFINITE per UI-SPEC empty-state copy; auto-expiry stays a deferred, non-Phase-4 mechanism"
  - "getContactHeader/getContactForEdit by-id seeks stay archived-reachable by design (no Phase-4 surface routes to an archived profile/edit); only listArchived is the sanctioned inverse read — no NEW unfiltered live/list surface introduced"
  - "Archive lives in the low-emphasis ⋯ overflow (reversible, NOT destructive-styled); Restore lives only on the Archived list; purge (Plan 09) is never one tap from the reversible action — the two-stage guarantee by construction"

patterns-established:
  - "Metadata-only lifecycle writers: UPDATE contacts SET archived_at + modified_at only, assert changes === 1, last_contact never in the SET list (single-writer DATA-04 preserved)"
  - "Glyph overflow menu: OverflowMenu({ actions }) — a reusable low-emphasis ⋯ trigger + themed Modal action sheet"

requirements-completed: [CRUD-05]

coverage:
  - id: D1
    description: "archiveContact/restoreContact flip archived_at (reversible), assert one row changed, never touch last_contact; listArchived is the sole archived_at IS NOT NULL inverse read, newest-first"
    requirement: "CRUD-05"
    verification:
      - kind: unit
        ref: "src/db/contacts-dao.test.ts#archiveContact / restoreContact / listArchived (9 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Profile ⋯ OverflowMenu Archive action hides the contact and navigates off the profile; low-emphasis, not destructive, no purge on the profile"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit; npm run check:colors src/components/OverflowMenu.tsx src/screens/ContactProfileScreen.tsx"
        status: pass
    human_judgment: true
    rationale: "Overflow-sheet interaction, low-emphasis styling, and navigate-off-hidden-profile behaviour are device-UAT observable only (.tsx screens are not loadable in the node/Vitest harness)"
  - id: D3
    description: "ArchivedContactsScreen lists archived contacts via listArchived, states its count, per-row Restore, exact empty-state copy; reachable from Settings → Archived (real screen replacing the Plan 01 placeholder)"
    requirement: "CRUD-05"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit; npm run check:colors src/screens/ArchivedContactsScreen.tsx src/navigation/RootNavigator.tsx"
        status: pass
    human_judgment: true
    rationale: "Screen chrome, count/empty-state copy rendering, and Restore-then-reload flow are device-UAT observable only"

# Metrics
duration: 5min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 08: Archive / Restore & the Archived Home Summary

**Reversible archived_at soft-delete (archiveContact/restoreContact/listArchived) wired to a low-emphasis profile ⋯ Archive action and a real Settings → Archived contacts screen with per-row Restore.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-15T06:34:43Z
- **Completed:** 2026-08-15T06:39:38Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `archiveContact` / `restoreContact` — metadata-only `archived_at` flag writers (assertOneChange, `last_contact` never touched), and `listArchived` — the sole inverse read (`archived_at IS NOT NULL`, newest-archived first), with 9 new node:sqlite behavioural tests (Pitfall-4 same-name hiding included).
- `OverflowMenu` — a reusable low-emphasis `⋯` glyph action-sheet (44px hit area, `accessibilityLabel`, `surfaceElevated` sheet + `background` scrim 0.85, no colour literal) reusing the DropdownFieldWidget Modal pattern; wired into the profile header with its sole Archive action → archive then `popToTop`.
- `ArchivedContactsScreen` — the real Settings → Archived home: reads `listArchived`, states its count, per-row Restore, exact empty-state copy, and a marked Plan-09 slot for "Delete permanently"; RootNavigator's `Archived` route now points at the real screen (placeholder removed).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing archive/restore/listArchived tests** - `6753a85` (test)
2. **Task 1 (GREEN): archive/restore/listArchived DAO ops** - `a32fd64` (feat)
3. **Task 2: OverflowMenu + profile Archive action** - `63ca237` (feat)
4. **Task 3: ArchivedContactsScreen (list + Restore)** - `ff7dd51` (feat)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified
- `src/db/contacts-dao.ts` - Added `archiveContact`, `restoreContact` (metadata `archived_at` UPDATEs, assertOneChange), `listArchived` (inverse read) + `ArchivedContactRow` type
- `src/db/contacts-dao.test.ts` - 9 new cases: archive/restore flag flips, one-row guard, last_contact untouched, Pitfall-4 same-name hiding, listArchived ordering + empty
- `src/components/OverflowMenu.tsx` - New low-emphasis ⋯ action-sheet component
- `src/screens/ContactProfileScreen.tsx` - Replaced the ⋯ placeholder with OverflowMenu + Archive action (archive then navigate off the hidden profile)
- `src/screens/ArchivedContactsScreen.tsx` - New Settings → Archived list + count + per-row Restore + empty state
- `src/navigation/RootNavigator.tsx` - `Archived` route now the real screen; placeholder machinery removed

## Decisions Made
- **Restore is a pure flag flip (events-row DEFERRED).** No events writer or event-`type` vocabulary exists in `src/` yet; writing an ad-hoc events row would fabricate an unspecified vocabulary. Deferral recorded in an in-file comment, per the plan's deferral note.
- **No auto-purge sweep.** Retention is INDEFINITE per the UI-SPEC empty-state copy; an expiry sweep would contradict it. Not registered — auto-expiry stays a deferred, non-Phase-4 mechanism.
- **By-id seeks stay archived-reachable.** `getContactHeader`/`getContactForEdit` intentionally do not blanket-filter `archived_at`; only `listArchived` is the sanctioned inverse read. Verified no NEW unfiltered live/list surface was introduced.
- **Two-stage lifecycle preserved.** Archive (reversible, low-emphasis) on the profile ⋯; Restore only on the Archived list; purge (Plan 09) never adjacent to the reversible action.

## Deviations from Plan

None - plan executed exactly as written.

(Biome reformatting was applied to the new files as part of each task commit — mechanical formatting only, no behavioural change. The `ArchivedContactsScreen` empty-state copy is wrapped across two JSX text lines by the formatter; JSX whitespace collapse preserves the exact string "Contacts you archive are kept here until you delete them permanently.")

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Plan 09 (purge)** can now add the per-row "Delete permanently" (danger) action into the marked slot in `ArchivedContactsScreen`; `listArchived`/`restoreContact` and the two-stage structure are in place.
- **Phase 8 (dashboard)** owns the separate never-contacted home (recorded deferral — this plan delivered only the Archived home).
- Device UAT (phase gate) still required: archive from profile hides the contact; Settings → Archived shows it with a count; Restore returns it to live surfaces.

## Self-Check: PASSED

- FOUND: src/components/OverflowMenu.tsx
- FOUND: src/screens/ArchivedContactsScreen.tsx
- FOUND commits: 6753a85, a32fd64, 63ca237, ff7dd51
- Full suite: 332 tests pass; tsc clean; check:colors clean on all touched UI files

---
*Phase: 04-contact-crud-lifecycle*
*Completed: 2026-08-15*
