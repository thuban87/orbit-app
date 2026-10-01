# Lab B — Implementation reference

This is the file, function, shader and algorithm map for reproducing the good ideas. Paths
are relative to the repo root. SHAs are the commits that introduced each item (checked with
`git log -S`). The state described is `bfc8f36c`; **R3 polish is PENDING**, and R3 has
uncommitted edits in `OrreryWorld.tsx`, `LabFxPanel.tsx`, `orrery-frame-mapper.test.ts` and
`orrery-labb-fx-store.ts` that are *not* described here.

## 1. Shared model half: perf fixes that apply to BOTH renderers

| Change | Where | SHA | Notes |
|---|---|---|---|
| Frame worklet captures only shared values and scalars | `src/components/orrery/OrreryWorld.tsx` (`switchTransition`, `switchProgress`, `switchCameraFrom/To`, `sceneGeneration`, `sceneExtent`, `memberIdentities`, `NO_IDS`/`NO_RELATIONS`/`NO_SATELLITES`, content-keyed `clusterIds`) | `ea137306` | Test map extended in `orrery-frame-mapper.test.ts`. |
| Prepared-paragraph cache by `role\|width\|text` per provider/colours/fontScale; unused keys dropped (left to GC) | `OrreryWorld.tsx` `textCache` / `labels` memo | `83c9033a` | Fixed the 800+ body Hermes SIGSEGV. |
| Allocation key → index map per run (first match wins, like `find`) | `OrreryWorld.tsx` `allocations` | `83c9033a` | |
| `deriveSatelliteBodies` via maps (`memberKeys`, `parents`, `seen`) | `src/logic/orrery-satellite-logic.ts` | `83c9033a` | Same result. |
| `projectFrame` per-frame constants hoisted (`projectionCenter`, yaw/tilt trig, focal) | `src/logic/orrery-camera-logic.ts` | `89c2f1dd` | Bit-identical (camera-logic tests). |
| `projectFrame(…, ringPaths: boolean \| number)` and `projectAnimatedFrame(…, ringPaths)`; frame worklet capture `ringPathMode` | `orrery-camera-logic.ts`, `src/logic/orrery-frame.ts`, `OrreryWorld.tsx` | `30026fda` | Lab-only benefit (legacy still needs paths). |
| `sampleSwitchSignal`, `sampleSwitchEntry`, `entryWindow` (pure exports; choreography constants unchanged) | `src/logic/orrery-switch-choreography.ts` | `30026fda` | Tests in `orrery-switch-choreography.test.ts`. |
| `fxTap` side-stamp in `resolveTap` / `onNorth` | `OrreryWorld.tsx` | `c8a82eaf`, `11c21745` | C-20 / C-54. |
| `probeStart/End` in the frame and allocation worklets | `OrreryWorld.tsx` | `bba4cf5b` | C-65, debug. |

**Production bug found and NOT fixed in shared code.**

- `src/logic/orrery-label-logic.ts` `orreryInitials` returns the **whole name** when
  `Intl.Segmenter` is missing.
- On the emulator's Hermes it is missing. The legacy body then renders the full name in a
  one-line ellipsised paragraph ("El…") instead of initials.
- The lab works around it in `LabBodies.tsx` `labInitials`: it takes the first code point of
  each of the first two words (C-23).

## 2. Lab renderer files (`src/components/orrery/labb/`)

| File | Role | Key functions / constants | First SHA |
|---|---|---|---|
| `LabBRenderer.tsx` | Composes layers; owns `frameIndex`, `fxFlags` mirror, switch signal / roles / sky hue, focus state, photo map, R2 stage wiring; `memo` with `sameContract` | `LabBRenderer`, `LabRenderContract`, `sameContract`, `sameElement` | `c8a82eaf` (memo `3c0f691b`) |
| `LabCanvas.tsx` | `GestureDetector` + `Canvas opaque`; the one pausable clock; warm-up; contexts | `useLabClock`, `WarmUp`, `WARMUP_MS` 400 | `c8a82eaf` (idle clock `bba4cf5b`) |
| `labb-context.ts` | `LabRenderContext` (with clocks) and `LabStillContext` (no clocks) | `useLabRenderContext`, `useLabStillContext` | `c8a82eaf`, `83c9033a` |
| `labb-clock-logic.ts` | Does anything ambient need the clock? | `labAmbientNeeded` | `bba4cf5b` |
| `labb-effects.ts` | All SkSL sources; lazy, memoised, `try`-guarded loader; force-fallback; zero-uniform builder | `LAB_EFFECT_SOURCES`, `getLabEffect`, `WARMUP_EFFECTS`, `WARMUP_FILTERS`, `zeroUniforms`, `labEffectStatuses` | `c8a82eaf` |
| `labb-uniforms.ts` | Token → vec3/vec4 (`Skia.Color`, memoised), numeric mixes | `tokenToVec4`, `tokenToVec3`, `mixVec`, `withAlpha` | `c8a82eaf` |
| `labb-frame-index.ts` | key → index per frame; billboard transform; scale-0 culling | `indexFrame`, `bodyAt`, `labBillboard` | `c8a82eaf` |
| `labb-sky.ts` | Sky parallax from the animated frame only; star-field generation | `labSkyPose`, `skyLayerPlacement`, `placeSkyPoint`, `buildStarField`, `starTileSize` | `54188b10` |
| `LabEnvironment.tsx` | Nebula bake/sample/live; mid+near star Atlas; streak Atlas; fallbacks | `NebulaBaked`, `NebulaLive`, `StarAtlas`, `StarStreakAtlas`, `Starfield`, `nebulaFrameUniforms` | `54188b10`, `79cc89eb` |
| `labb-bodies-logic.ts` | Status materials; light direction; haze; per-frame uniform blocks (float4-packed); sun glow cap | `labBodyMaterial`, `labLightDir`, `labHaze`, `labBodyFrameUniforms`, `labSunFrameUniforms`, `SUN_GLOW_CAP_DARK` | `469440db`, `0922d223`, `80852701` |
| `LabBodies.tsx` | Component-path bodies (A/B), the declarative sun, moons, initials | `LabContactBody`, `LabSunBody`, `LabMoon`, `labInitials`, `labContactStatic` | `c8a82eaf`, `469440db` |
| `labb-layer-plan.ts` | Pure per-frame draw plans for the pictures; uniform flattening in SkSL declaration order | `uniformOrder`, `flattenUniforms`, `planBodyDraws`, `planLabelDraws`, `hudTagPlacement` | `038a8d97` |
| `LabLayerPictures.tsx` | Bodies + moons picture, labels picture, photo probes, point LOD, size floor, card occlusion, text-only defocus | `LabBodiesPictures`, `LabLabelsPicture`, `LabPhotoProbes`, `coverShader`, `drawContact`, `drawMoon`, `drawBodyPoint` | `038a8d97` (+ `2d043162`, `80852701`, `7c3ec0e6`, `ff90df99`) |
| `labb-rings-logic.ts` | Plane homography; ring classes; wake angle; tethers; ticks; density fade | `planeHomography`, `applyHomography`, `ringInstrumentClass`, `ringUniforms`, `wakeAngle`, `wakeUniforms`, `tetherRect`, `ringDensityFade`, `typicalRingGap` | `ff7ddbdd`, `387b20c8` |
| `LabRings.tsx` | Class-ring picture, wakes picture, tethers, ticks, focus lock, switch trim picture, culling, LOD, path-rebuild A/B | `RingClassesPicture`, `WakesPicture`, `TrimRingPicture`, `ringOnScreen`, `FLOW_LOD_MAX_RINGS`, `WAKE_LOD_MAX_RINGS`, `LabRingsPathRebuild` | `ff7ddbdd` (+ `30026fda`, `038a8d97`, `83c9033a`, `89c2f1dd`) |
| `LabLabels.tsx` | HUD-tag label component (component-path twin) | `LabHudLabel` | `ff7ddbdd` |
| `LabPolaris.tsx` | Lab Polaris | `LabPolaris` | `469440db` |
| `LabChart.tsx` | Standard chart graticule (one picture under the homography) | `LabChart`, `niceStep`, `chartRadii` | `11c21745` |
| `labb-switch-logic.ts` | Switch maths: windows, roles, particles, streak xforms, sky hue | `switchFxLive`, `warpAmount`, `settleAmount`, `shockwaveState`, `skyHueWeight`, `flareEnvelope`, `switchRoles`, `classRingSwitchFade`, `trimRingState`, `bodySwitchFx`, `particlesPerBody`, `particleAt`, `systemSkyIndex`, `displayedSkyHue` | `30026fda` |
| `LabSwitchFx.tsx` | Shockwave, comets/smears Atlas (under the bodies), particles + flares (over), shock filter uniforms | `LabSwitchUnder`, `LabSwitchOver`, `useShockFilterUniforms`, `useStreakTexture` | `30026fda`, `413d6999` |
| `labb-focus-logic.ts` | Focus/feedback maths (no Skia) | `reticleState`, `reticleSegments`, `seekAmount`, `focusDimFactor`, `hullCircle`, `pingRings`, `rippleRings`, `northFlare`, timing constants | `11c21745` |
| `LabFocusFx.tsx` | Focus state hook; reticle picture; feedback picture | `useLabFocusState`, `LabFocusPicture`, `LabFeedbackPicture` | `11c21745` |
| `labb-card-channel.ts` | Focus-card rect from the RN overlay into the canvas (lab module-level SV) | `labCardChannel`, `writeCardRect`, `underCard` | `2d043162` |
| `LabStage.tsx` | R2 stage plane, lens flare, bloom paint, tilt-shift | `LabStagePlane`, `stagePlaneUniforms`, `invert3`, `LabLensFlare`, `labBloomPaint`, `LabTiltShift` | `ff90df99` |
| `labb-home-tilt.ts` | Home tilt wrapper | `labHomePose`, `LAB_HOME_TILT` 0.56 | `ff90df99` |
| `labb-perf-probe.ts` | Per-worklet UI timing on `globalThis` | `probeStart`, `probeEnd`, `setLabProbeEnabled` | `bba4cf5b` |
| `debug/LabFxPanel.tsx` | Marker, panel, deep links, presets | `LabBMarkerHost`, `LabFxPanel`, `parseLabCommand`, `isLabBBuild` | `c8a82eaf`, `30026fda` |
| `debug/LabFpsOverlay.tsx` | Clock-delta HUD | `LabFpsOverlay`, `summarizeFrameDeltas` | `c8a82eaf` |

## 3. Other files changed or added outside `labb/`

| File | Change | SHA |
|---|---|---|
| `src/stores/orrery-labb-fx-store.ts` | `LAB_FLAG_REGISTRY` (64 flags at HEAD), renderer, intensity, reduced-motion mode, `switchTimeScale` | `c8a82eaf` … |
| `src/theme/orrery-lab-fx.ts` | Per package × mode profiles (`LAB_FX_PROFILES`, `resolveLabFxProfile`, `labColor`), LAB-ONLY sprite masks | `c8a82eaf` … `ff90df99` |
| `src/theme/reduced-motion-override.ts`, `use-reduced-motion.ts` | Lab override combined with the OS value | `c8a82eaf` |
| `src/components/orrery/orrery-focus-placement.ts` | Pure focus-card placement (keep-out box, side order, height cap) | `11c21745` |
| `src/components/orrery/OrreryHudCorners.tsx`, `OrreryFocusContext.tsx`, `OrrerySystemSelector.tsx`, `OrreryViewOptions.tsx`, `OrreryControls.tsx` | `hud` / `anchor` props (default = old behaviour); card rect → `labb-card-channel` | `11c21745`, `2d043162` |
| `src/components/orrery/use-orrery-switch-runtime.ts` | Optional `timeScale` (slow-mo; absent = production) | `30026fda` |
| `src/screens/OrreryScreen.tsx` | Theme package/mode to the world; `labHomePose` at 3 Home sites; HUD/anchor flags; `LabBMarkerHost` | `c8a82eaf`, `11c21745`, `ff90df99` |
| `src/__dev__/lab-b-seed.ts`, `App.tsx` | Dev-only fixture seed (140 contacts + Systems; stress 400/800; portraits) | `9ca24ae8`, `80a9650b`, `bba4cf5b` |
| `app.config.ts` | `com.bwales.orbit.labb`, launcher "Orrery Lab B", widget label | `9ca24ae8` |
| Tests | Recursive worklet-order scan (`orrery-worklet-order.test.ts`); legacy pin in `orrery-render.test.tsx`; `use-orrery-photo` mock in `orrery-scene.test.ts` (C-24); frame-mapper capture map | various |

## 4. Shaders (`LAB_EFFECT_SOURCES` in `labb-effects.ts`)

| Effect | Kind | What it computes |
|---|---|---|
| `probe` | shader | Warm-up / pipeline proof. |
| `nebulaBake` | shader (into a 768² texture via `useTexture`) | Periodic domain-warped fbm densities: lobe A, lobe B, dust in r/g/b. Each octave doubles frequency **and** period, so the texture tiles. |
| `nebulaSample` | shader (full screen, per frame) | One texture fetch, token colouring, parallax/drift/breathing warp, analytic far stars (`NEBULA_FAR_STARS`, a hash grid), far-star streak smear during warp, vignette, dither. |
| `nebulaLive` | shader | The same density function computed live at full resolution (A/B only). |
| `bodyPhoto` / `bodyProcedural` | shader with child `ImageShader` | `BODY_LIT`: disc edge at exactly r (1-dp AA via `uPx`), Lambert + wrap, floor, glint, Fresnel status limb, crisp rim, desaturation, depth haze, atmosphere/contact shadow out to 1.3 r, dissolve (`uK.x`), capture flash, focus response (`uK.w`). Procedural: banded noise-warped "world" seeded per key. Uniforms are float4-packed (10 blocks). |
| `sunStar` / `sunPhoto` | shader | `SUN_CORONA`: limb-darkened granulated star (rotated lattice), or emissive photo; inner glow, halo, two angular-noise ray bands, limb; breathing; glow cap. |
| `moon` | shader | Lit moon (flag `moonShader`, off by default). |
| `ringInstrument` | stroke shader per status class | Hairline in the status hue, far-side fade ∝ tilt, integer-count dashes, flow comets, R2 rim light (`uSpin.zw`). |
| `ringWake` | stroke shader per ring | Alpha rises from north to the body angle, with a soft cross profile. |
| `switchShock` | shader | System-lock shockwave front and glow. |
| `stagePlane` | full-screen shader | Inverse plane homography per pixel → world radius → sun light pool + gravity-well grid. |
| `lensFlare` | full-screen shader | Anamorphic streak, halo, 4 ghosts on the sun→centre axis (experiment). |
| `shockFilter` | runtime **image filter** | Displacement + chroma split on the shockwave front (experiment). |

**Rules applied everywhere:**

- no colour literals and no `#define` in SkSL;
- time wrapped at `% 1000 s`;
- **every declared uniform supplied**, with finite values (asserted by
  `labb-effects.test.ts` / `labb-bodies-logic.test.ts`, because a missing uniform throws on
  device);
- uniforms packed into `float4`.

**Hermes traps found** (DECISIONS WP-2.1 §12):

- A worklet **default parameter** that references a module constant is not captured. It
  throws `ReferenceError` on device but not in vitest. Use `undefined` plus an in-body check.
- `MakeSweepGradient(…, null, …)` throws. Pass `undefined` for the local matrix.

**Stale guidance.** The `labb-effects.ts` header says transition-only effects should go in
`WARMUP_EFFECTS`. In practice that list holds only `probe`; switch effects are warmed by each
FX layer drawing a ~1 %-alpha probe instance while `ctx.warm` is true, and filters through
`WARMUP_FILTERS`.

## 5. Key algorithms (for reproduction)

1. **Plane homography** (`planeHomography`). `projectWorldPoint` is yaw → tilted
   perspective plane → zoom → usable-rect centre, which is an exact homography. Compose it
   into one row-major 3×3 (9 numbers including perspective, which RN Skia accepts as a Group
   `matrix`). Draw rings as `drawCircle(0,0,R)`, with stroke width `dp/zoom`. It is tested
   exact against `projectWorldPoint` and against `projectFrame`'s `ringPath[0]`.
2. **Inverse homography for full-screen plane shaders** (`invert3` + `stagePlaneUniforms`).
   Per pixel: screen → world plane → radius from the sun.
3. **Sky parallax** (`labSkyPose`, `skyLayerPlacement`):
   - pan offset = factor × (sun screen pos − viewport centre), un-rotated into sky space
     before wrapping and re-rotated after;
   - zoom `z^(f·1.3)`;
   - yaw about the viewport centre;
   - tilt shift by depth.
4. **Switch signal** (`sampleSwitchSignal`). It shares `sampleEntryAt` with the full sample,
   so one entry sampled alone is byte-identical. Velocity is normalised to the spin plateau.
5. **Stateless particles** (`particleAt`). Position = f(seed, generation, entry, progress),
   with fixed capacity 640. The budget is spread over on-screen leaving bodies.
6. **Sky-hue crossfade** (`systemSkyIndex`, `displayedSkyHue`). The hash of System kind +
   id/uid selects a `starPalette` index (All Contacts keeps the default). A UI reaction keyed
   by generation crossfades from whatever is currently displayed, so it is robust to whether
   the transition or the scene arrives first.
7. **Layer pictures** (`LabBodiesPictures`).
   - One derived value plans the draws (`planBodyDraws`: billboard, depth sort with stable
     ties, split around the declarative sun).
   - It records one `SkPicture` with one `makeShaderWithChildren(flattened uniforms, [photo
     cover shader])` per visible body.
   - Returning the *same* empty picture object when idle makes the write a no-op, so the
     canvas is not notified.
8. **Seek-to-lock reticle** (`seekAmount`, `reticleState`). Spread and spin are a pure
   function of the body's remaining screen distance to the usable-rect centre while
   `camera.active`; then a 380 ms lock.
9. **Focus-card placement** (`focusCardPlacement`). Keep-out = body + label reserve;
   candidates below → above → right → left, then a capped roomier side, then dock.
10. **Idle clock** (`useLabClock` + `labAmbientNeeded`). `useFrameCallback(tick, active)`
    with a base offset, so time stays continuous across pauses.

## 6. Tests added (vitest)

- `labb/`:
  - `labb-bodies-logic.test.ts`, `labb-clock-logic.test.ts`, `labb-effects.test.ts`;
  - `labb-focus-logic.test.ts`, `labb-frame-index.test.ts`, `labb-layer-plan.test.ts`;
  - `labb-render.test.tsx` (mocked-Skia contract: layer order, no body `layer`, frame-radius
    draws, depth zIndex, label alpha by level, null-effect fallbacks, homography vs
    `ringPath[0]`, picture and component paths);
  - `labb-rings-logic.test.ts`, `labb-sky.test.ts`, `labb-stage.test.ts`,
    `labb-switch-logic.test.ts`.
- Elsewhere:
  - `src/stores/orrery-labb-fx-store.test.ts`;
  - `src/theme/orrery-lab-fx.test.ts` (4 profiles resolve; Standard Light is quietest);
  - `src/components/orrery/orrery-focus-placement.test.ts`;
  - additions to `src/logic/orrery-camera-logic.test.ts` (bit-identical projection) and
    `src/logic/orrery-switch-choreography.test.ts`.

Shader *output* is not unit-testable (C-18). Device screenshots are the only check.
