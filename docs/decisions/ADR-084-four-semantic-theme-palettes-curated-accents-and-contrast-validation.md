# ADR-084: Four Semantic Theme Palettes, Curated Accents, and Contrast Validation

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 23-theme-visual-system
**Source decisions:** dossier `phase-02-theme-visual-system` §§B–C, Q; CONTEXT D-06
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The finished visual system needs distinct Galaxy and Standard identities in both light and dark modes without changing layout or information architecture. A configurable accent must remain distinct from the owner/star colour and meet contrast requirements when used as a fill, foreground, or text link.

## Decision

The system resolves four complete semantic palettes: Galaxy and Standard, each in light and dark mode. Accents are a curated, fixed ID set whose mode-specific `{ fill, onAccent, text }` tones overlay the active palette; `onDanger` is a distinct destructive foreground. A pure WCAG gate hard-fails new palette and curated-accent violations while reporting, rather than retuning, protected legacy Galaxy Dark hues for an owner decision.

## Alternatives Considered

- **One palette hex per accent** — Rejected because it cannot reliably meet text and on-fill contrast requirements across light and dark modes.
- **An unrestricted user-entered accent picker** — Rejected because only a curated accessible palette is in scope.
- **Auto-retune legacy owner-approved Galaxy Dark hues** — Rejected because changing those visual values is an owner decision.
- **Continue treating light as a dark-palette fallback** — Rejected because each package needs an authored light palette.

## Consequences

### Positive

- Theme switching preserves one functional component system while producing distinct Galaxy and Standard identities.
- Token consumers receive a named destructive foreground and mode-appropriate accent text tone.

### Negative

- Every curated accent requires validation across all supported palette combinations.

### Risks

- Galaxy Dark `onDanger` on `danger` and `danger` text on `surfaceElevated` were measured below AA-normal and remain owner-flagged rather than silently altered.

## Implementation

**Key files:**
- `src/theme/theme-types.ts` — defines required light palettes, semantic palette tokens, and theme/accent types.
- `src/theme/theme-presets.ts` — supplies the four authored Galaxy/Standard light/dark palettes.
- `src/theme/accents.ts` — maps curated accent IDs to mode-specific fill, foreground, and text tones.
- `src/theme/contrast.ts` — provides pure luminance, contrast-ratio, and AA-threshold checks.
- `src/theme/theme-provider.tsx` — overlays the active package's resolved accent tones at render time.
- `src/screens/SettingsScreen.tsx` — offers live package, appearance-mode, and accent controls for existing consumers.

**Depends on:** ADR-083 (Durable Multi-Package Theme Configuration and Restore-Before-Paint)
**Required by:** _None._
