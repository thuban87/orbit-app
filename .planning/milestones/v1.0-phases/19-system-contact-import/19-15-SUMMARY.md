---
phase: 19-system-contact-import
plan: 15
subsystem: import consolidation and navigation
tags: [import, session-terminalization, consolidation, react-navigation, tdd]
requires:
  - phase: 19-system-contact-import
    provides: durable import sessions, session rows, and finalizeSessionIfTerminal
provides:
  - Consolidated clusters finalize their session once every row is resolved
  - Setup navigation reaches the durable ImportComplete report after a terminal combine
affects:
  - BulkImportSetupScreen
  - ImportCompleteScreen
  - source-consolidation
tech_stack:
  added: []
  patterns:
    - Post-transaction terminalization through the shared session helper
    - Result-driven navigation that preserves mixed-batch processing
key_files:
  created: []
  modified:
    - src/services/import/source-consolidation.ts
    - src/services/import/source-consolidation.test.ts
    - src/screens/BulkImportSetupScreen.tsx
decisions:
  - Reuse finalizeSessionIfTerminal after post-commit photo handling instead of duplicating its unresolved-row gate.
  - Route directly to ImportComplete only when a successful cluster combine terminalizes the session.
metrics:
  duration: 2m
  completed: 2026-08-29
  tasks: 2
  files: 3
status: complete
actuals:
  tokens: 1415
  tasks: 2
  commits: 3
requirements-completed: [IMP-04]
coverage:
  - id: D1
    description: Cluster-only consolidation terminalizes its session and a mixed batch remains pending.
    requirement: IMP-04
    verification:
      - kind: unit
        ref: src/services/import/source-consolidation.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: A terminal cluster combine replaces setup with the Import complete summary.
    requirement: IMP-04
    verification:
      - kind: other
        ref: npx tsc --noEmit --pretty false
        status: pass
    human_judgment: true
    rationale: Device navigation behavior is covered by the Phase 19-17 UAT.
---

# Phase 19 Plan 15: Terminal Cluster Consolidation Summary

Cluster-only source consolidation now completes the durable import session and sends the user to Import complete, while mixed batches remain available to the normal import driver.

## Tasks Completed

1. **Finalize the session after a cluster combine** — Widened the successful consolidation result with `sessionComplete`, then invoked the shared `finalizeSessionIfTerminal` after both the atomic combine and its post-commit photo handling. Added TDD coverage for terminal two-row clusters, mixed batches, and the unchanged nameless-cluster decline.
2. **Route a completed cluster-only batch to Import complete** — `BulkImportSetupScreen` now replaces itself with `ImportComplete` when `combineCluster` returns a terminal result; mixed and declined cases continue to clear the prompt and reload.

## Verification

- `npx vitest run src/services/import/source-consolidation.test.ts` — passed (5 tests).
- `npx tsc --noEmit --pretty false` — passed.
- `npm run check:colors` — passed.
- `git diff --check` — passed.
- Device navigation confirmation remains part of the planned Phase 19-17 UAT.

## TDD Gate Compliance

- RED: `a7f9a56` added terminal and mixed-batch assertions; Vitest failed because `sessionComplete` did not exist.
- GREEN: `38be35b` added post-commit finalization and the `sessionComplete` success field; Vitest passed.

## Decisions Made

- The shared `finalizeSessionIfTerminal` remains the sole terminal-state predicate, called only after the non-reentrant combine transaction and photo step complete.
- `BulkImportSetupScreen` routes only on `result.combined && result.sessionComplete`, preserving the batch driver for any still-pending source rows.

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

- `src/services/import/source-consolidation.ts` — returns completion state after post-commit terminalization.
- `src/services/import/source-consolidation.test.ts` — verifies cluster-only completion and mixed-session non-completion.
- `src/screens/BulkImportSetupScreen.tsx` — routes completed combines to `ImportComplete`.

## Known Stubs

None.

## Next Phase Readiness

- IMP-04's cluster-only completion path is ready for the Phase 19-17 device UAT.
- No schema, package, or security-posture changes were introduced.

## Self-Check: PASSED

All three implementation files exist and task commits `a7f9a56`, `38be35b`, and `e6d45e4` are present in Git history.

---
*Phase: 19-system-contact-import*
*Completed: 2026-08-29*
