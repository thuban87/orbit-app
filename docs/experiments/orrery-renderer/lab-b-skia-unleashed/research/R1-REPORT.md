# Lab B — R1 report: performance envelope and legibility

2026-10-01. Branch `experiment/orrery-skia-unleashed`, commits `bba4cf5b` → `7c3ec0e6` (+ the R1
docs commit). **Every number is from the desktop emulator (release, x86_64): relative A/B on one
target, never a phone claim.** The phone pass is prepared in `research/PHONE-PASS-SCRIPT.md` and
must wait until the owner says Lab A is done with the Pixel. Detail: PERF-LOG (R1 section),
DECISIONS-LOG (R1), COMPROMISES C-59…C-65, DEAD-ENDS (R1). Evidence: `evidence/09-r1/`.

## 1. Envelope

Scenes: idle, pan (adb swipes), focus fly-in, big switch (Inner 12 ↔ S), at 12 / 120 / 400 /
800 bodies (new Stress Systems; All Contacts = 940), lab all-on, lab minimal, legacy.

| | Before R1 (bba4cf5b) | After R1 |
|---|---|---|
| Where it broke | **~400 bodies** on the UI thread (frame projection 20 ms + label allocation 16 ms + wakes 34–40 ms per changed frame); **800+ crashed** (JS thread, both renderers) | no break up to 800/940: pan p50 17 / p99 48 ms at 800 (gfx), 0 skipped frames, no crash |
| UI worklet cost per pan frame at 800 | ~170 ms (frame 36 + alloc 62 + wakes 68 + rest) | **~10 ms** (frame 3.4, bodies 3.9, rings 1.6, alloc 0.6) |
| Big switch into 800 | crash | 204 frames / 9 s, p99 73 ms; recording max gap 0.22 s (`shots/06`) |
| Untouched + reduced motion | redraws every vsync (190 frames / 10 s) | **0 frames** (idle clock) |
| Presented rate, TextureView vs opaque | ~28 fps on this emulator whatever the scene | **60 fps** with the opaque canvas (SurfaceView), now default |
| Legacy renderer | 120 bodies: 33 frames / 10 s (p50 200 ms); 400: 5 frames (p50 3.1 s) | unchanged (renderer-bound); the shared crash fix applies |

Why it broke (each measured with the probe, then fixed):

1. **Model half, O(N²) / per-body constants**: allocation did `bodies.find(bodyKey…)` per label
   (JSON keys for moons); `projectFrame` ran `usableCameraRect` (obstacle region splitting +
   sort) and `cameraPlane` 4× per body; `deriveSatelliteBodies` scanned members and world per
   moon. Now indexed / hoisted; the projection is bit-identical (test).
2. **Wakes**: one runtime shader per ring, re-recorded on every pan and fly-in frame. Now: no
   re-record on pure pans, hidden during camera recoveries, flat uniforms, off above 160 rings.
3. **Clock fan-out**: worklets that captured the whole render context re-ran on every tick
   (Reanimated subscribes to every SharedValue reachable from a closure). Now they capture a
   clock-free context.
4. **Switch trims**: one sweep gradient per entering ring (p95 150 ms at 800). Now off-screen
   rings are culled.
5. **The crash**: SIGSEGV in RN Skia `JsiHostObject::get` → `createFromHostFunction` on the JS
   thread when ~1 900 label paragraphs were rebuilt (mount / focus). Paragraphs are now cached;
   0/5 crashes after (3/3 and 5/5 before). Root cause inside RN Skia/Hermes is inferred.

Not a bottleneck on this target: label recording (≤ 0.6 ms), the bodies picture (2–4 ms at 800),
GPU (p50 7–24 ms in every row, emulator noise), label allocation's collision passes after the
index fix.

## 2. What was fixed (and how it was checked)

| Change | Before → after (emulator, relative) | Commit |
|---|---|---|
| Stress seed 400/800 + probe + deep links + harness | — (instrumentation) | `bba4cf5b`, `83c9033a` |
| Clock-free worklet context | trim / switch-FX / star placements no longer run per tick at rest | `83c9033a` |
| Allocation index; satellite maps | alloc 61.7 → 0.6 ms (800 pan) | `83c9033a` |
| Paragraph cache | 800-body crash 3/3 → 0/5 | `83c9033a` |
| Wakes: cam split, motion gate, flat uniforms, LOD 160 | wakes 68 ms → off (800), 15.2 → 6.8 ms (120 pan), 12.6 → 1.1 (120 focus) | `83c9033a` |
| Flow LOD 160 (stable array when off) | ring picture no longer re-records per tick on 400/800 | `83c9033a` |
| `projectFrame` hoisted constants (bit-identical) | frame 35.7 → 3.4 ms (800), 19.6 → 1.7 (400) | `89c2f1dd` |
| Ring + trim screen culling | trim p95 150 → 10 ms (switch into 800) | `89c2f1dd` |
| Idle clock (pausable frame callback) | RM idle 190 → 0 frames / 10 s; C-29 resolved | `bba4cf5b` |
| Opaque canvas default ON | 28 → 60 fps presented (SurfaceFlinger), overlays OK | `80852701` |
| Sun glow cap (dark themes) | Standard Dark glass `textSecondary` model 4.42 → 4.45 (sun no longer the brightest pixel) | `80852701`, `7c3ec0e6` |
| Text-only label defocus, floor 0.66 | defocused label model 2.2–2.9 → ≥ 4.95:1 | `80852701`, `7c3ec0e6` |
| Focus-card occlusion (glass untouched) | ghost glyphs under the card gone (`shots/01`) | `2d043162` |
| Body point LOD (flag) | guard only: bodies stay ≈ 7 dp at MIN_ZOOM | `2d043162` |

Gates at the end: `tsc --noEmit` clean, full vitest 551 files / 6 237 tests green, check:colors
clean, Biome clean on touched files.

## 3. Legibility (ADR-149-style numbers)

Method (`tools/r1-contrast.py`, `tools/r1-legibility.sh`): static reduced-motion scene (Dense,
focus on a body next to the sun, identity zoom) in all four themes. **Model** = surface (glass
tint 0.91 / 0.87, or label plate 0.90 / 0.94) composited over the extreme raw pixel under the
element (labels: from a labels-off twin capture; glass: the scene's extreme raw canvas pixel, as
ADR-149 assumes), versus the text token. **Measured** = rendered text vs rendered backdrop inside
the text box (glyphs dilated out). Raw captures were analysed losslessly (PNG) then kept as JPEG;
numbers in `evidence/09-r1/legibility/{before,after}/contrast-results.tsv`.

| Theme | Glass textSecondary (model) before → after | Glass text (measured, worst) | Focused label (model) | Defocused label (model) before → after |
|---|---|---|---|---|
| Galaxy Dark | 4.51 → 4.51 | 13.97 | 11.0 | 2.24 → 5.72 |
| Galaxy Light | 5.56 → 5.56 | 14.30 | 13.9 | 2.82 → 4.95 |
| Standard Dark | **4.42 → 4.45** | 13.09 | 10.7 | 2.23 → 5.65 |
| Standard Light | 5.10 → 5.10 | 13.38 | 14.6 | 2.90 → 5.08 |

- **Standard Dark glass `textSecondary` still 4.45 (model)**: the extreme pixel is now the
  initials glyph ink (`avatarSwatchText`, (241,243,247)), a palette token the ADR-149 proof set
  (textPrimary + starPalette) never included — it exists on the legacy Orrery too. Owner bucket
  (C-02); no token or overlay opacity was retuned.
- Measured label ratios against the 98th-percentile backdrop read ~2:1 where a reticle bracket,
  a leader or a drift tether crosses the plate box — decoration beside the glyphs, not under
  them. Against the median backdrop: focused labels 14.4–16.4:1; defocused labels 4.87–5.53:1
  (light themes, captured with text-only dim at 0.62, before the 0.66 floor landed; the dark-theme
  defocused tags were not isolated by the twin diff in the after capture).
- **Dense readability at overview**: the layout spreads an 800-body System far beyond the Home
  pose and even MIN_ZOOM (≈ 20 bodies on screen, bodies ≈ 7 dp, `lod/01`–`03`); at overview the
  allocator already shows only the focused label. Readability is bounded by the layout and the
  zoom range, not the renderer — the point LOD stays a flag until a far-zoom design exists.

## 4. Remaining bottlenecks

**Expensive but salvageable**
- Frame projection is still O(N) object churn (spreads in `sampleWorldTransition`,
  `projectAnimatedFrame`, choreography sampling): 3.4 ms at 800 here. Typed arrays / one fused
  pass would cut it further; worth it only if the phone shows it.
- The fixed environment cost (full-screen nebula sample, star Atlas colour buffer per tick, lit
  sun) keeps lab all-on at a ~32 ms cadence on the TextureView path here; the opaque canvas
  hides it on the emulator. Phone + Perfetto decide.
- Wakes and flow on dense Systems are LOD'd away rather than made cheap; a single-shader wake
  (canvas-rotated arcs) would bring them back if the owner keeps them (C-17, C-04).
- The bodies picture creates one runtime shader per visible body per changed frame (2–4 ms at
  800); a photo texture atlas (DEAD-ENDS WP-1.2 idea) is the next step if a phone needs it.
- Label paragraphs are still Skia host objects created on the JS thread; the cache removed the
  churn, not the per-label cost of the first build (~2 s debug at 940).
- Legacy renderer: its per-frame ring paths make it unusable past ~120 bodies — salvageable
  only by the lab's layer-picture rewrite.

**Fundamentally unsuitable (as built)**
- Declarative per-entity RN Skia components with animated props at 100+ bodies (already shown
  by the switch-stall work; R1's legacy rows confirm it at 400/800).
- Any per-tick re-record that scales with N (the pre-R1 flow / wake / trim pattern): with RN
  Skia pictures, animation that touches every entity must live in a shader uniform or be LOD'd.
- Unbounded Skia host-object churn on the JS thread (the crash): V2 must cache or batch
  paragraph creation.
- The emulator cannot answer GPU-fill, thermal or absolute frame-time questions at all.

## 5. Phone pass

`research/PHONE-PASS-SCRIPT.md`: arm64 builds, the same matrix via env-configured tap targets,
Perfetto (main / RenderThread / mqt_v_js / FrameTimeline), framestats, SurfaceFlinger latency for
the opaque canvas, meminfo, a 10-minute thermal/battery soak, and fill-in tables. Local adb
server (5037) only, and only after the owner releases the phone.
