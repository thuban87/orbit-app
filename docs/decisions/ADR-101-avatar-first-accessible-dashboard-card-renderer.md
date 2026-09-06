# ADR-101: Avatar-First Accessible Dashboard Card Renderer

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 28-dashboard-card-view
**Source decisions:** dossier `phase-07-dashboard-card-view-dossier-v0.2` §§A–M, AD–AF; 28-CONTEXT D-09, D-11
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Dashboard Card View needed to be a compact browse-and-recognize sibling to List View without creating a second query, status, search, or favourite model. The renderer also needed to retain meaningful status and context for people who cannot rely on colour or dense text.

## Decision

The system uses a responsive, avatar-first CardGrid over the shared `DashboardRow` result model. Each card has a three-row identity/recency/context hierarchy, a binary favourite star, a status ring plus edge glyph, and textual accessibility; search preserves that geometry with a shared match descriptor. Card context applies compactness only within the existing semantic priority tiers.

## Alternatives Considered

- **A richer Card-specific information architecture** — make Card View a mini-profile feed. Rejected because Card and List differ primarily in presentation.
- **Colour-only status treatment** — communicate state with the avatar ring alone. Rejected because status must remain understandable without colour perception.
- **A Card-specific query, search, or knowledge read** — tailor data retrieval to the grid. Rejected because renderer presentation must not fork shared Dashboard semantics.
- **A permanent dense three-column invariant** — retain density at all sizes. Rejected because large text and narrow screens must remain readable.

## Consequences

### Positive

- Card and List expose one eligible universe while serving different scan styles.
- Reused token, icon, status, recency, and search primitives keep the presentation locally consistent and accessible.

### Negative

- The grid needs a keyed virtualized list when its responsive column count changes.
- Compact card rows deliberately omit category and literal relationship-status text.

### Risks

- Re-deriving status, sorting by favourite rank, or issuing per-card reads would silently diverge from shared Dashboard behavior.

## Implementation

**Key files:**
- `src/components/GridCard.tsx` — renders the presentational avatar-first card, status treatment, context/search rows, and accessible actions.
- `src/components/CardGrid.tsx` — owns the keyed responsive virtualized grid over shared rows.
- `src/logic/card-line3-selection.ts` — selects compact card context within existing semantic tiers.
- `src/components/icons/icon-registry.ts` — provides the semantic Card action and selection icons.
- `src/screens/HomeScreen.tsx` — supplies shared rows, descriptors, host-owned navigation, and favourite mutation.

**Depends on:** ADR-075 (Binary Favourite Membership Without a User-Facing Order); ADR-086 (Semantic Icons and Accessible Interaction Primitives); ADR-092 (Durable Shared Dashboard Query State); ADR-093 (Scoped Composable Dashboard Population and Filter Model); ADR-094 (Eligibility-Scoped Semantic Dashboard Search)
**Required by:** None
