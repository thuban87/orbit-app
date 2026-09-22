# ADR-115: Visible Mode-Aware Background Surface Composition

**Status:** Accepted
**Date:** 2026-09-10
**Phase:** 31.1-app-wide-system-backgrounds
**Source decisions:** D-31.1-05-A; owner-approved 31.1-06 corrective enhancement
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-087 (partial — host/card opacity coupling, Standard flat-only treatment, and Android translucent-card elevation)
**Superseded by:** None

## Context

The first production adoption technically mounted and persisted backgrounds but then covered them with card-density host scrims, leaving only 0–12% of the art and making selections look identical. Lowering only the host veil still left opaque cards across most of each screen, and Android elevation produced an opaque inner rectangle on translucent Galaxy cards.

## Decision

The system uses independent tokenized layers for background visibility and content readability: `BackgroundHost` applies a light density-aware veil, bare chrome receives a local `ChromeScrim`, and cards become glassy only when the package artwork tone matches the resolved appearance mode. Mismatched package/mode combinations keep opaque cards, and Android elevation is omitted from translucent Galaxy cards while the iOS shadow remains.

## Alternatives Considered

- **Keep card opacity as the host veil** — Preserve the original shared density value. Rejected because it made every selected background imperceptible on ordinary screens.
- **Globally retune all surface opacity** — Lower the existing card and host values together. Rejected because card-level AA proofs were already sound and should not be weakened to repair the host layer.
- **Full glass redesign** — Rework all surfaces and controls at once. Rejected in favor of the bounded owner-approved “lighten wash + protect chrome” correction.
- **Always-translucent cards** — Reveal art in every package/mode combination. Rejected because mismatched artwork and mode tones need opaque cards for predictable readability.
- **Retain Android elevation on translucent cards** — Keep the Galaxy glow implementation unchanged. Rejected because Android renders it as an opaque two-layer artifact; iOS shadow remains available.

## Consequences

### Positive

- Background choices remain visibly distinct while card and chrome contrast stays independently testable.
- Matching Galaxy-dark and Standard-light combinations show art through content without sacrificing mismatched-mode readability.

### Negative

- Surface treatment now depends on package, resolved mode, and density rather than package and density alone.
- Android and iOS intentionally differ in translucent-card shadow treatment.

### Risks

- Static screenshots can produce a false positive; acceptance must compare materially different selected assets on the same physical-device route.
- New bare-on-background chrome can miss contrast unless it adopts the shared chrome backing and per-asset AA checks.

## Implementation

**Key files:**
- `src/theme/tokens/surface.ts` — owns independent veil, chrome, matched-mode glass, and mismatched-mode opaque values.
- `src/theme/tokens/surface.test.ts` — guards minimum art contribution and per-asset text contrast across all regimes.
- `src/components/ui/BackgroundHost.tsx` — consumes only the background veil for the shell layer.
- `src/components/ui/GlassSurface.tsx` — consumes mode-aware card tint and omits Android elevation on translucent Galaxy cards.
- `src/components/ui/ChromeScrim.tsx` — backs text and controls drawn directly over the background.
- `src/components/ShellAppBar.tsx` — applies protected chrome across ordinary shell routes.
- `src/screens/HomeScreen.tsx` — applies protected count and empty-state chrome on the primary presentation route.

**Depends on:** ADR-114 (Route-Aware App-Wide System Background Composition)
**Required by:** ADR-149 (Orrery-Specific Translucent Overlay Treatment and Icon Controls)
