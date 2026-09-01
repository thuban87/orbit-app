# ADR-046: Query-Time Orrery Placement and Transactional Ring Ordering

**Status:** Accepted
**Date:** 2026-08-17
**Phase:** 13-orrery
**Source decisions:** dossier `09-orrery` Clusters A–C; 13-CONTEXT; plans 02, 03, and 07
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The orrery must express relationship closeness, query-time status, and elapsed progress without adding a stale per-contact visual-state model. It also lets a user reorder closeness directly, while preserving the existing single writer for `contacts.last_contact`.

## Decision

The system derives the visible orbiting set, dense display rank, status, progress, and bounded drift at read time. It treats `ring_seq` as the only persisted placement preference and rewrites it through one guarded transaction; it never writes `last_contact`.

## Alternatives Considered

- **Store rendered rank, status, or progress** — Rejected because time-derived presentation would become stale and duplicates or gaps in `ring_seq` can be resolved harmlessly at read time.
- **Renumber all contacts when the sun changes** — Rejected because the dense ordered projection preserves a stable display order without an extra normalization write.
- **Use an independent reorder writer** — Rejected because it could violate the recency single-writer invariant or partially apply a reordered set.

## Consequences

### Positive

- Placement and status remain truthful as local time advances, and stale stored ranks do not corrupt the visual order.
- The drag writer validates its rendered scope and commits all rank changes together.

### Negative

- Orrery readers must reuse the shared status SQL and thread a contact-sun exclusion consistently into read and write scopes.

### Risks

- Dense layouts can overlap at high contact counts; the capacity strategy remains an owner-deferred visual decision.

## Implementation

**Key files:**
- `src/db/orrery-read.ts` — reads the sun-excluded orbiting projection with shared query-time status and dense rank.
- `src/db/ring-seq-dao.ts` — performs the guarded transactional `ring_seq` rewrite without touching recency.
- `src/logic/orrery-geometry-logic.ts` — derives angles, bounded drift, hit testing, and responsive ring metrics.
- `src/logic/ring-reorder-logic.ts` — computes a clamped immutable rank permutation for radial drag.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine); ADR-011 (Query-Time Status and Never-Contacted Segregation); ADR-026 (Rogue Status for Unresponsive or Far-Overdue Contacts).
**Required by:** ADR-048 (Status-Default Static Orrery with a Single-Canvas Morph)
