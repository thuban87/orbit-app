# ADR-041: Notification Settings, Privacy Channels, and Birthday Alerts

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 11-actionable-notifications
**Source decisions:** dossier `11-notify` Cluster D; 11-CONTEXT owner timing reversal and OQ-1/OQ-2
**Reversibility:** one-way
**Migration:** 002
**Supersedes:** None
**Superseded by:** None

## Context

Notification controls must survive backup and feed the scheduler without relying on device-local preference storage. Android notification channels have immutable importance and lock-screen visibility, while birthday reminders have different suppression semantics from decay reminders.

## Decision

The system stores notification policy in the additive SQLite `app_settings` singleton: master and per-type toggles, user-tunable delivery and quiet-window hours, and decay lock-screen visibility. It creates versioned, silent Android channels instead of mutating existing ones: decay defaults to a private channel with an explicit public opt-in, and birthdays use their own private channel. Birthday alerts fire day-of for every non-archived contact, ignore decay suppressors, and open that contact's profile; permission is requested only when the user enables reminders.

## Alternatives Considered

- **AsyncStorage or Zustand as the source of truth** — Rejected because backup must include notification policy and the scheduler needs durable local reads.
- **A single public decay channel** — Rejected because even a contact name can be sensitive on the lock screen.
- **Prompt for permission on first launch** — Rejected because it asks before demonstrated value.
- **Defer birthdays or suppress them like decay** — Rejected because they share the engine but remain date-specific, non-decay reminders.

## Consequences

### Positive

- Settings are exportable with the on-device database and validated before reaching scheduling math.
- Channel selection makes private-by-default behavior explicit without mutating immutable channel properties.

### Negative

- Future channel-policy changes require a new versioned channel identifier.
- The user now has timing controls that must trigger a full scheduling reconciliation.

### Risks

- A date-specific birthday must never roll into the following day with "today" copy.
- OS permission and lock-screen rendering are platform behavior that requires device UAT.

## Implementation

**Key files:**
- `src/db/migrations/002-app-settings.ts` — creates and seeds the additive singleton settings table.
- `src/db/app-settings-dao.ts` — validates and persists notification policy inputs.
- `src/services/notifications/channels.ts` — creates versioned low-importance decay and birthday channels.
- `src/services/notifications/permission.ts` — provides graceful permission reads and value-moment requests.
- `src/screens/SettingsScreen.tsx` — renders policy controls and requests permission when the master setting turns on.
- `src/services/notifications/notification-schedule.ts` — maps the stored policy to channel choice and scheduled requests.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations)
**Required by:** ADR-055 (Dedicated Weekly Digest Scheduling and Persisted Notification Policy)
