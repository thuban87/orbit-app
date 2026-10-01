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
