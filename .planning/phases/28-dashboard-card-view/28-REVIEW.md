---
phase: 28-dashboard-card-view
reviewed: 2026-09-06T11:39:35Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - src/components/BulkActionSurface.tsx
  - src/db/bulk-actions-dao.test.ts
  - src/db/bulk-actions-dao.ts
  - src/logic/dashboard-bulk-action-session.test.ts
  - src/logic/dashboard-bulk-action-session.ts
  - src/screens/HomeScreen.tsx
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-09-06T11:39:35Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Re-review of commit `304c5cf` verifies that CR-01 and CR-02 are fixed. Every writer-facing confirm/picker callback consumes its ownership claim synchronously, and a consumed claim is no longer retained as an input claim for Done to release. Token-bound release also makes a stale completion inert against a later claim. The related DAO actions remain atomic and the focused gate/DAO suite passes (18 tests), as does `tsc --noEmit`.

The test-coverage warning remains: the added tests reimplement the gate protocol rather than exercising HomeScreen's actual callbacks, state transitions, and rendered controls. A future host wiring regression can therefore pass unchanged.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Bulk-action regression tests do not exercise the HomeScreen host paths

**Classification:** WARNING

**File:** `src/logic/dashboard-bulk-action-session.test.ts:46-104`
**Issue:** The repeated confirmation/Snooze/category test invokes a local `onChoice` wrapper around `gate.consume`, not the callbacks rendered by `HomeScreen`; the Done case likewise uses `const exitSelection = () => undefined`. There is no HomeScreen test covering these controls. Consequently, the tests would still pass if HomeScreen stopped passing the claimed token, called `releaseBulkInputClaim` after consumption, or regressed the picker/confirmation state wiring.
**Fix:** Add a HomeScreen-level regression suite that mocks each bulk DAO with a deferred promise, presses the actual `ConfirmDialog` and picker test IDs twice, and presses Done while a writer is pending. Assert exactly one DAO invocation and that another bulk action is rejected until the original claim settles.

---

_Reviewed: 2026-09-06T11:39:35Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
