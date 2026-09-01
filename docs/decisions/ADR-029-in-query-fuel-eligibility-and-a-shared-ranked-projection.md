# ADR-029: In-Query Fuel Eligibility and a Shared Ranked Projection

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 07-conversational-fuel
**Source decisions:** dossier `03-fuel` Clusters C and D
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Fuel must be useful at a glance without exposing off-limits topics, unconfirmed AI suggestions, or empty rows. Independent UI rankings would drift between the profile, card, notification, widget, compose, and prompt surfaces; age needs to improve relevance without silently removing a note.

## Decision

The system uses one query-time eligible ranked projection: exclude `off_limits`, `source='ai'`, and blank text in SQL; then order `recent`, `gift`, `topic`, and `fact` by kind priority and recency. Fuel age is displayed and influences recency only; no age-based archive or delete occurs.

## Alternatives Considered

- **UI-side privacy filtering** — rejected because any new surface could omit the filter and leak a private note.
- **Newest row regardless of kind or pinned-first ranking** — rejected because it loses the owner-selected conversational priority or adds an unnecessary state model.
- **Stored rank or sort order** — rejected because rank is derived from existing rows and tunables.
- **Age-based archive or deletion** — rejected because it hides or destroys local-only data.

## Consequences

### Positive

- One tested SQL projection makes private and unconfirmed rows structurally unavailable to glanceable consumers.
- A shared priority constant keeps pure ranking and SQLite ordering in parity.

### Negative

- Old fuel remains for the user to curate, and reads compute ordering at query time.

### Risks

- The SQL CASE and pure comparator must share the same kind-priority source or surface ordering can diverge.

## Implementation

**Key files:**
- `src/db/fuel-read.ts` — defines the eligible in-query predicates, SQL rank CASE, and ranked reader.
- `src/services/fuel-ranking.ts` — owns the reusable kind-priority order and pure comparator.
- `src/services/fuel-age.ts` — formats local-wall-clock age without mutating fuel data.
- `src/components/RankedFuelLine.tsx` — renders the already-ranked promoted line without local filtering.
- `src/screens/ContactProfileScreen.tsx` — reloads and displays the profile's top ranked fuel row.

**Depends on:** ADR-028 (Per-Item Conversational Fuel with Fixed Kinds)
**Required by:** ADR-030 (Explicit Confirmation of AI-Proposed Fuel); ADR-031 (Bound Local Fuel Search without FTS5); ADR-032 (Flat Dashboard Discovery and In-Query Contact Search)
