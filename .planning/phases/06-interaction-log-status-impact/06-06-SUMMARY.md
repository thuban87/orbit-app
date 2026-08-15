---
phase: 06-interaction-log-status-impact
plan: 06
subsystem: ui
tags: [intensity, impact, log-03, derived-never-stored, react-native, vitest]

# Dependency graph
requires:
  - phase: 06-05
    provides: "impact.ts tunables + computeContact* orchestration, getImpactInputs (single read), GravityBar sibling conventions, ContactProfileScreen unified load()"
  - phase: 04
    provides: "ContactProfileScreen shell + useFocusEffect load, FREQUENCY_DAYS interval mapping"
provides:
  - "computeIntensity — pure period-rate + trailing-cadence math (react-native-free, node-tested)"
  - "INTENSITY_PERIOD_DAYS policy (intensityPeriodDays) + computeContactIntensity orchestration in impact.ts"
  - "IntensityLine — neutral rate render (text tokens only), profile-only"
  - "Intensity rendered beside gravity in the profile impact section (never blended)"
affects: [verify-work, 06-verification, future digest/AI surfaces reading impact]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure -logic.ts + node .test.ts (mirrors gravity-logic / crop-geometry); tunable/policy at top of impact.ts (single-number edit)"
    - "Derived-never-stored, profile-only, filter-consistent-with-recency for the second impact quantity"

key-files:
  created:
    - src/services/intensity-logic.ts
    - src/services/intensity-logic.test.ts
    - src/components/IntensityLine.tsx
  modified:
    - src/services/impact.ts
    - src/screens/ContactProfileScreen.tsx

key-decisions:
  - "Intensity period = the contact's own interval_days (A3, owner-approved 2026-08-15), resolved via intensityPeriodDays() so a future retune is one function"
  - "trailingAvgGapDays computed over ALL qualifying history, sorted ASCENDING before differencing (input arrives DESC), null when < 2 qualifying rows"
  - "currentCount counts direction outbound|mutual only; rarely_responds=1 additionally requires connected=1 (mirrors recency); inbound-only volume never raises it"
  - "Neutral empty state ('No outbound contact logged yet') when there is no you-reached-out history; otherwise the factual rate line, no danger/warning colour"

patterns-established:
  - "Second derived impact quantity follows the gravity template: pure math + injected policy + presentational component fed by the single getImpactInputs read"

requirements-completed: [LOG-03]

coverage:
  - id: D1
    description: "computeIntensity counts outbound/mutual only within the period; inbound-only volume does not raise currentCount"
    requirement: LOG-03
    verification:
      - kind: unit
        ref: "src/services/intensity-logic.test.ts#does NOT count inbound-only volume (they blew up your phone)"
        status: pass
      - kind: unit
        ref: "src/services/intensity-logic.test.ts#counts 'mutual' as you-reached-out too"
        status: pass
    human_judgment: false
  - id: D2
    description: "rarely_responds=1 restricts intensity to connected rows (same filter as recency), so the metric never disagrees with the orbit"
    requirement: LOG-03
    verification:
      - kind: unit
        ref: "src/services/intensity-logic.test.ts#ignores non-connected outbound attempts for a rarely-responds contact"
        status: pass
    human_judgment: false
  - id: D3
    description: "trailingAvgGapDays is the mean consecutive gap on ascending-sorted rows (a DESC/newest-first input yields a POSITIVE, correct average); null when < 2 qualifying rows; no divide-by-zero"
    requirement: LOG-03
    verification:
      - kind: unit
        ref: "src/services/intensity-logic.test.ts#yields a POSITIVE, correct average from a DESCENDING (newest-first) input"
        status: pass
      - kind: unit
        ref: "src/services/intensity-logic.test.ts#returns null for zero qualifying rows (never divides by zero)"
        status: pass
    human_judgment: false
  - id: D4
    description: "INTENSITY_PERIOD_DAYS policy + computeContactIntensity live in impact.ts; intensity-logic is react-native-free with no write statement (derived-never-stored)"
    requirement: LOG-03
    verification:
      - kind: unit
        ref: "src/services/intensity-logic.test.ts#delegates with periodDays = intervalDays and the rarely-responds scope"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "IntensityLine renders a neutral rate + intended + trailing-average (average omitted when null), text tokens only, no judgemental/warning styling; rendered beside gravity on the profile only"
    requirement: LOG-03
    verification:
      - kind: other
        ref: "npm run check:colors (exit 0) + npx biome check src/ (clean)"
        status: pass
    human_judgment: true
    rationale: "Exact neutral copy + the side-by-side-not-blended visual read is a taste/product judgment finalised during on-device UAT on the Pixel; no test asserts the rendered wording or layout."

# Metrics
duration: 6min
completed: 2026-08-15
status: complete
---

# Phase 6 Plan 6: Intensity Summary

**Neutral this-period contact-rate (outbound/mutual only, recency-consistent) plus a trailing-cadence average, derived-never-stored and rendered beside gravity on the profile — LOG-03's intensity half, completing Phase 6.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-15
- **Completed:** 2026-08-15
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- Pure `computeIntensity` (react-native-free, node-tested, 14 cases): direction/connected filters, this-period count, and the ascending-sort-before-cadence trailing average with an explicit DESC-input positive-average proof.
- `INTENSITY_PERIOD_DAYS` policy (`intensityPeriodDays`) + `computeContactIntensity` orchestration added to `impact.ts` (period = the contact's own interval, A3 owner-approved).
- `IntensityLine` component: a neutral rate line via text tokens only (no danger/warning), trailing clause omitted when null, neutral empty state.
- Intensity wired onto `ContactProfileScreen` from the SAME `getImpactInputs` read gravity uses, rendered beside `GravityBar` in the impact section — profile-only, never blended into one score.

## Task Commits

Each task was committed atomically (TDD RED/GREEN folded into Task 1's commit; RED was verified failing before GREEN):

1. **Task 1: intensity-logic + impact.ts period tunable + tests** - `ecf598f` (feat)
2. **Task 2: IntensityLine component + render intensity on the profile** - `1b115ff` (feat)

## Files Created/Modified
- `src/services/intensity-logic.ts` - Pure `computeIntensity(interactions, periodDays, rarelyResponds, now)` → period rate + trailing cadence; header documents the neutral/floor, direction/connected, and ascending-sort decisions.
- `src/services/intensity-logic.test.ts` - 14 node/Vitest cases (outbound/mutual-counts, inbound-doesn't, null-direction, rarely-responds connected scope, this-period window, trailing average incl. DESC→positive proof, empty/single-row null, orchestration).
- `src/components/IntensityLine.tsx` - Presentational neutral rate render; `colors.textPrimary`/`textSecondary` only; testID `contact-profile-intensity`; reverse FREQUENCY_DAYS label with "every N days" fallback.
- `src/services/impact.ts` - `intensityPeriodDays` policy + `computeContactIntensity`; header updated to note Plan 06-06 adds the intensity half.
- `src/screens/ContactProfileScreen.tsx` - `intensity` state derived from the shared impact inputs (one captured `now`), `IntensityLine` rendered beside `GravityBar` in `contact-profile-impact`.

## Decisions Made
- Intensity period defaults to the contact's `interval_days` (A3, owner-approved) rather than a fixed calendar window — a Yearly contact has no meaningful week. Resolved via `intensityPeriodDays()` so a retune is one function.
- `trailingAvgGapDays` spans ALL qualifying history (not just the current period), sorted ascending before differencing; null under 2 qualifying rows (no divide-by-zero).
- Neutral empty state copy ("No outbound contact logged yet") chosen over hiding, so the section is factual and never scolds; exact wording is a UAT taste call.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Task 1 files were committed before `biome check src/` ran over them (Task 1's `<verify>` is vitest-only); a subsequent full biome run flagged formatting-only diffs in the two committed files. Fixed with `biome check --write` and folded into Task 1 via `git commit --amend` (still a single Task 1 commit) — no behavioural change.

## Known Stubs
None — intensity is fully wired to the live `getImpactInputs` read; no placeholder/mock data.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 (Interaction Log, Status & Impact) code-complete: both LOG-03 halves (gravity 06-05, intensity 06-06) ship derived-never-stored and profile-only.
- On-device UAT deferred (Pixel-only, per project convention): open a contact with several outbound touchpoints, confirm the neutral intensity line renders beside gravity on the profile and NOT on the dashboard card, and confirm a Rarely-responds contact's intensity ignores non-connected attempts. Then `/gsd-verify-work 6`.

## Self-Check: PASSED

- Files exist: `src/services/intensity-logic.ts`, `src/services/intensity-logic.test.ts`, `src/components/IntensityLine.tsx` — all FOUND.
- Commits exist: `ecf598f` (Task 1), `1b115ff` (Task 2) — both FOUND in git log.
- Verification: `npx vitest run` 517/517 pass (intensity suite 14/14); `npx tsc --noEmit` exit 0; `npm run check:colors` exit 0; `npx biome check src/` clean (142 files).

---
*Phase: 06-interaction-log-status-impact*
*Completed: 2026-08-15*
