# ADR-190: Lit Status Bodies, Star Sun, Moon Bumps, Stack Pips, and Hermes-Safe Initials

**Status:** Accepted
**Date:** 2026-10-05
**Phase:** 38.7-orrery-v2
**Source decisions:** D-13, D-14, D-15, D-16, D-17, D-31, D-33, D-54, D-70, D-71, D-72, D-73, D-74 (dossier `phase-38.7-orrery-v2-dossier.md`)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

**Status without drift.** With drift removed (ADR-187), status has to read from the body itself.

**Faces and sun.** The labs drew faces too dark. The owner's favourite sun was Lab A's star.

**Moons.** Production hid moons at overview (phase-08 `:469`).

**Initials.** Hermes has no `Intl.Segmenter`, so the disc showed an ellipsised full name such as "El…". That was Phase 29's deliberate fallback (`29-05-SUMMARY.md:93`).

## Decision

**Bodies.** We will draw each contact as a lit status body: a sun-lit face with lighter shading only, plus Lab B's status rim and atmosphere glow (D-13, D-14).
- Face shading ships at floor 0.85 / 0.9, light elevation 0.9, wrap 0.5 (D-71).
- The rim and glow stay as Lab B drew them (D-74).
- Decay and rogue photos wash out "stronger" than Lab B: 0.6 and 0.9. Only those two statuses desaturate (D-72). This, together with the ring's dash, fade and trace cues, carries rogue identity without drift.

**Sun.** The sun body is always Lab A's star (corona plus granulation), even when its occupant has a photo. The photo shows on the focus card, Profile and lists (D-15, D-70). The shimmer moves only with the existing sun pulse, as in Lab A: corona swing 0.5, granulation swing 0.3 (D-37, D-70).

**Size.** Bodies keep a minimum on-screen size (D-16, via ADR-187).

**Moon bumps and stack pips (D-31).** At far zoom, a parent with moons shows a small satellite-styled bump: 4 dp, +0.75 dp per extra moon, capped at 6 dp. Zooming in splits it into individual moons (D-73). Lab A's stack pips stay too: a ring-coloured dot for a contact hidden behind another. Bumps and pips must look different. Stack detection is indexed, not O(n²) (D-54). Moons split by camera zoom while names appear by on-screen size, and the owner accepted that difference. A moon can be focused only when fully split (zoom 2.0 and above). ADR-105's limits apply unchanged.

**Initials.** The disc shows real initials: the first grapheme of each of the first two words. Grapheme handling never slices UTF-16 or produces a partial emoji (D-33).

## Alternatives Considered

- **Lab B's or Lab C's moons.** Rejected (D-17, D-30). The owner's moon behaviour is D-31.
- **Dark faces, Lab B's face preset, a "halfway" step, or flat faces.** Dark faces are on the kill list. The owner kept the lighter values (D-71).
- **Lab B's desaturation (0.25 / 0.45).** The owner chose stronger (D-72).
- **Painting the occupant's photo on the sun.** Rejected; the sun is always the star (D-70).
- **Hide moons at overview.** That was phase-08 `:469`. Superseded by D-31's bump.
- **Keep the full-name fallback.** That was Phase 29 EDGE-14. Amended by D-33.

## Consequences

### Positive

- Status reads at a glance without moving bodies off their rings. Moon context is visible from overview.

### Negative

- Emoji words still win the initials pick: "Mia 🌸 Nguyễn" → "M…". A todo is open to skip non-letter words (D-80 EMO-1).

### Risks

- The lit body shader is a suspect in the idle CPU cost (D-80 CPU-1).

## Implementation

**Key files:**
- `src/components/orrery/v2/draw-bodies.ts` — lit bodies, the star sun, moon bumps and pips.
- `src/components/orrery/v2/draw-labels.ts` — names and initials from the text service.
- `src/components/orrery/v2/shaders.ts` — the lit-face, rim, glow and desaturation shader.
- `src/components/orrery/v2/visual-tunables.ts` — `FACE_LIGHT`, `BODY_LOOKS`, desaturation, bump sizes and sun swings.
- `src/logic/orrery-stack-logic.ts` — indexed stack (pip) detection.
- `src/logic/orrery-satellite-logic.ts` — the bump/split rule and moon focus gating.
- `src/components/orrery/orrery-satellite-publisher.ts` — publishes moon specs to the canvas.
- `src/logic/orrery-label-logic.ts` — `orreryInitials`, with no `Intl.Segmenter`.

**Depends on:** ADR-105 (Scoped Relationship Satellites for System-Member Context); ADR-187 (Tilted Strategy-Map Home, Dolly Camera, One Projected Size, and Bodies on Their Rings)
**Required by:** None
