# Lab B — R2 report: art direction and hero moments

2026-10-01. Branch `experiment/orrery-skia-unleashed`. Code commit `ff90df99` (stage art + hero
experiments + tooling); docs/evidence commit follows. Every image is from the desktop **emulator**
(1280×2856, release x86_64 builds `r2a`…`r2d`), every cost a **relative A/B on that emulator**,
never a phone claim. Evidence: `evidence/10-r2/`. Detail: DECISIONS-LOG (R2), COMPROMISES
C-66…C-70, PERF-LOG (R2), DEAD-ENDS (R2).

## 1. Art review of the R1 state (before)

Captures: `evidence/10-r2/00-before/` — `sheet-a` (Inner overview, Dense overview / identity /
detail), `sheet-b` (focus + switch early/mid/settled), `sheet-c` (the three other themes,
overview + focus). Judged as the art director of a premium space-strategy title.

**What still reads flat / 2D / dashboard.**
- **The camera is a satellite photo, not a star map.** Home is tilt 0: the orbital plane is
  the screen. Thirteen perfectly concentric hairline circles around a centred sun read as a
  radar scope or archery target (`02`, `03`). Every depth system the lab already built — the
  far-side ring fade, depth haze on bodies, perspective scale, the plane homography under
  rings / chart / shockwave — only appears if the user discovers the two-finger tilt. The
  renderer was 3D-capable and showed none of it by default.
- **The sun does not light anything.** It is a beautiful object pasted onto a background.
  Nothing near it is brighter than anything far from it: the inner orbits have the same
  weight as the 12th, the plane under it is the same nebula as the screen corners.
- **Bodies at overview are pins.** ≈19 dp across (`02`), a photo or two initials in a rim —
  the scale of a map marker. Their lighting (terminator, limb) is invisible at that size, so
  they don't feel like worlds; the rings are the heaviest objects on screen.
- **Hierarchy.** Sun → rings → bodies → nebula all sit at similar visual weight. The nebula is
  busy everywhere, including the lower half where there is nothing to look at; the eye has no
  path from the sun outward.
- **Composition / empty space.** The lower ~40 % of the Dense overview is concentric rings
  over a nebula with two or three bodies — empty, but *flat* empty. In a game map that space
  would be the near side of a receding plane (foreshortened, darker, out of the light).
- **Colour harmony.** The violet-blue nebula with an amber ember lobe is good, but the warm
  lobe is unrelated to the sun (it sits wherever the noise put it). Sun yellow, ring green,
  accent blue and ember amber compete at overview.
- **Themes.** Galaxy Light / Standard Light: the vellum reads washed out and the sun is a
  yellow blob with no relationship to the paper. Standard Dark (graphite + chart) is the
  most "instrument" of the four and actually the most premium-looking at overview.
- **Switch.** The hyperspace streaks / comets are already a hero moment (`06b`), but on a
  flat plane they read as a 2D radial zoom blur.
- **Focus.** The reticle + anchored card work; at identity zoom the scene is good. Unchanged
  in R2 except that it now happens on a tilted plane.

## 2. What R2 changed (art-direction fixes, default ON)

| Flag | What | Why it serves meaning |
|---|---|---|
| `homeTilt` | Home / Recenter / switch Home tilt the plane to 0.56 rad (≈32°) | Turns the target into a receding orbital plane; activates the existing depth stack (ring far-side fade, body haze, perspective scale). Changes what Home means → C-66, owner call. |
| `planeLight` | One full-screen shader under the rings: sun-coloured light pool on the plane (inverse homography per pixel) | The sun is the centre of the user's gravity; now it visibly lights its neighbourhood. Additive on dark, warm wash on light. |
| `planeGrid` | Faint orbital-plane grid whose lookup is pinched into a **gravity well** around the sun (Galaxy only; Standard keeps its chart) | Makes the plane a surface you look across; lines converge in perspective and crowd into the well — "everything falls toward you". Pure texture, no data (C-67). |
| `ringSunLight` | Rings rim-lit near the sun (alpha × (1 + g·e^(−r/R)), leaning toward the highlight) | Inner orbits — the closest relationships — read first; outer ones recede. Status hue/weight/style unchanged (C-68). |
| `bodySizeFloor` | Bodies under 12 dp are drawn up to 1.4× larger (visual only) | Worlds, not pins, at overview; hit radii, labels and model untouched (C-69). |

Before → after: `evidence/10-r2/before-after-*.jpg` (§5). Iterations: `01-tilt-probe`
(tilt 0.45/0.7/0.95 via deep link), `02-iter1` (pool far too wide — whole sky went brown;
cartesian grid made a crosshair through the sun), `03-iter2` (pool tightened, hero
experiments), `04-iter3` (grid offset half a cell + larger well, ghosts stronger, bloom
threshold up, all four themes, switch), final `06-final` on release `r2d`.

## 3. Hero-moment experiments

Each behind a flag, measured on the same release build (`r2d`), Lab B Dense (120), evidence
under `evidence/10-r2/`. Verdict buckets: **ship** = worth shipping, **simplify** = worth
simplifying, **costly** = beautiful but too costly, **failed**.

| # | Experiment | Flag | What it looks like | Verdict |
|---|---|---|---|---|
| a | **Bloom** — ONE saveLayer over sky + world (labels outside) whose image filter is `Blend(Plus, Blur(ColorMatrix bright-pass(src)), src)`; Skia's GPU blur downsamples internally at sigma 9 dp | `bloom` | Real HDR feel: the sun gets a broad soft halo, rims and inner rings glow, streaks smear light during a switch (`03-iter2/crop-sun-art-bloom-flare.jpg` centre, `final-hero-bloom-flare.jpg`). At threshold 0.62 it blew the sun's granulation out to a flat disc; 0.74 keeps it. It also **re-brightens the sun past R1's composite glow cap** (legibility C-02 family). | **costly** — a full-screen offscreen + blur on EVERY frame is the classic Android GPU cliff; the emulator cannot see it (gfx/GPU p50 inside noise, GPU p50 +2–5 ms hint only). Harvest the look as per-element baked glows (what the lab already does) and maybe a bloom only on the sun sprite. |
| b | **Displacement shockwave image filter** (WP-2.1, existed) — now follows the tilted, elliptical front (`uShock2.w` squash); amplitude 28 → 56 dp, band 34 → 48, chroma 0.18 → 0.30 | `fxShockFilter` | At the old amplitude it was invisible at normal speed. Even doubled, it only reads in slow motion (`05-shockfilter/lockslow-off-vs-on.jpg`, `lockslow-tuned.jpg`, `slowmo5-*.mp4`): a heat-haze wobble of the rings/nebula that drowns in the streak + comet choreography. | **failed** (as a hero beat) — costs a full-screen saveLayer + 1–3 texture taps per pixel for the whole lock phase, and the projected-ring shockwave (default) already carries the moment. Kept flag-off, tuned values committed. |
| c | **Lens flare + anamorphic streak** — one additive full-screen shader: horizontal streak through the sun, halo ring, four ghosts on the sun→centre axis in glow/accent tints; strength rises as the sun nears the screen centre (responds to camera pan) | `lensFlare` | The anamorphic streak instantly says "cinematic space game" (`crop-sun-art-bloom-flare.jpg` right); the ghosts are subtle. Dark themes only (multiply themes skip it). | **simplify** — keep the streak (a single thin gradient rect would do; no full-screen shader), drop the ghosts; owner taste. No measurable cost here. |
| d | **Tilt-shift DoF** — 4 `BackdropBlur` bands (top far side strong/soft, bottom near side) while the plane is tilted | `tiltShift` | Hard band edges, blurs faces and bodies at the top/bottom of the view, labels stay sharp over blurred bodies (`03-iter2/sheet-hero*.jpg` right column). Exactly the face-blur research 03 predicted. | **failed** — 4 backdrop saveLayers for a look that hurts the information architecture. A per-body depth blur would need a blur per body draw (cost ∝ N). |
| e | **Own idea: orbital-plane grid + gravity well** — square cells on the world plane via the inverse homography, offset half a cell, lookup pinched toward the sun (`q = p·(1 + 1.4·e^(−r²/(0.3·extent)²))`) so lines crowd into a funnel; fades with distance; Galaxy only | `planeGrid` (default ON) | With the Home tilt the plane becomes a surface you look across (lines converge in perspective) and the sun sits in a dimple (`04-iter3/art/02`, crop `03-iter2`). Iter 1 had a crosshair through the sun (fixed by the half-cell offset) and a well too small to read. | **simplify** — keep it as faint texture (alpha 0.05), it is cheap (folded into the same shader as the light pool). Possibly polar instead of square to echo the rings; owner taste (C-67). |
| — | **Sun light pool on the plane** (art fix, same shader) | `planeLight` (ON) | Iter 1 radius 0.55·extent turned the whole nebula brown; final 0.32·extent with a tight core reads as the star lighting its neighbourhood. | **ship** |
| — | **Home tilt 32°** | `homeTilt` (ON) | Biggest single change of R2: target → star-system map (`before-after-overview.jpg`). Activates depth haze, far-side ring fade, perspective scale. | **ship** — but it changes Home's camera semantics (C-66): owner decision. |
| — | **Rim-lit rings** | `ringSunLight` (ON) | Inner orbits brighter / slightly whiter, outer recede. Status hue/weight/dash untouched. | **ship** (owner a11y glance, C-68) |
| — | **Overview body size floor** (≤ 1.4×, < 12 dp) | `bodySizeFloor` (ON) | Bodies read as small worlds rather than pins; hits/labels unchanged. | **ship** (C-69) |

Reduced motion: with every R2 flag ON (incl. bloom + flare) two captures 3 s apart differ in
**0 pixels** (`06-final/09-reduced-motion-static.jpg`); no R2 layer reads the clock (stage
plane / flare / tilt-shift uniforms derive from the frame only), so the idle clock still stops
the canvas. Lifecycle is unchanged (no new clock, no timers).

## 4. Costs (emulator, relative)

`evidence/10-r2/perf/summary.tsv` (`tools/r2-perf.sh`, r1-perf harness, `opaqueCanvas:0`,
`idleClock:0`, Dense 120, release `r2d`). gfx frame-time percentiles (ms):

| Config | idle p50 / p90 | pan p50 / p90 | focus p50 / p90 | switch in p50 / p90 | GPU p50 (idle/pan) |
|---|---|---|---|---|---|
| R1 base (all R2 off) | 19 / 36 | 20 / 48 | 32 / 34 | 32 / 53 | 8 / 8 |
| R2 art (defaults) | 24 / 36 | 23 / 42 | 23 / 40 | 25 / 40 | 9 / 9 |
| + bloom | 26 / 34 | 25 / 42 | 27 / 36 | 25 / 57 | 14 / 11 |
| + lens flare | 24 / 34 | 22 / 48 | 24 / 36 | — | 13 / 9 |
| + tilt-shift | 25 / 34 | 23 / 38 | 23 / 48 | — | 13 / 9 |
| + shock filter | — | — | — | 25 / 40 (out: 32 / 53) | — |

- **Nothing is separable from noise on this target.** The TextureView path presents at ~28 fps
  here whatever the scene (R1); run-to-run spread is ±5 ms p50. GPU p50 hints that bloom (+2–5)
  and the two full-screen experiments (+1–4) cost GPU time that the desktop GPU absorbs.
- UI-thread probe: the R2 worklets are not separately probed — the stage plane and the flare
  are one uniform derived value each over `frame` (no picture re-record, no clock); the probed
  bodies / rings / labels pictures stay in the same ranges as R1 base (bodies pan mean
  4.1 → 4.2–6.4 ms, rings 2.1 → 1.9–2.2 ms; the size floor is a min/max per body, the rim light
  two uniform floats).
- Phone (Mali, fill-rate bound): expect the stage plane (one full-screen shader with ~25 ALU
  ops + inverse homography) to be in the same class as the nebula sample (already full-screen);
  bloom = one full-screen offscreen + downsampled blur per frame = the risk. PHONE-PASS-SCRIPT
  should add `planeLight/planeGrid` off and `bloom` on rows.

## 5. Before / after

- `evidence/10-r2/before-after-overview.jpg` — Inner Circle and Dense overview, R1 → R2.
- `evidence/10-r2/before-after-zoom-focus.jpg` — identity, detail, focus.
- `evidence/10-r2/before-after-themes.jpg` — Galaxy Light, Standard Dark, Standard Light.
- `evidence/10-r2/final-switch.jpg` — the switch on the tilted plane (streaks now read as
  flying *over* a plane, not a 2D zoom blur); `05-shockfilter/switch-shockfilter-*.mp4`.
- `evidence/10-r2/final-hero-bloom-flare.jpg` — the experiments on (not default).

Judgement: the overview now reads as a star-system map seen from a camera, with the sun as the
light source of the scene; Standard Dark's chart graticule in perspective is the most
"strategy-game instrument" frame in the lab. Still not solved: the chrome frame (header + pills +
FAB column, M1-CRITIQUE), the near-side bodies at detail zoom growing under the FAB column, and
the busy nebula in light themes.

## 6. Open problems / owner items

1. **C-66 Home tilt** changes the product camera's Home (docs/systems/orrery.md "Recenter …
   restores all Home axes" = tilt 0). Owner decision; flag `homeTilt` default ON for the glance.
2. **C-67 plane grid / light pool** add non-data world texture (the sun's glow token drives
   the pool). Taste call; Standard keeps its chart instead of the grid.
3. **C-68 rim-lit rings** change ring contrast with distance from the sun (outer rings
   relatively dimmer) — a11y check of ring contrast per theme (C-35 family).
4. **C-69 size floor** draws bodies up to 1.4× their model radius at overview.
5. **Legibility** — not re-measured after R2: the pool adds light near the sun (strength 0.13)
   and bloom (off) defeats R1's sun glow cap. Re-run `tools/r1-legibility.sh` before any of
   this ships.
6. **Near-side scale at detail** — with tilt, the near-side body at detail zoom becomes very
   large and can sit under the FAB column (`06-final/04`). Perspective is doing its job; the
   camera presets zoom about the view centre, not the content (C-25).
7. **Phone** — every cost above is emulator-relative; bloom and the stage plane need the
   Pixel (PHONE-PASS-SCRIPT).
