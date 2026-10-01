# Lab B — Harvest

This lists every idea that worked, in a form a V2 phase can lift. State is `883b84ed` (R3
rows added: H-C26–H-C28, H-E7; H-D5 updated by the final validation). The **Pixel phone pass
is pending (the Pixel is in use by Lab A)** and may change a verdict or a cost.

## How to read this

**Verdict**

| Value | Meaning |
|---|---|
| **SHIP** | Worth shipping as is (after productionization). |
| **SIMPLIFY** | Worth keeping in a cheaper or smaller form. |
| **COSTLY** | Beautiful but too costly. |
| **OWNER** | Needs an owner decision first; see `OWNER-REVIEW.md`. |

**Readiness**

| Value | Meaning |
|---|---|
| R0 | Production-quality and testable today. |
| R1 | Sound, but needs cleanup or tests to ship. |
| R2 | A lab-grade prototype. |

**Perf.** Every perf figure is **emulator-relative** (a desktop GPU behind a GLES
translator) and never a phone claim.

**Deps.** No item adds an npm dependency. The only added assets are the dev-only test
portraits (ASSET-MANIFEST).

---

## A. Shared-code fixes that help the CURRENT production Orrery (do these first)

These live in the shared model half (`OrreryWorld.tsx`, `src/logic/*`). They apply to the
**legacy renderer that ships today** and do not depend on any lab visual.

### H-A1 Frame-worklet closure-capture fix — **SHIP, R0**

- **Value.** This removed a **3–7 s main-thread freeze at the start of every switch between
  large Systems, on BOTH renderers**. Before, `withTiming` is wall-clock, so the user saw only
  the end of the switch.
  - The `frame` derived value captured `switchRuntime` (a new object every render, carrying
    `resources` → a scene per entry) and `scene`.
  - So every `OrreryScreen` render (6–11 per switch) restarted the mapper and deserialised
    the graph on the UI thread, at 0.6–0.8 s each.
- **Where.**
  - `src/components/orrery/OrreryWorld.tsx`: destructured `switchTransition` /
    `switchProgress` / `switchCameraFrom` / `switchCameraTo`, `sceneGeneration`,
    `sceneExtent`, `memberIdentities`, the stable `NO_IDS` / `NO_RELATIONS` /
    `NO_SATELLITES` defaults, and content-keyed `clusterIds`;
  - the tap and north worklets capture the same small data;
  - `orrery-frame-mapper.test.ts` gets an updated capture map.
- **Commit.** `ea137306`
- **Perf.**

  | Renderer | Skipped frames per big switch, before → after |
  |---|---|
  | Lab | 216–371 → **0** |
  | Legacy | 216–427 → 33–120 (the rest is legacy's own ring-path cost) |

  The longest frozen interval went from 3.8–4.9 s to 0.17–0.18 s.
- **Evidence.**
  - `evidence/07-switch-stall/05-sheet-inner-to-dense-before-vs-after-normal-speed.jpg`;
  - `01/02-BEFORE-*.mp4` vs `03/04-AFTER-*.mp4`;
  - `15-gfxinfo-summary.txt`;
  - `research/SWITCH-STALL-INVESTIGATION.md`.
- **Preserve.** The **rule**: worklet closures capture only SharedValues and small,
  identity-stable data. Never a scene, a resources list, a context object or a fresh
  `{}`/`[]` default. Keep the capture-map test as a guard.
- **Note.** `ea137306` touches only `OrreryWorld.tsx` and the frame-mapper test, so it is
  close to cherry-pickable. Its context lines include lab imports, so port it by hand. The
  other shared fixes come from mixed commits that also change lab files:
  - `83c9033a`: port the `OrreryWorld.tsx` and `orrery-satellite-logic.ts` hunks only;
  - `89c2f1dd`: port the `orrery-camera-logic.ts` (+ test) hunks only.

### H-A2 Prepared-paragraph cache — **SHIP, R0**

- **Value.** It **fixed a native Hermes crash** (SIGSEGV in RN Skia `JsiHostObject::get` →
  `jsi::Function::createFromHostFunction`, JS thread). The crash killed the app whenever an
  800/940-body System mounted or a focus rebuilt every label, on **both renderers**:
  3/3 and 5/5 crashes before, 0/5 after.
  - Every focus, cluster or scene change used to rebuild a Skia Paragraph per label (about
    1 900 at 940 bodies).
- **Where.** `OrreryWorld.tsx`, `textCache` + the `labels` memo. The key is
  `role|width|text`, scoped to provider / colours / fontScale. Unused entries are dropped and
  left to GC, never disposed, because an older canvas may still hold them.
- **Commit.** `83c9033a`
- **Perf.** No more Paragraph churn on focus. The first build is still about 2 s debug at
  940.
- **Evidence.** PERF-LOG R1 ("800 focus/switch in: CRASH → 216/18/69, 204/18/73");
  `evidence/09-r1/perf/A-baseline` vs `C-after2`.
- **Preserve.** Never rebuild native text objects for unchanged text. The root cause inside
  RN Skia/Hermes is **inferred, not proven** (C-63). Re-test at 800+ on ARM in the phone
  pass.

### H-A3 O(N) label-allocation lookups and satellite derivation — **SHIP, R0**

- **Value.** Label allocation did `bodies.find(bodyKey(b) === label.id)` per label, which is
  O(N²) key builds per frame change (JSON keys for moons). `deriveSatelliteBodies` did
  `some` / `find` / `includes` per row.
- **Where.**
  - `OrreryWorld.tsx` `allocations`: one `byKey` index per run, first match wins exactly like
    `find`;
  - `src/logic/orrery-satellite-logic.ts`: `memberKeys`, `parents`, `seen` maps.
- **Commit.** `83c9033a`
- **Perf.** Allocation 61.7 → 0.6 ms per pan frame at 800, and 15.8 → 0.4 ms at 400.
- **Preserve.** Same results, same order. The existing tests stayed green.

### H-A4 `projectFrame` per-frame constant hoisting — **SHIP, R0**

- **Value.** `projectFrame` used to call `projectionCenter` → `usableCameraRect` (obstacle
  region splitting + sort) **per body**, and built `cameraPlane` four times per body. Now
  those constants are computed once per frame. The output is **bit-identical** (same float
  operations, same order; pinned by new `orrery-camera-logic.test.ts` cases).
- **Where.** `src/logic/orrery-camera-logic.ts` `projectFrame`.
- **Commit.** `89c2f1dd`
- **Perf.** Frame projection 35.7 → 3.4 ms at 800 bodies, 19.6 → 1.7 ms at 400, 5.8 → 0.7 ms
  at 120 (UI-thread probe).
- **Preserve.** The bit-identical test. The remaining O(N) object churn (spreads in
  `sampleWorldTransition` / `projectAnimatedFrame`) is the next step only if a phone shows it.

### H-A5 Hermes `Intl.Segmenter` initials bug — **SHIP the fix, R1**

- **Value.** `src/logic/orrery-label-logic.ts` `orreryInitials` returns the **whole name**
  when `Intl.Segmenter` is missing. Hermes on the emulator lacks it (observed on device in
  WP-1.0).
  - So the production `OrbitBody` / `SunBody` draw the full name in a one-line ellipsised
    paragraph ("El…") instead of initials.
  - The code comment calls this an "older runtime" fallback, but it is the actual path on
    Hermes.
- **Where.** The lab works around it with `labInitials` in
  `src/components/orrery/labb/LabBodies.tsx`: the first **code point** of each of the first
  two words, upper-cased, single short words kept.
- **Commit.** `c8a82eaf`
- **Perf.** None.
- **Evidence.** M1 initials bodies such as `evidence/05-m1-checkpoint/11-focus-flyin-initials-cleo-okafor.png`
  vs the legacy A/B `28b`.
- **Preserve / what to do.** Fix it in shared code. Either:
  - (a) a code-point fallback in `orreryInitials` (combining marks and ZWJ emoji can split,
    C-23); or
  - (b) a grapheme polyfill.

  **Verify on the Pixel** that Hermes there also lacks `Intl.Segmenter`. It was only
  observed on the emulator build.

### H-A6 `ringPaths` projection mode — **SIMPLIFY (V2: drop `ringPath`), R1**

- **Value.** The frame worklet projected 128 `ringPath` points per contact on every changed
  frame. The lab never reads them.
- **Where.** `projectFrame(…, ringPaths)` / `projectAnimatedFrame(…, ringPaths)` and the
  `ringPathMode` capture in `OrreryWorld.tsx`.
- **Commit.** `30026fda`
- **Perf.** `projectAnimatedFrame` 678–801 → 6–7 ms per switch frame at 141 bodies
  (instrumented emulator UI runtime).
- **Preserve.** The legacy renderer *needs* the paths, so this helps production only once
  rings come from a homography (H-B3). For V2: remove `ringPath` from the frame entirely.

### H-A7 Canvas memo boundary — **SHIP (pattern), R1**

- **Value.** Every canvas commit in RN Skia 2.6.2 re-records the tree twice and
  synchronously re-reads every bound SharedValue. `memo(LabBRenderer, sameContract)` compares
  `switchRuntime` by its parts.
- **Commit.** `3c0f691b`
- **Perf.** Canvas commits per switch went from about 11 to 6–7.
- **Preserve.** Apply the same memo around the legacy `OrreryCanvas` children
  (SWITCH-STALL §6 says this applies directly).

---

## B. Renderer architecture (for V2)

### H-B1 Layer pictures: one UI-thread `SkPicture` per per-entity layer — **SHIP, R1**

- **Value.** This is the decisive architecture finding. Declarative per-entity Skia
  components with animated props do not scale to 100+ bodies.
  - **Before:** 3 193 bound SharedValues and 3 786 mappers on Dense 120.
  - **After:** **47 bound values and 85 mappers.**
  - JS-thread blocks per switch: up to 7.3 s → ≤ ~1 s.
- **Where.**
  - `labb/LabLayerPictures.tsx` (`LabBodiesPictures`, `LabLabelsPicture`, `LabPhotoProbes`);
  - `labb/labb-layer-plan.ts` (pure plans, `flattenUniforms` in SkSL order);
  - `LabRings.tsx` (`RingClassesPicture`, `WakesPicture`, `TrimRingPicture`);
  - `LabFocusFx.tsx` (reticle and feedback pictures).
- **Commits.** `038a8d97`, extended in `11c21745` and `83c9033a`.
- **Perf.** Bodies picture 2–7 ms per changed frame at Dense, 3.9 ms at 800.
- **Evidence.** `evidence/07-switch-stall/07-ab-identity-tilt-max-pictures-vs-components.jpg`,
  `13-…`, `14-…` (visually identical A/B).
- **Preserve.**
  - Return the **same** empty picture object when idle, so the write is a no-op.
  - Keep the photo probes outside the canvas.
  - Keep plans pure and testable.
  - Keep the bound-value count in the tens.
- **Open.** Image shaders are left to GC (C-50). A photo texture atlas or a deferred dispose
  is needed.

### H-B2 Idle clock (pausable ambient clock) — **SHIP, R1**

- **Value.** An untouched Orrery under reduced motion, or with every ambient effect off,
  draws **0 frames** (it was 190 per 10 s). It also makes reduced-motion stillness free.
- **Where.** `labb/LabCanvas.tsx` `useLabClock` (`useFrameCallback(tick, active)` with a base
  offset) and `labb/labb-clock-logic.ts` `labAmbientNeeded`.
- **Commit.** `bba4cf5b`
- **Evidence.** PERF-LOG R1 idle table; `evidence/10-r2/06-final/09-reduced-motion-static.jpg`.
- **Preserve.** Every non-ambient animation (switch, focus, feedback, recovery) drives its
  own SharedValues, so pausing the clock is safe. The legacy Orrery's clock runs regardless,
  so this would also help production.

### H-B3 Plane homography for all instrument geometry — **SHIP, R1**

- **Value.** `projectWorldPoint` is an exact plane homography. A single 3×3 per frame turns
  rings, wakes, tethers, ticks, the chart, the shockwave and the ripples into **static world
  geometry** (circles and rects). They are exact under any tilt and yaw.
- **Where.** `labb/labb-rings-logic.ts` `planeHomography` / `applyHomography`.
- **Commit.** `ff7ddbdd`
- **Perf.** 120 instrument rings cost the **same as rings off** (48 ms p50, 213 vs 212
  frames). The legacy per-frame 128-pt Path cost 4–5× the frames.
- **Evidence.**
  - `evidence/04-wp1.3/08-pass2-overview-dense-final.png`;
  - `05-tilt-max-depth-fade-dense.png`;
  - `evidence/05-m1-checkpoint/28c-ab-legacy-left-vs-lab-right.png`.
- **Preserve.**
  - Circles, rects and shaders; **never stroked paths re-tessellated per replay**.
  - Stroke width `dp/zoom`.
  - Tested exactness against `projectWorldPoint` and `ringPath[0]`.
- **Open.** Perspective cost under tilt was never timed, and Home is tilted since R2.

### H-B4 Lazy, memoised, null-safe runtime-effect loader + uniform contract test — **SHIP, R0**

- **Where.** `labb/labb-effects.ts` `getLabEffect`, `labEffectStatuses`, `zeroUniforms`.
  The tests check that every declared uniform is supplied and finite.
- **Commit.** `c8a82eaf`, `0922d223`
- **Preserve.**
  - Nothing compiles at import time (tests mock Skia as `{}`).
  - Every consumer has a flat fallback.
  - The force-fallback toggle makes the fallback demonstrable.

### H-B5 Packed `float4` uniforms — **SHIP (rule), R0**

- **Value.** RN Skia resolves uniforms by name, through a JSI call each, and rebuilds every
  shader on every replay.
- **Commit.** `0922d223`
- **Perf.** p50 65 → 48 ms for about 190 bodies; with cheap moons, 34 ms, which is about the
  same as flat discs.

### H-B6 Clock-free worklet context — **SHIP (rule), R0**

- **Value.** Reanimated subscribes a derived value to every SharedValue reachable from its
  closure. Worklets that captured the whole context re-ran every tick.
- **Where.** `labb-context.ts` `LabStillContext`.
- **Commit.** `83c9033a`

### H-B7 Pure switch signal and pure-function effects — **SHIP, R1**

- **Value.** Pause, remount mid-switch, resume and retarget are correct by construction. No
  wall-clock state.
- **Where.**
  - `src/logic/orrery-switch-choreography.ts`: `sampleSwitchSignal`, `sampleSwitchEntry`,
    `entryWindow`, sharing `sampleEntryAt`;
  - `labb/labb-switch-logic.ts`.
- **Commit.** `30026fda`
- **Preserve.** The choreography constants were not changed. Tests prove determinism and
  agreement with `sampleSwitchChoreography`.

### H-B8 Density LODs and screen culling — **SHIP, R1**

- **What.**
  - Wakes and flow are off above 160 rings (C-59, C-60).
  - Wakes hide during camera recoveries.
  - Rings and switch trims skip rings that cannot touch the screen (`ringOnScreen`).
- **Commits.** `83c9033a`, `89c2f1dd`
- **Perf.** Trim p95 150 → 10 ms switching into 800; wakes 68 ms → off.

### H-B9 Opaque canvas (SurfaceView) — **OWNER/PHONE, R2**

- **Value.** On this emulator, presented frames went 27.4–27.8 → **60.0 fps**. Overlays, the
  focus card, tab switches and screenshots still composite.
- **Flag / commits.** `opaqueCanvas` (default ON since `80852701`; flag `bba4cf5b`).
- **Evidence.** `evidence/09-r1/shots/02`, `03`.
- **Preserve.** Measure with SurfaceFlinger, not gfxinfo. **This needs the phone** (C-07): if
  the TextureView halving is an emulator artefact, the win may vanish.

### H-B10 Shader warm-up at mount — **SHIP, R1**

- **Value.** No first-switch compile hitch. The cold first switch measured p50 17 / p90 40 /
  p99 117 ms, the same as warm switches.
- **Where.** `LabCanvas.tsx` `WarmUp` plus per-FX-layer probe instances while `ctx.warm`.
- **Commit.** `c8a82eaf`, `30026fda`
- **Evidence.** `evidence/06-wp2.1-switch/01-first-switch-after-cold-launch-work-to-inner-normal-speed.mp4`.

---

## C. Visual ideas

| # | Idea | Verdict | Readiness | Where / commit | Perf (emulator) | Evidence | V2 should preserve |
|---|---|---|---|---|---|---|---|
| H-C1 | **Baked tiling nebula: densities baked once, coloured at sample time** | SHIP (OWNER C-01: departs from the art-free Orrery background, ADR-114/179) | R1 | `LabEnvironment.tsx` `NebulaBaked`, effects `nebulaBake`/`nebulaSample`; `54188b10`, `79cc89eb` | ≈ free vs environment off (18 vs 17 ms p50) | `evidence/02-wp1.1/01-overview-dense-galaxy-dark.png`, `05-m1-checkpoint/28c` | Periodic noise (seamless tile); colour as token uniforms (no rebake on theme or sky hue); bounded drift; reduced-motion freeze |
| H-C2 | **Analytic far stars in the nebula pass** | SHIP | R1 | `NEBULA_FAR_STARS` in `labb-effects.ts`; `79cc89eb` | Replaced a 2×-cost Atlas | `evidence/02-wp1.1/03-near-zoom-4-galaxy-dark.png` | One star per sky cell, Gaussian disc in screen dp |
| H-C3 | **Single parallax rule from the animated frame** | SHIP | R0 | `labb-sky.ts`; `54188b10` | — | `02-wp1.1/05`, `06`, `07*.mp4`, `09*.mp4` | Read `frame.pose`, never `pose` (switch-correct); yaw about the viewport centre |
| H-C4 | **Lit photo worlds** (one draw per body: lit disc + atmosphere, exact radius) | SHIP (OWNER C-16/C-30 for status look and face darkening) | R1 | `BODY_LIT`, `bodyPhoto`; `labb-bodies-logic.ts`; `469440db`, `0922d223` | +2 ms p50 / +14 ms p90 vs flat discs | `05-m1-checkpoint/18`–`23`, `M1-CRITIQUE §Faces` | Light floor ≥0.55 dark / 0.75 light; disc edge at exactly r; status rim stays crisp |
| H-C5 | Procedural "world" surfaces for photo-less contacts | SIMPLIFY | R2 | `bodyProcedural` | — | `05-m1-checkpoint/11`, `12` | M1 critique: giant flat initials on marble read as a placeholder. Use smaller etched initials and more surface identity. |
| H-C6 | **Stellar sun + corona; emissive photo sun** | SHIP (OWNER C-31 for the self-sun replacing the avatar swatch) | R1 | `sunStar`/`sunPhoto`, `SUN_CORONA`; `469440db` | Part of the full-screen-class GPU cost; phone needed | `03-wp1.2/09`, `12`; `05-m1-checkpoint/06`–`08` | The photo is never darkened; status corona per `resolveSunOccupant`; reduced motion static |
| H-C7 | **Composite-aware sun glow cap (dark themes)** | SHIP | R1 | `SUN_GLOW_CAP_DARK` 0.94; `80852701`, `7c3ec0e6` | — | `09-r1/shots/05-sun-glow-cap-standard-dark-before-after.jpg` | The sun is never the brightest pixel under glass |
| H-C8 | Cheap lit moons (3 circles) | SHIP | R0 | `LabLayerPictures.tsx` `drawMoon`, `LabMoon`; `0f888524` | Saved ≈14 ms p50 vs shader moons | `05-m1-checkpoint/18`, `20` | — |
| H-C9 | Lab Polaris (halo + diffraction spikes) | SHIP | R0 | `LabPolaris.tsx`; `469440db` | — | `03-wp1.2/*` | Same hit semantics |
| H-C10 | **Hairline instrument rings with status classes + shader dashes + far-side fade** | SHIP (OWNER C-35: lower absolute ring contrast) | R1 | `ringInstrument`, `ringInstrumentClass`; `ff7ddbdd`, `387b20c8` | Free (rings-off floor) | `04-wp1.3/08`, `05`, `10e` | Keep the **weight order** (CVD channel); integer dash count per circumference (no seam) |
| H-C11 | Ring density fade | SHIP | R1 | `ringDensityFade`; `387b20c8` | — | `04-wp1.3/07a` vs `07b` | Floor 0.35 (C-36; maybe per-status floors) |
| H-C12 | Progress wake | OWNER (C-17) | R2 | `ringWake`, `WakesPicture` | 6.8 ms per 120 pan frame after R1; LOD'd off above 160 | `04-wp1.3/02`, `08` | If kept: one shader for all wakes (C-60) |
| H-C13 | Drift tethers (decay/rogue) | OWNER (C-17); the M1 critique liked them | R1 | `tetherRect`, `TetherClassGroup` | Free as rects | `05-m1-checkpoint/14`, `18` | They encode only what the drift already means |
| H-C14 | Ring energy flow (uniform comets) | OWNER (C-04) | R1 | `ringInstrument` flow; LOD 160 | Forces the ambient clock on | `04-wp1.3/09-flow-comets-overview-dense.mp4` | Same speed for every status; off under reduced motion |
| H-C15 | **HUD-tag labels** (exact plate geometry, scrim halo, status hairline, leader) | SHIP | R1 | `LabLabelsPicture`, `LabHudLabel`; `ff7ddbdd` | ≤0.6 ms recording | `04-wp1.3/10e-hud-tags-4-themes-gd-gl-sd-sl.png` | Positioned only from `allocations` (the tap contract) |
| H-C16 | **Text-only label defocus with a 0.66 floor** | SHIP | R0 | `LABEL_TEXT_DIM_MIN`; `80852701`, `7c3ec0e6` | — | `09-r1/shots/04-legibility-*`; `legibility/after/contrast-results.tsv` | ≥4.95:1 model contrast in all 4 themes |
| H-C17 | **Home tilt ≈32°** | SHIP the look (OWNER C-66: changes Home) | R1 | `labb-home-tilt.ts`; `ff90df99` | Not separable | `10-r2/before-after-overview.jpg`, `01-tilt-probe/sheet.jpg` | 0.56 rad (0.7+ crowds the far side under the pills). If kept: a product `HOME_CAMERA.tilt` + an ADR, and re-check the `deriveHomePose` fit. |
| H-C18 | **Sun light pool on the orbital plane** | SHIP (OWNER C-67 taste) | R1 | `stagePlane` in `LabStage.tsx`; `ff90df99` | Not separable on the emulator; a full-screen shader, so **phone** | `10-r2/04-iter3/art/`, `before-after-*.jpg` | Pool 0.32·extent with a tight core (0.55 turned the sky brown) |
| H-C19 | Gravity-well plane grid | SIMPLIFY (bake as texture or fold into the pool pass; maybe polar) | R2 | `stagePlane` grid; `ff90df99` | Shares the pool pass | `10-r2/04-iter3/art/02*` | Half-cell offset (no crosshair on the sun); alpha ≈0.05; Galaxy only |
| H-C20 | Rim-lit rings near the sun | SHIP (OWNER a11y C-68) | R1 | `ringInstrument` `uSpin.zw`; `ff90df99` | Two uniform floats | `10-r2/before-after-overview.jpg` | Status hue, weight and style untouched |
| H-C21 | Overview body size floor (≤1.4× under 12 dp) | SHIP (C-69) | R1 | `LabLayerPictures.tsx`; `ff90df99` | min/max per body | `10-r2/06-final/02-overview-dense.jpg` | V2: a semantic "min drawn radius" in the projection, label-gap aware |
| H-C22 | **Standard package identity: graphite sky + chart graticule** | SHIP (OWNER C-58 taste) | R1 | `LabChart.tsx`, `STANDARD_DARK_ENV`; `11c21745`, `0acdc848` | One picture, re-recorded on camera change | `08-wp2.2-focus/04-*`, `10-r2/06-final/07-overview-dense-standard-dark.jpg` | It encodes no data; R2-REPORT calls it the most "strategy-game instrument" frame |
| H-C23 | Per-theme effect profiles (intensity + additive/multiply physics) | SHIP (pattern) | R1 | `src/theme/orrery-lab-fx.ts`; `c8a82eaf` … | — | `05-m1-checkpoint/27-themes-*` | Standard Light ≈0.5× Galaxy Light (tested); OWNER C-15 for light-theme art direction |
| H-C24 | Lens flare: the **anamorphic streak only** | SIMPLIFY (OWNER taste) | R2 | `lensFlare` in `LabStage.tsx` | Full-screen shader now; a thin gradient rect would do | `10-r2/03-iter2/crop-sun-art-bloom-flare.jpg` | Dark themes only; drop the ghosts |
| H-C25 | Bloom look | COSTLY | R2 | `labBloomPaint` | Full-screen offscreen + blur every frame | `10-r2/final-hero-bloom-flare.jpg` | Harvest the *look* as baked per-element glows; maybe a sun-sprite-only bloom |
| H-C26 | **Near-body size clamp** (perspective growth knee +6 %, soft cap 8 % of short side, applied to the frame) | SHIP the rule (OWNER C-71, only matters with H-C17) | R2 (post-process) → R1 in the projection | `labb/labb-near-size.ts` `labClampNearSizes`, `OrreryWorld.tsx`; `13c706ad` | `frame` probe 0.8–1.0 ms, not separable | `11-r3/01-iter1/04-detail-dense.jpg` vs `02-iter2/04-detail-dense.jpg` | V2: a semantic max drawn radius inside the projection so hits, labels, reticle and keep-out agree by construction; sun exempt; keep the `MIN_HIT_RADIUS` floor |
| H-C27 | **Immersive Orrery chrome** (map under a floating title on a token scrim; HUD control rail) | SHIP (OWNER C-72 taste) | R1 | `labb/LabImmersiveHeader.tsx`, `labb-header-scrim.ts` (+ test), `OrreryControls` `rail`; `13c706ad` | Static views, no measurable cost | `11-r3/05-final/presets-02-overview-dense.jpg`, `11-r3/02-iter2/` | Nested top-anchored bands (abutting bands seam); bar stays an obstacle so framing is unchanged; title ≥ 9.9:1 model. Edge-to-edge needs a shell-level "immersive route" contract |
| H-C28 | **Presets** (best / ship-safe / everything / legacy) | SHIP as a dev/QA tool, not a user feature | R0 | `orrery-labb-fx-store.ts` `LAB_PRESETS`, `NOT_SHIP_SAFE`; panel + `preset=` link; `13c706ad` | Ship-safe p50 18–20 ms vs best 23–26 ms (emulator, relative) | `11-r3/05-final/presets-*.jpg`, `panel-presets.jpg` | A fixed matrix for the phone pass and owner review; membership is a lab judgement (C-73) |

## D. Interaction and motion ideas

| # | Idea | Verdict | Readiness | Where / commit | Perf (emulator) | Evidence | Preserve |
|---|---|---|---|---|---|---|---|
| H-D1 | **System-switch showcase**: streaks + sky push + corona flare + flow spool / dissolve + particles + ring unwind / comets + ring draw-on + capture flares / system-lock shockwave | SHIP (SIMPLIFY particles/comets if the phone p99 demands) | R1 | `LabSwitchFx.tsx`, `labb-switch-logic.ts`, `LabEnvironment.tsx` streaks, `LabRings.tsx` trims; `30026fda`, `413d6999` | During a switch: p90 +12–14 ms, p99 +65–85 ms; **0 idle cost**. Trim picture 15–24 ms per switch frame (top cost). | `06-wp2.1-switch/01*.mp4`, `20`–`24`, `27-sheet-*`, `28-sheet-*`; `10-r2/final-switch.jpg`; `07-switch-stall/03-AFTER*.mp4` | Pure functions of the signal; intensity scaling (no shockwave < 0.25); reduced motion = crossfade only; on-screen particle budget |
| H-D2 | Per-System sky hue | OWNER (C-05) | R1 | `systemSkyIndex`, `displayedSkyHue`; `30026fda` | A uniform | `06-wp2.1-switch/05-settled-inner-circle-galaxy-dark-gold-sky-hue.jpg` | Generation-ordered crossfade; decide hash stability across a re-key |
| H-D3 | **Target-lock reticle with seek→lock tied to the camera** | SHIP | R1 | `LabFocusFx.tsx`, `labb-focus-logic.ts`; `11c21745`, `0acdc848` | Not separable | `08-wp2.2-focus/10-release-focus-flyin-lock-ripple-ping.mp4`, `13-release-sheet-*` | `mix`/`keys` only in an effect keyed on focus identity; static once locked |
| H-D4 | World response (defocus others, focused atmosphere, vignette) | SHIP (OWNER C-52 a11y) | R1 | `BODY_LIT` `uK.w`; `11c21745` | — | `08-wp2.2-focus/07-debug-dense-120-focus-world-response.jpg` | The sun is never dimmed; reuses a spare uniform slot |
| H-D5 | Tap feedback: ping / plane ripple / Polaris flare | SHIP | R1 | `LabFeedbackPicture`; `11c21745` | No re-record at rest | `08-wp2.2-focus/09-debug-sheet-ripple-recenter-ping-seek-lock.jpg` | V2 needs a clean feedback event channel, not a side-stamp (C-20/C-54). North flare + north recovery captured on the emulator in R3 / final (`11-r3/03-paths/north-polaris-flare.jpg`, `13-final/01-polaris/best-polaris-tap-sequence.jpg`) |
| H-D6 | Reorder hold language (charge arc, held-ring glow, slot flash) | SHIP (OWNER C-55: one reorder language) | R1 | `LabFeedbackPicture`; `11c21745` | — | `08-wp2.2-focus/12-*`, `16-*.mp4` | Haptic unchanged; slot flash event-driven |
| H-D7 | **Focus-card anchoring** (keep-out box, side order, height cap) | SHIP | R0 | `src/components/orrery/orrery-focus-placement.ts` (+ test); `11c21745` | — | `08-wp2.2-focus/00-before-*` vs `01-*` | Fixes M1-critique item #1 (card over the focused body and label) |
| H-D8 | Focus-card occlusion of world detail (glass untouched) | SHIP (OWNER C-61) | R2 (lab module-level channel) | `labb-card-channel.ts`; `2d043162` | — | `09-r1/shots/01-focus-card-occlusion-off-vs-on-dense-eli.jpg` | Keep ADR-149's glass value; build a proper overlay-rect channel |
| H-D9 | HUD chrome (corner brackets, instrument radius) | SIMPLIFY (OWNER C-56 taste) | R1 | `OrreryHudCorners.tsx` + overlay `hud` props; `11c21745` | — | `08-wp2.2-focus/03-*`, `14-*` | Glass tint/opacity untouched; System name keeps its case |

## E. Tooling worth keeping for V2

| # | Tool | Where | Why |
|---|---|---|---|
| H-E1 | Per-worklet UI-thread probe | `labb-perf-probe.ts` (`bba4cf5b`) | Found every R1 bottleneck; one global read when off |
| H-E2 | Deep-link harness (`orbit://labb?flags/system/focus/theme/zoom/tilt/slowmo/rm`) + matrix scripts | `debug/LabFxPanel.tsx` `parseLabCommand`; `tools/r1-*.sh`, `r2-*.sh` | Repeatable device A/B without taps |
| H-E3 | ADR-149-style contrast tool (model + measured, glyph-dilated) | `tools/r1-contrast.py`, `r1-legibility.sh` | Re-prove legibility whenever the sky changes |
| H-E4 | Stress seed 400/800 through the real DAOs | `src/__dev__/lab-b-seed.ts` (`bba4cf5b`) | Exercises the real read/scene/world/label paths |
| H-E5 | Fictional test-portrait set | `assets/test-portraits/` | Face-legibility checks (never ship) |
| H-E6 | Recursive worklet-order guard + the Hermes default-parameter rule | `orrery-worklet-order.test.ts` | Prevents device-only crashes vitest can't see |
| H-E7 | Skia test mock that throws like native on a missing `children` array; path harness `tools/r3-paths.sh`; preset-aware `r3-legibility.sh` | `1c339064`, `13c706ad` | The mock's silent default hid the "Everything" crash until device |

---

## What production V2 should steal from Lab B (short list)

1. **Now, in shared code:** H-A1, H-A2, H-A3, H-A4, H-A5 (and H-A7 for legacy).
2. **The architecture:**
   - layer pictures (H-B1);
   - the idle clock (H-B2);
   - the plane homography for all instrument geometry (H-B3);
   - lazy null-safe effects with packed uniforms (H-B4/B5);
   - pure switch signal and effects (H-B7);
   - density LOD and culling (H-B8).
3. **The look:**
   - the baked nebula + analytic far stars (H-C1/C2), subject to the owner on C-01;
   - lit photo worlds (H-C4);
   - stellar sun with glow cap (H-C6/C7);
   - hairline instrument rings (H-C10/C11);
   - HUD-tag labels (H-C15/C16);
   - the sun light pool (H-C18);
   - the Standard chart (H-C22);
   - per-theme profiles (H-C23);
   - **a tilted Home** (H-C17), subject to the owner on C-66.
4. **The moments:** the switch showcase (H-D1), the target-lock reticle with world response
   (H-D3/D4) and focus-card anchoring (H-D7).

## R3 / final-validation updates

- Added H-C26 (near-size clamp), H-C27 (immersive chrome), H-C28 (presets) and H-E7.
- H-D5: the Polaris flare and the north recovery are now captured on the emulator. The
  shared tap → `camera.recover(northTarget)` path works in legacy and lab
  (FINAL-VALIDATION §1).
- No earlier verdict moved. Legibility with the R2 stage was re-measured with no regression.
  Standard Dark glass is 4.42 (model), still the OWNER C-02 gate for H-C1.

## PLACEHOLDER — phone updates (pending — Pixel in use by Lab A)

> _TBD: the phone pass must confirm or overturn H-B9 (opaque canvas), H-C18/C19 (full-screen
> stage shader on Mali), H-D1 switch p99, H-A2 (crash fixed on ARM), H-A5 (Segmenter absent on
> the Pixel's Hermes), the face-legibility glance for H-C4, and the Ship-safe vs best gap
> (H-C28)._
