# Lab B — Visual design

Direction: **"Deep Field Cartography"** (research 03 §1). This doc describes the look at
`bfc8f36c`. It does not cover **R3 polish (PENDING)**.

All images are emulator captures (1280×2856). The colours are what a desktop GPU produces
through the emulator's GLES translator; a Pixel panel or HDR has not been checked.

## 1. Visual language: two registers

| Register | Covers | Character |
|---|---|---|
| **Physical** | Environment, sun, contact bodies, moons, plane light | Painterly, volumetric, sun-lit, soft edges, no outlines. **Carries no data.** |
| **Instrument** | Orbits, wakes, tethers, ticks, labels, reticles, ripples, reorder hold, HUD chrome | Hairline, exact, drawn in status or accent hues. **Carries all data.** |

That tension is what makes a strategy-game map read as premium. It also keeps Orbit legible:

- every piece of data sits in the instrument register, or is unmistakable on the body
  (status rim, atmosphere, desaturation);
- every piece of atmosphere sits in the physical register.

Contacts stay the information architecture. Bodies never leave their rails, and nothing is
a physics simulation.

**Colour discipline.** Every colour reaches SkSL as a uniform derived from `ThemePalette`
tokens (`labb-uniforms.ts`: `tokenToVec4`, `mixVec`). The SkSL holds no colour constants and
no `#define`. The only literals are the LAB-ONLY white sprite *masks* (`LAB_SPRITE_MASK*` in
`src/theme/orrery-lab-fx.ts`, C-26). They are alpha masks, tinted per star by token colour
buffers.

Derived colours are numeric token mixes that the owner has not approved (C-03, C-32, C-40,
C-44). Examples: nebula lobes, the band tone, the sun's deep tone, the shadow ink.

## 2. Layer by layer

### L0 — Deep environment (`LabEnvironment.tsx`, `labb-sky.ts`)

**Nebula.** A 768² seamlessly tiling *density* texture holds lobe A, lobe B and dust in
r/g/b. It is baked once per mount at about 0.45 texel/dp (one tile ≈ 1 700 dp). Every frame,
`nebulaSample` colours it from token uniforms:

- **Lobes.** Lobe A is `accent`. Lobe B is a `starPalette` hue: violet by default, or the
  per-System sky hue (C-05). Where the lobes overlap there is an ember (`starPalette[2]`).
- **Dust lanes** come from the sky token, darkened.
- **Vignette.** The vignette goes to a darker shade of the sky token.
- **Dither** is applied.

A theme change never rebakes.

**Ambient life.**

- a Lissajous drift of ±26/±18 dp over 95/131 s;
- a 40 s breathing of the warp.

Both are bounded and never accumulate. Under reduced motion they freeze at `STILL_T`.

**Stars.**

| Layer | How it is drawn |
|---|---|
| Far | Analytic, inside the nebula pass: a hash grid with ≤1 star per 22-dp cell, a Gaussian disc and three token tones |
| Mid (300) and near (110) | One Atlas of alpha-mask sprites (soft dot, crisp dot, diffraction spike), tinted by a colour buffer from `textPrimary`/`textSecondary`/`starPalette` |

Twinkle is ±phase-hashed per star. Dark themes draw stars additively (`plus`); light themes
draw sparse ink specks (40 % density, ~0.4 alpha, no glow, no twinkle).

**Parallax.** One rule covers every sky layer (`labSkyPose(frame)`):

- **pan** = factor × (sun screen position − viewport centre);
- **zoom** = `zoom^(factor·1.3)`;
- **yaw** rotates the sky about the **viewport centre** (a deliberate deviation from "about
  the sun"; DECISIONS WP-1.1 §5, C-27);
- **tilt** shifts the layers vertically by depth.

The factors are far 0.03, nebula 0.06, mid 0.10 and near 0.22.

**Profiles** (`LabEnvProfile` in `orrery-lab-fx.ts`):

| Profile | Look |
|---|---|
| Galaxy Dark "deep field" | Lobe strengths 0.28/0.27, glow 0.16, ember 0.22, dust 0.38, vignette 0.62 |
| Light "vellum" | Washes ≤0.16, no glow, dust 0.05, vignette 0.13 |
| Standard Dark (WP-2.2, `stdChart`) | A **quiet graphite sky**: nebula at about ⅓ strength (0.09/0.07), no ember, sparse crisp stars, twinkle 0.06 |

Evidence:

- `evidence/02-wp1.1/01-overview-dense-galaxy-dark.png`;
- `10-galaxy-light-vellum-dense.png`;
- `11-standard-light-lowest-intensity-dense.png`;
- `evidence/08-wp2.2-focus/04-debug-standard-dark-chart-identity-home-vs-focus.jpg`.

### R2 stage — the sun lights its plane (`LabStage.tsx`, effect `stagePlane`)

One full-screen shader under the rings maps each pixel through the **inverse plane
homography** to a world radius. It then adds two things:

- **Light pool.** A Gaussian plus core falloff in the sun's glow token (pool 0.13, radius
  0.32·extent; additive on dark, a warm wash on light).
- **Gravity-well grid** (`planeGrid`, Galaxy only). Square cells offset by half a cell. The
  lookup is pinched toward the sun (`q = p·(1 + 1.4·e^(−r²/(0.3·extent)²))`), alpha 0.05.

Its uniforms come from `frame` only, with no clock. Evidence:
`evidence/10-r2/04-iter3/art/`, `03-iter2/crop-sun-art-bloom-flare.jpg`.

**Home tilt** (`homeTilt`, `labb-home-tilt.ts`): Home, Recenter and the switch destination
tilt the plane to **0.56 rad (≈32°)**. This one change turns the "radar target" into a
receding orbital plane, and it activates the existing depth stack:

- far-side ring fade;
- body depth haze;
- perspective scale.

The value was chosen from a 0.45/0.7/0.95 probe (`evidence/10-r2/01-tilt-probe/sheet.jpg`);
0.7 and above squashes the far side under the selector pills. **Owner decision C-66.**

### L1 — Instrument orbits (`LabRings.tsx`, `labb-rings-logic.ts`, effect `ringInstrument`)

**Geometry.** A ring is `drawCircle(0, 0, R)` under the per-frame plane homography, so it is
exact in tilt and yaw. Width is `dp/zoom`, so perspective makes the near side slightly heavier
(kept as a depth cue).

**Class shader.** One stroke shader per status class gives:

- a hairline in the status hue;
- a **far-side depth fade** (∝ tilt, down to 0.32 dark / 0.40 light);
- **shader dashes** with an integer count per circumference, so there is no seam at north;
- optional **flow comets**;
- R2 **rim light** near the sun: alpha × (1 + 1.1·e^(−r/0.32·extent)), leaning toward the
  highlight (C-68).

**The status vocabulary is kept** from `orreryRingStyle` (C-35):

| Status | Legacy | Lab |
|---|---|---|
| stable | solid 2 px | solid 1.04 dp |
| wobble | dashed [6,6] 3 px | dashed 11 dp period @58 % duty, 1.46 dp |
| decay | solid ×0.7, 4 px (heaviest) | solid ×0.7, 1.88 dp (heaviest) |
| rogue | dashed ×0.3 | dotted trace 6 dp @30 % ×0.42, 1.46 dp |
| never-contacted | `border` solid ×0.5 | `border` solid ×0.5, 1.04 dp |

The **weight order** is preserved, because it is the CVD-redundant channel. Base alpha is 0.5
dark / 0.7 light × class alpha.

**Other ring elements.**

- **Density fade.** Ring alpha × clamp(gap·zoom / 20 dp, 0.35, 1), so 120 rings at far zoom
  don't become a solid disc (C-36).
- **Progress wake** (`ringWake`, C-17). A gradient arc from north to the body angle (ADR-011
  angle convention, `wakeAngle`), brightest at the body. Never-contacted bodies get none. It
  is hidden while the camera recovers and above 160 rings.
- **Drift tethers** (`ringTethers`, C-17). Decay and rogue bodies get a radially dashed rect
  from the rail point to the body limb.
- **Energy flow** (`ringFlow`, C-04). Three comets per ring at one linear speed for every
  status, clockwise. Off under reduced motion and above 160 rings. Standard runs it at half
  strength.
- **Ticks.** North ticks on every ring at `detail`. The focused ring gets a 30° tick scale.
  An `accent` compass chevron sits outside the outermost ring.

Evidence:

- `evidence/04-wp1.3/08-pass2-overview-dense-final.png`;
- `05-tilt-max-depth-fade-dense.png`;
- `07a/07b` (density fade);
- `09-flow-comets-overview-dense.mp4`;
- `evidence/05-m1-checkpoint/28c-ab-legacy-left-vs-lab-right.png`.

**Standard chart** (`LabChart.tsx`, `stdChart`, C-58). Range rings at a "nice" world step,
30° bearing spokes and a 10°/30° degree scale, in `textSecondary` hairlines at alpha 0.10, as
one picture under the homography. It encodes no data. R2-REPORT calls it the most
"strategy-game instrument" frame in the lab.

### L2 — The sun (`LabBodies.tsx` `LabSunBody`, effects `sunStar` / `sunPhoto`)

| Variant | Look |
|---|---|
| `sunStar` (self sun, no photo) | Limb-darkened stellar surface in the occupant glow colour, with domain-warped granulation on a rotated lattice. The first version was axis-aligned and read as blocky squares. The core is white-hot toward `avatarSwatchText`. **This replaces the avatar swatch: C-31.** |
| `sunPhoto` (photo self-sun or contact sun) | The photo drawn **emissive** (a whisper of limb darkening, the face is never darkened), with the status-colour corona per `resolveSunOccupant` |

**Corona.** An inner glow, a halo, two angular-noise ray bands drifting outward and a bright
limb. The legacy ~3.1 s pulse becomes ±6 % breathing. Reach is 2 r, the culling reach
(C-10).

**Dark-theme glow cap.** `SUN_GLOW_CAP_DARK = 0.94`, composite-aware, so the sun is never the
brightest pixel under the glass (R1 legibility).

Evidence: `evidence/03-wp1.2/09-pass3-sun-finer-granulation-identity.png`,
`12-contact-sun-photo-emissive-status-corona-cheap-moons.png`.

### L3 — Contact bodies: "worlds, not avatars" (effects `bodyPhoto` / `bodyProcedural`, `BODY_LIT`)

**One draw per body.** Each body is a circle of radius 1.3 r. Its shader paints the lit disc
inside r (1-dp AA at **exactly** the frame radius, so hit radius, label anchors and focus
cards are unchanged) and the atmosphere or contact shadow outside r.

**Lighting.**

- Lambert plus wrap (0.35) from the screen-space body→sun vector;
- light z 0.4;
- a **floor of 0.55 (dark) / 0.75 (light)**, so faces stay recognisable (C-30);
- a specular glint;
- a status Fresnel limb (0.35);
- a 1.5-dp crisp status rim;
- far-side **depth haze** of ≤15 %.

**Photo-less bodies** (`bodyProcedural`). A banded latitude "world" in the contact's swatch,
noise-warped, seeded per `bodyKey`, with highlight streaks. Real initials (`labInitials`,
code-point based) are drawn as glyphs on top at ≤80 % of the disc.

**Status materials** (`labBodyMaterial`, static, no per-status animation: HANDOFF §7):

| Status | Material |
|---|---|
| stable / wobble | Full atmosphere |
| decay | Atmosphere 0.4, desaturated 25 % |
| rogue | No atmosphere, desaturated 45 %, cold `rogueExtinguished` rim |
| never-contacted | Matte, neutral `border` rim |

This replaces the legacy 3 px outline (C-16).

**Gravity** is unchanged: it is already in the world radius (ADR-106).

**Light themes** keep the same lighting with a higher floor. They swap the additive glow for
an anti-sun **contact shadow** in `textPrimary` ink plus a faint status glow.

**Overview size floor** (`bodySizeFloor`, R2, C-69). Bodies under 12 dp are drawn up to 1.4×
larger. This is visual only.

**Point LOD** (`bodyPointLod`, C-62). Under 6 dp a body becomes a status-hued point. It
rarely triggers at today's MIN_ZOOM.

Faces were judged in `research/M1-CRITIQUE.md` §Faces, at detail zoom on 16 fictional test
portraits: **no portrait became unrecognisable**. The weakest case is dark skin on the shadow
side combined with rogue desaturation (`evidence/05-m1-checkpoint/18-face-detail-3.2-ada-mustard-rogue-tether-moons.png`).
That needs a phone glance (C-30).

### L4 — Moons and L5 — Polaris

- **Moons.** The default is a cheap lit moon made of three circles: a 50 % dark disc, a
  sun-facing cap and a glint. The per-moon shader is the `moonShader` flag, off by default
  because of its cost. The 250 ms level fade-in was never built (C-34). There are no moon
  rings (ADR-105).
- **Polaris** (`LabPolaris.tsx`). A BlurMask halo in `starPalette[0]`, long faint
  diffraction spikes, a crisp 4-point cross and a core. Its position and hit test are the
  same as the legacy Polaris.

### L6 — HUD-tag labels (`LabLayerPictures.tsx` `LabLabelsPicture`; component twin `LabLabels.tsx`)

**Contract kept.** Labels are positioned **only** from `allocations`, and the plate is
**exactly** the prepared `width × height`. Semantic zoom, collisions and the label→tap
contract are therefore unchanged.

**Paint.**

- a blurred `background` scrim halo (0.55 / 0.5);
- a `surface` plate (0.9 / 0.94);
- a faint `textSecondary` outline;
- a status-hue hairline on the body-facing edge;
- a 6 dp leader tick.

Context captions keep the legacy style.

**Defocused labels dim their text only**, with a floor of 0.66 (`labelTextDim`, R1). That
gives a model contrast ≥4.95:1 in all four themes.

### L7 — Focus, feedback, switch (see INTERACTIONS.md for timing)

- **Target-lock reticle** (`fxFocus`). Four corner L-brackets, cardinal ticks, a soft
  additive under-glow (dark themes), a dashed range circle once locked and a one-shot lock
  flash. It replaces the thick accent focus ring that M1-CRITIQUE ranked the second-ugliest
  element.
- **World response** (`fxFocusDim`, C-52).
  - Every other world: desaturated 30 %, 22 % toward the sky, ×0.68 luminance, atmosphere ×0.45.
  - The focused world: atmosphere ×1.8 plus a halo.
  - Vignette +16 %.
  - The sun is never dimmed.
- **System switch showcase.** Hyperspace streaks, a corona flare, dissolve and particles,
  ring unwind and draw-on, arrival comets, capture flares, a system-lock shockwave and the
  per-System sky hue.
- **HUD chrome** (`hudChrome`, `OrreryHudCorners.tsx`, C-56). Accent hairline corner
  brackets and the `RADII.sm` instrument radius on the selector, View options, the controls
  and the focus card. Glass tint and opacity are untouched (ADR-149).

Evidence:

- `evidence/08-wp2.2-focus/03-debug-galaxy-dark-home-vs-focus-hud-chrome.jpg`;
- `07-debug-dense-120-focus-world-response.jpg`;
- `evidence/06-wp2.1-switch/20`–`25`.

## 3. Themes

| Package × mode | Intensity | Blend | Character |
|---|---|---|---|
| Galaxy Dark (hero) | 1.0 | additive | Deep field, full stage (pool + grid), flare-capable |
| Galaxy Light | 0.7 | multiply | Vellum washes, ink stars, contact shadows, warm corona wash |
| Standard Dark | 0.85 | additive | Graphite sky + chart graticule, half-strength flow, no grid |
| Standard Light | 0.35 (≈0.5× Galaxy Light, pinned by test) | multiply | Quietest; chart graticule |

All four themes:

- `evidence/05-m1-checkpoint/27-themes-4-contact-sheet-gd-gl-sd-sl.png` (M1);
- `evidence/10-r2/before-after-themes.jpg` and `06-final/07-*`, `08-*` (final).

**Known weak spots** (R2-REPORT §5):

- the light themes' nebula still reads busy or washed out;
- the light-theme yellow wobble dashes are low-contrast on vellum (token hue, same as legacy);
- the chrome frame (header + pills + FAB column) still reads as a productivity app.

## 4. Reduced motion

The scene is static but complete:

- nebula frozen in a fixed composition;
- no twinkle, flow, corona motion, ripples, streaks, particles, flares or shockwave;
- reticles lock instantly;
- pings and ripples become a fixed ring that fades over 150 ms;
- a switch becomes the existing 180 ms crossfade plus the sky-hue crossfade;
- parallax still follows the user's own gestures.

**Proof.** With every R2 flag on, including bloom and flare, two captures 3 s apart differ
in **0 pixels** (`evidence/10-r2/06-final/09-reduced-motion-static.jpg`). The idle clock then
stops the canvas entirely (0 frames / 10 s).

## 5. Tunables (all at the top of their files)

| Area | File | Key constants |
|---|---|---|
| Nebula / stars | `LabEnvironment.tsx` | `NEB_TEX` 768, `NEB_TEXELS_PER_DP` 0.45, `DRIFT_*`, `WARP_DP` 9, `BREATH_S` 40, `STILL_T`, `TWINKLE_RATE` |
| Parallax | `labb-sky.ts` | `NEBULA_FACTOR` 0.06, `SKY_ZOOM_DEPTH` 1.3, `SKY_TILT_SHIFT` 140, `SKY_PUSH_*` |
| Bodies / sun | `labb-bodies-logic.ts` | `BODY_REACH` 1.3, `SUN_REACH` 2, `LIGHT_Z` 0.4, `SUN_BREATH` 0.06, `SUN_GLOW_CAP_DARK` 0.94 |
| Bodies picture | `LabLayerPictures.tsx` | `BODY_POINT_LOD_DP` 6, `SIZE_FLOOR_MAX_BOOST` 1.4, `LABEL_TEXT_DIM_MIN` 0.66, `OCCLUDED_ALPHA` 0.12 |
| Rings | `labb-rings-logic.ts`, `LabRings.tsx` | `RING_WIDTH_SCALE` 0.42, `RING_WIDTH_BASE` 0.2, dash periods/duties, `RING_CLUTTER_GAP_DP` 20, `RING_CLUTTER_FLOOR` 0.35, `FLOW_LOD_MAX_RINGS`/`WAKE_LOD_MAX_RINGS` 160 |
| Switch FX | `labb-switch-logic.ts`, `LabSwitchFx.tsx` | `PARTICLE_CAPACITY` 640, `STREAK_MAX_DP` 190, `WARP_PUSH` 0.14, `CORONA_FLARE` 0.4, `SHOCK_MIN_INTENSITY` 0.25, `COMET_LOOKBACK` 0.07, `FILTER_AMP_DP` 56 |
| Focus / feedback | `labb-focus-logic.ts`, `LabFocusFx.tsx` | `FOCUS_MIX_MS` 340, `FOCUS_RELEASE_MS` 260, `LOCK_MS` 380, `PING_MS` 620, `RIPPLE_DP` 78, `VIGNETTE_FOCUS` 0.16 |
| Home tilt | `labb-home-tilt.ts` | `LAB_HOME_TILT` 0.56 |
| Per-theme strengths | `src/theme/orrery-lab-fx.ts` | `*_ENV`, `*_BODIES`, `*_RINGS`, `*_LABELS`, `*_CHART`, `*_STAGE`, intensities |

**Stale comments to fix.** The `LabEnvironment.tsx` header still says "512² at ~0.3 texel/dp"
and describes a FAR star Atlas. The code is 768² / 0.45, and the far stars are analytic in
the shader. The `LabRings.tsx` header still describes wakes as "3 nested sub-arcs per ring,
merged per class into 3 paths". That is the reverted dead end `eb860615`; the code uses one
`ringWake` shader per ring inside one picture.
