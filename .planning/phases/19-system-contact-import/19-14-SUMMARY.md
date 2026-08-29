---
phase: 19-system-contact-import
plan: 14
subsystem: import review navigation
tags: [import, session, leave-guard, data-integrity, tdd]
requires:
  - import session row statuses
  - finalizeSessionIfTerminal terminal-state semantics
provides:
  - status-based unresolved-row predicate
  - leave guard that preserves fully resolved sessions
affects:
  - ImportReviewScreen route replacements
  - BulkImportSetupScreen leave behavior
tech_stack:
  added: []
  patterns:
    - Pure Node-tested screen logic module
    - Canonical status predicate shared with terminal session semantics
key_files:
  created:
    - src/screens/import-leave-guard-logic.ts
    - src/screens/import-leave-guard-logic.test.ts
  modified:
    - src/screens/use-import-leave-guard.ts
decisions:
  - Unresolved import work is defined only by pending, needs_review, and failed row statuses.
metrics:
  duration: 5m
  completed: 2026-08-29
  tasks: 2
  files: 3
status: complete
actuals:
  tokens: 820
  tasks: 2
  commits: 3
---

# Phase 19 Plan 14: Preserve Resolved Import Sessions Summary

The import leave guard now retains fully resolved sessions, including skipped and already-linked rows, so completion-summary evidence survives route replacement.

## Tasks Completed

1. **Pure unresolved-row predicate** — Added a Node-testable predicate whose canonical unresolved set is `pending`, `needs_review`, and `failed`; seven regression cases prove resolved skipped and linked rows do not trigger cleanup.
2. **Leave-guard integration** — Replaced the null-`contactId` cleanup condition with the status predicate while retaining existing discard, staging cleanup, confirmation, and edit-state behavior.

## Verification

- `npx vitest run src/screens/import-leave-guard-logic.test.ts` — passed (7 tests).
- `grep -c 'hasUnresolvedRows(rows)' src/screens/use-import-leave-guard.ts` — passed (1).
- `npx tsc --noEmit --pretty false` — passed.
- `git diff --check` — passed.

## TDD Gate Compliance

- RED: `f2ffffb` added failing predicate tests; Vitest failed because the module did not yet exist.
- GREEN: `309caea` added the minimal pure predicate; Vitest passed.

## Decisions Made

- Match the leave guard's definition of unresolved work exactly to `finalizeSessionIfTerminal` so resolved rows are never discarded merely because they have no `contact_id`.

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

- `src/screens/import-leave-guard-logic.ts` — canonical unresolved-status predicate.
- `src/screens/import-leave-guard-logic.test.ts` — regression coverage for resolved and unresolved rows.
- `src/screens/use-import-leave-guard.ts` — status-based discard gate.

## Self-Check: PASSED

All three implementation files exist and all three task commits (`f2ffffb`, `309caea`, `cc97015`) are present in Git history.
