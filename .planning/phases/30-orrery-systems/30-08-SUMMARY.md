---
phase: 30-orrery-systems
plan: "08"
subsystem: ui
tags: [react-native, skia, orrery, systems, zustand, sqlite]
requires:
  - phase: 30-02
    provides: draft membership resolution, base candidate IDs, and shared override application
  - phase: 30-03
    provides: atomic custom-definition and immutable-base override save composites
  - phase: 30-07
    provides: controlled Manage Members grid and member-row read sources
  - phase: 30-10
    provides: OrreryScreen observer for the app-scoped last-System preference
provides:
  - multi-page System Builder HUD with closed rule draft controls and live draft membership
  - opaque SystemBuilder route in both Orrery and Settings stacks
  - hydrate-guarded save-new selection publication and immutable-base override persistence
affects: [30-06-systems-management, 30-09-system-preview, 30-05-system-switcher]
actuals:
  tokens: 16032
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns: [db-facing draft resolver, app-scoped selection publication, controlled override intent]
key-files:
  created:
    - src/components/orrery/system-builder-logic.ts
    - src/components/orrery/SystemRuleAccordion.tsx
    - src/screens/SystemBuilderScreen.tsx
  modified:
    - src/db/orrery-system-read.ts
    - src/navigation/types.ts
    - src/navigation/tabs/OrreryStack.tsx
    - src/navigation/tabs/SettingsStack.tsx
key-decisions:
  - "SystemBuilder owns an opaque, decorative Skia canvas; it is never a transparent route over OrreryScreen."
  - "New custom Systems publish selection only after their composite DAO transaction commits and preferences are hydrated."
  - "Built-in and Category Systems keep base names and rules immutable while saving only override deltas."
requirements-completed: [ORRS-01, ORRS-02, ORRS-03, ORRS-05, ORRS-08]
coverage:
  - id: D1
    description: Closed rule-draft mapping, meaningful-change detection, and label summaries.
    requirement: ORRS-01
    verification:
      - kind: unit
        ref: src/components/orrery/system-builder-logic.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Save-new preference publication and immutable-base override save routing.
    requirement: ORRS-02
    verification:
      - kind: unit
        ref: src/screens/SystemBuilderScreen.test.tsx
        status: pass
    human_judgment: false
  - id: D3
    description: Floating HUD canvas, large-text reflow, and touch/a11y operation on a device.
    requirement: ORRS-05
    verification: []
    human_judgment: true
    rationale: Requires physical-device interaction and OS text-scale verification.
duration: 9min
completed: 2026-09-08
status: complete
---

# Phase 30 Plan 08: System Builder HUD Summary

**A dual-stack, own-canvas System Builder now authors closed rule drafts and manual membership overrides with atomic persistence and durable selection switching.**

## Accomplishments

- Added pure, closed-vocabulary rule drafts, meaningful label summaries, and unsaved-change detection.
- Added the Definition and Manage Members HUD over an accessibility-hidden, non-interactive builder-owned Skia canvas.
- Registered serializable `{ systemUid?; systemRef? }` params in both stacks; built-in/Category refs enter override-only mode with base candidate IDs.
- New custom Systems save atomically, hydrate global Orrery preferences when required, then publish `lastSystem`; edits do not switch Systems.

## Task Commits

1. **Task 1: Pure builder draft logic** — `074cb11`
2. **Task 2: Rule accordion, Definition HUD, and both-stack route** — `ba9fa6c`
3. **Task 3: Atomic membership persistence and selection publication** — `91cb5bd`
4. **Accessibility correction: inert decorative canvas** — `7ffbea6`

## Key Contracts

- `SystemBuilder` accepts `{ systemUid?: string; systemRef?: string }`. A `systemRef` for a built-in or Category enters override-only mode: its base candidate IDs come from `readOrrerySystemBaseMemberIds`, its name/rules are immutable, and `saveMembershipOverrides` is its sole save path.
- The normal opaque route renders its own fresh/canonical background canvas. Plan 09 extends this screen by rendering the provisional resolved `memberIds` into that canvas for Preview.
- A save of a new custom System calls the one `saveSystemDefinition` composite, then hydrates `useOrreryPreferencesStore` when necessary and saves `lastSystem=custom:<uid>`. Plan 10's OrreryScreen observer consumes that app-scoped publication; no unreachable screen-local selector is used.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a System-category read DAO.**

- **Found during:** Task 2
- **Issue:** Category rule controls need stable category UIDs, but the existing form reader exposes only local IDs and names; UI-side SQL is prohibited.
- **Fix:** Added `listOrrerySystemCategories` to the Orrery read layer.
- **Files modified:** `src/db/orrery-system-read.ts`
- **Verification:** `npx tsc --noEmit -p tsconfig.json` passes.
- **Committed in:** `ba9fa6c`

## Verification

- Passed: `npx vitest run src/components/orrery/system-builder-logic.test.ts src/screens/SystemBuilderScreen.test.tsx` (7 tests).
- Passed: `npx tsc --noEmit -p tsconfig.json`, Biome checks, and `npm run check:colors`.
- `npm test`: 2,608 tests passed; the known unrelated Flow-parser imports in `src/backup/restore-apply.test.ts` and `src/stores/orrery-system-store.test.ts` still fail before running their suites. No plan-created test failed.

## TDD Gate Compliance

The Task 1 RED command failed as expected before the module existed, then the GREEN implementation passed. The RED test was not committed separately; the task commit contains the completed test and implementation.

## Known Stubs

None.

## Next Phase Readiness

Plan 09 can extend `SystemBuilderScreen` with its Preview state by consuming the provisional draft membership resolved through `resolveDraftMembership`.

## Self-Check: PASSED

- All nine planned source/test artifacts exist on disk.
- Commits `074cb11`, `ba9fa6c`, `91cb5bd`, and `7ffbea6` are present in local history.
