# ADR-188: Reticle Focus, Docked Card, Cluster Zoom-In, Tap-Only Focus, and Persistent-Chrome Framing

**Status:** Accepted
**Date:** 2026-10-05
**Phase:** 38.7-orrery-v2
**Source decisions:** D-18, D-19, D-20, D-21, D-22, D-23, D-35, D-39, D-55, D-60, D-62, D-78 (T-SCRIM, SD-FIX, T-DIM), D-79 (viewport; focus-card tap bug) (dossier `phase-38.7-orrery-v2-dossier.md`)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

**Focus.** In production, focus drew a solid outline. A tap on the focused person at name-visible zoom opened Profile, and a cluster tap framed the group without zooming in enough. The owner liked the lab reticle, Lab C's large centred framing, and Lab B's dimming and HUD chrome.

**Framing.** During the Plan 16 release pass, a dropdown, the cluster panel or a notice could shift the map's framing. A switch started from the open System panel played off to the side, then snapped back to centre.

## Decision

**Focus.** We will mark the focused person with the lab reticle, not a solid circle (D-18, owner restatement in D-74). Focus frames the person large and centred with the card docked below (Lab C), and may zoom past the old identity cap (D-19, D-47). Everyone else dims while someone is focused; the sun is not dimmed (D-21).

**Tap only focuses (D-60).** A tap on a body never opens Profile. A tap focuses that person, re-focuses on a different person, or keeps the current focus. Profile opens only from the focus card's Open Profile.

**Cluster tap.** A cluster tap at far zoom zooms in until the members separate. The Contacts here panel stays (D-19).

**HUD and title.** HUD panels and buttons get Lab B's corner-bracket chrome (D-22). The map runs up under the Orrery title behind Lab B's title scrim. Standard Dark takes the light themes' no-step bar edge (D-39, T-SCRIM, SD-FIX).

**Reorder hold.** It shows Lab B's charge arc and a projected orbit outline instead of the ghost ring. Hold time and haptic are unchanged (D-23).

**Cards and contrast.** Cards keep ADR-149's translucent glass unchanged; the Orrery gets no full scrim (D-20, D-35; this clarifies 38.5 D-12's wording). Card text meets 4.5:1 in all four themes. The lever is dimming what the canvas draws under the card toward the sky's occlusion ink, capped at 0.7, never changing card opacity (D-28, D-55, D-62). The full card-area dim at 0.7 ships (T-DIM).

**Framing from persistent chrome only (D-79, owner-directed).** "The canvas needs to stay in its place no matter what buttons are clicked or which dropdowns open." The map's framing comes only from persistent chrome. That framing covers the projection centre, Home, Recenter, focus and cluster framing. The chrome is the shell tab bar and FAB, a full-width band down to the title and the System / View triggers, and the camera controls column at rest. The System and View panels, the cluster panel, the focus card and every notice keep their own layout, the occlusion dim and the label exclusion, but never move the map. A cluster is framed in the area its open panel leaves uncovered. The Plan 13 switch viewport hold is removed, because nothing transient reaches the framing.

**Touch order.** The camera controls take touches only on their plates (root `box-none`). The focus card stacks at 13, above the controls (12) and below the title (20). A hidden card moves off-screen. This fixes the owner-found bug where focus-card buttons ignored taps.

## Alternatives Considered

- **Lab A's card-above-the-body placement.** Rejected by D-19.
- **Re-key "tap the focused person → Profile" to projected size.** This was the original D-47 bullet. Superseded by D-60: jumping straight to Profile was confusing, and always focusing first is consistent. This also supersedes phase-08 `:225-230`.
- **A full scrim behind Orrery cards, or raising card opacity.** Rejected by D-20, D-35 and D-55. It would hide the map.
- **Lab B's bodies-only occlusion.** The owner saw no difference from the full card-area dim. It stays selectable but unused (T-DIM).
- **Transient panels as framing obstacles.** This was dossier D-19's cluster panel and the system doc's rule that feedback is a framing exclusion. Reversed by the owner explicitly in D-79.
- **Lab C's reorder.** On the D-30 kill list.

## Consequences

### Positive

- The map never jumps when a panel or notice opens. A switch from the open panel plays centred.
- Focus behaviour is predictable: every tap focuses.

### Negative

- With a panel open, a cluster is framed into a smaller uncovered area, so it can sit off the true centre.

### Risks

- Any new floating Orrery surface must stay out of `framingViewport`. Adding one back as an obstacle would reintroduce the jump.

## Implementation

**Key files:**
- `src/components/orrery/orrery-obstacle-logic.ts` — `framingViewport` from persistent chrome only.
- `src/screens/OrreryScreen.tsx` — measured chrome, panels, focus card and switch wiring.
- `src/components/orrery/OrreryFocusContext.tsx` — docked focus card, zIndex 13, off-screen when hidden.
- `src/logic/orrery-focus-card-logic.ts` — card placement under the focused body.
- `src/logic/orrery-focus-logic.ts` — tap always focuses; Profile only from the card.
- `src/components/orrery/v2/focus-fx.ts` — reticle and focus dimming.
- `src/components/orrery/v2/occlusion-sources.ts` — card-area occlusion dim sources.
- `src/components/orrery/v2/draw-overlay.ts` — reticle, Polaris and reorder outline picture.
- `src/components/orrery/OrreryControls.tsx` — plate-only touch column (`box-none`).
- `src/components/orrery/OrreryHudCorners.tsx` — corner-bracket instrument chrome.
- `src/components/orrery/OrreryImmersiveHeader.tsx` — the map under the title.
- `src/components/orrery/orrery-header-scrim.ts` — title scrim and the Standard Dark no-step edge.
- `src/components/orrery/OrreryClusterPanel.tsx` — the cluster panel, no longer a framing obstacle.

**Depends on:** ADR-149 (Orrery-Specific Translucent Overlay Treatment and Icon Controls); ADR-169 (Standard-Light Glass Foreground Scope, Both-Extrema Contrast Proof, and Accent Role Contract); ADR-187 (Tilted Strategy-Map Home, Dolly Camera, One Projected Size, and Bodies on Their Rings)
**Required by:** None
