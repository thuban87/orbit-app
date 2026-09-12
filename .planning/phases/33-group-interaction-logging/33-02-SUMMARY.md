---
phase: 33-group-interaction-logging
plan: "02"
subsystem: ui-navigation
tags: [react-native, contact-picker, navigation, vitest]
requires:
  - phase: 22-app-shell-navigation
    provides: canonical ContactPicker and four profile-hosting stack architecture
  - phase: 33-group-interaction-logging
    provides: Group Event data spine from Plan 01
provides:
  - Type-safe single- and multi-select modes in the shared ContactPicker
  - Deterministic selection and participant-exclusion helpers with node coverage
  - Cross-stack Group Event route contracts and focused-workflow classification
affects: [33-06, 33-07, group-log, group-event-detail]
actuals:
  tokens: 4761
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - ContactPicker behavior is selected through a discriminated union rather than a picker fork.
    - Profile-originated routes are declared in every stack that hosts ContactProfileScreen.
key-files:
  created:
    - src/components/contact-picker-multiselect.ts
    - src/components/contact-picker-multiselect.test.ts
  modified:
    - src/components/ContactPicker.tsx
    - src/navigation/types.ts
    - src/navigation/focused-route-classification.ts
    - src/navigation/focused-route-classification.test.ts
key-decisions:
  - "Multi-select extends the canonical ContactPicker through a discriminated union; it does not introduce a second picker."
  - "Group Event history routes are registered in Dashboard, Orrery, and Settings because RootStackParamList's type intersection cannot guarantee runtime registration."
patterns-established:
  - "applyPickerExclusions runs before filterPicker and supports both a single owner exclusion and a participant-id set."
  - "Focused workflow routing is keyed by route name, making the classification stack-agnostic."
requirements-completed: []
coverage:
  - id: D1
    description: Shared ContactPicker supports deterministic multi-select state and excludes existing group members before filtering.
    requirement: GRP-06
    verification:
      - kind: unit
        ref: src/components/contact-picker-multiselect.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit && npm run check:colors
        status: pass
    human_judgment: true
    rationale: Device interaction still needs confirmation for the selected-state controls, archived-search marker, Clear, and Done flow.
  - id: D2
    description: Group Event detail/edit/participant routes exist in every Profile-hosting stack and the editors are focused workflows.
    requirement: GRP-08
    verification:
      - kind: unit
        ref: src/navigation/focused-route-classification.test.ts
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: false
duration: 16min
completed: 2026-09-12
status: complete
---

# Phase 33 Plan 02: Shared Picker and Route Contracts Summary

The canonical ContactPicker now supports accessible, type-safe multi-select participants, and Group Event routes resolve safely from every Profile-hosting tab stack.

## Performance

- **Duration:** 16 min
- **Completed:** 2026-09-12T10:43:37Z
- **Tasks:** 2/2
- **Files modified:** 6 source/test files

## Accomplishments

- Added a pure, node-tested selection reducer and exclusions helper; multi-select retains the existing list, search, archived/snoozed markers, loading state, and transient registration.
- Added selected checks plus count, Clear, and Done controls while retaining the legacy dismiss-on-tap single-select path through a discriminated props union.
- Registered `GroupEventDetail`, `EditGroupEvent`, and `EditParticipant` in Dashboard, Orrery, and Settings stacks; classified the editors as focused workflows.

## Task Commits

1. **Task 1: Extend ContactPicker to multi-select** - `4bd2a10` (RED tests), `35f74c5` (implementation), `2b41716` (test formatting)
2. **Task 2: Group Event route types + focused-route classification** - `4bb6216`

## Decisions Made

- Multi-select confirmation returns insertion-ordered IDs and keeps single-select callers on the original `onSelect` contract.
- `GroupEventDetail` remains a presentation route; `EditGroupEvent` and `EditParticipant` are focused workflows.

## Requirement Progress

- GRP-06 and GRP-08 remain open: this plan delivers their shared picker and navigation foundations, while Plans 33-06 and 33-07 deliver the participant workflows and real Group Event surfaces.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The full `npm test -- --reporter=dot` run completed with 340 passing suites / 3,109 passing tests, but an unrelated pre-existing Orrery render suite failed to parse: `src/components/orrery/orrery-controls-render.test.tsx` reported `SyntaxError: Unexpected token 'typeof'`. This plan's two targeted Vitest suites, `npm run check:colors`, and `npx tsc --noEmit` pass. The out-of-scope failure is logged in `deferred-items.md`.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

Plans 33-06 and 33-07 can consume the one shared picker in multi-select mode and navigate to serializable Group Event edit/detail/participant routes once their screen registrations land.

## Self-Check: PASSED

- Confirmed all six planned source/test files exist and all four task commits are present in git history.

---
*Phase: 33-group-interaction-logging*
*Plan: 02*
*Completed: 2026-09-12*
