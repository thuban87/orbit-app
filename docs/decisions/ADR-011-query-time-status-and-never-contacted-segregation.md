# ADR-011: Query-Time Status and Never-Contacted Segregation

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 02-data-foundation-status-engine
**Source decisions:** dossier `01-data` cluster C; 02-CONTEXT DATA-05
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Relationship progress changes as time passes, so storing status would go stale without a reliable clock-driven writer. A contact may also honestly have no interactions, for which a decay calculation has no truthful starting point.

## Decision

The system computes continuous progress and its status buckets at query time from local-calendar elapsed time and `interval_days`; status and progress are never stored. Never-contacted contacts (`last_contact IS NULL`) are excluded from normal status/dashboard reads and belong to a dedicated surface once that UI is introduced.

## Alternatives Considered

- **Persist status or progress** — Rejected because values rot as time passes and SQLite cannot index the non-deterministic current-time expression safely.
- **Use only discrete buckets with separate orrery math** — Rejected because parallel calculations would drift.
- **Seed a synthetic contact interaction or run the clock from creation** — Rejected because both fabricate contact that did not happen.

## Consequences

### Positive

- One continuous quantity supports status, ordering, and later visual motion without stored-state drift.
- Never-contacted people are not misrepresented as decaying.

### Negative

- Read queries must apply the normal-population predicate and evaluate the status SQL at query time.

### Risks

- The stored timestamp is already local wall-clock; applying `localtime` again to that column day-shifts late-night values.

## Implementation

**Key files:**
- `src/db/status.ts` — defines query-time progress and status SQL fragments with local-midnight semantics.
- `src/db/queries.ts` — provides the status scan and newest-interaction read queries.
- `src/db/recency-dao.ts` — maintains the local-wall-clock `last_contact` value that status reads.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine).
**Required by:** ADR-026 (Rogue Status for Unresponsive or Far-Overdue Contacts)
