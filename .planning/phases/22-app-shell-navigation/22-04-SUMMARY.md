---
phase: 22-app-shell-navigation
plan: "04"
subsystem: ui
tags: [react-native, react-navigation, zustand, accessibility, app-shell]
requires:
  - phase: 22-01
    provides: Four-tab navigator and tab-owned stacks
  - phase: 22-02
    provides: Shared shell back-intent and transient registry
provides:
  - Accessible root and child ShellAppBar chrome
  - Measured bottom-tab layout source and shared FAB clearance geometry
  - Dashboard Group Events and Archived Contacts navigation
affects: [22-05, 22-06, theme, release-hardening]
actuals:
  tokens: 5439
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - Measured tab-bar geometry is published through a non-persisted Zustand store.
    - Tab-root chrome uses ShellAppBar while child migration remains incremental.
key-files:
  created:
    - src/components/ShellAppBar.tsx
    - src/stores/tab-bar-layout-store.ts
    - src/navigation/use-bottom-clearance.ts
    - src/screens/GroupEventsScreen.tsx
  modified:
    - src/components/OverflowMenu.tsx
    - src/navigation/RootNavigator.tsx
    - src/screens/HomeScreen.tsx
key-decisions:
  - "The rendered BottomTabBar height, including its OS inset, is the sole clearance source for tab descendants and shell siblings."
  - "Dashboard keeps Group Events visible in the app bar and collapses crowded secondary destinations into the accessible overflow."
patterns-established:
  - "Shell app bars route child Back through back-intent before falling through to native stack Back."
  - "FAB position and scroll clearance share FAB_SIZE and FAB_EDGE_GAP exports."
requirements-completed: [SHELL-12, SHELL-13, SHELL-14]
coverage:
  - id: D1
    description: Accessible root/child shell app bar and focus-restoring overflow menu
    requirement: SHELL-14
    verification:
      - kind: other
        ref: npx tsc --noEmit && npm run check:colors
        status: pass
    human_judgment: true
    rationale: TalkBack focus capture and restoration require device accessibility verification.
  - id: D2
    description: Measured tab-bar clearance shared by browse content and the shell FAB seam
    requirement: SHELL-13
    verification:
      - kind: other
        ref: npx tsc --noEmit && npm run check:colors
        status: pass
    human_judgment: true
    rationale: Gesture and three-button navigation clearance requires a rendered device check.
  - id: D3
    description: Dashboard Group Events, overflow Archived Contacts, and placeholder route
    requirement: SHELL-12
    verification:
      - kind: other
        ref: npm test
        status: pass
    human_judgment: true
    rationale: Route behavior and visual app-bar hierarchy require device UAT.
duration: 13m
completed: 2026-09-02
status: complete
---

# Phase 22 Plan 04: Shell Chrome and Dashboard Destinations Summary

**Reusable accessible app bars, measured tab/FAB clearance, and Dashboard-owned Group Events and Archived Contacts routing.**

## Performance

- **Duration:** 13m
- **Started:** 2026-09-02T21:53:00Z
- **Completed:** 2026-09-02T22:05:32Z
- **Tasks:** 3/3
- **Files modified:** 12

## Accomplishments

- Added `ShellAppBar` root and child variants; child Back resolves shell transients before native stack navigation, and tab roots now own branded/destination headers.
- Upgraded `OverflowMenu` to mark its open sheet modal for accessibility and restore focus to the trigger after dismissal.
- Published rendered tab-bar height through a runtime-only store; Home, Backup, and Settings now clear the tab bar and FAB from the shared geometry constants.
- Added Group Events as a typed Dashboard-stack placeholder, a visible Dashboard header destination, and a redundant overflow entry; added Dashboard-overflow access to the existing Archived screen.
- Removed the retired Manage favourites entries and the third Dashboard Archived entry; crowded Dashboard shortcuts remain available from overflow as typed tab switches.

## Task Commits

1. **Task 1: Reusable ShellAppBar primitive + OverflowMenu a11y upgrade + status-bar integration** — `d9c240b` (`feat`)
2. **Task 2: Measured tab-bar-height store + custom measuring tabBar + bottom content-clearance hook** — `f90a7f2` (`feat`)
3. **Task 3: GroupEvents placeholder + Dashboard Group Events header/overflow + Archived overflow + ADR-075 entry removal + header cross-tab reconciliation** — `a588928` (`feat`)

## Files Created/Modified

- `src/components/ShellAppBar.tsx` — shared root/child themed app-bar primitive.
- `src/components/OverflowMenu.tsx` — modal accessibility isolation and trigger-focus restoration.
- `src/stores/tab-bar-layout-store.ts` — non-persisted measured tab-bar layout state.
- `src/navigation/use-bottom-clearance.ts` — shared tab/FAB content clearance contract.
- `src/navigation/RootNavigator.tsx` — measuring default tab-bar wrapper.
- `src/screens/GroupEventsScreen.tsx` — themed, semantic placeholder route.
- `src/screens/HomeScreen.tsx` — Dashboard app bar, overflow routes, typed tab switches, and clearance.

## Decisions Made

- The default rendered `BottomTabBar` remains authoritative for lower clearance because its measured height already includes the OS navigation-area inset; no consumer adds a second safe-area inset.
- Group Events remains the visible Dashboard-owned primary header action. Existing secondary destinations move into the overflow when header width is constrained, rather than crowding out the title or the primary action.
- Child-screen chrome migration remains deferred. Existing full-screen shell-transient scrims intercept visible child Back while open, and existing `goBack()` matches the default back-intent branch otherwise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type compatibility] Used typed nested object tab switches for Dashboard overflow actions.**
- **Found during:** Task 3
- **Issue:** The installed React Navigation composite navigation overload rejects string-only calls for routes requiring nested tab screen params.
- **Fix:** Routed Backup, Orrery, and Settings through type-checked object-form tab targets with their root screen params.
- **Files modified:** `src/screens/HomeScreen.tsx`
- **Verification:** `npx tsc --noEmit` passes.
- **Committed in:** `a588928`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** No scope expansion; the typed route shape preserves the specified destinations and prevents runtime route-resolution failures.

## Known Stubs

- `src/screens/GroupEventsScreen.tsx:14` — Intentional "Coming soon" placeholder; Phase 33 replaces it with Group Events data and workflow UI.

## Verification

- Passed: `npx tsc --noEmit`
- Passed: `npm run check:colors`
- Passed: `npm test` — 195 test files, 1,856 tests.
- Deferred device UAT: Pixel visual hierarchy, TalkBack modal focus restore, and gesture/three-button lower-clearance checks require the desktop-build-to-Pixel workflow.

## Next Phase Readiness

- Plan 05 can consume `useMeasuredTabBarHeight`, `FAB_SIZE`, and `FAB_EDGE_GAP` for the shell-mounted UniversalFab without calling a tab-context hook.
- Device UAT remains for the phase-level app-shell pass; no external setup or authentication is required.

## Self-Check: PASSED

- Confirmed all four newly created implementation files and this summary exist.
- Confirmed task commits `d9c240b`, `f90a7f2`, and `a588928` exist in repository history.

---
*Phase: 22-app-shell-navigation*
*Completed: 2026-09-02*
