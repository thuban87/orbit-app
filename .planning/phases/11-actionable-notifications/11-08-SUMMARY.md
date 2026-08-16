---
phase: 11-actionable-notifications
plan: 08
subsystem: notifications
tags: [notifications, purge, cleanup, post-commit, best-effort]
status: complete
requires:
  - purge-dao onPurgeExtensions POST-COMMIT hook (Phase 4)
  - notification-ids decayIdentifier/birthdayIdentifier (11-01)
  - buildPhotoPurgeCleanup analog (Phase 5)
provides:
  - buildNotificationPurgeCleanup — POST-COMMIT decay+birthday cancel adapter
  - composed onPurgeExtensions (photo + notification) in ArchivedContactsScreen
affects:
  - src/screens/ArchivedContactsScreen.tsx (doPurge fan-out)
tech-stack:
  added: []
  patterns:
    - POST-COMMIT best-effort OS cleanup via onPurgeExtensions
    - identifiers rebuilt from contactId alone (row already deleted)
    - error-isolated composition (each cleanup in its own try/catch)
key-files:
  created:
    - src/services/notifications/purge-notification-cleanup.ts
    - src/services/notifications/purge-notification-cleanup.test.ts
  modified:
    - src/screens/ArchivedContactsScreen.tsx
decisions:
  - "buildNotificationPurgeCleanup takes no SqlExecutor — cancel is entirely OS-side, no DB read (unlike the photo adapter)."
  - "Composition lives inline in doPurge (photo then notif, each try/catch) rather than a shared combinator — one call site, best-effort contract already owned by purge-dao."
metrics:
  duration: ~5m
  completed: 2026-08-16
  tasks: 2
  files: 3
---

# Phase 11 Plan 08: Notification purge cleanup Summary

Purging a contact now cancels their scheduled `decay:<id>` and `birthday:<id>` notifications POST-COMMIT, via a new `buildNotificationPurgeCleanup` adapter composed alongside the existing photo cleanup in `ArchivedContactsScreen.doPurge` — closing the Phase-4 deferral (an OS alarm outliving its deleted DB row).

## What was built

- **`src/services/notifications/purge-notification-cleanup.ts`** — exports `buildNotificationPurgeCleanup()`, returning an `(contactId) => Promise<void>` adapter that cancels both `decayIdentifier(id)` and `birthdayIdentifier(id)` via `cancelScheduledNotificationAsync`. Each cancel is wrapped in a `safeCancel` helper (Logger-logged, never throwing), so one failing cancel neither skips the other nor rejects the adapter. Identifiers are rebuilt from `contactId` alone (the row is already deleted post-commit). No `SqlExecutor` parameter — the cancel is entirely OS-side, unlike the photo adapter which reads surviving defs.
- **`src/services/notifications/purge-notification-cleanup.test.ts`** — TDD RED→GREEN. Uses the 11-01 `expo-notifications` double + `vi.mock`. Asserts (1) both identifiers cancelled for a purged contact, (2) a rejected first cancel still attempts the second and the adapter resolves, (3) both cancels rejecting still resolves. 3 tests green.
- **`src/screens/ArchivedContactsScreen.tsx`** — `doPurge`'s `onPurgeExtensions` replaced the single `buildPhotoPurgeCleanup(exec)` with a composed adapter running the photo cleanup then the notification cleanup, each in its own `try/catch` (Logger-logged) so one failing does not skip the other. The two-stage archive→purge guard and all DB deletes are untouched.

## How it works

`purge-dao.purgeContact` fires `onPurgeExtensions(contactId)` AFTER the write transaction commits and the mutex is released (never inside `BEGIN`). By then the `contacts` row is gone, so the adapter rederives both identifiers from `contactId` via the `notification-ids` single-source builders and issues two OS cancels. Cancelling an already-absent identifier is a harmless OS no-op, so the adapter is idempotent. Both the photo and notification cleanups are best-effort and error-isolated — a failure is logged, never fatal, and cannot undo the committed deletes (T-11-PURGE accepted; the launch reconcile also cancels any stale identifier as a backstop).

## Deviations from Plan

None — plan executed as written. The only formatting adjustment was collapsing a `Logger.error(...)` call onto one line to satisfy biome (not a behavior change).

## Verification

- `npx vitest run src/services/notifications/purge-notification-cleanup.test.ts` — 3 passed.
- `npx vitest run src/db/purge-dao.test.ts` — 16 passed together with the new suite (adapter contract unchanged).
- `npx tsc --noEmit` — clean.
- `npm run check:colors` — clean.
- `npx biome check` on all touched files — clean.

### Deferred manual verification (phase gate, not a plan blocker)

Task 2's `<manual>` is a Pixel-UAT phase gate: purge a contact that had a scheduled decay/birthday notification and confirm the pending notification no longer fires. This is owner/phase-level UAT (the orchestrator's phase gate), not a per-plan checkpoint — code truths are green.

## TDD Gate Compliance

- RED: `f81eb33 test(11-08): add failing test...` (module-missing failure confirmed).
- GREEN: `54d6dcc feat(11-08): buildNotificationPurgeCleanup...` (3 tests pass).
- REFACTOR: none needed.

## Self-Check: PASSED

- FOUND: src/services/notifications/purge-notification-cleanup.ts
- FOUND: src/services/notifications/purge-notification-cleanup.test.ts
- FOUND (modified): src/screens/ArchivedContactsScreen.tsx
- FOUND commit f81eb33 (test), 54d6dcc (feat), a4addc2 (feat compose)
