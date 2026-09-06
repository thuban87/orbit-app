# ADR-075: Binary Favourite Membership Without a User-Facing Order

**Status:** Accepted
**Date:** 2026-09-01
**Phase:** milestone-2 pre-build audit (oa-audit-dossiers)
**Source decisions:** dossier `phase-04-dashboard-data-state-foundation` §E Favorites, §H, Notes for GSD; `phase-06-dashboard-list-view` §H; `phase-07-dashboard-card-view-v0.2` §H; owner ratification 2026-09-01
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-033 (full); ADR-043 (partial — ordering source only)
**Superseded by:** None

## Context

ADR-033 marked favourites with a Profile star and ordered them by drag on one shared Manage favourites screen, and ADR-043's widget consumed that manual rank. The milestone-2 dossiers instead specify favourites as binary membership whose legacy `favourite_rank` must never surface as ranked UX, which leaves the reorder screen and the widget's ordering source without a defined purpose (audit finding E-01). The owner ratified the binary reading on 2026-09-01.

## Decision

Favourites are binary membership. The user toggles membership from the Profile star, from a Dashboard List row's always-visible star, and from a Dashboard Card's star, and there is no user-facing favourite order anywhere in the product. The Manage-favourites drag-reorder screen and its Dashboard-overflow and Settings entries are retired with nothing put in their place. The favourites home-screen widget renders the Favorites population in its Default ordering — the normal Dashboard relationship-health ordering per Phase 4 §H — and customizable widget membership is deferred to a future milestone.

## Alternatives Considered

- **Keep ADR-033's drag-reordered rank and amend Phases 4, 6, and 7** — Rejected because the owner ratified binary membership as the product model; a rank no surface exposes is not a product concept.
- **Repurpose Manage favourites as a binary list with unstar actions** — Rejected because ADR-033 itself rejected unstar actions on that screen, and List rows and Cards already toggle membership directly.
- **Give the widget its own ordering rule (manual rank or status weighting)** — Rejected because the widget should mirror one population the user already understands.
- **Ship customizable `include in widget` membership now** — Rejected for this milestone and deferred; it is a separate membership concept, not an ordering fix.

## Consequences

### Positive

- One favourite concept spans Profile, List, Card, and widget, with no second ordering model to keep coherent.
- Removing a drag-list surface removes its reorder gesture, its transactional rank rewrite, and its device UAT burden.

### Negative

- Users cannot pin a specific favourite to the front of the widget until the deferred membership work lands.

### Risks

- `favourite_rank` may remain as the storage column with its rank semantics simply ignored, or be replaced by a boolean in a forward-only migration; that is an implementation choice for plan-phase, and the wrong pick leaks rank ordering back into a read path.
- Existing reads that order by `favourite_rank` must be re-pointed at the Default ordering, or the retired rank silently keeps deciding what the widget shows.

## Implementation

**Key files:**
- `src/screens/ManageFavouritesScreen.tsx` — retired; the drag-reorder surface this decision removes.
- `src/logic/favourites-reorder-logic.ts` — retired; computed the drag-to-order permutation.
- `src/db/favourites-dao.ts` — keeps mark and clear writes; the rank-rewrite write is retired.
- `src/db/dashboard-read.ts` — favourites reads order by the population Default ordering, not by rank.
- `src/services/widget/widget-data.ts` — projects the Favorites population in Default ordering instead of manual rank.
- `src/screens/SettingsScreen.tsx` — loses the Manage favourites entry.

**Depends on:** ADR-008 (Initial Contact Schema as a Cross-Phase Data Contract); ADR-032 (Flat Dashboard Discovery and In-Query Contact Search)
**Required by:** ADR-082 (Universal Capture FAB, Canonical Picker, and Truthful Quick Log); ADR-093 (Scoped Composable Dashboard Population and Filter Model); ADR-096 (Dashboard Header and Overflow Discovery Paths); ADR-098 (Scan-First, Accessible Dashboard List Rows)
