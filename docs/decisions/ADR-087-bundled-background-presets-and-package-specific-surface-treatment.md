# ADR-087: Bundled Background Presets and Package-Specific Surface Treatment

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 23-theme-visual-system
**Source decisions:** dossier `phase-02-theme-visual-system` §§E–F, Q; CONTEXT D-04, D-06
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Orbit needs package-specific visual depth without sending appearance data over the network or sacrificing text readability. The original dashboard-only starfield boundary was owner-superseded: selected bundled backgrounds may sit behind text-heavy screens, provided content surfaces become appropriately opaque and failures degrade safely.

## Decision

The system ships a local, curated background-slot library with a None/Solid option, stable IDs, fixed-behind-scroll rendering, and a render-failure fallback to solid. Galaxy and Standard use one semantic surface API: Galaxy may use tinted glass with optional blur, while Standard stays flat; density tokens increase opacity for readable dense content, and declared per-asset brightness bounds are checked against composited foreground contrast.

## Alternatives Considered

- **User-uploaded, downloadable, or CDN backgrounds** — Rejected because this milestone ships only bundled local assets.
- **A dashboard/Orrery-only background scope** — Rejected because the owner-approved Phase 23 decision supersedes that earlier placement restriction.
- **Require blur on every device** — Rejected because blur is decorative and must fall back to a tinted token surface.
- **Let components invent tint and opacity values** — Rejected because the surface selector must return named token values only.

## Consequences

### Positive

- Appearance remains fully offline and the Galaxy/Standard distinction uses one component API.

### Negative

- Production screen mounting is deferred to renderer phases; Phase 23 validates the primitives with a dev-only preview harness.

### Risks

- Placeholder WebP backgrounds are constrained by declared brightest pixels; replacement artwork must remain within those bounds or be revalidated with its tint settings.

## Implementation

**Key files:**
- `src/theme/backgrounds.ts` — defines local background slots, defaults, lazy asset sources, and solid fallback resolution.
- `src/theme/tokens/surface.ts` — defines package-specific glass/flat treatment, density opacity, and token-only surface selection.
- `src/components/ui/BackgroundHost.tsx` — hosts the fixed selected background and render-failure fallback.
- `src/components/ui/GlassSurface.tsx` — applies the shared glass-or-flat surface API with graceful blur fallback.
- `src/components/ui/__dev__/ThemePreviewScreen.tsx` — provides the non-production primitive verification mount point.
- `assets/backgrounds/README.md` — records local asset provenance and declared brightness bounds.

**Depends on:** ADR-006 (Theme-Token Architecture)
**Required by:** _None._
