# ADR-069: Atomic Tombstone-Backed Orbit Contact Merge

**Status:** Accepted
**Date:** 2026-08-26
**Phase:** 20-contact-reconciliation-merge
**Source decisions:** dossier `20-contact-reconciliation-merge` clusters T–AC
**Reversibility:** one-way
**Migration:** 013
**Supersedes:** None
**Superseded by:** None

## Context

Reconciliation and import can surface duplicate Orbit identities, but identifying a duplicate without a local remedy leaves the relationship graph inconsistent. A naïve reparent can violate primary-method and active-link uniqueness, and an archive lifecycle would permit the absorbed identity to return.

## Decision

The system performs a user-confirmed, atomic merge into a chosen survivor. It explicitly resolves genuine scalar and primary-method conflicts, consolidates compatible methods and child rows, recomputes derived values through their authoritative paths, and deletes plus tombstones the absorbed contact without a simple undo.

## Alternatives Considered

- **Copy children and delete the source contact** — rejected because it discards stable child identities and doubles writes.
- **Archive the absorbed contact** — rejected because archive restore could recreate the duplicate.
- **Choose a survivor or source conflict automatically** — rejected because the recommendation is advisory and relationship data needs explicit user control.

## Consequences

### Positive

- One local transaction preserves compatible relationship history and makes the retired identity resurrection-resistant.

### Negative

- Merge is deliberately serious and requires a conflict review and impact confirmation.

### Risks

- Primary methods and active external links must be resolved before child reparenting; a failure rolls back the entire merge.

## Implementation

**Key files:**
- `src/db/migrations/013-reconciliation-and-merge.ts` — provides the durable phase schema alongside merge support.
- `src/db/merge-dao.ts` — owns transactional merge ordering, conflict choices, reparenting, snapshots, tombstoning, and recency recomputation.
- `src/db/merge-candidate-read.ts` — reads live eligible merge candidates and continuity signals.
- `src/db/contacts-dao.ts` — supplies the transaction-composable contact photo writer used by merge.
- `src/screens/SurvivorSelectScreen.tsx` — lets the user select the survivor with advisory guidance.
- `src/screens/MergeConflictsScreen.tsx` — requires explicit resolution of genuine conflicts.
- `src/components/MergeImpactSummary.tsx` — presents impact and hands typed choices to the writer.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine); ADR-056 (Tombstone-Backed UID Reconciliation for Portable Restores); ADR-059 (Normalized Contact Methods, Canonical Actionability, and Local Provenance)
**Required by:** ADR-073 (Merge-Reparented, Purge-Cascaded Interaction Assists); ADR-089 (Recoverable Memory Lifecycle and Contact-Operation Integrity)
