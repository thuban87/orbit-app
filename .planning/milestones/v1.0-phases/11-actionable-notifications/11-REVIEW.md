---
phase: 11-actionable-notifications
reviewed: 2026-08-16T22:50:15Z
depth: deep
files_reviewed: 27
files_reviewed_list:
  - app.config.ts
  - App.tsx
  - package.json
  - __mocks__/expo-notifications.ts
  - __mocks__/expo-task-manager.ts
  - src/db/app-settings-dao.ts
  - src/db/contact-read.ts
  - src/db/database.ts
  - src/db/migrations/002-app-settings.ts
  - src/db/notification-read.ts
  - src/db/snooze-dao.ts
  - src/navigation/notification-gate.tsx
  - src/screens/ArchivedContactsScreen.tsx
  - src/screens/ContactProfileScreen.tsx
  - src/screens/EditContactScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/services/notifications/channels.ts
  - src/services/notifications/decay-suppression.ts
  - src/services/notifications/fire-instant.ts
  - src/services/notifications/headless-task.ts
  - src/services/notifications/notification-actions.ts
  - src/services/notifications/notification-ids.ts
  - src/services/notifications/notification-nav.ts
  - src/services/notifications/notification-schedule.ts
  - src/services/notifications/permission.ts
  - src/services/notifications/purge-notification-cleanup.ts
  - src/db/recency-dao.ts
findings:
  critical: 1
  warning: 1
  info: 2
  total: 4
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-08-16T22:50:15Z
**Depth:** deep
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Deep, subsystem-level review of the Phase 11 actionable-notifications engine —
the reconcile scheduler, the fire-instant math, the headless action handler, the
snooze/app-settings DAOs, migration 002, and the four touched screens plus the
tap-routing gate. I read the actual code on disk for every writer of the shared
tables (not the diff), grepped every writer of `last_contact` / `snooze_until`,
and traced the mutex/transaction/idempotency/date paths end-to-end.

The project's load-bearing invariants **hold**:

- **Single-writer.** `contacts.last_contact` is written ONLY by recency-dao
  (grep-confirmed); the headless mark routes through `recordTouchpoint`.
  `snooze_until` is written ONLY by snooze-dao. No rogue/raw writers introduced.
- **Non-reentrant mutex never nested.** snooze-dao composes `recordEventCore`
  (the non-mutexed core) inside its one `inWriteTransaction`; the reconcile is
  read-only (plain `getAppSettings` + `getAllAsync` reads) and never acquires the
  write mutex, so the DEFER-ONE self-coordination cannot deadlock.
- **Reuse-not-recompute.** notification-read imports `DECAY_ELIGIBLE_WHERE`
  (which reuses `PROGRESS_SQL`/`ROGUE_K` from status.ts); birthday reuses
  `daysUntilBirthday`. No second rogue constant, no re-implemented parser.
- **Migration 002** is additive/forward-only, 001 untouched, `TARGET_VERSION=2`,
  the runner applies each step atomically with its `user_version` bump, and the
  DAO validates hour fields to [0,23] and toggles to 0/1 before any UPDATE.
- **Idempotency.** Deterministic `actionUid` + in-process `handledSet` + durable
  `UNIQUE(uid)` backstop; the snooze replay correctly rolls back so a re-delivered
  tap cannot re-extend the snooze; `clearLastNotificationResponseAsync` closes the
  cold-start replay.
- **Dates.** No `toISOString`/`new Date("YYYY-MM-DD")` on the notification/snooze
  *scheduling* paths; `snooze_until` is compared/rendered as bare local
  `YYYY-MM-DD`; `clampHour` never yields NaN; the day-stepping math is component-
  based and DST-safe. (One `toISOString` leak into an app_settings write — WR-01.)
- **Channels** are IMPORTANCE_LOW, versioned, create-only, and awaited in App.tsx
  before the first cold-start reconcile; the headless path never reconciles.

One correctness defect is worth blocking on: the birthday scheduler rolls a
past-delivery-hour birthday to the **next day** while keeping the "today" body,
producing a wrong-day birthday alert (CR-01). One convention violation (WR-01)
and two low-risk notes (IN-01/IN-02) round it out.

## Critical Issues

### CR-01: Birthday notification rolls to the next day and fires with wrong-day "today" copy

**File:** `src/services/notifications/notification-schedule.ts:239-276` (`buildBirthdayRequest`), interacting with `src/services/notifications/fire-instant.ts:128-183` (`nextAllowedFireInstant`)

**Issue:**
For a birthday, `buildBirthdayRequest` computes `days = daysUntilBirthday(...)`,
builds `nextBday = today + days`, then passes it to `nextAllowedFireInstant(...)`.
`nextAllowedFireInstant` walks **day by day** until the delivery slot is strictly
after `now` (fire-instant.ts:154-172). This is correct for **decay** (a date-
agnostic "time to reach out" reminder), but **wrong for a birthday**, which is a
date-specific one-shot whose body literally says *"It's {name}'s birthday today."*

Concrete failure: it is Aug 16, `deliveryHour = 9`, and the user first foregrounds
the app (or it foregrounds after the 9am pre-scheduled fire) at 10:00. For a
contact whose birthday is today, `days = 0`, `nextBday = Aug 16`. Today's 9am slot
is `<= now`, so the loop rolls the cursor to **Aug 17 09:00** and returns it.
`buildBirthdayRequest` then emits a request with `fireInstant = Aug 17 09:00`,
`occurrenceKey = 2026-08-17`, and body "It's {name}'s birthday today." It is within
the 35-day horizon, so the reconcile schedules it. Unless the app is foregrounded
again before Aug 17 09:00 (which would recompute `days = 364`, push it past the
horizon, and cancel it), the user receives a **birthday alert one day late saying
"today"** — and if the correct 9am notification already fired, this is a duplicate.

This is reachable in ordinary use (opening the app in the afternoon on a friend's
birthday). A second, fully-deterministic trigger of the same root cause: if the
user sets `deliveryHour` inside the quiet window, `allowedSlotForDay` rolls
*every* birthday to `quietEnd` the following morning (fire-instant.ts:98-110),
so every birthday fires a day late under that config.

**Fix:** A birthday must not roll off its own date. After computing `fireInstant`,
skip the occurrence when the slot no longer falls on the birthday day:

```ts
// in buildBirthdayRequest, after computing fireInstant:
// A birthday is date-specific: if the delivery slot for the birthday day has
// already passed (or a quiet-window roll pushed it off the day), do NOT roll to
// the next morning with "today" copy — skip this occurrence entirely.
if (formatLocalDate(fireInstant) !== formatLocalDate(nextBday)) {
  return null;
}
```

(Alternatively, give the birthday path its own "same-day-only" variant of
`nextAllowedFireInstant` that returns null instead of stepping to the next day.)
Decay must keep the existing roll-forward behavior — only the birthday builder
changes.

## Warnings

### WR-01: `app_settings.modified_at` written with forbidden `toISOString()` (UTC) instead of local wall-clock

**File:** `src/screens/SettingsScreen.tsx:143`

**Issue:**
```ts
await updateAppSettings(exec, patch, new Date().toISOString());
```
Every other timestamp in the codebase — including migration 002's own seed of
`app_settings.created_at` / `modified_at` (`002-app-settings.ts:77`, via
`deps.now = localDateTime()`) — is a local wall-clock `YYYY-MM-DD HH:MM:SS`
string. This one write stores a UTC ISO-8601 string (`2026-08-16T22:50:15.000Z`)
instead, directly contravening the CLAUDE.md rule *"Use `formatLocalDate()` /
local wall-clock, never `toISOString()`."* CLAUDE.md flags this exact family of
bug as one already fixed once in the plugin and forbidden from reintroduction.

It is not a *scheduling* defect today (the reconcile never reads
`app_settings.modified_at`), which is why this is a warning and not a blocker —
but it silently drifts the column's format, and `app_settings` is explicitly the
SQLite-native surface Phase 16 backup will export by table (per the migration
header), so the inconsistency ships into backups.

**Fix:** Use the shared local-datetime helper, matching every other writer:

```ts
import { getExecutor, localDateTime } from "@/db/database";
// ...
await updateAppSettings(exec, patch, localDateTime());
```

## Info

### IN-01: `requestsEqual` title facet assumes Expo never materializes a title

**File:** `src/services/notifications/notification-schedule.ts:318-320`

**Issue:** The diff compares `(desired as { title?: string }).title` (always
`undefined` — the engine sets no title) against `existing.content?.title`. This is
only stable while the OS/Expo leaves `content.title` unset on a frozen request. If
a future Expo version (or an OS default) ever populates a title, `undefined !==
"…"` makes `requestsEqual` return false on every reconcile, cancelling and
rescheduling every notification each launch (needless churn; the cooldown-stagger
protection would be re-triggered). Low risk today.

**Fix:** Either drop the title comparison (the engine never sets it) or compare
against a locally-defined desired title constant so both sides are engine-owned.

### IN-02: `handledSet` grows unbounded for the process lifetime

**File:** `src/services/notifications/notification-actions.ts:63,160,166`

**Issue:** The in-process idempotency set is never pruned; every distinct
mark/snooze tap adds a key that lives until the process dies. Over a long-lived
foreground session this is a slow, unbounded growth. It is bounded in practice by
the number of taps per session and by process death, and the durable
`UNIQUE(uid)` backstop means correctness does not depend on it — so this is a note,
not a leak that risks behavior. (Performance is out of v1 review scope; flagged
only because it is a mutable module-global on the hot path.)

**Fix:** If ever needed, cap it (e.g. an LRU or a periodic clear on background),
but no action is required for correctness.

---

_Reviewed: 2026-08-16T22:50:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
