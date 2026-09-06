# ADR-103: Atomic Composed Dashboard Bulk Mutations

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 28-dashboard-card-view
**Source decisions:** dossier `phase-07-dashboard-card-view-dossier-v0.2` §§T–Z; audit amendment E-08; 28-CONTEXT D-03–D-08, D-13
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Card View introduces multi-contact writes over shared `contacts`, `interactions`, and `events` data without adding a schema migration. Existing public writers each own a mutexed transaction, so looping them inside a batch would deadlock; set-based writes would bypass the recency and lifecycle-event invariants.

## Decision

Dashboard bulk actions validate and then compose one non-mutexed single-contact core per selected ID inside one outer write transaction, with one data-revision bump after the batch. Bulk Quick Log writes the canonical outbound manual interaction shape, recomputes recency for every contact, and returns an exact receipt for atomic Undo. Bulk Archive writes each immutable archive event; favourite, snooze, category, and positive-frequency actions use explicit cores. Every selected contact is eligible for every bulk action.

## Alternatives Considered

- **Set-based bulk SQL updates or inserts** — update rows directly for efficiency. Rejected because this bypasses recency recomputation or immutable lifecycle events.
- **Loop existing top-level writers** — reuse their public APIs within one batch. Rejected because the shared write mutex is non-reentrant and nested transactions deadlock.
- **A migration-backed bulk state or contact quarantine** — add retention or scheduling state. Rejected because no schema change is needed and Archive remains indefinite/manual-purge lifecycle state.
- **Per-action eligibility filtering** — omit Unbound or never-contacted selected contacts. Rejected by the owner: apply every operation to all selected IDs, matching single-contact behavior.

## Consequences

### Positive

- Bulk writes retain the single recency writer, immutable event trail, cadence validation, and all-or-nothing rollback.
- Exact Quick Log receipts let one Undo reverse only the batch that committed.

### Negative

- New bulk operations must first extract or reuse transaction-owned cores rather than call public writer wrappers.
- The Dashboard host must serialize submissions and publish widget/shell refresh once after a committed batch.

### Risks

- A direct interaction insert leaves `last_contact` stale; a direct archive update omits the audit event.
- Resolving a snooze target separately per contact can produce inconsistent dates at a local-midnight boundary.

## Implementation

**Key files:**
- `src/db/bulk-actions-dao.ts` — owns the one-transaction batch composers and receipt-based Quick Log undo.
- `src/db/contacts-dao.ts` — supplies archive, category, and frequency transaction cores.
- `src/db/favourites-dao.ts` — supplies explicit binary favourite transaction cores.
- `src/db/snooze-dao.ts` — supplies local-date snooze cores with immutable event composition.
- `src/db/recency-dao.ts` — supplies the sole interaction insertion and `last_contact` recomputation cores.
- `src/db/events-dao.ts` — supplies the immutable lifecycle-event core used by archive and snooze paths.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine); ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out); ADR-024 (Editable Touchpoint History and Recomputed Recency); ADR-025 (Immutable Lifecycle Events in a Unified Timeline); ADR-071 (User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer); ADR-075 (Binary Favourite Membership Without a User-Facing Order)
**Required by:** None
