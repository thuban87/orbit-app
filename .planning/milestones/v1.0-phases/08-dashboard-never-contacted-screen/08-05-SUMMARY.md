---
phase: 08-dashboard-never-contacted-screen
plan: 05
subsystem: ui
tags: [react-native, react-navigation, native-stack, useFocusEffect, dashboard]

# Dependency graph
requires:
  - phase: 08-01
    provides: listNeverContacted read + NeverContactedSort union + DashboardRow (literal null status/progress for never-contacted rows)
  - phase: 08-04
    provides: shared presentational ContactCard (status null → neutral state, ranked fuel line)
provides:
  - NeverContactedScreen — the "Not yet contacted" inverse-population screen (own 3-way sort, focus refresh, calm empty state)
  - NeverContacted native-stack route (types.ts + RootNavigator) — reachable, param-less
affects: [08-07 dashboard footer entry that pushes NeverContacted, 08-verification Pixel UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useFocusEffect + cancelled-flag async guard for re-query on focus AND on sort change (FuelSearch pattern)"
    - "Screen owns its own single-active sort control (FilterChipRow filled-accent idiom, inline) distinct from the dashboard's four-way sort"

key-files:
  created:
    - src/screens/NeverContactedScreen.tsx
  modified:
    - src/navigation/types.ts
    - src/navigation/RootNavigator.tsx

key-decisions:
  - "Reuse the shared ContactCard verbatim — a never-contacted row carries status:null (08-01 selects literal null) so the card renders its neutral 'Not yet contacted' state; status is NOT re-derived here."
  - "Sort control wires the NeverContactedSort union (oldest default / newest / name) that listNeverContacted already exposes; re-query keyed on the sort in the useFocusEffect callback deps."
  - "Route registered ADDITIVELY — FuelSearch route left intact (Plan 10 retires it); initialRouteName Home unchanged."

patterns-established:
  - "Never-contacted screen chrome mirrors ArchivedContactsScreen (themed root over colors.background, goBack Back control + 24/700 title, native-stack headerShown:false)."

requirements-completed: [DASH-04, DASH-01]

coverage:
  - id: D1
    description: "NeverContactedScreen lists the never-contacted, non-archived population via listNeverContacted, renders each row through the shared ContactCard (neutral status + fuel line), and taps navigate to Profile."
    requirement: DASH-04
    verification:
      - kind: automated_ui
        ref: "Pixel uiautomator UAT — end-of-phase pass (never-contacted-root, never-contacted-card-{id})"
        status: unknown
    human_judgment: true
    rationale: ".tsx render + navigation is device-UAT only (repo convention); the underlying read is node-tested in dashboard-read.test.ts but the screen wiring is Pixel-verified."
  - id: D2
    description: "Own three-way sort control (Oldest added default / Newest added / Name A–Z) re-queries listNeverContacted on change."
    requirement: DASH-04
    verification:
      - kind: automated_ui
        ref: "Pixel uiautomator UAT — never-contacted-sort-control, sort re-order observable"
        status: unknown
    human_judgment: true
    rationale: "Sort behaviour is a rendered-order assertion — device-UAT; NC_SORT ordering itself is covered by dashboard-read.test.ts."
  - id: D3
    description: "Focus refresh (useFocusEffect + cancelled guard), offline render, and the calm 'You've reached everyone — No one is waiting' empty state."
    requirement: DASH-04
    verification:
      - kind: automated_ui
        ref: "Pixel uiautomator UAT — never-contacted-empty"
        status: unknown
    human_judgment: true
    rationale: "Empty-state copy + offline focus refresh are visually/behaviourally verified on the Pixel."
  - id: D4
    description: "NeverContacted route registered on the native stack (types.ts + RootNavigator) and reachable; typechecks with FuelSearch present."
    requirement: DASH-01
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (full src green)"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-08-16
status: complete
---

# Phase 8 Plan 05: Not-Yet-Contacted Screen Summary

**NeverContactedScreen — the inverse-population "Not yet contacted" screen reusing the shared ContactCard with its own three-way sort (Oldest added default), focus-refresh, and a calm empty state, plus its additive native-stack route.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-16T04:43:58Z
- **Completed:** 2026-08-16T04:45:45Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `NeverContactedScreen` lists the never-contacted, non-archived population via `listNeverContacted` (08-01), rendering each row through the shared `ContactCard` (status null → neutral state, ranked fuel line) with a tap to `Profile { contactId }`.
- Its OWN three-way sort control (Oldest added default / Newest added / Name A–Z) wires the `NeverContactedSort` union; the list re-queries on sort change.
- Load runs inside `useFocusEffect` with a cancelled-flag async guard (FuelSearch pattern) — async reads only, refreshes on focus, renders offline; calm `never-contacted-empty` state ("You've reached everyone — No one is waiting").
- The `NeverContacted` route is registered ADDITIVELY on the native stack (types.ts + RootNavigator), param-less and reachable; FuelSearch route + `initialRouteName="Home"` untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: NeverContactedScreen.tsx — inverse-population list with own sort + focus refresh** - `30c9952` (feat)
2. **Task 2: Register the NeverContacted route (types.ts + RootNavigator)** - `775cf1a` (feat)

## Files Created/Modified
- `src/screens/NeverContactedScreen.tsx` - The "Not yet contacted" screen: shared-card list, own 3-way sort, focus refresh, calm empty state.
- `src/navigation/types.ts` - `RootStackParamList` gains `NeverContacted: undefined`.
- `src/navigation/RootNavigator.tsx` - Imports + registers `<Stack.Screen name="NeverContacted">`.

## Decisions Made
- Reuse `ContactCard` verbatim; never re-derive status — a never-contacted row's `status:null` (08-01 literal null) drives the card's neutral state.
- The three sort options live in a fixed-order constant (`SORT_OPTIONS`) whose keys ARE the `NeverContactedSort` union, so the control cannot drift from the DAO's accepted sorts.
- Sort control is inline (no new component) using the existing FilterChipRow filled-accent idiom — single active option, container `testID="never-contacted-sort-control"`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Task 1's standalone `tsc` fails on the forward reference to the not-yet-registered `NeverContacted` route type — resolved by Task 2 as sequenced. `check:colors` was clean for the screen at Task 1; full `tsc` + `check:colors` green after Task 2, and `dashboard-read.test.ts` (31 tests) passes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The screen exists and is route-registered; Plan 07's dashboard "Not yet contacted (N)" footer entry can `navigation.navigate("NeverContacted")` and typecheck.
- On-device UAT (Pixel): list renders never-contacted people with fuel, three sorts reorder, empty state shows — deferred to the end-of-phase Pixel pass.

## Self-Check: PASSED
- FOUND: src/screens/NeverContactedScreen.tsx
- FOUND commit 30c9952 (Task 1)
- FOUND commit 775cf1a (Task 2)

---
*Phase: 08-dashboard-never-contacted-screen*
*Completed: 2026-08-16*
