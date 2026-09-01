# ADR-033: Profile Marking and Shared Drag-Reordered Favourites

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 08-dashboard-never-contacted-screen
**Source decisions:** dossier `08-dashboard` Clusters C–D; 08-CONTEXT Area 2
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Migration 001 already provides an ordered nullable favourite rank, but no interaction surface owned marking or ordering it. A dashboard pin area would duplicate the later widget responsibility, while a single management screen could not make marking convenient on a contact profile.

## Decision

The system marks favourites with a reversible profile star and orders them by drag on one shared Manage favourites screen. The write DAO appends, clears, and rewrites ranks in guarded transactions without touching interaction recency; the dashboard shows a marker and provides a favourites filter rather than a pinned area.

## Alternatives Considered

- **An always-visible pinned dashboard row** — rejected because it duplicates the widget's role.
- **Marking and ordering only on the management screen** — rejected because marking belongs with the contact profile.
- **Long-press card marking** — rejected because the gesture is reserved for fuel quick actions.
- **Unstar actions in the reorder screen** — rejected to keep that screen reorder-only.

## Consequences

### Positive

- Favourites have one reusable order for dashboard and widget configuration.
- Scoped writes and one transaction protect against partial or stale rank rewrites.

### Negative

- The reorder surface adds a dedicated drag-list dependency and device UAT requirement.

### Risks

- Nested transaction wrappers would deadlock the non-reentrant mutex; the rank rewrite must issue its raw updates inside one outer transaction.

## Implementation

**Key files:**
- `src/db/favourites-dao.ts` — provides guarded favourite mark, clear, and rank-rewrite writes.
- `src/logic/favourites-reorder-logic.ts` — computes a pure drag-to-order permutation.
- `src/db/contact-read.ts` — returns the persisted favourite rank in profile headers.
- `src/screens/ContactProfileScreen.tsx` — exposes the reversible favourite star.
- `src/screens/ManageFavouritesScreen.tsx` — renders the shared drag-reorder surface.
- `src/components/ContactCard.tsx` — renders the dashboard favourite marker.

**Depends on:** ADR-008 (Initial Contact Schema as a Cross-Phase Data Contract); ADR-010 (Single-Writer Interaction Recency Spine)
**Required by:** _None._
