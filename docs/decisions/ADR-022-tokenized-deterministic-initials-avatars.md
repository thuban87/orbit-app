# ADR-022: Tokenized Deterministic Initials Avatars

**Status:** Accepted
**Date:** 2026-08-15
**Phase:** 05-photos
**Source decisions:** dossier `07-photos` Cluster C
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Photo-less contacts need a stable, glanceable fallback. The plugin's free-HSL name hash conflicts with Orbit's rule that every color, including Skia colors, resolves through a theme token.

## Decision

The system derives initials and a deterministic swatch index from the name, then resolves that index through themed `avatarSwatches` and `avatarSwatchText` tokens. A missing or failed local image falls back to this avatar; an empty name renders a blank neutral swatch.

## Alternatives Considered

- **Free-HSL name hash** — rejected because it is an unthemed color carve-out that cannot restyle on theme change.
- **One neutral fallback color** — rejected because photo-less contacts lose glanceable differentiation.

## Consequences

### Positive

- Fallback avatars stay stable across surfaces and obey the existing theme contract.

### Negative

- The finite swatch palette has less variety than an unconstrained hue calculation.

### Risks

- Replacing a stable local filename must invalidate image caching so the old decode is not displayed.

## Implementation

**Key files:**
- `src/theme/theme-types.ts` — declares avatar swatch and foreground token contracts.
- `src/theme/theme-presets.ts` — supplies the finite palette values.
- `src/components/avatar-initials.ts` — derives initials and a swatch index without producing a color.
- `src/components/Avatar.tsx` — renders the local image or tokenized initials fallback.
- `src/stores/photo-cache-bust-store.ts` — changes the cache discriminator after a photo write.

**Depends on:** ADR-006 (Theme-Token Architecture)
**Required by:** _None._
