# ADR-251: An All Contacts Search Also Finds Unbound People, Marked "Unbound" and Reading "No contact logged"

**Status:** Accepted
**Date:** 2026-10-19
**Phase:** 38.13-contacts-list-search-digest-ux
**Source decisions:** D-57, D-59, D-79, D-53, D-83, D-84 (38.13-CONTEXT.md; ledger Q-03, Q-11, convergence cycle 2 Q1, Batches 8–9)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-093 (partial — the Bound-only universe no longer bounds typed-search results when the population is exactly All Contacts; it still bounds every unsearched list, population and count, the Active default and the OR-union); ADR-094 (partial — its rejection reason "archived and Unbound contacts must never enter the Dashboard search universe" no longer holds for Unbound people on an All Contacts search; eligibility-scoped TypeScript scoring, no global search-then-filter and no FTS5 survive); ADR-097 (partial — "Unbound contacts remain outside Dashboard search" dies for All Contacts searches; the dedicated search read, the A3 Active relaxation and the Unbound Contacts screen's own name search survive)
**Superseded by:** None

## Context

Contacts search never found an Unbound person, even on All Contacts, because every population kept `tracking_enabled = 1` (ADR-093, ADR-097). Owners searched for someone they knew was in the app and got nothing. The `dashboard-read.ts` docstring also claimed an "archived-only" scope that the code did not have.

## Decision

A typed Contacts search on exactly the All Contacts population finds every non-binned person, Unbound included; `searchScope` returns `c.archived_at IS NULL` for that one selection (D-59). Searches on Active Contacts, Favorites or any other population or mix stay Bound-only, and the list with no search term stays Bound-only (owner: Unbound people "certainly shouldn't show up in Active Contacts searches… They should not show up in Favorites searches"). A search inside Never Contacted keeps the Unbound people that population already lists through the ADR-062 opt-in (D-79). Unbound rows in List and Card view show an "Unbound" chip, a neutral ring and no status or snooze glyph, and a dimmed star that explains Bind instead of toggling (one id-keyed gate, `favouriteTapOutcome`). Tapping one opens their Profile. An Unbound person with no interactions reads "No contact logged" on cards (D-83) and List rows (D-84); Bound people keep "Never Contacted" / "No interactions yet". The scope docstrings state the real rules (D-53).

## Alternatives Considered

- **Keep search Bound-only with a pointer line to Unbound Contacts (U2), or no change (U3)** — rejected (Q-03).
- **Unbound matches on every population's search (S1)** — rejected (Q-11); Unbound people are not active and do not belong in Favorites searches.
- **Enforce D-59 literally inside Never Contacted** (hide its opted-in Unbound people when searching) — not chosen (D-79); a search only narrows the list being searched.

## Consequences

### Positive

- Search's core job, finding a person, works for the whole non-binned set when the user asks for All Contacts.

### Negative

- An All Contacts search result can hold rows with no relationship status; every row consumer must branch on `isUnboundRow`.
- `DashboardRow.isAllContacts` reads 0 for a contacted Unbound row; nothing consumes it today.

### Risks

- Widening `searchScope` beyond the param-free All Contacts selection, or letting needs-attention admit Unbound people, would leak Unbound people into status-bearing surfaces. Tests pin the scope with an empty params list.

## Implementation

**Key files:**
- `src/db/dashboard-read.ts` — `searchScope` widening for exactly All Contacts; corrected scope docstrings.
- `src/logic/dashboard-query-logic.ts` — population WHERE composition the search scope falls back to.
- `src/logic/dashboard-unbound-row.ts` — `isUnboundRow`, `favouriteTapOutcome`, `UNBOUND_STAR_OPACITY`.
- `src/components/ListRow.tsx` — Unbound chip, neutral ring, dimmed star, "No contact logged".
- `src/components/GridCard.tsx` — the same Unbound treatment on cards.
- `src/screens/HomeScreen.tsx` — `rowsByIdRef` and the `onFavouriteTap` gate.
- `src/db/dashboard-search-read.test.ts` — real-SQLite scope cases for D-59 and D-79.

**Depends on:** ADR-062 (Bound/Unbound Lifecycle and One-Way Cadence Assignment); ADR-233 (The Profile ⋯ Follows Lifecycle State, Bind and Unbind Show Undo, and Unbound People Get a Bind-Card Frequency, a Disabled Star and a Settings Row)
**Required by:** None
