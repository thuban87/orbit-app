# ADR-124: Group Event Parents with Canonical Per-Contact Children

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 33-group-interaction-logging
**Source decisions:** dossier §§A–E, AA; 33-CONTEXT D-05–D-08
**Reversibility:** one-way
**Migration:** 026
**Supersedes:** None
**Superseded by:** None

## Context

One shared occasion must be authored once without changing Orbit’s one-contact-per-Interaction model. Group Events need durable identity and may exist before any participants are known.

## Decision

The system uses a UID-bearing Group Event parent and one ordinary canonical child Interaction per participating contact. Migration 026 adds a nullable parent reference, exactly three follow flags, and a partial UNIQUE constraint on (group_event_id, contact_id). Required nonblank title and local date/time permit zero participants and historical entry through now. Parents never count toward contact History, Status, Gravity, Intensity, or Heatmap. Every fan-out composes the non-mutexed recency cores inside one outer write transaction with one trailing revision bump; failures leave no durable prefix. Archived participants remain archived while their recency advances, as owner-accepted.

## Alternatives Considered

- **Group Events as Dashboard bulk actions only** — rejected because the owner requires first-class durable event identity and management.
- **Parent as another interaction or lifecycle event** — rejected because it would duplicate contact metrics or misclassify an editable event.
- **Set-based child writes bypassing recency cores** — rejected because they break the single recency writer; nested mutex-owning writers also deadlock.
- **Require participants or restore archived contacts first** — rejected because event-first zero-participant capture and archived participation are explicit product commitments.

## Consequences

### Positive

- Existing contact-centric consumers keep reading ordinary interactions, with database-enforced unique membership.

### Negative

- An irreversible additive migration and per-child recency recomputation are required.

### Risks

- A late child failure must roll back parent, children, recency, and revision together; transaction-local validation and rollback tests protect that boundary.

## Implementation

**Key files:**
- `src/db/migrations/026-group-events-schema.ts` — parent, linkage, follow columns, and membership index.
- `src/db/database.ts` — strict migration registration.
- `src/db/group-events-dao.ts` — atomic create and saved-participant batch.
- `src/db/recency-dao.ts` — composable insert, full-edit, delete, and recency cores.
- `src/db/history-read.ts` — local group context without parent history rows.
- `src/db/purge-dao.ts` — leaves Group Event parents outside contact purge.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-010 (Single-Writer Interaction Recency Spine); ADR-024 (Editable Touchpoint History and Recomputed Recency)
**Required by:** ADR-125; ADR-126; ADR-127; ADR-128
