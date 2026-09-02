---
phase: 22
fixed_at: 2026-09-02T22:46:23Z
review_path: .planning/phases/22-app-shell-navigation/22-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 22: Code Review Fix Report

**Fixed at:** 2026-09-02T22:46:23Z  
**Source review:** `.planning/phases/22-app-shell-navigation/22-REVIEW.md`  
**Iteration:** 1

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Concurrent notification taps can reset to the older destination

**Files modified:** `src/navigation/notification-gate.tsx`, `src/navigation/notification-gate.test.tsx`  
**Commit:** `46c5113`  
**Applied fix:** Added a monotonically increasing body-navigation request id. A completed lookup now resets navigation and clears pending state only while its request remains current; the regression test resolves the first lookup last and confirms it cannot replace the newer destination.

### WR-02: A warm widget URL can be overwritten by the delayed cold-start URL

**Files modified:** `src/navigation/widget-linking.ts`, `src/navigation/widget-linking.test.ts`  
**Commit:** `ea46f7d`  
**Applied fix:** Preserved the warm event subscription while preventing a delayed initial URL from enqueueing after a newer valid warm widget intent. The regression test delivers a warm URL before resolving the cold-start URL.

### WR-03: Notification routing accepts invalid contact identifiers from untrusted data

**Files modified:** `src/services/notifications/notification-nav.ts`, `src/services/notifications/notification-nav.test.ts`  
**Commit:** `1616923`  
**Applied fix:** Contact identifiers now require a positive safe integer. Tests reject `NaN`, infinity, zero, negative, and fractional identifiers.

## Verification

Verification ran in the **main checkout** (`workflow.use_worktrees=false`), so it is reproducible from the current branch.

- Targeted Vitest suites passed for each fixed finding.
- `npx tsc --noEmit --pretty false` passed after each fix and after the full suite.
- `npm test` passed: 197 test files and 1,876 tests.

---

_Fixed: 2026-09-02T22:46:23Z_  
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 1_
