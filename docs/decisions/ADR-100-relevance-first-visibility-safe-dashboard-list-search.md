# ADR-100: Relevance-First, Visibility-Safe Dashboard List Search

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 27-dashboard-list-view
**Source decisions:** dossier `phase-06-dashboard-list-view` §§L, R–S; 27-CONTEXT D-12
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The shared Dashboard search engine already ranks corpus matches by term coverage and match score, but List View needs compact explanations without discarding that relevance order or exposing knowledge that is not safe for the Dashboard surface. Name-only and fuel-only matches do not carry corpus relevance scores and need an intentional merge rule.

## Decision

Dashboard List search preserves `searchDashboard()` relevance ordering for corpus matches, using the resolved Dashboard sort only as a tie-breaker. It reads a visible-surface-safe local knowledge corpus in bounded batches, renders the strongest highlighted descriptor and a compact match count/category explanation, then appends deterministic fuel-only and name-only fallback results in Dashboard order. Initial or delayed loads may show skeletons; ordinary local query changes keep current rows visible and use focused, foregrounded, reduced-motion-aware transitions.

## Alternatives Considered

- **Re-sort corpus matches into Dashboard order** — make all results follow the normal List order. Rejected because it reverses the recorded relevance-first search requirement.
- **Show every matching snippet inline** — expose full match detail. Rejected because List shows only the strongest context and count.
- **Search hidden, outdated, or quarantined knowledge** — maximize recall. Rejected because Dashboard search may only expose knowledge safe for its visible surface.
- **Use skeletons for every local query update** — signal loading consistently. Rejected because fast local changes should not flash loading states.

## Consequences

### Positive

- Search preserves useful relevance while List retains its compact, identity-first geometry.
- Visibility filters prevent private or stale knowledge from leaking through Dashboard search copy.

### Negative

- Corpus and fallback results have deliberately different ordering inputs.
- Renderer motion requires focus, foreground, and accessibility-state coordination.

### Risks

- Reordering the composed results after scoring silently violates relevance-first behavior.
- Unbounded or per-row corpus reads would make local search performance and privacy review harder.

## Implementation

**Key files:**
- `src/db/dashboard-search-read.ts` — composes relevance-ranked corpus results with deterministic fallback rows.
- `src/db/knowledge-search-read.ts` — reads the local visible-surface corpus in bounded batches.
- `src/logic/dashboard-search-match.ts` — ranks corpus matches and supplies prioritized descriptors.
- `src/components/list-row-content.ts` — formats compact match explanation and highlighted snippet content.
- `src/components/ListRow.tsx` — replaces secondary normal-row lines while search is active.
- `src/screens/HomeScreen.tsx` — runs the scoped List search and applies cause-aware loading and motion state.

**Depends on:** ADR-094 (Eligibility-Scoped Semantic Dashboard Search); ADR-097 (Scoped Dashboard Search and Dedicated Unbound Retrieval)
**Required by:** None
