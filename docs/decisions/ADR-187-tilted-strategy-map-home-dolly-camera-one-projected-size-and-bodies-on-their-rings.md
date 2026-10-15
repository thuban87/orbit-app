# ADR-187: Tilted Strategy-Map Home, Dolly Camera, One Projected Size, and Bodies on Their Rings

**Status:** Accepted
**Date:** 2026-10-05
**Phase:** 38.7-orrery-v2
**Source decisions:** D-03, D-04, D-05, D-06, D-12, D-16, D-38, D-45, D-47, D-48, D-78 (T-HOME, T-NEAR, T-FADE, T-TINYZOOM) (dossier `phase-38.7-orrery-v2-dossier.md`)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-046 (partial — the read-time bounded drift push dies; query-time placement, dense `ring_seq` rank and the guarded reorder transaction survive)
**Superseded by:** None

## Context

Production Home was top-down (`HOME_CAMERA.tilt = 0`, `MAX_TILT` 60°). Its telephoto focal length flattened any tilt into a squash. Decay bodies were pushed up to 40 world units past their ring, and rogue bodies up to 80 (ADR-046 drift; HANDOFF §7 `:194`). The owner wanted the calm feel of a 3D strategy map on normal views (D-02), with bodies that read as worlds, not pins.

## Decision

**Home.** We will open the Orrery on a tilted strategy-map Home. Home is one tunable profile `{tilt, lensShift, fitRule}`: `HOME_PROFILES.tilted` is 62° with lens shift 0.62, and `flat` is 0° with a whole-disc fit. `ACTIVE_HOME_PROFILE` is `tilted`, and flat stays one word away (D-03, D-45, owner HOME-A in D-78). Max user tilt is a separate constant (`MAX_USER_TILT` 68°). Recenter restores every Home axis.

**Focal length.** It is a dolly: `DOLLY_FOCAL_PX` 720 divided by zoom. That is what makes the tilt read as depth.

**Size.** One `projectedBodyRadius` sets the drawn, tappable and label-gap size together. It combines a minimum on-screen size (D-16) with a near-side cap (D-06), loosened by the owner to knee 0.6 and asymptote 0.12 of the short side (T-NEAR). Lab B's visual-only floor is rejected (D-48).

**Fit and fade.** A tiny System opens zoomed in, up to `HOME_STRATEGY_MAX_ZOOM` 4. Packed rings fade to a floor of `RING_DENSITY_FLOOR` 0.8 (T-FADE, T-TINYZOOM).

**Bodies on their rings.** Every contact sits exactly on its ring. Ring colour and angular position carry status, and the drift push is removed everywhere it reached: hit candidates, labels, Home fit, moons, switch radii and reorder (D-12). There is no progress wake or tether (D-38).

**Gestures.** One finger pans, with a small perceptible coast (D-04, D-05).

**Semantic tiers.** Label tiers follow on-screen (projected) size, not camera zoom (D-47).

This also records three supersessions outside the ADR set:
- the phase-08 dossier's top-down Home (`:68`, `:300-306`) and 29-UI-SPEC `:106`;
- HANDOFF `:194`'s outward drift;
- HANDOFF `:196`'s "elliptical orbits wider than the viewport", which circular rings plus the camera had already replaced in practice.

## Alternatives Considered

- **Keep a top-down Home.** Rejected by D-03. The owner compared 62° and flat screenshots side by side and kept 62° (HOME-A), but asked that flat stay easy to switch back to.
- **Lab C's one-finger orbit with a two-finger pan.** Rejected by D-04 and the D-30 kill list.
- **The original near cap (knee 0.06, asymptote 0.08).** Loosened by T-NEAR: near planets read too small.
- **A 15 % ring-fade floor.** Rejected by T-FADE as far too strong.
- **Keep drift as a status cue.** Rejected by D-12. Rogue now reads from the cold, desaturated, glow-less body (ADR-190), with the ring's dash, fade and trace styles kept as the non-colour cue.

## Consequences

### Positive

- The tilt reads as depth. Taps, labels and framing agree with the drawn size because there is one size function.
- Reorder no longer has to subtract drift (it collapses to 0). The `drawnRadius` and `driftPush` helpers were removed.

### Negative

- A steep tilt packs rings vertically. That produces more stack pips and more label conflicts on the near and far sides. At the far rim, a one-finger pan moves about 2.1× more ground per point, so the pan mapping is tuned for it.

### Risks

- Every `frameBodies`, `unproject` and Home-fit caller needs tests at 0°, 45° and 62°, so that flat Home does not silently break.

## Implementation

**Key files:**
- `src/logic/orrery-camera-logic.ts` — `HOME_PROFILES`, `ACTIVE_HOME_PROFILE`, `MAX_USER_TILT`, dolly focal, `projectedBodyRadius`, horizon culling.
- `src/logic/orrery-world-logic.ts` — bodies exactly on `ringRadius`; drift push removed.
- `src/logic/orrery-geometry-logic.ts` — legacy drift helpers removed.
- `src/logic/orrery-reorder-logic.ts` — reorder without drift subtraction.
- `src/logic/orrery-frame.ts` — one projected frame for draw, hit, labels.
- `src/logic/orrery-recovery-logic.ts` — Home recovery and the pan coast.
- `src/logic/orrery-label-logic.ts` — projected-size semantic tiers.
- `src/logic/orrery-gesture-logic.ts` — pure one-finger pan semantics.
- `src/components/orrery/use-orrery-camera.ts` — gesture builders over the pure logic.

**Depends on:** ADR-046 (Query-Time Orrery Placement and Transactional Ring Ordering); ADR-077 (Single Canonical Orrery with a Constrained Inspection Camera)
**Required by:** ADR-188 (Reticle Focus, Docked Card, Cluster Zoom-In, Tap-Only Focus, and Persistent-Chrome Framing); ADR-190 (Lit Status Bodies, Star Sun, Moon Bumps, Stack Pips, and Hermes-Safe Initials)
