# Lab B — Architecture

The renderer, data flow, dependencies, lifecycle and animation model as they stand at
`bfc8f36c`. **R3 polish is pending** (see README placeholder); update this file if R3 changes
structure.

Everything below was checked against the code on disk: `src/components/orrery/OrreryWorld.tsx`,
`src/components/orrery/labb/*`, `src/logic/orrery-camera-logic.ts`, `src/logic/orrery-frame.ts`,
`src/logic/orrery-switch-choreography.ts`, `src/logic/orrery-satellite-logic.ts`,
`src/stores/orrery-labb-fx-store.ts` and `src/theme/orrery-lab-fx.ts`.

## 1. Dependencies

There are **no new npm dependencies**: `package.json` is unchanged on this branch. The stack
is the app's existing one:

- `@shopify/react-native-skia` 2.6.2, on the **Ganesh/OpenGL** backend (not Graphite);
- `react-native-reanimated` 4.5.1;
- `react-native-worklets` 0.10.4;
- RN 0.86.2 with the New Architecture, Hermes and Expo SDK 57 (research 02 §1).

Every visual is procedural (SkSL runtime effects, Skia primitives, Atlases, pictures). The
only added binary assets are 16 dev-seed test portraits, which never ship (ASSET-MANIFEST).

## 2. The seam: one model half, two renderers

```
SQLite ──loadOrreryScene──▶ OrrerySceneSnapshot (world layout, members, sun, gravity)
                               │  (OrreryScreen: system store, switch runtime, camera)
                               ▼
OrreryWorld  ── MODEL HALF (shared, unchanged semantics) ────────────────────────────
  frame = useDerivedValue: sampleSwitchChoreography → previewReorder →
          deriveSatelliteBodies → projectAnimatedFrame(…, ringPaths)  ⇒ AnimatedFrame
  level (semantic zoom) · labels (prepared paragraphs, cached) · allocations (labels+taps)
  gestures (resolveTap / onNorth, + fxTap side-stamp) · camera.frame publication · focus-lost
                               │
             useLabFxStore().renderer
                ┌──────────────┴───────────────┐
         "legacy" (A/B)                    "lab" (default)
   OrreryCanvas + legacy tree        LabBRenderer (memo, part-wise comparator)
                                        └─ LabCanvas (ONE clock, opaque SurfaceView)
```

- **`OrreryWorld.tsx` keeps the whole model half.** The frame worklet, captures, `level`,
  label measurement and allocation, tap semantics, gestures and focus-lost reactions all stay
  there. Only its return chooses a renderer (`labRenderer === "lab"` → `<LabBRenderer …/>`,
  otherwise the legacy `OrreryCanvas` tree). Only one canvas and one clock are ever mounted.
- **Model-half changes made in the lab** are perf-only with no semantic change. They are the
  harvestable shared fixes:
  - `ea137306`: the frame worklet captures only shared values and scalars;
  - `30026fda`: `ringPaths`;
  - `83c9033a`: allocation index and paragraph cache;
  - `89c2f1dd`: `projectFrame` hoisting.

  The lab also adds side effects:
  - the `fxTap` side-stamp in `resolveTap`/`onNorth` (C-20, C-54);
  - `probeStart/End` instrumentation (C-65).
- **The render contract** is `LabRenderContract` in `LabBRenderer.tsx`. It carries `frame`,
  `allocations`, `level`, `reorder`, `pose`, `switchRuntime`, `fxTap`, `cameraActive`,
  `scene`, `resources`, `colors`, `themePackage/Mode`, `fontProvider`, `labels`,
  `focusedIds`, `focusedSatellite`, `satellites`, `viewport`, `gesture` and `ghost`.
  `memo(LabBRendererImpl, sameContract)` compares `switchRuntime` by its parts and the ghost
  by its props (`3c0f691b`). This matters because every canvas commit re-records the tree
  twice in RN Skia 2.6.2.

## 3. Layer order (back → front) as drawn in `LabBRendererImpl`

| Slot | Component | File |
|---|---|---|
| L0 environment | `LabEnvironment`: baked nebula sample (incl. analytic far stars, vignette, warp), mid/near star Atlas, switch streak Atlas | `LabEnvironment.tsx` |
| clip group ▸ L1 | `LabStagePlane` (R2 sun light pool + gravity-well grid), `LabChart` (Standard graticule), `LabRings` (class rings, wakes, tethers, ticks, focus lock, switch trims), `LabSwitchUnder` (shockwave, comets, smears) | `LabStage.tsx`, `LabChart.tsx`, `LabRings.tsx`, `LabSwitchFx.tsx` |
| L5 | `LabPolaris` (or the legacy `Polaris`) | `LabPolaris.tsx` |
| ghost | the model-owned reorder ghost (hidden while `fxReorder`) | `OrreryWorld.tsx` |
| L2–L4 | `LabBodiesPictures`: ONE picture each for contacts and moons, depth-split around the still-declarative sun (`LabSunBody`) | `LabLayerPictures.tsx`, `LabBodies.tsx` |
| (optional wrappers) | `fxShockFilter` saveLayer around L0–L5; `bloom` saveLayer around the world | `LabBRenderer.tsx`, `LabStage.tsx` |
| tilt-shift | `LabTiltShift` (experiment) | `LabStage.tsx` |
| reticles | `LabFocusPicture` (over bodies, under labels) | `LabFocusFx.tsx` |
| lens flare | `LabLensFlare` (experiment, additive themes) | `LabStage.tsx` |
| L6 labels | `LabLabelsPicture` (one picture; per-label saveLayer inside, C-09) | `LabLayerPictures.tsx` |
| L7 | `LabSwitchOver` (particles, capture flares), `LabFeedbackPicture` (pings, ripples, north flare, reorder hold) | `LabSwitchFx.tsx`, `LabFocusFx.tsx` |
| debug | `LabFpsOverlay` | `debug/LabFpsOverlay.tsx` |

Outside the canvas there are two more pieces:

- **`LabPhotoProbes`.** These are plain RN components that call `useOrreryPhoto` once per
  distinct photo path. Their images feed the bodies picture (C-50).
- **`LabBMarkerHost`.** This is the panel and deep-link host, mounted by `OrreryScreen.tsx`.

The header comment in `LabBRenderer.tsx` still lists the chart after the labels and calls L0
a "3-depth Atlas starfield". The code draws the chart inside L1, and the far stars are
analytic in the nebula shader. The comment is stale; trust the code.

**Heavy layers are unmounted when their flag is off** (`heavy: true` in `LAB_FLAG_REGISTRY`).
A measured marginal cost is therefore real.

## 4. Animation model

### One clock

`LabCanvas` owns the only clock (`useLabClock`). It is a **pausable** `useFrameCallback`,
active only while `labAmbientNeeded(...)` says something ambient can animate
(`labb-clock-logic.ts`, `bba4cf5b`, C-64). The ambient effects are:

- nebula drift;
- twinkle;
- ring flow, when there are ≤160 rings;
- sun corona and plasma;
- sun pulse.

With reduced motion on, or every ambient effect off, an untouched Orrery draws **0 frames**.
The clock value is continuous across pauses (`base` offset). This deliberately deviates from
research 03 §2.6 ("no `useFrameCallback`"). Plain `useClock` cannot pause.

### Three context layers (`labb-context.ts`)

| Context | Contents |
|---|---|
| `LabRenderContext` | `clock`, `ambient` (pinned to 0 by "freeze clock"), `fxFlags`, `reducedMotion`, `warm`, `sw`, `focus` |
| `LabStillContext` | Everything **except the clocks** |

Worklets that must not re-run per tick capture only `LabStillContext` or single values.
Reanimated subscribes a derived value to *every* SharedValue reachable from its closure
(R1 finding, `83c9033a`).

### Everything else drives its own SharedValues

- the switch (`progress` / `transition`, from the screen-owned runtime);
- focus (`mix` / `keys` / `lock`, as `withTiming` written in an effect keyed on focus
  identity);
- feedback timers;
- camera recoveries;
- gestures.

Nothing per-frame goes through React state.

### Switch effects are pure functions

They are pure functions of `(sampleSwitchSignal(transition, progress), switchRoles(transition), frame)`
(`labb-switch-logic.ts`, `orrery-switch-choreography.ts`), with no wall-clock state. Pause,
remount mid-switch, resume and an A→B→C retarget are therefore correct by construction.

### Sky and instrument geometry read only the animated frame

They read `frame.value.pose` / `.center` / `.viewport`, never `pose`. During a switch the
displayed camera is the sampled one (research 03 §0.3; `labSkyPose(frame)` enforces this by
signature).

### Per-entity content is imperative

Bodies, moons, labels, class rings, wakes, switch trims, reticles and feedback are each
**one UI-thread `SkPicture` per layer, recorded from one derived value** (`038a8d97`). The
pure plans live in `labb-layer-plan.ts`. This replaced one React component per body (about
3 200 bound SharedValues on Dense 120). The component path survives as the `layerPictures:0`
A/B.

### Instrument geometry is static world geometry under one plane homography

`planeHomography(frame.pose, frame.viewport)` (`labb-rings-logic.ts`, `ff7ddbdd`) returns one
3×3 matrix per frame:

- rings are `drawCircle(0,0,R)`;
- tethers are rotated rects;
- ticks, chart, shockwave and ripples are drawn under that matrix.

Stroked *paths* are avoided, because Ganesh re-tessellates them on the CPU every replay.

## 5. Lifecycle

**Mounting is unchanged.** `OrreryScreen` still mounts `OrreryWorld` only when
`visible && sessionReady && scene`. Blur, background or an invalid measurement therefore
unmounts the canvas, the clock, every mapper, the Atlases and the baked textures. This was
verified on the emulator in release: 0 gfx frames on the Contacts tab and while
backgrounded (`evidence/05-m1-checkpoint/lifecycle-gfxinfo.txt`).

**Warm-up at mount** (`LabCanvas`, 400 ms):

- a 2×2 clip at alpha 0.004 draws `WARMUP_EFFECTS` (`probe`);
- `WARMUP_FILTERS` (`shockFilter`) are drawn inside a tiny saveLayer;
- every switch-FX layer draws one ~1 %-alpha probe instance while `ctx.warm` is true;
- one `runOnJS` state flip ends it.

Effects compile **lazily** through `getLabEffect(name)` (`labb-effects.ts`). The loader is
memoised, wrapped in `try`, and returns `null` on failure, in which case every consumer has a
flat fallback. Nothing compiles at import time (`orrery-scene.test.ts` mocks Skia as `{}`).

**Textures and images.**

- The nebula density bake (768², `useTexture`) and the star and FX sprite atlases are
  UI-thread-owned. They are rebuilt only on mount, not on a theme change, because colour is
  applied at sample time.
- Photos keep `useOrreryPhoto`'s disposal. Image shaders captured by the bodies picture are
  left to GC (C-50).

**Reduced motion.** It is read inside every ambient worklet (ADR-085). The lab override
(`src/theme/reduced-motion-override.ts`) combines with the OS value in both
`useReducedMotionShared` and `useReducedMotion` (C-21, lab-only).

## 6. Debug and lab-only infrastructure (not for V2)

| Piece | What it is | Where / compromise |
|---|---|---|
| Panel + marker | Gated on applicationId `com.bwales.orbit.labb`, not `__DEV__`, so they work in release lab builds | `debug/LabFxPanel.tsx`, C-08 |
| Flag registry | 64 flags at `bfc8f36c`; R3 is adding more in its working tree | `LAB_FLAG_REGISTRY` in `orrery-labb-fx-store.ts` |
| Theme profiles | Per package × mode effect profiles (`LabFxProfile`: env, bodies, rings, labels, chart, stage, blend, intensity) | `src/theme/orrery-lab-fx.ts` |
| Deep links | `orbit://labb?…` (`parseLabCommand`) | |
| Slow-mo | `timeScale` arg on `useOrrerySwitchRuntime` | C-46 |
| Perf probe | `labb-perf-probe.ts` | C-65 |
| FPS HUD | Clock-delta HUD | `debug/LabFpsOverlay.tsx` |
| Seeds | Dev seed and stress seed (debug + applicationId only) | `src/__dev__/lab-b-seed.ts` |
| Package config | applicationId, launcher name and widget label changed | `app.config.ts` (lab-only) |

## 7. What the architecture proved (the V2-relevant conclusions)

1. **Declarative per-entity RN Skia components with animated props do not scale to 100+
   bodies** on RN Skia 2.6.2 + Reanimated 4.5. The cost is O(bound values) synchronous
   cross-thread reads per commit (done twice) plus O(mappers) per frame. Use one picture or
   Atlas per layer instead (SWITCH-STALL-INVESTIGATION §6).
2. **Worklet closure-capture discipline is a renderer requirement.** One captured scene
   object turned every parent render into a 0.6–0.8 s main-thread deserialisation.
3. **Instrument geometry should be circles, rects and shaders under one matrix**, never
   stroked paths re-tessellated per replay.
4. **Uniforms must be packed** (`float4` blocks). RN Skia resolves uniforms by name and
   rebuilds every shader on every replay.
5. **Ambient animation must pause when nothing moves** (idle clock). Reduced-motion
   stillness is then free.
