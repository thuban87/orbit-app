# ADR-068: User-Triggered, Source-Only Reconciliation with Durable Review

**Status:** Accepted
**Date:** 2026-08-26
**Phase:** 20-contact-reconciliation-merge
**Source decisions:** dossier `20-contact-reconciliation-merge` clusters A–S
**Reversibility:** one-way
**Migration:** 013
**Supersedes:** None
**Superseded by:** None

## Context

Imported external links need a way to detect source changes without making System Contacts authoritative or introducing generic synchronization. A large review can outlive the process, while users must not be re-prompted for an unchanged discrepancy they already resolved.

## Decision

The system uses user-triggered, one-way reconciliation of name, phones, emails, birthday, and photo. It classifies additive, conflicting, removed, and missing-source states into durable resumable cards, remembers only last-reviewed canonical source values, and applies only deliberate selections through existing writers.

## Alternatives Considered

- **Background polling or passive monitoring** — rejected for privacy, predictability, and scope control.
- **Generic synchronization history or field clocks** — rejected because narrow reviewed-source memory answers the required re-nag question.
- **Automatic source authority or source write-back** — rejected because Orbit owns its local copy and destructive source preference is unsafe.

## Consequences

### Positive

- Users can safely review per-contact or batch changes, resume unresolved work, and preserve Orbit data when a source is missing or disagrees.

### Negative

- Reconciliation is foreground, user initiated, and stores durable local session state.

### Risks

- Delayed applies must re-read scalar baselines; photos are staged and promoted only after the transactional data write commits.

## Implementation

**Key files:**
- `src/db/migrations/013-reconciliation-and-merge.ts` — adds durable reconciliation sessions, cards, source snapshots, and bulk-review resolutions.
- `src/logic/reconcile-diff.ts` — classifies canonical five-family source differences and serializes source-memory values.
- `src/db/reconcile-snapshot-dao.ts` — persists narrow last-reviewed source state per link and field family.
- `src/db/reconcile-apply.ts` — applies selected values with stale-field protection through authoritative writers.
- `src/db/reconcile-session-dao.ts` — owns durable session and card transitions.
- `src/db/reconcile-relink-dao.ts` — replaces or retires only external links for a missing source.
- `src/services/photos/reconcile-photo.ts` — stages and promotes chosen source photos around the transaction boundary.
- `src/screens/ReconcileGridScreen.tsx` — presents Settings-launched batch review and safe bulk actions.

**Depends on:** ADR-059 (Normalized Contact Methods, Canonical Actionability, and Local Provenance); ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment)
**Required by:** None
