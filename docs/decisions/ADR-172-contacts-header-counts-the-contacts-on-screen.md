# ADR-172: Contacts Header Counts the Contacts on Screen

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.4-audit-remediation-ui-performance-release
**Source decisions:** 38.4-CONTEXT D-51, D-55; OA-E1; `38.4-G2-INVESTIGATION.md` (E1)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None (replaces the Phase 26 "total-live" header rule, recorded only in `26-UAT.md` "Product observation"; no ADR carried it)
**Superseded by:** None

## Context

The Contacts header showed `countLiveContacts`: the number of bound, non-archived, contacted contacts. It did not reflect the population, filters or search in view. The owner saw "5 contacts" above an "All Contacts" population showing 25 or more, and read it as a List/Card divergence. The investigation found no divergence, because List and Card render the same rows from one read (E1). What the owner had seen was the documented Phase 26 total-live rule, which ADR-093, ADR-095 and ADR-097 do not record.

## Decision

The header count shows the contacts the active view displays for the active population, filters and search. One pure helper, `dashboardHeaderCount`, serves both views: List uses its rows, and Card uses its rows (the frozen subset in selection mode), so the two always agree. The count is hidden on a read error, during the initial skeleton, and when the view displays nothing, where the cause-aware empty state speaks instead. `countLiveContacts` stays, but only for `selectDashboardEmptyState`; the header never reads it.

## Alternatives Considered

- **Keep total-live and record the semantics (D-51)** — superseded by the owner (D-55); users read the header as "how many am I looking at".

## Consequences

### Positive

- Every number on the Contacts screen describes what is on screen.

### Negative

- The header no longer shows the size of the whole active relationship set anywhere on Contacts.

### Risks

- None recorded.

## Implementation

**Key files:**
- `src/logic/dashboard-header-count.ts` — displayed-count rule and label.
- `src/screens/HomeScreen.tsx` — renders the displayed count for List and Card.

**Depends on:** ADR-093 (Scoped Composable Dashboard Population and Filter Model); ADR-102 (Frozen-Universe Dashboard Multi-Select)
**Required by:** None
