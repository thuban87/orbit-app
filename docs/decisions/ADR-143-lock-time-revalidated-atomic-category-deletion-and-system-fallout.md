# ADR-143: Lock-Time-Revalidated Atomic Category Deletion and System Fallout

**Status:** Accepted
**Date:** 2026-09-15
**Phase:** 37.1-category-management
**Source decisions:** dossier `phase-37.1-category-management-dossier.md` §§G–J; `37.1-UI-SPEC.md` owner rulings
**Reversibility:** one-way
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Deleting a category affects local contact and import foreign keys, UID-backed System rules and preferences, persisted dashboard and Orrery state, and Profile presentation. A stale confirmation or partial write would misrepresent the deletion or leave the local database inconsistent; permanent deletion has no Undo, history, or recovery UI.

## Decision

The system uses a count-only deletion preview fingerprint that is revalidated under one writer lock. The transaction reassigns contacts and every referenced import session to the selected survivor or NULL, repairs all audited dependent state, records a category tombstone, deletes the parent last, and advances data revision exactly once.

## Alternatives Considered

- **Delete the category row and rely on foreign keys** — rejected because ref-keyed and JSON state require explicit repair and the preview must represent all fallout.
- **Retain a deleted category rule as broken** — rejected because runtime deletion removes only the proven affected rule while preserving unrelated historical diagnostics.
- **Undo, quarantine, or a `field_history` snapshot** — rejected because deletion is explicitly permanent; its tombstone is merge evidence, not recovery data.
- **Separate public DAO transactions for fallout** — rejected because nested writers can deadlock and partial deletion is unacceptable.

## Consequences

### Positive

- Interactive deletion is truthful, rollback-safe, and prevents older backup state from resurrecting a category.
- Custom Systems preserve unrelated rules and surface Needs Attention only when their remaining definition has no positive membership.

### Negative

- The aggregate must maintain a complete audited fallout inventory and transaction-composable helper cores.

### Risks

- Any future category reference omitted from the preview and aggregate can create stale state or block deletion.

## Implementation

**Key files:**
- `src/db/categories-dao.ts` — reads the fingerprinted preview and owns the parent-last atomic delete aggregate.
- `src/db/import-session-dao.ts` — provides all-status transaction-composable reassignment for import sessions.
- `src/db/systems-dao.ts` — removes only the matching UID-backed category rule and category System state.
- `src/logic/system-rule-resolver.ts` — distinguishes valid and Needs Attention definitions from malformed-rule diagnostics.
- `src/db/tombstones-dao.ts` — admits and records durable category deletion evidence.
- `src/db/orrery-system-read.ts` — carries validity-bearing System reads and safe selection state.

**Depends on:** ADR-056 (Tombstone-Backed UID Reconciliation for Portable Restores); ADR-104 (Durable Orrery Preferences and Live System Scope); ADR-108 (Durable Independent-Axis Profile Presentation and Inheritance); ADR-142 (User-Owned Categories with Stable Identity and Canonical Ordering)
**Required by:** ADR-145 (Category-Aware Portable Backup Format v6 and Exact Taxonomy Restore)
