# Lab B — Decisions (chronological)

This is the story of the experiment: what was tried, and why choices changed. The full
per-item record, with every number, is `research/DECISIONS-LOG.md`. The compromises are
C-01…C-70 in `research/COMPROMISES-LOG.md`. All device work ran on the **emulator**.

## 0. Research and direction (`8c7df728`)

- **Research 01** mapped the Orrery data flow, renderer, invariants and seams at
  `34920925`.
- **Research 02** catalogued RN Skia 2.6.2 from installed source. Its key fact: **any
  SharedValue change replays the whole canvas command list**, and React changes re-record on
  the JS thread. That decides every cost class.
- **Research 03** chose the direction "Deep Field Cartography": a physical register plus an
  instrument register. It verified four corrections against the code:
  1. The worklet-order guard was not recursive.
  2. The `orrery-scene.test.ts` mock (Skia = `{}`) forbids import-time `RuntimeEffect.Make`,
     so effects must be lazy.
  3. During a switch, `pose` ≠ the displayed camera, so effects must read `frame.value.pose`.
  4. The `frame` worklet must not gain casual captures (frame-mapper test).
- It pre-registered 20 compromises (C-01…C-20) and 5 owner-glance items.

## M1 — first integrated Deep Field

| WP | Decision | Why |
|---|---|---|
| 1.0 (`c8a82eaf`) | **The seam is `OrreryWorld`'s return.** The model half is shared, and lab ↔ legacy is switchable live. | Same-build, same-data A/B for visuals and perf. Legacy tests stay meaningful. |
| 1.0 | Parity port with **no per-body saveLayer**, O(1) `frameIndex` lookups, initials as glyph `Text`. | A clean baseline. Found the **Hermes `Intl.Segmenter` initials bug** (C-23). |
| 1.0 | Lazy `getLabEffect` loader, warm-up, the flag registry, the applicationId-gated panel (C-08), the reduced-motion override (C-21). | Measurable, toggleable, fallback-safe. |
| 1.1 (`54188b10`, `79cc89eb`) | **Bake densities, colour at sample time.** Periodic noise gives a seamless tile. | A theme change never rebakes, the sky hue is a uniform and intensity is live. |
| 1.1 | **Far stars moved from a 760-sprite Atlas into the nebula shader.** | The Atlas doubled gfx p50 on the emulator. |
| 1.1 | **Live fbm demoted to an A/B flag.** | Same look as the bake, much more cost. |
| 1.1 | The sky rotates about the **viewport centre**, not the sun (C-27). | A yaw is a camera roll about the projection centre. Rotating about an off-screen sun swung the whole sky. |
| 1.2 (`469440db`, `0922d223`, `0f888524`) | **One shader draw per body:** a circle of 1.3 r painting the lit disc plus the atmosphere. The disc edge is exactly r. | Hit, label and focus geometry unchanged; one primitive per body. |
| 1.2 | **Packed `float4` uniforms.** | Scalar uniforms doubled p50, because RN Skia resolves uniforms by name and rebuilds each shader per replay. |
| 1.2 | **Cheap 3-circle moons by default.** | Per-moon shaders cost about 14 ms for detail no one can see. |
| 1.2 | A stellar self-sun (C-31), an emissive photo sun, and status materials replacing the outline (C-16). | "Worlds, not avatars." |
| 1.3 (`ff7ddbdd`, `387b20c8`) | **One plane homography for the whole instrument layer.** Rings are circles under one matrix. | Rings fell to the "rings-off" cost floor. The legacy per-frame Path was the dominant frame cost. |
| 1.3 | Wake and tethers as stroked static paths → **reverted** (`eb860615` → `41495969`). Replaced by per-ring shader circles and rotated rects. | Ganesh re-tessellates stroked paths every replay (+56 / +12 ms p50). |
| 1.3 | Hairline status classes that **keep the weight order** (C-35); density fade (C-36); HUD-tag labels with exact plate geometry. | Instrument register; legibility. |
| 1.4 (`80a9650b`, `7c464176`) | **Release over seeded debug** (same debug keystore). 16 fictional test portraits seeded. | Honest perf builds; a real face check. |
| 1.4 | Lab vs legacy in release: about 6× more frames. | Legacy is ring-path-bound. |

**M1 critique** (`research/M1-CRITIQUE.md`): the world now reads as a game map, but the UI on
top still reads as a productivity app. The ugliest elements, in order:

1. the companion popover over the focused body;
2. the thick accent focus ring;
3. the chrome stack;
4. giant flat initials.

## M2 — switch showcase, focus, feedback

| WP | Decision | Why |
|---|---|---|
| 2.1 (`30026fda`, `413d6999`) | **One pure switch signal** (`sampleSwitchSignal`); every effect a pure function of (signal, roles, frame). Choreography constants unchanged. | Pause, remount and retarget are correct by construction. |
| 2.1 | Ring unwind/draw-on as **one UI-thread picture per frame**, not a component per ring. | ~130 components froze the debug UI thread for ~9 s. |
| 2.1 | **Per-System sky hue** (C-05, owner glance). | A visual identity for each System. |
| 2.1 | `ringPaths` projection skip in the model half. | 678–801 ms → 6–7 ms per switch frame at 141 bodies (instrumented, emulator). |
| 2.1 | Debug iteration moved to **release builds**; deep links and slow-mo added (C-46). | Debug JS took > 7 s per System load. |
| 2.1 | Displacement shock filter kept as an experiment, flag off. | Beautiful in slow-mo, cost unknown. |
| stall (`ea137306`, `038a8d97`, `3c0f691b`) | Root cause of the 3–7 s big-switch freeze, present on both renderers: **the shared frame worklet captured `switchRuntime` and `scene`**, so every OrreryScreen render restarted the mapper and deserialised the graph on the UI thread. Fixed in the model half. | It was pre-existing, not Skia `applyUpdates` (that hypothesis was disproved by measurement). |
| stall | **Layer pictures** (bodies, labels, rings) replaced per-entity components; `memo(LabBRenderer)`. | 3 193 bound SharedValues → 47. Declarative per-entity Skia does not scale. |
| 2.2 (`11c21745`, `0acdc848`) | **Target-lock reticle** with seek→lock tied to `camera.active`; **world response** via the spare `uK.w` uniform; feedback pings, ripples and north flare; reorder hold language; **focus-card anchoring**; HUD chrome; **Standard chart identity** (C-52…C-58). | Fixes M1-critique items 1–2. Standard Dark had looked identical to Galaxy Dark. |
| 2.2 | The System name keeps its case; card actions share one wrapping row. | Uppercase truncated names; stacked actions were clipped under the cap. |

## R1 — performance envelope and legibility (`bba4cf5b` → `7c3ec0e6`, `df04d0bd`)

- **Stress seed 400/800 and a perf probe.** Measure first: the envelope broke at about 400
  bodies and crashed at 800+.
- **Fixed in shared code:**
  - O(N²) allocation and satellite lookups;
  - `projectFrame` per-body constants (bit-identical);
  - a **paragraph cache that fixed the 800-body Hermes SIGSEGV on both renderers** (root
    cause inferred, C-63).
- **Fixed in the lab:**
  - clock-free worklet contexts;
  - wake gating and LOD;
  - flow LOD at 160 rings (C-59, C-60);
  - ring and trim culling;
  - the **idle clock** (C-64: reduced motion → 0 frames).
- **Opaque canvas default ON.** 60 vs about 28 fps presented on the emulator. It needs phone
  verification (C-07).
- **Legibility** (`tools/r1-contrast.py`):
  - A composite-aware sun glow cap on dark themes.
  - Text-only label defocus with a 0.66 floor (≥4.95:1 model).
  - Canvas occlusion under the focus card (C-61), rather than raising the card's opacity,
    which would reverse ADR-149's rejected "opaque cards".
  - Standard Dark glass `textSecondary` stays at **4.45:1 model**, bounded by the initials
    glyph ink, a token outside ADR-149's proof set. **Owner item, not retuned.**

## R2 — art direction and hero moments (`ff90df99`, `bfc8f36c`)

- **The art review of R1** found three problems. Home at tilt 0 read as a radar target, the
  sun lit nothing, and overview bodies were pins.
- **Defaults ON for the owner's glance:**
  - `homeTilt` 0.56 rad (C-66; changes Home);
  - `planeLight` sun pool (ship);
  - `planeGrid` gravity well (simplify; C-67);
  - `ringSunLight` (C-68);
  - `bodySizeFloor` (C-69).
- **Hero experiments, flag off:**

  | Experiment | Verdict |
  |---|---|
  | Bloom | Beautiful but too costly |
  | Shock filter | Failed |
  | Lens flare | Simplify to the streak |
  | Tilt-shift | Failed (blurs faces) |

  (C-70.)
- **Not changed:** choreography constants, focus lock, labels/allocation, reorder, theme
  tokens, reduced motion.

## R3 — integration polish (`13c706ad`, `1c339064`, `23bedb9c`, `883b84ed`)

| Decision | Why | SHA |
|---|---|---|
| Presets (Lab B best = registry defaults = Reset, Ship-safe, Everything, Legacy), one tap in the panel and `preset=` by deep link; debug instrumentation keeps its value | One-glance owner comparison and a fixed phone-pass matrix. Ship-safe membership is a lab judgement (C-73) | `13c706ad` |
| `nearSizeClamp` default ON: perspective size growth knee'd at +6 %, drawn radius soft-capped at 8 % of the short side (9.5 % in iteration 1 was still a disc under the FAB), applied to the frame | Near bodies at detail zoom with the Home tilt slid under the FAB column. Applying it to the frame keeps hits, labels, reticle and card keep-out consistent (C-71) | `13c706ad` |
| `immersiveChrome` default ON: the map runs under a floating `ShellAppBar` on a nested-band token scrim (abutting bands drew seams in iteration 1); the bar's hairline is clipped; the three controls become one HUD rail | The map should continue under the title. Shell-level pieces (status band, tab bar, "+") are out of scope (C-72) | `13c706ad` |
| Fix: `moonShader` + layer pictures used `makeShaderWithChildren` without children → `makeShader`; the Skia test mock now throws like native | "Everything" crashed the app | `1c339064` |
| Home tilt applies to the lab renderer only | The Legacy preset showed a tilted legacy map; Legacy must equal production | `23bedb9c` |
| Legibility re-measured with the stage on: no regression; Standard Dark glass stays 4.42 (model) | R1 method, `tools/r3-legibility.sh` | `883b84ed` |
| Nothing retuned in the earlier rows. Defaults now = "Lab B best" (all R2 defaults + the two R3 flags) | — | — |

## Final validation (`adeb4576`)

| Decision | Why |
|---|---|
| Polaris tap is not broken, so no code change | Legacy and lab both rotate to north (dossier D-08-069: tap resets yaw only). R3's "no rotation" was a recording that started after a recovery of 180–850 ms had already finished (FINAL-VALIDATION §1) |
| The "Unavailable System" selector label after a cold start is listed, not fixed | Pre-existing on `main` in the shared store/screen; production code, not this experiment |
| Contract exercise list validated on release + preset best; pinch, twist and tilt are delegated to the phone pass | adb injects a single pointer only |

## Phone pass (Pixel 6 Pro, 2026-10-01)

| Decision | Why | Commit |
|---|---|---|
| Measure the opaque canvas by **SurfaceFlinger presents** (`tools/sf-sampler.py`, union of `--latency` polls; highest layer id), with `SF=1 OPAQUE=1` in `r1-perf.sh` | gfxinfo cannot see the SurfaceView; `--latency` keeps only ~1 s at 120 Hz | `25f82cdf` |
| Add a `notilt` row to the matrix | Isolation showed the Home tilt as the switch between 3–9 and 92–99 fps at Dense | `25f82cdf` |
| **Opaque canvas stays default** | It beats TextureView on the phone (5.9 vs 1.5 fps in a GPU-bound sample); the overlays composite | — |
| **The tilted-ring cliff is not patched in the lab**; it is handed to V2 as a must-fix (analytic ovals or one ring shader) | It is a draw-strategy rewrite of the ring, wake and trim layers, not a phone-only bug. A one-line plain-saveLayer workaround was tried and did not help (DEAD-ENDS) | — (reverted A/B build) |
| The 10-min soak was cut to 5 min, and the Everything soak was skipped | The phone battery fell from 30 % to 7 % on USB during the pass | — |
| Perfetto analysis runs `trace_processor` on droid | This box's CPU (no AVX2) crashes the prebuilt | — |
