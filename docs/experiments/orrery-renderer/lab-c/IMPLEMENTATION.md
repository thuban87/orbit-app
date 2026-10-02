# Orrery Lab C — implementation reference

Line numbers are as of the commit that adds this package (HEAD of `experiment/orrery-3d`, 2026-10-01).
`git diff --stat main...HEAD` outside `docs/`: 31 source/config files, ~5,000 inserted lines.

## New files

| File | Role | Key symbols | Introduced / last major change |
|---|---|---|---|
| `src/components/orrery/OrreryWorld3D.tsx` (1357 lines) | Drop-in world at the OrreryScreen seam. UI-thread sample → frame → labels → packet; GPU lifecycle; rAF loop; gestures | constants L129–254; `switchDepth` L276; `disposeRenderer` L321; moon clock `useFrameCallback` L431; `sample` L434 (switch, breath camera, reorder, moons with lift L518–519, min on-screen size L533); `frame` L565 (top-inset fade L589); `effectiveLabelZoom` L204/L706; `allocations` L714 (focus card exclusion via `focusCardPlacement` L757); packet reaction ~L790–843; device acquire effect L1010; renderer and loop effect L1035–1180; lab badge presets `cycleTilt` L1253 | 205c1462; da5433a9; 823bd69f; 64858959; 7dd23580; 20ae3596; e4d9e842; 97d94229; 4a82ae85 |
| `src/components/orrery/three/orrery-scene3d.ts` (1415 lines) | Imperative three scene: all meshes, TSL materials, packet → instance buffers, labels overlay, dispose | tunables L79–158; `ringStripGeometry` L257; `OrreryScene3D` L283; rings L497–555; faces TSL (lambert disc + sun medallion) L557–660; stars L661; sun core TSL L757; `applyColors` L805; `setBodies` L868; `setLabelTexts` L928; `frame` L951; `dispose` L1334 | 205c1462; da5433a9; 0219e4a8; c5533857; 84f5d646/7dd23580 (ring density); 97d94229 (moons); 2ca56317 (light) |
| `src/components/orrery/three/orrery-camera-rig.ts` | Pinhole pose → three camera world matrix, FOV, `setViewOffset` principal-point shift. Pure numbers, shared with tests | `orreryCameraRig` | 205c1462, da5433a9 |
| `src/components/orrery/three/orrery-gpu.ts` | Adapter/device ownership, prewarm, queue pin, TextDecoder shim, `createImageBitmap` probe | `prewarmOrreryDevice`, `acquireOrreryDevice`, `releaseOrreryDevice`, `runBitmapProbe` | 205c1462 |
| `src/components/orrery/three/orrery-textures3d.ts` | CPU texture generation: body atlas, label raster, procedural masks | `BodyAtlas` (`flush` per dirty tile, `drawInitials` with plate/glyph, `drawPhoto`), `rasterizeLabel`, `radialGlow`, `annulus`, `planePattern`, `noiseTexture` | 205c1462; ba48c76c; c5533857; f1d9b310; e4d9e842 |
| `src/components/orrery/orrery-frame-lite.ts` | The published `AnimatedFrame` without the 128-point `ringPath` per body. Adds `lift` projection and near-cull (12% of dolly) | `projectAnimatedFrameLite` L34 | 205c1462; da5433a9; 20ae3596 |
| `src/components/orrery/orrery-text-cache.ts` | Paragraph cache keyed by (provider, role, scale, width, ink, text); `sweep` disposes unreferenced entries | `OrreryTextCache` L33 | e4d9e842 |
| `src/components/orrery/orrery-focus-card-layout.ts` | Docked focus-card placement shared by the card and label exclusions | `focusCardPlacement` L23, `FOCUS_CARD_SIDE_RESERVE 92` | 4ece2978, 7d558d87 |
| `src/__dev__/lab-c-seed.ts` | Dev-only fixture through real DAOs. Procedural JPEG portraits | `seedLabCFixtureIfAbsent`, `portraitBytes` | c830da0a |
| `plugins/withLabCMinSdk.js` | Writes `android.minSdkVersion=26` | — | 205c1462 |
| Tests | `orrery-frame-lite.test.ts`, `three/orrery-camera-rig.test.ts` (UI-thread vs GPU pinhole parity incl. 12 lifted cases), `orrery-text-cache.test.ts`, `src/logic/orrery-strategy-camera.test.ts` | — | 205c1462; ca131870; 20ae3596; e4d9e842 |

## Modified production files (all lab-gated or noted)

| File | Change |
|---|---|
| `src/logic/orrery-camera-logic.ts` | Real camera: `LAB_FOCAL_PX 720` L75, `LAB_HOME_TILT 1.08` L77, `labFocalDistance` L78, `HOME_CAMERA` tilt L82; `MIN_ZOOM 0.08`, `MAX_TILT 1.32` L138–140; `cameraCenterRect` L252 (optional `viewport.camera`); `perspectiveScale` clamps the denominator L281; Home derivation `deriveHomePose` L357 (strategy composition, disabled whole-disc branch `LAB_FIT_ALL_ENABLED=false` L104, core framing `coreRadius` L120 / `LAB_CORE_*` L115–118). **Not flag-gated.** |
| `src/logic/orrery-gesture-logic.ts` | `ORBIT_YAW_PER_POINT 0.0076` L22, `ORBIT_TILT_PER_POINT 0.0052`, `CameraStep` `orbit` L103 |
| `src/logic/orrery-recovery-logic.ts` | Orbit inertia: `ORBIT_COAST_SECONDS 0.32` L23, `inertiaTarget` orbit branch L118 |
| `src/components/orrery/use-orrery-camera.ts` | `createOrreryGestures({ strategyCamera })`: one finger orbits, two fingers pan (centroid any direction). Off = production mapping |
| `src/logic/orrery-label-logic.ts` | `LabelCandidate.depth`: nearer labels claim space first |
| `src/components/orrery/OrreryLabel.tsx` | `orreryParagraphBuilder`: one ParagraphBuilder per font provider (WeakMap), `reset()` per use |
| `src/components/orrery/OrreryFocusContext.tsx` | Uses `focusCardPlacement`; anchors under `systemRadius` |
| `src/screens/OrreryScreen.tsx` | `LAB_C_TRUE_3D`; `viewport.camera` = canvas minus full-width bars, height ×0.62 (lens shift); focus framing of the contact's system above the docked card (3 fixed-point project/unproject steps); lab-only "Unavailable System" name reconciliation (f608d35d) |
| `App.tsx` | `__DEV__` seed require; `LogBox.ignoreLogs` for the Reanimated render-read warning (toast ate tab taps) |
| `app.config.ts`, `src/constants/app-name.json`, `package.json` | Identity, plugins, deps (ARCHITECTURE.md) |

## Algorithms worth reproducing

1. **Shared pinhole for draw and hit** (`orrery-camera-rig.ts`, `projectWorldPoint`). For a plane point:
   `screen = centre + F·(x, y·cos t)/(f − y·sin t)` with `F = zoom·f`, `f = 720/zoom` (dolly). The three camera
   is built from the same rows (world = Rᵀ, position = pivot + f·r_z, `fov = 2·atan(H/2/F)`, `setViewOffset`
   for the off-axis centre). A parity test pins it.
2. **Instanced screen-px rings in one draw** (`ringStripGeometry` + ring TSL). A unit strip with side ±1 is
   scaled to the instance radius `r + side·halfPx·worldPerPx` (`worldPerPx = 1/zoom`). The fragment shader
   computes AA edge, arc-length dashes (`atan·r / dashWorld`) and the depth fade, and discards alpha < 0.004.
3. **Ring density fade** (`frame`). `spacingPx = extent/ringCount·zoom`; `k = max(floor, min(1, spacingPx/20)²)`
   multiplies ring alpha and width.
4. **Lit face billboards** (face TSL). Disc uv → hemisphere normal `(p, √(1−p²))`, lambert against the
   per-instance view-space sun vector, `0.95·lambert + 0.3`. The sun instance is flagged by `faceSun.z = 1.25`
   and takes the medallion branch.
5. **Minimum on-screen size** (`sample`, `OrreryWorld3D` L523–537). World radius = `max(r, minPx/2 / pxPerWorld
   at that depth)`, so it feeds frame, hits, labels and GPU alike.
6. **Effective label zoom.** The median of `(projected radius / un-heroed world radius)·1.9` over visible
   interactive contacts feeds the unchanged `semanticLevel` thresholds.
7. **Core framing for dense Systems** (`deriveHomePose`, > 24 contacts). Bisection on zoom at tilt 0.85
   until the disc holding 50% of contacts projects between the selector row and the usable bottom.
8. **3D switch layer** (`switchDepth`, breath in `sample`). Lift `−0.42·ext·shed²` for leaving, `+0.55·ext·(1−capture)²`
   for entering; flare `sin(π·f)` in a 0.16 window at capture end; breath `sin²(πp)·(0.5+0.5·intensity)`.
   Exactly zero at p = 0 and 1.
9. **Moons** (`sample` L511–520). `x = cos a·r`, `y = sin a·r·cos i`, `lift = sin a·r·sin i`, `i = 0.5`. The
   revolving angle comes from a UI-thread frame callback that runs only for the focused parent.
10. **Atlas** (`BodyAtlas`). 16×16 tiles of 160 px (2560²), one Skia raster surface. Only dirty tiles are
    snapshot and copied into a persistent `Uint8Array` that a single `DataTexture` wraps. Uploads are coalesced
    to ≥ 250 ms (`ATLAS_UPLOAD_INTERVAL`).
11. **Labels.** Skia Paragraph (shared builder, cached Paragraph) → per-label RGBA raster at render DPR →
    textured quad in an ortho overlay pass at the UI-thread allocation rect. Rasters are kept while the
    Paragraph object is unchanged, with an LRU of 96 (`LABEL_CACHE_MAX`).

## Shaders

All are TSL node materials in `orrery-scene3d.ts`. There is no hand-written WGSL. Rings (vertex and
opacity nodes), faces (colour and opacity nodes with discard outside the disc), stars (instanced sprite
with a twinkle opacity), sun (limb, granulation, hot core), plane (baked alpha × uniform), glow/corona/
Polaris/focus/flare (mask texture × material colour).

## Debug instrumentation (lab-only, remove for production)

The renderer log every 5 s (`[lab-c] frames=… fps=… jsRenderAvg … presentAvg … drawAvg … visibleContacts …`)
and the memory log (`[lab-c] mem …`, `post-unmount` with a forced `gc()`). The focus/switch/reducedMotion log
lines, `runBitmapProbe` and the lab badge presets are also lab-only. The renderer log is **not** stripped in
release builds.
