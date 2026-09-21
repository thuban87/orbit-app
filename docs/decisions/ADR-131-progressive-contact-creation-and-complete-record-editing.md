# ADR-131: Progressive Contact Creation and Complete-Record Editing

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 34-rapid-capture-update-flows
**Source decisions:** dossier `phase-13-rapid-capture-update-flows` §§C–G, AD–AE; 34-CONTEXT D-05, D-10
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Contact creation must remain name-first and quick while allowing optional relationship knowledge to be supplied deliberately. Complete Edit Contact also needs to persist every direct-access knowledge section without partial rows, nested write transactions, recency shortcuts, or a data-revision under- or double-bump.

## Decision

Add Contact starts with Identity, Relationship Basics, and Contact Methods, with advanced knowledge behind Show More; Name remains the only required field and the existing today/on-date/not-yet first-interaction rule remains intact. No cadence creates an Unbound contact, while a selected cadence coordinates Bound state without erasing dormant cadence. Edit Contact presents nine direct-access sections, and its create/edit aggregate composes methods plus Memories, Relationships, current-state values, and kind-scoped Off Limits through transaction-owned cores in one metadata transaction with exactly one data-revision bump.

## Alternatives Considered

- **Present the complete form at initial create** — rejected because it turns ordinary capture into a long administrative form.
- **Persist advanced sections independently** — rejected because a failed aggregate save could leave partial or orphaned relationship data.
- **Treat Unbound as a cleared cadence** — rejected because dormant cadence remains distinct from never-assigned cadence.

## Consequences

### Positive

- Fast creation and exhaustive editing share canonical editors and a truthful atomic persistence boundary.

### Negative

- Aggregate writers must use only transaction-composable cores; the shared write mutex is non-reentrant.

### Risks

- An unscoped Off Limits diff could delete other fuel kinds, so its seed and writes remain constrained to `off_limits`.

## Implementation

**Key files:**
- `src/db/contacts-dao.ts` — composes create and complete-edit writes, knowledge diffs, and the single revision bump.
- `src/db/contact-methods-dao.ts` — lets the aggregate own revision advancement while composing method changes.
- `src/db/fuel-dao.ts` — permits aggregate Off Limits deletion without an extra tombstone revision bump.
- `src/screens/CreateContactScreen.tsx` — renders the progressive three-section creation flow and Show More surface.
- `src/screens/EditContactScreen.tsx` — renders the direct-access complete-record accordion form.
- `src/components/ui/AccordionSection.tsx` — supplies controlled disclosure and the validation reveal-and-focus target.

**Depends on:** ADR-016 (Fixed-First Contact Forms and Atomic Contact Creation); ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment); ADR-010 (Single-Writer Interaction Recency Spine)
**Required by:** _None._
