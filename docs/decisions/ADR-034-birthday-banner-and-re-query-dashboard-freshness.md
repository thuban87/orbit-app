# ADR-034: Birthday Banner and Re-query Dashboard Freshness

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 08-dashboard-never-contacted-screen
**Source decisions:** dossier `08-dashboard` Clusters E–F; 08-CONTEXT specifics
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-076 (partial — banner)

## Context

The dashboard needs to surface upcoming birthdays without inheriting the plugin's all-contact predicate or its date-parser defects. It also must refresh after foreground and headless-context writes, which a connection-scoped SQLite change listener cannot reliably observe.

## Decision

The dashboard displays a seven-day, soonest-first birthday banner for every non-archived contact, deliberately overriding list suppression for snoozed and never-contacted people. It uses one strict local-date parser and refreshes local reads on screen focus, app foreground, and pull-to-refresh instead of relying on database change listeners.

## Alternatives Considered

- **No banner or reserve space for a digest** — rejected because the dashboard banner is useful now while digest remains a later-domain decision.
- **Respect all dashboard-list exclusions** — rejected because birthdays should surface a reason to reconnect.
- **A ported explicit refresh button or change-listener-only freshness** — rejected because the listener cannot observe separate-context writes.

## Consequences

### Positive

- Birthday candidates preserve their deliberate archive-only exclusion and show correctly on the day itself.
- Local dashboard data converges when users return from another application context.

### Negative

- Refresh remains query-based rather than incrementally subscribed.

### Risks

- Date handling must compare local midnights and explicitly handle February 29 in non-leap years.

## Implementation

**Key files:**
- `src/logic/birthday-logic.ts` — validates stored birthday forms and computes local-calendar days until the next birthday.
- `src/components/BirthdayBanner.tsx` — loads and presents non-archived seven-day candidates.
- `src/db/dashboard-read.ts` — supplies archive-filtered birthday candidates and dashboard counts.
- `src/logic/dashboard-empty-logic.ts` — selects cause-aware empty-state precedence.
- `src/screens/HomeScreen.tsx` — mounts the banner and performs focus, foreground, and pull refreshes.

**Depends on:** ADR-008 (Initial Contact Schema as a Cross-Phase Data Contract); ADR-011 (Query-Time Status and Never-Contacted Segregation)
**Required by:** ADR-039 (Pre-Scheduled Inexact Decay Reminders)
