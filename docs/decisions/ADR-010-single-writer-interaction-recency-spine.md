# ADR-010: Single-Writer Interaction Recency Spine

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 02-data-foundation-status-engine
**Source decisions:** dossier `01-data` cluster B; 02-CONTEXT DATA-04
**Reversibility:** costly
**Migration:** 001
**Supersedes:** None
**Superseded by:** None

## Context

Status and future read paths need a truthful last-contact value, while every touchpoint must also preserve a complete interaction history. Independent writers would allow the contact summary and history to diverge, especially across foreground and future headless routes.

## Decision

The system maintains `contacts.last_contact` through one serialized recency DAO. Each interaction create, edit, or delete recomputes it as the maximum current interaction timestamp in the same transaction; for rarely-responds contacts, only connected interactions qualify. A contact with no qualifying interaction remains genuinely never-contacted.

## Alternatives Considered

- **Independent contact recency and interaction writes** — Rejected because separate writers recreate summary/history drift.
- **Last-write-wins recency** — Rejected because correcting an older or newest interaction can make the touched row differ from the true maximum.
- **Log only touchpoints with notes or channels** — Rejected because common one-tap interactions would disappear from history.

## Consequences

### Positive

- Every touchpoint route can share one atomic, concurrency-safe recency invariant.
- The status engine can read a stored summary without a per-frame history join.

### Negative

- New interaction writers must route through the recency DAO and preserve its local-wall-clock timestamp contract.

### Risks

- Bypassing the DAO or mixing UTC timestamps into its local strings silently corrupts recency and day-granular status.

## Implementation

**Key files:**
- `src/db/recency-dao.ts` — owns interaction mutations and the sole `last_contact` recomputation.
- `src/db/mutex.ts` — serializes recency write transactions within the JavaScript runtime.
- `src/db/migrations/001-initial.ts` — defines the contacts and interactions tables plus recency index.

**Depends on:** ADR-008 (Initial Contact Schema as a Cross-Phase Data Contract).
**Required by:** ADR-011 (Query-Time Status and Never-Contacted Segregation); ADR-016 (Fixed-First Contact Forms and Atomic Contact Creation); ADR-023 (Structured Touchpoints and One-Tap Defaults); ADR-033 (Profile Marking and Shared Drag-Reordered Favourites); ADR-038 (Contact-Owned Share Capture Fuel); ADR-040 (Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing); ADR-044 (Headless Widget Actions and Dashboard-Rooted Deep Links); ADR-046 (Query-Time Orrery Placement and Transactional Ring Ordering); ADR-069 (Atomic Tombstone-Backed Orbit Contact Merge); ADR-071 (User-Attested Handoff-Time Interaction Logging Through the Sole Recency Writer)
