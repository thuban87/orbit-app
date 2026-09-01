# ADR-045: Event-Driven Widget Refresh and Boot Recovery

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 12-home-screen-widget
**Source decisions:** dossier `12-widget.md` Cluster E; 12-CONTEXT freshness wiring
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Widget status is rendered from local data but cannot run reliable timers. Android periodic updates are Doze-throttled, and Android 15 force-stop can grey widgets until an application launch or boot recovery repushes them.

## Decision

The system uses event-driven widget updates after every successful widget-visible mutation, a foreground launch-sweep refresh, and a dedicated non-exported `BOOT_COMPLETED` receiver. Widget configuration sets `updatePeriodMillis` to zero; a delayed status between app launches is accepted as a day-granular glance aid cost.

## Alternatives Considered

- **Periodic 30-minute polling** — rejected because it costs battery, is Doze-throttled, and adds little value for day-granular decay.
- **Event push plus a daily rollover task** — rejected because offline background wake is unreliable.
- **No recovery path after force-stop** — rejected because a greyed widget cannot be the only route into logging.

## Consequences

### Positive

- Widget content follows committed local changes without a network read path or polling schedule.

### Negative

- Status can be stale between foreground launches, and mutation sites must explicitly publish refreshes.

### Risks

- Rendering and thumbnail encoding consume part of the headless click budget; refresh failure remains non-fatal after the interaction write commits.

## Implementation

**Key files:**
- `src/services/widget/widget-refresh.ts` — provides coalesced event-push and foreground-sweep update entry points.
- `src/services/widget/widget-task-handler.tsx` — rerenders after a committed headless mark and handles widget update events.
- `App.tsx` — registers the widget foreground sweep only in the real application lifecycle.
- `plugins/withWidgetBootReceiver.js` — generates and registers the guarded non-exported boot receiver.
- `src/services/notifications/notification-actions.ts` — publishes a widget refresh after a notification-originated mark.

**Depends on:** ADR-011 (Query-Time Status and Never-Contacted Segregation); ADR-040 (Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing)
**Required by:** None
