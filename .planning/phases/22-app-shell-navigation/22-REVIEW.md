---
phase: 22-app-shell-navigation
reviewed: 2026-09-02T22:39:48Z
depth: standard
files_reviewed: 53
files_reviewed_list:
  - App.tsx
  - package.json
  - src/components/AddSpeedDialFab.tsx
  - src/components/ContactPicker.tsx
  - src/components/MergeImpactSummary.tsx
  - src/components/OverflowMenu.tsx
  - src/components/ResumeImportPrompt.tsx
  - src/components/ResumeReconcilePrompt.tsx
  - src/components/ShellAppBar.tsx
  - src/components/Snackbar.tsx
  - src/components/UniversalFab.tsx
  - src/components/universal-fab-logic.test.ts
  - src/components/universal-fab-logic.ts
  - src/db/picker-read.ts
  - src/logic/contact-picker-order.test.ts
  - src/logic/contact-picker-order.ts
  - src/navigation/RootNavigator.tsx
  - src/navigation/back-intent.test.ts
  - src/navigation/back-intent.ts
  - src/navigation/discard-keep-guard.ts
  - src/navigation/focused-route-classification.test.ts
  - src/navigation/focused-route-classification.ts
  - src/navigation/linking.ts
  - src/navigation/notification-gate.test.tsx
  - src/navigation/notification-gate.tsx
  - src/navigation/reset-intents.test.ts
  - src/navigation/reset-intents.ts
  - src/navigation/tabs/BackupStack.tsx
  - src/navigation/tabs/DashboardStack.tsx
  - src/navigation/tabs/OrreryStack.tsx
  - src/navigation/tabs/SettingsStack.tsx
  - src/navigation/types.ts
  - src/navigation/use-bottom-clearance.ts
  - src/navigation/widget-linking.ts
  - src/screens/BackupScreen.tsx
  - src/screens/ComposeScreen.tsx
  - src/screens/ContactProfileScreen.tsx
  - src/screens/EditContactScreen.tsx
  - src/screens/GroupEventsScreen.tsx
  - src/screens/HomeScreen.tsx
  - src/screens/ImportCompleteScreen.tsx
  - src/screens/ImportReviewScreen.tsx
  - src/screens/OrreryScreen.tsx
  - src/screens/ReconcileCompleteScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/screens/placeholders/FabActionPlaceholders.tsx
  - src/services/notifications/notification-nav.test.ts
  - src/services/notifications/notification-nav.ts
  - src/stores/shell-refresh-store.ts
  - src/stores/shell-transient-store.test.ts
  - src/stores/shell-transient-store.ts
  - src/stores/snackbar-store.ts
  - src/stores/tab-bar-layout-store.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-09-02T22:39:48Z
**Depth:** standard
**Files Reviewed:** 53
**Status:** issues_found

## Summary

Reviewed the submitted shell/navigation, FAB, picker, resume, notification, and widget-routing changes in their immediate integration paths. TypeScript compilation and the full Vitest suite pass, but the asynchronous intent gates can route to an obsolete item, and notification payload validation does not meet its stated untrusted-input boundary.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Concurrent notification taps can reset to the older destination

**Classification:** WARNING

**File:** `src/navigation/notification-gate.tsx:186-193`

**Issue:** Each update to `pendingBodyData` starts an independent `applyBodyNav` request, but the effect has no cancellation/token check. If tap A is still waiting on its DB lookup when tap B arrives, both calls can complete and reset navigation. Whichever lookup completes last wins, so an older notification can replace the destination selected by the newer tap. The older `.finally(() => setPendingBodyData(null))` can also clear the state for B.

**Fix:** Capture a monotonically increasing request id (or use an effect cleanup cancellation flag) before starting `applyBodyNav`; only reset navigation and clear pending state if that id is still current. Add a gate-level test that holds the first lookup, injects a second tap, and resolves the first last.

### WR-02: A warm widget URL can be overwritten by the delayed cold-start URL

**Classification:** WARNING

**File:** `src/navigation/widget-linking.ts:221-234`

**Issue:** The listener is registered before awaiting `Linking.getInitialURL()`. A newly delivered warm URL can set `pending` at line 224, then the slower `getInitialURL()` result unconditionally sets the launch URL at line 233. This navigates to a stale launch intent instead of the user's latest widget action.

**Fix:** Read and enqueue the initial URL before subscribing, or track whether a warm URL was received and avoid replacing it with the initial URL. Add a test for a warm event arriving before `getInitialURL()` resolves.

### WR-03: Notification routing accepts invalid contact identifiers from untrusted data

**Classification:** WARNING

**File:** `src/services/notifications/notification-nav.ts:59-67`

**Issue:** The narrowing accepts every JavaScript `number`, including `NaN`, infinity, negative values, zero, and fractional values. The resulting intent is then passed to the contact lookup and navigator. This contradicts the module's malformed-payload rejection contract and weakens the untrusted notification-data boundary.

**Fix:** Require a positive safe integer: `Number.isSafeInteger(rec.contactId) && rec.contactId > 0`. Extend the resolver tests with `NaN`, `Infinity`, `0`, `-1`, and a decimal contact id, asserting `null` for each.

---

_Reviewed: 2026-09-02T22:39:48Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
