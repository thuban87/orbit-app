---
phase: 07-conversational-fuel
plan: 02
subsystem: database
tags: [fuel, ranking, sqlite, react-native, projection, local-first]

# Dependency graph
requires:
  - phase: 07-01
    provides: fuel table read choke-point (fuel-read.ts), fuel-dao writer, FuelEditor, ContactProfileScreen fuel section, FuelItem/FuelKind types
provides:
  - "fuel-ranking.ts — FUEL_KIND_PRIORITY tunable + pure compareFuel (kind priority > recency > id)"
  - "fuel-age.ts — pure formatFuelAge (today/N days/N months/N years) via local wall-clock parse"
  - "getRankedFuel in fuel-read.ts — the ONE ranked projection; off_limits + source='ai' + blank text excluded IN-QUERY, RANK_CASE derived from FUEL_KIND_PRIORITY"
  - "RankedFuelLine.tsx — surface-agnostic one-line promoted strip reused by card/notification/widget later"
  - "per-row fuel age on FuelEditor; ranked strip mounted on ContactProfileScreen via unified load()"
affects: [phase-08-dashboard, phase-11-notifications, phase-12-widget, phase-07-03-ai-confirm, phase-07-04-search]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source ranking constant: SQL RANK_CASE built at module load from the same FUEL_KIND_PRIORITY the pure comparator uses; a parity test proves they never drift"
    - "In-query access control: off_limits + unconfirmed source='ai' + blank text excluded by SQL WHERE (never a UI .filter()) so the guarantee survives a component refactor"
    - "Surface-agnostic projection component: RankedFuelLine takes a plain string, holds no ranking/DB logic, reusable across every glance surface"

key-files:
  created:
    - src/services/fuel-ranking.ts
    - src/services/fuel-ranking.test.ts
    - src/services/fuel-age.ts
    - src/services/fuel-age.test.ts
    - src/components/RankedFuelLine.tsx
  modified:
    - src/db/fuel-read.ts
    - src/db/fuel-read.test.ts
    - src/components/FuelEditor.tsx
    - src/screens/ContactProfileScreen.tsx

key-decisions:
  - "created_at compared as a STRING in compareFuel to match SQLite's TEXT ORDER BY byte-for-byte — guarantees comparator/SQL parity without a Date parse or UTC risk"
  - "Age uses calendar-component month/year math (not a 30/365 divisor) with a <1-month guard so the ~30-day boundary reads '1 month ago'; future skew clamps to 'today'"
  - "now passed to FuelEditor as a prop (localDateTime() from the parent) so the component keeps its no-DB-import posture"

patterns-established:
  - "Derived-constant contract: one tunable array drives both a pure comparator and a SQL CASE; parity is test-enforced"
  - "Projection-only text predicate: NULLIF(TRIM(text, ws),'') IS NOT NULL keeps blank rows out of the glance line while the editor read still surfaces them"

requirements-completed: [FUEL-02, FUEL-03, FUEL-04, FUEL-06]

coverage:
  - id: D1
    description: "Pure ranking comparator: kind priority (recent>gift>topic>fact) then recency then id; week-old recent beats day-old fact"
    requirement: FUEL-03
    verification:
      - kind: unit
        ref: "src/services/fuel-ranking.test.ts#compareFuel — kind priority FIRST, then recency, then id"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fuel age formatter: today/N days/N months/N years via local wall-clock, future-skew guarded, no mutation"
    requirement: FUEL-04
    verification:
      - kind: unit
        ref: "src/services/fuel-age.test.ts#formatFuelAge — today / days / months / years, local wall-clock"
        status: pass
    human_judgment: false
  - id: D3
    description: "getRankedFuel excludes off_limits + unconfirmed source='ai' + blank/NULL text IN-QUERY; RANK_CASE from FUEL_KIND_PRIORITY; SQL order == compareFuel order"
    requirement: FUEL-02
    verification:
      - kind: integration
        ref: "src/db/fuel-read.test.ts#getRankedFuel — off_limits / source='ai' / blank excluded in-query, ranked"
        status: pass
    human_judgment: false
  - id: D4
    description: "off_limits never appears in the ranked projection for any kind-population combination (structural information-disclosure mitigation T-07-02/03)"
    requirement: FUEL-06
    verification:
      - kind: integration
        ref: "src/db/fuel-read.test.ts#NEVER returns an off_limits row, for EVERY kind-population combination"
        status: pass
    human_judgment: false
  - id: D5
    description: "Profile renders the ranked promoted strip above the editor and per-row fuel age; strip updates on every fuel mutation; off_limits never becomes the line"
    requirement: FUEL-03
    verification:
      - kind: automated_ui
        ref: "npx tsc --noEmit && npm run check:colors && npx biome check (RankedFuelLine.tsx, FuelEditor.tsx, ContactProfileScreen.tsx)"
        status: pass
    human_judgment: true
    rationale: "The .tsx render + refresh-on-mutation + glance behaviour is on-device UAT (phase gate); no test drives the RN tree here. Static gates (tsc/biome/check:colors) pass but visual/interaction correctness needs the Pixel."

# Metrics
duration: 6min
completed: 2026-08-15
status: complete
---

# Phase 7 Plan 02: Single Ranked Projection + Fuel Age Summary

**One ranked fuel projection (kind priority then recency) that excludes off_limits, unconfirmed AI, and blank text by SQL predicate — surfaced as a promoted strip above the editor — plus per-row human age, all proven by a comparator/SQL parity test.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-15T23:59:49Z
- **Completed:** 2026-08-16T00:05:38Z
- **Tasks:** 3
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments
- Pure `fuel-ranking.ts` (FUEL_KIND_PRIORITY tunable + `compareFuel`) and `fuel-age.ts` (`formatFuelAge`) — no DB/RN import, node-tested, mirroring the `gravity-logic.ts` posture.
- `getRankedFuel` added to the `fuel-read.ts` choke point: excludes `off_limits`, unconfirmed `source='ai'`, AND blank/NULL/whitespace text IN-QUERY; RANK_CASE built at module load from `FUEL_KIND_PRIORITY`; `contact_id` is the sole `?`-bound value.
- A parity test proves the SQL order equals `compareFuel` over an eligible-only fixture; a 31-combination absence sweep proves off_limits never reaches the projection.
- `RankedFuelLine.tsx` (surface-agnostic one-line strip) mounted above the editor; per-row fuel age rendered in each FuelEditor row header; both fed by the single unified `load()`.

## Task Commits

1. **Task 1 (RED): failing ranking + age tests** - `bf380ef` (test)
2. **Task 1 (GREEN): fuel-ranking.ts + fuel-age.ts** - `5dafbec` (feat)
3. **Task 2 (RED): failing getRankedFuel tests** - `93c9b10` (test)
4. **Task 2 (GREEN): getRankedFuel in fuel-read.ts** - `11dff5d` (feat)
5. **Task 3: RankedFuelLine + age render on profile** - `ef01862` (feat)

_TDD tasks 1 & 2 each have a test→feat pair._

## Files Created/Modified
- `src/services/fuel-ranking.ts` - FUEL_KIND_PRIORITY tunable + pure compareFuel (kind > recency > id).
- `src/services/fuel-ranking.test.ts` - precedence + cross-kind date inversion + id tiebreak proofs.
- `src/services/fuel-age.ts` - formatFuelAge with local-component parse, future-skew guard, no mutation.
- `src/services/fuel-age.test.ts` - today/days/months/years boundaries + future guard + local-parse proof.
- `src/components/RankedFuelLine.tsx` - one-line ellipsised promoted strip; empty input renders nothing.
- `src/db/fuel-read.ts` - getRankedFuel + RANK_CASE (derived from the tunable); function/CASE headers document the exclusion-as-access-control and no-injection contract.
- `src/db/fuel-read.test.ts` - off_limits absence sweep, ai exclusion, blank-text exclusion, precedence, eligible-fixture parity.
- `src/components/FuelEditor.tsx` - per-row formatFuelAge in the header (13/600, textSecondary, right-aligned); new `now` prop; draft row omits age.
- `src/screens/ContactProfileScreen.tsx` - getRankedFuel in load() Promise.all + rankedFuel state; RankedFuelLine mounted above FuelEditor; now={localDateTime()} passed down.

## Decisions Made
- **created_at compared as a string in compareFuel** to match SQLite TEXT `ORDER BY` exactly — the cheapest way to guarantee comparator/SQL parity and avoid any Date/UTC drift.
- **Calendar-component month/year math** (with a `<1-month`→`1` guard) rather than a fixed 30/365 divisor, so the ~30-day boundary reads "1 month ago" and boundaries land on real rollovers.
- **`now` passed as a prop to FuelEditor** rather than importing `localDateTime` there, preserving the component's no-DB-import posture (age math stays in the pure `fuel-age` service).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FUEL-02/03/04/06 structural halves complete: the one ranked projection and age exist and are node-proven.
- **On-device UAT pending (phase gate):** RankedFuelLine render, refresh-on-mutation, and the off_limits-never-glanceable behaviour need verification on the Pixel (build+drive per the desktop-build pipeline) — deferred here per the no-APK-build constraint for this plan.
- Ready for 07-03 (AI suggestions: confirm flips `source='ai'`→`'manual'`, after which getRankedFuel ranks it) and 07-04 (search reuses the same fuel-read choke point + exclusion posture).

## Self-Check: PASSED

- All 5 created files present on disk.
- All 5 task commits (bf380ef, 5dafbec, 93c9b10, 11dff5d, ef01862) present in git history.
- Full suite: 559 tests / 48 files pass. tsc, check:colors, biome clean. No migration created/edited.

---
*Phase: 07-conversational-fuel*
*Completed: 2026-08-15*
