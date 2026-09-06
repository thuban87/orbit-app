# ADR-095: Live-Applying Dashboard Floating Control Surface

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 26-dashboard-control-surface
**Source decisions:** dossier `phase-05-dashboard-control-surface` §§C–G, P–Q; 26-CONTEXT D-11; owner UAT placement resolution
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The Dashboard gained durable population, filter, sort, and view state in Phase 25, but needed a compact working surface that applied those axes without combining them into a new route or weakening the visible result context. The control presentation also needed to remain replaceable by a future branded HUD without duplicating query or persistence behavior.

## Decision

The system uses three separate, live-applying Dashboard controls—Population, Filters, and Sort—whose presentation-only option content is hosted by one in-tree floating control surface. One panel is open at a time; its backdrop leaves results visible but interaction- and accessibility-inert, and the shell’s transient-first Back behavior dismisses it before route navigation. The current owner-approved presentation centers the floating panel on screen; it remains neither a native modal nor a bottom sheet, and its option-content and query layers remain independent of the presentation container.

## Alternatives Considered

- **Combined Manage View surface** — one control for all query axes. Rejected because the axes need separate summaries and direct manipulation.
- **Full-screen modal or bottom sheet** — reuse a standard overlay surface. Rejected because it hides the live result change and breaks the intended floating interaction.
- **Three unrelated popovers** — implement each control independently. Rejected because it duplicates dismissal, accessibility, motion, and future-HUD migration behavior.
- **Build the branded HUD now** — replace the initial floating surface immediately. Rejected because it adds design and animation work without changing query behavior.

## Consequences

### Positive

- Current Dashboard state remains visible while a user changes it.
- A future HUD can replace only the presentation container.
- Shared dismissal, focus, and reduced-motion behavior prevent per-control drift.

### Negative

- The in-tree overlay must explicitly manage backdrop touch handling and accessibility isolation.
- Option content must use the control owner’s intent callbacks instead of directly writing settings.

### Risks

- A panel that clips long content makes filter options unreachable; the floating surface caps its height and scrolls its content.
- Re-registering transient or accessibility focus during an in-panel update can disrupt TalkBack focus, so registration is tied to visibility rather than refreshed content.

## Implementation

**Key files:**
- `src/components/control-surface/AnchoredPanel.tsx` — renders the centered floating surface, scrim, scrolling cap, focus transfer, transient registration, and reduced-motion-aware animation.
- `src/components/control-surface/DashboardOverlayHost.tsx` — owns the root-level in-tree panel request and presentation host.
- `src/components/control-surface/DashboardControlRow.tsx` — measures and opens the three controls, derives current-state mutations, and persists them through the query store.
- `src/components/control-surface/PopulationPanelContent.tsx` — renders intent-only population choices.
- `src/components/control-surface/FilterPanelContent.tsx` — renders intent-only filter-family choices and the clear action.
- `src/components/control-surface/SortPanelContent.tsx` — renders intent-only sort choices including Default.
- `src/screens/HomeScreen.tsx` — hosts the control row, root overlay, and inert Dashboard regions.
- `src/stores/dashboard-query-store.ts` — hydrates and persists the durable query axes with stale-hydration protection.

**Depends on:** ADR-092 (Durable Shared Dashboard Query State); ADR-093 (Scoped Composable Dashboard Population and Filter Model)
**Required by:** None
