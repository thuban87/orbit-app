# ADR-024: Editable Touchpoint History and Recomputed Recency

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 06-interaction-log-status-impact
**Source decisions:** dossier `04-log` Clusters B, C, and D
**Reversibility:** one-way
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Logging a touchpoint is Orbit's most frequent action, but detail is often known only later. The application must preserve every real same-day touchpoint, let users correct or remove a mistaken row, and maintain truthful recency without a timed undo that cannot survive Android process suspension.

## Decision

The system logs immediately and refines from a full, editable, newest-first profile timeline. Touchpoint edits and deletes recompute `last_contact` through the existing single writer; same-day repeats remain separate rows, past dates are allowed, future dates are rejected, and deletion is permanent after confirmation.

## Alternatives Considered

- **A form before every log** — rejected because it burdens the app's most-fired action.
- **Same-day no-ops or timestamp replacement** — rejected because both hide genuine repeated contact or destroy history.
- **Timed or persisted undo** — rejected because cached Android processes suspend timers and a durable undo strip adds unnecessary machinery.
- **Future touchpoints as planned contact** — rejected because planning is distinct from a factual interaction and conflicts with snooze.

## Consequences

### Positive

- A one-tap log is cheap while all optional detail remains correctable in one place.
- Recency always follows the retained qualifying history rather than a stale summary.

### Negative

- Removing a row is irrecoverable; the confirmation must state that there is no undo or backup.
- Local wall-clock ordering accepts rare cross-timezone ordering anomalies in favor of faithful user-entered times.

### Risks

- The date and time refinement UI requires two Android dialogs and must preserve their combined local wall-clock value.

## Implementation

**Key files:**
- `src/db/recency-dao.ts` — provides the sole `last_contact` recomputation plus full edit and delete paths.
- `src/db/timeline-read.ts` — reads the newest-first timeline with deterministic ordering.
- `src/components/TouchpointRefineForm.tsx` — composes the two-dialog date/time correction flow.
- `src/components/TimelineRow.tsx` — presents editable touchpoints separately from read-only events.
- `src/screens/ContactProfileScreen.tsx` — wires refinement, confirmed deletion, and in-place refresh.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine)
**Required by:** ADR-054 (Live Weekly Digest Retrospective and Overlooked Relationship Read); ADR-071 (User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer)
