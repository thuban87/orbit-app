# Lab A direction 1: refinement pass 1

**Date:** 2026-10-01.
**Target:** Pixel 6 Pro (`com.bwales.orbit.laba`), DEBUG build, Metro :8083. The change was JS-only, so no native rebuild was needed.
**Commits:** `c862c30a` (main pass) and `864f7e04` (tuning plus test). This doc and the evidence are in the commit that follows them.
**Evidence:** `evidence/pass-1/`. Numbering matches `evidence/direction-1/` for side-by-side comparison. Before/after composites are files 40–43.

**Bar:** "entering a polished game's interactive star-system map". After this pass the overview reads as a lit, tilted star system with people as the subject (40, 42, 43). It is no longer a ring wall over a glitchy backdrop.

## Outcome per priority

### 1. Nebula: fixed

- **SkSL fbm removed.** In its place is a CPU bake (`lab/nebula-bake.ts`): JS float64 value noise with an integer `Math.imul` hash, so there is no GPU precision anywhere.
- **Output.** It is baked once into a 256² premultiplied RGBA `SkImage` (`Skia.Image.MakeImage`) and drawn bilinear-upscaled under the existing parallax transform.
- **Shape.**
  - A soft diagonal band (gaussian, gently S-curved and noise-warped) carrying four large gas clouds.
  - Low-octave domain-warped fbm and a filament octave.
  - A dark dust lane just off the band centre.
  - Off-band sky is nearly void.
  - ±0.5 LSB dither stops 8-bit banding.
- **Strength.** Peak alpha is 0.32 in dark and 0.34 in light. Chart mode shades the pale wash 20% toward the grid ink, which gives a pencil-shading look.
- **Cache.** It is held in a module-level `Map` keyed by the ink values: at most one entry per palette and never disposed. It is a cache hit on every canvas remount, so there is no re-raster on tab return or Profile back. On the first bake only, it fades in over 450 ms (`withTiming` on a shared value, instant under reduced motion).
- **Device result.**
  - No faceting, seams or shards in any of the four palettes (01, 14, 16, 17).
  - Bake cost is about 140 ms for two palettes in node; it was not separately measured on device.
  - Tab-return to first content is about 1.2 s (screencap timing, two runs). Direction 1 measured 2–3 s blank. The remaining blank is the canvas remount itself in debug, not the nebula.

### 2. Hierarchy inversion (rings recede, people lead): done

**Each ring is now two draws** (`world-plane.ts`):

| Draw | Treatment | Width | Alpha |
|---|---|---|---|
| Full-circle **hairline** | Ink is `mix(grid, status, 0.55)` (0.6 in light), so the status tint is visible all the way round | status width × 0.42 (≈ 0.84 / 1.26 / 1.68 px) | 0.5 × the canonical status factor |
| **Status segment** at the body, full status colour | Sweep ramp 0 → 0.18 → 1 at the body → 0. Trail is `min(75°, progress)` behind the body (never past north), lead 14°. Never-contacted gets a symmetric ±21° segment with no direction implied | status width × 0.7 | — |

- Dashes stay `[6,6]` on both draws, and faded/faint-trace/neutral factors apply to both, so the line language is intact.
- **Removed:** the additive underglow, which turned dashed rings into "fuzzy beads"; the ~300° north→body trails; and the progress tick.
- **Sparse Systems:** hairline alpha ×1.7, fading to ×1 by 12 orbits, because at 2–3 orbits the rings are the only structure (13 vs 30).
- The `world-plane.test` pins were updated to the new language (one hairline plus one segment per contact, dash/width channels, alpha ratios, no additive strokes, segment span ≤ 89°).

### 3. Bodies: done

- **Presentation-only visual scale** (`bodyVisualScale`, `OrbitBody` transform): `clamp(21 dp / projectedRadius, 1, 1.6)`. At overview a ~13 dp body draws at ~21 dp, which is still inside the 22 dp minimum tap radius, so the visible disc is tappable. At identity zoom the projected radius is already ≥ 21 dp, so the scale is 1 and label anchors and exclusions stay correct.
- `radius`, `hitRadius` and label metrics are untouched. Taps were verified on device: tapping FF focused "Fay Fox", and tapping labelled Ada opened her Profile (02b), which is the correct Profile-vs-Focus behaviour.
- **Body shader:**
  - crisp status **edge line** (lit 0.95, night 0.4), which is now the status cue on photo bodies (it was a 1.5 px rim);
  - soft specular highlight in `orreryStarlight`;
  - wider two-part atmosphere (reach 1.5× the drawn disc);
  - night darkening 0.62 → 0.55.
- **Initials "C…" root cause: a real bug.** Hermes has no `Intl.Segmenter`, and `orreryInitials` early-returned the *full name*, which the disc then ellipsised. A code-point fallback now gives "CR", "EK". A test covers the missing Segmenter. Initials also render semibold. **This is a production bug in `src/logic/orrery-label-logic.ts`, independent of the lab. Harvest it.**
- **Edge pop (accepted, documented).** Visual extent is up to 1.6r disc × 1.5 halo, which exceeds the 1.3r culling reach. A body whose centre is just past the edge pops. Not observed as objectionable in stills.

### 4. Sun: done

- **New `SUN_DISC_SKSL`.**
  - White-hot `orreryStarlight` centre grading to the occupant `glowColor` at the limb.
  - Limb darkening.
  - Incommensurate low-amplitude granulation driven by the single clock (×0.00035, static under live reduced motion).
  - All coordinates are O(1), so it is precision-safe.
- **Identity preserved.** With no photo, the star surface replaces the flat swatch and the initials draw on top in a dark token (`background`; `textPrimary` in chart). With a photo, the photo stays and only a glowing limb band frames it. The status/glow rim was thinned from r+2 to r+1.
- The corona is unchanged. The self-sun on the test device has no photo or name, so the photo-frame path is **not device-verified**.

### 5. Contact shadows and grid: done

- Shadows: alpha × smoothstep(tilt / 0.45 rad), so they are invisible at tilt 0. Dark alpha is now 0.55, and the draw loop is skipped when alpha ≈ 0.
- Grid: inner reference rings and spokes are multiplied by `clamp(8 / N, 0.3, 1)`. The bezel is kept.

### 6. Default view tilt: implemented, **set to 45°**

- **Implementation.** `LAB_HOME_TILT_DEG` in `src/logic/orrery-camera-logic.ts` flows through `deriveHomePose`, so Home, Recenter and the switch destination all use it, and the frame, hit testing and homography stay exact. The fit divides by the near-side perspective scale and by cos(tilt). The `orrery-camera-logic.test` Home test was adapted to the experiment formula; at tilt 0 it is identical to the original. Focus keeps the current tilt, because `frameBodies` takes the pose orientation.
- **Device.**
  - 28°: barely perceptible, because the focal distance is about 4.65 × extent, so perspective is weak.
  - **45°: clearly a tilted plane.** It is the biggest single "star-system map" gain (compare 30/31 with 13/01). It also fits more of a 39-contact world on screen, because of foreshortening.
  - Taps verified exact at 45°.
  - Cost: at high counts bodies near the sun pack closer vertically.
- **ADR/decision finding: this REVERSES a recorded decision.**
  - `docs/dossier/milestone-2/phase-08-orrery-camera-scale-exploration-dossier.md` §C: "**[DECIDED]** Default/Home view is top-down, centered on the sun, with canonical north at the top."
  - The same dossier, §P: Recenter restores "top-down tilt".
  - `29-UI-SPEC.md` ORRC-04/05: "Home is sun-centered, top-down and north-up."
  - ADR-077 itself only establishes the constrained 2.5D camera; it does not pin the Home tilt.
- **Production decision.** A tilted Home is an **owner decision** (decision reversal). Within the lab it is an experiment constant; set it to `0` to restore the recorded behaviour.

### 7. Home framing: investigated, not fixed (camera logic, not presentation)

- **Low counts sit high** because `deriveHomePose` centres on the largest obstacle-free rect (`usableCameraRect`). With the selector row on top and the controls column bottom-right, that rect is the band above the controls, so its centre is well above the canvas centre.
- **Zoom is capped at 1**, so a 3-body System never fills the band.
- **At 39 contacts the readability floor** (`MIN_READABLE_RADIUS / minRadius`) deliberately lets outer rings run off-screen. This is a recorded rule: Phase 29 "fit until readability fails, then let outer rings extend offscreen".
- Both are camera/framing semantics, so they were not changed. The tilted Home partially mitigates the 39-contact case.

### 8. DEV marker doubling and logcat spam

- **Marker: fixed.** The "doubled" marker (12a) was the usable-rect anchor *jumping* when obstacles (the System sheet) appeared or vanished mid-switch. It is now pinned to the canvas's bottom-left. The switch recording (10) shows one stationary marker throughout.
- **`SkiaTextureView … LegacySurfaceTexture is not attached!` is not ours.**
  - The A/B with `DEEP_FIELD_ENABLED = false` (legacy renderer, fresh launch) gave **255 lines per 5 s** on the Orrery. Deep-field gave about 168 per 5 s. On Digest, with no canvas, it gave 0.
  - It is emitted on the UI thread whenever an RN-Skia canvas is mounted, so it is RN-Skia TextureView behaviour. Left alone.

### 9. Light / chart paper: kept first-class

- The same hierarchy inversion is in ink: tinted hairlines plus segments, the ink-hairline body halo, the engraved corona, and the paper-cored star disc.
- The lit-pool multiply dropped from 0.26 to 0.12; it read as a brown smear.
- See 14, 15, 16. The light wash is the nebula band, pencil-shaded.

## Constraints check

- **Frame worklet untouched.** There are no new captures; `orrery-frame-mapper.test` is green.
- **Single clock.** The new granulation consumer reads `useOrreryClock`.
- **Reduced motion.**
  - The live RM gate is applied to the sun granulation and the nebula fade.
  - On device with `transition_animation_scale=0` (18): no crash.
  - The scale was restored to 1 and verified.
- **Tokens.** All colours enter as uniforms or arrays from `ThemePalette`, and `check:colors` is green. The nebula bake uses only token RGBA.
- **Lazy compile.** `sunDisc` was added to `labEffect`.
- **Worklet order.** `bodyVisualScale`, `mixInk` and `segmentRamp` are declared above their callers, and the order test is green.

**Gates** (at `864f7e04`):
- `npx tsc --noEmit`: clean.
- `npm run check:colors`: exit 0.
- `npx vitest run src/components/orrery src/logic src/services/orrery-scene.test.ts src/theme`: **99 files, 1449 tests passed.**
- `src/screens` and `src/services`: 159 files, 1665 tests passed.

**Device settings restored:** Galaxy, Follow System, all animation scales at 1. Adb reverse 8081→8083 was left as found.

## Tunables chosen (`lab/deep-field-config.ts` unless noted)

| Group | Tunables |
|---|---|
| Nebula | `NEBULA_BAKE_SIZE 256`, `ALPHA 0.32/0.34`, `GAIN 1.8`, `BAND_ANGLE −0.62`, `BAND_WIDTH 0.11`, `DUST 0.75`, `CHART_INK 0.2`, `FADE_MS 450` |
| Rings | `RING_HAIR_SCALE 0.42`, `HAIR_ALPHA 0.5/0.55`, `TINT 0.55/0.6`, `SPARSE_BOOST 1.7` (by `COUNT 12`) |
| Segments | `SEGMENT_TRAIL 75°`, `LEAD 14°`, `SCALE 0.7`, `ALPHA 1/0.95` |
| Bodies | `BODY_VISUAL_MIN_RADIUS 21`, `VISUAL_MAX 1.6`, `EDGE 0.95/0.4`, `SPEC 0.22/0.12`, `HALO_REACH 1.5`, `SHADOW_MAX_DARK 0.55` |
| Sun | `SUN_GRANULE_SPEED 0.00035` |
| Shadows | `SHADOW_TILT_FULL 0.45 rad`, `SHADOW_ALPHA_DARK 0.55` |
| Grid | `GRID_DENSITY_REF 8`, `FLOOR 0.3` |
| Lit pool | `LIT_POOL_ALPHA_LIGHT 0.12` |
| Home tilt | `LAB_HOME_TILT_DEG 45` (`src/logic/orrery-camera-logic.ts`) |

## Tried and rejected (for DEAD-ENDS)

- **GPU SkSL value-noise fbm nebula** (direction 1, `NEBULA_SKSL`): faceted shards and a seam on Mali. Replaced by the CPU bake. Recoverable at `b450f47e:src/components/orrery/lab/deep-field-shaders.ts`.
- **`usePictureAsTexture` per mount** for the nebula: re-rasterised on every remount, causing the pop. Replaced by the module cache.
- **Additive ring underglow and north→body trails:** made the rings louder, and the dashed glow turned into beads.
- **First star-disc attempt** (`smoothstep` heat with a single `sin(x+y)` granulation term): read as a flat gold coin with diagonal stripes. Replaced by a μ-based heat and incommensurate cells.
- **Home tilt 28°:** too weak to read as tilted with this focal distance.
- **Chart nebula ink at 0.35 and lit pool at 0.26:** a dirty grey-brown wash in light mode.

## Remaining shortcomings (ranked)

1. **System switch still unjudgeable in debug.** There is a 4–5 s freeze, then a jump (10). Streaks, draw-on and flare need a release build plus a recording.
2. **Overlapping bodies at shared angles** (BB/CC in Lab Dense, both at about the same progress). The visual scale makes the overlap more visible, and the 45° tilt compresses vertical spacing. Possible fixes are a presentation-level depth separation or a small screen-space nudge. The `angle = progress` semantics are the constraint.
3. **Focus card covers the focused body and reticle** (pre-existing, 02). It is now the main thing hiding the best HUD element.
4. **Photos pop in after initials** on every remount (18). `useOrreryPhoto` deliberately never caches SkImages (D-41), so a fade-in or a cache is a design change there.
5. **Sun disc at identity zoom** (05) is a large, fairly uniform yellow. It could use stronger limb-to-glow contrast and a soft bloom that crosses the limb. The photo-sun framing path is not device-verified.
6. **Low-count Home sits high and small** (usable-rect centring, zoom ≤ 1). This is a camera rule, so it needs an owner/product decision.
7. **Satellites are still plain grey dots** (05). They were not touched this pass.
8. **Edge pop of the enlarged visual body and halo** beyond the 1.3r cull (accepted, item 3).
9. **Perf not measured** (debug only). The CPU bake is a one-off. Per-frame cost dropped slightly: no glow pass, no tick, and one arc instead of two per contact.

## Evidence (`evidence/pass-1/`)

| File | Content |
|---|---|
| 01 | Overview All Contacts (dark, Home tilt 45°) |
| 02 | Focus Ben Okafor (photo, satellites on) |
| 02b | Tap on labelled Ada opens Profile (semantics check) |
| 05 | Zoomed after clear focus (satellites, labels, sun at identity zoom) |
| 10 | Screenrecord All Contacts → Lab Inner Circle (debug freeze; single marker) |
| 11 | Lab Dense (32) |
| 13, 13a | Lab Inner Circle (dark) and its crop |
| 14, 15 | Galaxy-light All Contacts and Inner Circle |
| 16, 17 | Standard-light and standard-dark |
| 18 | Reduced motion on |
| 30, 31 | Home tilt 0° A/B (Inner Circle, All Contacts) |
| 40–43 | Before (direction 1) / after (pass 1) composites |
