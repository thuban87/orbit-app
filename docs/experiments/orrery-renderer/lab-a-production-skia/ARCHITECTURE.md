# Lab A: Architecture (final, at HEAD `978643c9`)

This file describes the renderer **as it is on disk at HEAD**. Earlier designs are listed under "Superseded designs" at the end. Every reference below was checked against the code. File paths are relative to `src/components/orrery/` unless they start with `src/`.

## 1. Shape in one diagram

```
 JS thread (React render / effects)                 UI runtime  (= Android MAIN thread)
 ───────────────────────────────────                ─────────────────────────────────────────────
 OrreryScreen ─ scene, pose, switchRuntime ─┐
                                            ▼
 OrreryWorld.tsx                                    frame = useDerivedValue(            (one per vsync
  ├ buildBodySpecs()  → LabBodySpec[]  ──write──┐     sampleSwitchChoreography            only while an
  │   (token RGBA, SkParagraph initials,        │     + pose | switch camera              input changes)
  │    SkImage+size, photoAt/enterAt stamps)    │     + previewReorder + moons
  ├ labels → LabLabelSpec[] (SkParagraphs) ─────┤     + projectAnimatedFrame(…, ringPaths=false))
  ├ planeRings → PlaneRing[] (status ink/width) ┤         │
  ├ focusState {keys,targets,generation} ───────┤         ├─► switchFx  = computeSwitchFx(...)
  ├ extent, fadeTick (withTiming 360 ms) ───────┤         ├─► bodyLight = computeBodyLight(frame)
  │                                             │         ├─► allocations = allocateLabels(frame…) ─► hit test
  ├ LabPhotoSlot ×N (outside Canvas)            │         ├─► camera.frame (gestures, focus card)
  │   useOrreryPhoto(path, retire) ─► custody ──┘         │
  │   settle(): dispose retired SkImages ON UI            ▼
  │                                             LabScene.tsx  (inputs = shared values only)
  └ OrreryCanvas  <Canvas opaque>  ──────────►   ambient = floor(clock/33.3ms)·33.3ms | −1 (RM)
      (SurfaceView; one useClock)                 scene  → createPicture ×2 ─► below₀ , above
                                                  below  → below₀  |  cached-texture blit
                                                  sun    → createPicture  (per ambient tick)
                                                  reticle→ createPicture | stable `empty`
                                                  top    → createPicture  (labels, pips)
                                                         ▼
                                    <Group> 5×<Picture> (+ DEV LabHud) — tree NEVER changes
                                                         ▼
                                    RN-Skia mapper → renderImmediate → SurfaceView → SurfaceFlinger
```

## 2. Renderer structure: five pictures

`lab/LabScene.tsx` is the only Lab node inside `<Canvas>`. It renders `<Group>` with five `<Picture picture={sharedValue}>` children and, in DEV builds only, `LabHud`. The props are shared values or memoised JS objects. A React commit (focus, publication, photo resolve, label rebuild) writes shared values and does not change this tree, so RN-Skia never re-records it on the JS thread.

| Picture | Draws (worklets in `lab/scene-draw.ts`, `lab/world-plane.ts`, `lab/reticle-draw.ts`) | Inputs that trigger a re-record |
|---|---|---|
| `below` | `drawSky` (nebula image, far stars, near stars ×6 warp levels, vignette) → `drawWorldPlane` (pool, grid, shadows, rings, moon orbits, arrival ghosts, haze, switch FX) → `drawPolaris` → `drawReorderGhost` → the bodies ordered before the sun (`drawContactBody`, `drawMoonBody`) | `scene` mapper: `frame`, `switchFx`, `light`, `bodies`, `rings`, `focus`, `focusMix`, `drag`, nebula opacity, `extent`, `fadeTick`, reduced motion. `below` also reads `ambient`, but only to decide when to bake (§5). |
| `sun` | `drawSunBody` for every sun spec: corona quad (`CORONA_SKSL`, screen blend; src-over in chart mode), limb line, disc (`SUN_DISC_SKSL`) or photo + limb band, initials | `frame`, `bodies`, `ambient`, `switchFx.flare`. This picture redraws on **every ambient tick** (30 Hz) unless reduced motion is on. |
| `above` | the bodies ordered after the sun | same as `below` (it comes from the same `scene` mapper) |
| `reticle` | `drawReticle` per focus target | `focus`, `ambient`, `lock`, `frame`, `light`. With no targets it returns a **reference-stable `empty` picture**, so it causes no redraw. |
| `top` | `drawLabels` (plates, ticks, leaders, context plates) and `drawStackPips` | `frame`, `allocations`, `labels`, `light`, `switchFx`, `rings` |

**Draw order equals RN-Skia's zIndex flush.** `orderBodies` sorts by `depth` ascending, then by spec `order` (source order). The scene is split at the first sun into `below` and `above`. If two suns are present during a switch, both draw in the `sun` slot (a documented, deliberate approximation).

**No full-canvas layers.** A body or label opens `saveLayer` only while it is partially transparent (a mount, photo or switch fade). That layer is **bounded** to the body's halo box or to the plate plus its leader (`boundedLayer`). The focus dim is not a layer. It is drawn as a background-ink veil over the disc, plus a lower halo alpha (`focusDim`, `drawContactBody`).

## 3. Resource preparation: JS thread vs UI thread

| Resource | Built on | Built when | Reaches the UI runtime as |
|---|---|---|---|
| `LabBodySpec[]` (`lab/scene-specs.ts` `buildBodySpecs`) | JS | `useMemo` keyed on resources, satellites, colours, ink, font, photos | shared value written **during render** in `OrreryWorld` (async hand-off, never a sync read) |
| Initials `SkParagraph` | JS | shaped once, cached per (text, colour, size, width) per font provider | host object inside the spec; only `.paint()` runs on UI |
| Label `SkParagraph`s | JS (`prepareOrreryText`, unchanged) | label memo | host objects in `LabLabelSpec` |
| Photo `SkImage` | JS (`useOrreryPhoto`, D-11/D-41: 512 px cap, on-disk derivative, no cache) | photo resolve | host object in the spec (custody rules in §8) |
| `SkRuntimeEffect`s | JS (`labEffect`, lazy, memoised at module level) | first use | captured host objects; `makeShader(float[])` per draw on UI |
| Star pictures, vignette shader, Polaris path | JS (`LabScene` `useMemo`) | per size / palette | captured host objects |
| Nebula `SkImage` | JS, CPU bake (`lab/nebula-bake.ts`) | **once per palette per process** (module cache, never disposed) | captured |
| Plane unit shapes (`SkPath` n-gons, 30 `SkVertices` annulus strips, 1 disc fan) | JS (`makePlaneShapes`) | once per `LabScene` mount | captured |
| `frame`, `switchFx`, `bodyLight`, `allocations`, focus mix | UI (mappers in `OrreryWorld`) | per input change | shared values |
| All five `SkPicture`s | **UI** | per input change (table above) | `<Picture>` props |
| Base texture (`Skia.Surface.MakeOffscreen`) | **UI** (main-thread GL context, the same one as the view) | when the scene is static (§5) | mutable scratch shared value; disposed on unmount through `runOnUI` |

Uniforms are flat `number[]` arrays in SkSL declaration order. They are built by `bodyUniforms` (35 floats), `coronaUniforms` (14), `sunDiscUniforms` (13), `ringWorldUniforms` (36), `gridUniforms` (26) and `ringUniforms` (23, fallback). `makeShader` throws if the length is wrong, and that would kill the render loop. Tests pin each length (see IMPLEMENTATION §6).

## 4. Data flow: scene → frame → pictures → hit/labels

1. `OrreryScreen` loads the scene and publishes it into `useOrrerySwitchRuntime`. Publish now ships only `world` and `generation` to the UI runtime (`842f1f3`).
2. The **frame worklet** (`OrreryWorld.tsx`) is the single sampled world. It is built from the choreography sample, the camera (live `pose` when settled, the interpolated switch camera while running), reorder preview and moons, and passes through `projectAnimatedFrame(…, ringPaths)`. `ringPaths = !deepFieldOn`: Lab frames carry **empty `ringPath`s**, because the Lab renderer never reads them.
   - The worklet captures only shared values and small plain data. `orrery-frame-mapper.test` fails if it captures `switchRuntime`, `scene` or `resources`.
3. Derived mappers on the same frame produce:
   - `switchFx` (`computeSwitchFx`, idle under reduced motion);
   - `bodyLight` (screen light direction to the sun, plus a far factor);
   - `allocations` (`allocateLabels`, unchanged);
   - `camera.frame` (gestures, focus card).
4. **Hit testing and label allocation are untouched.** They read `frame` and `allocations` exactly as before. Drawn extents never change `radius`, `hitRadius` or label metrics. The world plane is drawn through `planeHomography(frame.pose, frame.viewport)`, which is the exact homography of `projectWorldPoint` (§6), so drawn rings coincide with hit math.
5. `LabScene` records the pictures from that one `frame` and the specs.

## 5. Redraw policy

- **Ambient time** (`LabScene` `ambient`) is computed as `floor(clock / (1000/AMBIENT_HZ)) · (1000/AMBIENT_HZ)` with `AMBIENT_HZ = 30`. Under live reduced motion, or when there is no clock, it is **−1**. Because it is a primitive, an unchanged value does not propagate (Reanimated only suppresses propagation for `===` values).
- **The frame is not clock-driven.** At idle the frame mapper does not run, so the only pictures that re-record are `sun` (and `reticle` while something is focused) at 30 Hz. On device this measured 21 idle presents/s.
- **Under reduced motion an idle canvas redraws nothing.** Release measured 0 presents.
- **Fades.** Mount (280 ms) and photo (260 ms) fades are computed in the worklet from JS wall-clock stamps in the spec (`fadeIn(at, Date.now(), ms, still)`). To keep re-records running through a fade without a clock, `OrreryWorld` animates `fadeTick` with `withTiming` over `SPEC_FADE_WINDOW_MS = 360` (`ReduceMotion.Never`) after every spec write. `scene` reads `fadeTick`.
- **Base texture: bake only when static** (camera perf pass, `LabScene` `below`).
  - While `scene` keeps producing new pictures (pan, pinch, focus flight, switch, fades), the fresh `below` picture is drawn **directly**.
  - Once `scene` has been unchanged for `BAKE_SETTLE_MS` (two ambient ticks, ≈66 ms), `below` is rasterised **once** into a device-pixel offscreen surface (`ceil(w·density) × ceil(h·density)`, ≈18 MB at 1440×3120). A picture that blits that image replaces it, so ambient-only redraws composite one image.
  - The surface is re-created only when the size changes, and is disposed on unmount.
  - It is never baked under reduced motion (ambient −1), since nothing redraws at idle there anyway.

## 6. World-space plane under the homography

`lab/deep-field-math.ts` `planeHomography(pose, viewport)` returns the row-major 3×3 Skia matrix that maps world-plane points to screen. It is the exact `projectWorldPoint` projection, built from the frame's **clamped** pose and the usable-rect centre `(cx, cy)`:

```
H = T(cx,cy) · [[z, 0, 0], [0, z·cos t, 0], [0, −sin t / f, 1]] · R(yaw) · T(−pose.x, −pose.y)
```

In the code this is written out with `k = sin t / f` and `w0 = 1 + k·(sin yaw·ox + cos yaw·oy)`. Two tests pin it to `projectWorldPoint` at 1e-6: `deep-field-math.test`, and `world-plane-camera.test` against the frame's `ringPath`.

**Why rings are not stroked under `concat(H)`.** Ganesh has no GPU path for strokes or dashes under a perspective CTM. They fall back to CPU path masks plus texture uploads (the pass-1 dead end). Widths also need to be constant in *screen* dp.

**Adopted design** (`lab/world-plane.ts`, `033e751`):
- **Cached unit geometry.** 30 annulus strips `1 ± ε` (128 segments, `SkVertices` triangle strip, outer edge ×1/cos(π/128)), one disc fan, and unit n-gons. All are built once on JS.
- **One draw per ring.** `canvas.concat(circleMatrix(H, 0, 0, R))` then `drawVertices(band)` with `RING_WORLD_SKSL`. The shader rebuilds the world point `p = u·R`, maps it through `H` (passed as three `float3` uniforms), takes the Jacobian `J`, and uses `dist = |r − R| · |J·r̂|` as the screen-dp distance to the ring. Widths are therefore constant dp, with a 1-device-pixel AA feather (`uAA = 1/pixelRatio`). Dashes, ink-in and the status segment use **world angles** about the sun. Pixels outside both strokes early-out before any trigonometry.
- **Grid.** One `GRID_SKSL` draw on the unit disc under `H·S(S)`. It covers the reference circles, spokes, double bezel and 120-tick dial, all analytic.
- **Pool and haze.** Gradients in unit coordinates on the same disc, which makes them exact under perspective.
- **Still screen-space (small or transient).** Moon orbits, arrival-ghost rings and ripples are native `PathBuilder.addPath(unitNgon, H·T·S)` strokes. Contact shadows are a `drawCircle` under the local affine approximation `affineAt(H, p)`. Trails and glints are screen paths and gradients.
- **Fallbacks.** If `ringWorld` or `grid` is null, or `SkVertices` is unavailable, the pass-2 screen-space convex-polygon path is used (`RING_SKSL`, strokes). The unit-test mocks exercise that path.

## 7. Opaque canvas → SurfaceView

`OrreryCanvas.tsx` sets `<Canvas opaque={!!backdrop}>`, and the Lab passes `LabScene` as `backdrop`. RN-Skia 2.6.2 then uses a `SurfaceView` instead of `SkiaTextureView`. Presents go straight to SurfaceFlinger. This avoids the TextureView path, where every frame is re-composited by HWUI on the main and render threads (measured in debug: 26 → 59 presents/s in continuous pans, nothing else changed).

The legacy renderer keeps the TextureView, so the A/B baseline is unchanged. The trade-offs are listed in PERFORMANCE §8:
- the canvas has no view-level alpha or transform animation;
- it costs about +29 MB of EGL buffers;
- the panel stays at 120 Hz at idle, so idle CPU rises.

RN overlays (pills, FABs, focus card, sheets) still draw above the canvas; the parity sheets confirm this.

## 8. Lifecycle, clock, reduced motion

- **One clock.** `OrreryCanvas` is the only `useClock()` owner. It provides the clock through `OrreryClockContext`, and `LabScene` reads it through `useOrreryClock()`. The canvas unmounts on blur and background (existing behaviour), which stops every mapper and picture.
- **On unmount:**
  - the base surface is disposed through `runOnUI`;
  - photo custody disposes any still-held images after a 1.5 s grace (`use-lab-photos.tsx`);
  - the nebula and effect caches are module-level and survive, so a remount does not re-bake.
- **Reduced motion** is live (`useReducedMotionShared`). When it is on:
  - ambient is −1: corona at fixed phase 1.7, granulation at 2.3, reticle scan parked, reticle already locked;
  - fades are instant (`fadeIn` → 1);
  - the focus emphasis is instant;
  - `switchFx` is idle (no trails, warp, flare, glints, ripples or bezel swing);
  - the nebula fade is instant;
  - the choreography's own RM crossfade is unchanged.
- **Photo custody** (`lab/use-lab-photos.tsx` + `use-orrery-photo.ts` `handOff`/`slot.release`):
  1. A slot hands each retired image to the custodian instead of disposing it.
  2. After every commit, `settle(inUse)` disposes, **on the UI runtime**, the retired images that the just-written specs no longer reference. This is safe because the UI queue is FIFO and the spec write went first.
  3. On unmount, remaining images are disposed after 1.5 s.
  4. As a last guard, `drawDiscPhoto` wraps the draw in `try/catch` and falls back to initials.
  - D-41 rules 1, 2 and 4 are unchanged; rule 3 moved to the custodian. The legacy path (no `handOff`) keeps the original behaviour.

## 9. Dependencies

There are no new packages, patches or native modules (`git diff 3492092..HEAD -- package.json package-lock.json patches` is empty). The lab uses existing APIs only:
- RN-Skia 2.6.2: `createPicture`, `Picture`, `RuntimeEffect`, `MakeVertices`, `Surface.MakeOffscreen`, `PathBuilder`, `ParagraphBuilder`, `Image.MakeImage`, the `opaque` Canvas prop;
- Reanimated 4.5.1: `useDerivedValue`, `useAnimatedReaction`, `withTiming`, `runOnUI`;
- zustand, for the experiment-only toggle store.

There is no network access and no game engine.

## 10. Coexistence with the legacy renderer

`OrreryWorld` renders exactly one renderer at a time:
- **Lab on:** `labScene` goes in the canvas `backdrop` slot; `world` is `null`; photo slots are mounted; frames have no ring polygons; the canvas is opaque. The focus card uses the Lab placement (`OrreryFocusContext`, gated on `useDeepFieldEnabled()`).
- **Lab off:** the declarative tree (`ProjectedOrbitRing`, `Polaris`, `ReorderGhost`, `ProjectedBody` → `OrbitBody`/`SunBody`, `SatelliteBody`, `OrreryLabel`), memoised per layer, with a TextureView.
- **Dead code, still compiled:** the declarative Lab branches in `OrbitBody`, `SunBody`, `SatelliteBody` and `OrreryLabel` (props `deepField`, `deepInk`, `flare`, `starText`, `tickColor`, `frame`), and `lab/BodyOverlays.tsx` (`BodyLightOverlay`, `SunCorona`, `SunDisc`). `OrreryWorld` no longer passes any of these props, so the branches never run. They should be deleted in any clean V2.

## 11. Superseded designs (history only)

| Design | Commits | Replaced by | Why |
|---|---|---|---|
| Declarative deep field: `DeepFieldBackdrop`, `WorldPlaneLayer`, `BodyStackLayer`, `FocusReticleLayer`, plus per-body `BodyOverlays` in the React tree | `0a73a54` … `0c0b18b` | imperative five-picture `LabScene` (`fd7f09c`) | RN-Skia's declarative redraw re-converted about 550 animated props, replayed the whole command list and opened about 120 full-canvas layers per frame. Release measured ≈12 fps idle at ≈92 % main thread. |
| GPU fbm nebula (`NEBULA_SKSL`) + `usePictureAsTexture` | `0a73a54` | CPU bake + module cache (`c862c30`) | Facets and a seam on Mali; a re-raster pop on every remount. |
| Plane recorded under `concat(H)` with strokes and dashes | `0a73a54` | CPU-projected convex polygons + `RING_SKSL` (`527bd5b`) | CPU path masks, `drawOval` bounding quads, round joins. |
| CPU-projected 128-point polygons per ring per frame; base texture re-rasterised every change | `527bd5b`, `fd7f09c` | world-space `SkVertices` + analytic shaders; bake only when static (`033e751`) | ≈32 ms per camera frame of JS recording plus 9 ms of Ganesh tessellation (debug). |
| TextureView canvas | base | `opaque` SurfaceView (`dc7f866`) | 2–3 vsync HWUI round trip; ≈25 presents/s ceiling. |
| Reticle as a React child of the body | `527bd5b` | UI-thread focus state (`3cd7695`), then the `reticle` picture | It appeared seconds late, after the focus commit's re-record. |
