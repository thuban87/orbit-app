# ADR-031: Bound Local Fuel Search without FTS5

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 07-conversational-fuel
**Source decisions:** dossier `03-fuel` Cluster F; Phase 07 Plan 04
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-032 (partial)

## Context

Saving fuel without a way to find its contact loses the capture-without-thinking use case. Orbit's expected tens-of-contacts scale does not justify a virtual-table index, triggers, or write-side synchronization, but a `LIKE` reader must not turn typed `%`, `_`, or backslash into unintended wildcard matching.

## Decision

The system searches contact names and eligible fuel text with a local, parameter-bound `LIKE ? ESCAPE '\\'` query. The reader escapes backslash first, then `%` and `_`; it excludes archived contacts, off-limits fuel, and unconfirmed AI fuel in-query. Phase 7 exposes the reusable reader and result row through a minimal Settings-reached search screen; no FTS5 table is created.

## Alternatives Considered

- **FTS5 in v1** — rejected because its table, triggers, and synchronization cost are disproportionate at this dataset size.
- **No cross-contact search** — rejected because users need to recover who a saved note belongs to.
- **UI-side exclusion or unescaped bound LIKE** — rejected because bound parameters do not make LIKE metacharacters literal or enforce privacy at the query boundary.

## Consequences

### Positive

- Search remains local, simple, and reusable by the dashboard without an index migration.
- Sensitive and unconfirmed rows cannot produce a match or a displayed snippet.

### Negative

- Search is a scan and case folding is ASCII-only because ICU is unavailable.

### Risks

- Every LIKE predicate, including the returned snippet, must use the same escaped bound term and exclusion predicates.

## Implementation

**Key files:**
- `src/db/fuel-read.ts` — owns the bound escaped LIKE reader and eligible-result predicates.
- `src/db/fuel-read.test.ts` — proves literal `%`, `_`, and backslash behavior plus exclusion rules.
- `src/components/FuelSearchResultRow.tsx` — provides the reusable presentational result row.
- `src/screens/FuelSearch.tsx` — mounts the minimal input, result list, and Profile navigation flow.
- `src/navigation/RootNavigator.tsx` — registers the Phase-7 FuelSearch route.
- `src/screens/SettingsScreen.tsx` — exposes the low-traffic Search entry point.

**Depends on:** ADR-029 (In-Query Fuel Eligibility and a Shared Ranked Projection); ADR-030 (Explicit Confirmation of AI-Proposed Fuel)
**Required by:** ADR-032 (Flat Dashboard Discovery and In-Query Contact Search); ADR-094 (Eligibility-Scoped Semantic Dashboard Search)
