---
phase: 25-dashboard-data-state-foundation
plan: 06
subsystem: dashboard-widget-navigation
tags: [dashboard, favourites, widget, navigation, sqlite]
requires:
  - phase: 25-02
    provides: Favorites population read with Dashboard Default ordering
provides:
  - Favorites widget projection using shared Default relationship-health order
  - Binary favourite membership without the drag-rank management surface
  - Safe Home-only widget deep-link reset for orbit://favourites
affects: [phase-25-plan-07, dashboard-rendering, widget-navigation]
actuals:
  tokens: 11962
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - Home-only WidgetNavIntent variants branch before any routes[1] access
    - Favourite rank remains internal membership storage, not Dashboard/widget ordering
key-files:
  created: []
  modified:
    - src/services/widget/widget-data.ts
    - src/db/favourites-dao.ts
    - src/navigation/widget-linking.ts
    - src/services/widget/widget-quick-action-guard.ts
  removed:
    - src/screens/ManageFavouritesScreen.tsx
    - src/logic/favourites-reorder-logic.ts
key-decisions:
  - "Favorites widget now consumes listDashboardPopulation with the shared Default sort."
  - "favourite_rank remains as vestigial internal storage for picker, capture, merge, and sun reads."
  - "orbit://favourites resets safely to Home until a later render plan wires the Favorites population chip."
patterns-established:
  - "Discriminate WidgetNavIntent by index before reading a target route."
requirements-completed: [DASHQ-04]
coverage:
  - id: D1
    description: Favorites widget uses the Dashboard Default ordering instead of manual rank.
    requirement: DASHQ-04
    verification:
      - kind: unit
        ref: src/services/widget/widget-data.test.ts#reads the Favorites population in Dashboard Default order and shapes it
        status: pass
    human_judgment: false
  - id: D2
    description: Ranked-favourites reorder UI and writer are retired while binary membership remains.
    requirement: DASHQ-04
    verification:
      - kind: unit
        ref: src/db/favourites-dao.test.ts
        status: pass
      - kind: other
        ref: "rg -n 'ManageFavourites|rewriteFavouriteRanks' src"
        status: pass
    human_judgment: false
  - id: D3
    description: The favourites widget URI resolves and flushes through a safe Home-only intent.
    requirement: DASHQ-04
    verification:
      - kind: unit
        ref: src/navigation/widget-linking.test.ts#maps orbit://favourites to a Home-only reset
        status: pass
      - kind: unit
        ref: src/services/widget/widget-quick-action-guard.test.ts#keeps the Home-only favourites intent independent of a contact lookup
        status: pass
    human_judgment: false
duration: 7m
completed: 2026-09-05
status: complete
---

# Phase 25 Plan 06: Retire Ranked Favourites Summary

**Favorites now use shared Dashboard relationship-health ordering in the widget, with binary membership and a safe Home-only deep link.**

## Performance

- **Duration:** 7m
- **Started:** 2026-09-05T04:26:41Z
- **Completed:** 2026-09-05T04:33:17Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- Replaced the widget's rank-ordered query with `listDashboardPopulation` for the Favorites population in Default order.
- Removed the drag-reorder screen, reorder logic, rank-rewrite writer, navigation route, and all retired consumer references.
- Repointed `orbit://favourites` to a typed Home-only reset that the guard and linking gate handle before reading `routes[1]`.
- Kept `favourite_rank` and its internal capture, sun-picker, merge-candidate, and picker reads intact.

## Task Commits

1. **Task 1: Re-point the widget to the Favorites-population Default order** - `b80a189` (feat)
2. **Task 2: Retire the rank-rewrite write + the Manage-favourites screen/logic** - `8548c44` (feat)
3. **Task 3: Re-point/remove the retired-route consumers** - `b18a0df` (feat)

## Files Created/Modified

- `src/services/widget/widget-data.ts` - reads the shared Favorites Default projection with an injectable test clock.
- `src/db/favourites-dao.ts` - retains mark/clear membership writes and documents the retained rank column.
- `src/navigation/widget-linking.ts` - resolves favourites to a Home-only reset and safely flushes it.
- `src/services/widget/widget-quick-action-guard.ts` - accepts Home-only intents without contact lookup.
- `src/screens/ManageFavouritesScreen.tsx` - removed retired drag-reorder surface.

## Decisions Made

- The widget is a Dashboard consumer: it takes the Favorites population's Default relationship-health order rather than ranking by stored favourite rank.
- `favourite_rank` remains present for internal reads; no migration changed the column.
- The favourites deep link lands on the live Home route until the later Dashboard render work activates the Favorites population explicitly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 07 can retire its separate Never Contacted surfaces without any ranked-favourites route or widget dependency remaining.

## Self-Check: PASSED

- Verified task commits `b80a189`, `8548c44`, and `b18a0df` exist in git history.
- Verified the retained internal `favourite_rank` reads remain in capture, sun-picker, merge-candidate, and picker readers.
- Verified `ManageFavourites` and `rewriteFavouriteRanks` have no remaining `src/` references.

---
*Phase: 25-dashboard-data-state-foundation*
*Completed: 2026-09-05*
