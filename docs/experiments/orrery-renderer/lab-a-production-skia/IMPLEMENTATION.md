# Lab A: Implementation map (HEAD `978643c9`)

This is a file- and function-level map, detailed enough to rebuild the good ideas in a clean V2. Line numbers are HEAD's. "First" is the commit that introduced the item; "final" is the last one that reshaped it. Paths are under `src/components/orrery/` unless they start with `src/`. For the design view, read [ARCHITECTURE.md](ARCHITECTURE.md) first.

## 1. New files (`lab/`)

| File | Role | Key functions (line) | First → final |
|---|---|---|---|
| `LabScene.tsx` | The only Lab node in `<Canvas>`. It builds the sky resources, ambient time, the `scene`/`below`/`sun`/`reticle`/`top` mappers, the base-texture bake and the reticle lock timeline. | `LabScene` (152). Inside it: `ambient` (177), `sky` memo (210), `baseCache` and dispose (283–298), `scene` (301), `below` bake (396), `sun` (444), lock reaction (463), `reticle` (478), `top` (518) | `fd7f09c` → `5fb0f0d` |
| `scene-draw.ts` | UI-thread draw worklets: bodies, sky, Polaris, reorder ghost, labels, pips, uniform builders, ordering | `boundedLayer` 215, `drawDiscPhoto` 241, `bodyUniforms` 273, `coronaUniforms` 323, `sunDiscUniforms` 350, `orderBodies` 380, `fadeIn` 400, `drawContactBody` 407, `drawMoonBody` 473, `drawSunBody` 516, `drawSky` 621, `drawPolaris` 707, `drawReorderGhost` 730, `drawPlate` 766, `drawLabels` 814, `drawStackPips` 869, `focusDim` 906 | `fd7f09c` → `5fb0f0d` |
| `scene-specs.ts` | JS-thread spec builders: token RGBA, cached initials paragraphs, image size, fade stamps | `initialsParagraph` 41, `resourcePhotoPath` 82, `buildBodySpecs` 101 | `fd7f09c` |
| `world-plane.ts` | The whole plane: pool, grid, shadows, rings, moon orbits, ghosts, haze, switch FX. It holds the world-space path and the screen-space fallback. | `makePlaneShapes` 339, `minRadialScale` 392, `ringBand` 416, `ringPerimeter` 452, `ringWorldUniforms` 473, `circleMatrix` 536, `worldCircle` 560, `gridUniforms` 578, `drawWorldDisc` 621, `drawGrid` 637, `ringUniforms` 756 (fallback), `drawWorldPlane` 806, `affineAt` 275 | `0a73a54` → `5fb0f0d` |
| `deep-field-shaders.ts` | Six SkSL sources plus the lazy, memoised `labEffect` (457) | see §2 | `0a73a54` → `dc7f866` |
| `deep-field-math.ts` | Read-only math: homography, switch FX, body light, visual scales, reticle geometry | `bodyVisualScale` 78, `bodyDepthScale` 92, `moonVisualScale` 118, `reticleDrawnRadius` 144, `reticleGeometry` 160, `easeOutBack` 172, `computeSwitchFx` 208, `planeHomography` 267, `invertHomography` 300, `mapHomography` 324, `computeBodyLight` 347 | `0a73a54` → `0c0b18b` |
| `deep-field-config.ts` | Every Lab tunable (§4) | | `0a73a54` → `fd7f09c` |
| `deep-field-ink.ts` | Token → RGBA (`tokenInk` 32); `resolveDeepFieldInk` 47 (`chart` = background luminance > 0.5); `withAlpha` 64 (worklet) | | `0a73a54` |
| `nebula-bake.ts` | CPU nebula and module cache: `bakeNebulaPixels` 109, `nebulaCached` 203, `nebulaImage` 208 | | `c862c30` |
| `sky-resources.ts` | Star scatter (`seeded` sin-hash) and `recordStars` pictures (hero glow + spikes); `SKY_MARGIN = 140` | | `fd7f09c` (moved out of `DeepFieldBackdrop`) |
| `reticle-draw.ts` | `drawReticle` 49; `RETICLE_LOCK_END = 2` | | `3cd7695` → `fd7f09c` |
| `body-stack.ts` | `findStacks` 44: union-find over drawn-disc overlap | | `527bd5b` |
| `focus-card.ts` | Card placement: `focusClearance` 29, `focusCardRoom` 44, `focusLabelBlock` 104, `focusCardPlacement` 126, `focusCardLayout` 187 | | `527bd5b` → `0c0b18b` |
| `use-lab-photos.tsx` | Photo custody: `useLabPhotoCustody` 54, `LabPhotoSlot` 98, `disposeOnUI` 32 | | `fd7f09c` |
| `deep-field-mode.ts` | Experiment-only A/B store and `useDeepFieldEnabled` 27 | | `b1cfde3` |
| `LabHud.tsx` | DEV marker (`labMarkerVisible` 29: `__DEV__ && LAB_MARKER_ENABLED`). It is the only declarative Lab node left. | | `b450f47` → `c862c30` |
| `BodyOverlays.tsx` | **Dead at HEAD.** Declarative `BodyLightOverlay`/`SunCorona`/`SunDisc`, reachable only through props that `OrreryWorld` no longer passes. Delete in V2. | | `b450f47` → `3cd7695` |

Deleted in `fd7f09c`: `DeepFieldBackdrop.tsx`, `WorldPlaneLayer.tsx`, `BodyStackLayer.tsx`, `FocusReticleLayer.tsx`. To recover them, use `git show fd7f09c^:src/components/orrery/lab/<file>`.

## 1b. Modified existing files

| File | Change | Commit | Harvest class |
|---|---|---|---|
| `src/logic/orrery-camera-logic.ts` | Hoisted `projectionBasis` (529) / `projectWithBasis` (546): bit-identical arithmetic, one usable-rect derivation per frame. `projectFrame(…, ringPaths = true)` (575). `RING_SEGMENTS` exported. **`LAB_HOME_TILT_DEG = 45`** applied in `deriveHomePose` (263), whose fit divides by the near perspective scale and by `cos(tilt)`. | `ba3cef6`, `c862c30`/`864f7e0`, `5fb0f0d` | main-line fix (basis); owner decision K (tilt) |
| `src/logic/orrery-frame.ts` | `keyIndex` + `frameBody` (50, O(1), verified against the key) + `indexFrameKeys`; `billboardMap`/`billboardFromMap` (275/292); `ringPaths` pass-through | `842f1f3`, `5fb0f0d` | main-line fix |
| `src/logic/orrery-label-logic.ts` | `orreryInitials` (21): code-point fallback when `Intl.Segmenter` is missing (Hermes). Main returns the full name. | `c862c30` | **main-line bug** |
| `use-orrery-switch-runtime.ts` | `displayedSwitchCamera` (95): uses the live pose once settled (**stale-camera bug**); publish ships `world`/`generation` only; memoised return | `20538bd`, `842f1f3` | main-line fixes |
| `use-orrery-photo.ts` | `slot.release` (462) and the optional `handOff` argument (485/527): custody transfer without dispose | `fd7f09c` | needed by any imperative renderer |
| `OrreryWorld.tsx` | Narrow frame-worklet captures; stable empty defaults; moon components kept mounted while rows are withheld; Lab state: `switchFx`, `bodyLight`, `focusState`/`focusMix`, `planeRings`, specs written in render, `fadeTick`, custody `settle`, `labScene`, `ringPaths = !deepFieldOn`. The legacy tree is memoised per layer. | `842f1f3`, `3cd7695`, `fd7f09c`, `5fb0f0d` | mixed |
| `OrreryCanvas.tsx` | `backdrop`/`overlay` slots; memoised Canvas content (main re-recorded on every render); `opaque={!!backdrop}` → SurfaceView | `0a73a54`, `842f1f3`, `dc7f866` | memo = main-line fix; opaque = Lab |
| `OrreryFocusContext.tsx` | Lab layout through `focusCardLayout`; natural height from a wrapper `View` `onLayout` (the old `onContentSizeChange`/root-layout height stayed at 180 and clipped later rows); Lab cap 0.55 × canvas height; target key hoisted out of the per-body `find` | `527bd5b`, `3cd7695`, `0c0b18b` | measurement bug = main-line |
| `OrreryViewOptions.tsx` | "Lab A renderer (experiment)" switch | `b1cfde3` | experiment-only |
| `OrbitBody.tsx`, `SunBody.tsx`, `SatelliteBody.tsx`, `OrreryLabel.tsx` | Lab props/branches (dead at HEAD). `SatelliteBody` reads `billboardMap` (live, perf). **Legacy `SunBody` draw order changed:** the pulse halo is now drawn *before* the focus ring, so in legacy the ring sits on top of the halo; main drew the ring first. | `b450f47` … `fd7f09c` | strip in V2; check the SunBody order |
| `ProjectedOrbitRing.tsx` | `frameBody` lookups | `842f1f3` | main-line fix |
| `src/theme/theme-types.ts`, `theme-presets.ts` | Six tokens × four presets: `orreryVoid`, `orreryNebulaA`, `orreryNebulaB`, `orreryGrid`, `orreryStarlight`, `orreryShadow` | `202b0d6` | needs owner sign-off for production |
| `app.config.ts` | `com.bwales.orbit.laba`, "Orbit Lab A" | `6514a80` | experiment-only; revert |

## 2. Shader inventory (`lab/deep-field-shaders.ts`)

Colours arrive only as `half4` uniforms from tokens, premultiplied on output; there are no colour literals (`check:colors` = 0). Compilation is lazy through `labEffect(name)`, memoised, returns `null` on failure or under a mocked Skia, and every consumer has a plain fallback. Uniform builders must match the declaration order (`makeShader` throws on a mismatch); tests pin the lengths.

| Name (`labEffect` key) | Purpose | Uniforms (builder, count) | Geometry / precision notes |
|---|---|---|---|
| `CORONA_SKSL` (`corona`) | Sun corona: three angular sin harmonics (7/13/29) shape the edge, cubic falloff + exp bloom, white-hot core→glow; chart mode draws engraved rays and rings | `uR uTime uFlare uReach uChart uAlpha uCore uGlow` (`coronaUniforms`, 14) | Quad `±r·CORONA_EXTENT (2.7)`, screen blend (src-over in chart). Time = `ambient·0.00045`; fixed 1.7 under RM. No loops or hashes. |
| `SUN_DISC_SKSL` (`sunDisc`) | Star surface: μ-limb heat, three incommensurate warped-sine granulation octaves, intergranular network, chromosphere band; `uPhoto = 1` → only a limb band over the photo | `uR uTime uPhoto uAA uFlare uCore uGlow` (`sunDiscUniforms`, 13) | All coordinates O(1) (`q = p/uR`), so it is mediump-safe. Time = `ambient·0.00035`; fixed 2.3 under RM. |
| `BODY_SKSL` (`body`) | Overlay on each contact/moon disc: terminator (night ≤ `uShadowMax`), limb darkening, rim/edge line in the status hue, specular, far tint; outside r: atmosphere halo (dark) or ink hairline (chart) plus a separation keyline in background ink | `uR uL(2) uFar uAA uShadowMax uRimGain uHaloAlpha uHaloReach uChart uEdgeLit uEdgeNight uSpec uShade uRim uFarTint uSpecInk uKey uGap uKeyAlpha` (`bodyUniforms`, 35) | Drawn as a circle of radius `r·1.5` over the photo, so the photo is never resampled. Local units are world radius; AA = `0.6/scale`. |
| `RING_WORLD_SKSL` (`ringWorld`) | **Final ring path.** Hairline (far→near ink/alpha ramp) plus status segment composited in one draw; dashes, ink-in reveal, world angles | `uH0 uH1 uH2 (float3) uR uAA uN uReveal uNearDir(2) uFarA uHairW uHairA uInkFar uInkNear uSegW uSegA uStart uBody uSpan uDir uSegInk` (`ringWorldUniforms`, 36) | Drawn on a unit annulus `SkVertices` under `H·S(R)`. Per pixel: `p = u·R`, `w = H₂·p`, screen point, Jacobian `j`, `dist = |r−R|·|j|`. It exits before `atan` when `dist > max(widths)+AA`. World coordinates are O(10²–10³) in `float`; colours are `half`. |
| `GRID_SKSL` (`grid`) | **Final grid.** Reference circles (alpha ramps outward), spokes (inner→outer ramp, butt ends), double bezel, 120-tick dial (every fifth major) swinging with `uSpin` | `uH0 uH1 uH2 uS uAA uHalf uReach uStep uInner uOuter uBezelA uSpokeStep uTickStep uSpin uMinor uMajor uInk` (`gridUniforms`, 26) | One draw on a unit disc fan under `H·S(S)`. Radial and tangential screen scales come from the Jacobian, so all strokes are constant screen dp with 1-device-pixel AA. |
| `RING_SKSL` (`ring`) | **Fallback only** (pass 2): screen-space ring styling on stroked convex polygons. Mode 0 = hairline ramp, mode 1 = status segment | `uC uMode uN uNorth uReveal uFar uNear uFarA uStart uBody uSpan uDir uInkFar uInkNear` (`ringUniforms`, 23) | Uses only screen-coordinate differences and `atan`. |

**Removed:** `NEBULA_SKSL`, the GPU value-noise fbm. It faceted and showed a seam on Mali; recover it from `b450f47:src/components/orrery/lab/deep-field-shaders.ts`.

## 3. Algorithms

### 3.1 Nebula CPU bake (`nebula-bake.ts`)
- **Grid and arithmetic.** 256² premultiplied RGBA8, in JS float64. Value noise uses an integer `Math.imul` lattice hash. fbm rotates and scales each octave so lattice axes never align.
- **Band.** A diagonal gaussian band (angle −0.62, σ 0.11), S-curved and noise-warped.
- **Content.** Four gaussian clouds along the band; domain-warped gas (`smoothstep(0.3, 0.78)`); a ×(0.7+0.6·filament) octave; a thin dust lane just off centre (−75 %); a 5 % off-band haze.
- **Masking and colour.** A disc mask leaves the texture corners empty. Colour is A↔B by a second field. Dark mode adds starlight in dense cores. Chart mode shades 20 % toward grid ink. A ±0.5 LSB hash dither prevents banding.
- **Image and cache.** The result goes through `Skia.Image.MakeImage`. The module `Map` is keyed by the ink values, gives one entry per palette, and is never disposed. The first bake fades in over 450 ms.
- **Drawing.** Bilinear, at side `2·(half-diagonal + 140 dp)`, under the parallax transform.

### 3.2 Sky and parallax (`drawSky`)
- Each layer gets `translate(c + pan·factor, −tilt·slide)` → `rotate(−yaw)` → `scale(1 + log2(zoom)·k)`.
- The switch `kick` swings yaw. `velocity` stretches the near stars, and five warp copies scale by `level·0.014·v²`.
- **Quirk:** at rest (v = 0) `nearA` is replayed six times at the same transform. That compounds its alpha, and reproduces the declarative look, in which the twinkle opacity never applied. TW1/TW2 is pending with the owner.

### 3.3 Rings: strip meshes and the analytic stroke (`world-plane.ts`)
- **Bands.** `BAND_EPS[k] = 0.001·1.25^k`, k = 0…29, as 128-segment strips. The outer edge is multiplied by `1/cos(π/128)` so the polygon contains the true circle band.
- **`ringBand`.** `scale = minRadialScale(H, R)`, the smallest radial screen derivative over 8 samples. Then `half = max(hairW, statusW·0.7)/2 + 2`, `ε = half/scale/R·1.1`, and the narrowest band with ε_k ≥ ε is chosen. If none fits it returns −1, which selects the screen-space fallback.
- **Per ring:** `save; concat(circleMatrix(H,0,0,R)); drawVertices(bands[k], BLEND_DST, paint{RING_WORLD}); restore`. Blend is ignored because the vertices carry no colours.
- **Segment.** It runs from the body's world angle `θ = atan2(w.x, −w.y)` (inverse homography of the body). Trail = `min(75°, θ)`, never past north. Lead = 14°. A never-contacted body gets a symmetric ±21°. Depth alpha is `farAlpha + (1−farAlpha)·near`.
- **Dash count.** `round(perimeter/(2·6 dp))`. The perimeter comes from a 32-gon projection when `ringPath` is empty (`ringPerimeter`); the test bound is ≤ 0.5 % against the 128-gon.
- **Ink-in.** `drawOn = clamp((stage − 0.55·R/Rmax)/(1 − lag))`. While drawing, the reveal is `drawOn·τ` from north, and a glint is pushed at the head.
- **Focus emphasis.** The lit ring mixes hairline ink to full status at alpha 0.85 and width ×0.6. Other rings dim by 55 % (hairline) and 33 % (segment).

### 3.4 Homography derivation and tests
- **Derivation.** `planeHomography` is the closed form of `projectWithBasis`: `planeX = x·c − y·s`, `planeY = x·s + y·c`, `w = 1 − planeY·sin t/f`, `screen = centre + (planeX, planeY·cos t)·z/w`.
- **`circleMatrix(H, cx, cy, r) = H·T(cx, cy)·S(r)`** maps the unit n-gon `(sin a, −cos a)` onto the projected world circle. This is the same vertex set as `ringPath`.
- **Tests:**
  - `deep-field-math.test` "matches projectWorldPoint exactly…" (1e-6, plus the inverse);
  - `world-plane-camera.test` "H·T·S maps the unit ring polygon onto projectWorldPoint and the frame's ringPath" (three poses including tilt 1 rad, yaw 4);
  - "analytic radial screen scale matches a finite difference" (≤ 8 %);
  - "picks the narrowest band that still contains…";
  - uniform blocks against `RING_WORLD_SKSL`/`GRID_SKSL`;
  - "draws each ring as ONE drawVertices and the grid as ONE draw";
  - Lab frames without ring polygons keep positions, radii, depth and hit data;
  - the dash perimeter test.

### 3.5 Bodies (`drawContactBody`, `drawMoonBody`, `drawSunBody`)
- **Contact.** `scale = (frame.radius/r)·bodyVisualScale(projected)·bodyDepthScale(far)`. The visual scale grows small bodies toward 21 dp, at most ×1.6. The depth scale shrinks far bodies by up to 16 %.
- **Contact draw sequence:** status fill disc r → swatch disc (r − 1.5) → initials paragraph → photo (cover-fit, anti-aliased `clipRRect`, cross-fade 260 ms, `try/catch`) → `BODY_SKSL` overlay on a 1.5r circle (alpha = dim) → background veil `1 − dim` when focus-dimmed.
- **Fades.** A bounded layer is used only while alpha < 1 (mount fade 280 ms × frame opacity).
- **Moon.** A unit disc in `textSecondary` plus the body shader; minimum drawn radius 4.5 dp (×2.2 max). The hit radius stays the frame's (≥ 22 dp).
- **Sun.** Corona quad → limb line r+1 → `SUN_DISC_SKSL` (or photo + limb band) → initials in `background` (`textPrimary` in chart mode).

### 3.6 Label plates (`drawPlate`, `drawLabels`)
- The allocated rect is used exactly, from `allocations` (unchanged `allocateLabels`).
- **Plate:** a `surface` RRect (r 8) at alpha 0.9, a 0.75 dp `orreryGrid` border at 0.55, and a 2.5 dp status tick inside the left padding (ring hue; `textSecondary` for neutral).
- **Leader:** a hairline from the body edge (x clamped to `±radius` at `dx·0.5`) to the plate's mid-edge, `textSecondary` at 0.7, skipped if shorter than 2 dp.
- **Text:** the paragraph paints at `(x+8, y+4)`.
- **Context plate:** drawn under the name with no tick or leader.
- **Layering:** a bounded layer only while the label alpha is fractional.

### 3.7 Reticle (`reticle-draw.ts`, lock in `LabScene`)
- **Geometry** is in screen dp around the *drawn* disc (`reticleDrawnRadius`). Box half = `drawn + max(5, 0.16·drawn)`; arm = `clamp(0.34·half, 6, 15)`; stroke 2 dp.
- **Lock ring** at drawn + 3.5 dp (alpha 0.55) with four 4 dp cardinal ticks and a 0.8 rad scan arc at `ambient·0.0007` rad/ms.
- **Lock timeline.** `focus.generation` changes → `useAnimatedReaction` → `lock` 0 → 2, linear over 760 ms.
  - t ∈ [0, 1]: the brackets converge with `easeOutBack(t, 1.6)` from 1.9× spread and 45° rotation.
  - A flash (2.6× width, alpha 0.45) peaks at t = 1 ± 0.35.
  - t ∈ (1, 2): a ping ring expands to `0.9·drawn`.
  - The ring fades in over t 0.4 → 1.
- **Reduced motion:** already locked, no flash or ping, scan parked.
- **Focus state.** `focusState {keys, targets, generation}` is written **in the render** that receives the focus (`OrreryWorld` 375–401). The reticle, emphasis and dim therefore land in the same frame the camera starts. `focusMix` fades over 320 ms (instant under RM).

### 3.8 Switch FX (`computeSwitchFx` + `drawWorldPlane` §7)
- **Envelope.** `velocity` accelerates, holds, then settles quadratically. `flare` is a smoothstep bump around the capture window × (0.55 + 0.45·intensity). `kick = v·(0.5 + 0.5·intensity)`. Each entry gets a role (retained, leaving, entering, anchor) and a stage. The whole object is idle when progress ≥ 1, under RM, or for an RM choreography.
- **Trails.**
  - A per-key **world-space** history `[x, y, t]` is kept in UI scratch (`trails`, mutated in place). It holds 160 ms, or 340 ms for leaving bodies.
  - The trail is resampled in polar form about the sun, in steps of ≤ 0.06 rad, capped at 2.4 rad so the shape stays convex.
  - Each trail is one stroked path with a 3-stop linear-gradient alpha ramp, width `drawn·1.15·inner`.
  - Inner rings are thinned: `inner = clamp(screenRingR/(9·drawn), 0.3, 1)`.
  - Blend is plus in dark mode, src-over in chart mode.
- **Glints.** A radial gradient at each inking head.
- **Ripples.** Entering bodies ripple over stage 0.62–1; retained bodies ripple once over progress 0.8–1. Each ripple is a world circle `worldR·(1.15 + 2.6t)` with alpha `(1−t)²`.
- **Bezel and grid.** The bezel swings `0.42·v`, and the grid brightens ×(1 + 0.9v).
- **Sun.** `uFlare × 1.25` widens the corona; the disc heats up.

### 3.9 Stack pips (`findStacks`, `drawStackPips`)
- Candidates are visible, interactive contacts with opacity ≥ 0.5. Their *drawn* discs are grouped with union-find when the centre distance is less than `(rA + rB)·0.8`. Members are sorted nearest first.
- At the front body's upper right (angle −0.75, step 0.42), there is one pip (r 3.2) per hidden body in its ring ink, up to four; the fourth becomes a "more" ring.
- Pips are hidden while switch FX are active. Taps and positions are untouched.

### 3.10 Arrival ghosts (`drawWorldPlane` §5b)
- A frame contact whose key has no ring spec yet (component not mounted) draws three things:
  - a neutral disc at its drawn size (background mixed 45 % toward grid, alpha 0.92);
  - a 1.3 dp tinted hairline;
  - a neutral orbit hairline.
- Shadows are drawn only for mounted keys. Ghosts are not hittable.

### 3.11 Photo ownership and disposal
See ARCHITECTURE §8. The key invariant: an `SkImage` is disposed only on the UI runtime, after a spec write that no longer references it. A recorded picture holds its own reference.

### 3.12 Focus card (`focus-card.ts`)
1. **Clearance.** Clear the reticle box, or the label stack when the plate is on that side. The side is chosen as `allocateLabels` would choose it: below if it fits, else above.
2. **Placement.** Go below if the card fits; else above; else the roomier side with the height capped (minimum 112 dp, content scrolls); else clamp.
3. **Room.** `focusCardRoom` bounds the card only by obstacles under its own x-span.
4. **Narrow card.** If the centred 280 dp card would be capped, try a narrower card (≥ 168 dp, +44 dp height slack) beside each obstacle *below* the body, and keep the candidate that shows the most.

## 4. Tunables (most impactful; all in `lab/deep-field-config.ts` unless noted)

| Name | Value | Effect |
|---|---|---|
| `DEEP_FIELD_ENABLED` | `true` | Default of the A/B store |
| `LAB_HOME_TILT_DEG` (`src/logic/orrery-camera-logic.ts`) | 45 | Home/Recenter tilt, **both renderers**. 0 restores the recorded top-down Home. Owner decision K. |
| `AMBIENT_HZ` | 30 | Corona, granulation and scan redraw rate. Idle cost is roughly proportional to it. |
| `SPEC_FADE_WINDOW_MS` | 360 | How long re-records continue after a spec write (fades) |
| `BASE_TEXTURE` / `BAKE_SETTLE_MS` (`LabScene.tsx`) | true / 2 ticks − 1 ms | Base-texture cache on/off; how long the scene must stay static before it is baked |
| `BAND_EPS`, `BAND_MARGIN` (`world-plane.ts`) | 0.001·1.25^k ×30, 1.1 | Ring strip ladder (≤ 25 % wasted fragments per step) |
| `NEBULA_BAKE_SIZE`, `NEBULA_ALPHA_DARK/LIGHT`, `NEBULA_BAND_ANGLE/WIDTH`, `NEBULA_GAIN` | 256, 0.32/0.34, −0.62/0.11, 1.8 | Nebula size and strength |
| `*_PAN_PARALLAX` (nebula/far/near), `*_TILT_SLIDE`, `*_ZOOM_SCALE` | 0.035/0.05/0.12; 70/90/160; 0.025/0.035/0.09 | Sky depth layers |
| `STARS_FAR/NEAR_COUNT` (`_INK`), `STARS_HERO_COUNT` | 240/70 (90/26), 7 | Star density |
| `VIGNETTE_ALPHA_DARK/LIGHT`, `VIGNETTE_INNER` | 0.78/0.32, 0.42 | Edge burn |
| `GRID_RING_STEP`, `GRID_REACH`, `GRID_SPOKE/TICK_DEGREES`, `GRID_STROKE_PX` | 48, 1.12, 30/3, 0.9 | Astrolabe geometry |
| `GRID_DENSITY_REF/FLOOR` | 8 / 0.3 | Inner grid fades as the orbit count rises |
| `RING_HAIR_SCALE`, `RING_HAIR_ALPHA_DARK/LIGHT`, `RING_TINT_*`, `RING_FAR_ALPHA`, `RING_NEAR_TINT` | 0.42, 0.5/0.55, 0.55/0.6, 0.32, 0.35 | Ring hierarchy and depth |
| `RING_SPARSE_BOOST/COUNT` | 1.7 / 12 | Bolder hairlines in sparse Systems |
| `SEGMENT_TRAIL`, `SEGMENT_LEAD`, `SEGMENT_SCALE` | 75°, 14°, 0.7 | Status segment |
| `RING_DASH` | 6 dp | Dash language (wobble and rogue) |
| `BODY_VISUAL_MIN_RADIUS/MAX`, `BODY_FAR_SHRINK` | 21 dp / 1.6, 0.16 | Presentation-only body size |
| `BODY_SHADOW_MAX_*`, `BODY_RIM_*`, `BODY_EDGE_LIT/NIGHT`, `BODY_SPEC_*`, `BODY_HALO_REACH/ALPHA_*`, `BODY_KEYLINE_DP` | 0.55/0.36, 0.85/0.7, 0.95/0.4, 0.22/0.12, 1.5 / 0.5/0.8, 1.6 | Lighting |
| `SHADOW_TILT_FULL`, `SHADOW_ALPHA_*`, `SHADOW_LENGTH/WIDTH/OFFSET` | 0.45 rad, 0.55/0.16, 2.6/1.05/1.1 | Contact shadows (invisible at tilt 0) |
| `HAZE_ALPHA_*`, `LIT_POOL_*` | 0.5/0.55; 0.16/0.12, reach 0.85 | Aerial perspective, sun-lit pool |
| `CORONA_EXTENT/SPEED`, `SUN_GRANULE_SPEED`, `FLARE_GAIN` | 2.7/0.00045, 0.00035, 1.25 | Sun |
| `RETICLE_*`, `RETICLE_LOCK_*`, `FOCUS_*` | see §3.7; fade 320, ring dim 0.55, body dim 0.22 | Focus |
| `GHOST_*`, `BODY_ENTER_FADE_MS`, `PHOTO_FADE_MS` | §3.10; 280; 260 | Arrival and resolve |
| `TRAIL_*`, `INK_IN_SPREAD`, `PULSE_*`, `BEZEL_SPIN`, `GRID_FX_GAIN`, `WARP_COPIES/STEP`, `SWITCH_SKY_KICK`, `SWITCH_STAR_STRETCH` | §3.8; 0.16; 0.06 | Switch "jump" |
| `STACK_*` | 0.8, r 3.2, max 4, step 0.42, angle −0.75 | Pips |
| `FOCUS_CARD_MIN_HEIGHT/NARROW/NARROW_SLACK` (`focus-card.ts`); `LAB_CARD_MAX_FRACTION`, `CARD_CHROME` (`OrreryFocusContext.tsx`) | 112, 168, 44; 0.55, 24 | Focus card |

**Unused leftovers at HEAD:** `STREAK_*` (5), `TWINKLE_MIN/MAX/SPEED` (the Lab copies; `OrreryCanvas` has its own), `WARP_ALPHA`, `HAZE_GLOW_ALPHA` and `PLANE_ARC_STEP`. Comment drift: `AMBIENT_HZ` says "0 under live reduced motion" (the code uses −1); `CORONA_SKSL` says "uTime is 0 under reduced motion" (the code uses 1.7); the base-texture comment in `LabScene` still cites stroked-polygon tessellation, which the camera pass removed.

## 5. Experiment-only infrastructure
`app.config.ts` package/name; `deep-field-mode.ts` and the View options row; `LabHud` (DEV only); `tools/seed-lab-a.py`, `tools/ui.py` and `tools/shot.sh`; probe patches kept as evidence text, not in `src`.

## 6. Tests added and changed (and why)

| Test | Status | Pins |
|---|---|---|
| `lab/lab-scene-render.test.tsx` | new (`fd7f09c`) | The Canvas tree is one Group of five pictures with a node count independent of body count, so per-body nodes cannot creep back. The reticle picture is reference-stable when nothing is focused (no idle redraw). Moon ink is `textSecondary` and the moon is hidden at overview. Depth order flips with yaw and the sun is in its own picture. A name plate is drawn only once allocated. |
| `lab/scene-draw.test.ts` | new (`fd7f09c`) | Body, corona and sun-disc uniform lengths equal their SkSL declarations. `orderBodies` reproduces the zIndex flush (depth, source-order ties, absent keys skipped). Linear fades, instant under RM. Focus dim. |
| `lab/world-plane-camera.test.ts` | new (`033e751`, extended `5fb0f0d`) | Homography/circle matrix ≡ `projectWorldPoint` ≡ `ringPath`; radial-scale accuracy; band choice; `RING_WORLD`/`GRID` uniform blocks; one `drawVertices` per ring, one grid draw, no stroked ring paths; ring-less frames keep the same hit data; 32-gon perimeter within 0.5 %. |
| `lab/world-plane.test.ts` | new (`0a73a54`, revised in passes 1 and 2) | Canonical ring language (one hairline plus one segment per contact; dash, width and alpha channels); no path effects or ellipse ops; chart mode has no additive blend; trails only while FX are active. These run on the **screen-space fallback** (mocks). |
| `lab/deep-field-math.test.ts` | new (`0a73a54`) | Homography exactness and inverse; switch FX idle and bounds; body light toward the sun, no far tint at tilt 0, frame never mutated |
| `lab/pass2-presentation.test.ts`, `lab/pass3-presentation.test.ts` | new (`527bd5b`, `0c0b18b`) | Stacks group without moving anything; card placement and capping; reticle geometry and drawn radius vs the body scale; `easeOutBack`; card vs label plate; obstacle-aware room; narrow card |
| `src/logic/orrery-camera-logic.test.ts` | changed (`ba3cef6`, `c862c30`) | `projectFrame` ≡ `projectWorldPoint` **bit-for-bit**, and invalid input still throws. The Home test was adapted to the tilt formula; it is identical at tilt 0. |
| `src/logic/orrery-frame.test.ts` | changed (`842f1f3`) | `frameBody` ≡ `find`; safe on filtered frames; a Proxy proves `billboardPose` touches ≤ 1 body; `billboardFromMap(billboardMap(f))` ≡ `billboardPose` |
| `orrery-frame-mapper.test.ts` | changed (`842f1f3`, `5fb0f0d`) | Now also **fails** on a `switchRuntime`/`scene`/`resources` capture. `available` includes `ringPaths`. The no-`camera` and settles-after-publication assertions are unchanged. |
| `orrery-switch-runtime.test.ts` | changed (`20538bd`) | Three stale-camera tests; the first two fail on the old code. |
| `orrery-render.test.tsx` | changed (`b450f47` → `fd7f09c`) | Now pins the **legacy** declarative tree only. |
| `orrery-worklet-order.test.ts` | changed (`0a73a54`) | Also scans `lab/` for Hermes forward references. |
| `use-orrery-photo.test.ts` | changed (`fd7f09c`) | `release` hands custody over exactly once and never disposes. |
| `src/logic/orrery-label-logic.test.ts` | changed (`864f7e0`) | Two initials without `Intl.Segmenter`. |
| `src/theme/theme-presets.test.ts`, `src/services/orrery-scene.test.ts` | changed | Six new scalar tokens; one mock for the custody module. |

State at HEAD: `npx vitest run src/components/orrery src/logic/orrery-*` → 38 files, 313 passed (run while writing this package).
