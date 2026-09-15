# ADR-118: Bind/Unbind Immutable Lifecycle Events Without a Migration

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 32-interaction-history-insights
**Source decisions:** D-08 (32-CONTEXT.md) from dossier §U, §R
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The unified timeline records lifecycle events (`archive|restore|snooze|unsnooze`) as immutable rows (ADR-025), but the Bind/Unbind cadence transitions left no history — `EventType` did not include them and `contact-lifecycle-dao` wrote no event. History & Insights surfaces lifecycle events in the shared Detail Sheet and Rolodex markers, so Bind and Unbind need to appear there as read-only history.

## Decision

We extend `EventType` to `archive|restore|snooze|unsnooze|bind|unbind` as a TypeScript-only change — no migration, because `events.type` is plain `TEXT` with no `CHECK`. `bindContact`/`unbindContact` each compose exactly one insert-only `recordEventCore` **inside their already-open write transaction** (never a nested transaction — the write mutex is non-reentrant), before `bumpDataRevisionCore`, with `occurredAt` = the bind/unbind moment. The events are immutable (ADR-025): a later unbind never mutates the earlier bind row. Backup validates only `contactUid` on events, so the new type strings round-trip through restore verbatim.

## Alternatives Considered

- **Add a `CHECK` (or migration) constraining `events.type`** — Rejected; the column is CHECK-less by design, so a TS union plus producers is sufficient and forward-compatible.
- **Write the event after the transaction commits** — Rejected; a failure between the state change and the event write would leave history claiming or omitting a transition; the write must be in-transaction.
- **Mutate a single lifecycle row to reflect the current bound state** — Rejected; lifecycle events are immutable and insert-only (ADR-025).

## Consequences

### Positive

- Bind and Unbind now appear as read-only history in the Detail Sheet and as Rolodex markers, with no schema change and no backup-format impact.

### Negative

- The producers must be composed inside the existing bind/unbind transactions, coupling the event write to the state-change path.

### Risks

- A new exhaustive `switch` on `EventType` elsewhere would need the two new arms; none exists today (grep-verified), and restore does not switch on `type`.

## Implementation

**Key files:**
- `src/db/events-dao.ts` — extends the `EventType` union with `bind`/`unbind`.
- `src/db/contact-lifecycle-dao.ts` — `bindContact`/`unbindContact` emit one immutable event inside their existing transaction.
- `src/backup/restore-apply.ts` — inserts the event `type` verbatim; the new strings pass restore validation.

**Depends on:** ADR-025 (Immutable Lifecycle Events in a Unified Timeline)
**Required by:** None
