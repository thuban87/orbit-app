---
phase: 22-app-shell-navigation
plan: "02"
subsystem: navigation
tags: [react-navigation, zustand, android-back, bottom-tabs, transient-ui]
requires:
  - phase: 22-app-shell-navigation/01
    provides: four-tab navigator with independently-owned native stacks
provides:
  - Ordered, callback-backed registry for shell transient overlays
  - Pure back-intent and focused-workflow classifiers
  - Active-tab retap and focused-workflow tab-bar behavior
  - Shell Android Back interception that preserves nested navigator fallback
affects: [22-03-cross-tab-navigation, 22-04-shell-chrome, 22-05-universal-fab, 22-06-contact-picker]
actuals:
  tokens: 3425
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: [callback-backed transient stack, pure back intent, explicit route allow-list, targeted BackHandler interception]
key-files:
  created: [src/stores/shell-transient-store.ts, src/navigation/back-intent.ts, src/navigation/focused-route-classification.ts]
  modified: [src/navigation/RootNavigator.tsx]
key-decisions:
  - "Transient entries retain their actual close callback and retain original stack position on duplicate registration."
  - "Shell Back handles only dismiss-transient; all ordinary Back behavior returns false to React Navigation's focused native stack."
  - "Unknown routes default to browse/read so new routes do not unexpectedly hide the tab bar."
patterns-established:
  - "Register shell overlays with openTransient(id, dismiss) and unregister them when their own close path completes."
  - "Use resolveBackIntent plus shellTransientStore.dismissTop() for every shell-level Back control."
requirements-completed: [SHELL-02, SHELL-03, SHELL-04, SHELL-06]
coverage:
  - id: D1
    description: Ordered transient callback registry, pure back intent, and focused-workflow classifier.
    requirement: SHELL-03
    verification:
      - kind: unit
        ref: npx vitest run src/navigation/back-intent.test.ts src/navigation/focused-route-classification.test.ts src/stores/shell-transient-store.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Active-tab retap dismisses transient UI before returning the focused tab stack to root, and tab chrome responds to focused routes and keyboard visibility.
    requirement: SHELL-02
    verification:
      - kind: other
        ref: npx tsc --noEmit && npm run check:colors
        status: pass
    human_judgment: true
    rationale: Physical tab presses, keyboard behavior, and large-font layout require Pixel UAT.
  - id: D3
    description: Shell Android Back dismisses its topmost transient and otherwise allows React Navigation's origin-aware nested Back fallback.
    requirement: SHELL-03
    verification:
      - kind: unit
        ref: src/navigation/back-intent.test.ts#resolveBackIntent
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: true
    rationale: Android hardware Back and visible-back interaction need on-device confirmation.
duration: 8m
completed: 2026-09-02
status: complete
---

# Phase 22 Plan 02: Shell Behavior Contract Summary

**Callback-backed transient overlays now drive active-tab retaps, Android Back dismissal, and focused-workflow tab-bar visibility without replacing origin-aware stack history.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-02T21:36:28Z
- **Completed:** 2026-09-02T21:43:48Z
- **Tasks:** 3/3
- **Files modified:** 7

## Accomplishments

- Added an ordered, non-persisted Zustand registry whose top-layer dismissal invokes the overlay's own close callback.
- Added pure, node-tested back-intent and focused-workflow decisions, including all placeholder and import/reconcile routes.
- Wired each tab's retap behavior, focused-workflow tab-bar visibility, and a shell BackHandler that only intercepts transient dismissal.

## Task Commits

1. **Task 1: Shell transient-overlay store + back-intent resolver + focused-route classification (pure)** — `64d7b7d` (`feat`)
2. **Task 2: Active-tab retap (dismiss transient then pop root) + nav-bar focused/keyboard visibility (SHELL-02/06)** — `2df3632` (`feat`)
3. **Task 3: Shell-level BackHandler so system Back == visible Back (dismiss transient first) (SHELL-03)** — `774d04c` (`feat`)

## Files Created/Modified

- `src/stores/shell-transient-store.ts` — ephemeral ordered overlay registry with actual dismiss callbacks.
- `src/navigation/back-intent.ts` — pure transient-first Back decision.
- `src/navigation/focused-route-classification.ts` — explicit focused-workflow allow-list.
- `src/navigation/RootNavigator.tsx` — retap, tab-bar visibility, and shell Back wiring.

## Decisions Made

- Duplicate transient registration replaces the callback in place, preserving true opening order across re-renders.
- The shell BackHandler registers after NavigationContainer so LIFO BackHandler dispatch gives an open shell overlay first refusal; it returns `false` for every ordinary Back case.
- Unknown route names remain browse/read by default; navigation stays visible until a route is intentionally added to the focused allow-list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Bottom Tabs type imports and tab-bar display inference.**
- **Found during:** Task 2
- **Issue:** `BottomTabNavigationProp` was imported from the wrong package and the tab-bar `display` value widened to `string`, failing TypeScript.
- **Fix:** Imported Bottom Tabs types from `@react-navigation/bottom-tabs` and returned `BottomTabNavigationOptions` from the shared options helper.
- **Files modified:** `src/navigation/RootNavigator.tsx`
- **Verification:** `npx tsc --noEmit` and `npm run check:colors` pass.
- **Committed in:** `2df3632`

---

**Total deviations:** 1 auto-fixed (1 Rule 1).
**Impact on plan:** Necessary type-correctness repair; no behavior or scope change.

## Residual UAT

- On a Pixel, verify an open speed dial dismisses on system Back and visible shell Back without popping/exiting; active-tab retap dismisses first then returns to root; non-active tabs switch normally.
- Verify focused workflows and keyboard input hide the bottom bar, returning restores it, and large OS font scale keeps tab labels usable.
- SHELL-03 remains deliberately scoped to shell-owned transients (speed dial and picker). Existing child visible Back controls in Digest, Archived Contacts, Never Contacted, Unbound Contacts, and Backup still call `navigation.goBack()`; Compose and Capture retain their own system-Back handlers. This is safe only while shell transient scrims remain `StyleSheet.absoluteFill` with open pointer events intercepting child taps. If scrim coverage shrinks, route those controls through `back-intent` immediately.

## Issues Encountered

None beyond the corrected TypeScript import/inference issue above. Full regression output includes the existing Vite config-loader and Node SQLite experimental warnings, but all tests passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 can wire `ShellAppBar` Back controls to `resolveBackIntent` and `shellTransientStore.dismissTop`.
- Plans 05 and 06 must register and unregister the speed-dial and picker close callbacks through `shellTransientStore` so the new shell controls close real UI state.

## Verification

- `npx vitest run src/navigation/back-intent.test.ts src/navigation/focused-route-classification.test.ts src/stores/shell-transient-store.test.ts` — pass (3 files, 42 tests).
- `npx tsc --noEmit` — pass.
- `npm run check:colors` — pass.
- `npm test` — pass (195 files, 1856 tests).
- Source assertions — pass: four `tabPress` listeners, one `hardwareBackPress` listener, focused-route lookup present, no store `persist(` middleware, and `openTransient(id, dismiss)` accepts a close callback.

## Self-Check: PASSED

- Confirmed all seven source/test files and this summary exist.
- Confirmed task commits `64d7b7d`, `2df3632`, and `774d04c` exist in git history.

---
*Phase: 22-app-shell-navigation*
*Completed: 2026-09-02*
