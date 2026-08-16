---
phase: 08-dashboard-never-contacted-screen
plan: 09
subsystem: ui
tags: [react-native, dashboard, search, filter, sort, zustand, sqlite, expo]

# Dependency graph
requires:
  - phase: 08-07
    provides: "HomeScreen dashboard core (reload, freshness, FlatList header/footer, selectDashboardEmptyState wiring, persisted default sort/filter)"
  - phase: 08-04
    provides: "FilterChipRow presentational control + dashboard-prefs-store (persisted sort/filter)"
  - phase: 08-01
    provides: "listDashboard({filter,sort,term}) — term/filter/sort params, in-query off_limits/ai/archived exclusions, fuel-match snippet, LOW-2 precedence"
  - phase: 08-08
    provides: "ManageFavourites route (favourites-chip Manage target)"
provides:
  - "Dashboard controls layer: single-active FilterChipRow (all/needs-attention/category-{id}/battery-{value}/favourites/snoozed), 4-option sort control, live name+fuel search box"
  - "Persisted sort+filter across launches via useDashboardPrefs; local search term"
  - "Cause-aware empty states threaded through selectDashboardEmptyState with live activeFilter + hasTerm (search-empty / filter-empty / favourites 'No favourites yet')"
  - "Settings gear entry (owner-approved) restoring reach to the existing Settings route"
affects: [phase-10-search-relocation, phase-11-snooze]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controls persist via the store; the store change re-runs reload through the focus-effect callback-change mechanism (Plan 07), local term also a reload dep"
    - "Search folds into listDashboard (DAO owns matching + private-data exclusions); NO component-side .filter of private fuel"
    - "Empty-state decision fully delegated to the pure selectDashboardEmptyState gate — no inline count/precedence arithmetic in the screen"

key-files:
  created: []
  modified:
    - src/screens/HomeScreen.tsx

key-decisions:
  - "Sort control rendered as a 4-Pressable row (no segmented-control dep); container testID dashboard-sort-control, options dashboard-sort-option-{key}"
  - "Favourites 'Manage' affordance rendered as a separate header link shown only when the favourites filter is active (FilterChipRow is purely presentational and cannot host an affordance)"
  - "Settings gear uses a token-coloured ⚙ glyph (no @expo/vector-icons in the project); minimal top-right bar, owner's later design pass"

patterns-established:
  - "Filter/sort selection = persist-to-store; term = local useState; all three are reload deps so a change re-queries via the focus effect"
  - "Search-empty vs filter-empty vs hidden precedence lives entirely in selectDashboardEmptyState; the screen only picks copy per the returned enum"

requirements-completed: [DASH-02, DASH-04, DASH-06]

coverage:
  - id: D1
    description: "Single-active FilterChipRow (all/needs-attention/category-{id}/battery-{value}/favourites/snoozed with live count) drives listDashboard"
    requirement: "DASH-02"
    verification:
      - kind: automated_ui
        ref: "on-device UAT (Pixel, end-of-phase): filter by each chip"
        status: unknown
    human_judgment: true
    rationale: "Chip rendering + live re-query is UI-observable only; no unit test covers the assembled HomeScreen controls. Requires on-device UAT per phase verification block."
  - id: D2
    description: "4-option sort control (Status/Name (A–Z)/Least recent/Most recent) persisted across launches via useDashboardPrefs"
    requirement: "DASH-02"
    verification:
      - kind: automated_ui
        ref: "on-device UAT: sort four ways, confirm persistence across relaunch"
        status: unknown
    human_judgment: true
    rationale: "Persistence-across-relaunch is only verifiable by relaunching the app on-device; the store itself is unit-covered but the screen wiring is not."
  - id: D3
    description: "Live name+fuel search box folded into listDashboard; fuel-match renders the card snippet; no-match shows dashboard-search-empty; private data excluded in-query"
    requirement: "DASH-02"
    verification:
      - kind: automated_ui
        ref: "on-device UAT: search a name and a fuel word both return the contact; an off_limits-only term returns no match"
        status: unknown
    human_judgment: true
    rationale: "DAO matching + exclusions are unit-covered in dashboard-read tests; the screen's live search wiring and snippet render are UI-observable only."
  - id: D4
    description: "Favourites-chip Manage affordance navigates to ManageFavourites"
    requirement: "DASH-06"
    verification:
      - kind: automated_ui
        ref: "on-device UAT: select favourites chip, tap Manage, confirm ManageFavourites opens"
        status: unknown
    human_judgment: true
    rationale: "Navigation is UI-observable only."
  - id: D5
    description: "Owner-approved Settings gear (dashboard-settings-entry) navigates to the existing Settings route"
    verification:
      - kind: automated_ui
        ref: "on-device UAT: tap the dashboard Settings gear, confirm Settings opens"
        status: unknown
    human_judgment: true
    rationale: "Reachability fix is UI-observable only; owner also owns the exact styling design pass."

# Metrics
duration: ~18min
completed: 2026-08-16
status: complete
---

# Phase 8 Plan 9: Dashboard Controls (filter chips + sort + live search) Summary

**The dashboard header gains its full interactive control set — a single-active filter chip row, a 4-option persisted sort control, and a live name+fuel search box folded safely into `listDashboard` — plus an owner-approved Settings gear restoring reach to the Settings route.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-16T05:11:00Z (approx)
- **Completed:** 2026-08-16T05:29:12Z
- **Tasks:** 2 planned + 1 owner-approved addition
- **Files modified:** 1

## Accomplishments
- Single-active `FilterChipRow` built from real tables: `all`, `needs-attention`, one chip per category (via `listCategories`), one per social-battery value (`Charger`/`Neutral`/`Drain`), `favourites`, and `snoozed` (with its live `countSnoozed` count, legitimately 0 until Phase 11).
- 4-option sort control (`dashboard-sort-control`) — Status / Name (A–Z) / Least recent / Most recent — selection persisted via `useDashboardPrefs.setSort`.
- Chip + sort selection persist across launches (store); the store change re-runs `reload({filter,sort,term})` through the Plan-07 focus-effect mechanism.
- Live name+fuel search box (`dashboard-search-input`, placeholder "Search people and notes") holding the term in LOCAL state, with a `dashboard-search-clear` control; the term threads into `listDashboard` so a present term switches the list to the search result set live.
- Empty states threaded through `selectDashboardEmptyState` with the live `activeFilter` + `hasTerm`: zero-result search → `dashboard-search-empty` ("No matches for {term}"), zero-result non-'all' filter → filter-empty (favourites → "No favourites yet" + pointer to the profile star), never the hidden-population copy over a non-empty population (MEDIUM-4).
- Favourites-chip "Manage" affordance → `navigation.navigate("ManageFavourites")`.
- Owner-approved: Settings gear (`dashboard-settings-entry`, accessibilityLabel "Settings") → `navigation.navigate("Settings")`, restoring reach lost in the 08-07 rewrite.

## Task Commits

Each task was committed atomically:

1. **Task 1: Chip filter row + 4-option sort control + persistence** - `63cd297` (feat)
2. **Task 2: Live name+fuel search box folded into the list** - `12c7ce6` (feat)
3. **Owner addition: Settings gear in the dashboard header** - `e9b6efb` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/screens/HomeScreen.tsx` - Added the controls layer: FilterChipRow + chip list assembly, the 4-option sort control, the live search box + clear, favourites Manage affordance, search-empty/favourites-empty rendering (threading live activeFilter + hasTerm into the empty-state gate), and the owner-approved Settings gear.

## Decisions Made
- **Sort control as a 4-Pressable row** rather than pulling in a segmented-control dependency — matches the shipped filled-accent chip idiom and keeps the dependency surface flat.
- **Favourites "Manage" as a separate header link** (shown only when the favourites filter is active) — `FilterChipRow` is deliberately purely presentational (no navigation), so the affordance lives in the parent, consistent with its Plan-04 contract.
- **Settings gear uses a token-coloured `⚙` glyph** — `@expo/vector-icons` is not installed in the project; a text glyph keeps it token-clean (`colors.textSecondary`) and check:colors-clean. Exact styling is explicitly the owner's later design pass.
- **No debounce on search** — mirrors the shipped `FuelSearch` idiom; local SQLite is fast at this scale, and the `cancelled` flag already drops stale async results.

## Deviations from Plan

The plan text specified two tasks; a third change — the **Settings gear** — was an explicit owner-approved addition passed in the execution brief (reachability-gap fix, since the 08-07 dashboard rewrite dropped the placeholder's Settings entry). It is committed separately (`e9b6efb`) and flagged here as beyond the plan text, not a silent scope change. No other deviations: the DAO already owns term matching + off_limits/ai/archived exclusions and the LOW-2 favourites+term precedence, so no component-side special-casing or DAO edits were needed.

**Total deviations:** 1 owner-approved addition (Settings gear). No auto-fixed bugs.
**Impact on plan:** The addition is a small, isolated reachability fix. No scope creep into the DAO or other subsystems.

## Issues Encountered
None — `listDashboard` already accepted `term` and resolved all precedence/exclusion rules (Plan 01), so Task 2 was purely a wiring change. tsc, check:colors, and all 676 tests stayed green throughout.

## Threat Model Compliance
- **T-08-20 (SQL injection via search term):** mitigated — the term is passed only to `listDashboard` (which `?`-binds + `escapeLike`s it); the screen builds no SQL.
- **T-08-21 (information disclosure):** mitigated — off_limits + unconfirmed-ai + archived excluded in-query; the screen performs no `.filter()` on private fuel, and the snippet comes only from the DAO's excluded subquery.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DASH-02 (full sort/filter/search) is complete; the dashboard search box is now the canonical search surface.
- Plan 10 can retire the standalone Settings→FuelSearch entry (the search has relocated here).
- The `snoozed` chip count + segment stay legitimately empty until Phase 11 writes `snooze_until`.
- On-device UAT (Pixel, end-of-phase) still owes: per-chip filtering, four-way sort + relaunch persistence, name+fuel search returns, off_limits-only term returns nothing, snoozed count shows, and the Settings gear + favourites Manage navigations.

---
*Phase: 08-dashboard-never-contacted-screen*
*Completed: 2026-08-16*

## Self-Check: PASSED
- FOUND: src/screens/HomeScreen.tsx
- FOUND commit: 63cd297 (Task 1)
- FOUND commit: 12c7ce6 (Task 2)
- FOUND commit: e9b6efb (Settings gear)
- tsc --noEmit clean; check:colors PASS; 676/676 tests pass; 0 getAllSync/getFirstSync in HomeScreen.tsx
