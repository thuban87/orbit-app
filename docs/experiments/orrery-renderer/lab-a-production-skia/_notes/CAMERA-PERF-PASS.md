# Lab A: camera-motion performance pass

**Date:** 2026-10-01.
**Device:** Pixel 6 Pro (`raven`), USB, display adaptive 60/120 Hz, thermal status 1 throughout. The data was the seeded Lab set (All Contacts 40 / 39 orbiting, Lab Dense 32, Lab Inner Circle 3, satellites on). Theme: Galaxy, Follow System (dark).
**Builds:**
- *Debug-native + production-mode JS* (BUILD-LOOP §(i)): the scratchpad debug APK, with JS from Metro :8083. Used for attribution and relative numbers only.
- *Release* (`assembleRelease` on droid from `git archive HEAD`, Hermes, embedded bundle, not debuggable). The final one is commit `5fb0f0d7`, sha256 `a4a42a8e…c9e9`, 208 MB. **It is left installed.**

**Commits:**
- `033e7518`: world plane in world space under the homography; base texture baked only when the scene is static.
- `dc7f8669`: opaque (SurfaceView) Lab canvas; ring-shader early-out.
- `5fb0f0d7`: Lab frames skip the 128-point ring polygons; cheaper band and dash sampling.
- This doc and `evidence/camera-perf/` are in the next commit.

## Headline

Camera motion was slow for three stacked reasons, all now removed:
1. JS recording of the world plane.
2. Ganesh re-tessellating stroked polygons.
3. The TextureView present path.

In release, a camera animation (Recenter recovery, which is not bound by input rate) now presents at **82–92 fps with a median frame gap of 8.3 ms**: the display rate, with occasional 16.7/25 ms frames. Before, the same build path panned at **≈18–21 presents/s**.

Scripted pans present at 63/s, but that number is the **adb input-injection ceiling**, not the renderer's (see §3).

Switches now show 83–120 visible changes up to settle, against 19–24 before. Focus responds in 5–45 ms and settles in ≈0.63 s.

The cost: **idle main-thread CPU rose from ≈17 % to ≈32 %**. The SurfaceView keeps the panel at 120 Hz, so the always-on clock's frame loop runs twice as often (residual 1).

## 1. Profile (debug-native + production JS, pan on All Contacts)

`evidence/camera-perf/debug/probe-*.txt` hold per-mapper UI-thread timings: temporary `performance.now()` probes, not committed (`tools/addprobes.py`). `simpleperf/before-pan-main-thread-dso.txt` holds the simpleperf DSO split. Pan used the BUILD-LOOP adb swipe loop.

| Per camera frame (ms, debug) | Before (`2111be64`) | After milestone 1 | Final |
|---|---|---|---|
| Frame worklet (`projectFrame`; 128-pt ring polygons per body) | 4.1 | 4.0 | **0.45** |
| Record world plane (JS) | **32.0** | 7.1–8.5 | 4.8–5.6 |
| ↳ of which rings | ≈26 (JSI conversion of 128-point arrays) | 5.3 | 3.2–3.4 |
| ↳ of which grid | ≈4.6 | 0.35–0.5 | same |
| Rasterise base texture: `surface.flush` (Ganesh stroke tessellation) | **9.0** every frame | 1.6 (only once static) | same |
| Bodies (below + above), sky, sun, labels | ≈4.5 | ≈4.5 | ≈4.5 |
| Scene updates/s while panning | 14 | 27 | 27–36 (input-bound) |

simpleperf on the main thread while panning, before: `librnskia` 29 %, `libworklets` 23 % and `libhermesvm` 23 %. That is JSI host-call overhead from `addPoly` of 128-object arrays plus per-point `mapHomography`; `libc` was 12 %.

The arch-pass section-skip result still applied: **the plane was the cost**. It was not the bodies.

## 2. Design (committed)

### 2.1 World plane drawn in world space under the homography

The leading idea was a picture recorded once in world coordinates and drawn under `concat(H)`. It was **not adopted literally**. PASS 2 had already measured why: Ganesh has no GPU path for *strokes* under a perspective CTM, so they fall back to CPU path masks. Strokes also need constant *screen* widths.

The adopted design keeps the core idea (cache world geometry once; a camera move costs one matrix per element) without stroking anything in world space:

- **Cached unit geometry** (`makePlaneShapes`, built once on the JS thread):
  - 30 unit **annulus strips** `1 ± ε` with 128 segments (`SkVertices`, triangle strip). The ε steps form a ×1.25 geometric ladder. The outer edge is pushed out by `1/cos(π/128)` so the polygon strip contains the true circle band.
  - One unit **disc fan**.
  - Unit n-gons (`SkPath`) for the screen-space fallback.
- **Rings:** one `drawVertices(band)` per ring under `concat(H·S(R))`. Local coordinates are unit coordinates, so the world point is `p = u·R`.
  - `RING_WORLD_SKSL` draws the stroke analytically. Distance to the ring in screen dp is `|r − R| × |J·r̂|`, where `J` is the Jacobian of `H` at `p`, computed per pixel from `H` passed as uniforms. Widths therefore stay **constant screen dp** (the 2/3/4 width channel), with a 1-device-pixel AA feather.
  - Hairline and status segment are one draw: the segment is composited over the hairline, in the same order as the two former draws.
  - Dashes, the ink-in reveal and the status segment use **world angles** about the sun.
  - The band per ring is the narrowest one containing the widest stroke + AA at the ring's smallest radial screen scale (`minRadialScale`, 8 samples, +10 % margin).
  - Pixels outside both strokes exit before any trigonometry.
- **Grid:** one analytic `GRID_SKSL` draw on the unit disc under `H·S(S)`. It covers the fading reference circles, spokes with an inner→outer ramp, the double bezel and the 120-tick dial with the switch spin, in the old draw order.
- **Pool and haze:** gradients on the same disc. The pool's radial gradient is exact under perspective (it was a local-affine approximation). The haze is world-linear (it was screen-linear).
- **Unchanged screen-space parts:** shadows, moon-orbit hairlines, arrival ghosts and switch FX. They are small or transient, and use the native `addPath(unit, H·T·S)` instead of JS polygon projection.
- **No CPU tessellation remains for the plane.** `drawVertices` is plain GPU triangles under perspective, and that was verified on device.

**Matrix derivation.**
- `planeHomography(pose, viewport)` (existing) is the exact 3×3 of `projectWorldPoint`: `H = T(c) · [[z, 0, 0], [0, z·cos t, 0], [0, −sin t / f, 1]] · R(yaw) · T(−pose)`, up to scale, built from the frame's **clamped** pose.
- A circle `(cx, cy, r)` is the unit polygon under `circleMatrix(H, cx, cy, r) = H · T(cx, cy) · S(r)`.

**Tests** (`lab/world-plane-camera.test.ts`):
- Unit-polygon vertices mapped by `circleMatrix` equal `projectWorldPoint` *and* the frame's `ringPath` to 1e-6, for three poses including tilt 1 rad and yaw 4.
- `minRadialScale` matches a finite difference of `projectWorldPoint` within ≤ 8 %.
- The chosen band contains the stroke + AA, and the next narrower one would not.
- The `RING_WORLD_SKSL` and `GRID_SKSL` uniform blocks match their SkSL declarations. RN-Skia throws on a mismatch.
- With world resources present, each ring is **one** `drawVertices`, the grid is one draw, and no stroked `drawPath` remains.
- Lab frames without ring polygons keep identical positions, radii, depth and hit data.
- The 32-gon dash perimeter is within 0.5 % of the 128-gon.

The existing `deep-field-math.test` still pins `planeHomography ≡ projectWorldPoint`.

### 2.2 Base texture only while static (`LabScene` `below`)

While the scene changes (pan, pinch, focus flight, switch, fades), the fresh `below` picture is drawn directly. Re-rasterising into the 18 MB offscreen surface every frame had cost a second full-screen pass plus a copy-on-write snapshot.

Once the scene has been unchanged for 2 ambient ticks (≈66 ms), it is rasterised once and ambient-only redraws blit the texture, as before. Under reduced motion there is no ambient time, so it is never baked; nothing redraws at idle anyway.

**Ambient cap interplay:** camera motion redraws at full rate, because the scene changes every frame. Ambient-only frames stay at `AMBIENT_HZ` 30.

### 2.3 Opaque canvas → SurfaceView (`OrreryCanvas`, Lab only)

After 2.1 and 2.2, release still presented only ≈24–26/s in continuous pans, while main-thread work was well under budget. The cause is RN-Skia's default `TextureView`: every present must be re-composited by HWUI, and the draw→swap→HWUI-latch round trip cost 2–3 vsyncs.

The Lab draws a full-bleed opaque sky, so its `<Canvas>` is now `opaque`, which makes RN-Skia use a `SurfaceView`.

The same debug build measured **26 vs 59 presents/s** in continuous pans with nothing else changed (§3). With a trivial scene the SurfaceView path reaches 110–117 fps, so it adds no structural cap.

RN overlays (pills, FABs, focus card, sheets) still draw above the canvas, as the parity sheets show. The legacy renderer keeps the TextureView, so the A/B baseline is unchanged.

### 2.4 Lab frames skip the ring polygons (`projectFrame(…, ringPaths = false)`)

The 128-point `ringPath` per body was ≈88 % of the frame worklet. The Lab no longer reads it:
- Rings come from world geometry.
- The dash perimeter comes from a 32-gon.
- The arrival-ghost ring comes from a world circle.
- The reorder ghost projects its ring on demand while dragging.

`OrreryWorld` passes `ringPaths = !deepFieldOn`, a plain boolean capture. `orrery-frame-mapper.test`'s `available` list was updated deliberately. Its no-`camera`, no-heavy-capture and settles-after-publication assertions are unchanged and green.

## 3. Measurements

### Why the metrics changed

- **gfxinfo no longer sees the canvas.** A SurfaceView presents directly to SurfaceFlinger, so gfxinfo frame counts no longer measure it.
  - Every renderer is now compared with **SurfaceFlinger presents**: `dumpsys SurfaceFlinger --latency` on the Orrery's layer. That is the app window for a TextureView, or `SurfaceView[…](BLAST)` for a SurfaceView.
  - Tools: `tools/sfpan.sh`, `sfidle.sh`, `sfanim.sh`.
- **Scripted pans are input-bound.** `adb shell input swipe` injects moves at a rate that caps camera updates. A trivial scene (plane and bodies skipped) got only ≈45 pose updates/s from the same swipes.
  - Pan figures above ≈45–60 are therefore an injection ceiling.
  - The renderer's capacity is measured with a **camera animation**: Recenter's recovery flight is a UI-thread `withTiming` on the pose, one sample per vsync.
- Pinch cannot be automated (no multitouch).

### Release (same device and data, `evidence/camera-perf/release/`)

| Metric | Before: arch-pass release `fd7f09c8` (TextureView) | Milestone 1 release `033e7518` (TextureView) | **Final release `5fb0f0d7` (SurfaceView)** |
|---|---|---|---|
| Pan, continuous 3 s swipes: presents/s (SF) | 19–21 (median gap 50 ms) | 24–25 (42–50 ms) | **63** (16.6 ms; injection-bound) |
| Pan, BUILD-LOOP swipe loop: gfxinfo frames / 10 s | 188 / 172 / 175 (PERF-RESULTS protocol) | 235 / 223 / 246 | n/a (not visible to gfxinfo) |
| Camera animation (recovery), presents/s | not separable (< 25) | not separable | **82 / 92 / 84** (median gap **8.3 ms**) |
| Main-thread CPU while panning | — | 56 % | 61 % |
| Idle presents/s (ambient 30 Hz) | 21 | 21 | 21 |
| Idle main-thread CPU | 17 % | 15–17 % | **32 %** (display held at 120 Hz) |
| Reduced-motion idle presents / CPU | 0 / 4–15 % | 0 / 13–15 % | **0** / 12–13 % |
| Switch settle (s), All→Dense / Dense→Inner / Inner→All | 2.06–2.13 / 1.80–2.30 / 2.13–2.19 | 2.05 (2 runs show a late low-amplitude change at ≈10.5 s) / 2.20–2.23 / 2.10 | 1.89–2.50 / 2.20–2.24 / 2.57–2.61 |
| Switch visible changes, tap → settle | 19–24 | ≈29–37 | **83–120** |
| Focus tap → first change / settle (s) | 0.06–0.18 / ≈0.7 | 0.01–0.10 / 0.68–0.73 | **0.005–0.045 / 0.61–0.65** |
| Memory after load, PSS / GL / EGL (MB) | 460 / 110 / 133 | 429 / 88 / 133 | 449 / 88 / 162 |
| Memory after 10 switches, PSS (MB) | 559 | 538 | 562 |
| Thermal, 2-min soak (pans + switches) | 1 | 1 (34.7 → 34.9 °C) | 1 (35.0 → 35.3 °C) |

**Notes on the release table:**
- Before figures from `evidence/arch-perf/release/relproto.txt`, plus a same-session SF re-measure (`sfshort-rel-arch.txt`).
- Switch settle: the last change ≥ 0.8 mean-grey diff. With many more intermediate frames, small late changes cross the threshold more often, so Inner→All reads ≈0.4 s later; the motion itself is the same ≈2.2 s choreography.
- Visible changes are screenrecord-limited.
- Memory: the extra ≈29 MB EGL is the SurfaceView's buffer queue.
- One Inner→All run is missing (selector pick miss).

### Debug-native + production JS (relative only, `evidence/camera-perf/debug/`)

| Metric | Before | Final |
|---|---|---|
| Pan, BUILD-LOOP loop: gfxinfo frames / 10 s, p50 | 103–109, p50 61–65 ms | 230–235, p50 12–14 ms (milestone 1, TextureView) |
| Pan, continuous swipes: SF presents/s | 26 (TextureView, same build) | 59–63 (SurfaceView) |
| Recovery animation, presents/s | — | 52–64 (trivial-scene ceiling: 110–117) |
| Main-thread CPU, pan / idle | 70 % / 20 % | 72–74 % / 43–45 % (120 Hz) |

## 4. Visual parity (`evidence/camera-perf/parity-*.jpg`, final release vs `evidence/final/`)

`parity-overview-focus-dense.jpg` covers overview, focus on Clara and Lab Dense. `parity-themes.jpg` covers Galaxy light and Standard dark. No regressions were seen: same rings, status colours, dashes, segments, grid, bezel, shadows, bodies, labels and card.

Deliberate or approximate differences, none visible at phone scale in these sheets:

| What | Before | Now |
|---|---|---|
| Dash positions | screen angle about the projected sun | world angle; count still from the screen perimeter |
| Far→near hairline ramp | screen-linear | world-linear |
| Haze | screen-linear | world-linear |
| Pool gradient | local-affine approximation | exact perspective |
| Spoke ramp | screen-linear | world-linear along the radius |
| Tick and spoke ends | `drawLine` butt caps | analytic radial clip, same position |

Widths stay constant screen dp. There is **no** new far-side thinning: the far-side fade is the existing alpha ramp plus the segment depth alpha.

## 5. Contract (ARCH-PERF-PASS) preserved

- **Single sampled `frame`.** Rings and grid draw from `frame.pose`, passed through the same `planeHomography` that hit math matches. Hit testing and label allocation untouched.
- **Reduced motion:** 0 idle presents in release.
- **Tokens:** all inks are token RGBA uniforms; `check:colors` passes with 0.
- **Photos and lifecycle:** photo custody untouched. The base surface is still released on unmount; the canvas still unmounts on blur/background.
- **Clock and worklets:** single clock. Worklet helpers are defined above their callers (`perimeter` was moved above `ringPerimeter`; `orrery-worklet-order.test` is green).
- **Legacy renderer** behaviour is unchanged: TextureView, ring polygons on.

## 6. Limits and residual risks

1. **Idle CPU doubled (≈17 → 32 % release).** With a SurfaceView the panel stays at 120 Hz, so the always-on `useClock` frame callback and Reanimated's frame loop run at 120 Hz; with the TextureView, idle dropped the panel to 60 Hz. Reduced-motion idle is unaffected (12–13 %).
   - V2: drive the ambient time without a per-vsync callback (stop the clock between ambient ticks / under RM), or vote a 30 Hz frame rate on the surface. The latter needs an RN-Skia patch.
2. **Camera animation is ≈85 fps, not a locked 120.** The main thread is ≈8–10 ms per camera frame in release.
   - Remaining per-frame JS: ring uniforms (36 floats × rings) plus save/concat/draw/restore per ring, the bodies (≈10 JSI calls + 35-float uniforms each), sky and labels.
   - V2: one draw for all rings (uniform arrays), cached per-ring world strips (no per-ring `concat`), and body uniforms that skip work when unchanged.
3. **Real-finger pan was not measured.** Injected swipes are input-bound at ≈60 Hz. The animation figure is the evidence for renderer capacity; a hand test on the device would confirm.
4. **Band strips are conservative.** They are sized for the most-compressed point of each ring, so near-side fragments are wasted; the early-out makes them cheap. GPU time was not measured directly: HWUI GPU columns no longer apply, and the Perfetto trace processor still cannot run on this box.
5. **SurfaceView trade-offs:** no view-level alpha or transform animation of the canvas, and an extra ≈29 MB of EGL buffers. Sheets and overlays above it were verified, but screen-transition animations were not inspected frame by frame.
6. **Release builds:** three were made instead of one. The first release measurement exposed the TextureView ceiling; the next two carried the SurfaceView change and the frame trim. Each was gated on `droid-busy.sh` = IDLE and built in `orbit-lab-a` only.
7. **Scope:** one device, one data set. Debug numbers are relative only.

## 7. Recommendation (V2 / harvest)

- **Draw the world plane in world space under the exact homography,** with cached unit geometry and analytic screen-dp strokes. This is the production pattern for any plane content: rings, grid, gravity wells. Never stroke under a perspective CTM, and never rebuild polygons in JS per camera frame.
- **Make the Orrery canvas opaque (SurfaceView).** This is the single largest lever on present rate. Pair it with an idle-frame-rate fix before shipping (residual 1).
- **Keep ring polygons out of the frame.** Consumers that need them derive them from the homography.
- Next pass: the residual-1 clock fix, then residual 2.

## Device / tooling state left

- **Release `5fb0f0d7` installed** (`com.bwales.orbit.laba`, not debuggable); app data kept.
- Settings: animation scales 1/1/1, font scale 1.15, Galaxy + Follow System. All verified after the run.
- Lab Metro (tmux `orbit-lab-a`, :8083) **stopped**.
- `adb reverse` restored to exactly `tcp:8081 tcp:8082`; the main app's Metro on :8082 was listening.
- Scripts are in `evidence/camera-perf/tools/` and source `evidence/final/perf/tools/lib.sh` (paths in the session scratchpad).
