---
phase: 38-your-week
reviewed: 2026-09-19T16:11:42Z
depth: deep
files_reviewed: 44
files_reviewed_list:
  - src/backup/backup-schema.ts
  - src/backup/export-manifest.ts
  - src/backup/restore-apply.ts
  - src/backup/types.ts
  - src/components/digest/DigestDayDetail.tsx
  - src/components/digest/HorizonSection.tsx
  - src/components/digest/UpNextSection.tsx
  - src/components/digest/YourWeekHeatmap.tsx
  - src/components/digest/YourWeekSection.tsx
  - src/components/digest/your-week-section-logic.ts
  - src/components/history/HistorySection.tsx
  - src/components/history/InteractionDetail.tsx
  - src/components/icons/icon-registry.ts
  - src/components/ui/__dev__/Phase38UatControls.tsx
  - src/components/ui/__dev__/ThemePreviewScreen.tsx
  - src/components/universal-fab-logic.ts
  - src/db/app-settings-dao.ts
  - src/db/dashboard-read.ts
  - src/db/database.ts
  - src/db/digest-read.ts
  - src/db/group-events-dao.ts
  - src/db/group-events-read.ts
  - src/db/migrations/030-your-week-period.ts
  - src/db/recency-dao.ts
  - src/db/status.ts
  - src/db/up-next-read.ts
  - src/db/your-week-read.ts
  - src/logic/dashboard-query-logic.ts
  - src/logic/digest-composition.ts
  - src/navigation/RootNavigator.tsx
  - src/navigation/linking.ts
  - src/navigation/notification-gate.tsx
  - src/navigation/reset-intents.ts
  - src/navigation/shell-contract.ts
  - src/navigation/tabs/DashboardStack.tsx
  - src/navigation/tabs/DigestStack.tsx
  - src/navigation/tabs/EventsStack.tsx
  - src/navigation/tabs/SettingsStack.tsx
  - src/navigation/types.ts
  - src/screens/DigestScreen.tsx
  - src/screens/GroupEventDetailScreen.tsx
  - src/screens/SettingsInteractionsScreen.tsx
  - src/services/history/week-window.ts
  - src/services/notifications/__dev__/phase38-uat.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-09-19T16:11:42Z  
**Depth:** deep  
**Files Reviewed:** 44  
**Status:** issues_found

## Summary

The Phase 38 navigation, Digest composition, SQLite reads, settings migration/backup path, notification routing, group-event participant path, and DEV UAT controls were reviewed against the complete on-disk subsystem implementations and the governing decisions. No recorded-decision reversal, security vulnerability, destructive migration flaw, or data-loss defect was found. Three correctness/robustness defects remain: day detail transiently reports false emptiness, the seven-cell heatmap clips on compact Android widths, and the DEV notification probe can orphan duplicate scheduled notifications.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Selecting an active day briefly renders a false “No activity” result

**File:** `src/components/digest/YourWeekSection.tsx:171-177` (rendered by `src/components/digest/DigestDayDetail.tsx:36-39`)  
**Classification:** WARNING  
**Issue:** `onSelectDay` selects the date and resets `dayRows` to `[]` before the asynchronous SQLite read completes. Because `DigestDayDetail` treats an empty array as a completed empty result, every selection immediately renders “No activity on this date,” including days whose heatmap cell has a non-zero count. A slow device or busy SQLite connection makes the incorrect state user-visible; a read failure leaves the false empty result in place indefinitely because the catch only logs.  
**Fix:** Track day-detail load state separately (`idle | loading | loaded | error`) or retain `null` as the unresolved value. Render a loading/error state until the matching request completes, and only render “No activity” after a successful read returns an empty array. Preserve the existing selected-date stale-result guard.

### WR-02: The fixed-width seven-day heatmap exceeds compact-phone content width

**File:** `src/components/digest/YourWeekHeatmap.tsx:8-9,100-104`  
**Classification:** WARNING  
**Issue:** Seven fixed 44dp cells plus six 4dp gaps require 332dp. `DigestScreen` also applies 16dp padding on both sides, so the layout needs at least 364dp of screen width. On 360dp and narrower Android layouts, the row overflows/clips; there is no wrapping, horizontal scrolling, or width-aware layout. This can make the last day partly or wholly untappable even though each individual cell meets the 44dp target. The Pixel UAT does not cover this compact-width boundary.  
**Fix:** Make the week row width-aware while preserving 44dp targets—for example, place the seven-day grid in an explicitly accessible horizontal scroller on widths below 364dp, or reduce/remove outer horizontal padding for this section when seven 44dp targets do not fit. Add a render/layout contract test for 320dp and 360dp widths.

### WR-03: Repeated DEV probe scheduling can leave orphaned Digest notifications

**File:** `src/components/ui/__dev__/Phase38UatControls.tsx:60-64` and `src/services/notifications/__dev__/phase38-uat.ts:20-39,42-56`  
**Classification:** WARNING  
**Issue:** Every press schedules a new `digest:uat:<timestamp>` request, while component state retains only the most recent identifier and recovery returns only the first matching identifier. The Schedule button has no single-flight guard and does not cancel an existing probe first. Two presses can therefore create multiple scheduled probes; cancelling the retained ID removes only one and leaves another to fire later. This is DEV-only, but it violates the control's stated exact-identifier cleanup guarantee and can contaminate physical notification UAT.  
**Fix:** Enforce one probe at a time. Before scheduling, enumerate and cancel/dismiss every `digest:uat:*` request, or refuse scheduling while any probe exists/in flight. Return all matching identifiers from recovery (or deterministically clean all of them), and add a test proving repeated scheduling leaves exactly one UAT request and never touches `digest:weekly`.

---

_Reviewed: 2026-09-19T16:11:42Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_
