---
phase: 31-profile-experience
plan: "03"
subsystem: database-domain
tags: [profile, metrics, sqlite, transactions, lifecycle, tdd]
requires:
  - phase: 31-profile-experience
    plan: "02"
    provides: Profile presentation domain and public mutation-boundary conventions
  - phase: 18.2-bound-unbound-lifecycle
    provides: independent Bound/Unbound lifecycle and nullable one-way cadence contract
  - phase: 28-dashboard-card-view
    provides: canonical transaction-body contact and snooze cores
provides:
  - Tagged read-only Profile Status, Gravity, and Intensity view models
  - Shared exact local calendar-month Intensity window for Unbound Profile and Phase 32
  - Atomic Profile frequency, preset/custom snooze, and unsnooze public actions
  - Pending-only duplicate submission coalescing with unconditional later snooze history
affects: [31-05, 32-interaction-history-insights, profile-experience]
actuals:
  tokens: 7902
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - Guard lifecycle and nullable cadence before all metric arithmetic
    - Compose existing non-mutexed cores beneath one public transaction boundary
key-files:
  created:
    - src/services/profile-metrics.ts
    - src/services/profile-metrics.test.ts
    - src/db/profile-relationship-actions.ts
    - src/db/profile-relationship-actions.test.ts
  modified: []
key-decisions:
  - "Unbound Intensity uses exact current local calendar-month boundaries and exposes activity without a fabricated intended cadence or multiple."
  - "Profile frequency preserves the existing scalar setContactFrequencyCore behavior exactly; no lifecycle, notification, or event side effect was invented."
  - "Only concurrent same-action submissions are coalesced; every later repeated snooze or unsnooze still writes its immutable event."
patterns-established:
  - "Profile metric models expose named text, visual input, context, and actual derivation factors without editable score paths."
  - "Profile tile actions own one outer transaction, call transaction-body cores, and bump data_revision once after canonical writes."
requirements-completed: [PROF-10, PROF-11, PROF-12]
coverage:
  - id: D1
    description: "Profile Status and Gravity remain truthful, read-only projections with named context and canonical derivation factors."
    requirement: PROF-10
    verification:
      - kind: unit
        ref: "src/services/profile-metrics.test.ts#Profile Overview metric models"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bound Intensity preserves canonical cadence semantics while Unbound activity uses the shared exact current local calendar-month contract."
    requirement: PROF-11
    verification:
      - kind: unit
        ref: "src/services/profile-metrics.test.ts#resolveProfileIntensityWindow"
        status: pass
      - kind: unit
        ref: "src/services/profile-metrics.test.ts#Profile Overview metric models"
        status: pass
    human_judgment: false
  - id: D3
    description: "Frequency, preset/custom snooze, and unsnooze compose canonical cores, immutable events, rollback, pending protection, and one revision bump atomically."
    requirement: PROF-12
    verification:
      - kind: integration
        ref: "src/db/profile-relationship-actions.test.ts"
        status: pass
      - kind: integration
        ref: "npm test (299 files, 2757 tests)"
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-09-09
status: complete
---

# Phase 31 Plan 03: Profile Metrics and Relationship Actions Summary

**Truthful derived Profile metric models plus atomic frequency and snooze actions that preserve nullable-cadence, immutable-event, and revision invariants.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-09T17:12:37Z
- **Completed:** 2026-09-09T17:24:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added tagged Status, Gravity, and Intensity presentation models containing named text, visual inputs, concise context, and only the factors their canonical derivations actually use.
- Added the single Phase 31/32 no-cadence ruling: exact current local calendar-month boundaries labelled `This month`, with no dormant or fabricated cadence.
- Added public frequency, preset/custom-date snooze, and unsnooze writers that compose existing cores under one outer transaction and publish one data revision only after successful writes.
- Preserved every settled snooze/unsnooze event invariant, including repeated same-state requests after settlement, while coalescing accidental concurrent submissions.

## Task Commits

1. **Task 1 RED: Profile metric model tests** — `f94b7cf`
2. **Task 1 GREEN: truthful Profile metric models** — `ea4e864`
3. **Task 2 RED: Profile relationship action tests** — `f7b6ddd`
4. **Task 2 GREEN: composed Profile relationship actions** — `82b924e`

## Files Created/Modified

- `src/services/profile-metrics.ts` — tagged Status/Gravity/Intensity models and shared local calendar-month window resolver.
- `src/services/profile-metrics.test.ts` — Bound, Unbound, never-contacted, nullable-cadence, month-edge, and explanation-factor coverage.
- `src/db/profile-relationship-actions.ts` — transaction-owning frequency and snooze public APIs with pending-only submission coalescing.
- `src/db/profile-relationship-actions.test.ts` — real-SQLite side-effect, rollback, revision, repeated-event, and no-nested-transaction proofs.

## Decisions Made

- Kept frequency behavior exactly equal to the live `setContactFrequencyCore`: it changes only `interval_days` and `modified_at`, so assigning a dormant cadence does not silently bind an Unbound contact. The subsystem audit found no existing frequency lifecycle/event/notification core to compose.
- Applied the existing Intensity direction and Rarely Responds filters to current-month Unbound activity, while removing cadence-relative `intendedPerPeriod` and `multiple` claims.
- Scoped duplicate protection to the same executor, contact, and action only while its promise is unsettled. No current-value predicate or snooze-event suppression was added.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The specified `npm run check` remains unavailable because `package.json` has no `check` script. Its direct required equivalents passed: `npx tsc --noEmit`, targeted Biome, `npm run check:colors`, and `git diff --check`.

## Known Stubs

None.

## Threat Flags

None. The plan adds no network, authentication, file-access, or schema trust boundary; all writes remain local and parameter-bound through existing cores.

## User Setup Required

None — no external services, network path, schema migration, or manual configuration was introduced.

## Next Phase Readiness

- Plan 31-05 can consume stable metric and relationship-action models without importing transaction-body cores into TSX.
- Phase 32 can import the same `resolveProfileIntensityWindow` calendar-month contract for its Unbound Month lens.
- No blockers remain for downstream Profile work.

## Self-Check: PASSED

- All four created files exist on disk.
- Commits `f94b7cf`, `ea4e864`, `f7b6ddd`, and `82b924e` exist in local history.
- Targeted subsystem tests passed 66/66; the full suite passed 299/299 files and 2757/2757 tests.
- TypeScript, targeted Biome, color-token validation, and whitespace checks passed.

---
*Phase: 31-profile-experience*
*Completed: 2026-09-09*
