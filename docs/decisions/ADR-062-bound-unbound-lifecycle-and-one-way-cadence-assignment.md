# ADR-062: Bound/Unbound Lifecycle and One-Way Cadence Assignment

**Status:** Accepted
**Date:** 2026-08-27
**Phase:** 18.2-bound-unbound-lifecycle
**Source decisions:** dossier `18-contact-data-normalization` clusters G–N and S; 18.2-CONTEXT.md; 18.2-01 through 18.2-08 summaries
**Reversibility:** one-way
**Migration:** 011
**Supersedes:** None
**Superseded by:** None

## Context

Orbit needed to retain complete relationship records without treating every person as an active cadence obligation. A nullable cadence alone could not express that distinction: NULL means no cadence was ever assigned, while an Unbound person can retain a previously assigned dormant cadence and all relationship history.

## Decision

The system uses an independent `tracking_enabled` Bound/Unbound lifecycle. Bound contacts require a positive cadence; Unbound contacts retain history, gravity, data ownership, and explicit person-level actions, while proactive cadence surfaces are Bound-only. Once a cadence is assigned it is never cleared, so Unbinding preserves it as dormant configuration.

## Alternatives Considered

- **Use NULL cadence to mean Unbound** — Rejected because NULL must exclusively mean cadence was never assigned.
- **Clear cadence or reset history when unbinding** — Rejected because lifecycle participation must not discard relationship context or create a new epoch on rebind.
- **Exclude Unbound contacts from all surfaces and actions** — Rejected because they remain complete relationship records; retrieval, profile, history, gravity, and explicit AI stay available.

## Consequences

### Positive

- Active dashboard, status, Orrery, favourites, decay, and widget populations share a durable lifecycle boundary.
- Rebinding immediately derives current relationship state from preserved history and dormant cadence.

### Negative

- Every cadence consumer must guard nullable cadence and distinguish proactive action from an explicit person-level action.

### Risks

- A missed read or OS-ingress guard could present stale active-cadence work for an Unbound contact; the lifecycle consumer ledger and live-state guards backstop that boundary.

## Implementation

**Key files:**
- `src/db/migrations/011-contact-lifecycle-schema.ts` — adds lifecycle shape, cadence constraints, and singleton settings columns.
- `src/db/contact-lifecycle-dao.ts` — performs guarded Bind and Unbind transactions.
- `src/db/contacts-dao.ts` — persists lifecycle choice atomically with contact create and edit data.
- `src/db/dashboard-read.ts` — owns Bound-only active projections and neutral Unbound retrieval rows.
- `src/db/status.ts` — requires a Bound positive-cadence row before status arithmetic.
- `src/services/contact-lifecycle-effects.ts` — reconciles notification and widget effects after a durable transition.
- `src/services/widget/widget-quick-action-guard.ts` — rejects stale active-cadence widget actions while allowing a live Unbound Profile open.

**Depends on:** ADR-009 (Crash-Safe Forward-Only SQLite Migrations); ADR-059 (Normalized Contact Methods, Canonical Actionability, and Local Provenance)
**Required by:** ADR-063 (Versioned Lifecycle Backup and Dormant-Cadence Restore); ADR-066 (Deliberate Reviewed Import with Unbound Bulk Defaults); ADR-068 (User-Triggered, Source-Only Reconciliation with Durable Review).
