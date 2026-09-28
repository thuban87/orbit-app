# ADR-160: Committed-Identity Contact Edits and Exact-Source Reconciliation

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.2-audit-remediation-data-security-lifecycle
**Source decisions:** dossier Workstream E; 38.2-CONTEXT D-15; RG-017, RG-018, and RG-043
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Contact editors could retry from draft or temporary identities after a write committed but its refresh failed, replaying additions or link diffs. Reconciliation also collapsed multiple source values into an ambiguous scalar, so selecting one source could store another value or let bulk actions clear data.

## Decision

The system advances editor baselines only from identities and rows returned by committed writes while preserving unsaved draft changes after a failed refresh. Rapid and full custom-value edits share the same retained-history core, and full-editor Bind/Unbind events commit with metadata. Reconciliation carries a stable option ID and exact value from classification through apply, stores the complete reviewed comparable for every linked source, rejects NULL source scalars, and leaves multi-option names or birthdays partial for explicit review.

## Alternatives Considered

- **Rebuild baselines from optimistic draft state** — rejected because temporary identities can replay already-committed additions on retry.
- **Treat a failed post-write refresh as a failed write** — rejected because it misreports committed data and invites duplicate writes.
- **Let bulk reconciliation choose or clear ambiguous scalars** — rejected by D-15 because ambiguity requires an explicit per-field choice.

## Consequences

### Positive

- Partial-save retries preserve committed identity and do not duplicate knowledge, links, or lifecycle events.
- Reconciliation writes exactly the source value the user selected and never infers a multi-source scalar.

### Negative

- DAO return shapes and UI baselines are coupled to committed row identity and ordering.

### Risks

- A new editor or bulk reconciliation path that bypasses the shared coordinators can reintroduce replay or unintended-clear bugs.

## Implementation

**Key files:**
- `src/db/custom-value-edit-dao.ts` — composes retained prior-value history with the current raw-TEXT pair write.
- `src/db/contacts-dao.ts` — returns committed contact and knowledge identities from full edits.
- `src/db/contact-links-dao.ts` — returns committed link rows and ordered added IDs.
- `src/screens/edit-contact-save-coordinator.ts` — advances baselines from committed results and preserves in-flight drafts.
- `src/logic/committed-baseline.ts` — maps temporary identities to committed IDs deterministically.
- `src/logic/reconcile-selection.ts` — carries exact source-option identity through detail and bulk selection.
- `src/db/reconcile-apply.ts` — applies exact non-NULL selections with stale-baseline protection.

**Depends on:** ADR-068 (User-Triggered, Source-Only Reconciliation with Durable Review); ADR-090 (Additive Custom-Field Value History and Deferred Contact Scope); ADR-118 (Bind/Unbind Immutable Lifecycle Events Without a Migration)
**Required by:** None
