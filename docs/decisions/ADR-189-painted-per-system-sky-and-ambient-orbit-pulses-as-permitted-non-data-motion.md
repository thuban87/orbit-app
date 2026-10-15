# ADR-189: Painted Per-System Sky and Ambient Orbit Pulses as Permitted Non-Data Motion

**Status:** Accepted
**Date:** 2026-10-05
**Phase:** 38.7-orrery-v2
**Source decisions:** D-02, D-07, D-08, D-09, D-10, D-11, D-25, D-26, D-27, D-28, D-36, D-37, D-50, D-51, D-67, D-68, D-69, D-75, D-78 (T-LIGHT, T-GLIGHT, T-DISTINCT), D-81 (dossier `phase-38.7-orrery-v2-dossier.md`)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-077 (partial — "the subtle starfield and sun pulse remain the sole ambient animation" dies; one unmountable ambient owner that unmounts on blur or background survives); ADR-048 (partial — the same "sole ambient animation" clause); ADR-179 (partial — "The Orrery keeps its solid background" dies for the in-canvas sky; BackgroundHost art on the Orrery route stays `none` and the rest of ADR-179 stands)
**Superseded by:** None

## Context

**Before.** The Orrery drew a solid fill with 44 twinkling stars. ADR-077 and ADR-048 made the starfield and sun pulse the sole ambient animation, following HANDOFF §7: "Motion encodes data, not mood". ADR-179 (38.5 D-54) kept the Orrery's background solid.

**What the owner wanted.** A blend: cinematic during transitions, and a calm star chart on normal views (D-02). He wanted Lab B's sky and thin sun-lit rings, and Lab B's orbit light pulses.

## Decision

**The sky.** We will paint the sky inside the canvas. Stars, a quiet baked nebula and a gradient replace the solid fill (D-07). BackgroundHost art on the Orrery route stays `none` (ADR-114). Owner tuning:
- Standard Dark keeps Lab B's graphite sky; Standard Light keeps Lab B's light treatment (T-LIGHT).
- Galaxy Dark's nebula is 35 % of Lab B's (D-75).
- Galaxy Light uses Galaxy Dark's nebula hues at 1.25× Lab B's light strength (T-GLIGHT).
- Standard and Galaxy look distinct (D-27, T-DISTINCT).

**Sky motion.** The sky barely drifts and shifts slightly with the camera (parallax). It is fully still under reduced motion (D-36).

**Per-System tint.** Each System gets a sky tint derived from `systemRefId` (FNV-1a over 12 or more theme hues). There is no schema change, and a duplicated System gets a new hue (D-08, D-50). All Contacts stays untinted (D-69). The tint is applied at draw time, so no bake happens on a System change. Galaxy Dark ships at `tintStrength` 0.35 / `tintWash` 0.05 (D-81).

**Rings and grid.** Orbits are Lab B's thin, sun-lit lines. Status colours and the solid/dashed/faded ladder stay as non-colour cues (D-11). An optional Lab C orbital-plane grid is on but weaker: opacity 0.15, 1.0 dp, 9 circles and 24 spokes. It is tunable to off (D-09, D-67).

**Orbit pulses, a deliberate exception to "motion encodes data".** Lab B's light pulses travel along the orbits with the full Lab B look: intensity 0.55, budget 40, a 12 s cycle (D-10, D-68). D-68 supersedes D-10's "not very obvious" wording. The pulses carry no data, are identical for every status, run on the single ambient clock (ADR-186) and stop under reduced motion.

**Idle motion budget.** Information-layer idle motion is only twinkle, the sun pulse and the orbit pulses. Sky drift is separate environmental motion on the same clock (D-37).

**No camera effects.** No bloom, tilt-shift, lens flare or heat-haze (D-25).

**Colour.** Every Orrery colour is an authored `orrery*` token in all four palettes, including SkSL uniforms (D-51). Blending is keyed from the theme mode, never from luminance: additive or screen in dark themes, src-over with ink tokens in light ones.

## Alternatives Considered

- **Keep the solid background.** This was ADR-179's rule. Superseded by the owner in D-07.
- **Lab A's sky, or Lab B's busy sky.** Lab A had too few stars; Lab B was "too busy" (D-07).
- **The soft-haze nebula.** Rejected outright: "I never wanted that" (D-75).
- **Nebula at 25 % or 15 % (Galaxy Dark); Galaxy Light at 1× or 2.5×, or the "lab-b" or "warm-violet" flavours.** Not chosen (D-75, T-GLIGHT).
- **Lab B's six hue buckets.** Too many collisions; 12 or more are used (D-50).
- **A user-pickable hue.** Out of scope. It would need migration 033 and a backup decision.
- **Lab B's gravity-well grid.** Rejected (D-09, D-30). **Lab C's full-strength grid:** the owner chose "weaker" (D-67).
- **"Not very obvious" pulses.** Replaced by the full Lab B look (D-68).

## Consequences

### Positive

- The Orrery reads as a polished star map. Each System is identifiable by its tint, and the tint costs no rebake on a switch.

### Negative

- It breaks HANDOFF §7's "motion encodes data, not mood" for the pulses and the sky drift. This is a recorded exception.
- Pulses at budget 40, the lit shader and the sky are the main suspects in the high idle CPU with animations on (D-80 CPU-1 todo).

### Risks

- `orrerySystemHues` is order-stable. Reordering the hues re-tints every System.

## Implementation

**Key files:**
- `src/logic/orrery-sky-logic.ts` — `systemSkyHueIndex`, seeded star field, parallax and drift.
- `src/components/orrery/v2/draw-sky.ts` — the sky picture and draw-time System tint.
- `src/components/orrery/v2/nebula-bake.ts` — CPU nebula bake per package, mode and size bucket.
- `src/components/orrery/v2/visual-tunables.ts` — `SKY_LOOKS`, grid and pulse tunables.
- `src/components/orrery/v2/draw-plane.ts` — rings, sun-lit rim term, grid and pulses.
- `src/components/orrery/v2/shaders.ts` — SkSL sky, ring and pulse terms.
- `src/components/orrery/v2/ambient-clock.ts` — the shared ambient clock the pulses and drift read.
- `src/components/orrery/v2/first-frame.ts` — the sky-coloured first frame.
- `src/theme/theme-types.ts` — the `orrery*` sub-palette.
- `src/theme/theme-presets.ts` — `orrery*` values for all four palettes.
- `src/theme/accents.ts` — reticle and instrument tokens follow the accent.

**Depends on:** ADR-186 (Orrery V2 Imperative Picture Renderer Behind a Platform Render Host); ADR-085 (Live Reduced-Motion Signal for Skia Ambient Animation); ADR-114 (Route-Aware App-Wide System Background Composition)
**Required by:** None
