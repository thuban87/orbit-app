---
phase: 04-contact-crud-lifecycle
plan: 04
subsystem: ui
tags: [react-native, expo, create-contact, profile, navigation, sqlite, custom-fields]

# Dependency graph
requires:
  - phase: 04-01
    provides: RootNavigator + typed RootStackParamList (Create/Profile/Edit routes as placeholders)
  - phase: 04-02
    provides: createContactFull atomic-create DAO (phone in lean set; positive-interval + future-date guards)
  - phase: 04-03
    provides: FrequencyPicker + TriStateLastSpoke controls and their node-tested pure logic
provides:
  - CreateContactScreen — lean create form (fixed block + show_on_new custom block) wired to createContactFull
  - ContactProfileScreen — header/scaffold the create flow lands on (name, ⋯ placeholder, Add details, rarely-responds label)
  - create-contact-logic.ts — node-tested canSave gate + buildCreateInput (form → DAO input)
  - Create + Profile routes now point at real screens on RootNavigator
affects: [04-06 edit form, 04-08 archive/overflow menu, profile read surfaces in later phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Screen correctness split: pure -logic.ts (node Vitest) + .tsx RN shell (device-UAT), mirroring FrequencyPicker/TriStateLastSpoke"
    - "Form state assembled into a single createContactFull input (one transaction) via buildCreateInput; screen builds no SQL"
    - "navigation.replace('Profile', {contactId}) on save so Back does not return to the form"

key-files:
  created:
    - src/screens/CreateContactScreen.tsx
    - src/screens/ContactProfileScreen.tsx
    - src/screens/create-contact-logic.ts
    - src/screens/create-contact-logic.test.ts
  modified:
    - src/navigation/RootNavigator.tsx

key-decisions:
  - "Extracted input-shaping into create-contact-logic.ts so the CRUD-01/02 rules (phone passthrough, tri-state→firstInteraction, local-midnight occurredAt, Save gate) are unit-tested in node — the .tsx screen stays device-UAT."
  - "Category picker offers an explicit 'No category' item bound to sentinel -1, mapped back to null on change (nullable category with a native Picker that cannot hold null)."

patterns-established:
  - "Pattern: form → DAO input builder is a pure, dependency-injected function (uids/now/colNames passed in) so the transaction-shaping logic is deterministically testable."

requirements-completed: [CRUD-01, CRUD-02]

coverage:
  - id: D1
    description: "buildCreateInput assembles the createContactFull input — phone passthrough (CRUD-01), tri-state→firstInteraction with local-midnight occurredAt (CRUD-02), custom-value mapping, rarelyResponds=0"
    requirement: CRUD-01
    verification:
      - kind: unit
        ref: "src/screens/create-contact-logic.test.ts#buildCreateInput"
        status: pass
    human_judgment: false
  - id: D2
    description: "canSave gate blocks empty name and invalid custom interval so a non-positive interval never reaches the DAO"
    requirement: CRUD-02
    verification:
      - kind: unit
        ref: "src/screens/create-contact-logic.test.ts#canSave"
        status: pass
    human_judgment: false
  - id: D3
    description: "CreateContactScreen renders fixed block then show_on_new custom block, warns on duplicate name, and navigates to Profile on save"
    requirement: CRUD-01
    verification:
      - kind: manual_procedural
        ref: "device UAT at phase gate: create → profile; duplicate warn; not-yet vs today"
        status: unknown
    human_judgment: true
    rationale: "Native pickers + navigation + Alert flow cannot load in the node Vitest env; requires the desktop→Pixel build to exercise on-device."
  - id: D4
    description: "ContactProfileScreen scaffold — name, ⋯ placeholder (44px hit area + accessibilityLabel), Add details → Edit, rarely-responds label"
    requirement: CRUD-01
    verification:
      - kind: manual_procedural
        ref: "device UAT at phase gate: land on profile after create; Add details opens Edit; rarely-responds label shows when flagged"
        status: unknown
    human_judgment: true
    rationale: "RN screen render + navigation is device-observable only; getContactHeader read is exercised through the running app."

# Metrics
duration: 12min
completed: 2026-08-15
status: complete
---

# Phase 4 Plan 04: Create Contact & Profile Scaffold Summary

**The first full vertical slice — a lean create form (fixed block + show_on_new custom block) wired to `createContactFull` in one transaction, landing on a ContactProfile scaffold, with the phone passthrough (CRUD-01) and tri-state last-spoke (CRUD-02) proven by node-tested input logic.**

## Performance

- **Duration:** ~12 min (execution), plus context load
- **Started:** 2026-08-15T06:00:00Z (approx)
- **Completed:** 2026-08-15T06:10:00Z
- **Tasks:** 2 (Task 1 via TDD: RED → GREEN)
- **Files modified/created:** 5 (4 created, 1 modified)

## Accomplishments
- `CreateContactScreen`: fixed block (Name → Category → Frequency → Last-spoke → Phone) rendered first, then the `defsForCreateForm` custom block through `FieldValueInput` verbatim — never interleaved, no widget re-implemented.
- CRUD-01 fix realised at the UI: the typed Phone is carried into the `createContactFull` input (previously collected but dropped). Frequency defaults to Monthly (30) so a name-only save succeeds; an invalid custom interval blocks Save before a non-positive value can reach the DAO.
- CRUD-02 tri-state: "Today" → `occurredAt = now`; "Pick date" → `${date} 00:00:00` (local midnight, never a bare 10-char date); "Not yet" → no `firstInteraction` (NULL last_contact). Duplicate live name warns on save ("You already have a {name} — save anyway?") and writes nothing on Cancel.
- `ContactProfileScreen` scaffold: name (Display 24/700), low-emphasis `⋯` placeholder (`textSecondary`, 44px hit area, `accessibilityLabel="More actions"`, inert until Plan 08), "Add details" (accent) → `Edit`, the "Rarely responds · attempts don't reset the orbit" label when flagged, and a Timeline section stub noting read surfaces are later-phase.
- Both screens registered on the navigator, replacing the Plan 01 placeholders. `navigation.replace("Profile", …)` on save so Back does not return to the form.

## Task Commits

1. **Task 1 (RED): failing test for create-contact input builder** - `63ae395` (test)
2. **Task 1 (GREEN): CreateContactScreen wired to createContactFull** - `b508508` (feat)
3. **Task 2: ContactProfileScreen scaffold** - `c12e0b2` (feat)

## Files Created/Modified
- `src/screens/create-contact-logic.ts` - Pure form→DAO model: `canSave` gate, `firstInteractionOccurredAt`, `buildCreateInput` (node-tested).
- `src/screens/create-contact-logic.test.ts` - 12 unit tests covering the gate + input assembly (phone, tri-state, custom values).
- `src/screens/CreateContactScreen.tsx` - The lean create form (RN shell + navigation + Alert gates), consumes the logic module.
- `src/screens/ContactProfileScreen.tsx` - Header/scaffold the create flow lands on; light `getContactHeader` read.
- `src/navigation/RootNavigator.tsx` - `Create` + `Profile` routes now point at the real screens (placeholders removed).

## Decisions Made
- Split the correctness-critical input shaping into `create-contact-logic.ts` (node Vitest) rather than testing the `.tsx` — the repo's established `-logic.ts` convention (FrequencyPicker, TriStateLastSpoke). The `.tsx` screens are device-UAT at the phase gate, matching the plan's verification note.
- Native category `Picker` cannot hold `null`, so a "No category" item bound to sentinel `-1` maps back to `null` on change — keeps the column nullable without a custom modal.

## Deviations from Plan

None - plan executed exactly as written. (Import of `listDefs` was sourced from `@/db/field-defs-dao` where it is actually exported, not the plan's illustrative `field-values-dao` grouping — a mechanical import-path correction caught by typecheck, not a behavioural change.)

## Issues Encountered
- Initial `listDefs` import pointed at `@/db/field-values-dao` (which exports `defsForCreateForm` but not `listDefs`); typecheck flagged it and it was corrected to `@/db/field-defs-dao`. No behaviour change.

## Known Stubs

Both are intentional, plan-sanctioned scaffold stubs (Task 2 explicitly ships the profile as "scaffold only"):

- `src/screens/ContactProfileScreen.tsx` — the `⋯` overflow control (`testID=contact-profile-overflow`) is inert; its real Archive action lands in **Plan 08**. Documented in the component header.
- `src/screens/ContactProfileScreen.tsx` — the Timeline section (`testID=contact-profile-timeline-stub`) renders "Coming in a later phase"; the profile read surfaces (timeline / gravity / fuel) are owned by later phases.

Neither blocks the plan's goal (create a contact end-to-end and land on its profile), which is fully achieved.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The create → profile vertical slice is reachable on the navigator; ready for the edit form (Plan 06) to fill in the "Add details" → `Edit` destination and the archive/overflow menu (Plan 08) to wire the `⋯` placeholder.
- On-device UAT (native pickers, duplicate warn, not-yet vs today, land-on-profile) is deferred to the desktop→Pixel build per the plan's device-UAT note.

## Self-Check: PASSED

All created files present on disk (`CreateContactScreen.tsx`, `ContactProfileScreen.tsx`, `create-contact-logic.ts`, `create-contact-logic.test.ts`, `04-04-SUMMARY.md`); all three task commits (`63ae395` test, `b508508` feat, `c12e0b2` feat) found in git history. Full suite green (293 tests), tsc + check:colors exit 0.

## TDD Gate Compliance

Task 1 (`tdd="true"`): RED commit `63ae395` (`test(04-04)`, 12 failing) precedes GREEN commit `b508508` (`feat(04-04)`, 12 passing). No REFACTOR needed. Gate sequence satisfied.

---
*Phase: 04-contact-crud-lifecycle*
*Completed: 2026-08-15*
