---
phase: 19-system-contact-import
plan: "01"
subsystem: database
tags: [sqlite, migrations, import-sessions, restore, testing]
requires:
  - phase: 18.1-contact-method-normalization
    provides: normalized contact and external-link schema used by import rows
provides:
  - v12 durable local-only import-session tables and integrity constraints
  - atomic session acceptance and composable row-transition writers
  - resumable-session readers with durable completion-summary counts
affects: [system-contact-import, backup-restore, duplicate-review]
actuals:
  tokens: 26332
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - mutexed standalone writers paired with transaction-only Core writers
    - session summary buckets derived from grouped durable-row states
key-files:
  created:
    - src/db/migrations/012-import-sessions.ts
    - src/db/import-session-dao.ts
    - src/db/import-session-read.ts
  modified:
    - src/db/database.ts
    - src/backup/restore-apply.ts
key-decisions:
  - "Import sessions are local-only runtime state: excluded from portable exports and purged by Replace-all restore."
  - "Already-linked classifications use match_outcome, not skipped row_status, to keep completion reports honest."
  - "Accepted picker snapshots commit session metadata and every row in one transaction."
patterns-established:
  - "Compose import-row status updates with *Core writers inside the caller's one write transaction."
  - "Treat malformed persisted advisory-candidate JSON as an empty list at read time."
requirements-completed: [IMP-04]
coverage:
  - id: D1
    description: "Migration 012 creates durable import-session tables with foreign-key and uniqueness guarantees."
    requirement: IMP-04
    verification:
      - kind: unit
        ref: "src/db/migrations/012-import-sessions.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Atomic acceptance and row-state transitions preserve resumable import state."
    requirement: IMP-04
    verification:
      - kind: unit
        ref: "src/db/import-session-dao.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Durable session reads survive database re-open and remain outside portable backup data."
    requirement: IMP-04
    verification:
      - kind: integration
        ref: "src/db/import-session-read.test.ts"
        status: pass
    human_judgment: false
duration: 8min
completed: 2026-08-29
status: complete
---

# Phase 19 Plan 01: Durable Session Persistence Summary

**SQLite v12 import-session snapshots with atomic acceptance, transaction-composable row states, resumable reads, and Replace-all cleanup.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-29T13:12:19Z
- **Completed:** 2026-08-29T13:20:39Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added additive migration 012 with durable session/row tables, foreign keys, unique external IDs, status constraints, and indexes.
- Added atomic snapshot acceptance plus mutexed writers and non-mutexed cores for crash-safe composed transitions.
- Added resumable readers, grouped completion-summary buckets, export omission coverage, and Replace-all session purging.

## Task Commits

1. **Task 1: Migration 012** — `d32c680` (feat)
2. **Task 2: Atomic import-session DAO** — `424c625` (feat)
3. **Task 3: Import-session reads and Replace-all purge** — `9610893` (feat)

## Files Created/Modified

- `src/db/migrations/012-import-sessions.ts` — additive v12 import-session schema.
- `src/db/database.ts` — migration registration and target version 12.
- `src/db/import-session-dao.ts` — atomic writers and transaction-only row cores.
- `src/db/import-session-read.ts` — resumable session and count readers.
- `src/backup/restore-apply.ts` — Replace-all local-session purge.

## Decisions Made

- Import-session tables are local-only runtime state and never enter an export manifest.
- `alreadyInOrbit` keys off durable `match_outcome='already_linked'`, keeping it distinct from a user Skip.
- Failed rows remain pending at the session level so Retry survives process death.

## Verification

- `npx vitest run src/db/migrations/012-import-sessions.test.ts src/db/import-session-dao.test.ts src/db/import-session-read.test.ts src/backup/restore-apply.test.ts src/db/migrations/full-chain.test.ts` — 28 passing tests.
- `npx tsc --noEmit --pretty false` — passed.
- `npx biome check` on the migration, DAO, and read-layer files — passed.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Plans 02–11 can persist and resume import work exclusively from Orbit-owned rows, with one canonical state-transition vocabulary.

## Self-Check: PASSED

- Confirmed migration, DAO, read chokepoint, and summary files exist.
- Confirmed task commits `d32c680`, `424c625`, and `9610893` exist in git history.

---

*Phase: 19-system-contact-import*
*Completed: 2026-08-29*
