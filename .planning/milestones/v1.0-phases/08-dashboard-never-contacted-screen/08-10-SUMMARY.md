---
phase: 08-dashboard-never-contacted-screen
plan: 10
subsystem: ui
tags: [react-navigation, navigation, settings, search-relocation, favourites]

# Dependency graph
requires:
  - phase: 08-dashboard-never-contacted-screen (Plan 09)
    provides: the dashboard search box that now owns cross-contact name+fuel search
  - phase: 08-dashboard-never-contacted-screen (Plan 08)
    provides: the ManageFavourites route + reorder screen the new Settings row navigates to
provides:
  - Standalone FuelSearch route + screen retired (search relocated to the dashboard)
  - Settings "Search" row removed; Settings "Manage favourites" row added (second entry point into ManageFavouritesScreen)
affects: [settings, navigation, dashboard, favourites-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Search relocation completed: cross-contact search lives only on the dashboard (Plan 09); the reusable FuelSearchResultRow component and searchFuel DAO survive the screen's removal"
    - "Two entry points into the shared reorder screen: the favourites-chip Manage affordance (Plan 09) and the Settings Manage-favourites row (this plan)"

key-files:
  created: []
  modified:
    - src/navigation/types.ts
    - src/navigation/RootNavigator.tsx
    - src/screens/SettingsScreen.tsx
  deleted:
    - src/screens/FuelSearch.tsx

key-decisions:
  - "Retired FuelSearch route/screen is the expected search relocation (STATE.md Phase-7 note / 08-UI-SPEC Surfaces), NOT a decision reversal — the dashboard search box shipped first (Plan 09 dependency) so capability was never lost."
  - "Kept the conceptual 'FuelSearch pattern' comments in NeverContactedScreen (naming the async cancelled-flag load idiom) — they are documentation, not live route/import references."

patterns-established:
  - "Removing a route: delete the RootStackParamList entry, the import, and the Stack.Screen registration together, then tsc verifies no dangling reference and grep confirms no live navigate() target remains."

requirements-completed: [DASH-06, DASH-02]

coverage:
  - id: D1
    description: "Standalone FuelSearch route + screen retired; no dangling route/import remains; reusable FuelSearchResultRow + searchFuel DAO intact"
    requirement: "DASH-02"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (clean — no dangling import); npx vitest run (676 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Settings loses the Search row and gains a Manage favourites row navigating to ManageFavourites"
    requirement: "DASH-06"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (ManageFavourites navigate type-checks); npm run check:colors (tokens-only)"
        status: pass
      - kind: manual_procedural
        ref: "On-device UAT (Pixel): Settings shows 'Manage favourites' (opens reorder screen) and no 'Search' row; dashboard search still works"
        status: unknown
    human_judgment: true
    rationale: "UI presence/absence of rows and the live navigation target are UI-observable only; end-of-phase Pixel UAT confirms the row opens the reorder screen and dashboard search remains functional."

# Metrics
duration: 2min
completed: 2026-08-16
status: complete
---

# Phase 8 Plan 10: Search Relocation + Manage-favourites Settings Entry Summary

**Retired the standalone FuelSearch route/screen now that the dashboard owns search, and swapped the Settings "Search" row for a "Manage favourites" row — the second entry point into the shared reorder screen.**

## Performance

- **Duration:** 2 min 9 s
- **Started:** 2026-08-16T05:33:19Z
- **Completed:** 2026-08-16T05:36Z
- **Tasks:** 2
- **Files modified:** 3 (2 edited, 1 deleted)

## Accomplishments
- Removed the `FuelSearch` entry from `RootStackParamList`, its import, and its `Stack.Screen` registration; deleted `src/screens/FuelSearch.tsx`.
- Replaced the `settings-search-row` Pressable (navigate → FuelSearch) with a `settings-manage-favourites-row` Pressable (label + accessibilityLabel "Manage favourites") navigating to `ManageFavourites`.
- Kept the reusable `FuelSearchResultRow` component and the `searchFuel` DAO intact (both reused by the dashboard card).
- tsc clean, check:colors clean, full vitest suite green (53 files / 676 tests).

## Task Commits

Each task was committed atomically (commit order chosen so every commit builds green):

1. **Task 2: Settings — remove Search row, add Manage favourites row** - `13a2b6a` (feat)
2. **Task 1: Retire the FuelSearch route + screen** - `7d52c34` (refactor)

_Task 2 was committed first: at that snapshot the FuelSearch route still existed, so SettingsScreen (no longer referencing FuelSearch, now navigating to the existing ManageFavourites) type-checks. Task 1 then removed the route + screen with no remaining live reference. Committing in task-number order would have left a transient dangling-navigate tsc error at the intermediate commit._

**Plan metadata:** `<final>` (docs: complete plan)

## Files Created/Modified
- `src/navigation/types.ts` - Removed the `FuelSearch: undefined` route from `RootStackParamList`.
- `src/navigation/RootNavigator.tsx` - Removed the `FuelSearch` import and its `<Stack.Screen name="FuelSearch">` registration.
- `src/screens/SettingsScreen.tsx` - Removed `settings-search-row`; added `settings-manage-favourites-row` → `navigation.navigate("ManageFavourites")`; colours via `useTheme().colors.*`.
- `src/screens/FuelSearch.tsx` - **Deleted** (standalone screen retired).

## Decisions Made
- **Search relocation is expected, not a reversal.** The dashboard search box (Plan 09) shipped before this plan removed FuelSearch, so cross-contact search capability was never lost — consistent with the Phase-7 STATE.md note and 08-UI-SPEC § Surfaces Delivered. `FuelSearchResultRow` + `searchFuel` survive as the reusable units.
- **Left the "FuelSearch pattern" comments in NeverContactedScreen untouched.** Those two comments name the async cancelled-flag load idiom (documentation), not a route/import — removing them would be out-of-scope churn.
- **Commit ordering over task numbering.** Committed the SettingsScreen change first so each commit compiles; the FuelSearch.tsx deletion was staged deliberately with Task 1 (nav removal), not folded into the Settings commit.

## Deviations from Plan

None - plan executed exactly as written. The reverse-order commit sequencing (Task 2 before Task 1) is an ordering choice to keep each atomic commit build-green, not a scope change; both tasks were implemented exactly as specified.

## Issues Encountered
- During Task 1, `tsc` transiently failed because `SettingsScreen` still navigated to the just-removed `FuelSearch` route (TS2769). Resolved as designed by applying Task 2's SettingsScreen edit and committing the SettingsScreen change first, so no committed snapshot contains a dangling reference.
- An initial `--amend` inadvertently pulled the staged FuelSearch.tsx deletion into the Task 2 commit; reset and recommitted so Task 2 = SettingsScreen only and Task 1 = nav removal + screen deletion. (No AI-attribution trailer retained, per project rule.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 8's two remaining navigation seams are in place: search lives only on the dashboard, and Settings offers the Manage-favourites entry.
- End-of-phase on-device UAT (Pixel) should confirm: Settings shows "Manage favourites" (opens the reorder screen) and no "Search" row; the dashboard search box still works.

## Self-Check: PASSED

- CONFIRMED DELETED: `src/screens/FuelSearch.tsx`
- FOUND commit `13a2b6a` (Task 2 — Settings row swap)
- FOUND commit `7d52c34` (Task 1 — FuelSearch route/screen retired)
- FOUND: `08-10-SUMMARY.md`

---
*Phase: 08-dashboard-never-contacted-screen*
*Completed: 2026-08-16*
