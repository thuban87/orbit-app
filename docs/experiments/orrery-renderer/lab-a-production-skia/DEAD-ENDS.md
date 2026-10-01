# Lab A — Dead ends

This file lists the ideas Lab A tried or seriously considered and then rejected, and why. A V2 should not re-run them without a new reason.

- **"Recoverable"** gives the commit where the code still exists: `git show <commit>:<path>`.
- **"Not committed"** means the attempt was bisected locally during a pass and never landed. Only the note and its measurement survive.
- Sources: `_notes/*.md`, `evidence/direction-1/REVIEW.md`, `evidence/final/PERF-RESULTS.md`.

## A. Attractive but slow (performance dead ends)

| # | Idea | Why it looked good | Why it died (measured) | Recoverable |
|---|---|---|---|---|
| A1 | **Declarative RN-Skia tree with per-body / per-label Groups** (`DeepFieldBackdrop`, `WorldPlaneLayer`, `BodyStackLayer`, `FocusReticleLayer`, `BodyOverlays`, `layer` on every body/label root) | Idiomatic RN-Skia. Each element is a component, and the tests pin tree shape. | Release: ≈12 fps idle, **92% main-thread CPU**, ≈5 fps pan, 3.6–8.9 s focus response. RN-Skia 2.6.2 re-converts all ~550 animated props and replays the whole command list on every change. ~120 `layer` props = ~120 **unbounded full-canvas `saveLayer`s** per frame (Mali framebuffer churn = 58% of main-thread samples). Every React commit re-records the tree on JS with blocking `runOnUISync` reads. Main's renderer has the same code pattern (verified at `3492092`); its release cost is inferred, not measured (H1/H2). | Whole tree at `6ad5a307`; files deleted in `fd7f09c8` |
| A2 | **Clock-captured derived values returning fresh objects** (corona/granule `uniforms` objects, reticle `createPicture`) | Natural way to animate a shader uniform. | A fresh object propagates on every tick, forcing a full redraw at display rate, **even under reduced motion**: the values captured the clock even when they did not read it. Release RM idle: 85–109 frames/10 s at 91% CPU, against 0 for the lab's legacy renderer. Fix: one primitive `ambient` value, quantised, −1 under RM. | `6ad5a307:src/components/orrery/lab/BodyOverlays.tsx` |
| A3 | **GPU SkSL value-noise fbm nebula** (`NEBULA_SKSL`; 5 octaves, domain warp, band mask, dust lanes) | One shader, theme uniforms, infinitely tunable. It looked perfect in CanvasKit previews. | On the Pixel's Mali: **faceted polygon shards, stair-stepped edges and a hard vertical seam** (`evidence/direction-1/00`, `01a`). Reduced-precision `hash21`/`fract(p*big)` on mediump. Also far too loud (α 0.8). Replaced by a CPU float64 bake. | `b450f47e:src/components/orrery/lab/deep-field-shaders.ts` |
| A4 | **Strokes and dashes under a perspective CTM** (pass-1 plane recorded inside `canvas.concat(H)`, widths `px ÷ zoom`) | Exact perspective for free: near-thick, far-thin lines. | Ganesh has no GPU path for strokes or dashes under perspective. It falls back to CPU path masks plus `glTexImage2D` every frame, even on idle replays: **150–200 ms idle p50 (~5 fps)** against 42–48 ms with no plane. | `c862c30a:src/components/orrery/lab/world-plane.ts` |
| A5 | Screen-space sampled polylines with `DashPathEffect`, open-arc segments, and one multi-line tick path | A CPU-projection fallback for A4. | Still ~150 ms idle. Dash path effects, non-convex paths and multi-segment paths drop to the software renderer. | Not committed (pass-2 bisection) |
| A6 | Exact projected ellipses via `drawOval` under a translate+rotate conic transform | Analytic, no polygon. | Ellipse ops draw **bounding quads**: ~80 near-screen-size quads made the plane fragment-bound (~150 ms). | Not committed |
| A7 | Per-ring 4-stop sweep-gradient shaders for the status segment | Simple gradient API. | +30 ms per idle frame. Replaced by one analytic `RING_SKSL`. | Not committed |
| A8 | `JOIN_ROUND` on ring polygon strokes | Smoother joins. | **650 ms per frame**: a software fallback. Default miter joins are required. | Not committed |
| A9 | Bounding each body's opacity `layer` with a clip | Cheaper layers without restructuring. | No measurable gain. The real fix was removing the layers (A1). | Not committed |
| A10 | Re-rasterising the `below` base texture every camera frame (arch pass) | One cached image for ambient redraws. | While the camera moves: a second full-screen pass plus a copy-on-write of an **18 MB** texture, plus a 9 ms Ganesh tessellation flush per frame. Now baked only once the scene is static. | `fd7f09c8:src/components/orrery/lab/LabScene.tsx` |
| A11 | Projecting 128-point ring polygons in JS per camera frame and passing them through `addPoly` | Reuses the frame's exact `ringPath`. | **32 ms per camera frame** (debug) to record the plane, ~26 ms of it JSI conversion of 128-object arrays. `ringPath` was also 88% of the frame worklet. Replaced by world-space unit geometry (`033e7518`) and by dropping `ringPath` from Lab frames (`5fb0f0d7`). | `2111be64:src/components/orrery/lab/world-plane.ts` |
| A12 | **RN-Skia default TextureView** present path | Default, and it composes like any view. | The draw → swap → HWUI latch round trip costs 2–3 vsyncs: a ceiling of ≈24–26 presents/s even with a cheap scene. `opaque` → SurfaceView reached 59–63 (pan, input-bound) and 82–92 (animation). Kept for legacy. | Legacy path at HEAD |
| A13 | Literal "record the plane once in world coordinates, draw it under `concat(H)`" (camera pass) | Smallest per-frame cost on paper. | Rejected before building because of A4. The adopted variant keeps the idea (cached world geometry, one matrix per element) but strokes analytically in screen dp in the fragment shader. | n/a |
| A14 | Starting the switch with `executeOnUIRuntimeSync` instead of `runOnUI` | Earlier first frame. | Gained only ~100–200 ms, at the cost of a blocking JS→UI call. Reverted. | Not committed |
| A15 | Dense per-frame sky: the near-star group drawn 6× at rest (warp levels 0..5 even at v=0) | Parity with what the declarative tree actually drew. | Not a rejected *idea* but a **live waste at HEAD**: 5 redundant picture replays per sky draw. Fix in V2: draw warp copies only while `v > 0`. | HEAD `lab/scene-draw.ts` `drawSky` |

## B. Visual dead ends

| # | Idea | Why it died | Evidence / recoverable |
|---|---|---|---|
| B1 | **Additive ring underglow** (×3 width, α 0.12, dark) | Rings got *louder*. On dashed rings the glow is itself dashed, so it reads as "fuzzy beads". | `direction-1/01a`; `b450f47e:…/world-plane.ts` |
| B2 | **North→body progress trails** (~300° on overdue bodies) | They read as a second, brighter ring, not as progress. Replaced by a ≤ 75° status segment. | `direction-1/01`; `b450f47e` |
| B3 | Progress tick where the body crosses its ring | Too small to read at overview. | `b450f47e` |
| B4 | **Contact shadow at tilt 0** (outward from the sun) | Reads as a black smudge beside the body, not as a cast shadow. Now alpha × smoothstep(tilt / 0.45 rad). | `direction-1/01a` |
| B5 | First star-disc shader (`smoothstep` heat plus a single `sin(x+y)` granulation) | "A flat gold coin with diagonal stripes". Replaced by μ-based heat with incommensurate cells. | Not committed separately (pass 1) |
| B6 | **Home tilt 28°** | Barely perceptible: the focal distance is ≈4.65 × extent, so perspective is weak. 45° reads as a plane (owner decision K: testing only). | `pass-1` notes §6 |
| B7 | Chart-mode nebula ink at 0.35 and lit pool multiply at 0.26 | A dirty grey-brown smear in light mode. Now 0.2 and 0.12. | `c862c30a` → `864f7e04` |
| B8 | Full-screen **cool horizon glow band** (`nebulaB`, dark) | A horizontal artifact across the sky. `HAZE_GLOW_ALPHA` is still in the config, unused. | Not committed as a feature |
| B9 | **Frame-chord motion trails** (tapered quads between history samples) | Chunky straight polygons at device fps. Replaced by polar resampling about the sun. | `evidence/pass-2/12c-MID-pass2-chord-trails-family-to-ic.mp4` |
| B10 | Fixed-length streak arcs (direction 1: `0.55 rad × velocity`) | Superseded by real-history trails. The `STREAK_*` tunables are dead in the config. | `b450f47e:…/world-plane.ts` |
| B11 | **Spinning reticle** (corner brackets rotating 0.0003 rad/ms, authored as `radius + 7` local units) | Caught mid-spin or mid-converge, it read as "huge asymmetric chevrons" (`pass-2/02`). The gap scaled with zoom. It was also new ambient motion. Replaced by axis-aligned screen-dp brackets plus a scan arc. | `527bd5b4:…/lab/BodyOverlays.tsx` `FocusReticle` |
| B12 | **React-mounted reticle** (pass 2, and the first pass-3 attempt) | Mounted by the focused body, so it appeared only after the focus commit's full re-record: absent 9 s after the tap (`pass-3/22`). Moved to a UI-thread picture. | `527bd5b4`; first pass-3 attempt not committed |
| B13 | Dark "hole" arrival ghosts (background fill only) | Read as black holes punched in the plane. Replaced by grid-tinted discs. | Not committed |
| B14 | Ghost orbit hairline at 1.6× hairline alpha | Brighter than the real rings. Now 0.75×. | Not committed |
| B15 | Small caps and tabular figures on label plates (hypothesis item 6) | Would change native-measured label metrics, and with them allocation and therefore Profile vs Focus. Skipped on purpose. | n/a |
| B16 | **Star twinkle as `Group opacity` over `<Picture>`** | Never rendered, because RN-Skia's `drawPicture` takes no paint. The sky has always been steady in Lab A. Whether to make it real is owner decision TW1/TW2. | `6ad5a307:…/lab/DeepFieldBackdrop.tsx` |
| B17 | Lab DEV marker anchored to the usable rect | "Doubled" mid-switch as the obstacle rect jumped. Now pinned bottom-left. | `direction-1/12a` |

## C. Lifecycle, resource and layout dead ends

| # | Idea | Why it died | Recoverable |
|---|---|---|---|
| C1 | Nebula through `usePictureAsTexture` per mount | It re-rasterised on every remount (tab return, Profile back), giving a 2–3 s blank followed by a hard pop (`direction-1/19`, `04`). Now a module cache per palette. | `0a73a54c:…/lab/DeepFieldBackdrop.tsx` |
| C2 | **Module-level SkImage photo cache** (to stop photo pop-in after remount) | Not attempted. It would reverse D-41 ("SkImage objects are never cached", which superseded D-37's cache), so it is an **owner/production decision**. A presentation cross-fade was used instead. | n/a |
| C3 | Focus card natural height from `onContentSizeChange` (pass 2) | Never reported late relationship rows or wrapped lines, so it stuck at the 180 dp default and clipped "Tom / Spouse of Clara Ruiz". Now `onLayout` on a content wrapper. **This was a lab-introduced bug**; main measures the root `onLayout`. | `527bd5b4:src/components/orrery/OrreryFocusContext.tsx` |
| C4 | Capping only the card root height (+ chrome) | The clip came from the stale natural height, not the cap. | Not committed |
| C5 | Registering the focus card as a camera obstacle | Circular: the card's position depends on framing, which depends on obstacles. It would also change camera semantics. Placement stays presentation-only. | n/a |

## D. Method dead ends (measurement and evidence)

| # | Method | Why it misled |
|---|---|---|
| D1 | **CanvasKit off-device previews as evidence** (`_notes/canvaskit-previews/`) | CPU fp32 raster hid the Mali precision bug (A3). It is good for "intended look" only. |
| D2 | Debug builds for perf or switch judgement | A 4–5 s freeze plus inflated C++ glue costs. Even production-mode JS on a debug-native APK only supports relative numbers. The release check (`730899b4`) was what reframed the lab. |
| D3 | `publish → first frame` from logcat arrival times of UI-thread `console.log` | Invalid: UI logs are forwarded through the busy JS thread. Use UI-thread `Date.now()` stamps. |
| D4 | `gfxinfo` for a SurfaceView canvas | It no longer sees the canvas. Use `dumpsys SurfaceFlinger --latency` on the `SurfaceView[…](BLAST)` layer. |
| D5 | Scripted `adb input swipe` pans as a renderer-capacity measure | Input-injection-bound (≈45–63 updates/s even with a trivial scene). Use a UI-thread camera *animation* (Recenter recovery). |
| D6 | Perfetto `trace_processor` on this box | Core-dumps on the Ivy Bridge CPU (no AVX2). The trace at `evidence/final/perf/` is unanalysed. |
