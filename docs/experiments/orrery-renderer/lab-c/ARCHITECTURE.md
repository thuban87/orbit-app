# Orrery Lab C — architecture

## One-paragraph summary

`OrreryWorld3D` takes the place of the Skia `OrreryWorld` at the one seam in `OrreryScreen`
(`World = LAB_C_TRUE_3D ? OrreryWorld3D : OrreryWorld`) and accepts the same props. Everything that
*decides* things stays on the **UI thread** in Reanimated worklets, as in production (ADR-077's single
pose owner). That covers the camera pose, the switch choreography sample, reorder preview, the satellite
layout, the projected frame used for hit tests, label allocation, and the focus card position. The UI
thread then packs a small **`OrreryPacket`** (pose, viewport, per-body world position, radius, opacity,
kind, lift, flare, and the allocated label rects) and sends it to the **JS thread** with `runOnJS`.
There, an imperative three.js **`OrreryScene3D`** renders the newest packet in its own
`requestAnimationFrame` loop through `WebGPURenderer` on `react-native-webgpu` (Dawn to Vulkan). The
three camera (`orreryCameraRig`) uses **the same pinhole formula** as the UI-thread projection, so what is
drawn is what is tappable.

```
 RNGH gestures ─► UI-thread pose (use-orrery-camera, ADR-077)
                       │
  scene snapshot ──► sample (useDerivedValue):  switch choreography ─► 3D breath camera
  (orrery-scene)       │                          reorder preview ─► satellites as moons (lift)
                       │                          min on-screen size / hero scale
                       ▼
                 frame = projectAnimatedFrameLite(...)  ──► camera.frame.value
                       │                                    (hits, focus-lost, focus card, reorder)
                       ├─► allocateLabels (tier = effectiveLabelZoom) ─► allocations
                       ▼
          useAnimatedReaction → OrreryPacket ── runOnJS ──►  JS thread
                                                             OrreryScene3D.setPacket()
                                                             rAF tick: frame() → renderer.render ×2
                                                             → context.present()
```

## Renderer

| Layer | three object | Draw calls |
|---|---|---|
| Starfield | one instanced `Sprite` (`STAR_COUNT = 2600`) on a sphere centred on the camera (rotational parallax), with a twinkle uniform | 1 |
| Orbital plane | `CircleGeometry(1,128)` disc with a baked grid/dust alpha texture | 1 |
| Orbit rings | **one** `InstancedMesh` of a 160-segment unit strip. The TSL vertex node widens it to a constant number of *screen* pixels. Dashes and depth fade are done in the fragment shader | 1 |
| Contact bodies | `InstancedMesh` of `SphereGeometry(1,20,14)`, `MeshStandardNodeMaterial`, lit by a point light at the sun | 1 |
| Moons | separate `InstancedMesh` with an emissive floor | 1 |
| Sun | emissive sphere (limb darkening plus baked granulation noise), additive glow and corona sprites | 3 |
| Faces | **one** instanced `Sprite` that samples a 2560² photo/initials atlas, per-pixel lambert shading toward the sun, sun medallion branch | 1 |
| Focus rings, capture flares, Polaris | small sprite pools | few |
| Labels | second pass with an orthographic camera. One textured quad per allocated label, rasterized by Skia | 1 per label |

The renderer log reports 13–16 draw calls at the Dense overview (PERFORMANCE.md C.4). There is no
post-processing and no bloom (see DEAD-ENDS.md).

## Dependencies and native consequences (verified)

| Item | Value | Where |
|---|---|---|
| `react-native-webgpu` | `0.10.4` exact (renamed from `react-native-wgpu` in May 2026, so a young package) | `package.json`, `RENDERER-DECISION.md` |
| `three` | `0.186.1` exact; imported as `three/webgpu` and `three/tsl` | `package.json` |
| `@types/three` | `0.186.0` (dev) | `package.json` |
| Expo config plugin | `"react-native-webgpu"` added to the string plugins (edits only the iOS scheme; no-op on Android) | `app.config.ts` |
| **minSdk 26** | `plugins/withLabCMinSdk.js` writes `android.minSdkVersion=26` to gradle.properties. Reason: Dawn's Android C++ uses `AHardwareBuffer_*` (API 26). Expo 57's default of 24 fails CMake. **Shipping this raises the real app's minSdk, which is an owner decision** | `plugins/withLabCMinSdk.js`, `app.config.ts` |
| Native size | `libwebgpu_dawn.so` 17.5 MB + `libreact-native-webgpu.so` 3.1 MB ≈ **20.6 MB per ABI** (stored uncompressed). Release arm64 APK **102.9 MB** (debug arm64 139.7 MB). JS bundle 8.9 MB including three | RUNBOOK §8 (F.1, c7fcbe80) |
| Metro config | none needed (no `three/addons` imports) | — |
| `TextDecoder` | a shim to `RNWebGPU.DecodeToUTF8` is installed if missing. Every logged `renderer ready` line shows `TextDecoder=function` | `three/orrery-gpu.ts` |
| App identity | `com.bwales.orbit.labc`, `APP_NAME` "Orbit Lab C", scheme `orbitlabc` (the OpenRouter intent filter follows it) | `app.config.ts`, `src/constants/app-name.json` |
| Build host | droid (Windows) via tar over ssh, Gradle `-PreactNativeArchitectures=arm64-v8a` | RUNBOOK §2–3, §8 |
| Network | none on any render or read path. Photos are local `file://` derivatives decoded by Skia | — |

The baseline APK size *without* WebGPU was not measured. The 20.6 MB figure is the size of the two
native libraries.

## Lifecycle

- **GPU device.** `three/orrery-gpu.ts`. One `GPUDevice` per mount, destroyed on unmount. A spare is
  prewarmed at module load and again right after each unmount (`prewarmOrreryDevice`). The world only
  mounts its `<Canvas>` once it holds a device. Reason, from the M1 spike and recorded in the code
  comments: `requestDevice()` issued while the SurfaceView was being created blocked JS and main for about
  32 s, and a process-wide shared device leaked every renderer (three hooks a `device.lost` reaction per
  renderer). The M1 notes file the comments cite (`_notes/M1-BUILD.md`) **does not exist in the repo**, so
  these two claims rest only on the code comments and the 205c1462 commit message.
- **Queue pin.** In `react-native-webgpu 0.10.4`, every `device.queue` read creates a new native wrapper.
  `createDevice` pins one wrapper as an own property.
- **Loop.** The rAF `tick` in `OrreryWorld3D` (2. renderer effect) calls `scene.frame()` and then
  `context.present()`. Unmount cancels the rAF, cancels pending photo loads, calls `OrreryScene3D.dispose()`
  (every geometry, material and texture, and drops CPU buffers), then `disposeRenderer()` (also clears
  three's `QuadMesh` listener leak), and destroys the device one tick later. Each unmount logs
  `loop stopped, GPU resources disposed`.
- **Unmount triggers.** These are the production ones and are unchanged: `OrreryScreen` unmounts the world
  on blur and on app background. The 3D world adds no timers of its own beyond the moon `useFrameCallback`,
  which is active only while one focused parent has moons and reduced motion is off.
- **Memory.** PSS is flat across remounts in release. Hermes `external` still has an unexplained
  post-GC floor that grows by about 52 MB per mount (PERFORMANCE.md).

## Animation model

- **No React state per frame.** React state changes once per mount (`setDevice`) and on resource changes
  (body infos, label texts, focus). Per-frame data moves UI → JS as a packet *only when the frame or the
  allocation changes*.
- **Two clocks.** The UI thread owns all motion that matters to semantics: camera flights, inertia, switch
  progress, moon revolution, so hit tests are always correct. The JS rAF owns ambient shader time only:
  star twinkle, sun pulse and granulation drift. Both are frozen under reduced motion.
- **Render cadence.** The JS rAF runs at **60 Hz** even though the panel runs at 120 Hz. Why was not
  investigated. A frame costs about 10–11 ms of JS in release, so 120 Hz would not fit on the JS thread
  as built.
- **Latency.** The GPU frame trails the UI-thread pose by up to one frame (packet hop). JS-thread work
  (SQLite reads during a switch, React commits) can delay GL frames but never hit testing.

## Experimental compromises (contract: B/C must document them)

- The render loop runs on the JS thread, not the UI thread.
- Light and dark mode use a luminance test on the `background` token (`applyColors`) rather than an explicit
  theme flag.
- Some colour constants are not tokens. Sun core highlight `vec3(1,0.95,0.85)`, white/black alpha ramps in
  the masks and plate shading, and the procedural seed portraits are numeric. Everything else (body fill,
  rings, glow, plane, fog, ambient, key light, focus, flare, labels) resolves through `ThemePalette` tokens.
- `HOME_CAMERA`, `MIN_ZOOM` (0.25 → 0.08), `MAX_TILT` (→ 1.32) and Home derivation were changed **in
  the shared `src/logic/orrery-camera-logic.ts`**, not behind the `LAB_C_TRUE_3D` flag, so the Skia path on
  this branch would inherit them.
- The reorder ghost is not drawn in 3D. Reorder still repositions bodies through `previewReorder`.
- A lab badge ("ORRERY LAB C — TRUE 3D") cycles four camera presets, because adb cannot pinch.
- Stale comments: the `OrreryWorld3D` header still says "ring stroke width fixed in world units" (rings are
  screen-px now). The `OrreryScene3D` header and the star loop comment still describe a "2k slab under the
  plane" (it is a 2600-point sphere around the camera since da5433a9).
