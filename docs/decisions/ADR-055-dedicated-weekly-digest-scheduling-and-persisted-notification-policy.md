# ADR-055: Dedicated Weekly Digest Scheduling and Persisted Notification Policy

**Status:** Accepted
**Date:** 2026-08-23
**Phase:** 15-weekly-digest
**Source decisions:** dossier `14-digest.md` Cluster D; 15-CONTEXT Delivery, Copy & Entry Point and Persistence & Schema owner ruling
**Reversibility:** one-way
**Migration:** 005
**Supersedes:** None
**Superseded by:** None

## Context

The digest must arrive as a reliable Sunday-morning ritual even when the app is not opened, but Android freezes scheduled content and channels cannot change their privacy properties after creation. A user also needs a durable, backup-exportable way to turn the digest off; trigger presence cannot preserve that intent across launch reconciliation.

## Decision

The system schedules one unconditional `digest:weekly` native trigger on Sunday morning, with static generic copy, a dedicated private low-importance `digest-v1` channel, and an independent idempotent reconcile plus launch-sweep hook. Migration 005 adds `app_settings.digest_enabled INTEGER NOT NULL DEFAULT 1`; this third notification-type toggle is master-gated, defaults on, and drives immediate scheduling reconciliation. Digest body taps reset the stack to Home then Digest so Back always returns to the dashboard.

## Alternatives Considered

- **Suppress empty weeks** — Rejected because frozen content and app-closed operation would require unreliable open-only cancellation and rescheduling.
- **Monday delivery or a user-selected day/time in v1** — Rejected because the retrospective is a Sunday close and a new scheduling surface is out of scope.
- **An existing channel or a mutable channel policy** — Rejected because independent OS control and immutable Android channel properties require a versioned digest channel.
- **Deriving enabled state from scheduled-trigger presence** — Rejected because launch reconciliation would re-arm a user's durable OFF choice.
- **AsyncStorage or another device-local preference store** — Rejected because notification policy must persist with SQLite and be portable through backup.
- **Fold the digest into decay/birthday reconciliation or navigate onto the warm stack** — Rejected because separate ownership prevents request clobbering and a dashboard-rooted reset preserves Back behavior.

## Consequences

### Positive

- A device has one privacy-safe, independently controllable weekly prompt that survives ordinary app inactivity.
- Scheduling state converges after toggle, master-setting, delivery-hour, and launch events without duplicating requests.

### Negative

- Migration 005 is forward-only, and later channel-policy changes require a new channel ID.
- The scheduler must preserve a separate reconcile coordinator and physical-device coverage.

### Risks

- WEEKLY platform delivery and post-fire re-arming must be verified on a physical device.
- Incorrect weekday/hour read-back or overlapping reconciliations can leave a stale or duplicate OS request.

## Implementation

**Key files:**
- `src/db/migrations/005-digest-settings.ts` — adds the default-on durable digest policy column.
- `src/db/app-settings-dao.ts` — validates and reads/writes the typed digest toggle.
- `src/services/notifications/digest-schedule.ts` — reconciles the singleton weekly request and registers its launch-sweep hook.
- `src/services/notifications/notification-ids.ts` — defines the digest identifier, private channel ID, frozen copy, and payload kind.
- `src/services/notifications/channels.ts` — creates the versioned private digest channel.
- `src/services/notifications/notification-nav.ts` — resolves a digest body tap to the Home/Digest reset.
- `src/screens/SettingsScreen.tsx` — exposes the master-gated Weekly digest control through the shared persistence path.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-040 (Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing); ADR-041 (Notification Settings, Privacy Channels, and Birthday Alerts)
**Required by:** None.
