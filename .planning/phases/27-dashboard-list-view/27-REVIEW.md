---
phase: 27-dashboard-list-view
reviewed: 2026-09-05T22:59:30Z
depth: deep
files_reviewed: 38
files_reviewed_list:
  - src/backup/backup-schema.test.ts
  - src/backup/backup-schema.ts
  - src/backup/restore-apply.test.ts
  - src/components/ListRow.tsx
  - src/components/UniversalFab.tsx
  - src/components/icons/StatusGlyph.tsx
  - src/components/icons/icon-registry.ts
  - src/components/icons/status-display-label.ts
  - src/components/list-row-content.test.ts
  - src/components/list-row-content.ts
  - src/db/app-settings-dao.test.ts
  - src/db/app-settings-dao.ts
  - src/db/dashboard-knowledge-read.test.ts
  - src/db/dashboard-knowledge-read.ts
  - src/db/dashboard-read.test.ts
  - src/db/dashboard-read.ts
  - src/db/dashboard-search-read.test.ts
  - src/db/dashboard-search-read.ts
  - src/db/database.ts
  - src/db/knowledge-search-read.test.ts
  - src/db/knowledge-search-read.ts
  - src/db/migrations/020-dashboard-swipe-pref.test.ts
  - src/db/migrations/020-dashboard-swipe-pref.ts
  - src/db/migrations/full-chain.test.ts
  - src/logic/dashboard-query-logic.ts
  - src/logic/favourite-optimistic.test.ts
  - src/logic/favourite-optimistic.ts
  - src/logic/list-row-selection.test.ts
  - src/logic/list-row-selection.ts
  - src/screens/HomeScreen.tsx
  - src/services/fuel-age.ts
  - src/services/notifications/digest-schedule.test.ts
  - src/services/notifications/notification-schedule.test.ts
  - src/services/quick-log-command.test.ts
  - src/services/quick-log-command.ts
  - src/services/widget/widget-data.test.ts
  - src/utils/dates.test.ts
  - src/utils/dates.ts
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-09-05T22:59:30Z  
**Depth:** deep  
**Files Reviewed:** 38  
**Status:** issues_found

## Summary

The dashboard-list flow, its read-model wiring, migration registration, backup allowlist, search composition, and the shared Quick Log command were traced across their callers. The targeted scoped suite passed (17 files, 250 tests), as did `npx tsc --noEmit`; neither test result covers the state-reconciliation failure below. One rapid favourite-toggle path can leave the displayed membership opposite to the committed database value. A second issue breaks the documented fail-closed snooze contract for numerically malformed timestamps.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A failed latest favourite toggle discards an earlier committed write

**Classification:** BLOCKER  
**File:** `src/screens/HomeScreen.tsx:724-755`; `src/logic/favourite-optimistic.ts:46-50`  
**Issue:** Two quick taps on the same star start two independently queued writes. For an initially non-favourite contact, the first tap starts `setFavouriteRank` (generation 1, `true`) and the second starts `clearFavouriteRank` (generation 2, `false`). The shared write mutex commits generation 1 first. Because generation 2 already exists, generation 1's success is deliberately treated as stale and `applyCommittedMembership` is skipped at HomeScreen line 733. If generation 2 then fails and rolls back, `resolve(..., "failure")` removes the `false` overlay without restoring the successfully committed generation-1 base value. The row therefore renders the old `false` base value while SQLite correctly contains a favourite. A later reload is required to repair the visible state; this directly violates the claimed rapid-tap/failure reconciliation behavior.

**Fix:** Serialize per-contact toggle intent through a single reconciliation state that retains the latest committed base membership while a newer request is pending. On the final failure, restore that committed base (generation 1 in this sequence); on the final success, patch it to the successful intent. Alternatively, await a per-contact mutation queue and issue an authoritative reload after its final settlement. Add an integration-level deferred-write test for: set succeeds, subsequent clear fails, then assert both the rendered base membership and the persisted row remain favourite.

## Warnings

### WR-01: Numeric-but-invalid timestamps are normalized instead of failing closed

**Classification:** WARNING  
**File:** `src/utils/dates.ts:25-40,64-70`; `src/components/ListRow.tsx:106-114`  
**Issue:** `parseLocalMs` checks only digit shape and then lets `new Date(...)` normalize out-of-range components. For example, `"2026-09-05 99:00:00"` matches and becomes a later valid JS date, whereas SQLite's `date(snooze_until)` returns NULL for that timestamp. `isSnoozed` consequently returns true instead of the promised false/NULL-equivalent result. The same parser is called without a guard by `formatListRecency`, so an invalid non-null `last_contact` (also unconstrained `TEXT`) throws during ListRow render. Current coverage tests only a non-numeric malformed value and misses both cases.

**Fix:** Validate the parsed components before constructing `Date` (at minimum month 1-12, hour 0-23, minute/second 0-59, and a date that survives the intended local-date validation), then throw for invalid input so `isSnoozed` returns false. Make List recency return the neutral fallback for malformed stored values rather than throw in rendering. Add numeric malformed cases such as `"2026-09-05 99:00:00"` and `"2026-99-01"` to `dates.test.ts` and a ListRow-content fallback test.

---

_Reviewed: 2026-09-05T22:59:30Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_
