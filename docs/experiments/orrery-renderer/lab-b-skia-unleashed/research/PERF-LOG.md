# Lab B — performance log

**Every number here is from the desktop EMULATOR** (`emulator-5554`, sdk_gphone16k_x86_64,
API 37, GLES translator over an Intel Arc B580, 4 vCPU) running a **DEBUG** build with Metro.
**The emulator is not a phone.** Numbers are only valid as *relative* A/B on the same target in
the same session. No absolute performance claim may be made from them; R1 repeats this on a
release build on the physical test phones.

Instruments (both labelled):
- **HUD** = the lab FPS overlay: UI-thread *clock cadence* (deltas between `useClock` ticks,
  last 120 frames). Cannot see GPU/RenderThread.
- **gfx** = `adb shell dumpsys gfxinfo com.bwales.orbit.labb` after `reset`, over 15 s idle
  (no touch). Sees the Android main thread + RenderThread (Skia's TextureView draws on the
  main/UI thread here), not JS.

## 2026-10-01 — WP-1.1 L0 environment (commits 54188b10 → 79cc89eb)

Scene: **Lab B Dense** (≈120 contacts + moons), Home pose after load (zoom ≈ the restored
pose; overview level), **Galaxy Dark**, renderer `lab`, panel CLOSED during measurement
(see observation 3), intensity 1.00, all other flags default unless listed.

### Run 1 — full scene (rings ON), far stars as an Atlas (commit 54188b10)

| Config | HUD fps | HUD p50 / p95 ms | gfx p50 / p90 ms |
|---|---|---|---|
| all default (baked nebula + 3 Atlas layers) | 9.1 | 116.7 / 116.7 | 200 / 200 |
| `nebulaLive` ON (full-res fbm) | 9.6 | 100 / 116.7 | 200 / 250 |

Three further run-1 toggles (nebula OFF, stars OFF, twinkle OFF: 8.2–9.3 fps) were
discarded — the panel's scroll position drifts between openings and some taps hit the wrong
chip. From run 2 on, every flag state was verified from a screenshot of the panel before
closing it.

Finding: with rings on, the debug-emulator UI thread is saturated (~8–10 fps) by the rest of
the scene — **L1 rings (128-segment Path rebuilt per ring per frame) dominate**: turning rings
OFF alone moves the HUD from ~9 to 30–50 fps. That is WP-1.3's problem, not L0's. To make L0
measurable, the remaining runs use **rings OFF**.

### Run 2 — rings OFF (commit 54188b10: far layer = 760-sprite Atlas)

| Config | HUD fps | HUD p50 / p95 ms | gfx p50 / p90 ms | gfx "janky (legacy)" |
|---|---|---|---|---|
| A: `nebulaLive` ON, stars ON | 34.0 | 33.3 / 33.3 | 32 / 34 | 100 % |
| B: baked nebula, stars ON | 34.0 | 33.3 / 33.3 | 32 / 34 | 35 % |
| D: baked nebula, **stars OFF** | 30.0 | 33.3 / 33.3 | **17** / 34 | 0.7 % |
| E: baked nebula, stars ON, twinkle OFF | 32.1 | 33.3 / 33.3 | 34 / 34 | 54 % |
| C: environment OFF | 37.9 | 33.3 / 33.3 | 18 / 34 | 1 % |

Finding: the **starfield Atlas** (1 170 sprites in two Atlases) roughly doubled gfx p50
(32 vs 17 ms). Twinkle OFF did not help → the cost is the per-replay `drawAtlas` with large
transform/colour arrays, not the twinkle math. Live vs baked nebula was indistinguishable at
this point because the Atlas cost masked it.

### Run 3 — rings OFF (commit 79cc89eb: far layer analytic in the nebula shader; Atlas = 410 mid/near sprites)

| Config | HUD fps | HUD p50 / p95 ms | gfx p50 / p90 ms | gfx "janky (legacy)" |
|---|---|---|---|---|
| F: default (baked nebula + shader far stars + mid/near Atlas) | **51.8** | 16.7 / 33.3 | **18** / 34 | 7.7 % |
| G: environment OFF | 49.3 | 16.7 / 33.3 | 17 / 34 | 1.2 % |
| H: `nebulaLive` ON | 47.1 | 16.7 / 33.3 | **32** / 34 | 100 % |

Findings (relative, emulator only):
1. Moving the far layer into the nebula pass made the whole L0 environment ≈ free relative to
   "environment OFF" on this target (F ≈ G within noise; gfx p50 18 vs 17 ms).
2. **Live full-res fbm is the expensive variant**: gfx p50 32 vs 18 ms and every frame over
   the legacy jank threshold, even on a desktop GPU. The bake is kept as the default; live stays
   an A/B flag only (DEAD-ENDS).
3. Observation (not yet explained): while the **Lab FX panel is open**, the HUD reports ~60 fps
   even on the full scene. All measurements above were taken with the panel closed. Suspect the
   RN overlay/glass composition path when the panel is closed (blur views over a changing
   canvas) — worth checking in R1 on a phone before trusting any panel-open number.

### Mount time

Orbit tab → Orrery remount: the canvas appears ~4–5 s after the tap **with the environment ON
or OFF** (screencap sequence, same session) → the delay is pre-existing (scene load/mount on a
debug emulator), not the bake. The bake itself shows no separate fallback phase.

### Reduced motion

Forced ON: two screenshots 3 s apart differ only inside the HUD text box (pixel diff bbox
`(43,580)-(593,609)`) → the environment is fully static. The clock still replays the canvas
every frame (HUD still ticks): R2's "unmount the clock under reduced motion" is still open.

## 2026-10-01 — WP-1.2 worlds (L2–L5) (commits 469440db → WP-1.2 close)

**EMULATOR, DEBUG build — relative A/B only, never a phone claim.** Scene: **Lab B Dense**
(≈120 contacts) with **Relationship Satellites ON** (≈67 moons — WP-1.1 runs had satellites
OFF, so absolute numbers are not comparable across WPs), Home pose (recenter), Galaxy Dark,
**rings OFF** (L1 still dominates otherwise, see WP-1.1), panel CLOSED, intensity 1.00, every
flag state verified from a panel screenshot before closing. gfx = `dumpsys gfxinfo` 15 s idle
after `reset` (main + RenderThread); HUD = lab clock cadence.

| Run | Config | gfx frames / 15 s | gfx p50 / p90 ms | HUD fps |
|---|---|---|---|---|
| A | lit bodies, **25 scalar uniforms per body**, shader moons (469440db) | 163 | 65 / 81 | 32.9 |
| A2 | same, fresh session | 183 | 65 / 69 | — |
| C | A + moons flat | 198 | 48 / 65 | — |
| A3 | **uniforms packed into float4s** (0922d223), shader moons | 262 | 48 / 48 | 49.7 |
| C2 | A3 + moons flat | 320 | 34 / 48 | 52.9 |
| **D** | **default at WP-1.2 close: packed lit bodies + cheap 3-circle moons** | 270 | **34** / 48 | 49.0 |
| B / B2 | `bodyLighting` OFF (WP-1.0 flat discs) | 323 / 342 | 32 / 34 | 34.4 / 30.9 |
| E | `bodies` OFF (no sun/bodies/moons) | 323 | 18 / 34 | 32.0 |

Findings (relative, emulator only):
1. **The cost of a runtime shader per body is CPU, not GPU.** GPU p50 stayed 8–11 ms in every
   lit run. RN Skia rebuilds every `<Shader>` on every canvas replay (the ambient clock replays
   the whole canvas each frame): `processUniforms` resolves each uniform **by name** (a JSI
   call per uniform) and re-makes the shader — also for bodies collapsed to scale 0 off-screen.
   25 scalar uniforms × ~190 shader bodies doubled gfx p50 (32 → 65 ms).
2. **Packing uniforms into 8–10 `float4`s** cut that to 48 ms; replacing 67 per-moon shaders
   with three plain circles brought the lit scene to **34 ms ≈ flat discs (32 ms)**. So the
   lit-world look costs ≈ +2 ms p50 / +14 ms p90 over the flat WP-1.0 discs on this target.
3. The body *structure* (≈190 keyed components with derived transforms, flat or lit) is itself
   ≈ 14 ms p50 here (E 18 vs B 32 ms) — pre-existing O(N) mapper/replay cost, an R1 target
   (e.g. a single derived "bodies buffer" or culled-subtree mounting).
4. HUD cadence and gfx disagree (lit ~50 fps HUD vs flat ~31 fps HUD while gfx says lit is
   the slower one). The HUD measures UI-thread clock deltas only; treat it as unreliable for
   this A/B and prefer gfx until R1 repeats on a phone.

Reduced motion (forced ON, Dense overview): two screenshots 3 s apart differ only inside the
HUD box → the sun corona/granulation are static; with motion ON the sun region differs
between the two frames (animated corona) — verified.

## 2026-10-01 — WP-1.3 instrument orbits (L1) + HUD labels (L6) (commits ff7ddbdd → 387b20c8)

**EMULATOR, DEBUG build, Metro — relative A/B only, never a phone claim.** Scene: **Lab B
Dense** (≈120 contacts) with **Relationship Satellites ON** (≈67 moons), Home pose after a
fresh app launch (overview level), **Galaxy Dark**, renderer `lab`, compact FPS HUD on, panel
CLOSED. Each run = registry defaults edited in code → Metro restart → app relaunch → Orrery tab →
25 s settle → `dumpsys gfxinfo` 15 s idle after `reset` (main + RenderThread). Same session,
same target; no tap during the window. Flags not listed are at their WP-1.3 defaults.

| Run | Config | gfx frames / 15 s | gfx p50 / p90 ms | gpu p50 ms |
|---|---|---|---|---|
| base | HEAD 0f888524 (WP-1.2 close): WP-1.0 rings, rings ON | 40 | 250 / 300 | 14 |
| C | `ringsPathRebuild` ON (same WP-1.0 rings, new build) | 47 | 200 / 250 | 19 |
| B | `rings` OFF (floor) | 212 | 48 / 48 | 10 |
| A | instrument orbits, FIRST cut (wakes = 3 stacked stroked arc paths per class, tethers = stroked segment paths) | 86 | 117 / 133 | 7 |
| D | A with `ringShader` OFF (flat strokes) | 88 | 113 / 125 | 5 |
| E | A with `ringFlow` OFF | 90 | 117 / 133 | 12 |
| F | A, rings only (wake, tethers, ticks OFF) | 213 | **48** / 53 | 10 |
| G | A, wake OFF | 164 | 61 / 65 | 2 |
| H | A, tethers OFF | 93 | 105 / 117 | 5 |
| I | A, ticks OFF | 86 | 117 / 133 | 12 |
| J | wakes = per-ring circle + `ringWake` shader, tethers = rotated rects | 183 | **48** / 65 | 10 |
| K | final WP-1.3 defaults (J + focus lock / density fade) | 196 | **48** / 65 | 10 |

Findings (relative, emulator only):
1. **The legacy ring cost was the per-frame Path + stroke, not the ring count.** 120 rings as
   static world `Circle`s under ONE shared homography matrix cost nothing measurable over rings
   OFF (F 48 ms = B 48 ms, 213 vs 212 frames), versus 4–5× fewer frames for the WP-1.0 rings
   (base/C). The full instrument layer at close (K) is at the rings-OFF floor for p50 (+17 ms p90).
2. **The ring shader is free on this target** (D flat ≈ A shader, E no-flow ≈ A): the stroke
   shader only shades stroke pixels and one shader instance serves a whole status class.
3. **Stroked static PATHS are the trap.** The first wake/tether cut built the geometry once
   (React memo) and drew it under the same matrix, yet cost +56 ms (wake, G) and +12 ms
   (tethers, H) p50: Ganesh re-tessellates stroked paths on the CPU every replay (gpu p50 stays
   low). Circles (analytic op) and rects (rect op) under the same matrix do not. Rule for V2:
   **instrument geometry = circles / rects / shaders, never stroked paths per frame.**
4. Ticks (I) are free: their paths are short and the detail-level path draws at alpha 0 (Skia
   skips) outside `detail`.
5. Tilt (perspective matrix) was exercised visually (evidence 05) — not timed; the circles then
   leave the analytic fast path. Measure on the phone in WP-1.4.
6. The frame worklet still projects 128 `ringPath` points per contact whenever the frame
   changes (pan/zoom/switch). The lab renderer no longer reads `ringPath` (only the legacy ring
   and the reorder ghost do). Idle frames don't pay it, gestures do — R1 candidate (drop
   `ringPath` from `projectFrame` once the ghost uses the homography too).

Reduced motion (forced ON, Dense overview): two screenshots 2 s apart differ only inside the HUD
box → flow comets off, wakes/rings static.

## 2026-10-01 — WP-1.4 M1 checkpoint, RELEASE build (commit 80a9650b)

**EMULATOR, RELEASE build (Hermes, minified, `__DEV__` false, no Metro), x86_64, emulator-5554 —
relative A/B on this one target only, never a phone claim.** Scene: **Lab B Dense** (120
contacts, 30 seeded test portraits app-wide), **Relationship Satellites ON**, **Galaxy Dark**,
Home pose (recentre button) after a 20 s settle. Toggles changed live in the Lab B panel (panel
closed during every window). Per run: `gfxinfo reset` → **idle 15 s**; then **pan** = 6 adb
swipes back and forth (~10 s window); then **switch2x** = Dense → All Contacts → Dense through
the panel (~25 s window, includes two panel open/close cycles). Raw dumps + HUD crops:
`evidence/05-m1-checkpoint/perf/`. Main + RenderThread only; JS-thread jank is invisible.

| Run | idle frames / 15 s | idle p50 / p90 | pan frames | pan p50 / p95 | switch2x frames | switch p50 / p95 | HUD fps (one snapshot) |
|---|---|---|---|---|---|---|---|
| **legacy** renderer | **50** | 200 / 200 ms | 28 | 200 / 1600 ms | 91 | 200 / 850 ms | n/a (HUD is lab-only) |
| **lab, all defaults ON** | **312** | 17 / 34 | 174 | 17 / 48 | 574 | 32 / 34 | 40.2 |
| lab, `environment` OFF | 332 | 17 / 34 | 157 | 18 / 600 | 583 | 32 / 34 | 60.0 |
| lab, `rings` OFF | 339 | 17 / 34 | 140 | 18 / 600 | 560 | 17 / 34 | 60.0 |
| lab, `bodies` OFF | 325 | 17 / 34 | 150 | 17 / 38 | 584 | 17 / 34 | 51.8 |
| lab, `labels` OFF | 321 | 17 / 34 | 176 | 17 / 550 | 568 | 17 / 34 | 48.3 |
| lab, env+rings+polaris+bodies+labels OFF | 115 | 17 / 18 | 52 | 17 / 1150 | 223 | 17 / 22 | 60.0 |
| lab all ON, **5-min idle** | 7062 / 300 s (23.5/s) | 17 / 34 | — | — | — | — | — |

Findings (relative, emulator only):
1. **Legacy vs lab in release: ~6× more frames for the lab renderer** (312 vs 50 per 15 s idle;
   legacy p50 200 ms = ~5 fps on Dense). This matches the WP-1.3 debug finding that the legacy
   per-frame ring `Path` rebuild is the dominant cost; release does not rescue legacy.
2. **In release, no single heavy layer moves the lab's idle frame count** (312–339 within
   noise). The lab path runs at a steady ~21–23 frames/s of RenderThread output with p50 at one
   vsync (17 ms) and p90 at two (34 ms), i.e. a cadence pinned near every-other/third vsync
   rather than a cost that scales with any layer. With every layer off the count *drops* (115)
   because an unchanged canvas produces fewer frames — so gfx frame count here measures
   "changed frames", not headroom. The bottleneck is not identifiable from gfxinfo on this
   target; the debug-build layer costs (WP-1.2/1.3 tables) remain the best per-layer evidence.
   R1: repeat this exact matrix on the Pixel 6 Pro with Perfetto (UI + JS threads).
3. **gpu p50 stays 3–7 ms** with everything on (the sky, rings and lit bodies are cheap on the
   GPU); the switch window rises to 15–16 ms GPU while bodies/rings animate.
4. **Pan p95 spikes (550–1150 ms)** appear in some lab runs and in the all-off run but not
   in lab-all — single long frames at gesture start/end, not sustained; treat as noise until
   reproduced on a phone.
5. **HUD fps** (UI-thread clock cadence, one screenshot per run) disagrees with gfx again
   (40–60 fps HUD vs ~21 frames/s gfx). Same caveat as WP-1.2: HUD is a lab convenience, not a
   measurement.
6. **5-minute idle** holds 23.5 frames/s with the same p50/p90 as the 15 s window — no drift.
   Thermal on the emulator is synthetic (battery/skin constant 30 °C, status 0): **no thermal
   claim possible**. Memory: TOTAL PSS ~1.11 GB at start, ~1.10 GB after 5 min (Native Heap
   ~400 MB) — stable, no growth; the absolute figure includes the emulator's GL translation
   allocations and is not comparable to a phone.

Lifecycle (release, `evidence/05-m1-checkpoint/lifecycle-gfxinfo.txt`): 0 frames in 10 s on
the Contacts tab and while backgrounded; ~200 frames in 10 s on the Orrery tab and again after
returning to foreground — the clock stops when the Orrery is inactive.

Reduced motion (release, forced ON, Inner Circle): two screenshots 2.5 s apart differ in **0**
pixels outside the HUD box; with RM off, 239 186 pixels differ.

## 2026-10-01 — WP-2.1 System-switch showcase (RELEASE build, emulator)

**EMULATOR, RELEASE build — relative A/B on this target only, never a phone claim.** gfx =
`dumpsys gfxinfo` (main + RenderThread), JS thread invisible. Each run: `orbit://labb?reset=1&<flags>`
(remount, 11 s settle) → panel quick switch Work ↔ Inner Circle (alternating; small Systems, no
pre-existing stall) → 6 s window from the tap. "skipped" = Choreographer skipped frames in the window.

| Config | frames / 6 s | p50 | p90 | p99 | gpu p50 / p90 | skipped |
|---|---|---|---|---|---|---|
| all switch FX ON | 187 | 17 | 46 | 113 | 6 / 8 | 0 |
| all ON (repeat) | 136 | 18 | 48 | 133 | 6 / 22 | 0 |
| `fx` master OFF | 164 | 17 | 34 | 48 | 8 / 20 | 0 |
| `fx` OFF (repeat) | 171 | 17 | 34 | 34 | 9 / 25 | 0 |
| streaks off | 193 | 17 | 34 | 117 | 8 / 14 | 0 |
| particles off | 150 | 18 | 48 | 65 | 7 / 22 | 0 |
| ring trim off | 178 | 17 | 34 | 85 | 5 / 16 | 0 |
| comets/smears off | 183 | 18 | 48 | 65 | 6 / 21 | 0 |
| flares off | 167 | 17 | 48 | 85 | 5 / 18 | 0 |
| shockwave off | 141 | 18 | 48 | 101 | 6 / 18 | 0 |
| dissolve off | 144 | 18 | 40 | 97 | 6 / 22 | 0 |
| **filter experiment ON** (+ all) | 141 | 18 | 48 | 117 | 6 / 21 | 0 |

Idle 15 s on Inner Circle (switch FX mounted but at rest vs `fx` off): 348 / 324 frames vs 329 /
328, p50 17 / p90 34 in all four — **no measurable idle cost** (collapsed sprites, empty trim
picture).

Findings (relative): all FX cost about +12–14 ms at p90 and +65–85 ms at p99 during a switch;
the frame count is noise-dominated (136–187 for the same config). No single effect stands out
beyond noise; streaks / ring trim / dissolve are the cheapest to keep, particles + comets the
likeliest p99 contributors (per-frame worklet loops + Atlas buffer conversion). The displacement
filter (one full-layer saveLayer + runtime filter, every frame while mounted) did not separate
from all-ON here; the emulator GPU (Arc B580) hides fill cost — **the phone must judge it**.

**First switch after a cold launch** (force-stop → launch → Orrery → 8 s → Work → Inner, warm-up
on): 157 frames, p50 17 / p90 40 / p99 117 ms, 0 skipped, recording max gap 0.37 s (at the publish
render, same as warm switches). Evidence `01-first-switch-after-cold-launch…mp4`.

**Lab ringPath fix** (frame worklet, instrumented release): `projectAnimatedFrame` 678–801 ms per
switch frame at 141 bodies → 6–7 ms with `ringPaths` off.

**Pre-existing big-switch stall** (see DECISIONS WP-2.1 §9): Inner ↔ Dense / All: 160–430 skipped
frames per switch; M1 build 159–349; legacy renderer 212/413; bodies+labels+rings OFF 222/339;
fx off/on identical (243/241 All, 426/426 Inner). Main-thread stack in RN Skia
`JsiRecorder::applyUpdates` (`07-stall-main-thread-stack.txt`).

## 2026-10-01 — Switch-stall investigation and fix (RELEASE build, emulator; commits ea137306 → 3c0f691b)

**EMULATOR, RELEASE, uninstrumented builds — relative A/B on this target only, never a phone
claim.** Full write-up: `research/SWITCH-STALL-INVESTIGATION.md`. Per run: the panel quick switch
→ 10 s window → `dumpsys gfxinfo` (reset at the tap) + Choreographer "Skipped N frames". A =
6e6fd2a3 (before), B = 3c0f691b (after). Raw: `evidence/07-switch-stall/15-gfxinfo-summary.txt`.

| Build / renderer | runs (big switches) | gfx frames / 10 s | p50 | p99 | skipped max per switch |
|---|---|---|---|---|---|
| A lab | 8 (I↔D ×2, I↔A, A↔D) | 67–163 | 17–34 ms | 65–4950 ms | **216–371** |
| A legacy | 6 | 12–102 | 13–250 ms | 900–4950 ms | **216–427** |
| B lab (`layerPictures` ON, default) | 8 | **196–260** | 17–34 ms | 81–117 ms | **0** |
| B lab `layerPictures:0` (fixes 1+3 only) | 6 | 176–255 | 32–34 ms | 81–133 ms | 0 |
| B legacy (fix 1 applies) | 6 | 25–109 | 17–250 ms | 300–1600 ms | 33–120 |

Normal-speed recordings (`01`–`04`), longest interval with no new frame: before 3.8 s / 4.9 s,
after 0.18 s / 0.17 s. Instrumented (temporary, `12-instrumentation.patch`): bound
SharedValues on Dense 3 193 → 47, mappers 3 786 → 85, UI mapper time per animated switch frame
80–126 → 50–60 ms; JS-thread blocks per big switch up to 7.3 s (after fix 1 alone) → ≤ ~1 s.
Remaining per-switch-frame UI cost: WP-2.1 trim picture 15–24 ms, wake picture 11–14 ms at
settle, frame projection 5–8, bodies picture 2–7, allocation 1.5–3, rings 1–2.

Findings (relative, emulator only):
1. The 3–7 s main-thread stall was the model-half frame mapper being re-created on every
   OrreryScreen render with a closure carrying the switch runtime's `resources` (scene per
   entry) — ~0.6–0.8 s of UI-thread closure deserialisation + `extractInputs` walk per restart.
   Fixed in the shared model half → both renderers.
2. Declarative per-body Skia components (thousands of bound SharedValues) block the JS thread
   for seconds per canvas commit (synchronous UI reads, recorded twice per commit) and cost
   ~80 ms of mappers per frame on this target. One UI-thread picture per layer removes both.
3. Legacy after fix 1 still drops 33–120 frames per switch: its own ~200 ms ring-Path frames
   (WP-1.3/1.4), now visible because the switch actually plays.

## 2026-10-01 — WP-2.2 focus / feedback (RELEASE build, emulator; commit 0acdc848)

**EMULATOR, RELEASE — relative A/B only, never a phone claim.** Scenario (scratch `perf.sh`, raw
`evidence/08-wp2.2-focus/18-perf-gfxinfo-raw.txt`): Lab B Inner Circle, Galaxy Dark; ×3: recentre →
reset → tap a photo body → 6 s (fly-in + lock) → reset → 8 s idle focused → reset → tap empty
space (clear + ripple) → 3 s. A/B on the SAME build: WP-2.2 flags all on vs all off (`fxFocus,
fxFocusDim, fxFeedback, fxReorder, hudChrome, focusCardAnchor` via deep link).

| Window | flags ON frames / p50 / p90 / p99 | flags OFF frames / p50 / p90 / p99 |
|---|---|---|
| fly-in 6 s | 184–210 / 17–18 / 34–48 / 48–77 | 195–207 / 17–18 / 34–36 / 53–65 |
| idle focused 8 s | 138–157 / 14–32 / 34 / 48–77 | 139–159 / 18–32 / 34 / 65–69 |
| clear + ripple 3 s | 102 / 13–17 / 18–34 / 34 | 100–110 / 17–18 / 19–32 / 34–48 |

Cross-build reference (pre-WP-2.2 release, dba6430b-era code, different body/layout, so only
indicative): fly-in 194–198 / 18 / 34 / 48–65, idle 166–169 / 17–18 / 34 / 36–53.

Findings: no separable cost within emulator noise. The fly-in p90/p99 upper end is slightly
higher with the flags on (one run 48/77 ms), consistent with the bodies picture re-recording
while `mix` animates (340 ms) plus the reticle picture recording per frame during the
lock. At rest the focus/feedback pictures do not re-record (no clock reads). Phone + Perfetto
needed for a real answer (R1).

## 2026-10-01 — R1 density envelope (RELEASE builds, emulator; commits bba4cf5b → final R1)

**EMULATOR, RELEASE, x86_64 — relative A/B on this one target only, never a phone claim.**
Harness `tools/r1-matrix.sh` / `tools/r1-perf.sh` (deep-link driven; each row = a 10 s idle,
6-swipe pan, 7 s focus fly-in, or 9 s switch window; gfx = `dumpsys gfxinfo`, main +
RenderThread, TextureView path (`opaqueCanvas:0`); probe = the new `perfProbe` per-worklet UI-thread
timing, mean ms). Systems: Inner 12, Dense 120, **Stress 400**, **Stress 800** (new seed; All
Contacts = 940). Galaxy Dark, satellites on. Configs: **lab all-on** (`idleClock:0` = the M2
clock behaviour), **lab minimal** (environment, fx, ring shader/flow/wake/tethers/ticks, lighting,
lab Polaris, chart, HUD labels all off), **legacy**. Full tables: `tools/r1-table.py` over
`evidence/09-r1/perf/{A-baseline,B-after,C-after2}/summary.tsv` (+ raw `.gfx` / `.log`).
A = R1 start (bba4cf5b), B = 83c9033a (context, lookups, wakes/flow LOD, paragraph cache),
C = 89c2f1dd (+ projectFrame fast path, ring culling).

### Envelope — lab all-on

| Bodies | Scene | A frames / p50 / p99 | C frames / p50 / p99 | Top UI worklets A → C (mean ms) |
|---|---|---|---|---|
| 120 | pan | 310 / 17 / 85 | 400 / 18 / 53 | frame 5.8 → 0.7 · wakes 15.2 (p95 105) → 6.8 · alloc 1.4 → 0.3 |
| 120 | focus | 158 / 34 / 101 | 168 / 29 / 93 | wakes 12.6 → 1.1 (hidden in flight) |
| 400 | pan | 302 / 32 / 150 | 375 / 17 / 48 | frame 19.6 → 1.7 · alloc 15.8 → 0.4 · wakes 34.1 → off (LOD) |
| 400 | focus | 178 / 34 / 150 | 216 / 17 / 65 | frame 20.5 → 2.1 · wakes 40.2 → off |
| 400 | switch in | 166 / 18 / 200 | 195 / 18 / 121 | trim p95 57 → 24 (culled) |
| 800 | idle | 216 / 34 / 65 | 211 / 18 / 40 | — |
| 800 | pan | 222 / 34 / 200 | 358 / 17 / 48 | frame 35.7 → 3.4 · alloc 61.7 → 0.6 · wakes 68.2 → off |
| 800 | focus | **CRASH** (Hermes SIGSEGV) | 216 / 18 / 69 | — |
| 800 | switch in | **CRASH** | 204 / 18 / 73 | trim p95 150 (B) → 10 (C) |

Lab minimal at 800 (C): pan 290 frames p50 18 / p99 36; frame 3.1 ms. Legacy renderer (A and B):
120 idle 33 frames / 10 s at p50 200 ms; 400 idle 5 frames (p50 3.1 s); 800 idle 5 frames
(p50 1.55 s, 186 skipped) — **legacy is unusable from ~120 bodies on this target and crashed at
800 before the paragraph-cache fix** (the crash was in the shared model half).

### Idle clock / reduced motion / opaque canvas (C build, Dense 120, 10 s idle)

| Config | gfx frames | p50 |
|---|---|---|
| defaults, idle clock ON vs always-on clock | 189 vs 191 | 32 / 32 (ambient effects still animate) |
| reduced motion, idle clock ON vs always-on | **0** vs 190 | — / 32 |
| every ambient effect off, ON vs always-on | **0** vs 230 | — / 18 |
| Stress 800, reduced motion, idle clock ON | **0** | — |

Reduced motion: two screenshots 3 s apart, 0 changed pixels (no HUD). **Opaque canvas
(SurfaceView)**: gfxinfo cannot see SurfaceView buffers (0 frames is NOT idle there); measured
with `dumpsys SurfaceFlinger --latency` on the canvas layer instead: Dense idle **60.0 fps
presented (p50 16.6 ms)** vs TextureView 27.4–27.8 fps (p50 33.4 ms), twice each; Stress 800
during pans 59.9 vs 27.8 fps. The ~21–30 fps "cadence no layer explains" since WP-1.4 is the
TextureView composition path on this emulator. Overlays, the focus card and screenshots composite
over the SurfaceView (`evidence/09-r1/shots/02`, `03`).

Findings (relative, emulator only):
1. Before R1 the envelope broke at **~400 bodies** (UI thread: frame projection 20 ms +
   allocation 16 ms + wakes 34–40 ms per changed frame) and **crashed at 800+** (JS thread).
2. After R1 the per-frame UI cost at 800 is **~10 ms** in a pan (frame 3.4, bodies 3.9, rings
   1.6, alloc 0.6) — linear and small. The remaining fixed cost is the environment
   (full-screen nebula sample + star Atlas + sun) and, on this target, the TextureView path.
3. GPU p50 stays 7–24 ms in every lab row (emulator GPU noise dominates); no GPU fill wall was
   found up to 800 bodies — the phone must confirm (PHONE-PASS-SCRIPT).

## 2026-10-01 — R2 art direction + hero experiments (RELEASE `r2d`, emulator; commit ff90df99)

Harness `tools/r2-perf.sh` (r1-perf: `opaqueCanvas:0`, `idleClock:0`, Dense 120, focus Ada
Abbott, switch ↔ Inner Circle). Raw: `evidence/10-r2/perf/summary.tsv`, `*.gfx`, `*.log`.
Relative only — this emulator's TextureView path presents ~28 fps whatever the scene.

| Config | idle p50/p90 | pan p50/p90 | focus p50/p90 | switch-in p50/p90 | GPU p50 idle/pan |
|---|---|---|---|---|---|
| R1 base (R2 flags off) | 19/36 | 20/48 | 32/34 | 32/53 | 8/8 |
| R2 defaults (tilt, pool, grid, rim light, size floor) | 24/36 | 23/42 | 23/40 | 25/40 | 9/9 |
| + bloom | 26/34 | 25/42 | 27/36 | 25/57 | 14/11 |
| + lens flare | 24/34 | 22/48 | 24/36 | — | 13/9 |
| + tilt-shift | 25/34 | 23/38 | 23/48 | — | 13/9 |
| + shock filter (switch only) | — | — | — | 25/40 | — |

No config is separable from run-to-run noise (±5 ms p50); 0 skipped frames everywhere. GPU p50
hints at +2–5 ms for bloom. UI-thread probe (bodies/rings/labels pictures) unchanged within
noise. The full-screen stage shader and bloom are the phone-pass items.

## 2026-10-01 — R3 presets (RELEASE `r3e`, emulator; Dense 120)

`tools/r1-matrix.sh` on presets (`SYSTEMS=120`, `idleClock:0`, `opaqueCanvas:0` so gfxinfo sees
the frames). Raw: `evidence/11-r3/perf/summary.tsv`. **Emulator, relative only.** gfx ms:

| Config | idle p50/p90 | pan p50/p90 | focus p50/p90 | switch in p50/p90 | GPU p50 idle/pan | skipped |
|---|---|---|---|---|---|---|
| Lab B best | 24 / 34 | 23 / 36 | 26 / 40 | 25 / 42 | 12 / 9 | 0 |
| Ship-safe | **18 / 34** | **20 / 40** | **18 / 34** | **18 / 40** | 8 / 8 | 0 |
| Everything | 25 / 34 | 25 / 40 | 28 / 48 | 20 / 53 | 12 / 9 | 0 |
| best + bloom | 27 / 36 | 23 / 38 | 26 / 46 | 26 / 53 | 16 / 10 | 0 |
| best − stage plane | 24 / 34 | 24 / 38 | 24 / 36 | 24 / 61 | 13 / 10 | 0 |
| Legacy | 200 / 200 | 200 / 900 | 200 / 350 | 38 / 300 | 11 / 12 | 36–64 |

- **Ship-safe is the only config separable from noise** (p50 −6…−8 ms idle / focus / switch vs
  best). The UI probe shows why: the rings picture re-records on EVERY clock tick while
  `ringFlow` is on (best: 659 runs in the pan window, 2.2 ms mean; ship-safe: 100 runs, only on
  frame changes). Wakes (off in ship-safe) are 1.3–13 ms mean per frame change, p95 15–200 ms
  (pan window; includes a first-record outlier).
- Bloom: GPU p50 +4 ms idle (12 → 16) — same hint as R2; the stage plane: no separable cost.
- Near-size clamp: `frame` probe 0.8 ms mean (pan) / 1.0 ms (focus), inside R1's range for
  Dense — no measurable cost. Immersive chrome: static RN views, no per-frame work.
- "Everything" crashed the app before the R3 fix (`moonShader` + layer pictures); after it,
  0 crashes over the matrix, the captures and the paths script (crash buffer empty).
- Shipsafe idle/switch_in GPU p90 rows read 4950 ms: a single gfxinfo outlier bucket, ignored.
