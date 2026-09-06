# ADR-094: Eligibility-Scoped Semantic Dashboard Search

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 25-dashboard-data-state-foundation
**Source decisions:** dossier `phase-04-dashboard-data-state-foundation` §§I–L; CONTEXT D-08–D-09
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Dashboard search needs to discover user-facing contact knowledge without escaping the selected population and filters. The existing bounded local matcher needed scoped corpus reads, coverage-aware result composition, semantic provenance, and raw-text highlight offsets for both future Dashboard renderers.

## Decision

The system scopes the term-free semantic corpus to the fully filtered eligible Dashboard IDs, then scores it in TypeScript with forgiving matching and coverage-first relevance. Identity matches receive strong priority, the resolved Dashboard order only breaks relevance ties, and each result carries up to three semantic descriptors with raw-text highlights plus an overflow count. No FTS5 table, new search index, global cross-universe search, or internal metadata enters the search path.

## Alternatives Considered

- **Run a global search and filter results afterward** — Rejected because archived and Unbound contacts must never enter the Dashboard search universe.
- **Use FTS5 or a new index** — Rejected because bounded TypeScript scoring over the eligible set preserves ADR-031's local-search constraint.
- **Require every query term to match before returning a contact** — Rejected because coverage-aware partial results are useful and rank below fuller matches.

## Consequences

### Positive

- Search uses the same eligible set as browsing and can expose meaningful match context without renderer-specific re-tokenization.
- Phone, email, category, relationship, memory, custom-field, and note entries retain enough semantic provenance for correct labels and priority.

### Negative

- Search cost grows with the eligible local set and needs physical-device performance validation once a renderer consumes it.

### Risks

- Scoping must receive the post-Gravity result IDs; a pre-filtered set would leak contacts excluded by the selected Gravity tier.

## Implementation

**Key files:**
- `src/db/knowledge-search-read.ts` — builds the eligible-ID-scoped, user-facing semantic corpus.
- `src/services/knowledge-search.ts` — supplies bounded matching, coverage ranking, and raw-text offsets.
- `src/logic/dashboard-search-match.ts` — composes prioritized Dashboard descriptors and relevance ordering.
- `src/db/dashboard-read.ts` — provides the fully filtered ordered eligible IDs consumed by search.

**Depends on:** ADR-031 (Bound Local Fuel Search without FTS5); ADR-088 (Additive Contact-Knowledge Schema and Application-Owned Memory Registry)
**Required by:** ADR-097 (Scoped Dashboard Search and Dedicated Unbound Retrieval); ADR-098 (Scan-First, Accessible Dashboard List Rows); ADR-100 (Relevance-First, Visibility-Safe Dashboard List Search)
