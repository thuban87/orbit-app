# ADR-086: Semantic Icons and Accessible Interaction Primitives

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 23-theme-visual-system
**Source decisions:** dossier `phase-02-theme-visual-system` §§H–M, O–P
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit needs shared typography, icon, status, button, and overlay seams before renderer phases rebuild individual screens. Icons had ad-hoc tab glyphs, status was color-and-ring-weight only, and destructive affordances needed a reusable non-colour confirmation contract.

## Decision

The system uses semantic typography roles, a swappable icon registry, and one shared status-glyph source with six distinct silhouettes. Shared Button, Modal, Sheet, and ConfirmDialog primitives resolve through tokens; icon-only controls require labels and 44px targets, while destructive controls pair `danger` with a warning glyph and an explicit, non-dismissable destructive confirmation.

## Alternatives Considered

- **Build a full custom Orbit icon family now** — Rejected because only the registry seam is required this milestone.
- **Let screens import third-party icon names directly** — Rejected because it prevents a localized future icon-family swap.
- **Represent status with color alone** — Rejected because status must remain understandable without color.
- **Allow Back or scrim taps to dismiss destructive confirmation** — Rejected because an irreversible action requires an explicit choice.

## Consequences

### Positive

- Renderer phases share tokenized, accessible primitives instead of creating parallel icon and overlay implementations.

### Negative

- Existing screen adoption remains intentionally deferred; the primitives do not retrofit every legacy surface.

### Risks

- Semantic `role` props require documented lint accommodations where they overlap with ARIA-role checks.

## Implementation

**Key files:**
- `src/theme/fonts.ts` — loads bundled app fonts non-fatally before the main UI paint.
- `src/components/ui/AppText.tsx` — renders semantic typography roles while preserving OS text scaling.
- `src/components/icons/icon-registry.ts` — maps semantic identities to replaceable outline/filled base-family glyphs.
- `src/components/icons/Icon.tsx` — resolves registry glyph tone and size through theme tokens.
- `src/components/contact-card-ring.ts` — owns the shared status-display union and pure glyph mapping beside ring visuals.
- `src/components/icons/StatusGlyph.tsx` — renders token-colored, accessible status silhouettes.
- `src/components/ui/Button.tsx` — provides the five-role action hierarchy and destructive warning treatment.
- `src/components/ui/overlay-base.tsx` — centralizes scrim, Back, focus, and dismissability behavior for overlays.

**Depends on:** ADR-006 (Theme-Token Architecture)
**Required by:** ADR-101 (Avatar-First Accessible Dashboard Card Renderer)
