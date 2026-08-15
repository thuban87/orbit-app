---
phase: 06-interaction-log-status-impact
plan: 05
subsystem: ui
tags: [gravity, impact, derived-never-stored, sqlite, react-native, pure-logic]

# Dependency graph
requires:
  - phase: 06-04
    provides: "gravityTiers colour ramp (4 tokens, one per tier) on ThemePalette"
  - phase: 02-data
    provides: "single-writer recency DAO, interactions/contacts schema, node:sqlite testkit, SqlExecutor"
  - phase: 05-photos
    provides: "pure `-logic.ts` + node-test convention (crop-geometry)"
provides:
  - "getImpactInputs — shared read (interval_days, rarely_responds, interaction rows) feeding gravity + intensity"
  - "computeGravity — pure age-decay-toward-a-floor sum → named tier"
  - "impact.ts gravity tunables (HALF_LIFE_DAYS, FLOOR_W, GRAVITY_TIERS) + computeContactGravity orchestration"
  - "GravityBar — profile-only named-tier + bar render (never a raw number)"
affects: [06-06-intensity, orrery, ai-aggregates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived-never-stored gravity computed at read time in the profile's unified load()"
    - "Pure react-native-free `-logic.ts` with injected top-of-file tunables, node-tested"
    - "Recency-mirroring connected filter (rarely_responds → connected rows only) applied in the orchestrator, not the pure core"

key-files:
  created:
    - src/db/impact-read.ts
    - src/db/impact-read.test.ts
    - src/services/gravity-logic.ts
    - src/services/gravity-logic.test.ts
    - src/services/impact.ts
    - src/components/GravityBar.tsx
  modified:
    - src/screens/ContactProfileScreen.tsx

key-decisions:
  - "Gravity mirrors recency's connected scope: rarely_responds contacts count connected rows only (filter in computeContactGravity, not the pure core)"
  - "direction is NOT an input to gravity (familiarity accrues regardless of who reached out; direction drives intensity in 06-06); it stays out of computeGravity's signature per the plan"
  - "GravityBar fill is tier-DISCRETE (tierIndex+1)/tierCount — coarse by design (never the gameable raw score), matching the streak-avoidance rationale"
  - "GRAVITY_TIERS boundaries chosen as owner-approved defaults: thin=0 / building=3 / solid=8 / deep=18 (the plan supplied the four names but not the numeric thresholds)"
  - "GravityBar hidden until the contact has interaction history (no empty 'thin' bar on a never-contacted scaffold)"

patterns-established:
  - "impact-read is the SINGLE read feeding both derived quantities so gravity and intensity always see the same rows"
  - "Tier count (4) kept in lockstep with the gravityTiers colour ramp; tierIndex clamped defensively before indexing"

requirements-completed: [LOG-03]

coverage:
  - id: D1
    description: "getImpactInputs — shared impact-inputs read (interval_days, rarely_responds, interaction rows) ?-bound, no transaction, ordered occurred_at DESC/id DESC, empty + missing handled"
    requirement: "LOG-03"
    verification:
      - kind: unit
        ref: "src/db/impact-read.test.ts#getImpactInputs — the shared impact-inputs read"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pure gravity math: age-decay toward a floor (never zero), sum → raw, raw → named tier, monotone in recency, superset never lowers, zero → lowest tier"
    requirement: "LOG-03"
    verification:
      - kind: unit
        ref: "src/services/gravity-logic.test.ts#computeGravity — age-decay weight toward a floor / raw → named tier mapping / monotonicities"
        status: pass
    human_judgment: false
  - id: D3
    description: "computeContactGravity orchestration + rarely_responds connected filter + top-of-file owner-approved tunables"
    requirement: "LOG-03"
    verification:
      - kind: unit
        ref: "src/services/gravity-logic.test.ts#computeContactGravity — orchestration + rarely-responds connected filter"
        status: pass
    human_judgment: false
  - id: D4
    description: "GravityBar renders named tier + bar (never the raw number), fill via colors.gravityTiers[tierIndex] clamped, track via colors.border; rendered profile-only in the unified load()"
    requirement: "LOG-03"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit && npm run check:colors && npx biome check (all pass)"
        status: pass
    human_judgment: true
    rationale: "On-device UAT (Pixel): confirm the tier + bar renders on the profile and NOT on the dashboard card, and reads correctly for a contact with several touchpoints. No test asserts the on-device visual."

# Metrics
duration: 18min
completed: 2026-08-15
status: complete
---

# Phase 6 Plan 5: Gravity (derived-never-stored, profile-only) Summary

**Age-decayed accumulated-familiarity gravity — a pure floor-asymptote weighted sum mapped to four named tiers (thin/building/solid/deep), derived at read time from a shared impact-inputs DAO and rendered as a named-tier bar on the contact profile only.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-08-15
- **Tasks:** 3 (all TDD where applicable)
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- `getImpactInputs` — the single read-only, `?`-bound DAO that feeds BOTH gravity (this plan) and intensity (06-06), so they can never disagree about a contact's touchpoint history.
- Pure `computeGravity`: `weight(age) = FLOOR_W + (1-FLOOR_W)·2^(-age/HALF_LIFE_DAYS)` summed over interactions → raw → highest tier whose threshold ≤ raw. Proven monotone in recency, superset-never-lowers, floor-never-zero, zero→lowest tier.
- `impact.ts` top-of-file owner-approved tunables (HALF_LIFE_DAYS=365, FLOOR_W=0.15, four GRAVITY_TIERS) + `computeContactGravity` orchestration applying the recency-mirroring connected filter for "Rarely responds" contacts.
- `GravityBar` renders the tier NAME + a coarse tier-discrete bar (never the raw number), fill via `colors.gravityTiers[tierIndex]` (clamped), track via `colors.border`; wired into the profile's single unified `load()`, profile-only.

## Task Commits

1. **Task 1: impact-read DAO (TDD)** — `d09e180` (test) → `cf6ff1f` (feat)
2. **Task 2: pure gravity-logic + impact.ts tunables/orchestration (TDD)** — `632d010` (test) → `7022fa0` (feat)
3. **Task 3: GravityBar + profile render** — `6279c26` (style: biome import-order on Task 1/2 files) → `cd81c03` (feat)

**Plan metadata:** _(this commit)_

## Files Created/Modified
- `src/db/impact-read.ts` — `getImpactInputs(exec, contactId)` + `ImpactInputs` type; two read-only `?`-bound SELECTs, no transaction, no write.
- `src/db/impact-read.test.ts` — node:sqlite coverage (ordering, cross-contact exclusion, empty, missing, null-direction).
- `src/services/gravity-logic.ts` — pure `computeGravity` + types; local-component timestamp parse (never toISOString).
- `src/services/gravity-logic.test.ts` — floor/tier/monotonicity + orchestrator connected-filter coverage.
- `src/services/impact.ts` — gravity tunables (top-of-file) + `computeContactGravity` + `loadContactGravity`.
- `src/components/GravityBar.tsx` — presentational tier-name + bar, tokens only, clamped index.
- `src/screens/ContactProfileScreen.tsx` — `getImpactInputs` added to the unified `load`, gravity derived via `computeContactGravity(inputs, localDateTime())`, `<GravityBar>` in a profile impact section (hidden when no interaction history).

## Decisions Made
- **Gravity mirrors recency's connected scope.** The dossier exports "rarely_responds contacts feed gravity differently"; implemented as the same `rarely_responds = 0 OR connected = 1` filter the recency DAO uses, applied in `computeContactGravity` so the pure core stays a simple sum.
- **direction is not a gravity input.** The plan's `computeGravity` signature carries only `{occurredAt, connected}`; direction drives intensity, not familiarity. impact-read still returns direction for 06-06.
- **Tier boundaries.** The plan named the four tiers (thin/building/solid/deep) as owner-approved but did not supply numeric thresholds; chose 0/3/8/18 as owner-approved-tunable defaults on the weight scale (a recent interaction ≈ 1.0), commented as single-number-edit and owner-retunable. (Executor's delegated implementation detail.)
- **Discrete fill, not raw-normalized.** The bar fills by tier step, so it cannot nudge for one more tap — preserving the anti-streak/anti-gamification rationale.
- **Empty state hidden.** GravityBar renders only once the contact has interaction history.

## Deviations from Plan

None - plan executed exactly as written. (The connected-filter and tier-boundary choices are within the plan's stated scope — the plan explicitly delegated the numeric boundaries as owner-approved tunables and cited the rarely_responds connected dependency.)

## Issues Encountered
- Biome flagged import ordering on the newly-created files; applied `biome check --write` safe fixes (committed as a `style` commit for the Task 1/2 files, folded into Task 3 for the new files). No logic change.

## Next Phase Readiness
- `getImpactInputs` / `ImpactInputs` is ready to feed intensity (06-06) — the same rows, direction included.
- On-device UAT deferred (per project convention): confirm the gravity tier + bar renders on the profile and NOT on the dashboard card for a contact with several touchpoints.

## Self-Check: PASSED

All 6 created source files present on disk; all 6 task commits (test/feat/style pairs) found in git log. Full verification green: `npx tsc --noEmit` (0), `npm run check:colors` (0), `npx biome check src` (0), `npx vitest run` (503/503 passed). Profile-only + derived-never-stored invariants confirmed by grep (no dashboard/card gravity reference; no INSERT/UPDATE/DELETE/ALTER in new files).

---
*Phase: 06-interaction-log-status-impact*
*Completed: 2026-08-15*
