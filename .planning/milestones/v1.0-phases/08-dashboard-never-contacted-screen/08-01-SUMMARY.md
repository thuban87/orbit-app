---
phase: 08-dashboard-never-contacted-screen
plan: 01
subsystem: database
tags: [sqlite, dashboard, read-model, search, status-engine, fuel-ranking]

# Dependency graph
requires:
  - phase: 02-status-engine
    provides: PROGRESS_SQL / STATUS_SQL query-time fragments + STABLE_MAX threshold (status.ts)
  - phase: 07-conversational-fuel
    provides: getRankedFuel + the fuel exclusion/rank fragments + escapeLike (fuel-read.ts)
  - phase: 01-data-layer
    provides: migration 001 (contacts.favourite_rank / snooze_until / birthday / category_id columns), node:sqlite testkit
provides:
  - "dashboard-read.ts — the single node-tested read chokepoint for the dashboard list, the never-contacted list, the four population counts, and the birthday candidates"
  - "listDashboard with four mutually-exclusive population branches (term / favourites / snoozed / default) + term-wins precedence"
  - "listNeverContacted, listFavourites, countNeverContacted, countSnoozed, countArchived, countLiveContacts, listBirthdayCandidates"
  - "DashboardRow / DashboardFilter / DashboardSort / NeverContactedSort / FavouriteRow / BirthdayCandidate types"
  - "fuel-read.ts now EXPORTS escapeLike + RANKED_FUEL_EXCLUSIONS + RANK_CASE (shared single-source fragments)"
affects: [08-02, 08-03, 08-04, 08-05, 08-06, 08-07, 08-08, 08-09, 08-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read chokepoint composes existing query-time fragments (status + fuel) instead of re-deriving thresholds/exclusions"
    - "Four mutually-exclusive WHERE branches (not fixed-base + append) for populations that relax vs narrow the base"
    - "CASE-wrapped status/progress projection so a NULL last_contact reads null, never STATUS_SQL's ELSE-'stable'"
    - "Extraction guarded by a SQL parity test (independent SELECT over the exported fragment == getRankedFuel)"

key-files:
  created:
    - src/db/dashboard-read.ts
    - src/db/dashboard-read.test.ts
  modified:
    - src/db/fuel-read.ts
    - src/db/fuel-read.test.ts

key-decisions:
  - "Followed the plan's review-hardened contracts exactly — no simplification of the four-branch construction or the CASE wrapper"

patterns-established:
  - "Shared SQL fragment export + parity test: extract once, guard with an independent-SELECT parity assertion so it cannot drift"
  - "Population-branch precedence (term > favourites > snoozed > default) documented in-file and per-branch tested"

requirements-completed: [DASH-01, DASH-02, DASH-04, DASH-07]

coverage:
  - id: D1
    description: "listDashboard: four mutually-exclusive population branches, four sorts, five filters, search escaping, fuelText parity, HIGH-1 null status/progress across all never-contacted paths"
    requirement: "DASH-01"
    verification:
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#listDashboard — default population + exclusions + snooze"
        status: pass
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#listDashboard — filters (four mutually-exclusive branches)"
        status: pass
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#listDashboard — search"
        status: pass
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#listDashboard — fuelText parity + A-1 null-progress ordering"
        status: pass
    human_judgment: false
  - id: D2
    description: "listNeverContacted — inverse population with literal null status/progress and its own three sorts"
    requirement: "DASH-02"
    verification:
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#listNeverContacted"
        status: pass
    human_judgment: false
  - id: D3
    description: "listFavourites — non-archived favourites ordered by favourite_rank ASC (Manage-favourites source)"
    requirement: "DASH-04"
    verification:
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#listFavourites"
        status: pass
    human_judgment: false
  - id: D4
    description: "Four population counts (countLiveContacts pinned per HIGH-2) + listBirthdayCandidates"
    requirement: "DASH-07"
    verification:
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#counts"
        status: pass
      - kind: unit
        ref: "src/db/dashboard-read.test.ts#listBirthdayCandidates"
        status: pass
    human_judgment: false
  - id: D5
    description: "fuel-read.ts exports the shared ranked-fuel fragments; getRankedFuel behaviourally unchanged, parity-guarded"
    verification:
      - kind: unit
        ref: "src/db/fuel-read.test.ts#exported RANKED_FUEL_EXCLUSIONS + RANK_CASE — parity with getRankedFuel"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-08-15
status: complete
---

# Phase 8 Plan 01: Dashboard read chokepoint Summary

**A pure read-only `dashboard-read.ts` that composes status.ts + the fuel fragments into ONE parametrized card read (four mutually-exclusive population branches, cross-contact search, ranked-fuel line, counts, birthday candidates), plus the never-contacted inverse read — all node-tested, with the shared fuel fragments extracted and parity-guarded in fuel-read.ts.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Extracted `escapeLike`, `RANKED_FUEL_EXCLUSIONS`, and `RANK_CASE` as exported single-source fragments in `fuel-read.ts`; `RANKED_FUEL` now composes the exclusions constant so the dashboard card line and the ranked fuel line can never drift (guarded by a new parity test block).
- Built `listDashboard(exec, {filter, sort, term})` with the review-mandated FOUR mutually-exclusive population branches (term / favourites / snoozed / default), term-wins-over-favourites precedence, the CASE-wrapped status/progress projection (HIGH-1), the correlated ranked-fuel subquery, and the search-only snippet subquery — every runtime value `?`-bound, every exclusion in-query.
- Added `listNeverContacted` (literal null status/progress), `listFavourites`, the four population counts (`countLiveContacts` pinned to `archived_at IS NULL AND last_contact IS NOT NULL` per HIGH-2), and `listBirthdayCandidates`.
- 54 tests pass across both files (23 fuel-read incl. new parity block, 31 dashboard-read), tsc clean, check:colors clean, Biome clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Export the shared ranked-fuel fragment + escapeLike from fuel-read.ts** - `cd3cbba` (refactor)
2. **Task 2: dashboard-read.ts — listDashboard + never-contacted + counts + birthday candidates** - `a5d3d52` (feat)

_Note: both tasks are TDD-tagged; each was committed as a single test+impl unit since Task 1 is a parity-guarded extraction of working code and Task 2 lands the module with its exhaustive suite together._

## Files Created/Modified
- `src/db/dashboard-read.ts` - The dashboard read chokepoint (listDashboard, listNeverContacted, listFavourites, four counts, listBirthdayCandidates + row/filter/sort types).
- `src/db/dashboard-read.test.ts` - Exhaustive node:sqlite suite covering every behaviour bullet and every numbered review contract.
- `src/db/fuel-read.ts` - Exported `escapeLike` / `RANKED_FUEL_EXCLUSIONS` / `RANK_CASE`; `RANKED_FUEL` now composed from the exclusions constant (single source).
- `src/db/fuel-read.test.ts` - Added the extraction parity block + an `escapeLike` ordering test.

## Decisions Made
None - followed the plan's review-hardened contracts exactly.

## Deviations from Plan

None - plan executed exactly as written. (Biome's auto-formatter reordered the new named imports in three touched files during the format gate; that is tooling-driven formatting, not a behavioural change.)

## Issues Encountered
- Status/progress derive from the real `date('now','localtime')` clock, so the tests cannot pin `now`. Resolved by seeding `last_contact` / `snooze_until` / `created_at` as dates computed RELATIVE to today (`localDateOffset`), keeping progress buckets deterministic regardless of run date — matching the repo's local-wall-clock storage convention.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The dashboard data layer is complete and node-tested; the remaining Phase 8 plans (ContactCard, FilterChipRow, BirthdayBanner, HomeScreen transform, NeverContactedScreen, ManageFavouritesScreen, favourites DAO, birthday logic) can build presentationally on top of these reads without re-deriving any predicate/sort/search.
- `countSnoozed` and the `snoozed` filter segment are legitimately empty until Phase 11 ships a `snooze_until` writer — documented in-file, not a blocker.

---
*Phase: 08-dashboard-never-contacted-screen*
*Completed: 2026-08-15*

## Self-Check: PASSED
- src/db/dashboard-read.ts — FOUND
- src/db/dashboard-read.test.ts — FOUND
- 08-01-SUMMARY.md — FOUND
- Commit cd3cbba — FOUND
- Commit a5d3d52 — FOUND
