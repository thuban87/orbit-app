# ADR-040: Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 11-actionable-notifications
**Source decisions:** dossier `11-notify` Cluster C; 11-CONTEXT action-routing decisions
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Android can deliver notification actions from a killed app and may replay a response across warm and cold starts. The action path must preserve the contact-log single-writer invariant, while a body tap under `singleTask` needs a predictable in-app back stack.

## Decision

The system offers two headless-capable action buttons: mark contacted and fixed one-week snooze. Both foreground and headless delivery paths funnel through one exactly-once handler that boots the database before use, derives a deterministic action UID, writes through the established recency or snooze DAO, and cancels the active decay request. A body tap resets navigation to Dashboard then Compose, while birthday taps navigate to the contact profile; no separate open action is used.

## Alternatives Considered

- **Raw contact updates from notification handlers** — Rejected because they bypass structured history and the sole recency writer.
- **Snooze that opens a duration picker** — Rejected because it loses the genuine one-tap headless action.
- **A dedicated open button or inline fuel capture** — Rejected because the body already opens Compose and the remaining action budget is not spent on reminder-time typing.
- **Navigate onto the existing stack or return to the source app** — Rejected because neither guarantees Back reaches Orbit's Dashboard.

## Consequences

### Positive

- Killed-app, foreground, and replayed action delivery converge on one durable write path.
- The notification tap has a stable route and preserves Compose's existing phone-less fallback.

### Negative

- Headless snooze cancels the immediate reminder but leaves its re-arm to the next foreground reconciliation.
- Action payloads and UID derivation are a long-lived compatibility contract.

### Risks

- The FCM-less killed-app task and Android `singleTask` tap behavior require physical-device verification.
- Purged contacts can leave OS requests behind unless post-commit cleanup cancels both identifiers.

## Implementation

**Key files:**
- `src/services/notifications/notification-actions.ts` — defines the shared exactly-once mark and snooze handler.
- `src/services/notifications/headless-task.ts` — registers the module-scope TaskManager action funnel.
- `src/services/notifications/notification-nav.ts` — resolves safe body-tap navigation intents.
- `src/navigation/notification-gate.tsx` — wires warm and cold notification responses to actions or navigation.
- `src/db/snooze-dao.ts` — writes local snooze dates and immutable snooze events in one transaction.
- `src/services/notifications/purge-notification-cleanup.ts` — cancels a purged contact's pending decay and birthday requests after commit.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine); ADR-023 (Structured Touchpoints and One-Tap Defaults); ADR-036 (Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails)
**Required by:** ADR-045 (Event-Driven Widget Refresh and Boot Recovery); ADR-055 (Dedicated Weekly Digest Scheduling and Persisted Notification Policy)
