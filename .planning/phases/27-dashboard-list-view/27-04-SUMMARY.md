---
phase: 27-dashboard-list-view
plan: 04
subsystem: dashboard-ui
tags: [react-native, accessibility, optimistic-ui, sqlite, vitest]
requires:
  - phase: 27-dashboard-list-view
    provides: DashboardRow list tracer, batched knowledge candidates, deterministic line-three selection, and semantic favorite icon registry.
provides:
  - Colour-independent List-row descriptions with a shared status-label source.
  - Three-line List anatomy with an accessible binary favourite control.
  - Generation-safe, reload-safe optimistic favourite membership and batched line-three screen wiring.
affects: [27-05, 27-06, 28-dashboard-card-view]
actuals:
  tokens: 6313
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns: [RN-free shared display labels, useSyncExternalStore optimistic overlay, cancellation-guarded batched row enrichment]
key-files:
  created: [src/components/icons/status-display-label.ts, src/logic/favourite-optimistic.ts, src/logic/favourite-optimistic.test.ts]
  modified: [src/components/icons/StatusGlyph.tsx, src/components/list-row-content.ts, src/components/list-row-content.test.ts, src/components/ListRow.tsx, src/screens/HomeScreen.tsx]
key-decisions:
  - "The status label source is RN-free and re-exported from StatusGlyph, allowing pure list-content tests to reuse precisely the glyph labels."
  - "Favourite membership remains a null/non-null favourite_rank test; optimistic writes never read or order by rank."
  - "The reactive optimistic overlay wins over a wholesale reload until only its latest generation settles, and successful writes patch the base list before clearing it."
patterns-established:
  - "Screen-owned asynchronous row enrichment is built and committed under the same cancellation guard as its base rows."
  - "Mutable per-contact operations use immutable useSyncExternalStore snapshots so immediate state changes re-render safely."
requirements-completed: [LISTV-03, LISTV-04, LISTV-09]
coverage:
  - id: D1
    description: Colour-free row narration includes contact identity, category, recency, binary favourite membership, and every relationship/snooze label.
    requirement: LISTV-09
    verification:
      - kind: unit
        ref: src/components/list-row-content.test.ts#ListRow content
        status: pass
      - kind: other
        ref: npx tsc --noEmit
        status: pass
    human_judgment: false
  - id: D2
    description: List rows render the full three-line content contract, bounded category chip, registry-backed star, and decorative status glyph.
    requirement: LISTV-03
    verification:
      - kind: other
        ref: npm run check:colors && npx tsc --noEmit
        status: pass
    human_judgment: true
    rationale: Physical layout, text scaling, TalkBack focus order, and touch behavior require Pixel observation.
  - id: D3
    description: Favourite toggles remain immediate, generation-safe, reload-safe, and durable after successful persistence.
    requirement: LISTV-04
    verification:
      - kind: unit
        ref: src/logic/favourite-optimistic.test.ts#favourite optimistic reconciliation
        status: pass
    human_judgment: true
    rationale: Haptic delivery, actual DAO failure recovery, and rapid-tap behavior require Pixel observation.
duration: 10min
completed: 2026-09-06
status: complete
---

# Phase 27 Plan 04: List row content and optimistic favourites Summary

**Dashboard List rows now show a deterministic third line, a screen-reader-complete state description, and a reload-safe optimistic star that persists its binary membership.**

## Performance

- **Duration:** 10 min
- **Completed:** 2026-09-06T03:32:23Z
- **Tasks:** 3/3
- **Files modified:** 8

## Accomplishments

- Made status display labels a pure shared source for both `StatusGlyph` and the colour-free row accessibility description.
- Completed the ListRow’s three-line layout, ellipsized category chip, registry-backed always-visible star, and decorative-only status glyph.
- Batched line-three candidate selection into the existing cancelled dashboard load, and added a reactive per-contact favourite overlay that survives reloads and stale mutation failures.

## Task Commits

1. **Task 1 RED: Accessible row-description coverage** — `80cecd8` (`test`)
2. **Task 1 GREEN: Shared status labels and row narration** — `136f0f8` (`feat`)
3. **Task 2: ListRow star, line 3, and accessibility** — `98d5354` (`feat`)
4. **Task 3 RED: Optimistic favourite reconciliation coverage** — `f86a174` (`test`)
5. **Task 3 GREEN: HomeScreen line-three and favourite wiring** — `a98c943` (`feat`)

## Verification

- `npx vitest run src/components/list-row-content.test.ts` — 9 passed.
- `npx vitest run src/db/dashboard-knowledge-read.test.ts src/logic/list-row-selection.test.ts src/logic/favourite-optimistic.test.ts` — 14 passed.
- `npx tsc --noEmit` — passed.
- `npm run check:colors` — passed.
- `npm test` — 243 files / 2,275 tests passed.

## Decisions Made

- The list only treats `favourite_rank` as a null/non-null membership signal; it neither invokes `listFavourites` nor exposes rank order.
- A latest successful favourite write patches the base list in the same continuation that clears its overlay, preventing a committed star from flashing back without a reload.
- Candidate line-three data is computed once for the loaded ids and committed under the same cancellation guard as `rows`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Testability] Moved the shared status label implementation into an RN-free sibling.**
- **Found during:** Task 1
- **Issue:** Importing `StatusGlyph.tsx` from node-only list-content tests forces Vitest to parse React Native's Flow entrypoint.
- **Fix:** Added `status-display-label.ts`; `StatusGlyph` re-exports and renders through that exact function, while the pure description imports the same source.
- **Files modified:** `src/components/icons/status-display-label.ts`, `src/components/icons/StatusGlyph.tsx`, `src/components/list-row-content.ts`
- **Verification:** Row-content tests and TypeScript passed.
- **Committed in:** `136f0f8`

**Total deviations:** 1 auto-fixed (Rule 3). The public `StatusGlyph` export and one authoritative label implementation remain intact.

## Known Stubs

None.

## Device UAT Pending

Pixel/TalkBack verification for line-three stability, star haptics, true DAO-failure reversion, rapid double taps, and focus order is intentionally deferred to the Phase 27 device pass. It is tracked in `.planning/WINDOWS.md` entry 36.

## Next Phase Readiness

Plan 27-05 can wrap the completed presentational ListRow in its gesture surface without changing line-three, favourite, or accessibility state plumbing. Plan 27-06 can use the reserved `searchResult` prop slot.

## Self-Check: PASSED

- Confirmed the shared label, optimistic logic, optimistic tests, and summary exist on disk.
- Confirmed all five task commits are present in git history.
