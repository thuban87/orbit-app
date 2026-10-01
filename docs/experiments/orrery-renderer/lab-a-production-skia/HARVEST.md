# Lab A — Harvest

This lists every idea from Lab A that worked, with what a clean Orrery V2 (or main) should take from it.

**How to read it**
- Paths are relative to the repo root unless they start with `evidence/` or `_notes/` (relative to this folder).
- Commits are on `experiment/orrery-skia-production`.
- The architecture is in [ARCHITECTURE.md](ARCHITECTURE.md), file and function detail in [IMPLEMENTATION.md](IMPLEMENTATION.md), and numbers in [PERFORMANCE.md](PERFORMANCE.md).

**Readiness scale**

| Level | Meaning |
|---|---|
| **R1** | Lift as-is: semantics-preserving and test-pinned |
| **R2** | Lift with cleanup: lab gating, tunables, tests to re-home |
| **R3** | Re-implement from the idea; lab code is reference only |
| **R4** | Needs a decision or more device work first |

**Decision column.** It names any recorded decision (ADR, HANDOFF, dossier, D-NN) that adoption would **reverse or bend**. Those are **owner decisions**, never "just do it".

Note that *every* visual change is also an owner taste call under CLAUDE.md's "whose decision" rule. The column flags only collisions with *recorded* decisions.

---

## Part 1 — Main-line bug fixes: harvest regardless of direction

Main has the same frame worklet, switch runtime, canvas and label logic, so M1–M3 and M5 exist on `main` today: they were verified against `main @ 3492092` code. M4 is **inferred** from the lab's legacy renderer, not measured on main. M6 and M7 come from lab baseline evidence. None of these fixes depends on adopting any Lab A visual.

**Caveat on every "legacy" number in this package:** the legacy renderer measured in Lab A builds is **not main**. It ran with the 45° Home tilt and with M1–M3 applied. Main itself was never measured in release.

| # | Bug on main | Fix | Commit / files | Readiness | Decision |
|---|---|---|---|---|---|
| **M1** | **System-switch / focus freeze.** A 3–5 s main-thread block on large switches, then a jump. Focus taps get 0.7–1.4 s Daveys. | (a) The projection basis is hoisted out of `projectFrame`'s per-point loop (`projectWithBasis`, identical arithmetic, **bit-exact test**). (b) The frame worklet captures only shared values plus `{id, uid}` identities; `useOrrerySwitchRuntime` returns a memoised object; publish ships `world` + `generation` only; `orrery-frame-mapper.test` now **fails** on a `switchRuntime`, `scene` or `resources` capture. (c) An O(1) `frameBody` key index and `billboardMap`. (d) Memoised `OrreryCanvas` content and stable empty defaults in `OrreryWorld`. (e) Moon components are kept mounted while rows are withheld. | `ba3cef68` (`src/logic/orrery-camera-logic.ts` + test); `842f1f36` (`OrreryWorld.tsx`, `use-orrery-switch-runtime.ts`, `orrery-frame.ts`, `OrreryCanvas.tsx`, `SatelliteBody.tsx`, `ProjectedOrbitRing.tsx`, tests) | **R1** for (a)–(d). (e) needs a check against the D-09/D-11 satellite gate rules. | None. All are semantics-preserving. |
| **M2** | **Stale-camera snap at switch start.** When settled, `publish()` used `interpolateCamera(from, to, 1)` = the *previous* switch's `cameraTo`, so after any pan, zoom, recenter or cold-start Home the first switch frame snapped to an old pose. | `displayedSwitchCamera()` returns the live `pose` when settled and the interpolated camera while running. Three tests; two **fail on the old code**. | `20538bd1` (`src/components/orrery/use-orrery-switch-runtime.ts:95`, `orrery-switch-runtime.test.ts`) | **R1** | None |
| **M3** | **Initials show the full name ("C…") on device.** Hermes has no `Intl.Segmenter`, so `orreryInitials` early-returned the whole name. | A code-point fallback gives "CR" and "EK". A test covers the missing Segmenter. | `c862c30a` + `864f7e04` (`src/logic/orrery-label-logic.ts`, `orrery-label-logic.test.ts`) | **R1** | None |
| **M4** | **Main's Orrery is very likely slow in release. This is INFERRED, not measured on main.** The "legacy" renderer measured in Lab A release builds ran inside the lab build: 45° Home tilt (`deriveHomePose` is shared) plus the M1–M3 fixes already applied. It measured ≈12 fps idle, ≈91% main-thread CPU, ≈5 fps pan and 3.7–6.7 s focus response (`evidence/final/PERF-RESULTS.md`). It keeps main's code pattern, verified on disk at `3492092`: a `layer` prop on every body/label root (an unbounded full-canvas `saveLayer` each), the declarative tree, and clock-driven redraws. Main without M1 is probably *worse* (the freeze). | **H1:** remove per-body/label `layer` props (fold alpha into paint, or bounded layers only while fading) and make clock-driven values primitives. **H2:** port the imperative renderer (V1). | Diagnosis: `_notes/ARCH-PERF-PASS.md` §1; `evidence/arch-perf/simpleperf/before-idle-main-thread.txt` (Lab A tree; same mechanism) | H1 = **R2**; H2 = **R3** | **Owner decision H1 vs H2 (pending).** **Prerequisite: measure main's own release build** with `evidence/arch-perf/tools/relproto.sh`. `orrery-render.test` pins "every body root has `props.layer`", so the test changes deliberately. |
| **M5** | **The focus card covers the focused body and reticle on main.** `OrreryFocusContext` places the card at `body.y + r + 8` and clamps it into the region, so a tall card is clamped *up* over the body. | `lab/focus-card.ts` clears the drawn body, reticle and label plate; goes below else above; narrows to ≥ 168 dp beside obstacles; caps height to the room (≥ 112 dp). | `527bd5b4`, `3cd7695d`, `0c0b18b4` (`src/components/orrery/lab/focus-card.ts`, `OrreryFocusContext.tsx`, `pass3-presentation.test.ts`) | **R2** (lab-gated on `deepFieldOn`; reticle-radius helpers live in `deep-field-math.ts`) | None found (29-UI-SPEC does not specify card side). |
| **M6** | **"Unavailable System" label** after a cold start into a custom System (`evidence/baseline/15-…`). | **Not fixed or investigated in the lab.** A likely code site, unverified: `src/stores/orrery-system-store.ts` ~L95–104 falls back to `"Unavailable System"` when neither a `name` nor a loaded category name is available at request time. | — | **R4** (investigate) | None known |
| **M7** | **Custom System selection sometimes not restored** after a force-stop about 5 s after switching. Observed once: cold start opened All Contacts (`_notes/PASS-3.md` §4). | **Uninvestigated.** May be related to M6 or to `lastSystem` persistence timing. | — | **R4** | Possibly ADR-104 (durable Orrery preferences): check before any fix. |

**Discrepancy note (M5).** The orchestrator's list called `0c0b18b4`'s "natural height" fix a main-line bug. On disk it is not:
- Main measures the card with a root `onLayout` (`git show 3492092:src/components/orrery/OrreryFocusContext.tsx`, line 85).
- The broken `onContentSizeChange` measurement was introduced by the lab itself in `527bd5b4`.
- The main-line bug is the **placement** (M5). The wrapper-`onLayout` fix is needed only if V2 adopts the lab's height cap.

---

## Part 2 — Visual and architecture ideas, ranked

### Top five

1. **V1 — The imperative renderer pattern.** It is the reason Lab A is fast.
2. **V2 — The world plane drawn in world space under the exact homography.** Analytic screen-dp strokes, with no ring polygons in the frame.
3. **V3 — An opaque canvas (SurfaceView) for the Orrery.** It must be paired with the idle-rate fix.
4. **V4 — Hierarchy inversion.** Tinted hairline orbits plus a status segment at the body.
5. **V5 — Body presence.** A presentation-only visual minimum radius, a lit body shader with a crisp status edge, a keyline, and stack pips.

Everything else follows in rank order.

---

### V1 — Imperative scene renderer (five UI-thread pictures)

| Field | Content |
|---|---|
| Verdict | **Adopt. The single most valuable result.** RN-Skia + Reanimated is a viable production architecture **only when used imperatively.** |
| Value | Release, Lab A before → after (`fd7f09c8`): main-thread CPU 92 → 16% idle; pan ≈5 → ≈18 fps; focus response 3.6–8.9 s → 0.06–0.18 s; reduced-motion idle redraws ~10/s → **0**; PSS after 10 switches 1010 → 559 MB; entering identity resolves **at settle** (was 1.2–6.8 s after). Visual parity was verified. |
| What it is | `LabScene` is the only node in the Canvas: one Group of five `<Picture>`s (`below`, `sun`, `above`, `reticle`, `top`) whose inputs are all shared values, so React commits never re-record. `scene-draw.ts` worklets draw everything on the UI thread from the one sampled `frame`. `orderBodies` reproduces the zIndex flush. `scene-specs.ts` builds immutable per-body specs on JS (token RGBA, pre-shaped `SkParagraph`s, SkImage). Specs are written to shared values **in render** (an async hand-off, never a sync read). **No full-canvas layers:** a layer is opened only while a body or label fades, bounded to its own extent; the focus dim is a background-ink veil. **Conditional redraw:** `ambient` is a primitive quantised to `AMBIENT_HZ` 30, or −1 under reduced motion, so an unchanged value never propagates. **Base texture:** `below` is rasterised to an offscreen surface once static; ambient-only frames blit it. |
| Location | `src/components/orrery/lab/LabScene.tsx`, `scene-draw.ts`, `scene-specs.ts`, `use-lab-photos.tsx`, `sky-resources.ts`, `reticle-draw.ts`; `OrreryWorld.tsx` (`deepFieldOn` branch) |
| Commit | `fd7f09c8` (+ `033e7518` for the static-only bake) |
| Deps / assets | None new (RN-Skia 2.6.2, Reanimated 4.5.1, worklets 0.10.4) |
| Evidence | `evidence/arch-perf/parity-release-overview-and-focus.jpg`, `parity-dense-and-inner-circle.jpg`, `release/focus-clara.mp4`, `release/switch-identity-at-settle-sheet.jpg`, `simpleperf/*.txt` |
| V2 must preserve | Tiny stable Canvas tree. Pictures recorded on the UI thread from the shared `frame`. Never a `layer` on per-item Groups. Never return fresh objects from clock-captured derived values. Primitive ambient time. Specs crossing JS→UI by async write in render. Uniform-array lengths tested against the SkSL declarations (a mismatch throws in `makeShader` and kills the loop: `scene-draw.test.ts`). The `lab-scene-render.test.tsx` contract: node count independent of body count; reticle picture reference-stable when unfocused. |
| Decision | **Photo custody (D-41 rule 3)** moved to a hand-off: the hook passes retired images to a UI-side custodian that disposes after the spec write (`use-orrery-photo.ts` `handOff`, 1.5 s unmount grace, `try/catch` draw). Lab notes call this "moved, not weakened". Because it rewrites how a recorded rule is enforced, **confirm with the owner** before production. H2 itself is owner decision H1 vs H2. |

### V2 — World plane in world space under the homography (analytic screen-dp strokes)

| Field | Content |
|---|---|
| Verdict | **Adopt** as the production pattern for all plane content (rings, grid, pool, haze, future gravity wells). |
| Value | Plane recording 32 → ~5 ms per camera frame (debug). The ~9 ms per-frame Ganesh tessellation flush is gone. The frame worklet goes 4.1 → 0.45 ms by dropping 128-point ring polygons. It enables 82–92 fps camera animation in release (with V3). |
| What it is | Cached unit geometry built once on JS (`makePlaneShapes`): 30 unit annulus strips (`SkVertices`, ×1.25 ε ladder) and a unit disc fan. Each ring is **one** `drawVertices` under `concat(H·T·S(R))`. `RING_WORLD_SKSL` computes the distance to the ring in **screen dp** as `\|r − R\| × \|J·r̂\|`, using the Jacobian of H per pixel, so widths stay the canonical 2/3/4 dp with a 1-device-pixel AA feather. Dashes, ink-in and the status segment use world angles. Pixels outside both strokes exit early. The grid is one `GRID_SKSL` draw on the unit disc. `planeHomography(pose, viewport)` is the exact 3×3 of `projectWorldPoint`, built from the frame's clamped pose. `projectFrame(…, ringPaths=false)` drops ring polygons; consumers that need one derive it from H. |
| Location | `src/components/orrery/lab/world-plane.ts`, `deep-field-shaders.ts` (`RING_WORLD_SKSL`, `GRID_SKSL`), `deep-field-math.ts` (`planeHomography`), `src/logic/orrery-camera-logic.ts`, `src/logic/orrery-frame.ts` |
| Commit | `033e7518`, `dc7f8669` (early-out), `5fb0f0d7` |
| Deps / assets | None |
| Evidence | `evidence/camera-perf/parity-overview-focus-dense.jpg`, `parity-themes.jpg`, `debug/prof-*.txt`, `release/cam3-timelines.jsonl` |
| Tests to keep | `world-plane-camera.test.ts`: `circleMatrix` ≡ `projectWorldPoint` ≡ `ringPath` to 1e-6 across tilt and yaw; `minRadialScale` vs finite difference; band containment; uniform-block lengths; one `drawVertices` per ring; no stroked `drawPath`. `deep-field-math.test.ts`: H ≡ projection. |
| V2 must preserve | **Never stroke under a perspective CTM. Never rebuild polygons in JS per camera frame.** A single homography from the frame's pose is the only geometry. |
| Decision | None. Rings keep radius = rank, the dash/fade/width language, and the status factors. |

### V3 — Opaque canvas → SurfaceView

| Field | Content |
|---|---|
| Verdict | **Adopt, conditional on fixing idle cost first.** |
| Value | A TextureView present ceiling of ≈24–26/s became display rate: 59–63 pan (input-bound) and **82–92 camera animation** in release. Switch visible changes rose from 19–24 to 83–120. Focus first change: 5–45 ms. |
| Cost | Idle main-thread CPU rose from **≈17% to ≈32%**: the panel stays at 120 Hz and the always-on `useClock` frame loop runs at 120 Hz. The SurfaceView also adds ≈29 MB of EGL buffers and gives up view-level alpha/transform animation of the canvas. |
| Location | `src/components/orrery/OrreryCanvas.tsx` (`opaque={!!backdrop}`) |
| Commit | `dc7f8669` |
| Evidence | `_notes/CAMERA-PERF-PASS.md` §2.3, §3; `evidence/camera-perf/release/` |
| V2 must preserve | An opaque full-bleed sky, plus one of: stop the clock between ambient ticks; drive ambient time without a per-vsync callback; or vote a 30 Hz surface frame rate (needs an RN-Skia patch). Re-verify overlays, sheets and screen transitions frame by frame. |
| Decision | None recorded, but **ADR-149** overlay translucency is proven against the canvas. Re-verify the visual result over a SurfaceView. |

### V4 — Hierarchy inversion: tinted hairline orbits + status segment

| Field | Content |
|---|---|
| Verdict | **Adopt.** It turned "a wall of saturated rings" into "people on instruments". |
| Value | Bodies lead and rings recede. The status line language (width channel, `[6,6]` dashes, faded/faint/neutral factors) survives on both draws. The never-contacted segment is symmetric, so no direction is implied. Sparse Systems get a hairline boost. |
| Location | `world-plane.ts` (ring spec), `RING_WORLD_SKSL`; tunables `RING_HAIR_*`, `RING_TINT_*`, `SEGMENT_*`, `RING_SPARSE_*`, `RING_NEAR_TINT`, `FOCUS_RING_*` |
| Commit | `c862c30a` (language), `527bd5b4` (shader), `033e7518` (world-space form) |
| Perf | Free relative to the old ring (one draw per ring) |
| Evidence | `evidence/final/40-side-by-side-overview-legacy-vs-lab-a.jpg`, `pass-1/40-before-after-overview-dark.jpg`, `direction-1/01a` (the failure it fixed) |
| V2 must preserve | Status must remain distinguishable without colour at every zoom (29-UI-SPEC Colour). `world-plane.test` pins one hairline plus one segment per contact, dash and width channels, alpha ratios, segment span ≤ 89°, and no additive strokes. |
| Decision | No recorded decision reversed. 29-UI-SPEC's ring encoding is preserved, though the 360° ring is *quieter*, so visual sign-off is the owner's. |

### V5 — Body presence: visual minimum radius, lit shader, status edge, keyline, stack pips

| Field | Content |
|---|---|
| Verdict | **Adopt.** |
| Value | Overview bodies draw at ~21 dp, still inside the 22 dp hit radius, so what is visible is tappable. The crisp status edge line is the status cue on photo bodies. Lighting from one sun gives the scene a light model, and photos stay legible. The keyline separates co-angular bodies, and the pips reveal hidden bodies in a stack. |
| Location | `deep-field-math.ts` (`bodyVisualScale`, `bodyDepthScale`), `deep-field-shaders.ts` `BODY_SKSL`, `scene-draw.ts` (body draw), `body-stack.ts` `findStacks` |
| Commit | `c862c30a`, `527bd5b4`, `fd7f09c8` |
| Perf | One runtime-shader draw per body (35-float uniforms). Part of the ~4.5 ms "bodies + sky + sun + labels" per camera frame (debug). |
| Evidence | `evidence/pass-2/03-crop-co-angular-stack-keyline-pip.png`, `final/12-identity-zoom-via-focus-clara-ruiz.jpg`, `final/41` |
| V2 must preserve | Visual extent never written back to `radius`, `hitRadius` or labels (`pass2-presentation.test.ts` pins stacks not changing data). Photos circular and screen-facing. Night-side darkening ≤ 0.55. |
| Decision | None. Gravity mass (ADR-106) is untouched: scale is clamped to the readability floor, not to Gravity. **Caveat:** the visual extent exceeds the 1.3r cull, so edges can pop. |

### V6 — Star sun: disc shader + corona

| Field | Content |
|---|---|
| Verdict | **Adopt the static look; ambient animation is an owner call.** |
| Value | The "blue button with a glow" became a star. A contact-sun keeps its status hue at the limb and corona. It anchors the light model. Chart mode gets an engraved variant. |
| Location | `deep-field-shaders.ts` `SUN_DISC_SKSL`, `CORONA_SKSL`; `scene-draw.ts` (sun); `LabScene.tsx` `sun` picture |
| Commit | `b450f47e` (corona), `c862c30a` and `527bd5b4` (disc) |
| Perf | Redrawn at `AMBIENT_HZ` 30 when not in reduced motion; the only idle redraw. Static under reduced motion. |
| Evidence | `evidence/final/21-system-lab-inner-circle.jpg`, `final/41` (close-up), `pass-2/12e` (flare) |
| V2 must preserve | Precision-safe SkSL (O(1) coordinates, no hashes). Colours as token uniforms. The photo-sun path must be **device-verified** (not done). |
| Decision | **Corona churn and granulation are new ambient motion, against ADR-048/077 ("starfield twinkle + sun pulse are the sole ambient animation") → owner decision.** A frozen-phase corona (the reduced-motion path) has no collision. |

### V7 — UI-thread focus layer: reticle, lock-on, emphasis

| Field | Content |
|---|---|
| Verdict | **Adopt.** |
| Value | The reticle, ring emphasis and body dim land in the **same frame the camera starts**. As a React child they had arrived 5–10 s late. The brackets are tight screen-dp and axis-aligned, billboarded under tilt. |
| Location | `lab/reticle-draw.ts`, `LabScene.tsx` (`reticle` picture, `FocusState`), `world-plane.ts` `PlaneFocus`; tunables `RETICLE_*`, `FOCUS_*` |
| Commit | `3cd7695d` (moved into `LabScene` in `fd7f09c8`) |
| Evidence | `evidence/pass-3/41-before-after-reticle-crop.jpg`, `pass-3/20-lock-on-sheet-3fps.jpg`, `pass-3/21` (RM static), `final/32` |
| V2 must preserve | Focus presentation written as an async UI-thread state in the render that receives the focus, never a React-mounted child. Reticle sized from the *drawn* radius (`reticleDrawnRadius`, tested against `orbitBodyScale`). Accent token only. Reference-stable empty picture when unfocused. |
| Decision | Lock-on, flash and ping are focus-triggered, not ambient. **The scan arc is ambient motion → owner decision (ADR-048/077).** It could be dropped with no loss of meaning. |

### V8 — CPU-baked nebula with a per-palette module cache

| Field | Content |
|---|---|
| Verdict | **Adopt (or replace with a bundled asset).** |
| Value | A precision-proof soft galactic band; no faceting in any palette. One bake per palette per process (~140 ms for two palettes in node; **not measured on device**). No pop on remount. |
| Location | `src/components/orrery/lab/nebula-bake.ts`, `sky-resources.ts` |
| Commit | `c862c30a` |
| Deps / assets | None. It is procedural at runtime; no asset file. |
| Evidence | `evidence/pass-1/40-before-after-overview-dark.jpg`, `direction-1/01a` (the GPU failure it replaced), `final/01–04` |
| V2 must preserve | No GPU noise on Mali mediump. Alpha a value step below rings (≤ 0.34). Token inks only. Measure the bake on device (or move it off the mount path). |
| Decision | None |

### V9 — Astrolabe plane: grid, bezel dial, lit pool, density fade

| Field | Content |
|---|---|
| Verdict | **Adopt (the bezel especially).** |
| Value | It makes tilt and yaw legible as a real plane, and gives the "instrument" read cheaply. It is the best element at low counts. The density fade keeps it out of the way at 39 contacts. |
| Location | `world-plane.ts`, `GRID_SKSL`; tunables `GRID_*`, `LIT_POOL_*`, `HAZE_*` |
| Commit | `0a73a54c`, `c862c30a` (density), `033e7518` (world-space form) |
| Evidence | `evidence/final/21`, `pass-2/12e`, `pass-1/13a-crop-inner-circle-star-bodies-astrolabe-dark.jpg` |
| Decision | None. Polaris (29-UI-SPEC E8) is unchanged. |

### V10 — 45° tilted Home

| Field | Content |
|---|---|
| Verdict | **Strong visual win. Production is the owner's call.** |
| Value | The biggest single "star-system map" gain. Foreshortening fits more of a 39-contact world. Taps verified exact. |
| Location | `src/logic/orrery-camera-logic.ts` `LAB_HOME_TILT_DEG` (→ `deriveHomePose`; the fit divides by near-side perspective scale and cos(tilt)) |
| Commit | `c862c30a`, `864f7e04` |
| Evidence | `evidence/pass-1/30-home-tilt-0-inner-circle-dark.png`, `31-home-tilt-0-all-contacts-dark.png` vs `pass-1/13`, `01`; `final/01` |
| Decision | **Owner decision K: kept for testing only.** It reverses milestone-2 phase-08 dossier §C/§P and 29-UI-SPEC ORRC-04/05 ("Home is sun-centred, top-down and north-up"). Set it to 0 to restore. |

### V11 — "Chart paper" light variant

| Field | Content |
|---|---|
| Verdict | **Adopt the principle** (no additive blends in light; ink and multiply instead). **Restore some engraving weight.** |
| Value | Light modes read as a deliberate chart, not a degraded dark mode. It was the best-received element in the direction-1 review. |
| Location | Luminance switch (> 0.5) in `deep-field-ink.ts`; chart branches throughout `world-plane.ts`, shaders and `nebula-bake.ts` |
| Commit | `b450f47e`, `c862c30a` |
| Evidence | `evidence/final/02`, `04`, `pass-1/41-before-after-overview-galaxy-light.jpg`, `direction-1/14`, `15` |
| V2 must preserve | `world-plane.test`: no additive blend in chart mode. |
| Decision | None |

### V12 — Switch "jump" FX

| Field | Content |
|---|---|
| Verdict | **Adopt trails, flare and dial swing; keep the rest optional.** |
| Value | Turns the existing choreography into a warp without changing its semantics. Effects are idle under reduced motion and at settle. |
| The effects | Real-history motion trails (polar-resampled, inner-ring thinning, leaving-body peel-off), sun flare and disc heat, starfield warp and kick, dial swing and grid brighten, ink-in with a glint, capture and settle ripples. |
| Location | `deep-field-math.ts` `computeSwitchFx`; `world-plane.ts` (trails, ink-in, ripples); `scene-draw.ts` `drawSky` (warp) |
| Commit | `b450f47e`, `527bd5b4`, `3cd7695d` |
| Evidence | `evidence/pass-2/12-AFTER-switch-family-to-inner-circle-BEST.mp4`, `12e`, `pass-3/32`, `final/30–31` |
| Gaps | **Not judged at full fps on stills.** Ink-in, ripples and glint were "barely seen" before the arch pass and were never re-captured after it. |
| V2 must preserve | All FX read `computeSwitchFx` + frame + progress only. `orrery-switch-choreography.ts` stays untouched. Draw warp copies only while `v > 0` (HEAD wastes 5 replays at rest). |
| Decision | Choreography-bound, not ambient: no ADR collision found. |

### V13 — Arrival ghosts

| Field | Content |
|---|---|
| Verdict | **Keep as a fallback.** With V1, identity resolves at settle, so ghosts rarely show. |
| Value | System structure is complete on time. Shadows and pips are drawn only for mounted bodies, so nothing has a shadow before its disc. |
| Location | `world-plane.ts` §5b; `GHOST_*`, `BODY_ENTER_FADE_MS` |
| Commit | `b1af0a57` |
| Evidence | `evidence/pass-3/33-AFTER-arrival-ghosts-dense-to-all-sheet.jpg` vs `34-BEFORE` |
| Decision | Ghosts are neutral by necessity (no status in the frame). A ghost must never resemble "never contacted" for long, so keep it transient. |

### V14 — Focus card placement

See **M5**. **R2.** Evidence: `evidence/final/41` (right), `pass-3/02`, `pass-3/10`.

**Residuals:**
- A moon's card can cover its parent's label.
- Focus centring can put the sun under the header pills; that is camera framing.

### V15 — Depth cues

| Field | Content |
|---|---|
| Verdict | **Adopt.** |
| What it is | Far bodies shrink up to 16% (`BODY_FAR_SHRINK`) and get a void tint (up to 0.38). Depth haze over the far plane. Near rings brighter and more saturated. Contact shadows on the plane, gated on tilt. |
| Location | `deep-field-math.ts`, `world-plane.ts`, `BODY_SKSL` |
| Commit | `b450f47e`, `c862c30a`, `527bd5b4` |
| Evidence | `final/01`, `pass-2/40-before-after-overview-dark.jpg` |
| Decision | None. All presentation-only. Most visible with K (tilt). |

### V16 — Lit moons + moon orbit hairlines

| Field | Content |
|---|---|
| Verdict | **Adopt.** |
| Location | `scene-draw.ts` (moon draw, `moonVisualScale`), `world-plane.ts` (moon orbits) |
| Commit | `527bd5b4` |
| Evidence | `final/11-focus-moon-tom-satellite-of-clara.jpg`, `pass-2/02` |
| Decision | ADR-105: satellites stay subordinate and must never imply a contact. They are small, have no status ring and are visible only at identity/detail. Keep it that way. |

### V17 — Instrument label plates

| Field | Content |
|---|---|
| Verdict | **Adopt.** |
| What it is | Hairline border, status tick and leader. |
| Location | `scene-draw.ts` (labels); `PLATE_*`, `LEADER_ALPHA` |
| Commit | `b450f47e` |
| Evidence | `final/12`, `pass-3/30-font-scale-1.3-focus-clara.jpg` |
| Decision | None, as long as `prepareOrreryText` metrics and the allocated set are untouched. Labels decide Profile vs Focus. |

### V18 — Photo cross-fade and mount fade

| Field | Content |
|---|---|
| Verdict | **Adopt.** |
| What it is | Photo cross-fades over initials in 260 ms; bodies fade in on mount in 280 ms. Instant under reduced motion. |
| Commit | `7899aacb`, `3cd7695d` (now in `scene-draw.ts`) |
| Decision | None. It does not touch photo ownership; a cache would (D-41, owner). |

### V19 — Token discipline for SkSL

| Field | Content |
|---|---|
| Verdict | **Adopt as convention.** |
| What it is | Six `orrery*` tokens in all four presets. A `tokenInk()` helper (named to avoid the colour gate's `rgba(` regex). Lazy, memoised `labEffect(name)` with a null fallback when compilation fails or Skia is mocked. |
| Location | `src/theme/theme-types.ts`, `theme-presets.ts`, `deep-field-ink.ts`, `deep-field-shaders.ts` |
| Commit | `202b0d6c`, `0a73a54c` |
| Decision | Adding tokens follows the theme-token rule (HANDOFF §7). |

### V20 — Sky parallax

| Field | Content |
|---|---|
| Verdict | **Adopt.** |
| What it is | Background-only parallax driven by the camera pose (pan, tilt, zoom, yaw). |
| Value | Free motion that stops with the camera. |
| Location | `scene-draw.ts` `drawSky` / `skyTransform` |
| Commit | `0a73a54c` |
| Decision | Camera-driven, not ambient: no collision. |

### V21 — Measurement toolkit (process harvest)

| Field | Content |
|---|---|
| Verdict | **Adopt for V2 verification.** |
| What it is | Release protocol (`evidence/arch-perf/tools/relproto.sh`); SurfaceFlinger present counting (`evidence/camera-perf/tools/sfpan.sh`, `sfidle.sh`, `sfanim.sh`); camera-animation capacity test (Recenter recovery); UI-thread probe method (`camera-perf/tools/addprobes.py`, `perf/probe-instrumentation.patch.txt`); video change counting (`final/perf/tools/vfps.py`, `swan.py`); closure-size bench (`evidence/perf/closure-bench.test.ts.txt`). |
| Caveat | The tools source a session-scratchpad `lib.sh`, so their paths need re-homing. |

### Not for harvest

| Item | Why |
|---|---|
| Runtime renderer A/B toggle (`b1cfde37`) | Experiment-only. It is not DEV-gated, so it shows in release builds. A dev-only flag is useful during a V2 port. |
| DEV marker (`LabHud.tsx`) | Lab branding. |
| Package id `com.bwales.orbit.laba` (`app.config.ts`) | Experiment-only. |
