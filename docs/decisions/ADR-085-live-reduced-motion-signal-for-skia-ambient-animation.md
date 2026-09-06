# ADR-085: Live Reduced-Motion Signal for Skia Ambient Animation

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 23-theme-visual-system
**Source decisions:** dossier `phase-02-theme-visual-system` §§G, R; CONTEXT D-05, D-07
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Galaxy ambience and the Orrery's decorative clock need to honor a live OS reduced-motion change. A React-state value or Reanimated's boot-time-only reduced-motion hook cannot safely control Skia worklets without either missing an in-session update or re-rendering the tree per frame.

## Decision

The system subscribes to `AccessibilityInfo` and exposes the result both as a React boolean and a Reanimated shared value. Skia ambient consumers read the shared value inside derived worklets and collapse their motion to a constant when reduction is enabled; both the Orrery canvas twinkle/drift and sun pulse are gated.

## Alternatives Considered

- **Drive Skia motion from React state** — Rejected because per-frame state updates re-render the JS tree.
- **Use Reanimated's boot-time-only reduced-motion hook** — Rejected because it does not react to a live OS preference change.
- **Gate only the canvas starfield** — Rejected because the sun pulse is an independent ambient-clock consumer.

## Consequences

### Positive

- Motion responds live without a restart while retaining a simple React-tree boolean for non-Skia consumers.

### Negative

- Every future Skia ambient-clock consumer must explicitly read the shared reduced-motion signal.

### Risks

- A controller must remove its accessibility listener and ignore a late seed resolution after unmount.

## Implementation

**Key files:**
- `src/theme/use-reduced-motion.ts` — owns the injected controller plus React and shared-value hook wrappers.
- `src/theme/tokens/motion.ts` — names tunable motion durations, ambient speed, and easing descriptors.
- `src/components/orrery/OrreryCanvas.tsx` — gates canvas twinkle and drift inside its derived-value loop.
- `src/components/orrery/SunBody.tsx` — gates the shared-clock sun glow pulse inside its derived-value loop.

**Depends on:** ADR-077 (Single Canonical Orrery with a Constrained Inspection Camera)
**Required by:** _None._
