---
phase: 21-interaction-assist-reach-out
plan: 01
subsystem: database
tags: [sqlite, migrations, interaction-assist, recency, vitest]
requires:
  - phase: 20-contact-reconciliation-merge
    provides: contact retirement semantics and normalized contact data
provides:
  - Migration 014 interaction-assist schema and enabled-by-default setting
  - Atomic, idempotent assist confirmation through the authoritative recency cores
  - Durable eligible-assist queue reads and pure reach-route derivation
affects: [reach-out-router, assist-banner, settings-toggle, merge-reparenting]
actuals:
  tokens: 7868.75
  tasks: 2
  commits: 5
tech-stack:
  added: []
  patterns: [non-mutexed recency-core composition, local wall-clock eligibility bounds]
key-files:
  created:
    - src/db/migrations/014-interaction-assists.ts
    - src/db/interaction-assist-dao.ts
    - src/db/interaction-assist-read.ts
    - src/logic/assist-eligibility.ts
  modified:
    - src/db/database.ts
    - src/db/contact-methods-read.ts
key-decisions:
  - "Assist confirmation re-reads its full row inside one transaction and composes recency cores instead of calling recordTouchpoint."
  - "Eligibility is measured from handoff_at at 15 seconds through 24 hours, while cap pruning uses created_at."
  - "Route derivation consumes already-selected actionable methods and performs no second database read."
patterns-established:
  - "Interaction confirmation uses status-guarded idempotency plus a pre-transaction future-date guard."
  - "Pending-assist queue joins contacts for banner-ready names and keeps archived targets visible."
requirements-completed: [IAS-02, IAS-03]
coverage:
  - id: D1
    description: "Migration 014 and atomic pending-assist confirmation through the sole recency writer."
    requirement: IAS-03
    verification:
      - kind: unit
        ref: "npx vitest run src/db/interaction-assist-dao.test.ts src/db/migrations/full-chain.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Durable eligible queue, local-window eligibility, and pure actionable route derivation."
    requirement: IAS-02
    verification:
      - kind: unit
        ref: "npx vitest run src/db/interaction-assist-read.test.ts src/logic/assist-eligibility.test.ts"
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-08-31
status: complete
---

# Phase 21 Plan 01: Interaction Assist Data Spine Summary

**Durable pending-assist storage and atomic handoff-time interaction logging through Orbit's authoritative recency writer.**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-08-31T22:07:13Z
- **Tasks:** 2/2
- **Files modified:** 10

## Accomplishments

- Added migration 014 with a cascade-safe `interaction_assists` table, indexed pending queue, and enabled-by-default setting.
- Added cap-five pending creation and status-guarded confirmation, dismissal, and failure paths; confirmation preserves the original handoff time and reuses the sole `last_contact` writer atomically.
- Added shared 15-second/24-hour eligibility logic, stable named queue reads, and pure route derivation from existing actionable primary methods.

## Task Commits

1. **Task 1: Migration 014 + interaction-assist write DAO** — `dd9e556` (RED tests), `ccdf16f` (implementation)
2. **Task 2: Eligible queue + route derivation + eligibility logic** — `e4ab3ec` (RED tests), `40e185c` (implementation)
3. **Verification fix:** `3f63f47` (format and lint compliance)

## Files Created/Modified

- `src/db/migrations/014-interaction-assists.ts` — durable assist schema and settings column.
- `src/db/interaction-assist-dao.ts` — cap-five write path and atomic confirmation through recency cores.
- `src/db/interaction-assist-read.ts` — stable eligible queue, count, and pure reach routes.
- `src/logic/assist-eligibility.ts` — local wall-clock eligibility and banner selection.
- `src/db/contact-methods-read.ts` — exported pure actionable-primary selection shared by callers.

## Decisions Made

- Confirmation runs the future-date guard before the outer transaction, then uses the in-transaction assist re-read for interaction and recency values, avoiding merge/purge TOCTOU stale IDs.
- A pending queue retains archived contacts but fails closed for deleted contacts through its inner join.
- No interaction-assist operation performs network I/O; all write values use bound SQLite parameters.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Formatted tracer sources after the final Biome gate failed.**

- **Found during:** Overall verification
- **Issue:** Newly created DAO and test files had formatting/import-order errors that blocked the required quality check.
- **Fix:** Applied the repository formatter and equivalent optional-chain simplification.
- **Files modified:** `src/db/interaction-assist-dao.ts`, `src/db/interaction-assist-dao.test.ts`
- **Verification:** Focused Biome check, TypeScript, and all plan tests passed.
- **Committed in:** `3f63f47`

**Total deviations:** 1 auto-fixed (Rule 3).

## Issues Encountered

None beyond the automatically corrected formatter gate.

## User Setup Required

None - the data spine is fully local and requires no external configuration.

## Next Phase Readiness

The confirmed data-layer tracer is ready for the Reach Out router and app-return banner to consume. Later plans must reparent `interaction_assists` during merges and rely on its cascade for purges.

## Self-Check: PASSED

- All ten planned source/test files exist.
- Commits `dd9e556`, `ccdf16f`, `e4ab3ec`, `40e185c`, and `3f63f47` exist in git history.
