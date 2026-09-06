---
phase: 28-dashboard-card-view
reviewed: 2026-09-06T11:27:55Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - src/components/BulkActionSurface.tsx
  - src/components/CardContextMenu.tsx
  - src/components/CardGrid.tsx
  - src/components/GridCard.tsx
  - src/components/icons/icon-registry.ts
  - src/db/bulk-actions-dao.test.ts
  - src/db/bulk-actions-dao.ts
  - src/db/contacts-dao.test.ts
  - src/db/contacts-dao.ts
  - src/db/events-dao.ts
  - src/db/favourites-dao.ts
  - src/db/recency-dao.ts
  - src/db/snooze-dao.ts
  - src/logic/card-line3-selection.test.ts
  - src/logic/card-line3-selection.ts
  - src/logic/dashboard-bulk-action-session.test.ts
  - src/logic/dashboard-bulk-action-session.ts
  - src/navigation/types.ts
  - src/screens/dashboard-overflow-actions.test.ts
  - src/screens/dashboard-overflow-actions.ts
  - src/screens/HomeScreen.tsx
  - src/stores/dashboard-selection-store.test.ts
  - src/stores/dashboard-selection-store.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-09-06T11:27:55Z
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The Card grid, selection session fencing, batch Snooze date resolution, and category session validation are substantively wired. The Phase 28-08 single-flight fix is incomplete at its host boundary: post-claim UI callbacks can repeat a claimed operation, and exiting selection releases an in-flight write's lock. Both paths allow duplicate durable bulk writes and can again overwrite a Quick Log Undo receipt.

Focused Phase 28 tests, TypeScript, and the colour-token check pass, but the focused gate test models only two direct starts and does not execute these host paths.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A claimed bulk operation can be submitted repeatedly from confirmation and picker controls

**Classification:** BLOCKER

**File:** `src/screens/HomeScreen.tsx:1103-1113`, `src/screens/HomeScreen.tsx:1842-1861`, `src/screens/HomeScreen.tsx:1889-1920`

**Issue:** The initial action acquires `bulkActionGate`, but the controls shown after that claim do not have a one-shot guard. `onBulkConfirm` passes `alreadyClaimed=true` to the writers, bypassing `tryAcquireBulkAction`; a rapid second Confirm press before React commits `setBulkConfirm(null)` launches the same write again. Snooze and category choices have the same shape: they keep the existing claim but issue their writer directly on every press before their state-clearing render commits. This creates duplicate interactions/events (or duplicate category/snooze writes) and can overwrite the singleton Quick Log Undo snackbar, precisely the failure the Phase 28-08 gate was meant to prevent.

**Fix:** Make every confirmation/picker choice consume the pending claim exactly once before starting a writer. For example, track an operation token/ref when opening the dialog or picker, atomically mark it consumed in the choice handler, and reject later callbacks; also disable the choice controls immediately. Keep the gate held until the one writer settles and add deferred double-press regressions for Confirm, Snooze, and Category.

### CR-02: Exiting selection unlocks an in-flight write and lets a later operation overlap it

**Classification:** BLOCKER

**File:** `src/screens/HomeScreen.tsx:1121-1128`, `src/screens/HomeScreen.tsx:866-900`, `src/screens/HomeScreen.tsx:911-926`

**Issue:** `exitBulkSelection` unconditionally calls `releaseBulkAction()` while the Done control remains available during `bulkActionPending`. If a user exits while a DAO promise is unresolved, they can re-enter selection and start operation B even though operation A is still writing. When A's unconditional `.finally(releaseBulkAction)` later runs, it releases B's claim as well, allowing further overlap. The screen-level single-flight invariant is therefore broken across exit/re-entry, risking duplicate writes and overwritten feedback/Undo state.

**Fix:** Associate each acquire/release with an ownership token. Exiting selection should invalidate and close only dialogs/pickers; it must not release a claim that already owns a DAO write. Release the writer's token only from that writer's settled path, and ensure a stale settled path cannot release a newer claim. Add a deferred-write regression for Done → re-enter → new action before the first write settles.

## Warnings

### WR-01: The new gate tests do not exercise the HomeScreen paths that bypass it

**Classification:** WARNING

**File:** `src/logic/dashboard-bulk-action-session.test.ts:15-42`

**Issue:** The test proves only that two direct calls which each invoke `tryAcquire()` result in one DAO call. It does not cover `alreadyClaimed=true` confirmation writes, picker choices, or `exitBulkSelection` releasing an unresolved claim, so all blocker paths pass the suite unchanged.

**Fix:** Add host-level tests with deferred DAO promises that invoke each rendered confirmation/picker callback twice and test exit/re-entry while pending. Assert one writer invocation, one Quick Log Undo receipt, and that a second action remains rejected until the owner settles.

---

_Reviewed: 2026-09-06T11:27:55Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
