# ADR-128: Same-Group Contact Merge Refusal with Remediation

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 33-group-interaction-logging
**Source decisions:** 33-01-PLAN owner-locked Option A (2026-09-12); 33-01-SUMMARY; 33-REVIEWS cycle 5
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Merging two contacts who both participate in the same Group Event would violate unique membership when child interactions are reparented. Automatically choosing a surviving child would destroy one person’s history.

## Decision

The system detects shared non-null Group Event membership inside the contact-merge transaction before reparenting and throws GroupMergeCollisionError with actionable remediation. The merge UI displays that typed guidance: remove one membership from the shared event before merging. Both contacts, both children, tombstones, and recency remain unchanged on refusal. No-collision merges retain existing reparenting and survivor recency recomputation. This is owner-locked Option A, not permission to reconcile competing child records.

## Alternatives Considered

- **Reconcile into one child (Option B)** — not authorized; the owner selected lossless refusal.
- **Raw UNIQUE error with generic Try again** — rejected because retry alone cannot resolve the collision and remediation must reach the user.

## Consequences

### Positive

- Merge cannot silently discard a participant record to satisfy the unique index.

### Negative

- The user must explicitly resolve membership before attempting the merge again.

### Risks

- A generic UI catch can discard typed remediation; the reviewed fix stores and displays the collision message while retaining a generic fallback for other errors.

## Implementation

**Key files:**
- `src/db/merge-dao.ts` — transaction-local collision detection and typed refusal.
- `src/components/MergeImpactSummary.tsx` — displays actionable typed remediation.
- `src/db/migrations/026-group-events-schema.ts` — membership uniqueness backstop.

**Depends on:** ADR-069 (Atomic Tombstone-Backed Orbit Contact Merge); ADR-124 (Group Event Parents with Canonical Per-Contact Children)
**Required by:** None
