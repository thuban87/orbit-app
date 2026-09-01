# Notifications

**Last updated:** 2026-08-27
**Updated by phase:** 18.2-bound-unbound-lifecycle
**Owners:** `src/db/notification-read.ts`, `src/db/snooze-dao.ts`, `src/services/notifications/`, `src/navigation/notification-gate.tsx`

## Purpose

The notifications system pre-schedules calm, local reminders for a contact's decay and birthday. It keeps scheduling, action writes, and settings on-device: the Dashboard remains the source of truth, while the OS shade offers a minimal route back into Orbit.

## Architecture

### Data Model

The system owns no remote state and no backend. SQLite supplies live candidate data and durable policy; Android receives only frozen, generic notification requests that the app reconciles on launch and foreground.

**Tables:**
- `app_settings` — one seeded row for notification master/type toggles, lock-screen choice, and delivery/quiet hours.
  - `notifications_enabled`, `decay_enabled`, `birthday_enabled`, `digest_enabled`, `birthday_unbound_enabled` (`INTEGER`) — `0`/`1` scheduling gates.
  - `lockscreen_public` (`INTEGER`) — chooses the public decay channel only when explicitly enabled.
  - `delivery_hour`, `quiet_start_hour`, `quiet_end_hour` (`INTEGER`) — validated local-hour scheduling inputs.
- `contacts` — supplies cadence, `last_contact`, `snooze_until`, `reminders_off`, lifecycle, and birthday values.
- `events` — records immutable `snooze` and `unsnooze` facts; `interactions` receives notification-sourced mark-contacted touchpoints.

**Types** (`src/services/notifications/notification-ids.ts`):
- `NotificationData` — the scheduled `{ kind, contactId, occurrenceKey }` payload used for routing and idempotency.
- `AppSettings` (`src/db/app-settings-dao.ts`) — typed SQLite notification-policy read.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Settings DAO | `src/db/app-settings-dao.ts` | Reads the singleton policy row and validates partial writes before a transaction. |
| Candidate read | `src/db/notification-read.ts` | Returns deterministic decay and birthday candidates without writing. |
| Snooze DAO | `src/db/snooze-dao.ts` | Is the sole writer of `snooze_until` and composes immutable snooze events. |
| Scheduler | `src/services/notifications/notification-schedule.ts` | Reconciles the desired bounded OS request set. |
| Digest scheduler | `src/services/notifications/digest-schedule.ts` | Reconciles the separate singleton Sunday digest request. |
| Scheduling math | `src/services/notifications/fire-instant.ts` | Computes local delivery, quiet-window rolls, stagger, and weekly cadence. |
| OS adapter | `src/services/notifications/channels.ts` | Creates the immutable versioned Android channels. |
| Action handler | `src/services/notifications/notification-actions.ts` | Routes both action-delivery paths through exactly-once DAO writes. |
| Response gate | `src/navigation/notification-gate.tsx` | Applies warm and cold notification responses once navigation is ready. |

### Key Files

| File | Role |
|---|---|
| `src/services/notifications/notification-ids.ts` | Single source for identifiers, channels, action IDs, generic copy, payloads, and deterministic action UIDs. |
| `src/services/notifications/notification-schedule.ts` | Desired-request builder, full-request diff, bounded selection, and DEFER-ONE reconciliation coordinator. |
| `src/services/notifications/digest-schedule.ts` | Independent idempotent reconciliation for the singleton `digest:weekly` request. |
| `src/services/notifications/decay-suppression.ts` | Reuses the status engine's progress and rogue constants for the decay predicate. |
| `src/db/notification-read.ts` | Reads all schedulable contacts and non-archived birthday candidates. |
| `src/services/notifications/fire-instant.ts` | Local wall-clock fire calculations and stateless weekly re-nag date. |
| `src/services/notifications/notification-actions.ts` | Registers mark/snooze buttons and performs idempotent action writes. |
| `src/services/notifications/headless-task.ts` | Registers the killed-app TaskManager action path. |
| `src/services/notifications/channels.ts` | Creates low-importance private/public decay and private birthday channels. |
| `src/services/notifications/purge-notification-cleanup.ts` | Cancels a purged contact's decay and birthday identifiers after commit. |
| `src/navigation/notification-gate.tsx` | Receives warm and cold body/action responses and queues body navigation until ready. |

## How It Works

### Reconciling reminders

1. After migration and channel/category initialization, `App.tsx` registers the scheduler as a launch-sweep hook.
2. `reconcileSchedule()` reads `app_settings`, Bound decay-eligible contacts, birthday candidates, and the current OS request set. The persisted birthday-Unbound setting controls only birthday eligibility.
3. It derives a local due date, applies a future snooze as the minimum base, then calculates a quiet-windowed, staggered fire instant. A birthday stays on its birthday date or is skipped.
4. The scheduler keeps requests inside a 35-day, 48-request bound, reserves within-horizon birthdays first, and uses a full-request diff to cancel or replace stale `decay:<id>` and `birthday:<id>` requests.
5. Concurrent callers coalesce through a DEFER-ONE coordinator; the final pass re-reads state so a committed mute or snooze cannot be undone by an older snapshot.

### Reconciling the weekly digest

1. `App.tsx` also registers the digest scheduler as a launch-sweep hook after migration and channel initialization.
2. `reconcileDigestSchedule()` reads the master setting, `digest_enabled`, delivery hour, and pending OS requests.
3. It keeps one `digest:weekly` Sunday request when enabled, cancels it when the master or digest toggle is off, and replaces it only when weekday or hour drift.
4. The request uses a dedicated `digest-v1` low-importance private channel and frozen generic copy; it does not enter the decay/birthday scheduler’s ownership set.

### Acting from the shade

1. A decay request exposes Mark contacted and Snooze 1 week; both may arrive through the foreground listener or the module-scope headless task.
2. `handleNotificationAction()` derives an occurrence-scoped deterministic UID, resolves the device region, opens and migrates SQLite before access, and suppresses warm or durable replay duplicates. This headless path can be the first opener of a v8 database.
3. Mark contacted calls the recency DAO with the canonical notification one-tap values. Snooze calls `snoozeContact()` and records a matching immutable event in the same transaction.
4. Both actions cancel the active decay request. The headless snooze re-arms during the next foreground reconcile rather than trying to initialize channel state from a killed process.
5. A successful notification-originated Mark additionally publishes a best-effort Widget refresh; Snooze does not because it does not alter the widget projection.

### Opening a notification

1. A decay body tap checks current lifecycle before routing. A now-Unbound contact opens Profile instead of Compose; a live Bound contact retains the Dashboard-rooted Compose route.
2. A birthday body tap navigates to that contact's Profile.
3. A digest body tap resets the stack to Dashboard then Digest, guaranteeing Back returns to Dashboard on warm and cold starts.
4. The response gate reads a cold-start response once, clears it after handling, and waits for navigation readiness before applying a queued body-tap intent.

### Cleaning up a purge

1. `purgeContact()` commits its database fan-out before calling its extension hook.
2. The notification cleanup reconstructs `decay:<id>` and `birthday:<id>` from the deleted contact ID and best-effort cancels both OS requests.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `RE_NAG_DAYS` | `7` | `src/services/notifications/notification-schedule.ts` | Flat weekly cadence for an unacted decay reminder. |
| `STAGGER_MINUTES` / `STAGGER_SLOTS` | `5` / `12` | `src/services/notifications/notification-schedule.ts` | Spreads a burst across 0–55 minutes. |
| `HORIZON_DAYS` | `35` | `src/services/notifications/notification-schedule.ts` | Future pre-scheduling window. |
| `MAX_SCHEDULED_NOTIFICATIONS` | `48` | `src/services/notifications/notification-schedule.ts` | Ceiling kept below Android's pending-notification limit. |
| Default hours | `9`, `21`, `8` | `src/db/migrations/002-app-settings.ts` | Delivery hour, quiet-window start, and quiet-window end. |
| `DIGEST_WEEKDAY` | `1` | `src/services/notifications/digest-schedule.ts` | Sunday weekly digest delivery. |

## Decisions

- **ADR-039:** Pre-Scheduled Inexact Decay Reminders — reconciles generic, per-contact reminders without exact alarms or frozen fuel.
- **ADR-040:** Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing — keeps action writes DAO-owned and makes navigation deterministic.
- **ADR-041:** Notification Settings, Privacy Channels, and Birthday Alerts — persists policy in SQLite and uses versioned privacy channels.
- **ADR-045:** Event-Driven Widget Refresh and Boot Recovery — keeps the widget current after a notification mark commits.
- **ADR-055:** Dedicated Weekly Digest Scheduling and Persisted Notification Policy — adds the independent Sunday digest request, private channel, durable toggle, and dashboard-rooted tap reset.
- **ADR-059:** Normalized Contact Methods, Canonical Actionability, and Local Provenance — requires headless first-open migration to supply a device region without making endpoint data part of notifications.
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — gates decay and stale active actions while retaining factual birthdays and touchpoint history.

## Gotchas

1. **Never put ranked fuel into a scheduled body.** Android freezes request content; name-only generic copy avoids stale fuel and lock-screen disclosure.
2. **Do not re-derive the rogue cutoff or birthday parser.** The decay predicate imports status constants and birthday scheduling reuses `daysUntilBirthday()`.
3. **Use local wall-clock dates.** Stored snooze values are bare local dates; UTC conversion or `toISOString()` produces near-midnight errors.
4. **Do not bypass the action handler.** Raw writes break the recency single-writer and exactly-once guarantees.
5. **Android channels are immutable.** A changed importance or visibility policy needs a new versioned channel ID, not a repeated update call.
6. **Device follow-up remains important.** Killed-app actions and decay-body navigation need a naturally delivered decay reminder for final physical-device exercise.
7. **Only Mark publishes widget freshness.** Snooze changes scheduling state, not the favourites projection, so it must not trigger unnecessary widget work.
8. **Keep digest reconciliation separate.** The decay/birthday ownership check must not cancel `digest:weekly`; its own DEFER-ONE coordinator re-reads settings on a trailing pass.
9. **Do not put digest counts in the notification body.** Scheduled content is frozen; the live Digest screen is the payload.
10. **Do not migrate national endpoints with a guessed headless region.** The action path uses the shared platform region provider; an unavailable region leaves a national method non-actionable rather than inventing canonical identity.
11. **Recheck lifecycle at delivered ingress.** A notification can outlive an Unbind; Mark may record real history, but stale decay Compose and Snooze actions must not revive cadence work.

## Related Systems

- **Persistence core** — provides migration 002, the shared SQLite bootstrap, and the launch-sweep registry.
- **Contacts** — owns contact cadence, suppression fields, and profile snooze controls.
- **Interaction log** — records notification-sourced touchpoints and snooze lifecycle events.
- **Contact methods** — provides the Compose destination for a decay body tap.
- **Dashboard** — remains the in-app source of truth and shares birthday semantics.
- **Widget** — refreshes after a notification-sourced mark advances contact recency.
- **Digest** — owns the live retrospective surface that the weekly generic prompt opens.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-16 | 11 | Created local decay and birthday scheduling, action handling, privacy channels, and response routing. |
| 2026-08-16 | 12 | Published widget freshness after notification-originated marks. |
| 2026-08-23 | 15 | Added an independently reconciled weekly digest trigger, versioned private channel, policy toggle, and Digest reset route. |
| 2026-08-27 | 18.1 | Supplied device region to the notification headless first-open migration path. |
| 2026-08-27 | 18.2 | Made decay Bound-only, added Unbound birthday policy, and guarded stale notification actions and body taps. |
