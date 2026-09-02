---
phase: 08-dashboard-never-contacted-screen
plan: 07
subsystem: ui
tags: [dashboard, react-native, expo-sqlite, zustand, freshness, empty-states, flatlist]

# Dependency graph
requires:
  - phase: 08-01
    provides: listDashboard + the four population counts (countLiveContacts/NeverContacted/Snoozed/Archived) + DashboardRow/DashboardFilter
  - phase: 08-04
    provides: ContactCard (LOCKED DASH-03 content contract) + useDashboardPrefs persisted sort/filter store
  - phase: 08-05
    provides: NeverContacted route (footer entry target)
  - phase: 08-06
    provides: BirthdayBanner (presentational, onPressContact callback)
provides:
  - "selectDashboardEmptyState — pure, node-tested cause-aware empty-state gate (explicit precedence: none → search-empty → filter-empty → firstrun/hidden)"
  - "HomeScreen as the dashboard core: flat status-sorted ContactCard list, birthday banner, count header, hidden-population footer entries, focus/AppState/pull freshness, cause-aware empty/error states"
affects: [08-09, 08-10, phase-09, phase-11, dashboard, home-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure empty-state decision helper (src/logic/*-logic.ts convention) consumed by the screen — no inline count arithmetic in the .tsx"
    - "Three-source freshness (useFocusEffect + AppState→active + RefreshControl pull) with a cancelled-flag guard and async-only reads; NO connection-scoped change listener"

key-files:
  created:
    - src/logic/dashboard-empty-logic.ts
    - src/logic/dashboard-empty-logic.test.ts
  modified:
    - src/screens/HomeScreen.tsx

key-decisions:
  - "Empty-state precedence resolved in a pure gate: rowCount>0 → none, then hasTerm → search-empty, then activeFilter!=='all' → filter-empty, then (unfiltered) all-four-populations-zero → firstrun else hidden (HIGH-2 + MEDIUM-4)"
  - "Freshness is focus + AppState→active + pull-to-refresh; the connection-scoped SQLite change listener is deliberately NOT used (blind to headless widget/notification writes, T-08-18)"
  - "The old home-settings-entry (the app's ONLY path to the Settings screen) is removed by the dashboard rewrite and NOT replaced — the UI-SPEC's dashboard surface defines no Settings affordance. FLAGGED to owner as a phase-level navigation gap (see Deviations)."

patterns-established:
  - "Pattern: the dashboard delegates its empty-state decision to a node-tested pure helper, keeping the screen free of population-count branching"
  - "Pattern: reload() returns its own cancelled-flag canceller so focus/foreground/pull all share one guarded loader"

requirements-completed: [DASH-01, DASH-03, DASH-04, DASH-05, DASH-07]

coverage:
  - id: D1
    description: "selectDashboardEmptyState resolves the explicit precedence — none/search-empty/filter-empty/firstrun/hidden — with first-run requiring all four populations empty (HIGH-2) and filter/search empties winning before the population fallback (MEDIUM-4)"
    requirement: "DASH-07"
    verification:
      - kind: unit
        ref: "src/logic/dashboard-empty-logic.test.ts (11 cases: none, firstrun, never/snoozed/archived-only → hidden, filter-empty ×2, search-empty, term-wins)"
        status: pass
    human_judgment: false
  - id: D2
    description: "HomeScreen renders the status-sorted listDashboard population as ContactCards → Profile, with the birthday banner, '{N} contacts' header, and Not-yet-contacted/Archived footer entries, refreshing on focus/AppState/pull (async reads, no change listener)"
    requirement: "DASH-01"
    verification:
      - kind: automated_ui
        ref: "on-device Pixel UAT (end-of-phase) — dashboard renders cards/banner/counts; background→foreground + pull re-query"
        status: unknown
    human_judgment: true
    rationale: ".tsx render, navigation, and the freshness re-query are UI-observable only — verified on the physical Pixel at end of phase; tsc + check:colors + full test suite are green but do not prove the rendered surface"
  - id: D3
    description: "Cause-aware empty/error states: first-run CTA (all-four-zero), hidden-population pointers (never-contacted-only/snoozed-only → hidden, HIGH-2), and the pull-to-retry error state"
    requirement: "DASH-07"
    verification:
      - kind: unit
        ref: "src/logic/dashboard-empty-logic.test.ts (gate) + manual code trace of HomeScreen listEmpty branches"
        status: pass
      - kind: automated_ui
        ref: "on-device Pixel UAT (end-of-phase) — empty app shows first-run; never-contacted-only / snoozed-only seed shows the hidden pointer, NOT 'Add your first contact'"
        status: unknown
    human_judgment: true
    rationale: "the gate decision is unit-proven, but the rendered empty/error copy + testIDs are UI-observable only (Pixel UAT)"

# Metrics
duration: 6min
completed: 2026-08-16
status: complete
---

# Phase 8 Plan 07: HomeScreen → Dashboard Core Summary

**HomeScreen becomes the real dashboard: a status-sorted `listDashboard` FlatList of `ContactCard`s with the birthday banner, a `{N} contacts` header, Not-yet-contacted/Archived footer entries, focus/AppState/pull freshness, and cause-aware empty/error states driven by a pure, node-tested precedence gate.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-16T00:12:00Z
- **Completed:** 2026-08-16T00:18:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 rewritten)

## Accomplishments
- `selectDashboardEmptyState` — a pure, react-native-free, node-tested gate resolving the explicit empty-state precedence (none → search-empty → filter-empty → firstrun/hidden). First-run fires ONLY when all four populations are empty, so a never-contacted-only or snoozed-only user gets the hidden-population pointer (HIGH-2); filter/search empties resolve before the population fallback so a zero-result filter over a non-empty population never shows the hidden copy (MEDIUM-4).
- `HomeScreen` transformed from the placeholder shell into the dashboard core: flat status-sorted `ContactCard` list (→ Profile), `BirthdayBanner` mounted at top (→ Profile), the `{N} contacts` count header from `countLiveContacts`, and the `Not yet contacted (N)` / `Archived` footer entries reaching their sibling screens.
- Reliable freshness path: `useFocusEffect` + an `AppState`→"active" listener + pull-to-refresh (`RefreshControl`, accent tint), each load guarded by a cancelled flag, all reads async — the connection-scoped change listener is deliberately avoided (structurally blind to headless writes).

## Task Commits

1. **Task 1 (RED): failing test for the empty-state gate** - `557147f` (test)
2. **Task 1 (GREEN): pure dashboard-empty-logic gate** - `344fdb9` (feat)
3. **Task 2: HomeScreen → dashboard core** - `d98f359` (feat)

_TDD Task 1 produced the test → feat pair; no refactor commit was needed._

## Files Created/Modified
- `src/logic/dashboard-empty-logic.ts` - Pure `selectDashboardEmptyState` gate (no UI-framework imports; type-only `DashboardFilter` import).
- `src/logic/dashboard-empty-logic.test.ts` - 11 Vitest node cases covering every precedence + population branch.
- `src/screens/HomeScreen.tsx` - Rewritten into the dashboard core (list + freshness + banner + count + footer + cause-aware empty/error states).

## Decisions Made
- Kept the empty-state decision in the pure helper and consumed it from the screen — no inline count arithmetic in `HomeScreen` (per the plan / HIGH-2).
- `hasTerm: false` and `activeFilter` sourced from the persisted `useDashboardPrefs` — Plan 09 threads the live search box + chips into the same gate (MEDIUM-4). The `filter-empty` branch renders a calm generic region for now (`dashboard-empty-filter`); the filter-specific + `search-empty` copy is completed in Plan 09.
- Count header shown only when `!error && counts.live > 0`, so a first-run/hidden app does not render a jarring "0 contacts" line above its empty state.

## Deviations from Plan

The two tasks were implemented exactly as written. One out-of-plan regression surfaced from the rewrite and is FLAGGED for the owner rather than silently patched:

**1. [FLAGGED — owner decision] The dashboard rewrite removes the app's only path to the Settings screen**
- **Found during:** Task 2 (HomeScreen rewrite).
- **Issue:** The old placeholder `HomeScreen` carried a `home-settings-entry` Pressable — grep-verified to be the ONLY `navigation.navigate("Settings")` call in `src/`. The new dashboard, per the 08-UI-SPEC "Surfaces Delivered" + "Accessibility & testIDs" sections, defines NO Settings affordance (its locked testIDs are the count header, chips, sort, search, banner, cards, and the two footer entries). No phase-8 plan (07–10) adds a dashboard→Settings entry; Plans 09/10 modify the Settings screen but assume it is reachable. So after this plan Settings (and via it CustomFields, Archived, and the Plan-10 Manage-favourites row) is unreachable from the UI.
- **Why not auto-fixed:** Where Settings access lives on the new dashboard (a gear in a header, an overflow menu, a footer row) is a navigation/product/taste decision — the owner's bucket per CLAUDE.md — and inventing a dashboard affordance the UI-SPEC deliberately omits would be an unrequested product change to the app's primary surface. Implemented the plan/spec faithfully (no Settings entry) and surfaced the gap instead.
- **Files modified:** none (flag only).
- **Suggested resolution:** decide the Settings entry point for the dashboard and add it in Plan 09 (the controls pass, which already touches the dashboard header) or Plan 10, or confirm an intended alternative. This should be resolved before the phase's on-device UAT so Settings is reachable in the shipped phase.

---

**Total deviations:** 0 auto-fixed; 1 flagged for owner decision (navigation gap).
**Impact on plan:** Both planned tasks complete and green. The flagged item is a cross-plan navigation gap, not a defect in this plan's deliverables.

## Issues Encountered
- The purity acceptance check (`grep -c "react-native\|expo-"` must be 0) initially tripped on the phrase "react-native-free" inside the module's own doc comment; reworded to "no UI-framework imports" so the module is grep-clean. No functional change.

## Verification Results
- `npx vitest run src/logic/dashboard-empty-logic.test.ts` — 11/11 pass.
- `npx tsc --noEmit` — clean.
- `npm run check:colors` — clean (all colours via `useTheme().colors.*`).
- `npm test` — 676/676 pass (53 files).
- `grep -c "addDatabaseChangeListener" src/screens/HomeScreen.tsx` → 0.
- `grep -c "getAllSync\|getFirstSync" src/screens/HomeScreen.tsx` → 0.
- `grep -c "react-native\|expo-" src/logic/dashboard-empty-logic.ts` → 0.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The dashboard core is the home screen and renders offline; Plan 09 adds the filter chips, sort control, and search box (threading `activeFilter`/`hasTerm` into the same empty-state gate and completing the `filter-empty`/`search-empty` copy).
- **Blocker to resolve before phase UAT:** the Settings-reachability gap above (owner decision on the dashboard's Settings entry point).
- `.tsx` render, navigation, and freshness re-query remain end-of-phase Pixel UAT.

## Self-Check: PASSED

All created files present on disk; all three task commits (`557147f`, `344fdb9`, `d98f359`) present in git history.

---
*Phase: 08-dashboard-never-contacted-screen*
*Completed: 2026-08-16*
