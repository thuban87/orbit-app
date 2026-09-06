# ADR-025: Immutable Lifecycle Events in a Unified Timeline

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 06-interaction-log-status-impact
**Source decisions:** dossier `04-log` Cluster F
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Archive and restore transitions explain a contact's history but are not touchpoints and must never affect recency. Combining them with interactions would require every recency query to remember a type filter, while retaining events without a reader would repeat the plugin's unread-log failure.

## Decision

The system stores lifecycle events in a separate, immutable table and renders them read-only alongside touchpoints in one profile timeline. Archive and restore record their events within the existing transaction, and purge explicitly deletes the events with the rest of the contact's fan-out.

## Alternatives Considered

- **One table with an event-type column** — rejected because a missed predicate could corrupt the touchpoint and recency paths.
- **Recording no lifecycle history** — rejected because repeated snoozes and lifecycle changes are useful context.
- **Events with no v1 reader** — rejected because an unread log is not a useful correction or explanation surface.

## Consequences

### Positive

- Touchpoint queries remain semantically narrow and the profile gives users one coherent history.
- Immutable events cannot be retroactively altered into false lifecycle transitions.

### Negative

- Lifecycle transitions must compose an insert-only event writer inside their existing transaction.
- Purge has an additional explicit child table to count and delete.

### Risks

- A redundant archive or restore must fail before recording an event, otherwise history would claim a transition that did not occur.

## Implementation

**Key files:**
- `src/db/events-dao.ts` — defines the insert-only lifecycle event writer and transaction composition core.
- `src/db/contacts-dao.ts` — records archive and restore events after state-guarded transitions.
- `src/db/timeline-read.ts` — interleaves event and touchpoint reads with deterministic ordering.
- `src/db/purge-dao.ts` — counts and explicitly deletes lifecycle events during purge.
- `src/components/TimelineRow.tsx` — renders events read-only and visually distinct from touchpoints.

**Depends on:** ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out)
**Required by:** ADR-103 (Atomic Composed Dashboard Bulk Mutations)
