# Lab A: Performance

All numbers come from one device and one data set. They are quoted from the evidence files named in each table; nothing here is more precise than its source. "Debug" means a debug-native APK running production-mode JS (BUILD-LOOP §i), and is used for relative comparisons only. "Release" means `assembleRelease` (Hermes, embedded bundle, not debuggable).

## 1. Targets, device, scenes

- **Target.** The hypothesis guard-rail was "measure a release build on the physical phone before and after". There was no fixed fps target. The implicit bar was smooth camera motion and switches at display rate, an idle canvas that does not saturate the main thread, and zero idle redraws under reduced motion.
- **Device.** Pixel 6 Pro (`raven`, Tensor G1, Mali GPU), 1440×3120, 120 Hz (adaptive 60/120), USB. Thermal status was 1 throughout. Emulator numbers are never used.
- **Scenes** (seeded, `tools/seed-lab-a.py`):
  - **All Contacts:** 40 contacts, 39 orbiting, 5 moons;
  - **Lab Dense:** 32;
  - **Lab Inner Circle:** 3;
  - satellites on, Galaxy dark unless noted.
- **"Legacy" in A/B tables** means the legacy declarative renderer inside the **lab build**, reached through the View options toggle. It shares the lab's logic fixes and the 45° Home. It is **not** `main`, and `main` itself was never measured in release here. Main lacks the freeze fixes, so on large switches it should be no better than this "legacy".

## 2. Measurement methods and what each one covers

| Method | Covers | Blind to | Used in |
|---|---|---|---|
| `dumpsys gfxinfo` (+ framestats) | HWUI frames of the app window. With a TextureView canvas, one Skia present = one HWUI frame, so the count is fair. | Skia's own draw cost and the JS thread. **A SurfaceView canvas is invisible to it.** | baseline … arch pass, camera milestone 1 |
| SurfaceFlinger `dumpsys SurfaceFlinger --latency <layer>` (`evidence/camera-perf/tools/sf*.sh`) | Actual presents of the Orrery layer (the app window for a TextureView, `SurfaceView[…](BLAST)` for the opaque canvas) | CPU attribution | camera pass (all renderers re-measured) |
| `/proc/<pid>/task/*/stat` deltas | Per-thread CPU (main = "ales.orbit.laba", RenderThread, `mqt_v_js`) | Includes the scan itself, so it reads slightly low (±10 points) | final, arch, camera |
| `screenrecord` + frame diff (`vfps.py`, `swan.py`, `vidan.py`) | Tap-relative visible changes, settle time, identity resolve | Ceiling of about 8 fps on change counts; ±0.1 s; recording costs CPU | perf, pass 3, final, arch, camera |
| UI-thread `Date.now()` probes (temporary; `evidence/perf/probe-instrumentation.patch.txt`, `evidence/camera-perf/tools/addprobes.py`) | Per-mapper and frame-worklet ms, switch frame counts | Probes are not committed. Logcat *arrival* time of UI logs is **not** a timestamp (they go through the JS thread). | perf pass, pass 3, camera |
| simpleperf (`-g`, 4–6 s @ 4 kHz) | Main-thread symbol and DSO attribution | Debug-native inflates C++ costs | pass 2, perf, arch, camera |
| Perfetto | One trace saved (`evidence/final/perf/trace-lab-switch-all-to-dense.pftrace`) | **Not analysed.** `trace_processor` crashes on this box (no AVX2). | — |
| `dumpsys meminfo`, thermal service, battery | PSS, GL/EGL mtrack, native heap, temperatures | — | final, arch, camera |
| Scripted pan (`adb input swipe`) | Relative pan comparison | **Input-bound.** About 45–63 pose updates/s even with a trivial scene; not a real finger. | all |
| Recenter recovery animation (UI `withTiming`, one sample per vsync) | Renderer capacity during camera motion, without the input-rate limit | — | camera pass |

## 3. Chronological results

### 3.1 Baseline and pass 2 (debug; relative only)

| State | Metric | Value | Source |
|---|---|---|---|
| Baseline (debug + Metro, legacy) | idle gfxinfo, 10 s | 186 frames, p50 69 ms, 100 % janky (a debug artifact) | BUILD-LOOP §h, `evidence/baseline/17` |
| Pass-1 plane | idle p50 | 150–200 ms (≈5 fps) | `_notes/PASS-2.md` |
| No plane / legacy | idle p50 | 42–48 / 46 ms | same |
| Pass-2 plane (convex polygons + `RING_SKSL`) | idle p50 All / Inner Circle | ≈73 / ≈18 ms | same |

### 3.2 Switch/focus freeze (debug-native + production JS; `evidence/perf/latency-summary.txt`)

| Switch | Before (`15ec425a`): tap→settled, worklet runs, max Davey | After, Lab A | After, legacy (toggle) |
|---|---|---|---|
| Lab Dense → All | jump (0 frames), Davey **4984 ms** | 2.53 s, 19 runs, 0 | 2.76 s, 33, 0 |
| All → Lab Dense | 5.4 s, 2 runs, **4609 ms** | 2.67 s, 20, 0 | 2.56 s, 33, 0 |
| Dense → Inner Circle | 4.3 s, 2, **3881 ms** | 2.42 s, 28, 0 | 2.56 s, 39, 0 |
| Inner Circle → Dense | 3.2 s, 7, 1695 ms | 2.37 s, 62, 0 | 2.45 s, 95, 0 |
| Frame-worklet work per run | 345–475 ms | 4–8 ms | 4–9 (max 35) ms |

The closure payload fell from 241,054 to 292 materialised nodes per mapper start (node bench, `evidence/perf/closure-bench.test.ts.txt`). The pass-3 spot check reproduced 2.36–2.54 s with no Davey (`evidence/pass-3/perf/`).

### 3.3 First release measurement: declarative Lab vs legacy (`evidence/final/PERF-RESULTS.md`, release `6ad5a307`, 120 Hz)

| Metric | Legacy | Lab A (declarative) |
|---|---|---|
| Idle frames / 10 s | 127 / 126 / 121 (≈12.5 fps) | 119 / 118 / 113 (≈11.7 fps) |
| Idle p50 / p99 (ms), janky | 44–46 / 121–133, 100 % | 48–53 / 150, 100 % |
| Idle main-thread CPU | ≈91 % | ≈92 % |
| Pan frames / 10 s | 47–53 (≈5 fps) | 43–51 (≈4.8 fps) |
| Switch settle (s): A→D / D→I / I→A | 2.42–2.49 / 2.42–2.77 / 2.19–2.38 | 2.25–2.53 / 2.40–2.51 / 2.22–2.29 |
| Switch visible fps | 2.9–12.8 | 2.7–8 |
| Entering identity resolved | — | D→I 8.0–9.2 s, I→A 3.4–3.7 s after the tap |
| Focus tap → camera/card (s) | 0.43, 3.7, 6.0, 6.6, 6.7, 6.7 | 3.6, 6.3, 8.8, 8.8, 8.9, >10 |
| RM idle frames / 10 s; CPU | 0; ≈22 % | 85–109; ≈91 % |
| PSS / GL after load (MB) | 806 / 418 | 693 / 315 |
| PSS after 10 switches | 1014 | 1010 (a plateau of ≈1.0–1.09 GB over 39 more switches; no leak evidence) |

### 3.4 Architecture pass: the imperative renderer (`_notes/ARCH-PERF-PASS.md`, `evidence/arch-perf/`)

| Metric | Debug before → after | Release before (`6ad5a307`) → after (`fd7f09c8`) |
|---|---|---|
| Idle frames / 10 s | 48–79 → 223–224 | 113–119 → 199–225 (capped by ambient) |
| Idle p50 / p99 (ms) | 77–150 → 6–7 | 48–53 / 150 → 6–9 / 16–23; janky 100 % → 1–3 % |
| Idle main-thread CPU | 93–94 % → 21 % | ≈92 % → 15–16 % (RenderThread 8–9 %) |
| Pan frames / 10 s | 29 → 110 | 43–51 → 172–188 (≈18 fps), p50 38–40 ms |
| RM idle frames / CPU | 80–92 / 94 % → 0 / 17–26 % | 85–109 / ≈91 % → **0** / 4–15 % |
| Focus tap → first change | no response in 12 s (3/3) → 0.18–0.34 s | 3.6–>10 s → **0.06–0.18 s**, settled ≈0.7 s |
| Switch settle (s) | 2.5–2.8 → 2.2–2.4 | ≈2.2–2.5 → 1.80–2.19 (one late change at 2.30) |
| Entering identity | — | late → resolved at settle |
| PSS / GL after load | — | 693 / 315 → 460 / 110 MB |
| PSS after 10 switches | — | 1010 → 559 MB |

**Section-skip experiment** (debug, temporary flag, now removed). Before the texture cache, skipping the world plane took the idle numbers from 122 frames / p50 29 ms / 58 % CPU to 187 / 6 ms / 23 %. Skipping the sky, bodies or labels changed nothing. That result motivated the base-texture cache.

### 3.5 Camera pass: world-space plane + SurfaceView (`_notes/CAMERA-PERF-PASS.md`, `evidence/camera-perf/`)

Per camera frame, UI-thread probes (debug, ms):

| Stage | Before (`2111be64`) | Milestone 1 (`033e7518`) | Final (`5fb0f0d7`) |
|---|---|---|---|
| Frame worklet (128-point ring polygons) | 4.1 | 4.0 | **0.45** |
| Record world plane (JS) | **32.0** (rings ≈26, grid ≈4.6) | 7.1–8.5 | 4.8–5.6 |
| Rasterise base texture (`surface.flush`) | **9.0** every frame | 1.6, only once static | same |
| Bodies, sky, sun, labels | ≈4.5 | ≈4.5 | ≈4.5 |
| Scene updates/s while panning | 14 | 27 | 27–36 (input-bound) |

Release (SurfaceFlinger presents; `relfinal-cam3.txt`, `sfshort-rel-*.txt`, `relsf-cam2.txt`):

| Metric | Arch release `fd7f09c8` (TextureView) | Milestone 1 `033e7518` (TextureView) | **Final `5fb0f0d7` (SurfaceView)** |
|---|---|---|---|
| Continuous pan, presents/s | 19–21 (median gap 50 ms) | 24–25 | **63** (median gap 16.6 ms; injection-bound) |
| Recenter animation, presents/s | < 25 (not separable) | not separable | **82 / 92 / 84** (median gap 8.3 ms, max 25) |
| Main-thread CPU while panning | — | 56 % | 61 % |
| Idle presents/s | 21 | 21 | 21 |
| Idle main-thread CPU | 17 % | 15–17 % | **32 %** (panel held at 120 Hz) |
| RM idle presents / CPU | 0 / 4–15 % | 0 / 13–15 % | 0 / 12–13 % |
| Switch settle (s) A→D / D→I / I→A | 2.06–2.13 / 1.80–2.30 / 2.13–2.19 | 2.05 / 2.20–2.23 / 2.10 | 1.89–2.50 / 2.20–2.24 / 2.57–2.61 (the later threshold crossing is explained in the note) |
| Switch visible changes, tap→settle | 19–24 | ≈29–37 | **83–120** (screenrecord-limited) |
| Focus tap → first change / settle | 0.06–0.18 / ≈0.7 s | 0.01–0.10 / 0.68–0.73 | **0.005–0.045 / 0.61–0.65 s** |
| PSS / GL / EGL after load (MB) | 460 / 110 / 133 | 429 / 88 / 133 | 449 / 88 / 162 |
| PSS after 10 switches | 559 | 538 | 562 |
| Thermal, 2-min soak | 1 | 1 (34.7 → 34.9 °C) | 1 (35.0 → 35.3 °C) |

Debug, same build with and without SurfaceView: continuous pan 26 → 59–63 presents/s. With a trivial scene the SurfaceView reaches 110–117 fps, so it adds no structural cap.

## 4. Memory and thermal summary

| Build | PSS after load | PSS after 10 switches | Notes |
|---|---|---|---|
| Release `6ad5a307`, legacy | 806 MB | 1014 MB | Plateau of ≈1.0–1.09 GB; mostly GL mtrack |
| Release `6ad5a307`, Lab declarative | 693 MB | 1010 MB | same plateau |
| Release `fd7f09c8` (imperative) | 460 MB | 559 MB | about −450 MB at 10 switches |
| Release `5fb0f0d7` (final) | 449 MB | 562 MB | +29 MB EGL (SurfaceView buffer queue); base texture ≈18 MB when baked |

Thermal stayed at status 1 in every soak. The worst rise was CPU 63 → 65 °C in the declarative 2-minute soak. The phone was already warm from testing, so this says nothing about sustained throttling.

## 5. Bottlenecks found and their root causes

| # | Bottleneck | Root cause (evidence) | Fix | Scope |
|---|---|---|---|---|
| 1 | Plane idle cost (pass 1/2) | Strokes and dashes under a perspective CTM fall to CPU path masks; `drawOval` draws bounding quads; round joins and non-convex paths use the software renderer (bisection, pass 2) | Convex polygons + `RING_SKSL` (pass 2), then world-space strips + analytic shaders (camera pass) | Lab |
| 2 | 3–5 s switch freeze, focus Daveys | Frame worklet captured `switchRuntime`/`scene` → about 241k nodes re-materialised per mapper restart (worklets 0.10.4 builds a fresh object per reference), and the runtime returned a new object on every render; per-point `usableCameraRect` (about 5,248 per frame, ≈390 ms); RN-Skia re-recorded on every Canvas `children` change, with blocking sync reads (13.6 s of JS in one switch) | `ba3cef6`, `842f1f3` | **main has it too** |
| 3 | ≈12 fps idle, ≈92 % main thread (release, both renderers) | Declarative RN-Skia redraw: per-redraw `applyUpdates` of every animated prop (25 %, of which 15 % is converting uniform maps), whole-list `Recorder::play` (13.5 %), and about 120 **full-canvas `saveLayer`s** from `layer` props driving Mali framebuffer churn (58 %); clock-captured derived values returning new objects every tick (`evidence/arch-perf/simpleperf/`) | Imperative five-picture renderer, bounded layers only, primitive ambient (`fd7f09c`) | **main's legacy has the same layers** (owner decision H1/H2) |
| 4 | RM redraws ≈10/s at ≈91 % CPU (Lab declarative) | Derived values captured the clock even when they did not read it, and returned fresh objects | Ambient = −1 under RM; primitive values | Lab (legacy was already idle) |
| 5 | Pan ≈18 fps after the arch pass | ≈32 ms of JS recording 128-point polygons over JSI per camera frame, plus ≈9 ms of Ganesh tessellation and an 18 MB offscreen pass each frame | World-space plane, bake only when static, Lab frames without ring polygons (`033e751`, `5fb0f0d`) | Lab |
| 6 | Pan ≈25 presents/s with cheap frames | TextureView: each present is re-composited by HWUI, a 2–3 vsync round trip | `opaque` Canvas → SurfaceView (`dc7f866`) | Lab |

## 6. Residual risks (ranked)

1. **Idle main-thread CPU 32 % (was ≈17 %).**
   - **Cause:** the SurfaceView keeps the panel at 120 Hz, so the always-on `useClock` frame callback and Reanimated's loop run at 120 Hz even though ambient content changes at 30 Hz. RM idle is unaffected (12–13 %).
   - **V2 options:** stop the clock between ambient ticks and under RM, or vote a 30 Hz frame rate on the surface. The second needs an RN-Skia patch.
2. **The camera animation reaches ≈85 fps, not a locked 120.** The main thread spends ≈8–10 ms per camera frame in release: per-ring uniforms (36 floats) plus a save/concat/draw/restore, and about 10 JSI calls plus 35 floats per body. V2: one draw for all rings, and body uniforms that skip unchanged work.
3. **Real-finger pan and pinch were never measured.** The scripted pan is input-bound at 63/s. Pinch and tilt cannot be automated.
4. **GPU time is unmeasured** since the SurfaceView change (HWUI GPU columns no longer apply, and Perfetto has not been analysed). The ring bands are conservative (sized for the most-compressed point); the early-out keeps the waste cheap, but this is unquantified.
5. **SurfaceView trade-offs.** No view-level alpha or transform animation of the canvas; +29 MB EGL; screen transitions were not inspected frame by frame.
6. **Photo custody** relies on the FIFO UI queue plus a 1.5 s unmount grace, with a `try/catch` as the last guard. It was not exercised with photo edits.
7. **Scope.** One device (strong GPU; the main thread is the limit), one data set. Debug numbers are relative only. The `RN-Skia LegacySurfaceTexture … not attached` logcat spam comes from the library and predates the lab (about 255 lines per 5 s with legacy).
8. **The legacy renderer is still slow** (A/B kept for comparison). Main was not measured in release, and its numbers are inferred from the lab-build legacy (§1).
