---
phase: 30-orrery-systems
plan: 02
subsystem: database
tags: [sqlite, orrery, systems, dashboard-predicates, gravity]
requires:
  - phase: 30-01
    provides: durable Systems rules and override rows plus the custom read-path seam
provides:
  - closed-token custom-System rule mapping and BrokenRule diagnostics
  - scoped candidate resolution, post-query Gravity filtering, and shared membership overrides
  - persisted and draft resolver entry points wired through the Orrery DB read layer
affects: [30-03, 30-05, 30-06, 30-07, 30-08, 30-09]
actuals:
  tokens: 8443
  tasks: 3
  commits: 8
tech-stack:
  added: []
  patterns: [canonical Dashboard predicate composition, injected batched Gravity loader, shared dynamic-bucket override application]
key-files:
  created: []
  modified:
    - src/logic/system-rule-resolver.ts
    - src/db/orrery-system-read.ts
    - src/logic/system-rule-resolver.test.ts
    - src/db/orrery-system-read.test.ts
key-decisions:
  - "Gravity remains a post-query TypeScript pass; the DB layer injects a batched impact-input loader."
  - "Stale exclusions are discarded at read and reported for deliberate prune-on-save, never written by a read."
  - "Built-in and Category override rows reuse the custom System override union/subtract semantics."
requirements-completed: [ORRS-01, ORRS-02, ORRS-03, ORRS-04]
coverage:
  - id: D1
    description: Closed rule mapping, E-02 candidate scope, and post-query Gravity filtering.
    requirement: ORRS-01
    verification:
      - kind: unit
        ref: src/logic/system-rule-resolver.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Dynamic manual include/exclude membership with stale-exclusion reporting.
    requirement: ORRS-02
    verification:
      - kind: unit
        ref: src/logic/system-rule-resolver.test.ts#membership overrides
        status: pass
    human_judgment: false
  - id: D3
    description: Built-in and Category render-path override application with full-row manual includes.
    requirement: ORRS-03
    verification:
      - kind: integration
        ref: src/db/orrery-system-read.test.ts#layers built-in overrides onto base members and reselects full included rows
        status: pass
    human_judgment: false
  - id: D4
    description: Broken category and malformed closed-token rules remain stored and identifiable for repair.
    requirement: ORRS-04
    verification:
      - kind: unit
        ref: src/logic/system-rule-resolver.test.ts#stored System rule mapping
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-09-08
status: complete
---

# Phase 30 Plan 02: Custom-System Membership Resolver Summary

**Custom Systems now resolve canonical dashboard rules, derived Gravity, and durable membership overrides through one deterministic, read-only membership engine.**

## Accomplishments

- Added `mapRulesToFilters` with exported sentinel constants for every rule axis. Invalid rows become `BrokenRule { ruleUid, family, value, reason }` and missing category UIDs remain stored while being omitted from predicates.
- Added deterministic candidate resolution with Dashboard’s canonical fragments, E-02 active/never-contacted scope handling, bound values, and a Gravity-only TypeScript filtering pass.
- Added `resolveMembershipFromDefinition` for saved and unsaved definitions, returning `{ memberIds, candidateIds, brokenRules, prunableExclusionContactIds }`; `candidateIds` remains the pre-override base for Plans 30-07 and 30-08.
- Added shared `applyMembershipOverrides` to custom and built-in/category paths. Override reads never mutate: stale exclusions are ignored and surfaced for the intentional next-save prune.
- Wired `resolveDraftMembership(exec, { rules, overrides, now })` in the DB read layer. It constructs and batch-preloads the Gravity loader; builder and preview callers stay DB-loader-free.
- Built-in/category paths retain the no-override query unchanged, and reselect full contact rows by ID when override rows exist so manual additions render correctly.

## Task Commits

1. Task 1 RED: `6e362a3` — failing closed rule-mapping tests.
2. Task 1 GREEN: `0e3bf90` — closed rule mapping and broken diagnostics.
3. Task 2 RED: `2235b4f` — failing candidate resolver tests.
4. Task 2 GREEN: `cfedcab` — scoped candidates and Gravity pass.
5. Task 3 RED: `c40a44f` — failing membership override tests.
6. Task 3 GREEN: `a2c7b65` — shared overrides and DB-path wiring.
7. Task 3 fix: `e02b860` — batch Gravity loading and stale-exclusion behavior.
8. Deviation fix: `207f491` — lifecycle predicate ledger registration.

## Files Modified

- `src/logic/system-rule-resolver.ts` — rule mapping, candidate resolution, membership engine, persisted wrapper, and override helper.
- `src/db/orrery-system-read.ts` — DB-owned Gravity loader, draft wrapper, base-id reader, and built-in/category override projection.
- `src/logic/system-rule-resolver.test.ts` and `src/db/orrery-system-read.test.ts` — unit and read-path coverage.
- `src/db/lifecycle-consumer-ledger.test.ts` — required Bound-predicate ownership registration.

## Decisions Made

- `scope:population` widens to the full active Bound population; otherwise only an explicit Not-Contacted rule widens the default active/contacted scope.
- Resolver SQL remains value-bound and uses canonical closed fragments; Gravity never enters its SQL WHERE clause.
- A manual include must be active (not archived and tracking-enabled), but it may be never-contacted.

## Deviations from Plan

### Auto-fixed Issues

1. [Rule 2 - Missing critical functionality] Registered the custom resolver’s `tracking_enabled = 1` predicate in the lifecycle enforcement ledger.
- Found during: overall verification.
- Fix: added the test-ledger owner and mirrored the contract in its validation document.
- Verification: `npx vitest run src/db/lifecycle-consumer-ledger.test.ts` passes.
- Commit: `207f491`.

## Verification

- Passed: `npx vitest run src/logic/system-rule-resolver.test.ts src/db/orrery-system-read.test.ts`.
- Passed: `npx vitest run src/db/lifecycle-consumer-ledger.test.ts src/logic/system-rule-resolver.test.ts src/db/orrery-system-read.test.ts`.
- Passed: Biome check and `npx tsc --noEmit`.
- `npm test` remains blocked by two unrelated existing Vite/Rolldown Flow-parser failures in `src/backup/restore-apply.test.ts` and `src/stores/orrery-system-store.test.ts`; it also exposed the lifecycle ledger gap above, which is fixed.

## Next Phase Readiness

Plans 30-03 and 30-08 can consume the stable resolver contracts, including draft membership and pre-override candidate IDs. No user setup is required.

## Self-Check: PASSED

- Resolver and Orrery read modules exist at their recorded paths.
- All eight task commits are present in local history.
