# ADR-039: Pre-Scheduled Inexact Decay Reminders

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 11-actionable-notifications
**Source decisions:** dossier `11-notify` Clusters A–B; 11-CONTEXT timing and cadence decisions
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-029 (partial)
**Superseded by:** None

## Context

Orbit must nudge overdue relationships while closed without taking exact-alarm permission or freezing sensitive, stale fuel into an Android notification. A simple overdue-only launch check would miss future decay, and a burst of per-contact notices can be muted by Android's notification cooldown.

## Decision

The system pre-schedules bounded, inexact local decay reminders and reconciles their desired set on launch and foreground. Each eligible contact receives a stable `decay:<contactId>` request with a generic name-only body, a quiet-window-respecting local fire instant, deterministic stagger, and a stateless weekly re-nag; never-contacted, snoozed-at-fire-time, muted, rarely-responds, archived, unbound, and rogue contacts are suppressed. Notification bodies do not display ranked fuel, partially superseding ADR-029; fuel remains on the Compose screen opened by the notification.

## Alternatives Considered

- **Exact-alarm delivery** — Rejected because minute precision has no user value and would require a revocable, policy-sensitive permission.
- **Frozen or continuously rescheduled fuel in the body** — Rejected because scheduled content goes stale, can fire after contact, and exposes private material.
- **Summary or simultaneous per-contact alerts** — Rejected because it loses contact-specific actions or triggers Android cooldown suppression.
- **One-time or daily re-nags** — Rejected because one missed alert is too quiet and daily reminders recreate nagging.

## Consequences

### Positive

- Reminders can fire while Orbit is closed without an exact-alarm or network dependency.
- Generic content and query-time suppression keep the OS shade aligned with current contact state.

### Negative

- The bounded scheduling horizon and cap rely on a later foreground reconcile for farther-out candidates.
- Local date and quiet-window arithmetic must remain DST-safe and must not use UTC strings.

### Risks

- A stale or concurrent reconcile could re-arm a suppressed notification; the scheduler coalesces overlapping requests into a final fresh pass.
- Android delivery remains inexact and can be deferred by Doze.

## Implementation

**Key files:**
- `src/services/notifications/notification-schedule.ts` — reconciles the bounded desired set against OS schedules.
- `src/db/notification-read.ts` — reads decay and birthday scheduling candidates.
- `src/services/notifications/decay-suppression.ts` — exports the shared in-query decay eligibility predicate.
- `src/services/notifications/fire-instant.ts` — calculates local quiet-windowed, staggered fire instants and weekly re-nag dates.
- `src/services/notifications/notification-ids.ts` — owns stable identifiers and generic notification copy.

**Depends on:** ADR-011 (Query-Time Status and Never-Contacted Segregation); ADR-034 (Birthday Banner and Re-query Dashboard Freshness)
**Required by:** None.
