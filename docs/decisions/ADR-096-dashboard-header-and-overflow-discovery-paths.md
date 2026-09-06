# ADR-096: Dashboard Header and Overflow Discovery Paths

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 26-dashboard-control-surface
**Source decisions:** dossier `phase-05-dashboard-control-surface` §§B, M–O; Group Events amendment; 26-CONTEXT D-04–D-10
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The four-tab shell made Dashboard the contact-browser root while several low-frequency destinations still needed clear, non-duplicated entry paths. The dossier also amended the header to make Group Events co-equal with Your Week, retired Dashboard favourite management, and reserved bulk selection for the later Card view capability.

## Decision

The Dashboard header exposes Your Week and Group Events as co-equal semantic-icon destinations, falling back together to icon-only labels when the measured app bar cannot fit both. Its fixed overflow contains Group Events, Unbound Contacts, Archived Contacts, disabled Select Contacts, and Reset Dashboard View. Archived remains reachable from both Dashboard and Settings through one screen, while Archived and Unbound use the shared child app bar and their originating stack determines Back behavior; Select Contacts remains visibly disabled until its Card-view workflow exists.

## Alternatives Considered

- **Put Your Week or Group Events only in overflow** — lower-frequency navigation. Rejected because both are first-class Dashboard discoveries.
- **Add a permanent Group Events Dashboard module** — show event content between controls and contacts. Rejected because Dashboard remains lean and contact-content-first.
- **Keep Manage Favorites in overflow** — preserve the former management path. Rejected because favourites are binary membership without a user-facing order.
- **Enable Select Contacts immediately** — expose a future bulk route. Rejected because its bulk mutations are not yet available.

## Consequences

### Positive

- Header and overflow routes remain discoverable without adding permanent Dashboard content.
- Measured label fallback preserves text scale and control-row position.
- Archived contacts have consistent route chrome without changing the archive-before-purge gate.

### Negative

- Group Events intentionally has redundant header and overflow entries.
- Select Contacts appears before it is actionable and needs an explicit disabled state.

### Risks

- Header labels must never wrap or shrink to fit; the app bar must fail closed to icon-only until it can measure safe label fit.
- Refactoring Archived chrome must not alter its restore or destructive purge lifecycle.

## Implementation

**Key files:**
- `src/components/ShellAppBar.tsx` — measures app-bar space and renders compact-aware root or child chrome.
- `src/components/OverflowMenu.tsx` — renders disabled menu rows as non-actions with accessible disabled state.
- `src/screens/dashboard-overflow-actions.ts` — defines the fixed five-row Dashboard overflow contract.
- `src/screens/HomeScreen.tsx` — supplies header destinations, reset handling, and overflow actions.
- `src/screens/ArchivedContactsScreen.tsx` — presents the existing archive lifecycle behind shared child chrome and profile navigation.
- `src/screens/UnboundContactsScreen.tsx` — presents the Unbound child route behind shared chrome.
- `src/navigation/tabs/DashboardStack.tsx` — registers Dashboard child destinations.
- `src/navigation/tabs/SettingsStack.tsx` — preserves the Settings entry to the same Archived and Profile screens.

**Depends on:** ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out); ADR-075 (Binary Favourite Membership Without a User-Facing Order); ADR-076 (Population-Reached Birthdays Without a Dashboard Banner); ADR-080 (Four-Tab Bottom Navigation Shell with Per-Tab Stacks)
**Required by:** ADR-102 (Frozen-Universe Dashboard Multi-Select)
