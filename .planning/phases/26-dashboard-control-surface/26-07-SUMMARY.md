---
phase: 26-dashboard-control-surface
plan: 07
subsystem: ui
tags: [dashboard, search, react-native, reanimated, zustand, sqlite, vitest]

# Dependency graph
requires:
  - phase: 26-01
    provides: dashboard-query-store (viewMode/populations/filters/sort), semantic icon registry, dashboard-empty-logic 5-key DashboardPopulationCounts
  - phase: 26-02
    provides: DashboardControlRow (Population/Filters/Sort control row)
  - phase: 26-03
    provides: listDashboardSearch (A3-scoped bound-only search), countBirthdayPopulation/countFavourites/countAllContacts, control-labels POPULATION_LABELS
  - phase: 26-04
    provides: header destinations + overflow chrome
provides:
  - Dashboard Row 3 — collapsible session-backed search + right-aligned List/Card view toggle (DASHC-07)
  - Completed DASHC-01 top-to-bottom hierarchy (header → control row → search+toggle → collection)
  - D-12 read wiring — listDashboardSearch (has-term) / listDashboardPopulation (no-term) on a single per-reload `now`
  - Idempotent persisted viewMode toggle (call-site guard + hardened setViewMode store setter)
  - SegmentedControl extended with an optional `icon?: IconName` (filled/outline) field
  - Legacy listDashboard + listNeverContacted retired with no dual-read; D-03 count/policy machinery preserved
affects: [27-dashboard-list-view, 28-dashboard-card-view, 36-backup]

# Actuals (#2632)
actuals:
  tokens: 21711
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reduced-motion + focus/background-gated Reanimated timing (mirrors AnchoredPanel/OrreryScreen) for the search collapse"
    - "Debounce-over-session-state drives the read; cancelled-flag is only the stale-result backstop"
    - "Store-setter idempotency guard (no-op on unchanged value) paired with a call-site equality guard"

key-files:
  created: []
  modified:
    - src/components/SegmentedControl.tsx
    - src/screens/HomeScreen.tsx
    - src/stores/dashboard-query-store.ts
    - src/stores/dashboard-query-store.test.ts
    - src/db/dashboard-read.ts
    - src/db/dashboard-read.test.ts
    - src/db/fuel-read.ts
    - src/services/widget/widget-data.ts
    - src/services/widget/widget-data.test.ts

key-decisions:
  - "SegmentedControl.icon typed IconName (not bare string) so tsc gates an unregistered icon at the call site"
  - "One localDateTime() per reload threaded to the list read AND countBirthdayPopulation (coherent across local midnight)"
  - "populationCounts is the COMPLETE 5-key record from cheap dedicated counts, never N full population scans"
  - "List/Card toggle idempotency enforced at BOTH the call site and the store setter"
  - "D-03 coverage LIFTED into the counts block (countNeverContacted-only) before deleting the listNeverContacted block"
  - "BASE_WHERE left exported (referenced by capture-read/orrery-read docs); D-03 app_settings machinery untouched"

patterns-established:
  - "Row-3 collapsible search: ephemeral session-store term + debounced read + reduced-motion-aware Reanimated collapse"

requirements-completed: [DASHC-01, DASHC-07]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Row 3 collapsible session-backed search + right-aligned List/Card toggle (DASHC-07): expand/collapse motion, reduced-motion instant, session restore on Dashboard→Profile→Back, 44px targets"
    requirement: DASHC-07
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (compile + icon-name gate) / npm run check:colors"
        status: pass
    human_judgment: true
    rationale: "Visual layout, collapse/expand animation, reduced-motion behaviour, session restore, and 44px targets at OS text scale are render/device-observable only — deferred to the Pixel UAT (26-VALIDATION.md); vitest is render-free."
  - id: D2
    description: "List/Card view-toggle idempotency: re-selecting the active segment neither persists to SQLite nor bumps the store generation (call-site guard + hardened setViewMode)"
    requirement: DASHC-07
    verification:
      - kind: unit
        ref: "src/stores/dashboard-query-store.test.ts#no-ops a same-value setViewMode: no app_settings write and no store change"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-12 read layer + empty-state counts: listDashboardSearch A3 scope, and the bound-only countBirthdayPopulation/countFavourites/countAllContacts feeding the 5-key populationCounts"
    requirement: DASHC-01
    verification:
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#listDashboardSearch — population-aware search + A3 scope (+ counts blocks)"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit (exact Record<DashboardPopulation, number> gate on populationCounts)"
        status: pass
    human_judgment: false
  - id: D4
    description: "HomeScreen search behaviour on-device: debounced term drives one read, bound-only name/notes matches, no-match + population-specific empties render, results update behind an open panel"
    requirement: DASHC-01
    verification: []
    human_judgment: true
    rationale: "The HomeScreen reload/empty-state wiring has no render test (render-free vitest); live search results, empty-state copy routing, and live-apply-behind-panel are verified at the Pixel UAT."
  - id: D5
    description: "Legacy listDashboard + listNeverContacted retired with no dual-read; obsolete test blocks removed by name, preserved blocks stay green"
    verification:
      - kind: unit
        ref: "grep gate (bare listDashboard/listNeverContacted excl Population/Search) returns nothing in src"
        status: pass
      - kind: unit
        ref: "npm test (238 files / 2246 tests pass; listDashboardPopulation — Phase 25 Active universe block preserved)"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-03 count/policy machinery preserved: countNeverContacted + readIncludeUnboundNeverContacted + include_unbound_never_contacted read + app_settings keys intact; coverage lifted into the counts block"
    verification:
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#countNeverContacted excludes an Unbound never-contacted contact until the persisted opt-in (D-03 coverage)"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-09-05
status: complete
---

# Phase 26 Plan 07: Dashboard Control Surface — Search + View Toggle Row Summary

**Row 3 collapsible session-backed search + right-aligned List/Card toggle completes the DASHC-01 hierarchy, wired onto the D-12 `listDashboardSearch` read with a complete 5-key `populationCounts`, while the legacy `listDashboard`/`listNeverContacted` reads are retired with no dual-read and the D-03 count/policy machinery preserved.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-05T14:28:44Z
- **Completed:** 2026-09-05T14:44:58Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Completed the DASHC-01 top-to-bottom Dashboard hierarchy: header → Population/Filters/Sort control row → **Row 3 search + List/Card toggle** → contact collection.
- Shipped the collapsible, session-backed search (ephemeral `dashboard-session-store` term, restored on Dashboard→Profile→Back) with a 220ms debounce driving the read and a reduced-motion-aware, focus/background-gated Reanimated collapse.
- Extended `SegmentedControl` with an optional `icon?: IconName` field (filled active / outline inactive), keeping the label-only Orrery consumer unchanged; the `IconName` typing gates an unregistered icon at the call site.
- Wired the D-12 read seam: `listDashboardSearch` (has-term) / `listDashboardPopulation` (no-term) on a single per-reload `now`, threaded to `countBirthdayPopulation` so the birthday list and its empty-state count stay coherent across local midnight.
- Fed the empty-state gate the COMPLETE 5-key `DashboardPopulationCounts` from cheap dedicated counts (birthdays/favourites/all-contacts + existing not-contacted/snoozed), and rendered the search-empty + population-specific empties.
- Enforced List/Card toggle idempotency at both the call site and the hardened `setViewMode` store setter (no persist / no set() / no generation bump on an unchanged value), covered by a node test.
- Retired the legacy `listDashboard` + `listNeverContacted`/`listNeverContactedWithPolicy` reads with **no dual-read**, deleting their obsolete describe blocks by name and lifting the D-03 coverage into the surviving `counts` block; preserved `countNeverContacted` + `readIncludeUnboundNeverContacted` + the `include_unbound_never_contacted` read and every `app_settings` key.

## Task Commits

1. **Task 1: Search + List/Card toggle row** - `89e1d7d` (feat)
2. **Task 2: Wire D-12 listDashboardSearch read + 5-key populationCounts** - `c80817c` (feat)
3. **Task 3: Retire legacy listDashboard + listNeverContacted (no dual-read)** - `cb25c70` (refactor)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `src/components/SegmentedControl.tsx` - Optional `icon?: IconName` field rendering the semantic Icon (filled active / outline inactive)
- `src/screens/HomeScreen.tsx` - Row 3 search+toggle, session-store term + debounce, D-12 read wiring, single-`now` reload, 5-key populationCounts, search/population empty renders
- `src/stores/dashboard-query-store.ts` - `setViewMode` idempotency guard
- `src/stores/dashboard-query-store.test.ts` - same-value `setViewMode` no-op test
- `src/db/dashboard-read.ts` - Removed `listDashboard`/`listNeverContacted`/`listNeverContactedWithPolicy` + unused `NeverContactedSort`/`NC_SORT`/`STABLE_MAX`; swept stale comments
- `src/db/dashboard-read.test.ts` - Deleted nine legacy describe blocks by name; lifted the D-03 `countNeverContacted` opt-in coverage into the `counts` block
- `src/db/fuel-read.ts` - Swept a stale comment naming the retired read
- `src/services/widget/widget-data.ts` / `widget-data.test.ts` - Swept stale comments naming the retired read

## Decisions Made
- **BASE_WHERE kept exported** — no runtime caller remains, but `capture-read.ts`/`orrery-read.ts` docs reference it by name as a documented predicate; removing it is not required (exported const, not flagged) and would be out-of-scope churn.
- **D-03 coverage lifted before deletion** — the `listNeverContacted` block's Unbound-opt-in test also exercised `countNeverContacted`; a new `counts`-block test now asserts the `include_unbound_never_contacted` × `countNeverContacted` interaction using `countNeverContacted` only, so the D-03-adjacent coverage survives the block's removal.
- **View toggle rendered icon-only** — the List/Card segments render the semantic icon (filled active) with the label as `accessibilityLabel`; the search input takes the remaining row width and the toggle wrapper is pinned to a 96px width so each 44px segment target holds.

## Deviations from Plan

None - plan executed exactly as written.

The plan anticipated (and the file confirmed) that its Task 3 line-number hints were approximate; the deletion was performed by describe-block NAME (segmenting on top-level `describe(` boundaries), and the preserved-block grep (`listDashboardPopulation — Phase 25 Active universe` still present) confirms the surgical approach held. Newly-orphaned unused symbols (`NeverContactedSort`, `NC_SORT`, `STABLE_MAX`, the `DECAY` test helper) were removed as biome flagged them — consistent with the plan's "remove now-unused legacy types only if tsc/biome flags them" instruction, not a scope deviation.

## Issues Encountered
- **STATE.md tooling clobber (known hazard):** the `state.load` invocation at startup rewrote `.planning/STATE.md`, resetting "Plan 7 of 7 / Ready to execute" to "Plan 1 of 7 / Executing". Handled per the recorded MEMORY hazard — STATE.md was hand-corrected at plan close (kept out of every task commit) rather than trusting the tooling counters.
- No git pre-commit hooks are installed in this repo; Biome (the project standard) was run manually with `--write` on every touched file and re-verified clean before each commit.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DASHC-01/DASHC-07 complete; Phase 26 is the final plan of the phase (7/7).
- The List/Card toggle persists `viewMode` only — the row/grid rendering it switches between is Phase 27 (List) / Phase 28 (Card).
- D-03 legacy-key removal remains coordinated with the Phase 36 backup format bump (not this plan's).
- **Deferred to Pixel UAT (render-free vitest cannot assert):** collapsible-search reduced-motion + no half-run animation after backgrounding, search+toggle 44px targets at 200% OS text scale, live bound-only search results, and population-specific empty-state routing (26-VALIDATION.md backstops).

## Self-Check: PASSED

- All modified key-files present on disk.
- All three task commits present in git log (89e1d7d, c80817c, cb25c70).
- Full gate green: `npx tsc --noEmit`, `npm run check:colors`, `npm test` (238 files / 2246 tests), Task 3 grep gate returns nothing.
