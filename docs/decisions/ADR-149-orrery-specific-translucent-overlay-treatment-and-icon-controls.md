# ADR-149: Orrery-Specific Translucent Overlay Treatment and Icon Controls

**Status:** Accepted
**Date:** 2026-09-19
**Phase:** 38.1-profile-presentation-polish
**Source decisions:** dossier §B–C; D-04 from phase CONTEXT.md
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Ordinary card opacity is intentionally mode-aware under ADR-115, but the Orrery is a controlled canvas where near-transparent Galaxy cards made floating controls hard to read. The product requires readable overlays that still visibly reveal the Orrery and compact icon-only navigation controls without creating a parallel surface family.

## Decision

The system uses an opt-in, package-specific `orrery-overlay` treatment on the existing `GlassSurface`: Galaxy resolves at 0.91 and Standard at 0.87, both below the 0.92 visibility ceiling and AA-proven against the brightest raw Orrery star. Applicable floating Orrery surfaces use this treatment, while Contacts, Recenter, and Center North render as independent, 44px, icon-only controls with explicit accessible names.

## Alternatives Considered

- **Reuse ordinary mode-aware card opacity** — Rejected because a controlled Orrery canvas needs legibility independent of wallpaper/mode matching.
- **Opaque Orrery cards** — Rejected because overlays must continue to reveal the visualization beneath them.
- **A parallel Orrery surface component family** — Rejected because semantic variants belong on `GlassSurface`.

## Consequences

### Positive

- Overlay readability is independently tokenized and mechanically contrast-tested without changing ordinary card constants.

### Negative

- New floating Orrery controls must explicitly opt into the semantic treatment.

### Risks

- Unit contrast proof does not replace physical-device perception and touch-target verification.

## Implementation

**Key files:**
- `src/theme/tokens/surface.ts` — resolves the named overlay tint and visibility ceiling.
- `src/theme/tokens/surface.test.ts` — proves contrast, translucency, and ordinary-card preservation.
- `src/components/ui/GlassSurface.tsx` — exposes the opt-in semantic treatment.
- `src/components/orrery/OrreryControls.tsx` — renders the three accessible square controls.
- `src/components/orrery/OrrerySystemSelector.tsx` — applies the overlay treatment to selector surfaces.
- `src/components/orrery/OrreryClusterPanel.tsx` — applies the overlay treatment to cluster context.
- `src/components/orrery/OrreryFocusContext.tsx` — applies the overlay treatment to focused-contact context.
- `src/components/orrery/OrreryViewOptions.tsx` — applies the overlay treatment to view options.

**Depends on:** ADR-115 (Visible Mode-Aware Background Surface Composition)
**Required by:** None
