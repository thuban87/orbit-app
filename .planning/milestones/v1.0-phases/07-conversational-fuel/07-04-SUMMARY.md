---
phase: 07-conversational-fuel
plan: 04
subsystem: database
tags: [sqlite, search, like-escape, react-navigation, fuel, ui]

# Dependency graph
requires:
  - phase: 07-conversational-fuel (Plan 01)
    provides: fuel-read.ts choke-point module (listFuelForEditor)
  - phase: 07-conversational-fuel (Plan 02)
    provides: getRankedFuel + the off_limits/source='ai' in-query exclusion pattern
provides:
  - "searchFuel(exec, term) — cross-contact fuel search (name OR fuel text) as a reusable DAO read"
  - "FuelSearchResult interface — { contactId, name, snippet }"
  - "FuelSearchResultRow — reusable presentational search-result row (Avatar + name + snippet)"
  - "FuelSearch screen — minimal cross-contact search surface reached from Settings"
  - "FuelSearch route in RootStackParamList + a Settings Search entry"
affects: [phase-08-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LIKE ? ESCAPE '\\' with JS-side metacharacter escaping (\\ then % then _) — literal %/_ search, no glob mis-match"
    - "Search excludes off_limits AND unconfirmed source='ai' IN-QUERY (both snippet subquery and EXISTS), aligning with getRankedFuel"
    - "Query + result-row shipped as reusable units for Phase 8 absorption (no throwaway welding)"

key-files:
  created:
    - src/components/FuelSearchResultRow.tsx
    - src/screens/FuelSearch.tsx
  modified:
    - src/db/fuel-read.ts
    - src/db/fuel-read.test.ts
    - src/navigation/types.ts
    - src/navigation/RootNavigator.tsx
    - src/screens/SettingsScreen.tsx

key-decisions:
  - "AI exclusion is a safe SUPERSET of FUEL-05's off_limits-only mandate — keeps unconfirmed-AI a profile-only concept until Plan 03's confirm flips 'ai' → 'manual'"
  - "FuelSearchResultRow stays purely presentational (no DB, no navigation) so Phase 8 reuses it under the dashboard search box without a rewrite"
  - "Result row Avatar renders initials (photo={null}) — searchFuel omits photo to stay a lean projection"

patterns-established:
  - "escapeLike() helper: backslash-first metacharacter escape, applied before %…% wrapping and bound to LIKE ? ESCAPE '\\'"
  - "Screen chrome mirrors CustomFieldsScreen (themed root, header + Back + 24/700 title)"

requirements-completed: [FUEL-05]

coverage:
  - id: D1
    description: "searchFuel matches name OR non-off_limits/non-'ai' fuel text via a ?-bound, ESCAPE '\\'-escaped LIKE scan; excludes off_limits, unconfirmed source='ai', and archived contacts; dedups per contact; empty term returns []"
    requirement: "FUEL-05"
    verification:
      - kind: unit
        ref: "src/db/fuel-read.test.ts#searchFuel — name OR fuel text, off_limits/ai/archived excluded, escaped"
        status: pass
    human_judgment: false
  - id: D2
    description: "Literal %/_/backslash ESCAPE correctness — a term with a literal metacharacter matches only rows literally containing it, not as a wildcard"
    requirement: "FUEL-05"
    verification:
      - kind: unit
        ref: "src/db/fuel-read.test.ts#literal-% ESCAPE / literal-_ ESCAPE / literal-backslash ESCAPE"
        status: pass
    human_judgment: false
  - id: D3
    description: "FuelSearch screen (reached from Settings) queries searchFuel, renders idle/results/no-matches states, and taps a result into the contact's Profile; FuelSearchResultRow is reusable and presentational"
    requirement: "FUEL-05"
    verification:
      - kind: automated_ui
        ref: "npx tsc --noEmit && npm run check:colors && npx biome check (5 touched files)"
        status: pass
    human_judgment: true
    rationale: "On-device UAT is the phase gate (search a name and a fuel word both return the contact; off_limits-only term returns no match; an archived contact never appears) — deferred to the Pixel per phase constraints; not built/driven here."

# Metrics
duration: 3min
completed: 2026-08-16
status: complete
---

# Phase 7 Plan 4: Cross-contact fuel search Summary

**`searchFuel` — a ?-bound, `LIKE ? ESCAPE '\'`-escaped scan matching contact name OR non-off_limits/non-'ai' fuel text (off_limits + unconfirmed AI + archived excluded in-query, deduped per contact) — plus a minimal Settings-reached FuelSearch screen and a reusable FuelSearchResultRow that Phase 8 absorbs into the dashboard.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-16T00:17:15Z
- **Completed:** 2026-08-16T00:20:43Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `searchFuel(exec, term)` added to the fuel-read choke point: name OR fuel-text match, off_limits + unconfirmed `source='ai'` + archived excluded IN-QUERY (both the snippet subquery and the EXISTS predicate), one row per contact, ordered by name; empty/whitespace term returns `[]` before querying.
- LIKE metacharacter safety: `escapeLike()` escapes `\` → `\%` → `_` (backslash first) and every predicate uses `LIKE ? ESCAPE '\'`, so a term containing a literal `%`/`_`/`\` matches only rows literally containing that character — proven by three dedicated ESCAPE tests.
- 10 new node-tested cases (name-only → snippet null; fuel-text → snippet; off_limits never matches/snippets; unconfirmed-ai never matches while manual/user/share do; archived excluded; literal `%`/`_`/`\`; dedup; empty term).
- Minimal `FuelSearch` screen (reached from a new Settings "Search" row) driving `searchFuel` into a `FlatList` of the new reusable, presentational `FuelSearchResultRow`; tap → `Profile`. Route registered in `RootStackParamList` + `RootNavigator`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing searchFuel tests** - `e353df9` (test)
2. **Task 1 (GREEN): searchFuel implementation** - `e6390fb` (feat)
3. **Task 2: FuelSearch screen + result row + route + Settings entry** - `56d4f90` (feat)

_Note: Task 1 is a TDD task (test → feat); no refactor commit was needed._

## Files Created/Modified
- `src/db/fuel-read.ts` - Added `searchFuel` + `FuelSearchResult` + `escapeLike`; static SQL, three `?`-bound escaped params, off_limits/ai/archived excluded.
- `src/db/fuel-read.test.ts` - Added `searchFuel` describe (10 cases) + a `seedArchivedContact` helper + `addFuelRow` helper.
- `src/components/FuelSearchResultRow.tsx` - Reusable presentational row (Avatar + name 15/400 + snippet 13/600 ellipsised, minHeight 44); no DB/navigation import.
- `src/screens/FuelSearch.tsx` - Minimal search screen (themed input → `searchFuel` → FlatList; idle/no-match/results states; tap → Profile).
- `src/navigation/types.ts` - Added `FuelSearch: undefined` to `RootStackParamList`.
- `src/navigation/RootNavigator.tsx` - Registered `<Stack.Screen name="FuelSearch" …>`.
- `src/screens/SettingsScreen.tsx` - Added a "Search" row navigating to `FuelSearch`.

## Decisions Made
- **AI exclusion beyond FUEL-05's mandate:** search excludes both off_limits AND unconfirmed `source='ai'`, mirroring `getRankedFuel`. FUEL-05 mandates only off_limits; the AI exclusion is a safe superset that keeps an unconfirmed AI proposal a profile-only concept until Plan 03's confirm flips `'ai'` → `'manual'`. Documented in the `searchFuel` header (addresses review HIGH-1). This is coherence with an existing in-query exclusion, not a reversal of any recorded decision.
- **No photo in the search projection:** `searchFuel` returns `{ contactId, name, snippet }` only; the result-row Avatar renders initials (`photo={null}`). Keeps the read lean and matches the plan's exact prop contract.
- **Presentational result row:** `FuelSearchResultRow` takes `onPress` and imports no DB/navigation, so Phase 8 reuses it verbatim under the dashboard search box.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Results
- `npx vitest run src/db/fuel-read.test.ts` — 19 passed (9 prior + 10 new searchFuel).
- `npx vitest run` (full suite) — 572 passed across 48 files.
- `npx tsc --noEmit` — exit 0.
- `npm run check:colors` — exit 0 (zero net-new tokens; no hardcoded colour).
- `npx biome check` (5 touched UI/nav files) — exit 0.
- `git status src/db/migrations/` — clean (no FTS5 table, no new migration).

## Next Phase Readiness
- FUEL-05 code-complete; Phase 7's four slices are done. `searchFuel` + `FuelSearchResultRow` are the reusable units Phase 8 absorbs into the dashboard search box (INDEX `[dashboard → fuel]`).
- Outstanding: on-device UAT of the FuelSearch screen on the Pixel (name match, fuel-word match, off_limits-only → no match, archived never appears) — deferred per phase constraints; not driven here.

## Self-Check: PASSED
- `src/components/FuelSearchResultRow.tsx` — FOUND
- `src/screens/FuelSearch.tsx` — FOUND
- Commits `e353df9`, `e6390fb`, `56d4f90` — all present in git log.

---
*Phase: 07-conversational-fuel*
*Completed: 2026-08-16*
