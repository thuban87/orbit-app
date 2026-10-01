# Lab B — Performance

> **Every number in this file is EMULATOR-RELATIVE.** It comes from the desktop emulator
> (`emulator-5554`: sdk_gphone16k_x86_64, API 37, GLES translator over an Intel Arc B580, 4
> vCPU, 1280×2856). Each number is valid only as an A/B **on that target in that session**.
> None of them is a phone claim. The emulator cannot answer GPU-fill, thermal, battery or
> absolute frame-time questions. The **Pixel phone pass is pending — the Pixel is in use by
> Lab A** (§9).
>
> The raw logs are in `research/PERF-LOG.md` (the per-run tables), `research/R1-REPORT.md`,
> `research/R2-REPORT.md`, `research/R3-REPORT.md`, `research/FINAL-VALIDATION.md` and
> `research/SWITCH-STALL-INVESTIGATION.md`.

## 1. Targets

| Target | Status |
|---|---|
| Hold 60 fps at Dense 120 on the Pixel 6 Pro with all defaults (research 03) | **Unknown.** Phone pass pending. |
| No break, no crash up to the largest real System (940 = All Contacts in the stress seed) | **Met on the emulator** after R1 |
| Zero redraw while untouched under reduced motion | **Met** (0 frames / 10 s) |
| No first-switch shader-compile hitch | **Met on the emulator** (cold first switch = warm switches) |
| Bounded memory, no growth over a 5-min idle | Met on the emulator (PSS ~1.11 → 1.10 GB, emulator-inflated absolute) |

## 2. Instruments (and their blind spots)

| Instrument | Sees | Does not see |
|---|---|---|
| `dumpsys gfxinfo` | Main + RenderThread frame times | JS thread; **SurfaceView (opaque canvas) frames**, which read as 0 frames, not idle |
| `dumpsys SurfaceFlinger --latency <layer>` | Presented rate of the opaque canvas | Per-thread cost |
| `perfProbe` flag (`labb-perf-probe.ts`) | UI-thread JS time per worklet (frame, alloc, bodies, labels, rings, wakes, trim…) | Skia replay and GPU |
| Lab FPS HUD | UI-thread clock cadence only | It disagreed with gfx repeatedly, so it is **not a measurement** |
| Temporary instrumentation patch (`evidence/07-switch-stall/12-instrumentation.patch`, never committed) | Mapper restarts, closure deserialisation, bound-value counts | — |

Two artefacts distort the emulator numbers:

- **TextureView.** On this emulator the TextureView path presents about 28 fps whatever the
  scene. That explains the "~21–30 fps cadence no layer explains" from WP-1.4 to R1. The
  opaque canvas presents 60 fps.
- **Harness pinning.** For gfx A/B the harness pins `opaqueCanvas:0` and `idleClock:0`.

## 3. Envelope (emulator, release, Galaxy Dark, satellites on)

From R1 (`evidence/09-r1/perf/{A-baseline,B-after,C-after2}`). "A" is the start of R1
(`bba4cf5b`); "C" is after `89c2f1dd`.

| Bodies | Scene | Before R1 (A): frames / p50 / p99 ms | After R1 (C) | Top UI worklets, A → C (mean ms) |
|---|---|---|---|---|
| 120 | pan | 310 / 17 / 85 | 400 / 18 / 53 | frame 5.8 → 0.7 · wakes 15.2 → 6.8 · alloc 1.4 → 0.3 |
| 120 | focus | 158 / 34 / 101 | 168 / 29 / 93 | wakes 12.6 → 1.1 |
| 400 | pan | 302 / 32 / 150 | 375 / 17 / 48 | frame 19.6 → 1.7 · alloc 15.8 → 0.4 · wakes 34.1 → off (LOD) |
| 400 | switch in | 166 / 18 / 200 | 195 / 18 / 121 | trim p95 57 → 24 |
| 800 | pan | 222 / 34 / 200 | 358 / 17 / 48 | frame 35.7 → 3.4 · alloc 61.7 → 0.6 · wakes 68.2 → off |
| 800 | focus | **CRASH** | 216 / 18 / 69 | — |
| 800 | switch in | **CRASH** | 204 / 18 / 73 | trim p95 150 → 10 |

- **Where it broke before R1:** at about **400 bodies** on the UI thread (projection 20 ms +
  allocation 16 ms + wakes 34–40 ms per changed frame), and with a **crash at 800+** on the JS
  thread, on both renderers.
- **After R1:** about **10 ms of UI worklet time per pan frame at 800** (frame 3.4, bodies
  3.9, rings 1.6, alloc 0.6). It grows linearly and stays small, with no crash and 0 skipped
  frames.
- **Legacy renderer:** 120 bodies idle gives 33 frames / 10 s at p50 200 ms; 400 gives 5
  frames (p50 3.1 s); 800 gives 5 frames. It is **unusable from about 120 bodies on this
  target**, because of its per-frame 128-point ring `Path` rebuild (WP-1.3/1.4).

## 4. Legacy vs lab and per-layer cost

**M1 release, Dense 120, 15 s idle** (`evidence/05-m1-checkpoint/perf/`):

| Renderer | Frames | p50 |
|---|---|---|
| Legacy | 50 | 200 ms |
| Lab all-on | 312 | 17 ms |

That is roughly **6× more frames**. In release, no single lab layer moved the frame count
(312–339 frames, within noise).

**Per-layer costs that *were* separable** (debug-build A/Bs; these are the best per-layer
evidence available):

| Item | Finding (emulator, relative) | Source |
|---|---|---|
| Far stars as a 760-sprite Atlas | gfx p50 32 vs 17 ms → moved into the nebula shader (≈ free) | WP-1.1 runs 2–3 |
| Live full-res fbm nebula | p50 32 vs 18 ms, every frame janky → bake kept | WP-1.1 run 3 H |
| Body shader with 25 scalar uniforms × ~190 bodies | p50 65 vs 32 ms flat → packed float4: 48 ms | WP-1.2 A vs A3 |
| Per-moon shader (67 moons) | ≈ +14 ms p50 → cheap 3-circle moon | WP-1.2 A3 vs C2 |
| Lit worlds (packed, cheap moons) vs flat discs | ≈ +2 ms p50 / +14 ms p90 | WP-1.2 D vs B |
| Legacy-style rings (128-pt Path per ring per frame) | 40–47 frames / 15 s vs 212 rings-off | WP-1.3 base/C vs B |
| Instrument rings (circles under one homography) | **= rings-off floor** (48 ms p50, 213 vs 212 frames) | WP-1.3 F |
| Ring stroke shader / flow | Free (shades only stroke pixels, one instance per class) | WP-1.3 D, E |
| Wakes / tethers as stroked static paths | +56 ms / +12 ms p50 (CPU re-tessellation) → shader circles and rects | WP-1.3 G, H vs J |
| Switch FX all on vs off (small switch) | p90 +12–14 ms, p99 +65–85 ms during a switch; **0 idle cost** | WP-2.1 |
| Focus / feedback flags | Not separable from noise | WP-2.2 |
| R2 art defaults (tilt, pool, grid, rim light, size floor) | Not separable (±5 ms p50 noise); GPU p50 8 → 9 | R2 |
| Bloom | Not separable on gfx; **GPU p50 +2–5 ms hint** | R2 |
| Lens flare / tilt-shift | Not separable; GPU p50 +1–4 ms hint | R2 |

## 5. The big fixes and what they bought (emulator, relative)

| Fix | Before → after | Commit |
|---|---|---|
| Frame worklet captures only SVs and scalars (**shared model half, both renderers**) | Big switch: 216–371 skipped frames → 0 (lab), 216–427 → 33–120 (legacy); frozen interval 3.8–4.9 s → 0.17–0.18 s | `ea137306` |
| Layer pictures (one SkPicture per layer) | Bound SharedValues 3 193 → 47, mappers 3 786 → 85 (Dense); UI mapper time per animated switch frame 80–126 → 50–60 ms; JS blocks per switch up to 7.3 s → ≤ ~1 s | `038a8d97` |
| `memo(LabBRenderer)` part-wise comparator | Canvas commits per switch ~11 → 6–7 | `3c0f691b` |
| `ringPaths` projection skip (lab only) | `projectAnimatedFrame` 678–801 → 6–7 ms per switch frame at 141 bodies (instrumented) | `30026fda` |
| `projectFrame` per-frame constants hoisted (bit-identical, **shared**) | 35.7 → 3.4 ms (800), 19.6 → 1.7 ms (400) | `89c2f1dd` |
| Allocation key index + satellite maps (**shared**) | alloc 61.7 → 0.6 ms (800 pan) | `83c9033a` |
| Paragraph cache (**shared**) | 800-body Hermes SIGSEGV: 3/3 and 5/5 → 0/5 | `83c9033a` |
| Clock-free worklet context | Trim, switch-FX and star placements no longer re-run per tick at rest | `83c9033a` |
| Wake: camera split, motion gate, flat uniforms, LOD 160 | 68 ms → off (800); 15.2 → 6.8 ms (120 pan) | `83c9033a` |
| Ring + trim screen culling | Trim p95 150 → 10 ms (switch into 800) | `89c2f1dd` |
| Idle clock | Reduced motion, untouched: 190 → **0** frames / 10 s | `bba4cf5b` |
| Opaque canvas (SurfaceView) | Presented 27.4–27.8 → **60.0 fps** (Dense idle); 27.8 → 59.9 (Stress 800 pan) | `bba4cf5b` (flag), `80852701` (default) |

## 6. Remaining bottlenecks (ranked by expected phone risk)

1. **Full-screen fragment work** on a fill-rate-bound Mali GPU:
   - the nebula sample, which runs every frame while ambient is on;
   - the R2 stage plane (≈25 ALU ops plus an inverse homography per pixel);
   - the lit sun;
   - the optional bloom, a full-screen offscreen plus blur per frame, which is *the* classic
     Android cliff.

   The emulator's desktop GPU hides all of it.
2. **Ambient redraw.** While any ambient effect is on (drift, twinkle, flow, corona), the
   whole canvas replays every vsync. That is a battery and heat question for the phone
   (C-06).
3. **Switch frames.**
   - The trim picture builds one Paint plus one `MakeSweepGradient` per leaving or entering
     ring: 15–24 ms per switch frame at Dense.
   - The wake picture costs 11–14 ms at settle.
   - Particles and comets are the likeliest p99 contributors (WP-2.1).
4. **Bodies picture.** It makes one runtime shader per visible body per changed frame: 2–7 ms
   at Dense, 3.9 ms at 800. A photo texture atlas is the next step if the phone needs it.
5. **Frame projection.** It is still O(N) object churn (spreads in `sampleWorldTransition` /
   `projectAnimatedFrame`): 3.4 ms at 800, about 48 µs per body on the emulator UI thread
   before the hoist. Typed arrays would help, but only if the phone shows it.
6. **Label paragraphs.** They are still Skia host objects built on the JS thread. The cache
   removed the churn but not the first build (~2 s debug at 940).
7. **The tilted plane.** Perspective-matrix cost under tilt (circles leaving the analytic
   fast path) was never timed. Since R2 the Home pose *is* tilted (C-66), so this is now the
   default case.

## 7. Risks

- **The GPU and driver matrix (C-11).** Shaders were verified only on the emulator's GLES
  translator. A non-null miscompile on Mali or Adreno would not be caught; the null-effect
  fallbacks only cover compile failure.
- **The crash root cause is inferred, not proven.** The 800-body Hermes SIGSEGV (RN Skia
  `JsiHostObject::get` → `createFromHostFunction`) disappeared with the paragraph cache. The
  same class of host-object churn could resurface elsewhere.
- **Texture memory** is unmeasured on a phone. It includes the 768² nebula (~2.3 MB), the
  sprite atlases, photo `SkImage`s and image shaders left to GC (C-50).
- **Thermal and battery** are unknown. The emulator reports a synthetic constant 30 °C.
- **Opaque canvas.** It is a large emulator win, but SurfaceView composition with the RN
  overlays, tab transitions and screenshots needs phone verification (C-07).

## 8. Reduced motion and lifecycle

| Case | Result (emulator) |
|---|---|
| Reduced motion, untouched, idle clock on (Dense 120 and Stress 800) | **0** frames / 10 s |
| All ambient effects off, idle clock on | 0 frames / 10 s (was 230) |
| Defaults, idle clock on vs always-on | 189 vs 191 (ambient still animates, so no saving) |
| Contacts tab / app backgrounded | 0 frames (canvas unmounted) |
| Final validation, release, preset best, 6 s windows (`opaqueCanvas:0`, `perfProbe:1`): Orrery → Digest tab → Orrery → HOME → relaunch | 118 → **0** → 122 → **0** → 115 frames; UI-worklet probe lines 3 → 0 → 2 → 0 → 2 (`evidence/13-final/06-lifecycle/lifecycle-gfxinfo.txt`) |
| 5-min idle, all on (M1, TextureView) | 23.5 frames/s steady, PSS stable |

## 9. PLACEHOLDER — Pixel phone pass results (pending — Pixel in use by Lab A)

> **Not run.** Lab A owned the phone for the whole lab. Run `research/PHONE-PASS-SCRIPT.md`
> once the owner releases it (arm64 builds, local adb 5037, never touch Lab A's package).
> Fill in the script's §5 tables here:
>
> - 5.1 Envelope at 120/400/800 × lab all-on / lab minimal / legacy: _TBD_
> - 5.2 Per-worklet UI cost at 800 (probe): _TBD_
> - 5.3 Perfetto (main busy %, longest main/JS slice, RenderThread p90, jank split): _TBD_
> - 5.4 Idle clock on the phone: _TBD_
> - 5.5 Thermal / battery / memory after 10 min: _TBD_
> - Opaque vs TextureView presented rate, and overlay composition: _TBD_
> - Does the 800-body crash stay fixed on ARM? _TBD_
>
> **Script gaps, closed in R3:** the script and `tools/r1-matrix.sh` now run the presets
> (best / ship-safe / everything / legacy) plus `bloom` and `nostage` rows; `labmin` also
> switches off the R2/R3 flags; the output folder is `evidence/12-phone/`.
> **Still to add on the phone:** real multi-touch (pinch / twist / two-finger tilt), which
> adb cannot inject, and the Stress 400 switch latency (~2 s from label to choreography on
> the emulator, FINAL-VALIDATION §2 #13).

## 10. R3 polish perf delta (emulator, relative)

R3 changed the defaults by adding `nearSizeClamp` and `immersiveChrome` (both ON), and added
presets. Release `r3e`, Dense 120, `tools/r1-matrix.sh` on presets, `idleClock:0`,
`opaqueCanvas:0` (raw: `evidence/11-r3/perf/summary.tsv`, PERF-LOG "R3 presets"). gfx ms:

| Config | idle p50/p90 | pan p50/p90 | focus p50/p90 | switch in p50/p90 | GPU p50 idle/pan |
|---|---|---|---|---|---|
| Lab B best (= defaults) | 24 / 34 | 23 / 36 | 26 / 40 | 25 / 42 | 12 / 9 |
| Ship-safe | **18 / 34** | **20 / 40** | **18 / 34** | **18 / 40** | 8 / 8 |
| Everything | 25 / 34 | 25 / 40 | 28 / 48 | 20 / 53 | 12 / 9 |
| best + bloom | 27 / 36 | 23 / 38 | 26 / 46 | 26 / 53 | 16 / 10 |
| best − stage plane | 24 / 34 | 24 / 38 | 24 / 36 | 24 / 61 | 13 / 10 |
| Legacy | 200 / 200 | 200 / 900 | 200 / 350 | 38 / 300 | 11 / 12 (36–64 skipped) |

- **Ship-safe is the only row separable from noise** (−6…−8 ms p50). While `ringFlow` is on,
  the rings picture re-records on every clock tick (659 runs vs 100 in the pan window).
- The near-size clamp (`frame` probe 0.8–1.0 ms) and the immersive chrome (static views)
  have no measurable cost. Bloom adds +4 ms GPU p50 at idle, the same hint as R2.
- The final validation (release from HEAD, preset best) found no new cost signals and an
  empty crash buffer. Its frame counts are lifecycle evidence (§8), not timing.
