---
phase: 22-app-shell-navigation
reviewed: 2026-09-03T04:43:59Z
depth: deep
files_reviewed: 3
files_reviewed_list:
  - src/components/ContactPicker.tsx
  - src/components/UniversalFab.tsx
  - src/navigation/RootNavigator.tsx
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 22: Post-UAT Fix Code Review Report

**Reviewed:** 2026-09-03T04:43:59Z
**Depth:** deep
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the post-UAT picker stacking, keyboard-preservation, and top-safe-area changes, tracing their callers through the shell transient registry, snackbar host, canonical recency writers, navigation host, and relevant tests. The picker remains mounted through keyboard visibility changes, and the safe-area wrapper does not alter the tab route or Back-handler contracts. One existing but reachable Quick Log/Undo race remains in the changed `UniversalFab` transaction path.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: A second Undo is silently discarded while an earlier undo is in flight

**Classification:** WARNING

**File:** `src/components/UniversalFab.tsx:189-218`

**Issue:** `undoPending` is one component-wide boolean rather than state for the interaction being undone. After the user starts Undo for interaction A, they can log interaction B before A's `deleteTouchpoint()` resolves. B's successful commit replaces the snackbar with its own Undo action. Pressing that action first dismisses the snackbar in `Snackbar.tsx:28-30`, then reaches line 191 and returns because A still holds `undoPending`. Interaction B remains persisted, and its only Undo affordance has been removed without feedback. This violates the per-interaction Undo contract under a valid overlapping transaction sequence.

**Fix:** Track pending deletes by `interactionId` (for example, `useRef(new Set<number>())`) so Undo for B is independent of A, and only consume/dismiss an action when its own operation is accepted. Add a component/integration regression test that holds A's delete promise, commits B, presses B's Undo, then verifies both canonical `deleteTouchpoint` calls receive their matching `(contactId, interactionId)` pairs.

---

_Reviewed: 2026-09-03T04:43:59Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
