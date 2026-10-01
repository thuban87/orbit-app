# Direction 1: Deep-field star chart (implementation notes)

Branch `experiment/orrery-skia-production`. Commits:

| Commit | Contents |
|---|---|
| `202b0d6c` | `feat(lab-a): deep-field star-chart theme tokens` |
| `0a73a54c` | `feat(lab-a): deep-field environment and world-plane astrolabe` |
| `b450f47e` | `feat(lab-a): lit bodies, sun corona, instrument HUD, switch jump wiring` |
| this doc | `docs(lab-a): direction-1 implementation notes` |

All new renderer code is in `src/components/orrery/lab/`. Every tunable is at the top of `lab/deep-field-config.ts`.

**A/B switch:** set `DEEP_FIELD_ENABLED = false` in that file to restore the pre-Lab flat renderer. That brings back the legacy rings, starfield, sun halo and focus ring.

**Not verified on a device.** The SkSL was compiled, and the whole plane/body/corona pipeline rendered, off-device with CanvasKit 0.41 (`node_modules/canvaskit-wasm`). The harness is in `_notes/canvaskit-previews/harness/` and the images in `_notes/canvaskit-previews/`. Those images use CPU raster with a fake photo gradient and synthetic data, so treat them as the *intended look*, not evidence.

## Guard-rails held

- **`frame` is only read.** The frame worklet in `OrreryWorld.tsx` is byte-identical: same captures, and `camera` is not captured. `orrery-frame-mapper.test` is green.
- **New per-frame data comes from separate mappers in `OrreryWorld`:**
  - `switchFx` comes from `computeSwitchFx(transition, progress, reducedMotion)`.
  - `bodyLight` comes from `computeBodyLight(frame, extent)`.
  - `sunFlare` is a plain number.
- **Visual extents never change hit or label metrics.**
  - `radius`, `hitRadius` and label width/height are untouched.
  - Plates draw in the exact allocated rect.
  - The body halo stays inside 1.28r, below the 1.3r culling reach.
  - The corona fades out by 2.7r. Because the sun's culling reach is 2r, it can pop at the screen edge (see the risk list).
- **Colours.**
  - Every hue is a `ThemePalette` token.
  - Shaders get colours as `half4` uniforms built by `tokenInk()` from `Skia.Color(token)`.
  - The SkSL contains no colour constants; numbers in it are noise and falloff values only.
  - Six new tokens exist in all four presets: `orreryVoid`, `orreryNebulaA`, `orreryNebulaB`, `orreryGrid`, `orreryStarlight` and `orreryShadow`.
  - They are added to `SCALAR_TOKENS` in `theme-presets.test.ts`.
  - `check:colors` is green. The helper was named `tokenInk` because `tokenRgba(` trips the gate's case-insensitive `rgba(` regex.
- **One clock.**
  - `useClock` still exists only in `OrreryCanvas`.
  - New clock consumers are twinkle A/B, the corona `uTime` and the reticle spin. Each one reads `useReducedMotionShared().value` inside its worklet and goes static under live reduced motion.
- **Lazy shaders.** `labEffect(name)` compiles on first use, memoises the result and returns `null` on failure or when Skia is mocked. Every consumer has a plain fallback.
- **Worklet ordering.** Helpers are declared above their callers. `orrery-worklet-order.test` now also scans `lab/`.
- **Nothing per-frame is heavy.**
  - The nebula is baked once per mount to a GPU texture (`usePictureAsTexture`).
  - The stars are three `SkPicture`s recorded once.
  - The plane picture re-records only when `frame` or `switchFx` changes. Ambient clock ticks just replay it.

## Per hypothesis item

### 1. Environment (`lab/DeepFieldBackdrop.tsx`, rendered via the new `OrreryCanvas` `backdrop` slot)

**Nebula** (`NEBULA_SKSL` in `deep-field-shaders.ts`)
- Domain-warped value-noise fbm with 5 octaves. A diagonal "galactic band" mask, a wisp octave and dark dust lanes are layered on it.
- Chart mode replaces the gas with a pale wash plus density contour isolines in `orreryGrid` ink.
- It is rendered once into an `SkPicture`. `usePictureAsTexture` turns that into a square GPU texture whose side is `2 × (half-diagonal + 140 dp)` × `NEBULA_TEXTURE_SCALE` (0.75).
- It is drawn as one `<Image>` with linear sampling under a parallax transform.
- The texture size object is memoised, because `usePictureAsTexture` re-rasterises whenever its `size` changes identity.

**Stars**
- There are three pictures: far (240) and near A/B (70 split in two). Light mode uses 90 and 26.
- Stars are scattered uniformly over a disc, so yaw rotation never exposes a corner.
- Seven "hero" near stars get a glow plus diffraction spikes (dark mode only).

**Parallax** (all in `sky`, one derived value)
- Pan comes from `frame.center − viewport centre`, scaled ×0.035 (nebula), ×0.05 (far stars) and ×0.12 (near stars).
- The sky rotates by the full yaw (`SKY_YAW_FACTOR` 1).
- Tilt slides the layers up by 70, 90 and 160 px per radian respectively.
- Zoom scales them by `1 + log2(zoom) × 0.025 / 0.035 / 0.09`.

**Twinkle and vignette**
- Twinkle is two opposite-phase group opacities in the band 0.45–1.
- The vignette is a screen-fixed radial gradient of `orreryVoid`, with edge alpha 0.78 (dark) or 0.32 (light).

**Cost per frame:** one full-screen bilinear image draw, three picture replays, one full-screen gradient, and three cheap mappers. These run only when the camera moves or the clock ticks.

### 2. World plane / astrolabe (`lab/world-plane.ts` `drawWorldPlane`, `lab/WorldPlaneLayer.tsx`)

**The homography.** `planeHomography(pose, viewport)` is the exact `projectWorldPoint` homography (SUBSYSTEM-BRIEF §2.5). It is built from the frame's clamped pose and the usable-rect centre. `deep-field-math.test.ts` asserts that `H·p` matches `projectWorldPoint(p)` to 1e-6 across poses, obstacle viewports and the inverse.

**Drawing.** The whole layer is recorded as one picture inside `canvas.concat(H)`, in world units:
- a sun-lit pool: additive in dark mode, multiply in light mode;
- concentric reference rings every 48 world units;
- spokes every 30°;
- a bezel double ring with ticks every 3° (every 5th tick is major), out to `extent × 1.12`.

**Line weight.** Strokes are authored as `px ÷ zoom`, so perspective makes the near side thicker and the far side thinner. The grid alpha fades with distance through a radial gradient in local (world) space.

### 3. Orbits as instruments (same picture)

**Rings**
- Each ring is a true world circle (`ringRadius / zoom`).
- Core width is `status width × 0.72`. The 2/3/4 CVD channel is preserved.
- Dashes are `[6, 6]` screen px, applied to wobble and rogue.
- Status alpha factors are unchanged (faded 0.7, faintTrace 0.3, neutral 0.5). They are pinned in `lab/world-plane.test.ts`, which replaces the old structural "every ring child is a path" pin.

**Depth attenuation.** A per-ring linear gradient runs along the world direction of camera depth, `(sin yaw, cos yaw)`. The far side alpha floor is 0.32 at full tilt. Dark mode adds an additive underglow (×3.0 width, 0.12 alpha).

**Progress trail**
- Each contact's world angle comes from the inverse homography of its frame position.
- An arc from north (12 o'clock, where interval progress starts) to that angle is drawn twice with a rotated sweep-gradient ramp: a 5.5 px soft band and a 1.6 px core.
- It is additive in dark mode and source-over in light mode.
- Never-contacted bodies get no trail.

**Progress tick.** A short radial tick sits where the body's angle crosses its ring, which makes decay and rogue drift legible.

**Cost:** about N gradient shaders plus 2–5 stroke draws per contact per camera-change frame. That replaces the old per-frame N × 128-point `SkPath` rebuilds and N mappers. The frame still computes `ringPath`, which is left untouched for `ReorderGhost`.

### 4. Bodies lit by the sun (`lab/BodyOverlays.tsx` `BodyLightOverlay` + `BODY_SKSL`; shadows in the plane)

**Lighting overlay**
- One circle of radius 1.28r is drawn over the photo or initials inside the body's root Group. The photo itself is never resampled.
- Inside r it draws:
  - a sun-facing terminator, with max darkening 0.62 (dark) or 0.36 (light);
  - limb darkening;
  - a lit-side rim crescent in the status `bodyFill`;
  - a `uFar` far-depth tint toward `orreryVoid` (0 at tilt 0, up to 0.38).
- Outside r it draws an atmosphere halo: a cubic falloff in dark mode, or a crisp ink hairline in chart mode.
- The light direction is the screen vector body→sun, taken from `computeBodyLight` (one pass per frame).

**Contact shadow.** An elliptical radial-gradient shadow is cast on the plane, outward away from the sun. It uses world coordinates under H, so it foreshortens with tilt. Its alpha is 0.7 in dark mode, and 0.16 multiply in light mode.

### 5. Sun as a star (`SunCorona` + `CORONA_SKSL` in `SunBody`)

- The corona uses a white-hot `orreryStarlight` core grading to the occupant `glowColor`, so a contact-sun's status hue is preserved.
- Its edge is shaped by three animated angular harmonics (no loops) and surrounded by an exponential bloom. It is drawn on a 2×2.7r quad with `screen` blend.
- `uTime` comes from the single clock (`× 0.00045`). It is a fixed phase under reduced motion, so the corona is still shaped but static.
- In chart mode the corona becomes engraved rays plus concentric rings in amber ink.
- The legacy pulse halo is disabled (it returns 0) when deep-field is on. The status rim circle is kept.

### 6. HUD language

**Focus reticle** (`FocusReticle`)
- Four accent corner brackets plus a thin accent circle.
- It spins slowly (0.0003 rad/ms) off the clock and is static under reduced motion.
- The accent arrives through the `focusColor` prop, so the accent role contract is unchanged.

**Instrument plates** (`OrreryLabel`)
- The plate is the same `surface` RoundedRect at 0.9 alpha, plus a hairline `orreryGrid` border.
- A 2.5 px status tick in the ring hue (`textSecondary` for neutral) sits inside the left padding.
- A leader hairline runs body edge → plate across the existing 8 px gap.
- The root is still `Group layer={<Paint opacity/>}`, so the render-test label alpha pin is unchanged.

**Not done.** Small caps and tabular figures would change native-measured label metrics, and therefore allocation and Profile-vs-Focus, so they were deliberately skipped.

**DEV marker** (`LabHud`). "ORRERY LAB A — PRODUCTION SKIA", 9 px Inter 600, at the top-left of the usable rect, gated on `__DEV__ && LAB_MARKER_ENABLED`. It is **not visible in release builds**.

### 7. System switch as a jump

**`computeSwitchFx`**
- It is idle (a constant all-zero object) when progress ≥ 1, under live reduced motion, or when `transition.reducedMotion` is set.
- Otherwise it provides:
  - `velocity` (the same accelerate/hold/settle shape, from the exported stage constants);
  - `flare` (a bump centred on the capture window, scaled by intensity);
  - `kick`;
  - per-entry role and stage (shed or capture, with the stagger applied).
- `orrery-switch-choreography.ts` is untouched.

**Visible effects**
- **Streaks:** world-space arcs trailing every non-anchor body along its spin. Length is `0.55 rad × velocity`, ×1.5 for leaving bodies. Butt caps avoid a sweep-wrap artifact.
- **Entering rings** draw on clockwise from north as their capture stage runs.
- **Sun flare** adds `uFlare × 1.25` to the corona reach and bloom.
- **Starfield/nebula kick:** a yaw swing of `kick × 0.16 rad` plus a near-star stretch.
- Departing bodies dim through the choreography's own opacity; no extra dimming was added.

**Under reduced motion** there are no streaks, flare or kick, only the choreography's crossfade.

### 8. Light modes as "chart paper"

- `chart` is chosen by background luminance (> 0.5), so it works for galaxy-light and standard-light without a new prop.
- No blend is additive in chart mode. This is asserted in `world-plane.test`.

| Element | Chart-mode treatment |
|---|---|
| Nebula | Contour isolines |
| Grid | Ink |
| Rings | Ink, no glow |
| Trails | Source-over |
| Shadows | Multiply |
| Halo | Ink hairline |
| Corona | Engraved |
| Stars | Sparse ink dots, no heroes |
| Vignette | Paper-edge burn |

## Tests changed

| Test | Change |
|---|---|
| `orrery-render.test.tsx` | Added Skia mocks (`Picture`, `Rect`, `Shader`, `createPicture`). The ring Group's assertion "every child is a `path`" became "the Group holds exactly one `picture`". **Relaxed**, because the N ring Paths no longer exist. The semantic content moved to the new `lab/world-plane.test.ts`. All other pins are unchanged: tree order, consecutive body Groups with `layer`, the zIndex flip, the moon token, the ghost accent, Polaris and label alpha by level. |
| `orrery-worklet-order.test.ts` | Now also scans `lab/`. |
| `theme-presets.test.ts` | Six new tokens added to `SCALAR_TOKENS`. |
| New | `lab/deep-field-math.test.ts` (homography exactness and inverse, switch FX idle and bounds, body light). `lab/world-plane.test.ts` (status line language, chart has no additive blend, streaks only while active). |

## Gates (at `b450f47e`)

- `npx tsc --noEmit`: clean.
- `npm run check:colors`: exit 0.
- `npx vitest run src/components/orrery src/logic src/services/orrery-scene.test.ts src/theme`: **99 files and 1448 tests passed, 0 failed.**

## Uncertain on device: what the reviewer should scrutinise

1. **Shader compile on Android Ganesh.** If any effect returns null, the fallbacks render silently: no body lighting, a plain circle sun halo, or no nebula. Check `adb logcat` for RuntimeEffect errors, and check that the nebula and corona actually appear.
2. **Nebula strength in galaxy-dark.** It may compete with the status ring hues (alpha 0.8). Check whether it looks muddy upscaled from a 0.75× texture, and whether the band reads as intended. Tune `NEBULA_ALPHA_DARK`, `NEBULA_FREQUENCY` and `NEBULA_TEXTURE_SCALE`.
3. **Perspective stroke behaviour.** At max tilt, check:
   - whether near-side rings and grid get too thick;
   - whether dash spacing (world-space) looks right;
   - whether hairline grids shimmer or alias while panning.
   Also check that grid and bezel geometry never shows a horizon artifact when panned to a corner at max tilt (geometry is kept within 1.12 × extent).
4. **Ring and trail density at 30–40 contacts.** Check whether the trails make Home look busy. `RING_GLOW_ALPHA` and `TRAIL_ALPHA_DARK` are the dials.
5. **Photo recognisability under lighting.** Night-side darkening reaches 0.62 in dark mode. Check real photos at overview and identity zoom.
6. **Corona pop.** The sun's culling reach is 2r, but the corona extends to 2.7r. When the sun is just off-screen the corona disappears abruptly.
7. **Per-frame picture allocation** (`WorldPlaneLayer`, a new `SkPicture` per camera-change frame). Watch memory and GC hitches during long pans and repeated switches. Get a release-build gfxinfo on the physical phone.
8. **Switch:** whether streaks read as motion blur or clutter; whether entering-ring draw-on and the flare land at the right moment; and that reduced motion shows no streaks, flare or kick.
9. **Light modes:** whether ink contours, the engraved corona and halo hairlines read as deliberate "chart paper" rather than a washed-out dark mode, especially in standard-light.
10. **Labels:** whether the plate border, status tick and leader stay legible in all four palettes, and whether the leader misplaces when a plate is shifted ±8 px.
11. **Marker:** only visible in DEV builds. Confirm it is clear of the System selector.
12. **New ambient motion** (corona harmonics, reticle spin, two-phase twinkle) is a recorded-decision change under ADR-077, which says the starfield and sun pulse are the sole ambient motion. That is fine in the lab, but production needs owner escalation, so it belongs in HARVEST.
