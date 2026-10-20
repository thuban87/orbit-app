# ADR-253: The Population Menu Lists Active Contacts, All and Active Are Exclusive, Control Writes Queue Instead of Dropping Taps, and Contacts Empty States Lead Somewhere

**Status:** Accepted
**Date:** 2026-10-19
**Phase:** 38.13-contacts-list-search-digest-ux
**Source decisions:** D-23, D-58, D-27, D-65, D-82, D-28, D-30 (38.13-CONTEXT.md; ledger Q-04, Batch 4 triage D-67, Batch 8 B1); carried D-09 (39 D-95), D-10 (39 D-98), D-14
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None (amends the phase-04 dossier :69 "no special-case suppression is required" and the phase-05 dossier :235/:237 "implicit, unlisted default universe"; ADR-093's stored `[]` = Active and its OR-union at the query layer survive)
**Superseded by:** None

## Context

"Active Contacts" was the default population but had no row in the Population menu; nothing selected meant a hidden population. With All Contacts on, tapping Favorites added to the selection and the list did not change. Taps on the Population, Filters and Sort controls were dropped while a write was pending (`if (pending) return`). Empty populations said "Nothing in {label}." and a filtered-to-nothing list said "Nothing here right now." The "Everyone's tucked away" state listed "N never contacted →" as plain text with no Unbound line. Phase 39's tutorial needs the Active row (39 D-95) and real tucked-away buttons (39 D-98).

## Decision

The Population menu shows a first "Active Contacts" row, selected when the stored value is `[]`; tapping it stores `[]`, so no `"active"` token, migration, backup or validator change exists (D-23). All Contacts and Active Contacts are exclusive: picking either clears the others, and picking any other population deselects All Contacts; Favorites, Birthdays, Never Contacted and Snoozed still combine (D-58, `nextPopulations`). Population, Filters and Sort writes apply optimistically on one serial write chain (`queueWrite`), show a spinner in the trigger after 250 ms, and restore the last committed value of that axis on failure; no tap is dropped (D-27). Hydrate publishes an axis only when that axis has no write pending and none succeeded since the read began. A list filtered to nothing shows the 38.9 `EmptyState` "No contacts match these filters" with Clear filters (D-28). Empty Birthdays, Never Contacted and Snoozed each say what that population is (D-30) and offer one action, "Show Active Contacts" (D-82). On "Everyone's tucked away", "N Never Contacted →" is a button that saves Population = Never Contacted with filters cleared, the same save the Digest drill makes, and "N Unbound →" opens Unbound Contacts (D-65).

## Alternatives Considered

- **An explicit stored `"active"` population token** — rejected (D-23); it ripples through parse/assert in `app-settings-dao.ts`, labels, `buildPopulationWhere`, counts and cross-version restore for no product gain.
- **Keep All Contacts additive and show a hint (X2)** — rejected (Q-04); the additive result is invisible and reads as broken.
- **Keep the tap-dropping pending guard** — rejected (D-27).

## Consequences

### Positive

- The default is visible and selectable; rapid taps all land (five rapid taps persisted on device).
- Every Contacts empty state follows the one-action EmptyState standard (ADR-199).

### Negative

- The store keeps per-axis committed values and a pending set; a failed combined Populations+Filters write voids both axes' restore.

### Risks

- `categories-dao.ts` writes `dashboard_filters` without the store; `committed.filters` can briefly hold a deleted category until the next focus reconcile (accepted, low).

## Implementation

**Key files:**
- `src/logic/dashboard-population-toggle.ts` — `nextPopulations`, `samePopulations`, the panel-only `"active"` key.
- `src/components/control-surface/PopulationPanelContent.tsx` — the Active Contacts row.
- `src/components/control-surface/DashboardControlRow.tsx` — no tap-dropping guard; `PENDING_INDICATOR_DELAY_MS` spinner.
- `src/stores/dashboard-query-store.ts` — `queueWrite` serial chain, `pendingAxes`, per-axis committed restore and hydrate seeding.
- `src/logic/dashboard-empty-copy.ts` — `filterEmptyCopy`, `populationEmptyCopy`, `SHOW_ACTIVE_CONTACTS_LABEL`, `tuckedAwayLines`.
- `src/screens/HomeScreen.tsx` — empty-state branches and the tucked-away buttons.

**Depends on:** ADR-092 (Durable Shared Dashboard Query State); ADR-093 (Scoped Composable Dashboard Population and Filter Model); ADR-095 (Live-Applying Dashboard Floating Control Surface); ADR-147 (Derived Digest Composition and Canonical Contacts Drill-Through); ADR-199 (App-Wide Destructive-Action, Feedback and Validation Standards, and One Empty State)
**Required by:** None
