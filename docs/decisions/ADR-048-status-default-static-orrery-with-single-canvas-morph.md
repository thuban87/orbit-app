# ADR-048: Status-Default Static Orrery with a Single-Canvas Morph

**Status:** Accepted
**Date:** 2026-08-17
**Phase:** 13-orrery
**Source decisions:** dossier `09-orrery` Clusters A, B, E, and H; 13-CONTEXT; plans 05 and 07
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-077 (partial — dual view/morph)

## Context

Orbit needs a glanceable relationship view without replacing the dashboard as the daily work surface. The visual must make due contacts legible while avoiding an imperceptible continuous body loop, expensive background animation, or a separate navigation destination for each view.

## Decision

The system opens a status-default orrery and morphs it on one Skia canvas into a calm relationship view. Both views retain the same `ring_seq` radius; only angle and colour treatment change. Contact bodies are timestamp-placed on focus and remain static, while the subtle starfield and sun pulse are the sole ambient animation and unmount on blur or background.

## Alternatives Considered

- **Relationship view as the default or only view** — Rejected because the first glance should answer who needs attention and would otherwise remove the owner's relationship map.
- **A different radius meaning in each view** — Rejected because radius must consistently mean closeness.
- **A live creeping body loop with tap-to-freeze** — Rejected because movement is imperceptible at the intended cadence and wastes battery; static bodies make freeze unnecessary.
- **Two screens or a swipe gesture** — Rejected because a one-canvas toggle preserves the intentional morph without competing with planet interaction.

## Consequences

### Positive

- The canvas is a direct launcher: a planet opens its profile, while radial drag remains available for ring ordering.
- Skia hooks stay isolated in keyed body components and the ambient clock has one unmountable owner.

### Negative

- Render, photo decode, gesture feel, and power claims require physical-device verification.

### Risks

- Hiding a running clock requires unmounting its canvas subtree; merely gating derived values leaves the ambient loop alive.

## Implementation

**Key files:**
- `src/screens/OrreryScreen.tsx` — loads the view, owns the status/relationship toggle, and gates the canvas lifecycle.
- `src/components/orrery/OrreryCanvas.tsx` — renders the single Skia canvas and owns the ambient clock.
- `src/components/orrery/OrbitBody.tsx` — draws a keyed planet and interpolates the morph without changing radius.
- `src/components/orrery/SunBody.tsx` — draws the themed central sun and consumes the ambient pulse.
- `src/components/SegmentedControl.tsx` — provides the controlled Status / Relationship selector.
- `src/navigation/RootNavigator.tsx` — registers the additive Orrery route.
- `src/screens/HomeScreen.tsx` — provides the dashboard Orbit entry point.

**Depends on:** ADR-046 (Query-Time Orrery Placement and Transactional Ring Ordering); ADR-047 (App-Level Assignable Sun and Themed Self Identity).
**Required by:** _None._
