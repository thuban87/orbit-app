---
phase: 02-data-foundation-status-engine
plan: 05
subsystem: lifecycle
tags: [launch-sweep, appstate, hook-registry, dependency-injection, foreground-gating, tdd, data-06]

# Dependency graph
requires:
  - phase: 02-data-foundation-status-engine
    plan: 02
    provides: "openAndMigrate() bootstrap (opens orbit.db, sets PRAGMAs, migrates to TARGET_VERSION) — App.tsx gates first render on it resolving"
provides:
  - "runLaunchSweep() — runs registered hooks in registration order, idempotent within a launch via a module-level running guard"
  - "registerSweepHook(fn) — the empty Phase-2 hook registry later phases hang responsibilities on (quarantine expiry, archived-purge, schedule reconcile, digest re-register, backup rotation)"
  - "installSweepTrigger(appState) — DI-AppState trigger that fires on cold-start and ONLY on a real background→active transition (prev-state tracked); returns the subscription remover"
  - "App.tsx AppShell — migrate-gated first render (themed loading view until openAndMigrate resolves) + ready-gated sweep install with cleanup"
affects: [03, 04, 11, 15, 16, quarantine, purge, digest, backup, launch-path]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency-injected AppState: the pure module takes an { addEventListener('change', cb): { remove() } } surface so it is node-testable and owns NO react-native import; App.tsx owns the single react-native binding and injects the real AppState"
    - "Previous-AppState tracking for real foreground gating: seed prev='active' (cold start just foregrounded), fire only when prev==='background' && next==='active'; a raw inactive→active (permission dialog / notification shade) does not re-fire (T-02-11 mitigation)"
    - "No module-scope side effect: hooks registry + running guard are module state but installSweepTrigger is only invoked from an effect — a headless widget/notification bundle load runs no hook (P5)"
    - "Ready-gated install effect: installSweepTrigger runs from an effect gated on the migration-ready flag, so the immediate cold-start sweep can never precede openAndMigrate() resolving"
    - "__resetSweepForTest() test-only reset (clears hooks + running) for isolated unit tests, matching the AiService.test.ts global-reset convention"

key-files:
  created:
    - src/services/launch-sweep.ts
    - src/services/launch-sweep.test.ts
  modified:
    - App.tsx

key-decisions:
  - "AppState is dependency-injected, NOT statically imported — this diverges from RESEARCH §Code Example 4 (which does `import { AppState } from 'react-native'`) so the module stays node-testable and App.tsx owns the sole react-native binding (grep gate asserts 0 react-native imports in launch-sweep.ts)"
  - "Corrected the RESEARCH §Code Example 4 gating (review MEDIUM 'fires on any raw active'): track the PREVIOUS AppState and fire only on background→active, not on every 'active' event — a transient inactive→active must not re-fire the sweep"
  - "Sweep install is gated on the migration-ready flag in App.tsx (review MEDIUM 'sweep may install before migration resolves') so the cold-start sweep it fires can never precede a migrated DB"
  - "Phase-2 hook registry ships EMPTY — the skeleton runs no responsibilities; DATA-06 is the entry point only, with the dormant-module doc header naming the later phases (3/4/11/15/16) that register"

patterns-established:
  - "DI-AppState lifecycle trigger with previous-state foreground gating and a hand-rolled fake AppState in tests"
  - "Migrate-gated App shell: openAndMigrate() in an on-mount effect, themed loading view while pending, ready-gated lifecycle installs"

requirements-completed: [DATA-06]

coverage:
  - id: S1
    description: "runLaunchSweep runs registered hooks in registration order and is idempotent within a launch (a re-entrant call does not double-run)"
    requirement: "DATA-06"
    verification:
      - kind: unit
        ref: "src/services/launch-sweep.test.ts#runs registered hooks in registration order"
        status: pass
      - kind: unit
        ref: "src/services/launch-sweep.test.ts#is idempotent within a launch"
        status: pass
    human_judgment: false
  - id: S2
    description: "Importing launch-sweep.ts runs NOTHING — no module-scope side effect (a headless tap never reaches the sweep)"
    requirement: "DATA-06"
    verification:
      - kind: unit
        ref: "src/services/launch-sweep.test.ts#importing the module runs no hook and touches no AppState"
        status: pass
      - kind: grep
        ref: "grep -cE '^import .*react-native' src/services/launch-sweep.ts == 0"
        status: pass
    human_judgment: false
  - id: S3
    description: "installSweepTrigger fires on cold-start and ONLY on a real background→active transition; a raw inactive→active and background/inactive events do NOT fire; returns the subscription remover"
    requirement: "DATA-06"
    verification:
      - kind: unit
        ref: "src/services/launch-sweep.test.ts#fires the sweep once on cold start and returns the subscription remover"
        status: pass
      - kind: unit
        ref: "src/services/launch-sweep.test.ts#re-fires on a real background→active transition"
        status: pass
      - kind: unit
        ref: "src/services/launch-sweep.test.ts#does NOT re-fire on a raw inactive→active"
        status: pass
      - kind: unit
        ref: "src/services/launch-sweep.test.ts#does NOT fire on background or inactive events"
        status: pass
    human_judgment: false
  - id: S4
    description: "App.tsx gates first render on openAndMigrate() resolving and installs the sweep trigger from a ready-gated effect (only after migration) with cleanup; neither runs at module scope"
    requirement: "DATA-06"
    verification:
      - kind: grep
        ref: "App.tsx references openAndMigrate + installSweepTrigger; both called inside effects, not module scope"
        status: pass
      - kind: manual
        ref: "tsc --noEmit + biome check App.tsx + check:colors clean"
        status: pass
      - kind: human
        ref: "Pixel cold-start renders home shell after migration (end-of-phase device run, Plan 06)"
        status: deferred
    human_judgment: true

# Metrics
duration: 3min
completed: 2026-08-14
status: complete
---

# Phase 2 Plan 05: Launch-Sweep Skeleton + Hook Registry Summary

**A single once-per-real-foreground-launch entry point (`runLaunchSweep` + empty `registerSweepHook` registry) that takes `AppState` by dependency injection — firing on cold-start and ONLY on a tracked `background→active` transition, never on module import or a headless tap — with `App.tsx` gating first render on `openAndMigrate()` and installing the trigger from a ready-gated effect.**

## Performance

- **Duration:** ~3 min
- **Tasks:** 2 (Task 1 TDD: RED → GREEN; Task 2 wiring)
- **Files:** 2 created, 1 modified

## Accomplishments
- `src/services/launch-sweep.ts`: `runLaunchSweep()` (registration-order hooks, `running` re-entrancy guard, `finally`-reset), `registerSweepHook()` (empty in P2), and `installSweepTrigger(appState)` — DI-AppState, cold-start fire + previous-state-tracked `background→active` gating, returns the remover. Dormant-module doc header names the later phases that register. No static react-native import.
- `src/services/launch-sweep.test.ts`: 8 tests — hook order, in-flight-reentrancy idempotency, empty registry, no-import-side-effect, cold-start + remover, background→active re-fire, inactive→active no-fire, background/inactive no-fire. Hand-rolled fake AppState + macrotask `flush()`.
- `App.tsx`: added an inner `AppShell` (inside `ThemeProvider` so its loading view resolves theme tokens) that runs `openAndMigrate()` in an on-mount effect, shows a themed `ActivityIndicator` loading view until ready, then renders `HomeScreen`; installs `installSweepTrigger(AppState)` from a `ready`-gated effect with `remove()` cleanup. App.tsx owns the sole react-native binding.

## Task Commits

1. **Task 1: AppState-gated sweep runner + hook registry (TDD)** — `880f4d1` (test RED) → `0e4dd7d` (feat GREEN)
2. **Task 2: Wire App.tsx — migrate-gated render + sweep install** — `cdc2e46` (feat)

_Task 1 followed RED→GREEN; no refactor commit needed (clean on first GREEN, only a biome return-type formatting autofix applied pre-commit)._

## Files Created/Modified
- `src/services/launch-sweep.ts` — Sweep runner + empty hook registry + DI-AppState foreground trigger.
- `src/services/launch-sweep.test.ts` — 8 gating/idempotency/no-side-effect tests with an injected fake AppState.
- `App.tsx` — Migrate-gated first render + ready-gated sweep install with cleanup.

## Decisions Made
- **AppState by dependency injection, diverging from RESEARCH §Code Example 4's static `import { AppState } from 'react-native'`.** The plan mandates this so the module is node-testable and `App.tsx` owns the single react-native binding. A grep gate (`^import .*react-native` == 0) enforces it.
- **Previous-AppState tracking to fire only on a real `background→active` transition** (correction to RESEARCH §Code Example 4's `if (s === 'active')`, which fired on any raw active — review MEDIUM). `prev` seeds to `"active"`; the sweep re-fires only when `prev === "background" && next === "active"`. A named `inactive→active` test proves the permission-dialog / notification-shade path does not re-fire.
- **Sweep install gated on the migration-ready flag** (review MEDIUM "sweep may install before migration resolves"). The install effect early-returns while `!ready`, so `installSweepTrigger`'s immediate cold-start sweep can never precede a migrated DB.
- **Empty registry, skeleton only.** DATA-06 ships the entry point; the dormant-module header names Phases 3/4/11/15/16 as the future registrants (quarantine expiry, archived-purge, schedule reconcile, digest re-register, backup rotation).

## Deviations from Plan

None — plan executed exactly as written. (The DI-AppState form and the previous-state gating are the plan's own corrections to RESEARCH §Code Example 4, specified in the task, so they are not deviations.)

## Threat Model Coverage
- **T-02-11 (headless 30s-budget DoS, `mitigate`)** — mitigated: the sweep triggers only on cold-start + a tracked `background→active` transition via `installSweepTrigger`, installed only after `openAndMigrate()` resolves and never at module top-level (P5). The no-import-side-effect + prev-state gating unit tests prove a headless bundle load runs no hook.
- **T-02-12 (migration on the launch path, `accept`)** — App.tsx holds first render behind the loading state until `openAndMigrate()` resolves; the runner's Plan-01 crash-safety is the real mitigation.
- **T-02-SC (supply chain, `accept`)** — no installs; zero new dependencies.

## Issues Encountered
Biome reformatted the `installSweepTrigger` return-type annotation to a multi-line object type (whitespace-only autofix) before the GREEN commit; re-verified green.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Later phases register their launch-time responsibilities via `registerSweepHook()` — no further wiring of the trigger needed.
- Device-side confirmation (cold-start renders the home shell after migration; relaunch stable) is deferred to the end-of-phase Pixel run in Plan 06.
- No new runtime dependencies; the pure module is fully node-tested.

## Self-Check: PASSED
- FOUND: src/services/launch-sweep.ts, src/services/launch-sweep.test.ts, App.tsx
- FOUND commits: 880f4d1, 0e4dd7d, cdc2e46
- Full suite: 120 passed; tsc + biome + check:colors clean; grep gates pass (0 react-native imports in launch-sweep.ts; App.tsx refs openAndMigrate + installSweepTrigger inside effects only).

---
*Phase: 02-data-foundation-status-engine*
*Completed: 2026-08-14*
