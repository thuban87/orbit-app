---
phase: 28-dashboard-card-view
reviewed: 2026-09-06T09:35:00Z
depth: deep
files_reviewed: 21
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
  - src/navigation/types.ts
  - src/screens/HomeScreen.tsx
  - src/screens/dashboard-overflow-actions.test.ts
  - src/screens/dashboard-overflow-actions.ts
  - src/stores/dashboard-selection-store.test.ts
  - src/stores/dashboard-selection-store.ts
findings:
  blocker: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 28: Dashboard Card View — Code Review

**Reviewed:** 2026-09-06  
**Depth:** deep  
**Files reviewed:** 21  
**Status:** issues_found

## Summary

The card grid, selection state, atomic bulk DAO composers, and bulk-action UI were
reviewed across their relevant call chains. Type checking, token validation, and
the full Vitest suite passed, but the final bulk-action surface has two release
blockers: it permits duplicate submissions whose first undo receipt is lost, and
it can apply a category update to a stale selection.

## Critical Issues

### CR-01: Overlapping bulk submissions can create unundoable duplicate Quick Logs

**Classification:** BLOCKER  
**Files:** `src/components/BulkActionSurface.tsx:51,92-100`; `src/screens/HomeScreen.tsx:847-872`

**Issue:** The action surface disables only when `selectedCount === 0`, and the
HomeScreen action handler has no synchronous pending-operation fence. A double tap
on small-batch Quick Log can commit two atomic batches. The singleton snackbar
holds only the latest Undo receipt, so the first committed batch becomes
unreversible through the advertised Undo action.

**Fix:** Gate every bulk action while a bulk operation is in flight, using a
synchronous ref/single-flight guard as well as render state. Add a deferred-write
test proving a double press performs one batch and retains its receipt for Undo.

### CR-02: Set Category can write to contacts that are no longer selected

**Classification:** BLOCKER  
**File:** `src/screens/HomeScreen.tsx:973-978,1750-1769`

**Issue:** Set Category captures selected IDs before awaiting `listCategories`,
then opens and commits the picker using that stale snapshot. The user can exit or
change selection while categories load, causing a later choice to mutate contacts
that are no longer selected.

**Fix:** Bind the picker to a selection-session token and revalidate it before
opening and committing, or block selection changes for the pending picker. Add a
test for exiting/changing selection while the category read is deferred.

## Warnings

### WR-01: The selection store accepts an out-of-universe seed ID

**File:** `src/stores/dashboard-selection-store.ts:31-39`

**Issue:** `toggle` fences IDs against the frozen universe, but `enterSelection`
directly seeds any supplied ID. A non-card caller can therefore begin a selection
with an ineligible contact, defeating the store-level invariant.

**Fix:** Deduplicate the eligible universe first and add `seedId` only when it is
contained in that universe. Cover an ineligible seed in the unit tests.

### WR-02: A single bulk Snooze can assign different dates across midnight

**Files:** `src/db/bulk-actions-dao.ts:131-140`; `src/db/snooze-dao.ts:84-88`

**Issue:** The bulk composer invokes the snooze core once per contact, and each
core independently resolves SQLite `date('now')`. A batch crossing local midnight
can produce different `snooze_until` values for one selected preset.

**Fix:** Resolve the preset target once for the outer batch and bind that same
value for every contact core invocation.

---

_Reviewer: gsd-code-reviewer_  
_Report materialized by the execution orchestrator from the reviewer's returned findings._
