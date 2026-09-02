---
phase: 03-custom-fields
plan: 07
subsystem: database
tags: [sqlite, custom-fields, quarantine, launch-sweep, field-history, expo-sqlite]

# Dependency graph
requires:
  - phase: 03-custom-fields (Plan 03)
    provides: expireFieldIfStale — the under-the-lock, single-txn quarantine-expiry drop core
  - phase: 02 (DATA-06)
    provides: launch-sweep registry (registerSweepHook / runLaunchSweep / installSweepTrigger)
provides:
  - "registerFieldSweep(getExec, now?) — the launch-time quarantine-expiry + field_history-retention hook"
  - "QUARANTINE_WINDOW_DAYS = 30 (fixed, single top-of-file constant)"
  - "getExecutor() accessor on database.ts (SqlExecutor over the cached, migrated connection)"
  - "App.tsx registration of the field sweep, once, before the cold-start sweep trigger"
affects: [phase-07-fuel, archived-purge, schedule-reconcile, backup-rotation, any-future-launch-sweep-hook]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Launch-sweep consumer: register one idempotent hook on the DATA-06 registry; never run work at module scope"
    - "Direct call to an already-mutex-owning op (expireFieldIfStale) — NEVER re-wrap (non-reentrant mutex → deadlock, HIGH-1)"
    - "Bare candidate scan narrows; authoritative re-check under the lock decides the destructive drop (sweep-TOCTOU)"
    - "Per-iteration try/catch isolates a failed unit so the loop and its trailing cleanup always complete"

key-files:
  created:
    - src/services/field-sweep.ts
    - src/services/field-sweep.test.ts
  modified:
    - src/db/database.ts
    - App.tsx

key-decisions:
  - "Sweep computes its own node-pure localNow() rather than importing database.localDateTime, keeping the service free of expo coupling (node:sqlite-testable)"
  - "now clock is an injectable param (default localNow) so the single-arg App.tsx call is unchanged while tests drive a fixed clock"
  - "History prune keeps <= (no exact-day boundary contract); expiry predicate keeps strict < — deliberately not aligned, per plan"

patterns-established:
  - "Registration idempotency via a module-scope one-shot flag guarding a re-runnable ready-gated effect"
  - "node:sqlite proxy-executor tests to deterministically reproduce a scan→drop interleave and a forced mid-loop drop failure"

requirements-completed: [FLD-05]

coverage:
  - id: D1
    description: "Launch sweep expires >30-day quarantined defs (snapshot to field_history, then DELETE def + DROP COLUMN, each in its own re-verified transaction) and retains <30-day defs"
    requirement: FLD-05
    verification:
      - kind: unit
        ref: "src/services/field-sweep.test.ts#expires a >30d field (snapshotting values), retains a <30d field, and prunes old history; a second run is a no-op"
        status: pass
    human_judgment: false
  - id: D2
    description: "Strict-< boundary: exactly-31-days expires, exactly-30-days survives"
    requirement: FLD-05
    verification:
      - kind: unit
        ref: "src/services/field-sweep.test.ts#field sweep — 30/31-day boundary (strict `<`)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sweep-TOCTOU: a field restored between the candidate scan and its drop survives (re-read-under-lock decides)"
    requirement: FLD-05
    verification:
      - kind: unit
        ref: "src/services/field-sweep.test.ts#does not drop a field restored between the candidate scan and its drop"
        status: pass
    human_judgment: false
  - id: D4
    description: "No-hang / registry not wedged (HIGH-1): the hook resolves within timeout and a second runLaunchSweep still executes hooks"
    requirement: FLD-05
    verification:
      - kind: unit
        ref: "src/services/field-sweep.test.ts#resolves within a short timeout and leaves the registry usable for a second launch"
        status: pass
    human_judgment: false
  - id: D5
    description: "Per-def failure isolation: one failed drop neither aborts the loop nor skips the history prune"
    requirement: FLD-05
    verification:
      - kind: unit
        ref: "src/services/field-sweep.test.ts#continues past a failed drop and still prunes history"
        status: pass
    human_judgment: false
  - id: D6
    description: "field_history retention prune runs inside inWriteTransaction on the same 30-day schedule"
    requirement: FLD-05
    verification:
      - kind: unit
        ref: "src/services/field-sweep.test.ts#expires a >30d field (snapshotting values), retains a <30d field, and prunes old history; a second run is a no-op"
        status: pass
    human_judgment: false
  - id: D7
    description: "App wiring: getExecutor() accessor + once-only field-sweep registration before the cold-start trigger, after migration"
    requirement: FLD-05
    verification:
      - kind: unit
        ref: "npx tsc --noEmit && npx biome check src/db/database.ts App.tsx && npm run check:colors -- App.tsx"
        status: pass
      - kind: manual_procedural
        ref: "on-device cold-start launch fires the sweep after migration (Plan 06 device path)"
        status: unknown
    human_judgment: true
    rationale: "App.tsx AppState/effect wiring and the cold-start sweep firing are only observable on a real foreground launch on device; node tests cover the sweep logic but not the RN lifecycle binding."

# Metrics
duration: 12min
completed: 2026-08-14
status: complete
---

# Phase 3 Plan 07: Launch Quarantine-Expiry + History-Retention Sweep Summary

**FLD-05 launch sweep that drops >30-day quarantined custom fields (snapshot-then-drop, re-verified under the lock) and prunes field_history on the same 30-day schedule — wired onto the DATA-06 registry and fired once per real foreground launch.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-08-14
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `registerFieldSweep(getExec, now?)` pushes one idempotent hook onto the Phase-2 launch-sweep registry — the DATA-06 registry's intended first consumer.
- The per-def loop calls Plan 03's `expireFieldIfStale` DIRECTLY (no outer `withMutex`/`inWriteTransaction`), closing the HIGH-1 self-deadlock; a bare candidate scan only narrows the set, and the authoritative staleness re-check happens under the lock, so a field restored after the scan survives (cycle-2 sweep-TOCTOU).
- Per-def `try/catch` isolates a failed drop so neither the loop nor the trailing `field_history` prune (inside its own `inWriteTransaction`) is skipped.
- `QUARANTINE_WINDOW_DAYS = 30` fixed top-of-file constant; strict `<` expiry predicate via `datetime('now','localtime',?)` (never `date(...)`, never `toISOString`).
- Wired into the app: `database.getExecutor()` accessor + once-only registration in App.tsx's ready-gated effect, before `installSweepTrigger` fires the cold-start sweep.
- 6 node:sqlite tests (expiry+retention, 30/31 boundary, TOCTOU, no-hang, per-def isolation) plus the full 231-test suite pass.

## Task Commits

1. **Task 1: field-sweep.ts — quarantine expiry + history retention hook** — `80c8502` (feat)
2. **Task 2: Wire the sweep into the app (getExecutor + App.tsx registration)** — `223bf9e` (feat)

## Files Created/Modified
- `src/services/field-sweep.ts` — the sweep hook, window constant, node-pure `localNow` clock.
- `src/services/field-sweep.test.ts` — node:sqlite behavioural proof (6 tests).
- `src/db/database.ts` — added `getExecutor(): SqlExecutor` accessor over the cached, migrated connection.
- `App.tsx` — imports + once-only `registerFieldSweep(getExecutor)` before `installSweepTrigger`, module-scope guard.

## Decisions Made
- Service computes its own node-pure `localNow()` instead of importing `database.localDateTime`, keeping `field-sweep.ts` free of the expo-sqlite import so the whole sweep is node:sqlite-testable.
- `now` is an injectable clock param (default `localNow`) — App.tsx's single-arg call is unchanged, tests inject a fixed clock.
- Left the history prune at `<=` and the expiry predicate at strict `<` per the plan (history retention has no exact-day boundary contract; do NOT align them).

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Biome flagged import ordering in the new test file; resolved with `biome check --write` (import organization only, no logic change). Tests re-run green afterward.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The DATA-06 launch-sweep registry now has its first real consumer; later hooks (archived purge, schedule reconcile, backup rotation, fuel) follow the same register-one-idempotent-hook pattern.
- On-device verification of the cold-start firing (D7) belongs to the Plan 06 device path — node tests cover the sweep logic but not the RN AppState lifecycle binding.

## Self-Check: PASSED

---
*Phase: 03-custom-fields*
*Completed: 2026-08-14*
