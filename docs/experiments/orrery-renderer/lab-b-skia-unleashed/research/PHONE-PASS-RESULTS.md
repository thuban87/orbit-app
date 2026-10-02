# Lab B — Pixel 6 Pro phone pass: results

2026-10-01, 20:30–23:05 CDT. Branch `experiment/orrery-skia-unleashed`, code at `23bedb9c`
(the last `src/` commit; the build was made from HEAD `35390263`). Script:
`research/PHONE-PASS-SCRIPT.md`. Evidence: `evidence/12-phone/`. Tooling commit `25f82cdf`.

**These are the first absolute numbers in this lab.** Every earlier figure was relative to the
desktop emulator. **The phone overturns the lab's main performance verdict:** the tilted Home
plane makes the orbit rings a GPU cliff on Mali.

## 0. Conditions (read before the numbers)

| Item | Value |
|---|---|
| Device | Pixel 6 Pro (`raven`), Android 17, Mali-G78 (GLES 3.2 r54p2), **120 Hz** display (8.33 ms budget), 1440×3120 |
| Build | **release**, arm64-v8a, Hermes, `com.bwales.orbit.labb`, from HEAD `35390263`. Seeded on the debug APK, then the release APK was installed over it with `install -r` (same signer, data kept) |
| Data | Lab B seed: 140 contacts, Dense 120, Inner Circle 12, Stress 400 and 800 (940 contacts in all), satellites ON, Galaxy Dark |
| Canvas | **Opaque canvas ON** (the R1 default, SurfaceView). gfxinfo cannot see it, so the main metric is **canvas presents counted from SurfaceFlinger** (`tools/sf-sampler.py`; it polls `--latency` every 0.5 s and takes the union of the timestamps) |
| Clock | Harness rows use `idleClock:0` (clock always running), the same as R1–R3 |
| Thermal | `Thermal Status` 1 (LIGHT) at the start; **2 (MODERATE)** from ~20 min into the matrix (from the 400 tier on). The 5-min soak was at 1 |
| Battery | 30 % at the start, **7 % at the end**, although USB-powered the whole time (a 500 mA port). Under the Orrery the battery current was net negative (§5). The final 800-tier reruns ran at 7–9 %. No battery saver was on |
| Memory | The phone was under pressure: 2.4 GB of 3 GB swap used and ~1 GB free (the other labs' apps were resident) |
| Not measured | Real multi-touch (pinch, twist, two-finger tilt): adb injects one pointer. A physical look at the OLED panel: every visual verdict here is from the framebuffer (screencap) |

Sample sizes: one run per matrix cell. Windows: idle 10 s, pan ≈ 10 s (6 swipes), focus 7 s,
switch 9 s. Perfetto: 12 s per trace. Treat any single cell as ±30 %. The orders of magnitude
are robust: they repeat across the matrix, the isolation runs, Perfetto and the soak.

## 1. Headline

| Dense 120, idle | Presented fps (canvas) |
|---|---|
| **Lab B best** (R3 default; Home tilted) | **3–9** (matrix 3.2, isolation runs 4.6–8.8, soak 4.8–5.2) |
| Ship-safe | 15–26 |
| Everything | 17–25 |
| **Lab B best − Home tilt** (`homeTilt:0`) | **92–99** |
| Lab best with every lab effect off (`labmin`, at 800) | ~120 (switch windows 90–120) |
| Legacy (= today's production renderer) | **~5** (TextureView, window layer) |

- **Cause, isolated** (`isolation-dense-sf.txt`, Dense 120, best):
  - rings layer off → **120 fps**;
  - ring wake off → 18 fps;
  - wake + ring stroke shader off → 36 fps;
  - Home tilt off → 92–105 fps;
  - sky, bodies, stage plane, grid, flow, focus dim, tilt-shift, lens flare or moon shader off/on → no change (4–8 fps).

  So the cost is **the orbit geometry drawn under the perspective plane homography**: the
  stroked world circles of the rings, and above all the full-circle `ringWake` strokes.
- **Perfetto, best Dense idle:**
  - 66 canvas frames in 12 s;
  - the main thread sleeps in `eglSwapBuffers → queueBuffer` for **147 ms per frame on
    average** (max 170 ms). That is GPU back-pressure, not CPU: main is Running only 16 % of
    the window;
  - GPU utilisation is **99.7 %**, at 471–750 MHz.

  The GPU is the bottleneck. Because RN Skia draws on the Android **main** thread, the main
  thread (which also carries Reanimated gestures and the UI) is blocked for most of every
  frame.
- **The emulator could not show this.** Its desktop GPU drew the same scene at 24 ms p50. The
  R1/R3 verdict that "120 orbits cost the same as zero" (H-B3) holds **only on an untilted
  plane, or on a desktop GPU**.

## 2. Envelope (release, arm64, Galaxy Dark, satellites on, opaque canvas)

Presented fps = canvas presents ÷ window. Interval percentiles in the raw table
(`tools/phone-table.py evidence/12-phone/perf/summary.tsv`).

### 2.1 Matrix (first pass, 20:57–21:55; thermal 1 → 2)

| Bodies | Config | idle | pan | focus | switch out | switch in |
|---|---|---|---|---|---|---|
| 12 | Lab B best | 67 | 71 | 34 | 23 | 4.7* |
| 12 | Ship-safe | 60 | 72 | 37 | 40 | 48 |
| 12 | Everything | 41 | 41 | 32 | 29 | 30 |
| 12 | Legacy | 28 | 27 | 30 | 14 | 4.1 |
| 120 | Lab B best | **3.2** | 8.4 | 12.6 | 11.7 | 19.6 |
| 120 | Ship-safe | 26 | 20 | 32 | 52 | 29 |
| 120 | Everything | 23 | 24 | 25 | 39 | 25 |
| 120 | best + bloom | 4.9 | 8.6 | 6.3 | 5.1 | 39 |
| 120 | best − stage plane | 5.9 | 12.2 | 12.0 | 12.2 | 30 |
| 120 | **best − Home tilt** | **99** | **81** | **74** | **60** | **58** |
| 120 | Legacy | 5.0 | 3.5 | 2.9 | 4.1 | 4.3 |
| 400 | Lab B best | 18 | 19 | 27 | 36 | 24 |
| 400 | Ship-safe | 18 | 20 | 30 | 40 | 35 |
| 400 | Everything | 31 | 34 | 39 | 37 | 40 |
| 400 | best + bloom | 25 | 23 | 28 | 25 | 18 |
| 400 | best − stage plane | 19 | 20 | 36 | 32 | 24 |
| 400 | **best − Home tilt** | **95** | **93** | **85** | **62** | **64** |
| 400 | Legacy | **ANR** (gfx: 5 frames / 10 s, p50 2.6 s) | ANR | — | — | — |

\* The `switch_in` window of the 12 row is the switch *into* Inner Circle *from* Dense, so it
carries the Dense cliff.

### 2.2 The 800 tier

The first pass at 800 is **unreliable**. An ANR happened at 21:37 during the legacy-800 →
next-config changeover (§6). On top of that, the sampler sometimes read a dead canvas layer
from an earlier mount; that is fixed in `sf-sampler.py`, which now takes the highest layer id.
Zero-frame windows are therefore "not captured", not "0 fps". It was re-run for the key
configs at 22:49–22:58 (thermal 2, battery 9 → 7 %; `perf-800-rerun/`):

| 800 | idle | pan | focus | switch out | switch in |
|---|---|---|---|---|---|
| Lab B best | 36 | 38 | n/c | 38 | 31 |
| Ship-safe | 19 | n/c | n/c | 26 | 50 |
| best − Home tilt | 58 | 52 | n/c | n/c | n/c |
| lab minimal (all lab effects off) | (static) | n/c | n/c | 90 | 120 |

n/c = not captured. At 800, the canvas often had **not remounted yet** when a 12-s harness
window opened after a deep link (a VIEW intent remounts the Orrery). One probe window
reported a **101-s gap** in UI-thread worklets, and the canvas came back > 30 s after the
link. That was under thermal 2, swap pressure and a 7 % battery, so it is a lead and not a
measured latency. First-pass rows that were captured: Everything idle 15, switch in 45;
best + bloom idle 47 / pan 48 / focus 52.

**Why best is faster at 400 and 800 than at 120.** The wakes are LOD'd away above 160 rings
(C-60), and at Stress density most of the 400–800 rings fall outside the viewport and are
culled (R1). The wakes are the single largest item at ≤ 160 rings.

### 2.3 Per-worklet UI-thread cost (probe, ms mean / p95; release, thermal 2)

From `perf-800-rerun/summary.tsv` (`tools/phone-table.py … --probe`), 800 bodies, Lab B best:

| Scene | frame | alloc | bodies | labels | rings | wakes | trim | nebula |
|---|---|---|---|---|---|---|---|---|
| idle | 9.0 / 11.9 | 2.5 / 4.7 | 9.5 / 9.5 | 0.2 / 0.2 | 7.1 / 7.1 | (LOD off) | 0.1 | 0.1 |
| pan | 9.1 / 17.2 | 2.0 / 4.9 | 6.9 / 13.5 | 1.0 / 2.3 | 7.3 / 18.4 | (LOD off) | 0.5 / 1.8 | 0.1 |
| switch out | 10.3 / 17.6 | 1.1 / 1.7 | 5.6 / 9.9 | 0.5 / 1.8 | 3.4 / 6.0 | 1.8 | 0.5 / 1.3 | 0.1 |

The frame projection is **≈ 11–13 µs per body** on the phone's UI thread under thermal 2
(R1 emulator: 3.4 ms at 800, about 4 µs per body). So the UI-thread JS is about 2.5–3× the
emulator's. It is still small next to the GPU cliff, but at 800 the worklets alone are about
30 ms per changed frame. **Typed-array projection (PERFORMANCE §6 item 5) is now justified
for 400+.** At Dense 120, the probes on the phone are 2–9 ms in total per changed frame.

## 3. Perfetto (Stress 400 switch + Dense idles; 12 s each, `perfetto/*.pftrace.gz`)

Threads: `main` = Android UI thread (RN Skia draws here, Reanimated runs here), `mqt_v_js` =
JS, `RenderThread` = HWUI. Queries: `perfetto/perfetto-queries.sql` (run with
trace_processor on droid; this box's CPU lacks AVX2, so the prebuilt crashes here).

| Trace | Canvas frames / 12 s | main Running | Skia draw (`animation`) avg / max | `eglSwapBuffers` avg / max | GPU util | JS |
|---|---|---|---|---|---|---|
| best, Dense idle | **66** | 16 % | 175 / 186 ms (mostly blocked in swap) | **147 / 170 ms** | **99.7 %** | ~0 |
| Everything, Dense idle | 244 | 54 % | **48 / 83 ms (CPU)** | 0.9 / 2.2 ms | 97.7 % | ~0 |
| best + `fxShockFilter`, Dense idle | 528 | 62 % | 22.5 / 80 ms (CPU) | 8 / 14 ms | 98.4 % | ~0 |
| **best − Home tilt**, Dense idle | **1 053** | **87 %** | 11.2 / 66.5 ms | 1.0 / 3.2 ms | 80.6 % | ~0 |
| best, Dense → Stress 400 switch | 48 | 23 % | 15.8 / 187 ms | 130 / 182 ms | 99.5 % | **57 % busy** (scene build) |

- **Longest main slice:** 187 ms (best idle and the switch).
- **RenderThread:** idle in all traces (the RN overlays are static), max 17.6 ms during the
  switch.
- **FrameTimeline jank split:** not available. RN Skia's own EGL surface emits no
  FrameTimeline tokens, so the opaque canvas has no FrameTimeline rows.
- **Odd and unexplained, recorded as a lead.** With the world wrapped in the `fxShockFilter`
  saveLayer (a runtime image filter, which "Everything" turns on), the tilted rings stop being
  GPU-bound. The cost moves to about 20–50 ms of CPU per frame on main, so the result is
  faster (best 5 → 44 fps). A **plain** saveLayer around the same layers did **not**
  reproduce it (an A/B build with a `worldLayer` flag: 4.6 vs 4.7 fps; reverted, DEAD-ENDS).
  This fits Ganesh choosing a different path renderer or op for perspective strokes when it
  draws into a filter's source texture rather than the window FBO (RN Skia's window EGL
  config has no stencil and no MSAA). That is not proven. A Skia-level trace (AGI or
  Ganesh op names) is the next step.
- Without tilt the GPU has headroom (80 %). The main thread does not: 11 ms per frame
  against an 8.3 ms budget at 120 Hz, so "best − tilt" runs at 88–99 fps, not 120.

## 4. Correctness on Mali

- **Every RuntimeEffect compiled on Mali-G78.** The FX panel statuses after "Everything"
  (`shots/06-panel-effect-statuses-everything.jpg`): probe, nebulaBake, nebulaSample,
  nebulaLive, bodyPhoto, bodyProcedural, sunStar, moon, ringInstrument, ringWake,
  switchShock, stagePlane, lensFlare and shockFilter are all `ok`. `sunPhoto` is `pending`,
  because no photo sun is in this data. On the debug build, "Everything" plus a switch logged
  0 `using fallback` warnings.
- **No visible shader artefacts** in the full-resolution captures: no mediump banding in the
  nebula, the sun limb or the stage pool, no black or NaN pixels, and the dashes and depth
  fade are intact (`shots/sheet-presets.jpg`). Not exhaustively examined: this is a visual
  check of 8 frames + 2 crops, not a pixel-statistics test.
- **Opaque canvas composites correctly:** the immersive header scrim, the HUD rail, the focus
  card, the FX panel and the tab bar all sit over the SurfaceView, and screencap captures it.
  In one GPU-bound sample (best Dense) the SurfaceView presented **5.9 fps** against **1.5
  fps** for the TextureView path (app window layer). Keep the opaque default (H-B9).
- **Reduced motion (preset best, `rm=on`, Dense):** **0 canvas presents in 10 s** and **0
  changed pixels** between two captures 3 s apart (`shots/04-rm-static-*.png`).
- **Lifecycle** (`shots/05-lifecycle.txt`, preset best, Inner Circle):
  - Orrery: 351 presents / 7 s, 2 probe lines;
  - **Digest tab: no canvas layer, 0 presents, 0 probe lines**;
  - back on Orrery: 347;
  - **HOME (background): 0 / 0**;
  - relaunch: 341.
- **Hermes `Intl.Segmenter` gap reproduces on the phone.** The legacy renderer draws "El…" and
  "C…" where the lab draws "EN" and "CO" (`shots/02-dense-legacy.jpg` vs `02-dense-best.jpg`).
  Same Hermes in the APK as on the emulator. H-A5 stands.
- **Faces (FACES / C-30).**
  - Ada Abbott (dark skin, rogue, on the sun's shadow side) is recognisable at overview size
    in the framebuffer (`shots/02-dense-best-ada-overview-crop-2x.jpg`) and fully lit when
    focused (`shots/03-focus-ada-abbott-best-crop.jpg`).
  - The physical OLED glance is still the owner's: a screencap is not the panel.
- **No native crash in ~2.5 h** of release use, including dozens of Stress 800 mounts and
  switches (the crash buffer was empty). The R1 paragraph-cache fix (H-A2) holds on ARM.
- **"Unavailable System" after a cold start** (FINAL-VALIDATION §3, pre-existing on `main`)
  reproduces on the phone.

## 5. Thermal, power, memory

5-minute sustained run, preset best, Dense 120, screen on, USB 500 mA (`soak/`):

| Metric | t0 | t+5 min |
|---|---|---|
| Thermal status | 1 (LIGHT) | 1 (LIGHT) |
| VIRTUAL-SKIN | 40.9 °C | 42.3 °C (the throttling thresholds are 39 / 43 / 45 °C) |
| G3D | 66 °C | 70 °C |
| GPU clock (sampled) | 251 MHz | 400 MHz (the matrix saw up to 750 MHz) |
| Presented fps | 2.6 (minute 1) | 4.8–5.2 (minutes 2–5) |
| Battery current (net, with 0.5 A USB) | −0.03 A | −0.19 … **−0.63 A** |
| batterystats estimate, app | — | **36 mAh in 5 min, 35 of them GPU** (≈ 430 mA average; this is a power-model estimate, not a measurement) |
| PSS total / Graphics / Native heap | — | **1.44 GB / 421 MB / 530 MB** (GL mtrack 254 MB, EGL mtrack 167 MB) |

- The longer matrix pushed the phone to thermal status **2** after about 20 minutes. Even at
  5 fps, Lab B best keeps the GPU pinned, which heats the phone and drains the battery while
  delivering nothing.
- The 10-minute soak in the script and the Everything soak were cut to 5 minutes and skipped,
  for battery reasons.
- Memory: PSS 1.44 GB against about 1.1 GB on the emulator. This process had been through
  Stress 800 several times, so it is not a clean Dense-only figure.

## 6. Bugs found on the phone

| # | What | Scope | Status |
|---|---|---|---|
| P-1 | **Tilted-plane ring geometry is a Mali GPU cliff** (§1). It costs 100–350 ms GPU per frame at Dense and blocks the UI thread in `eglSwapBuffers` | Lab renderer (R2 Home tilt × WP-1.3 rings and wakes) | **Fixed 2026-10-02** (§10): the orbit layer draws as one full-screen analytic ring field while tilted. Dense 120 tilted runs at 58–68 fps (was 3–9) |
| P-2 | **Legacy (production) renderer ANRs at 400+ bodies**: "Input dispatching timed out … Waited 5005ms for MotionEvent" during a pan at Stress 400. Main thread in deep native recursion inside Hermes (`anr-labb-summary.txt`). A second ANR came at 21:37 during the legacy-800 → lab changeover. At 120 it presents 3–5 fps | **Production** renderer (shared path; same class as the emulator's "unusable from ~120") | Not fixed here (production code, owner/PORT) |
| P-3 | The **Stress 800 remount** after a deep link took > 30 s once, with a 101-s gap in the UI-thread probe (under thermal 2, swap, 7 % battery) | Lab harness path (VIEW intent → remount); the real app does not remount like this | Lead only |
| P-4 | Harness: `sf-sampler` could read a dead canvas layer, and Choreographer "Skipped" lines from other processes polluted `skipped_max` | Tooling | **Fixed** (`25f82cdf` + the layer-id sort) |

## 7. Classification with phone numbers

**Fundamentally unsuitable as built, on this phone:**

- **Orbit rings and wakes drawn as stroked world circles under the perspective homography**
  (H-B3 applied to the tilted Home of H-C17): Dense 120 at **3–9 fps**, GPU 99.7 %, main
  blocked about 150 ms per frame.
  - `ringWake` is the worst single item: 5 → 18 fps when off.
  - The idea (exact world-space orbits on a tilted plane) is sound. This draw strategy is
    not.
- **Lab B best as a preset**: 3–9 fps at Dense 120 and 18 fps at 400.
- **Legacy (today's renderer) at ≥ 120 bodies**: 3–5 fps at 120 and an ANR at 400. Not a lab
  regression; it is pre-existing and CPU-bound (the per-ring Path rebuild).
- **Everything**: 17–25 fps at Dense, with 48 ms of CPU per frame on main. The blur also
  fails on taste (R2).

**Expensive but salvageable:**

- **Home tilt (TILT)**: worth keeping only with a new ring draw. **Without** tilt, every other
  effect of Lab B best runs Dense 120 at **92–99 fps** and Stress 400 at **93–95 fps** (idle
  and pan), with switches at 58–64 fps. GPU is 80 %; main is at 11 ms per frame, which is
  over the 8.3 ms budget at 120 Hz but well inside 60 fps.
- **Ship-safe**: 20–32 fps at Dense 120 with tilt, because it has no wakes. It is the cheapest
  tilted configuration, but still far from 60.
- **Sky / nebula / stars**: turning the environment off on Ship-safe moved Dense 15 → 24 fps.
  That is a real but secondary cost. Keep the bake; consider a lower-resolution sample.
- **Lit bodies, stage plane (pool + grid), bloom, lens flare, tilt-shift, moon shader**:
  **not separable on the phone** while the ring cliff dominates (best − stage ≈ best;
  best + bloom ≈ best at 120). They need a re-measure after the ring fix. Bloom, flare and
  tilt-shift keep their "drop / optional" verdicts; nothing here shows them as cheap.
- **Switch showcase (SWITCH)**: without tilt, 58–64 fps through the switch at 120 and 400.
  With tilt it inherits the cliff.
- **UI-thread worklets at 400–800**: about 11–13 µs per body for the projection, about 30 ms
  per changed frame at 800. Salvageable with typed arrays.

## 8. What V2 needs because of this pass

1. **Never stroke world circles under a perspective matrix on Android.** A circle under the
   plane homography is an exact ellipse (a bounded conic). Draw each ring as an
   **affine-mapped oval**: Ganesh's analytic ellipse op, with the dash and depth fade computed
   in the shader from `sk_FragCoord` through the inverse homography. Alternatively, draw all
   rings in **one full-screen ring shader**, as the stage plane already does (it inverts the
   homography per pixel and was not separable from noise here). Either way, measure on the
   Pixel first.
2. **Keep wakes off** (WAKE "not now" stands), or redo them in the same analytic form.
3. Re-run this matrix after (1). The bloom, stage, nebula and body-lighting costs can only be
   read once the cliff is gone.
4. Budget for **120 Hz**: the untilted best is about 11 ms per frame on main at Dense, so
   either accept ~90 fps or cap the Orrery at 60 Hz with `Surface.setFrameRate` /
   `preferredFrameRate`, which also halves the power draw.
5. Treat **thermal and power** as first-class: a GPU-bound Orrery pins the GPU at 99 % and
   drains the battery against USB power. The idle clock (0 presents at rest under reduced
   motion) is the most valuable power feature the lab has.

## 9. Evidence index (`evidence/12-phone/`)

| Path | What |
|---|---|
| `perf/` | First-pass matrix: `summary.tsv` + per-window `.gfx` / `.log` / `.sf` |
| `perf-800-rerun/`, `perf-800-rerun2/` | 800-tier reruns |
| `perf-run.log` | Matrix timeline with thermal status per cell |
| `isolation-dense-sf.txt` | Flag isolation at Dense 120 (SurfaceFlinger presents) |
| `perfetto/*.pftrace.gz` | Five 12-s traces |
| `perfetto/perfetto-summary.txt` | Trace summary |
| `perfetto/perfetto-queries.sql` | The queries |
| `perfetto/*-check.jpg` | What was on screen |
| `soak/` | 5-min soak: `timeline.txt`, thermal t0/t5, `batterystats-5min.txt`, `meminfo-dense-after-5min.txt`, start/end JPEGs |
| `shots/` | Preset overview shots (Inner + Dense × best / ship-safe / everything / legacy) and `sheet-presets.jpg`; Ada crops; RM static PNG pair + presents; lifecycle; panel effect statuses |
| `shots/switch-best-inner-to-dense.mp4` + `-frames.jpg` | Best-preset switch recording (screenrecord adds GPU load; the recording runs ~35 fps on Inner Circle) |
| `shots/legacy-dense-idle-2fps.mp4` | The legacy renderer idling on Dense at ~2.3 fps |
| `anr-labb-summary.txt` | The two ANR records + the main-thread stack head |

## 10. Tilt fix (2026-10-02, P-1 fixed)

**Commits:**
- `b22b6ae4`: per-ring screen-space ellipses (now the fallback).
- `19dae74b`: ring field.
- `7350b643`: field stroke width uses the pre-fix foreshortening.
- `9aa7e725`: hybrid (the untilted plane keeps the pre-fix draw).

**Docs:** `71a3d43f` and this section's commit.

**Evidence:** `evidence/14-tilt-fix/`:
- `matrix/`: the final before/after matrix;
- `switch/`, `perfetto/`, `phone/`: shots and the switch clip;
- `probe/`: the exploration runs;
- `emu/`: emulator look A/B;
- `matrix-v6`, `matrix-v7-adaptive-hz`: superseded runs, kept for the refresh-rate finding below.

**Conditions:**
- release arm64, preset best, `idleClock:0`, opaque canvas;
- SurfaceFlinger presents per window (`tools/tf-matrix.sh`);
- thermal 1, battery 74 → 68 % after a wall charge;
- **`min_refresh_rate` pinned to 120** for the final matrix (restored to `null` afterwards).

Before = the same APK with `ringPlaneDraw:0`, which is the pre-fix draw. Max tilt is the pose
deep link `tilt=1.0472` (60°), re-applied after every recentre.

### 10.1 Before / after (presented fps, idle / pan)

| System | Camera | Before (pre-fix) | **After** |
|---|---|---|---|
| Dense 120 | Home tilt 32° (Lab B best) | 3.4 pan (idle not captured: 47 frames) | **67.7 / 58.4** |
| Dense 120 | Max manual tilt 60° | **2.4 / 2.6** | **66.4 / 57.9** |
| Dense 120 | Tilt 0 | 77.8 / 65.2 | 67.8 / 58.2 (noise, see 10.3) |
| Stress 400 | Home tilt | **12.6 / 10.8** | **66.8 / 60.5** |
| Stress 400 | Max manual tilt | – / 15.6 | – / **65.7** (idle window not captured) |
| Stress 400 | Tilt 0 | 104.8 / 75.9 | 74.1 / 68.3 (noise, see 10.3) |
| Big switch, Stress 400 ↔ Dense, Home tilt (`switch/`) | out / in | not captured / **6.9** | **58.1 / 63.1** |

**Target met:** tilted is roughly equal to untilted, and at least 55–60 fps on Dense 120 and
Stress 400 for idle, pan and switch.

### 10.2 Perfetto, Lab B best, Dense idle (`perfetto/field-best-dense-idle.*`, 10 s)

| | Pre-fix (§3) | After (ring field) |
|---|---|---|
| Canvas frames | 66 / 12 s | **672 / 10 s** |
| `eglSwapBuffers` avg / max | 147 / 170 ms | **3.4 / 6.1 ms** |
| `animation` (main draw) avg | 175 ms | 14.6 ms |
| main Running | 16 % | 79 % (CPU-bound now, not GPU-blocked) |
| GPU util | 99.7 % | 98.6 % |

The main thread no longer sleeps in `eglSwapBuffers`. The remaining frame cost is CPU on
main (worklets plus Skia recording and replay), the same budget as the untilted lab.

### 10.3 Why "untilted" read 66 fps instead of last night's 92–99

**This is not a code regression.** It comes from the phone's adaptive refresh rate and its
power state:

- **The display switches between 60 and 120 Hz.** Rows with SurfaceFlinger interval p50 =
  16.6 ms were presented at 60 Hz. Rows at p50 8.3 ms ran at 120 Hz. Without the pin, the
  same configuration flipped between them run to run:
  - the field at Home tilt went 105 → 64.5 fps between two builds (`matrix-v6` vs
    `matrix-v7-adaptive-hz`);
  - a back-to-back isolation pair at Stress 400 untilted gave after 86.9 vs before 74.2
    (`iso/`), the opposite way round from the matrix.

  Even with `min_refresh_rate` = 120, cadence flips stay in the data (±30 % run to run).
- **The 66-fps measurement from the first tilt-fix session (`probe/`)** was taken at thermal 2
  and 20 % battery. In that session the pre-fix untilted draw itself fell from 97.6 to 67.2.
- **By construction:** since `9aa7e725` the untilted plane draws exactly the pre-fix
  pictures (circle op under the affine homography; the field draws nothing). The untilted
  path is therefore the pre-fix code.

The earlier non-hybrid field (v4–v6) was slower untilted (64.5 vs 97.8 fps in one same-session
pair). That is why the hybrid exists.

### 10.4 Correctness

- **Phone shots** (`phone/sheet-after-vs-before.jpg`, `freezeClock:1`): Home tilt, max tilt
  and focus on Ada match the pre-fix draw. At max tilt the near-side rings read stronger;
  the pre-fix Ganesh perspective stroke rendered them dimmer (C-74).
- **Reduced motion on the phone:** 0 changed pixels in 3 s (`phone/rm-static-a/b.png`).
- **Switch clip** (`phone/switch-best-inner-to-dense-tilted.mp4`, `switch-frames.jpg`): a
  deep-link remount into Dense on the tilted plane, not the choreographed switch. Rings,
  dashes and colours are correct. The choreographed switch was measured by the harness
  (10.1) and checked visually on the emulator (`emu/switch-field-vs-prefix.jpg`).
- **Emulator A/B** (`emu/`):
  - **Dashes, wakes, tethers, depth fade and focus glow/lock** match.
  - **Flow comets** match after the comet-mean fix.
  - **Dashes** are cleaner (one tick).
- **Tests:**
  - ellipse parameters vs `projectWorldPoint`: < 1e-3 px over 1 500 cases;
  - the ring-field encoding and LUT;
  - the tree contract (field rect, homography uniforms, hybrid).

### 10.5 Default Home tilt (decision rule)

Tilted holds untilted-level performance on Dense 120 and Stress 400:

| | Home tilt (idle / pan) | Tilt 0 (idle / pan) |
|---|---|---|
| Dense 120 | 67.7 / 58.4 | 67.8 / 58.2 |
| Stress 400 | 66.8 / 60.5 | 74.1 / 68.3 |

**`homeTilt` stays ON** (DECISIONS-LOG).
