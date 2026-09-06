---
phase: 27-dashboard-list-view
plan: 06
subsystem: dashboard-search
tags: [sqlite, search, react-native, reanimated, vitest, local-first]
requires:
  - phase: 27-dashboard-list-view
    provides: List row anatomy, line-three enrichment, favourite state, and swipe host.
  - phase: 24.1-contact-knowledge-foundation
    provides: Visibility choke points and normalized custom-field storage.
provides:
  - List-only corpus-backed Dashboard search with relevance-first match descriptors.
  - Privacy-safe batched corpus reads and compact highlighted List search rows.
  - Initial-only loading skeletons and reduced-motion-aware result transitions.
affects: [28-dashboard-card-view, 31-profile, 34-rapid-capture]
actuals:
  tokens: 36095
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns:
    - Shared search composition preserves scorer order and appends Dashboard fuel-only fallbacks.
    - List-specific async enrichment is selected by query mode without changing Card View semantics.
    - Reanimated shared values drive result transitions while React state commits data only once per reload.
key-files:
  created: [src/db/dashboard-search-read.ts, src/db/dashboard-search-read.test.ts]
  modified: [src/db/knowledge-search-read.ts, src/db/dashboard-read.ts, src/components/ListRow.tsx, src/components/list-row-content.ts, src/screens/HomeScreen.tsx]
key-decisions:
  - "Corpus search retains searchDashboard relevance order; Dashboard order only ranks fuel-only fallbacks and scorer ties."
  - "Hidden relationships and hidden/outdated memories are excluded in the shared corpus read through the established visibility choke points."
  - "Card View keeps listDashboardSearch; composeDashboardSearch is strictly List-search-only."
requirements-completed: [LISTV-06, LISTV-10]
coverage:
  - id: D1
    description: Shared local corpus search excludes hidden/outdated knowledge, batches custom values, retains A3 eligibility, and emits relevance-first corpus results plus fuel fallbacks.
    requirement: LISTV-06
    verification:
      - kind: integration
        ref: "src/db/knowledge-search-read.test.ts; src/db/dashboard-read.test.ts; src/db/dashboard-search-read.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: List search copy pluralises counts, names match categories, and supports fuel-only no-snippet fallback.
    requirement: LISTV-06
    verification:
      - kind: unit
        ref: "src/components/list-row-content.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: Pixel rendering verifies highlighted snippets, search result layout, initial skeleton geometry, in-place motion, and live reduced-motion behavior.
    requirement: LISTV-10
    verification:
      - kind: manual_procedural
        ref: "Phase 27 end-of-phase Pixel UAT"
        status: unknown
    human_judgment: true
    rationale: "React Native layout, animation timing, and OS accessibility preference behavior require a physical-device observation; DEBUG launch remains blocked by the already documented expo-web-browser dependency."
duration: 10min
completed: 2026-09-06
status: complete
---

# Phase 27 Plan 06: List search presentation and motion Summary

**Dashboard List search now renders privacy-safe, relevance-ranked corpus matches with compact category/count explanations, weight-only snippets, and reduced-motion-aware in-place updates.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-06T03:42:00Z
- **Completed:** 2026-09-06T03:52:34Z
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments

- Made the shared knowledge corpus visible-surface safe: hidden relationships, hidden memories, outdated memories, and quarantined custom definitions never enter List search; custom values are read in one batch.
- Added an A3-aware eligible read and List-only `composeDashboardSearch`, preserving scorer relevance for corpus hits and appending name/fuel-only results in Dashboard order.
- Rendered corpus descriptors as count/category copy with label-weight text-primary highlights; null corpus results retain the fuel fallback and omit line three for name-only matches.
- Reserved row skeletons for the named initial load, retained shared empty/error semantics, and animated reload results through Reanimated only when focused, foregrounded, and motion is permitted.

## Task Commits

1. **Task 1 RED: Dashboard search composition coverage** — `020823e` (`test`)
2. **Task 1 GREEN: Compose relevance-ranked Dashboard search** — `3c11447` (`feat`)
3. **Task 2 RED: Compact search match copy coverage** — `6ab5333` (`test`)
4. **Task 2 GREEN: Render corpus-backed List search rows** — `d99b41f` (`feat`)
5. **Task 3: Keep List updates smooth and cause-aware** — `0686125` (`feat`)

## Verification

- `npx vitest run src/db/knowledge-search-read.test.ts src/db/dashboard-read.test.ts src/db/dashboard-search-read.test.ts` — **44 passed**.
- `npx vitest run src/components/list-row-content.test.ts` — **11 passed**.
- `npx tsc --noEmit` — **passed**.
- `npm run check:colors` — **passed**.
- `npm test` — **245 files / 2,288 tests passed**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test fixture] Replaced a color-word search fixture.**
- **Found during:** Task 2 verification.
- **Issue:** The repository-wide color-token checker correctly treats color literals in source and test paths as violations.
- **Fix:** Renamed the relevance fixture term from `red blue` to neutral `lambda sigma`.
- **Files modified:** `src/db/dashboard-search-read.test.ts`.
- **Verification:** `npm run check:colors` and full suite passed.
- **Committed in:** `6ab5333`.

**Total deviations:** 1 auto-fixed Rule 1 correction; no product or architectural scope changed.

## Known Stubs

None.

## Device UAT Pending

The end-of-phase search and motion UAT remains blocked by the pre-existing missing `expo-web-browser` DEBUG dependency already recorded in `.planning/WINDOWS.md`. No dependency was added or changed under this plan.

## Next Phase Readiness

Phase 28 can retain its existing Card View search semantics while reusing the shared corpus primitives if its separate ordering decisions call for them. The List owns the new relevance-first composition boundary.

## Self-Check: PASSED

- Confirmed all ten plan implementation/test files are present on disk.
- Confirmed task commits `020823e`, `3c11447`, `6ab5333`, `d99b41f`, and `0686125` are in git history.
- Confirmed targeted tests, TypeScript, color checks, and the full suite passed.
