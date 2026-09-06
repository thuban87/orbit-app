---
phase: 28-dashboard-card-view
plan: "05"
subsystem: dashboard-ui
tags: [react-native, dashboard, card-view, context-menu, accessibility]
requires:
  - phase: 28-dashboard-card-view
    provides: CardGrid, GridCard, and frozen dashboard selection state from Plans 01–04
  - phase: 27-dashboard-list-view
    provides: canonical Quick Log and detail navigation patterns
provides:
  - Eight-action per-contact Card View context menu with state-aware favourite and snooze labels
  - Direct detailed-log and assistive-technology action routing for Dashboard cards
affects: [28-06, 28-07, dashboard-card-view, dashboard-selection]
actuals:
  tokens: 5022
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: [host-owned card action routing, BaseOverlay icon action sheet, card-level accessibility actions]
key-files:
  created: [src/components/CardContextMenu.tsx]
  modified: [src/components/GridCard.tsx, src/components/CardGrid.tsx, src/screens/HomeScreen.tsx]
key-decisions:
  - "Card actions use one host-owned routing set for both long-press rows and accessibility actions."
  - "Card Log Interaction routes directly to the individual LogContact flow and never consults the list-swipe preference."
  - "Snooze preserves the profile's 3-day, 1-week, and 1-month choices and reconciles schedules after a committed write."
patterns-established:
  - "Icon action sheets compose BaseOverlay with themed semantic-icon Pressable rows instead of repurposing text-only OverflowMenu."
requirements-completed: [CARDV-04]
coverage:
  - id: D1
    description: Eight-item Card View long-press menu with state-aware labels and no destructive rows.
    requirement: CARDV-04
    verification:
      - kind: integration
        ref: npx tsc --noEmit && npm run check:colors
        status: pass
    human_judgment: true
    rationale: Pixel UAT must confirm long-press/tap disambiguation, sheet presentation, and locked row order.
  - id: D2
    description: Canonical per-contact action routing, including direct detailed log and accessibility actions.
    requirement: CARDV-04
    verification:
      - kind: integration
        ref: npm test
        status: pass
    human_judgment: true
    rationale: Device UAT must confirm navigation, native snooze choices, and action behavior from an actual card.
duration: 5m
completed: 2026-09-06
status: complete
---

# Phase 28 Plan 05: Card Context Menu Summary

**Card View now offers a locked eight-action long-press sheet and equivalent card-level accessibility actions, with direct canonical routing for each contact.**

## Performance

- **Duration:** 5m
- **Started:** 2026-09-06T09:05:40Z
- **Completed:** 2026-09-06T09:10:57Z
- **Tasks:** 3/3
- **Files modified:** 4

## Accomplishments

- Added a token-only `BaseOverlay` action sheet with the locked View Profile → Quick Log → Log Interaction → Message → Edit Contact → Favourite → Snooze → Select order.
- Made Card View long-presses host-owned while preserving tap-to-Profile and avoiding card swipe gestures.
- Routed menu and card-level assistive actions through the same canonical callbacks; detailed logging directly reaches `LogContact`, while Quick Log retains its truthful command path.

## Task Commits

1. **Task 1: CardContextMenu component — locked 8-item action sheet** — `992db69` (feat)
2. **Task 2: GridCard onLongPress + tap/long-press disambiguation** — `0e87b32` (feat)
3. **Task 3: HomeScreen menu state + canonical action routing** — `512ff88` (feat)

## Files Created/Modified

- `src/components/CardContextMenu.tsx` — Presentational themed icon sheet with state-aware Favourite and Snooze labels.
- `src/components/GridCard.tsx` — Long-press and six card-level accessibility action hooks.
- `src/components/CardGrid.tsx` — Per-contact callback plumbing to each presentational card.
- `src/screens/HomeScreen.tsx` — One-open-menu state, canonical routes, existing Quick Log/favourite reuse, snooze choices, and selection seeding.

## Decisions Made

- The long-press menu composes `BaseOverlay` instead of adapting `OverflowMenu`, because that API deliberately supports text-only rows.
- Menu and accessibility detailed-log actions call `navigateDashboardContactAction(id, "LogContact")` directly, independent of `dashboardRightSwipeAction`.
- Snooze uses the profile's exact 3-day, 1-week, and 1-month choices and refreshes/reconciles after successful writes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type error] Imported the icon-name type from its public registry module.**
- **Found during:** Task 1
- **Issue:** `Icon.tsx` consumes but does not export `IconName`, so the initial component import failed TypeScript checking.
- **Fix:** Imported the type from `icon-registry.ts` while keeping rendering through `Icon`.
- **Files modified:** `src/components/CardContextMenu.tsx`
- **Verification:** `npx tsc --noEmit` and `npm run check:colors` passed.
- **Committed in:** `992db69`

**2. [Rule 3 - Blocking] Added CardGrid callback forwarding required by the GridCard contract.**
- **Found during:** Task 2
- **Issue:** The planned GridCard callbacks must pass through the existing CardGrid boundary before HomeScreen can own routing.
- **Fix:** Added presentation-only per-contact callback plumbing without changing the grid's data/query behavior.
- **Files modified:** `src/components/CardGrid.tsx`
- **Verification:** `npx tsc --noEmit` and `npm run check:colors` passed.
- **Committed in:** `0e87b32`

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3)
**Impact on plan:** Both changes were required for the planned component interface to type-check and connect; no persistence, query, or destructive-action scope was added.

## Verification

- `npx tsc --noEmit` passed.
- `npm run check:colors` passed.
- `npm test` passed: 248 files and 2,323 tests.
- Source scans confirmed the direct card Log Interaction route, frozen-universe selection seed, no card swipe implementation, and no Delete/Archive context row.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 28-06 can render selection mode after Select enters the frozen current result universe. Device UAT remains required for long-press sheet visuals, native snooze choice presentation, tap/long-press behavior, and assistive action invocation.

## Self-Check: PASSED

- Confirmed the context menu, grid/card boundaries, and HomeScreen integration exist on disk.
- Confirmed task commits `992db69`, `0e87b32`, and `512ff88` are present in git history.
