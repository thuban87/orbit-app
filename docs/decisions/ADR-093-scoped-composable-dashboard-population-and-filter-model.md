# ADR-093: Scoped Composable Dashboard Population and Filter Model

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 25-dashboard-data-state-foundation
**Source decisions:** dossier `phase-04-dashboard-data-state-foundation` §§C–I; CONTEXT D-04–D-07, D-12–D-14
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The Dashboard needed special populations, filters, and population-aware sorting without weakening Active Contacts' status-bearing boundary. Its legacy view separately exposed ranked favourites, a birthday banner, Never Contacted navigation, and an Unbound search result that no longer matched the settled Dashboard model.

## Decision

The Dashboard builds one archived-and-Bound scoped result universe. Empty population selection means status-bearing Active Contacts; explicit populations combine as a deduplicated OR-union, while filters combine OR-within a family and AND-across families. All Contacts is the explicit Active-plus-Not-Contacted union, snoozed contacts remain in Active but are suppressed from Needs Attention, and Gravity narrows the fully filtered result in TypeScript rather than stored state. Favourites are binary membership, the widget uses Favorites Default order, and the legacy banner and Never Contacted surfaces retire with their documented transitional gaps.

## Alternatives Considered

- **Include never-contacted contacts in Active Contacts** — Rejected because ADR-011's status-bearing segregation remains live; All Contacts provides the union.
- **Retain rank as a Dashboard or widget ordering concept** — Rejected because favourites are binary membership under ADR-075.
- **Keep the permanent birthday banner or move it into Digest** — Rejected because upcoming birthdays use the Birthday population and richer presentation belongs to Your Week.
- **Store or index derived Gravity** — Rejected because the reversible post-query TypeScript pass avoids a new durable derived-value contract.

## Consequences

### Positive

- Every population, filter, sort, search scope, and empty-state consumer starts from the same eligible row set.
- SQL receives only closed code fragments and bound runtime values; Gravity preserves SQL ordering after its narrowing pass.

### Negative

- The owner accepted temporary gaps before Phase 26 supplies an Unbound typed lookup and a visible Not Contacted control.

### Risks

- The retained `favourite_rank` column must not regain user-facing ordering semantics while internal readers still depend on it.

## Implementation

**Key files:**
- `src/logic/dashboard-query-logic.ts` — defines scoped population predicates, filter composition, and population-aware default sorting.
- `src/db/dashboard-read.ts` — executes the shared population query and preserves the legacy term branch's Bound scope.
- `src/logic/dashboard-gravity-filter.ts` — applies reversible post-query Gravity filtering.
- `src/db/favourites-dao.ts` — keeps binary membership writes while retiring rank rewrites.
- `src/services/widget/widget-data.ts` — consumes Favorites in shared Dashboard Default order.
- `src/screens/HomeScreen.tsx` — retires the banner and legacy Dashboard-only population surfaces.

**Depends on:** ADR-011 (Query-Time Status and Never-Contacted Segregation); ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment); ADR-075 (Binary Favourite Membership Without a User-Facing Order); ADR-076 (Population-Reached Birthdays Without a Dashboard Banner)
**Required by:** ADR-095 (Live-Applying Dashboard Floating Control Surface); ADR-097 (Scoped Dashboard Search and Dedicated Unbound Retrieval); ADR-098 (Scan-First, Accessible Dashboard List Rows); ADR-101 (Avatar-First Accessible Dashboard Card Renderer); ADR-102 (Frozen-Universe Dashboard Multi-Select); ADR-104 (Durable Orrery Preferences and Live System Scope)
