---
phase: 38-your-week
plan: 03
subsystem: database
tags: [sqlite, status-engine, digest, birthdays, tdd]
requires:
  - phase: 25-dashboard-data-state
    provides: canonical Dashboard population and needs-attention semantics
  - phase: 32-history-insights
    provides: canonical birthday date parsing conventions
provides:
  - Canonical attention-ordered Up Next candidates with reachable empty state
  - Pure Up Next and Horizon composition with cap, dedup, birthday, and overflow contracts
  - D-10 Never Contacted count/preview/drill parity and Overlooked snooze parity
affects: [38-06, DigestScreen, Contacts drill-through]
actuals:
  tokens: 4947
  tasks: 3
  commits: 7
tech-stack:
  added: []
  patterns: [canonical status SQL reuse, pure read-result composition, exact-population scope exception]
key-files:
  created:
    - src/db/up-next-read.ts
    - src/logic/digest-composition.ts
  modified:
    - src/logic/dashboard-query-logic.ts
    - src/db/digest-read.ts
key-decisions:
  - "Up Next reuses the Dashboard needs-attention floor and snooze semantics verbatim, with no Digest-local urgency score."
  - "D-10 broadens only an exact not-contacted population selection; mixed and all other populations remain Bound-only."
  - "Horizon Overlooked remains rogue-only but excludes active snoozes so its preview is contained by the needs-attention drill universe."
patterns-established:
  - "Digest composition accepts fetched rows and injected dates; it performs no DB, store, component, or network work."
  - "Population exceptions are handled before the shared Bound-scope OR branch to keep their blast radius explicit."
requirements-completed: [S-06, S-07, S-08]
coverage:
  - id: D1
    description: Canonical attention-ordered Up Next candidates with stable-empty and snooze exclusion
    requirement: S-06
    verification:
      - kind: integration
        ref: src/db/up-next-read.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Up Next cap-three and first-claim dedup over Horizon Overlooked
    requirement: S-07
    verification:
      - kind: unit
        ref: src/logic/digest-composition.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Seven-day birthday composition and consistent Never Contacted/Overlooked read universes
    requirement: S-08
    verification:
      - kind: unit
        ref: src/logic/digest-composition.test.ts
        status: pass
      - kind: integration
        ref: src/db/dashboard-read.test.ts and src/db/digest-read.test.ts
        status: pass
    human_judgment: false
duration: 8min
completed: 2026-09-19
status: complete
---

# Phase 38 Plan 03: Up Next and Horizon Data Foundation Summary

**Canonical attention ordering, first-claim deduplication, seven-day birthdays, and preview-to-drill population parity now form the Up Next/Horizon data contract.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-19T06:47:00Z
- **Completed:** 2026-09-19T06:55:35Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added an async-only Up Next DAO that reuses the canonical query-time status engine and exact needs-attention population boundary without pre-capping candidates.
- Added pure Digest composition for the three-person cap, Up Next-first Horizon dedup, deterministic forward-seven-day birthdays, conditional Never Contacted, and compact overflow previews.
- Applied owner ruling D-10 to the exact not-contacted population and aligned Overlooked preview snooze behavior with its needs-attention drill destination.

## Task Commits

1. **Task 1: Attention-ordered Up Next candidate read** — `61a8afc` (RED), `2f50f35` (GREEN)
2. **Task 2: Pure Up Next/Horizon composition** — `b7b7a2a` (RED), `40b7287` (GREEN)
3. **Task 3: Horizon preview/drill read parity** — `f5f6e2a` (RED), `ea3415c` (GREEN)
4. **Formatting follow-up** — `af3424f`

## Files Created/Modified

- `src/db/up-next-read.ts` — uncapped, attention-ordered candidate read using canonical status SQL.
- `src/logic/digest-composition.ts` — pure cap, dedup, birthday, conditional, and overflow transforms.
- `src/logic/dashboard-query-logic.ts` — D-10 exact not-contacted unbound opt-in predicate.
- `src/db/digest-read.ts` — active-snooze exclusion for Overlooked.
- Co-located DAO, composition, Dashboard population, and Digest read tests prove all new boundaries.

## Decisions Made

- Followed D-04 exactly: canonical progress determines Up Next order and membership; there is no Digest-specific urgency classification.
- Followed D-10 exactly: only `['not-contacted']` receives the opted-in Unbound extension; a mixed population selection stays Bound-only.
- Kept the Overlooked status range rogue-only while making its snooze semantics consistent with the broader needs-attention drill target.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The repository has no `npm run lint` script. The changed source/test files were checked with Biome directly; two newly-created tests were formatted. `dashboard-read.test.ts` retains unrelated pre-existing formatter differences outside this plan's edits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06 can assemble Up Next and Horizon directly from `readUpNextCandidates` and the pure composition exports.
- Never Contacted count, exact-population preview, and drill now share one universe when the Unbound opt-in is enabled.

## TDD Gate Compliance

- Task 1: RED `61a8afc` precedes GREEN `2f50f35`.
- Task 2: RED `b7b7a2a` precedes GREEN `40b7287`.
- Task 3: RED `f5f6e2a` precedes GREEN `ea3415c`.

## Self-Check: PASSED

- Both created production files exist.
- All seven plan commits exist in local git history.
- Targeted verification: 75 tests passed; TypeScript passed; all plan grep gates passed.
- Stub and threat-surface scans found no unresolved stubs and no new unplanned trust boundary.

---
*Phase: 38-your-week*
*Completed: 2026-09-19*
