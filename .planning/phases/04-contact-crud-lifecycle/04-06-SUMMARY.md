---
phase: 04-contact-crud-lifecycle
plan: 06
subsystem: ui
tags: [react-native, contact-edit, forms, sqlite, custom-fields, birthday, recency]

# Dependency graph
requires:
  - phase: 04-05
    provides: updateContactFull (metadata + custom-values + never-contacted firstInteraction, single-writer)
  - phase: 04-04
    provides: CreateContactScreen chrome, create-contact-logic (firstInteractionOccurredAt), TriStateLastSpoke, FrequencyPicker
  - phase: 04-03
    provides: getContactForEdit / ContactForEdit seed shape, defsForEditForm, FieldValueInput, ToggleFieldWidget
provides:
  - EditContactScreen (route Edit) — the always-show edit form wired to updateContactFull
  - edit-contact-logic.ts — node-tested form<->DAO model (seed, birthday convention, first-interaction gate)
  - Never-contacted-only tri-state last-spoke affordance (single-writer first contact)
  - Year-optional birthday (MM-DD / YYYY-MM-DD) app-level convention
affects: [04-07 contact-links editor, 06 interaction-log timeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Screen/pure-logic split: RN shell (EditContactScreen.tsx) + node-tested edit-contact-logic.ts, mirroring create-contact-logic"
    - "Birthday year-optional via string-length convention (5 = MM-DD unknown, 10 = YYYY-MM-DD known) — RESEARCH Pitfall 7"
    - "Conditional last-spoke control gated on neverContacted; first contact routes through updateContactFull's single-writer firstInteraction path"

key-files:
  created:
    - src/screens/EditContactScreen.tsx
    - src/screens/edit-contact-logic.ts
    - src/screens/edit-contact-logic.test.ts
  modified:
    - src/navigation/RootNavigator.tsx

key-decisions:
  - "Reused firstInteractionOccurredAt from create-contact-logic (one source of truth for the tri-state -> occurredAt CRUD-02 rule) instead of re-implementing"
  - "Birthday held as a full YYYY-MM-DD in form state even when year-unknown (placeholder year 2000, leap-safe); the year is stripped only at storage time"
  - "Contact links deferred to Plan 07 (this plan's files_modified scope excludes them); this screen owns metadata + toggles + birthday + never-contacted first-contact only"

patterns-established:
  - "Edit-form seeding: seedEditState(getContactForEdit result) produces the whole EditFormState in one pure call"
  - "rowUid always freshly minted per save (safe: ON CONFLICT(contact_id) DO UPDATE never rewrites uid)"

requirements-completed: [CRUD-03]

coverage:
  - id: D1
    description: "edit-contact-logic: seed from getContactForEdit, birthday MM-DD/YYYY-MM-DD split, duplicate-safe input build, never-contacted-only firstInteraction gate"
    requirement: "CRUD-03"
    verification:
      - kind: unit
        ref: "src/screens/edit-contact-logic.test.ts (19 cases: isNeverContacted, parseBirthdayForForm, buildBirthdayForStorage, seedEditState, canSave, buildEditInput)"
        status: pass
    human_judgment: false
  - id: D2
    description: "EditContactScreen renders every non-quarantined field + phone/email + toggles + birthday year-unknown + (never-contacted only) last-spoke, saves via updateContactFull, reached from profile 'Add details'"
    requirement: "CRUD-03"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
      - kind: other
        ref: "npm run check:colors src/screens/EditContactScreen.tsx src/screens/ContactProfileScreen.tsx src/navigation/RootNavigator.tsx (exit 0)"
        status: pass
    human_judgment: true
    rationale: "Native pickers (category, social battery, birthday date), toggles, and the conditional last-spoke render/save are UI-observable only — device UAT on the desktop->Pixel build (edit fields, toggle rarely-responds, birthday year-unknown, duplicate-name, never-contacted last-spoke records first contact vs already-contacted control absent)"

# Metrics
duration: 20min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 06: EditContactScreen Summary

**The always-show contact edit form — every non-quarantined field + phone/email + social battery + year-optional birthday + Rarely-responds/Turn-off-reminders toggles, seeded by getContactForEdit and saved atomically through updateContactFull, with a never-contacted-only tri-state last-spoke control that records a first contact via the single-writer path.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-15T01:14:00Z
- **Completed:** 2026-08-15T01:19:00Z
- **Tasks:** 1 (TDD: test + feat)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `EditContactScreen` renders the fixed block (Name → Category → Frequency → [never-contacted only] Last-spoke → Phone → Email → Birthday → Social battery → Rarely-responds / Turn-off-reminders), then the `defsForEditForm` custom block (every non-quarantined field) via `FieldValueInput` verbatim.
- Save runs `isDuplicateName(name, excludeId=contactId)` → the "save anyway" gate, then `updateContactFull` in one transaction, then returns to the Profile.
- Never-contacted-only tri-state last-spoke: `neverContacted = result.contact.last_contact == null`; a Today/Pick-date choice passes a `firstInteraction` to `updateContactFull` (which re-asserts `last_contact IS NULL` and writes via the single writer). An already-contacted contact shows no control.
- Year-optional birthday via a "Year unknown" toggle beside the native date picker: stores `MM-DD` when on, `YYYY-MM-DD` when off (distinguished by string length — RESEARCH Pitfall 7).
- `edit-contact-logic.ts` extracted and node-tested (19 cases); `Edit` route swapped from placeholder to the real screen.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): edit-contact-logic + tests** - `33735ab` (test)
2. **Task 1 (GREEN): EditContactScreen + navigator wiring** - `6749e1a` (feat)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified
- `src/screens/EditContactScreen.tsx` - The RN edit-form shell: fixed block + toggles + conditional last-spoke + custom block, wired to updateContactFull.
- `src/screens/edit-contact-logic.ts` - Pure form<->DAO model: seedEditState, parseBirthdayForForm/buildBirthdayForStorage, canSave, buildEditInput (never-contacted firstInteraction gate).
- `src/screens/edit-contact-logic.test.ts` - 19 node tests covering seed, birthday convention, and the first-interaction gate (incl. already-contacted never emits firstInteraction).
- `src/navigation/RootNavigator.tsx` - `Edit` route now renders the real `EditContactScreen` (was a placeholder); dropped `EditPlaceholder`.

## Decisions Made
- Reused `firstInteractionOccurredAt` from `create-contact-logic` rather than re-implementing the tri-state → occurredAt mapping (single source of truth for CRUD-02).
- Birthday kept as a full `YYYY-MM-DD` in form state even when year-unknown (placeholder year 2000, leap-safe for 02-29); the year is stripped only at storage time via `buildBirthdayForStorage`.
- Contact links are out of scope here — the plan's `files_modified` and objective assign them to Plan 07. This screen owns metadata + toggles + birthday + the never-contacted first-contact affordance.
- `ContactProfileScreen`'s "Add details" already targeted `Edit` (from Plan 05), so no profile change was needed — confirmed, not modified.

## Deviations from Plan

None - plan executed exactly as written. The screen builds no SQL, re-implements no widget, and routes all writes through `updateContactFull`; the last-spoke control renders iff `neverContacted`, with the boundary comment present.

## Issues Encountered
- Biome flagged import-order and a formatter line-wrap in the two new source files; resolved with `biome check --write` (no logic change). No other issues.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 07 (contact-links editor) can add its links area to this screen; the edit form's seed/save split (`edit-contact-logic.ts` + `EditContactScreen.tsx`) is the extension point.
- **Device UAT deferred to the desktop→Pixel build** (native picker/toggle/last-spoke are UI-observable only): verify editing each field; toggling Rarely-responds recomputes recency; birthday year-unknown stores MM-DD; duplicate-name warns on save; a never-contacted contact records its first contact via the last-spoke control while an already-contacted contact shows no such control.

---
*Phase: 04-contact-crud-lifecycle*
*Completed: 2026-08-15*

## Self-Check: PASSED
- All created files exist on disk (EditContactScreen.tsx, edit-contact-logic.ts, edit-contact-logic.test.ts, SUMMARY.md; RootNavigator.tsx modified).
- Task commits present in git log: 33735ab (test), 6749e1a (feat).
- Verification green: tsc --noEmit (0), check:colors on all three files (0), biome (0), full suite 312/312 tests pass (19 new).
