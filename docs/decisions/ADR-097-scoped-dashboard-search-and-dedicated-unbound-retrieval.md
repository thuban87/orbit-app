# ADR-097: Scoped Dashboard Search and Dedicated Unbound Retrieval

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 26-dashboard-control-surface
**Source decisions:** dossier `phase-05-dashboard-control-surface` §§K, N; 26-CONTEXT D-08, D-12; owner search-scope resolution 2026-09-05
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Phase 25 established a population- and filter-aware Dashboard universe, but its term-bearing legacy read could not be retained beside the new state model. Dashboard search still needed the recorded A3 behavior for an implicit Active search, while Unbound contacts needed a retrieval path of their own rather than silently disappearing from search.

## Decision

The system uses a dedicated population-aware Dashboard search read rather than adding a term branch to the term-free population read. A non-empty term relaxes only the implicit Active Dashboard search to the non-archived Bound scope; explicit populations and filters retain their selected boundaries, all runtime values remain bound, and collapsing Dashboard search clears its session-only term. Unbound contacts remain outside Dashboard search and receive a local name search on their dedicated child route; the legacy Dashboard and Never Contacted reads are retired without removing the retained count and settings compatibility machinery.

## Alternatives Considered

- **Add a term parameter to the population read** — combine term-free and term-bearing paths. Rejected because it forks the shared population-read contract.
- **Keep the legacy and new reads together** — preserve old callers during transition. Rejected because dual reads would drift in scope and ordering.
- **Exclude never-contacted and snoozed contacts from every term search** — make search match the term-free Active list. Rejected because the recorded A3 scope deliberately relaxes those exclusions for a term.
- **Remove Unbound retrieval from Dashboard without replacement** — narrow search results. Rejected because it weakens the Bound/Unbound lifecycle retrieval guarantee.

## Consequences

### Positive

- Dashboard search composes the durable population/filter model without a second state path.
- Unbound retrieval remains explicit and local rather than leaking into the active Dashboard universe.
- Term-free reads and term-bearing reads have separately testable, intentional scope rules.

### Negative

- Dashboard and Unbound search deliberately have different scopes and UI surfaces.
- Empty-state counts require dedicated bound-only reads rather than reusing a full population list.

### Risks

- A UTC timestamp would change birthday selection near midnight; callers supply one local wall-clock value to both list and count reads.
- Query text must remain LIKE-escaped and `?`-bound; no user term may be interpolated into SQL.

## Implementation

**Key files:**
- `src/db/dashboard-read.ts` — composes population/filter search, applies A3 scope, preserves bound-only counts, and retires the legacy reads.
- `src/logic/dashboard-query-logic.ts` — defines the closed population, filter, and sort contract used by both reads.
- `src/screens/HomeScreen.tsx` — debounces session-only Dashboard search, selects the correct read, and clears the term when search collapses.
- `src/stores/dashboard-session-store.ts` — keeps search text and scroll position only for the current navigation session.
- `src/screens/UnboundContactsScreen.tsx` — exposes the dedicated Unbound search and distinct no-match state.
- `src/screens/unbound-list-logic.ts` — applies stable, case-insensitive local name filtering to already-loaded Unbound rows.

**Depends on:** ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment); ADR-093 (Scoped Composable Dashboard Population and Filter Model); ADR-094 (Eligibility-Scoped Semantic Dashboard Search)
**Required by:** ADR-100 (Relevance-First, Visibility-Safe Dashboard List Search)
