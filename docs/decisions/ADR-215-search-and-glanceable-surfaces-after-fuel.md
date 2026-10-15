# ADR-215: Search and Glanceable Surfaces After Fuel

**Status:** Accepted
**Date:** 2026-10-15
**Phase:** 38.10-fuel-retirement-things-to-remember
**Source decisions:** D-58, D-59, D-62, D-94 (38.10-CONTEXT.md; ledger Q-10, Q-11, Q-12; plan-phase A6); carried D-10
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-031 (partial — searching fuel text and excluding Off Limits die; bound, escaped `LIKE`, no FTS5 and cross-contact search survive); ADR-032 (partial — eligible-fuel search, ranked fuel and fuel snippets in the dashboard read die; the flat dashboard survives); ADR-100 (partial — the fuel-only fallback results die; relevance-first, visible-surface-safe search survives); ADR-110 (partial — the legacy fuel projection and the Off Limits search exclusion die; the coherent snapshot and source-owned projections survive)
**Superseded by:** None

## Context

Shares and gift ideas were findable only through fuel text search, which excluded Off Limits; the widget's large tile showed a fuel line; the Dashboard card's knowledge line read memories. With fuel gone (ADR-207), each surface needed a rule for the new homes.

## Decision

We will search the knowledge corpus instead of fuel. Contacts search matches Off Limits label and text and shows it in the result snippet (D-58), and also finds Gift Ideas, Thought of Them (registry `searchable`) and every Last Talked About and Current Location entry, current and previous, each hit naming its section (D-62). Shares therefore stay findable, keeping ADR-031's rejection of "no cross-contact search". The dashboard's own search is name-only; LIKE escaping lives in `src/db/sql-like.ts`. The widget's large tile shows no knowledge line; the widget-overhaul phase decides any replacement (D-59). The Dashboard card knowledge line includes Thought of Them (shares included) and leaves out Gift Ideas (D-94). Off Limits stays off the widget, notifications and contact cards, fully visible on the Profile and in Compose Research (D-10).

## Alternatives Considered

- **Off Limits searchable without its text in the snippet / not searchable** — not chosen (Q-10, "Searchable with text").
- **Search only some of the four sections** — rejected (Q-11, "Add all four").
- **A replacement widget line now** — deferred to the widget-overhaul phase (Q-12).
- **Gift Ideas on Dashboard cards** — rejected: "Gift ideas should be left off" (A6).

## Consequences

### Positive

- Every home a share can live in is searchable.

### Negative

- Off Limits text is now glanceable in search results, which 03-fuel's "never glanceable" had ruled out.

### Risks

- While Hide from Profile is switched off (ADR-218), previously hidden items are searchable; ADR-100's visible-surface rule still holds because they are visible on the Profile.

## Implementation

**Key files:**
- `src/db/knowledge-search-read.ts` — current-state and Off Limits sources, section labels.
- `src/logic/dashboard-search-match.ts` — new source kinds and ranks.
- `src/db/dashboard-read.ts` — no fuel text or snippet; name-only list search.
- `src/db/sql-like.ts` — `escapeLike`.
- `src/db/dashboard-knowledge-read.ts` — the card line without Gift Ideas.
- `src/services/widget/widget-data.ts` — no knowledge line.
- `src/services/widget/widget-render.tsx` — the large tile without the fuel line.
- `src/components/ContactCard.tsx` — the dead fuel line removed.

**Depends on:** ADR-207 (Knowledge Homes After Fuel); ADR-094 (Eligibility-Scoped Semantic Dashboard Search); ADR-100 (Relevance-First, Visibility-Safe Dashboard List Search)
**Required by:** None
