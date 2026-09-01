# ADR-042: Shared Status Palette for Dashboard and Widget Rings

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 12-home-screen-widget
**Source decisions:** dossier `12-widget.md` Cluster A; 12-CONTEXT “Status Colour Palette”
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The dashboard had an opacity-only relationship-status cue, while the home-screen widget needs a visible status ring in a headless bitmap renderer. Both surfaces must convey the same derived status without introducing locally chosen colours or storing status.

## Decision

The system uses shared `statusStable`, `statusWobble`, `statusDecay`, and existing `rogue` theme tokens for dashboard and widget status rings. The widget resolves the space-dark palette directly in its headless renderer; the dashboard resolves the same tokens through its theme provider.

## Alternatives Considered

- **Opacity-only status cue** — rejected because it does not make the full status palette glanceable on the widget.
- **Widget-local colour literals** — rejected because they would break the app-wide token contract and diverge from the dashboard.
- **Plain grid with no status** — rejected because it removes the product's glanceable decay signal.
- **Binary due badge** — rejected because the owner chose the full status palette.

## Consequences

### Positive

- Status colour and escalating ring weight remain consistent across foreground and headless surfaces.

### Negative

- Every future palette adds or changes status colours through the shared token contract.

### Risks

- A headless renderer cannot use `useTheme()`; it must resolve tokens from the preset module without hardcoded fallback colours.

## Implementation

**Key files:**
- `src/theme/theme-types.ts` — declares the shared stable, wobble, and decay token contract.
- `src/theme/theme-presets.ts` — seeds the owner-approved status colours in the sole palette-literal file.
- `src/components/contact-card-ring.ts` — maps derived status to the dashboard ring visual.
- `src/components/ContactCard.tsx` — applies the shared ring visual to dashboard cards.
- `src/services/widget/widget-colors.ts` — resolves the same tokens for headless widget rendering.

**Depends on:** ADR-006 (Theme-Token Architecture); ADR-011 (Query-Time Status and Never-Contacted Segregation)
**Required by:** None
