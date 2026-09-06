---
phase: 27-dashboard-list-view
plan: 01
subsystem: ui
tags: [dashboard, list-view, react-native, sqlite, accessibility, vitest]

requires:
  - phase: 25-dashboard-data-state-foundation
    provides: shared DashboardRow read model and dashboard query state
  - phase: 26-dashboard-control-surface
    provides: persisted List/Card viewMode toggle and HomeScreen collection host
provides:
  - Additively widened DashboardRow recency and snooze fields for list rendering
  - DST-safe list recency and active-snooze presentation helpers
  - Pixel-visible ListRow tracer with avatar, identity, recency, status border, and status glyph
affects: [27-02, 27-03, 27-04, 27-05, 27-06, 28-dashboard-card-view]

actuals:
  tokens: 24937
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - Shared local-calendar helpers serve fuel age, list recency, and snooze display semantics.
    - List rows consume the shared dashboard projection and capture one render-pass now value in HomeScreen.

key-files:
  created:
    - src/components/ListRow.tsx
    - src/components/list-row-content.ts
    - src/components/list-row-content.test.ts
  modified:
    - src/db/dashboard-read.ts
    - src/utils/dates.ts
    - src/services/fuel-age.ts
    - src/screens/HomeScreen.tsx
    - src/db/dashboard-read.test.ts
    - src/utils/dates.test.ts
    - src/services/widget/widget-data.test.ts

key-decisions:
  - "ListRow owns presentation only; HomeScreen continues to own reads, time capture, and navigation."
  - "Snooze presentation is computed against the SQL-equivalent local-calendar predicate and fails closed for malformed stored text."
  - "Status borders use ringVisual(...).color at a fixed token-derived 2px width; StatusGlyph is absent for null status."

patterns-established:
  - "Additive DashboardRow fields must be supplied by explicitly typed fixture factories."
  - "Never use UTC ISO-date slicing for dashboard presentation; use shared local-calendar helpers."

requirements-completed: [LISTV-01, LISTV-02, LISTV-05]

coverage:
  - id: D1
    description: "Widened shared read model and deterministic local-calendar recency/snooze helpers."
    requirement: LISTV-02
    verification:
      - kind: unit
        ref: "npx vitest run src/components/list-row-content.test.ts src/db/dashboard-read.test.ts src/utils/dates.test.ts src/services/fuel-age.test.ts src/services/widget/widget-data.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "List-mode Pixel tracer: real rows render avatar, name, recency, constant-weight status border, glyph, and colour-independent status label."
    requirement: LISTV-05
    verification:
      - kind: manual_procedural
        ref: "Pixel 6 Pro UAT, 2026-09-06: List view showed UAT Ada and UAT Grace with avatars, 10d ago, stable green borders/check glyphs; uiautomator exposed Stable."
        status: pass
    human_judgment: true
    rationale: "Physical rendering, touch target layout, border weight, and glyph visibility require device observation."
  - id: D3
    description: "Never-contacted/null-status row renders No interactions yet with neutral border and no glyph."
    requirement: LISTV-01
    verification:
      - kind: unit
        ref: "src/components/list-row-content.test.ts#formats local-calendar recency compactly; src/utils/dates.test.ts#active-snooze predicate"
        status: pass
      - kind: manual_procedural
        ref: "Pixel fixture check"
        status: unknown
    human_judgment: true
    rationale: "The prepared Pixel database contained only two stable contacts. Add Contact dismissed its action sheet rather than opening the pre-existing creation route, so an on-device null-status fixture was not available without editing user data outside the app UI."

duration: 1h 27min
completed: 2026-09-06
status: complete
---

# Phase 27 Plan 01: Dashboard List View Tracer Summary

**A real Dashboard list row now travels from the shared SQLite projection to the Pixel with avatar, name, DST-safe recency, optional category, and colour-independent relationship status.**

## Performance

- **Duration:** 1h 27min
- **Completed:** 2026-09-06T01:57:14Z
- **Tasks:** 1/1
- **Files modified:** 10

## Accomplishments

- Added `last_contact` and `snooze_until` to both shared DashboardRow list projections without changing the population predicate or query binding posture.
- Centralized local-calendar day calculations and fail-closed snooze evaluation in `dates.ts`, preserving fuel-age behaviour while adding compact list copy.
- Wired a presentational `ListRow` into HomeScreen list mode with token-only styling, a fixed same-weight status border, guarded glyph mounting, and a single captured `now` value.
- Verified the release bundle and the physical Pixel 6 Pro: the List view displayed UAT Ada and UAT Grace as real rows with avatars, names, `10d ago`, green stable borders, check glyphs, and a uiautomator-exposed `Stable` label.

## Task Commits

1. **Task 1 RED: List-row tracer coverage** — `3cc36f9` (`test`)
2. **Task 1 GREEN: Render Dashboard list rows** — `43245be` (`feat`)

## Verification

- `npx vitest run src/components/list-row-content.test.ts src/db/dashboard-read.test.ts src/utils/dates.test.ts src/services/fuel-age.test.ts src/services/widget/widget-data.test.ts` — **59 passed**.
- `npx tsc --noEmit` — **passed**.
- `npm run check:colors` — **passed**.
- Pixel 6 Pro release APK — **passed for populated/status-bearing rows**; screenshot and UI tree evidence were captured under `/tmp/orbit-27-01-final-list.*` during execution.

## Device-UAT Limitation

The prepared Pixel database had two stable UAT contacts and no never-contacted contact. The null-status/never-contacted presentation is unit-covered and source-verified, but its device-specific visual state was not exercised: the pre-existing `Add Contact` action dismissed its sheet rather than navigating, and no direct database modification was made. This is an outstanding human-verification item, not an implementation stub.

## Deviations from Plan

None - implementation followed the plan. The device build required a forced release-task rerun because the first build-host artifact predated the committed ListRow bundle; the rebuilt APK was inspected for the ListRow bundle markers before installation.

## Next Phase Readiness

Plans 27-02 through 27-06 can extend the established `DashboardRow → HomeScreen → ListRow` seam for swipe configuration, knowledge/star content, line three/a11y, gestures, search presentation, and motion.

## Self-Check: PASSED

- All ten task files are present on disk.
- Both task commits are present in git history.
- The current targeted test, TypeScript, and colour gates passed.
