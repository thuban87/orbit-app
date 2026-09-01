# Local Notification Integration Pipeline

## Overview

Use this process to add a local notification kind to Orbit's on-device reminder system. It keeps the OS request derived from SQLite state, puts privacy and channel identity under source control, and routes actions through existing DAO boundaries rather than a direct contact update.

## Architecture (Phase 11)

The notification engine reconciles a desired request set during launch and foreground. `notification-ids.ts` is the single source of request identifiers, channel/action IDs, frozen copy, payload shape, and action idempotency; the scheduler creates requests only after the application initializes immutable channels and categories.

### Notification identifiers

**File:** `src/services/notifications/notification-ids.ts`

Identifiers are stable so a replacement request does not stack in the OS shade. Channel IDs are versioned because Android does not mutate importance or lock-screen visibility for an existing channel.

```typescript
export const EXAMPLE_CHANNEL = "example-v1";

export function exampleIdentifier(contactId: number): string {
  return `example:${contactId}`;
}
```

### Reconcile flow

1. **SQLite candidates** — a pure read module returns deterministic candidates and every value influencing eligibility.
2. **Desired request** — `notification-schedule.ts` calculates local fire time, body, payload, channel, and stable identifier.
3. **Full-request diff** — the scheduler compares the existing OS request's fire hour, channel, category, body, title, and payload; a mismatch cancels and replaces it.
4. **OS cleanup** — master/type gates cancel owned identifiers, and a purge extension cancels the deleted contact's identifiers post-commit.

## File Locations

### Code

| File | Purpose |
|---|---|
| `src/services/notifications/notification-ids.ts` | Stable IDs, versioned channel IDs, generic copy, payload types, and action UID. |
| `src/services/notifications/channels.ts` | Create-only Android channel registration. |
| `src/services/notifications/notification-schedule.ts` | Bounded desired-set reconciliation and OS request diff. |
| `src/db/notification-read.ts` | Pure SQLite candidate reads. |
| `src/services/notifications/notification-actions.ts` | Shared foreground/headless action writer. |
| `src/navigation/notification-gate.tsx` | Warm and cold body/action response integration. |
| `src/services/notifications/purge-notification-cleanup.ts` | Post-commit OS request cancellation. |

## How to Add a Local Notification Kind

1. **Declare stable IDs and generic copy** in `src/services/notifications/notification-ids.ts`. Use a unique namespace and only include content safe to freeze into the OS request. Never copy ranked fuel, notes, or other live contact detail into a scheduled body.

2. **Create a versioned channel** in `src/services/notifications/channels.ts` before a scheduler can mint requests:

   ```typescript
   await setNotificationChannelAsync(EXAMPLE_CHANNEL, {
     name: "Example reminders",
     importance: AndroidImportance.LOW,
     lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
   });
   ```

   If channel importance or visibility changes later, create `example-v2`; do not attempt to update `example-v1`.

3. **Add a pure candidate read** in `src/db/notification-read.ts`. Reuse existing status or date helpers instead of restating their SQL or calendar rules. Return values in a deterministic order and keep all runtime SQL inputs `?`-bound.

4. **Build and reconcile the request** in `src/services/notifications/notification-schedule.ts`. Add the identifier to the engine's ownership check, preserve the full-request diff, and keep the work inside `reconcileSchedule()` so DEFER-ONE coordination prevents stale overlapping runs.

5. **Add an action only through a DAO.** Register its category in `notification-actions.ts`, use `actionUid()` as the durable idempotency key, and route the write through the owning DAO. Do not add a raw `UPDATE contacts` path.

6. **Route body taps deliberately.** Extend the pure resolver in `src/services/notifications/notification-nav.ts`, then let `NotificationResponseGate` apply the serializable intent once navigation is ready. A new navigation destination must specify its Back behavior.

7. **Cancel on lifecycle destruction.** Extend `buildNotificationPurgeCleanup()` with the new identifier if it belongs to a contact. The cancel is post-commit, idempotent, and best effort.

8. **Add unit coverage and run the notification suite**:

   ```bash
   npx vitest run src/services/notifications src/db/notification-read.test.ts src/db/snooze-dao.test.ts src/db/app-settings-dao.test.ts
   npx tsc --noEmit
   npm run check:colors
   ```

### What You Don't Need to Change

- Do not add a backend, remote scheduler, FCM configuration, or exact-alarm permission for a normal decay-style reminder.
- Do not run reconciliation at module import or from a killed-app action path.
- Do not create an AsyncStorage mirror for notification policy; `app_settings` is the durable source of truth.
- Do not modify a published Android channel's properties under the same ID.

## Pitfalls

1. **Frozen content becomes stale.** The OS retains a scheduled request verbatim, so generic copy and launch/foreground reconciliation are required.

2. **A direct action write can duplicate or corrupt history.** Foreground and headless delivery can replay; use the shared handler plus deterministic UID and existing unique constraints.

3. **A date-specific alert can roll to tomorrow.** If quiet-window or past-slot calculation leaves the intended date, skip that occurrence rather than sending incorrect “today” copy later.

4. **Concurrent reconciles can re-arm a muted contact.** Keep all callers behind the scheduler's DEFER-ONE coordinator so its trailing pass re-reads committed SQLite state.

## Smoke Test

```bash
npx vitest run src/services/notifications/notification-schedule.test.ts src/services/notifications/notification-actions.test.ts src/services/notifications/notification-nav.test.ts
```

Expected: scheduler diff, exact-once actions, and body-tap routing pass.

```bash
npx tsc --noEmit && npm run check:colors
```

Expected: the notification integration type-checks and uses theme tokens only.
