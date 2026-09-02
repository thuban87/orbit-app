---
phase: 22-app-shell-navigation
plan: "01"
subsystem: navigation
tags: [react-navigation, bottom-tabs, native-stack, deep-linking, notifications]
requires:
  - phase: 21-interaction-assist-and-reach-out
    provides: Compose, notification, and widget external-entry flows
provides:
  - Four persistent bottom tabs with independently owned native stacks
  - Typed nested Dashboard reset intents for all Plan 01 external entries
affects: [22-03-cross-tab-navigation, 22-04-dashboard-controls, 22-05-universal-fab]
actuals:
  tokens: 10546
  tasks: 2
  commits: 2
tech-stack:
  added: ["@react-navigation/bottom-tabs@^7.18.18"]
  patterns: [per-tab native stacks, TabParamList container ref, centralized nested reset intents]
key-files:
  created: [src/navigation/tabs/DashboardStack.tsx, src/navigation/tabs/OrreryStack.tsx, src/navigation/tabs/BackupStack.tsx, src/navigation/tabs/SettingsStack.tsx, src/navigation/reset-intents.ts]
  modified: [src/navigation/RootNavigator.tsx, src/navigation/types.ts, src/navigation/linking.ts, src/navigation/notification-gate.tsx, src/navigation/widget-linking.ts]
key-decisions:
  - "Root navigation is a fixed four-tab shell with a native stack per tab."
  - "External entry routes retain flat pure resolver intents and nest only at the live reset dispatch."
  - "The container navigation ref is typed against TabParamList; dashboard reset state is owned solely by reset-intents.ts."
patterns-established:
  - "Use resetToDashboardRoot/resetToDashboardWith for external Dashboard fallback paths."
  - "Use nested tab navigation for container-level cross-stack targets."
requirements-completed: [SHELL-01, SHELL-04, SHELL-05, SHELL-15]
coverage:
  - id: D1
    description: "Four-tab navigator with independently owned Dashboard, Orrery, Backup, and Settings stacks."
    requirement: SHELL-01
    verification:
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
      - kind: manual_procedural
        ref: "Approved tracer verification checkpoint"
        status: pass
    human_judgment: false
  - id: D2
    description: "External Compose, notification, widget, and share routes preserve the nested Dashboard fallback."
    requirement: SHELL-05
    verification:
      - kind: unit
        ref: "src/navigation/reset-intents.test.ts; src/navigation/widget-linking.test.ts; src/services/notifications/notification-nav.test.ts"
        status: pass
      - kind: other
        ref: "npm test; npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tab switching uses the bottom-tabs fade transition and preserves origin-aware Orrery Profile back paths."
    requirement: SHELL-15
    verification:
      - kind: manual_procedural
        ref: "Approved tracer verification checkpoint"
        status: pass
    human_judgment: false
duration: 16m
completed: 2026-09-02
status: complete
---

# Phase 22 Plan 01: Four-Tab Shell and External Navigation Summary

**A persistent Dashboard, Orrery, Backup, and Settings tab shell with typed nested resets that keep all external entries Dashboard-rooted.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-02T21:18:46Z
- **Completed:** 2026-09-02T21:34:53Z
- **Tasks:** 2/2
- **Files modified:** 17

## Accomplishments

- Replaced the flat root stack with four fixed bottom tabs, each owning its native stack and fade transition.
- Preserved Orrery-origin Profile workflows through dual route registration.
- Centralized nested Dashboard reset state and applied it to Compose, notifications, widgets, and share-intent navigation without weakening widget URI validation.

## Task Commits

1. **Task 1: Four-tab bottom-nav shell end-to-end — one path booting through every layer** — `db6fcec` (`feat`)
2. **Task 2: Nested-reset single owner + navigationRef retype + ALL container-level external/navigate sites** — `a7ad299` (`feat`)

## Files Created/Modified

- `src/navigation/RootNavigator.tsx` — fixed four-tab root navigator with fade animation.
- `src/navigation/tabs/*.tsx` — native stack owner for each persistent tab.
- `src/navigation/types.ts` — tab and per-stack route contracts.
- `src/navigation/reset-intents.ts` — sole owner of nested Dashboard reset states, with node tests.
- `src/navigation/linking.ts` — TabParamList-typed container ref and nested share targets.
- `src/navigation/notification-gate.tsx`, `src/services/notifications/notification-nav.ts` — Dashboard-rooted notification routes.
- `src/navigation/widget-linking.ts`, `src/screens/ComposeScreen.tsx` — Dashboard-rooted widget and Compose exits.

## Decisions Made

- Kept widget and notification resolvers flat and pure; only the live navigation adapter nests those routes below `DashboardTab`.
- Kept `ManageFavourites` registered so the shipped widget deep link remains valid.
- Used Compose's parent tab navigator for its reset, because a child stack cannot reset tab-root state itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Routed notification gate's unbound-decay Profile fallback through the nested Dashboard reset.**
- **Found during:** Task 2
- **Issue:** The guard could still return a bare container `navigate("Profile")`, which no longer resolves after the ref was constrained to `TabParamList`.
- **Fix:** Returned the existing flat `[Home, Profile]` intent and nested it at the gate with `resetToDashboardWith`.
- **Files modified:** `src/navigation/notification-gate.tsx`, `src/navigation/notification-gate.test.tsx`
- **Verification:** Notification gate tests, TypeScript, and full test suite pass.
- **Committed in:** `a7ad299`

**2. [Rule 1 - Bug] Reset Compose through its parent tab navigator.**
- **Found during:** Task 2
- **Issue:** A Compose stack-local reset cannot install the required `DashboardTab` root state.
- **Fix:** Reset the typed parent tab navigator with `resetToDashboardRoot`.
- **Files modified:** `src/screens/ComposeScreen.tsx`
- **Verification:** `npx tsc --noEmit` passes.
- **Committed in:** `a7ad299`

**Total deviations:** 2 auto-fixed (2 Rule 1).

## Residual UAT

- The shell tracer's human verification checkpoint was approved before Task 2 resumed. No additional device run was performed for notification, widget, or share-intent delivery; their nested state shape, URI guards, and route typing are covered by automated tests and TypeScript.

## Issues Encountered

- Scoped Biome validation reports two pre-existing `ComposeScreen` findings (unused AI import and an array-index key). They are recorded in `deferred-items.md` and were not changed by this navigation plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 can now reshape remaining component-level cross-tab navigation against the typed tab tree. The nested reset helper is the required adapter for any further external Dashboard fallback.

## Self-Check: PASSED

- Confirmed all shell, reset, and integration source files exist.
- Confirmed task commits `db6fcec` and `a7ad299` exist in git history.

---
*Phase: 22-app-shell-navigation*
*Completed: 2026-09-02*
