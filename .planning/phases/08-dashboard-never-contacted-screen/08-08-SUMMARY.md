---
phase: 08-dashboard-never-contacted-screen
plan: 08
subsystem: ui
tags: [react-native, favourites, reorder, drag, navigation, useTheme, reanimated]

# Dependency graph
requires:
  - phase: 08-01
    provides: listFavourites (non-archived favourites, favourite_rank ASC) + FavouriteRow type
  - phase: 08-03
    provides: computeReorder (pure drag→order permutation) + rewriteFavouriteRanks (transactional 0..n-1 rank rewrite, three guards)
provides:
  - ManageFavouritesScreen (DASH-06) — shared drag-reorder favourites home; reorder-only; persists via rewriteFavouriteRanks in ONE transaction
  - ManageFavourites route registered in RootStackParamList + RootNavigator (reachable, additive)
  - react-native-reorderable-list dependency (owner-approved drag library)
affects: [08-09 favourites-chip Manage affordance navigates here, 08-10 Settings row navigates here, 08-verification Pixel UAT]

# Tech tracking
tech-stack:
  added:
    - "react-native-reorderable-list@0.18.1 — owner-approved at the blocking legitimacy checkpoint (T-08-SC); drag-reorder FlatList driven by Reanimated worklets"
  patterns:
    - "Drag handle row split into its own component (FavouriteReorderRow) so useReorderableDrag() runs inside a ReorderableList cell; drag bound to a dedicated handle via onPressIn"
    - "onReorder computes the new id order via the pure computeReorder inside the setRows updater, mirrors local rows via an id→row Map, and fires the transactional persist as a fire-and-forget side effect"
    - "Async cancelled-flag guarded focus load (FuelSearch/Archived idiom) — offline read via getExecutor()"

key-files:
  created:
    - src/screens/ManageFavouritesScreen.tsx
  modified:
    - src/navigation/types.ts
    - src/navigation/RootNavigator.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Owner APPROVED adding react-native-reorderable-list at the blocking-human legitimacy checkpoint (T-08-SC) after reviewing provenance/maturity (created 2021, ~92k downloads/wk, MIT, maintained for Reanimated 4). Installed via `npx expo install` so Expo resolved a compatible version (0.18.1). The no-dependency up/down-arrow fallback was NOT built."
  - "Reorder-ONLY screen: no unstar affordance here — marking a favourite stays the profile star (ContactProfileScreen, Plan 06). UI-SPEC § Interaction States."
  - "A drag computes the new order with computeReorder (currentIds, from, to) and persists via rewriteFavouriteRanks(getExecutor(), newIds, localDateTime()) in ONE transaction — the existing node-tested logic + DAO are reused verbatim; neither the reorder math nor the rank write is reimplemented, and inWriteTransaction is never nested (Pitfall 6)."
  - "Local state mirrors the persisted order by mapping the computeReorder id output through an id→row Map — the on-screen order is always a permutation consistent with what the DAO writes; a persist failure re-reads via load() so the screen reflects the true persisted order."
  - "Drag/animation is entirely library-driven (Reanimated worklets) — no per-frame React setState (CLAUDE.md animation rule). ReorderableList is a FlatList, so Avatar's recyclingKey correctness (contactId + cacheBust=modified_at) is preserved."
  - "Route registered ADDITIVELY: ManageFavourites: undefined added after NeverContacted (08-05); FuelSearch left intact (Plan 10 retires it). No existing route disturbed."

patterns-established:
  - "useReorderableDrag() must run inside a ReorderableList cell — extract the row into its own component and bind the returned drag starter to a dedicated handle."

requirements-completed: [DASH-06]

coverage:
  - id: R1
    description: "ManageFavouritesScreen lists all non-archived favourites (listFavourites, favourite_rank ASC) as avatar + name + drag handle; reorder-only (no unstar); own Back chrome, title 'Manage favourites', hint 'Drag to reorder'; locked testIDs manage-favourites-root / -row-{id} / -handle-{id}."
    requirement: DASH-06
    verification:
      - kind: automated_ui
        ref: "Pixel uiautomator UAT — end-of-phase: open Manage favourites, drag a row, re-open and confirm the new order persists (manage-favourites-root / -handle-{id})"
        status: unknown
    human_judgment: true
    rationale: ".tsx render + native drag gesture is device-UAT (repo convention); the reorder math (computeReorder) and rank write (rewriteFavouriteRanks) are node-tested in 08-03; drag perf is only assessable on the physical Pixel, never the emulator (Skia/Reanimated worklet)."
  - id: R2
    description: "A drag-end computes the new id order via computeReorder and persists it via the transactional rewriteFavouriteRanks (ranks 0..n-1) in ONE transaction; local list reflects the new order; a persist failure re-reads."
    requirement: DASH-06
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (full src green) + npm test (665 pass) — computeReorder + rewriteFavouriteRanks logic covered by 08-03 suites; this screen wires them without reimplementation."
        status: pass
    human_judgment: false
  - id: R3
    description: "The ManageFavourites route is registered (RootStackParamList + RootNavigator) and reachable; FuelSearch + NeverContacted untouched."
    requirement: DASH-06
    verification:
      - kind: unit
        ref: "npx tsc --noEmit green — RootStackScreenProps<'ManageFavourites'> resolves and the Stack.Screen registration typechecks."
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-08-16
status: complete
---

# Phase 8 Plan 08: Manage-favourites Drag-Reorder Screen Summary

**The shared drag-reorder favourites home (DASH-06): `ManageFavouritesScreen` lists non-archived favourites (`listFavourites`, `favourite_rank ASC`) as avatar + name + drag handle and reorders them via the owner-approved `react-native-reorderable-list`, computing the new order with the pure `computeReorder` and persisting it through the transactional `rewriteFavouriteRanks` (0..n-1) in one transaction — reorder-only, with the route registered additively.**

## Checkpoint Resolution

The plan opened with a blocking-human package-legitimacy checkpoint (T-08-SC) for the net-new `react-native-reorderable-list` dependency ([ASSUMED] provenance). The owner **APPROVED** adding it after reviewing provenance/maturity (created 2021, ~92k downloads/wk, MIT, maintained for Reanimated 4). Installed via `npx expo install react-native-reorderable-list` (resolved 0.18.1). The zero-dependency up/down-arrow fallback was therefore NOT built.

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-08-16
- **Tasks:** 2 build tasks (checkpoint resolved by owner beforehand)
- **Files:** 4 changed (1 created, 3 modified) across 2 atomic build commits + 1 dependency commit

## Accomplishments
- `src/screens/ManageFavouritesScreen.tsx` (DASH-06): loads `listFavourites(getExecutor())` in an async cancelled-flag focus effect (offline), renders each favourite as `Avatar` + name + a drag handle (`FavouriteReorderRow`, whose `useReorderableDrag()` binds the drag starter to the handle via `onPressIn`). Own Back chrome (`goBack`), title "Manage favourites" (24/700), hint "Drag to reorder", empty state when no favourites. Locked testIDs `manage-favourites-root` / `manage-favourites-row-{id}` / `manage-favourites-handle-{id}`. Reorder-only — no unstar affordance.
- On `onReorder({from, to})`: computes `computeReorder(currentIds, from, to)` inside the `setRows` updater, mirrors the local rows through an id→row `Map`, and fires `rewriteFavouriteRanks(getExecutor(), newIds, localDateTime())` (ONE transaction) as a side effect; a persist failure alerts and re-reads via `load()` so the on-screen order matches what actually persisted. Neither the reorder math nor the rank write is reimplemented, and `inWriteTransaction` is never nested (Pitfall 6).
- Drag/animation is entirely library-driven (Reanimated worklets) — no per-frame `setState` (CLAUDE.md). Every colour resolves through `useTheme().colors.*` (`check:colors` green).
- Registered the `ManageFavourites` route ADDITIVELY: `ManageFavourites: undefined` in `RootStackParamList` (after `NeverContacted`) and a `<Stack.Screen>` in `RootNavigator`; `FuelSearch` + `NeverContacted` untouched (Plan 10 retires `FuelSearch`).

## Task Commits

1. **Dependency install (owner-approved):** `9c42524` — `chore(08-08): add react-native-reorderable-list`
2. **Task 1 + Task 2: ManageFavouritesScreen (drag reorder) + route** — `c57dddd` (feat, atomic)

The two build tasks were committed together as one atomic `feat` commit: the screen and its route registration are a single reviewable, compilable unit (a screen with no route or a route with no screen would not typecheck independently in a meaningful way).

## Files Created/Modified
- `src/screens/ManageFavouritesScreen.tsx` — New DASH-06 drag-reorder favourites screen (created).
- `src/navigation/types.ts` — Adds `ManageFavourites: undefined` to `RootStackParamList` (additive).
- `src/navigation/RootNavigator.tsx` — Imports + registers `ManageFavouritesScreen` (additive).
- `package.json` / `package-lock.json` — Adds `react-native-reorderable-list@^0.18.1`.

## Decisions Made
- Extract the row into `FavouriteReorderRow` so `useReorderableDrag()` runs inside a `ReorderableList` cell; bind the returned drag starter to a dedicated handle via `onPressIn` (immediate grab-to-drag on the handle only).
- Drive local state off the `computeReorder` id output (via an id→row `Map`) rather than the library's own `reorderItems`, so the on-screen order is provably a permutation consistent with the DAO write, and the pure tested logic is the single source of the ordering.
- Fire the transactional persist as a fire-and-forget side effect from the `setRows` updater; on failure, alert and re-read so the screen never diverges from the persisted truth.

## Deviations from Plan

None - the two build tasks were executed as written for the APPROVED path. (Per the checkpoint outcome the arrow fallback was intentionally not built.)

## Known Stubs

None - the screen is fully wired to live data: reads via `listFavourites`, writes via `rewriteFavouriteRanks`. It is reachable via its registered route; the two navigation entry points (favourites-chip Manage affordance, Plan 09; Settings row, Plan 10) land in later plans by design.

## Issues Encountered

None. `npx tsc --noEmit` and `npm run check:colors` are green across full src; `npm test` passes 665/665 — the new dependency does not break the type or test baseline. (`npm audit` reports pre-existing transitive advisories unrelated to this dependency; out of scope.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The `ManageFavourites` route exists and is reachable; Plan 09 (favourites-chip Manage affordance) and Plan 10 (Settings row) can `navigation.navigate("ManageFavourites")`.
- On-device UAT (Pixel, end-of-phase): mark ≥3 favourites, open Manage favourites, drag to reorder, re-open and confirm the order persists (the physical Pixel is required — Reanimated/Skia drag perf cannot be assessed on the emulator).

## Self-Check: PASSED
- FOUND: src/screens/ManageFavouritesScreen.tsx
- FOUND commit 9c42524 (dependency install)
- FOUND commit c57dddd (screen + route)

---
*Phase: 08-dashboard-never-contacted-screen*
*Completed: 2026-08-16*
