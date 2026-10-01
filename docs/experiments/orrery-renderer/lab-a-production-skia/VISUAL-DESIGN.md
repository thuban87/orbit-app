# Lab A — Visual design ("Deep-field star chart")

This document covers the visual language Lab A ended up with at HEAD (`978643c9`), why each element looks the way it does, and the evidence for each one.
- **Tunables:** every number lives at the top of `src/components/orrery/lab/deep-field-config.ts`. The full table, with file and function references, is in [IMPLEMENTATION.md](IMPLEMENTATION.md). Only the load-bearing values are quoted here.
- **History:** how each choice changed is in [DECISIONS.md](DECISIONS.md). What was tried and dropped is in [DEAD-ENDS.md](DEAD-ENDS.md).
- **Evidence paths** are relative to this folder.
- **Best single comparison:** `evidence/final/40-side-by-side-overview-legacy-vs-lab-a.jpg` (overview) and `evidence/final/41-side-by-side-focus-clara-legacy-vs-lab-a.jpg` (focus). Both are release builds with the same camera. The "legacy" side is main's flat renderer running inside the lab build, so it also has the 45° Home tilt. It is not a screenshot of main.

## 1. The visual thesis, as it ended

A premium star-system map comes from three things: **a depth hierarchy, one coherent light model, and an instrument-grade HUD**. Glow is not the answer.

The design rule that survived every review is **"people are the subject; orbits are instruments"**. Direction 1 broke that rule by adding glow and trails to the rings, and the device review (`evidence/direction-1/REVIEW.md` §6) caught it. Pass 1 inverted the hierarchy, and every later pass kept it.

The look is **chart-like, not cinematic**:
- a calm, nearly-void sky with one soft galactic band;
- a faint astrolabe plane that makes the 2.5D camera read as a real tilted plane;
- thin, status-tinted orbit hairlines, with full status colour only near each body;
- lit, keylined bodies;
- a sun that reads as a star.

### Constraints the look respects

| Constraint | How it is respected |
|---|---|
| **Frame semantics** | Visual extents never feed back into `radius`, `hitRadius`, label metrics or allocation. Everything is presentation drawn around the one sampled `frame`. |
| **Theme tokens** | Every hue is a `ThemePalette` token, passed to SkSL as a uniform. Six tokens were added: `orreryVoid`, `orreryNebulaA`, `orreryNebulaB`, `orreryGrid`, `orreryStarlight`, `orreryShadow` (`src/theme/theme-types.ts`, `theme-presets.ts`). |
| **Status channels** | Status stays readable without colour: the 2/3/4 width channel, `[6,6]` dashes, and the faded/faint-trace alpha factors from `orreryRingStyle`. |
| **Motion** | Motion encodes data and camera, never mood. There is no per-status motion (HANDOFF §7 REJECTED). |

## 2. Background, sky and nebula

| Layer | Treatment | Why | Evidence |
|---|---|---|---|
| Void | Canvas `background` fill plus a screen-fixed radial **vignette** in `orreryVoid`. Edge alpha 0.78 dark, 0.32 light. | Frames the system and lets the band fall off into deep space. | `final/01`, `final/21` |
| **Nebula** | A **CPU-baked** 256² RGBA texture (`lab/nebula-bake.ts`), drawn bilinear-upscaled. It is one soft diagonal galactic band (angle −0.62 rad, gaussian half-width 0.11) carrying four gas clouds, a filament octave and an off-centre dust lane. Off-band sky is nearly void. ±0.5 LSB dither prevents banding. Peak alpha is **0.32 dark / 0.34 light**. | A value step *below* rings and bodies, never a wash. Direction 1's GPU fbm at α 0.8 faceted on Mali and drowned the rings (`direction-1/01a`). | `final/01` (purple band lower-left), `pass-1/40` |
| Nebula cache | Module-level `Map` keyed by palette inks (at most one per palette, never disposed). A 450 ms fade on the **first** bake only. | Remounts (tab return, Profile back) must not re-raster or pop. | `direction-1/19` (before), `pass-1` notes §1 |
| Stars | Three recorded `SkPicture`s: far 240, near A/B 70; light uses 90 + 26. Scattered on a disc so yaw never exposes a corner. 7 dark-mode "hero" stars get a glow and diffraction spikes. | Two parallax depths and a little sparkle without per-frame cost. | `pass-2/12e`, `final/21` (hero spikes lower right) |
| Parallax | Pan × 0.035 / 0.05 / 0.12 (nebula / far / near). Tilt slides 70 / 90 / 160 px per rad. Zoom scales `1 + log2(z) × 0.025 / 0.035 / 0.09`. The sky rotates with full yaw. | Motion comes from the camera, so it is free and stops when the camera stops. Background-only parallax is free presentation (SUBSYSTEM-BRIEF §4.4). | `direction-1/22` |
| Twinkle | **Never rendered.** See the note below this table. | — | `lab/scene-draw.ts` `drawSky` comment |

**Why the twinkle never rendered:**
- The declarative tree put a `Group opacity` over a `<Picture>`, and RN-Skia's `drawPicture` takes no paint, so the opacity was dropped.
- The imperative renderer reproduces the on-screen result exactly: near stars at full alpha, with group A drawn 6× (warp level 0..5) even at rest.
- `WARP_ALPHA` and the twinkle band are therefore inert.
- Whether to enable a real twinkle is **owner decision TW1/TW2** ([RECOMMENDATIONS.md](RECOMMENDATIONS.md) §5).

## 3. World plane / astrolabe

**Composition** (inside the plane, in order):
- a sun-lit pool: additive in dark mode, multiply at 0.12 in light mode;
- reference rings every 48 world units;
- spokes every 30°;
- a double **bezel** with a 120-tick dial (every 5th tick major), out to 1.12 × extent;
- depth **haze** toward the far side, gated on tilt.

**Density rule.** Inner rings and spokes are multiplied by `clamp(8/N, 0.3, 1)`; the bezel is kept. At 39 contacts the grid had become noise (`direction-1/01`). The bezel and dial alone give the "instrument" read cheaply.

**How it is drawn (camera pass, `033e7518`).** The plane is drawn in **world space under the exact camera homography**:
- `GRID_SKSL` is one analytic draw on a cached unit disc. Strokes are computed per pixel in **constant screen dp**, using the homography's Jacobian.
- Visually this matches the earlier screen-space version (`camera-perf/parity-*.jpg`). The differences are world-linear rather than screen-linear ramps, and an exact perspective pool.

**Why it matters.** At low counts (2–3 bodies) the astrolabe is the strongest new element. It makes tilt and yaw legible as a real plane (`final/21`, `pass-2/12e`). At high counts it recedes correctly (`final/01`).

**Switch response.** The dial swings with spin velocity (`BEZEL_SPIN 0.42`) and the grid brightens (×(1 + 0.9v)). Both settle back to rest.

## 4. Orbits

**The language (pass 1 hierarchy inversion, kept to HEAD).** It is drawn by `RING_WORLD_SKSL` as one draw per ring.

| Part | Ink | Width | Alpha |
|---|---|---|---|
| **Hairline** (full circle) | `mix(grid, status, 0.55 dark / 0.6 light)`, so status tint is visible all the way round | status width × 0.42 (≈0.84 / 1.26 / 1.68 dp) | 0.5 dark / 0.55 light × the canonical status factor |
| **Status segment** at the body | full status colour | status width × 0.7 | sweep ramp 0 → 0.18 → 1 at the body → 0 |

- **Segment span.** It trails `min(75°, progress)` behind the body (never past north) and leads 14°. A never-contacted body gets a symmetric ±21° segment, so no direction is implied.
- **Line treatment.** `[6,6]` dashes (wobble, rogue) and the faded/faint/neutral factors apply to both parts. The CVD width channel survives.
- **Sparse Systems.** Hairline alpha ×1.7, tapering to ×1 by 12 orbits, because at 2–3 orbits the rings are the only structure.
- **Depth.** A far-side alpha floor of 0.32 at full tilt. The near side is pulled 35% toward the full status hue (`RING_NEAR_TINT`).
- **Focus.** The focused ring's hairline goes to full status ink (alpha 0.85, width × 0.6). Other hairlines dim 55% and other segments dim 33%.

**Rationale.**
- Status now reads mainly from the **body edge line and the segment**, not from 360° of saturated colour.
- The ring keeps radius = rank, angle = progress, and the dash/fade language intact (`final/40`: legacy left, Lab right).
- **Moon orbits** are a faint hairline around the parent on the plane (α 0.42 × hairline). Evidence: `final/11`.

## 5. Contact bodies

Drawn by `BODY_SKSL` in `lab/scene-draw.ts`. Evidence: `pass-2/03`, `final/12`, `final/41`.

### Presence

The *visual* radius is `clamp(21 dp / projected r, 1, 1.6)` × r (`bodyVisualScale`). A ~13 dp overview body therefore draws at ~21 dp. That is still inside the 22 dp minimum hit radius, so what you see is what you can tap.
- At identity zoom the scale is 1.
- Two-letter initials render semibold. This needed the Hermes `Intl.Segmenter` fix in `src/logic/orrery-label-logic.ts`; without it the disc showed "C…".

### Lighting

One light, the sun. The shader runs over the photo or initials and never resamples the photo.

| Element | Value |
|---|---|
| Terminator facing away from the sun | max darkening 0.55 dark / 0.36 light |
| Limb darkening | — |
| Lit-side rim in status hue | 0.85 / 0.7 |
| Soft specular in `orreryStarlight` | 0.22 / 0.12 |
| **Crisp status edge line** | 0.95 on the lit side, 0.4 on the night side |
| Atmosphere halo, reaching 1.5× the drawn disc | dark: cubic falloff, α 0.5; light: an ink hairline |

The status edge line is now the primary status cue on photo bodies (it replaced a 1.5 px rim).

### Keyline and stack pips

- A 1.6 dp background-ink keyline sits just outside every disc.
- Bodies draw near-over-far, so a nearer body's keyline cuts the farther disc. Co-angular contacts such as BB/CC then read as two discs.
- `lab/body-stack.ts` `findStacks` adds **stack pips**: one dot per hidden body in its status hue, at the front body's upper right. At most 4, then a "more" ring. Hidden during switches.
- Evidence: `pass-2/03` (BB under CC with a red pip).

### Depth cues

- Far bodies draw up to 16% smaller (`BODY_FAR_SHRINK`) and tint toward `orreryVoid` (up to 0.38).
- **Contact shadows** are cast on the plane away from the sun (α 0.55 dark, 0.16 multiply light). They fade in with tilt and are invisible at tilt 0, where they read as a smudge (`direction-1/01a`).

### Fades

- Bodies fade in over 280 ms on mount.
- Photos cross-fade over the initials in 260 ms.
- Non-focused bodies dim 22% while something is focused. This is a background-ink veil, so no layer is opened.
- All fades are instant under reduced motion.

### Accepted cost

The drawn extent (up to 1.6r disc × 1.5 halo) exceeds the 1.3r culling reach, so a body just past the screen edge can pop. This was not seen as objectionable.

## 6. Sun

Drawn by `SUN_DISC_SKSL` and `CORONA_SKSL`. Evidence: `final/21`, `final/41` (close-up), `pass-2/12e` (flare).

- **Disc.** A white-hot `orreryStarlight` centre grades to the occupant `glowColor` at the limb, so a contact-sun keeps its status hue.
  - It has limb darkening and three incommensurate octaves of warped sine **granulation** "wrapped" toward the limb by μ.
  - It also has a brighter intergranular network and a thin chromosphere band.
  - All coordinates are O(1), so the shader is precision-safe on Mali.
- **Photo sun.** With a photo, the photo stays and only a glowing limb band frames it. **This path is not device-verified**: the test self-sun has no photo.
- **Corona.** A white-hot core grades to `glowColor`. Its edge is shaped by three animated angular harmonics and wrapped in an exponential bloom, out to 2.7r, with screen blend.
- **Motion.** Granulation and corona animate from the single clock, quantised to `AMBIENT_HZ` 30. Both are fixed-phase (shaped but static) under live reduced motion.
- **Why.** The legacy sun was a flat accent-blue disc with a gold outline: "a blue button with a glow" (`direction-1/REVIEW.md` item 5). The star is the anchor of the light model and the single biggest "game map" signal after the tilt.
- **Weakness.** At identity zoom the sun becomes a large, fairly uniform yellow area under the header pills (`final/12`, `final/41`). Camera framing, not the shader, puts it there.

## 7. Moons (satellites)

- A small lit moon: the same body shader with terminator and atmosphere, at a minimum visual radius of 4.5 dp (max scale 2.2). The hit radius stays the frame's (≥ 22).
- Each moon has its own orbit hairline around its parent.
- Moons stay subordinate (ADR-105): small, no status ring, no Gravity.
- Evidence: `final/11` (Tom around Clara), `pass-2/02`.

## 8. Labels / instrument plates

- **Plate.** The same `surface` rounded rect at α 0.9, plus:
  - a hairline `orreryGrid` border at 0.55;
  - a 2.5 dp status tick in the ring hue inside the left padding (`textSecondary` for neutral);
  - a leader hairline from the body edge to the plate (α 0.7).
- **Deliberately not done:** small caps and tabular figures. They would change native-measured label metrics, which drive allocation, which decides Profile vs Focus.
- **Legibility** was verified in all four palettes and at font scale 1.3. Evidence: `pass-3/10`, `pass-3/30`, `final/12`.

## 9. Focus: reticle and emphasis

The reticle is drawn on the UI thread (`lab/reticle-draw.ts`). The plan is to draw it in screen dp around the **drawn** disc:

| Element | Value |
|---|---|
| Bracket box half-size | drawn + max(5 dp, 16%) |
| Arms | 6–15 dp |
| Stroke | 2 dp |
| Thin lock ring | at +3.5 dp, α 0.55 |
| Cardinal ticks | 4 dp |

**Lock-on** runs on each focus change: the brackets converge from 1.9× and 45° with an outBack overshoot of 1.6 over 760 ms, then a flash and one ping ring.

**Ambient detail:** a 0.8 rad "scan" arc rides the lock ring (≈9 s per turn).

**Colour:** the accent token, so the accent role contract is kept.

**Emphasis** is described in §4 and §5. It fades over 320 ms and is instant under reduced motion.

**Why the reticle moved to the UI thread.** As a React child it appeared 5–10 s late on device (`pass-3/22`). It is the best HUD element, so it now lands in the same frame the camera starts. Evidence: `pass-3/41` (before/after crop), `pass-3/20` sheet, `final/32`.

**Focus card.** Lab placement (`lab/focus-card.ts`) clears the drawn body, the reticle and the body's own label plate. It goes below if it fits, otherwise above. When obstacles block the centred 280 dp card it narrows to ≥ 168 dp beside them. Evidence: `final/41` right, `pass-3/02`.

## 10. System switch as a "jump"

Every effect reads `computeSwitchFx(transition, progress, reducedMotion)` and is idle at settle or under reduced motion. Choreography timing and classification are untouched.

| Effect | Look | Evidence |
|---|---|---|
| **Motion-blur trails** | The real recent path of each body (160 ms; 340 ms for leaving bodies), kept in world space, resampled in polar form about the sun and stroked as one arc ≤ 2.4 rad. Width and alpha thin for inner rings (`TRAIL_INNER_REF 9`). Leaving bodies "peel off" on their real outward spiral. | `pass-2/12e`, `pass-3/32`, `pass-2/12-…BEST.mp4` |
| Sun flare | Corona reach and bloom ×(1 + 1.25·flare), plus disc core heat, centred on the capture window. | `pass-2/12e` |
| Starfield warp / kick | Five scaled ghost copies of the near stars, by velocity² (short radial dashes at peak spin). The sky yaw swings by `kick × 0.16 rad`. | `pass-2/12e` |
| Dial swing / grid brighten | See §3. | `pass-2/12` sheet |
| Entering rings ink in | Draw-on from north, delayed by normalised radius (`INK_IN_SPREAD 0.55`), with a starlight glint at the head. | barely seen before the arch pass; `camera-perf` switch runs show 83–120 visible changes |
| Capture ripple | An on-plane ellipse from each entering body over its last 38% of capture. Retained bodies ripple once at progress 0.8–1. | as above |
| **Arrival ghosts** | An unmounted entering contact draws a neutral disc (background mixed 45% to grid ink) plus a neutral orbit hairline, on time, until its component/spec arrives. | `pass-3/33` vs `34` |

**Reduced motion:** a short crossfade only. No trails, warp, flare, glints, ripples or swing. Evidence: `final/33`, `pass-2/18a`.

**Verdict.** At 2–3 bodies the jump reads as a deliberate warp: comet smear, flare, dial swing. At 30–40 bodies the trails were judged acceptable after inner thinning. A real-finger, real-time judgement at full fps exists only since the camera pass. The final release build presents switches at 83–120 visible changes (`camera-perf/release/`), and no new stills were taken at that rate.

## 11. Light modes: "chart paper"

The variant is chosen by background luminance > 0.5, so it covers galaxy-light and standard-light without a prop. **No additive blend exists in chart mode**; `world-plane.test` asserts this.

| Element | Chart treatment |
|---|---|
| Nebula | Pale wash, pencil-shaded 20% toward grid ink |
| Grid and rings | Ink hairlines |
| Trails | Source-over |
| Shadows | Multiply 0.16 |
| Pool | Multiply 0.12 (0.26 read as a brown smear) |
| Body halo | Ink hairline |
| Corona | Engraved rays and rings in amber ink |
| Stars | Sparse ink dots, no heroes |
| Vignette | Paper-edge burn |

**My judgement.**
- Direction 1's light mode was the best-received element in review (`direction-1/REVIEW.md` item 8).
- After the hierarchy inversion, the final light mode is **clean and legible but quieter**: thin pink and green hairlines on a pale sheet, with less of the "engraved chart" character than direction 1 (`pass-1/41` left vs right, `camera-perf/parity-themes.jpg`).
- It is not a washed-out dark mode, but V2 could restore some engraving weight (bezel and ticks) in light mode.

## 12. Themes ×4

| Palette | What it looks like | Evidence |
|---|---|---|
| Galaxy-dark (default) | The reference look. | `final/01` |
| Galaxy-light | Chart paper. | `final/02` |
| Standard-dark | Neutral grey-black sky, same structure. | `final/03` |
| Standard-light | Chart paper on white. | `final/04` |

- All four were checked at overview and at focus in every pass. Evidence: `pass-3/10` (focus × 4), `camera-perf/parity-themes.jpg`.
- No regressions were found, `check:colors` = 0, and no colour literal exists in SkSL.
- The nebula, grid and starlight hues come from the six new tokens per preset.
- **Not done:** the ADR-149 overlay contrast proof ("AA against the brightest raw Orrery star") was not re-run against the Lab sky (corona, hero stars, nebula). V2 must re-prove it ([PRODUCTIONIZATION.md](PRODUCTIONIZATION.md)).

## 13. Reduced motion

Reduced motion is read live (`useReducedMotionShared`, ADR-085). Under reduced motion:
- the ambient time is −1;
- corona, granulation and reticle scan are static;
- the lock-on, flash and ping are skipped (the reticle shows locked);
- all fades are instant;
- switch FX are idle (crossfade only);
- the nebula fade is instant;
- nothing redraws at idle: **0 presents/s** in release (`camera-perf` notes §3).

Evidence: `pass-1/18`, `pass-3/21`, `final/33`.

## 14. Ambient motion inventory (owner-relevant)

| Motion | Status vs ADR-048/077 ("starfield twinkle and sun pulse are the sole ambient animation") |
|---|---|
| Sun corona harmonics and disc granulation (30 Hz) | **New.** It replaces the sanctioned "sun pulse" with a richer motion. **Owner decision.** |
| Reticle scan arc (only while focused) | **New ambient.** **Owner decision.** |
| Reticle lock-on, ping, focus fades, mount and photo fades | Triggered by an event, not ambient. Noted, not flagged. |
| Star twinkle | Sanctioned, but **not rendering** in Lab A (TW1/TW2). |
| Switch FX | Choreography-bound, not ambient. |

See [RECOMMENDATIONS.md](RECOMMENDATIONS.md) §5 for the recommendation.

## 15. Home tilt

`LAB_HOME_TILT_DEG = 45` (`src/logic/orrery-camera-logic.ts`) makes Home, Recenter and the switch destination a tilted plane.
- It is the biggest single "star-system map" gain: compare `pass-1/30` and `31` (tilt 0) with `pass-1/13` and `01`.
- At 39 contacts it also fits more of the world on screen, through foreshortening.

**Owner decision K.** This is kept **for testing only**. It reverses milestone-2 phase-08 dossier §C/§P and 29-UI-SPEC ORRC-04/05 ("Home is top-down"). Production adoption is a separate owner decision.
