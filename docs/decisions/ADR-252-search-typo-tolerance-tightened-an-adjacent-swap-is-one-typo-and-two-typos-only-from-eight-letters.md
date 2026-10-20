# ADR-252: Search Typo Tolerance Tightened — an Adjacent Swap Is One Typo, and Two Typos Only from Eight Letters

**Status:** Accepted
**Date:** 2026-10-19
**Phase:** 38.13-contacts-list-search-digest-ux
**Source decisions:** D-60 (38.13-CONTEXT.md; ledger Q-05); carried D-03
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None (the replaced thresholds were phase decisions 24.2 D-07 / 25 D-08, never an ADR; ADR-094's bounded TypeScript scoring stands)
**Superseded by:** None

## Context

Search allowed two edits for any term of six or more letters, counted with plain Levenshtein distance. "Denver" therefore matched "History Dense" and highlighted nonsense, while a common transposition such as "birthdya" cost two edits. Wrong matches undermined trust in search (audit A-07).

## Decision

The scorer counts swapping two adjacent letters as one edit (a restricted Damerau / optimal-string-alignment step in `boundedEditDistance`). Terms under 8 letters allow at most one edit; terms of 8 or more allow two (`TYPO_TWO_EDIT_MIN_LENGTH = 8`). "birthdya" still finds "birthday"; "Denver" no longer matches "Dense". Matching stays TypeScript scoring over the eligible set, with no FTS5 and no new index (ADR-094, ADR-215).

## Alternatives Considered

- **Rank typo matches lower but keep the tolerance (T2)** — rejected (Q-05).
- **Keep today's tolerance (T3)** — rejected (Q-05).

## Consequences

### Positive

- Fewer false matches; transpositions, the commonest typo, cost one edit.

### Negative

- A 6–7-letter term with two real typos no longer matches.

### Risks

- The threshold is a single constant; changing it changes every search surface that uses the scorer (Contacts search and its corpus).

## Implementation

**Key files:**
- `src/services/knowledge-search.ts` — `TYPO_TWO_EDIT_MIN_LENGTH`, OSA swap step in `boundedEditDistance`.
- `src/services/knowledge-search.test.ts` — gfit / birthdya / denver cases.

**Depends on:** ADR-094 (Eligibility-Scoped Semantic Dashboard Search); ADR-215 (Search and Glanceable Surfaces After Fuel)
**Required by:** None
