# Lab A — Decisions log (chronological)

Branch `experiment/orrery-skia-production`, base `main @ 3492092`, 31 lab commits (`git log --oneline 3492092..HEAD`). Everything below happened on 2026-09-30 → 2026-10-01 on a Pixel 6 Pro.

Each stage records what was tried, what the device showed, and why the next choice changed. Primary sources are in `_notes/` and `evidence/*/`. Owner decisions are quoted from `_notes/OWNER-DECISIONS.md`.

## 0. Infrastructure: `6514a802`, `105fd726`

- **Own package.** Lab A got its own package `com.bwales.orbit.laba` with the launcher name "Orbit Lab A" (`app.config.ts`). It installs beside `com.bwales.orbit` and the other labs.
- **Build and run loop** (`BUILD-LOOP.md`):
  - builds on `droid` in `C:\Users\bwales\projects\orbit-lab-a` (tar over ssh, never git);
  - Metro on :8083.
- **Seed and capture tooling:** `tools/seed-lab-a.py` seeds a synthetic contact set (40 contacts, Lab Dense with 32, Lab Inner Circle with 3, satellites, synthetic abstract avatars). `tools/ui.py` and `tools/shot.sh` drive and capture the app.
- **Baseline evidence** (`evidence/baseline/`) recorded the legacy look. It also recorded two baseline defects:
  - a 4–5 s switch freeze in debug (`baseline/10`);
  - an **"Unavailable System"** label after a cold start into a custom System (`baseline/15`).
- **Owner decisions:**
  - Package, droid directory, Metro port and "device = whatever adb reports" were accepted on 2026-09-30.
  - The stop-gate `git worktree list` was replaced by read-only `rev-parse` verification, because a hook blocks `git worktree`.
  - Owner decision 2026-10-01: **share droid with Experiment B; probe `droid-busy.sh` before every build.**

## 1. Hypothesis and research: `9237dbf6`

**`HYPOTHESIS.md`: "Deep-field star chart".** The proposal combined:
- layered depth: an fbm nebula, two star layers and a vignette;
- a world-plane astrolabe drawn through the camera homography;
- orbits as instruments, with depth alpha, progress trails and ticks;
- lit bodies with contact shadows;
- a star sun;
- a HUD: reticle, instrument plates and a DEV marker;
- a switch "jump": streaks, draw-on, flare and kick;
- a first-class "chart paper" light mode.

**`_research/SUBSYSTEM-BRIEF.md`** pinned the contract:
- the single `frame` is the only geometry;
- visual size is not semantic size;
- labels decide Profile vs Focus;
- one clock, gated on live reduced motion;
- the tests that pin tree shape and closures;
- the colour gate.

It also identified the perf levers that later proved decisive:
- per-body `saveLayer`;
- 128-point ring re-projection per point through `usableCameraRect`;
- O(N²) `bodyKey` lookups;
- clock-forced full redraws.

## 2. Direction 1: `202b0d6c`, `0a73a54c`, `b450f47e`, `58893a0c`

**Built.** Every element of the hypothesis was built as **declarative RN-Skia nodes**:
- `DeepFieldBackdrop`, `WorldPlaneLayer` and `BodyOverlays`;
- a GPU SkSL value-noise fbm nebula baked per mount through `usePictureAsTexture`;
- the plane recorded under `concat(H)`;
- ring underglow and north→body progress trails;
- a spinning reticle;
- `computeSwitchFx` for the switch effects.

**Off-device check.** It was validated only with CanvasKit previews (CPU fp32 raster). The notes flagged those previews as "intended look, not evidence".

**Guard rails kept:**
- the frame worklet was byte-identical;
- new data came from separate mappers;
- tokens were passed as uniforms;
- shaders compiled lazily;
- the worklet-order test was extended to `lab/`.

## 3. Device review of direction 1: `3ad92955` (`evidence/direction-1/REVIEW.md`)

**Verdict:** the structure was right, but:
- **The nebula was broken.** Faceted shards, stair edges and a hard vertical seam appeared. That is reduced-precision fbm on Mali, which the CanvasKit previews could not show.
- **The hierarchy had not inverted.** Rings were the loudest element, and the glow and trails made them louder: dashed glow turned into "fuzzy beads", and 300° trails read as a second ring.
- Bodies were still 26 dp chips with truncated initials ("C…").
- The contact shadow read as a smudge at tilt 0.
- The sun was a "blue button with a glow".
- The focus card covered the body and reticle.

**What worked:**
- the astrolabe at low counts;
- the corona;
- the reticle;
- chart-paper light mode (the best result).

The switch was unjudgeable because of a 4–5 s freeze, which the baseline showed too. The review produced a ranked list of 15 fixes, and pass 1 executed most of them.

## 4. Pass 1: `c862c30a`, `864f7e04`, `c5d535ed` (`_notes/PASS-1.md`)

**Changes:**
- **Nebula:** the GPU fbm was replaced by a **CPU bake**: float64 value noise and an integer hash, with no GPU precision involved. It is cached per palette at module level. Peak alpha dropped to 0.32/0.34 and the faceting was gone.
- **Hierarchy inversion:**
  - each ring became a tinted hairline plus a status segment at the body;
  - the underglow, long trails and progress tick were removed;
  - hairlines get a sparse boost when a System has few orbits.
- **Bodies:**
  - presentation-only visual scale up to 21 dp, within the 22 dp hit radius, and taps were verified;
  - a crisp status edge line and specular highlight.
- **Initials bug found.** Initials truncated to "C…" because Hermes has no `Intl.Segmenter`, so `orreryInitials` returned the full name. This is **a main-line bug**; it was fixed with a test.
- **Sun:** a star disc shader with granulation. The first attempt read as a gold coin with stripes; a μ-based heat with incommensurate cells replaced it.
- **Contact shadows** became gated on tilt, and the grid density now fades with orbit count.
- **Home tilt experiment.** 28° was barely perceptible; **45° clearly reads as a plane**. That is the biggest single gain, and it also fits more of the world on screen.
  - It was identified as **reversing** dossier phase-08 §C/§P and 29-UI-SPEC ORRC-04/05 (top-down Home).
  - It was implemented as the lab constant `LAB_HOME_TILT_DEG`; setting it to 0 restores the recorded behaviour.
- **DEV marker:** the "doubled" marker turned out to be the usable-rect anchor jumping mid-switch. The marker was pinned bottom-left.
- **Logcat spam:** the `LegacySurfaceTexture is not attached!` spam was shown by A/B to be RN-Skia TextureView behaviour, not Lab code.

**Owner decision K (2026-10-01).** Keep the 45° tilted Home (`LAB_HOME_TILT_DEG = 45`) as the lab default **for testing only**. Production adoption remains a separate owner decision (`5c47bb3d`).

## 5. Pass 2: `527bd5b4`, `7899aacb`, `15ec425a` (`_notes/PASS-2.md`)

**Production-mode JS** (`dev=false&minify=true` via a prefs file, BUILD-LOOP §(i)) was adopted to get closer to release without rebuilding.

### Finding 1: the switch freeze is not dev mode

- It reproduces with the legacy renderer too.
- simpleperf points to `libworklets` serialisation plus Hermes on the main thread.
- The suspects were noted, but the freeze was left alone because it sat in baseline code.

### Finding 2: Lab A had made idle frames about 3× slower

Bisection of the pass-1 plane found three causes:

| Cause | Why it is slow |
|---|---|
| Strokes and dashes under a perspective CTM | Ganesh falls back to CPU path masks plus texture uploads every frame |
| `drawOval` | Draws bounding quads, so the plane became fragment-bound |
| Round joins and non-convex paths | Both fall back to software rendering |

**Decision:** project on the CPU, stroke the frame's own convex `ringPath` polygons with an identity matrix, and put all ring styling into one analytic `RING_SKSL`. Idle p50 went from 150–200 ms to about 73 ms (debug).

### New presentation features

- **Switch jump v2:**
  - real-history motion-blur trails, resampled in polar form (the frame-chord version looked chunky);
  - starfield warp, dial swing, ink-in, capture ripples and disc heat.
- **Depth:** far shrink and haze. A cool horizon band was rejected as an artifact.
- **Co-angular overlap:** a separation keyline plus stack pips.
- **Focus card:** placement moved off the body. The natural height was measured via `onContentSizeChange`; pass 3 later found that measurement was wrong.
- **Reticle lock-on**, still as a React child at this point.
- **Moons:** lit moons with orbit hairlines.
- **Sun:** 3-octave granulation.
- **Photos:** a cross-fade over initials in place of a cache.

### Decisions in this pass

- **Photo cache rejected.** A module-level SkImage cache would reverse D-41 ("SkImage objects are never cached"). It was not done and is an **owner/production decision**.
- **Baseline bug documented, not fixed:** the **stale-camera snap** at switch start (`publish()` interpolated to the *previous* `cameraTo` when settled).

## 6. Perf pass (freeze): `ba3cef68`, `842f1f36`, `20538bd1`, `b1cfde37`, `655f6ada` (`_notes/PERF-PASS.md`)

**Why the scope changed.** The freeze blocked judging the switch at all, so the lab took the shared runtime path in scope. The fixes are semantics-preserving and test-pinned.

### Root causes

1. **The frame worklet captured the whole `switchRuntime` and `scene`.**
   - It closed over about 41 resources, each holding the full scene snapshot.
   - `useOrrerySwitchRuntime` returned a new object every render, so every screen render restarted the mapper.
   - Each restart re-serialised about 241k nodes on the main thread.
2. **`projectFrame` re-derived `usableCameraRect` for every one of about 5,248 points per frame** (~390 ms per frame in debug).
3. **RN-Skia re-recorded the whole tree** on every Canvas children identity change, with blocking `runOnUISync` reads. A probed switch spent 13.6 s of JS in sync reads.

### Fixes

- the projection basis is computed once per frame, and a test pins it bit-exact;
- narrow worklet captures, a memoised runtime, and a publish that ships `world`/`generation` only;
- an O(1) `frameBody` key index and `billboardMap`;
- memoised Canvas content and stable empty defaults;
- the **stale-camera fix**, with tests that fail on the old code;
- an experiment-only **renderer A/B toggle**.

### Results

| | Before | After |
|---|---|---|
| Frame-worklet run | 345–475 ms | 4–8 ms |
| Multi-second switch/focus freeze | present | gone |
| Switch tap → settled | — | 2.4–2.8 s, in both renderers |

**Decision.** These are **main-line harvests regardless of direction**, because main has the same frame worklet, runtime and canvas.

## 7. Pass 3: `3cd7695d`, `b1af0a57`, `0c0b18b4`, `6ad5a307` (`_notes/PASS-3.md`)

**Finding.** The reticle was a React child, so it appeared only after the focus commit's full re-record: absent 9 s after the tap (`pass-3/22`).

**Decision:** move focus presentation **off the React path**.
- It is now an always-mounted per-frame picture fed by a UI-thread `FocusState`, written in render as an async hand-off.
- Reticle geometry was re-authored in screen dp around the drawn disc and axis-aligned once locked.
- The ambient spin was removed and replaced by a scan arc.
- Ring and body emphasis were added.

### Arrival ghosts

Entering bodies on large switches resolved seconds late, an architecture-level cost. **Decision:** draw neutral ghosts from the frame, on time, in the plane picture, to mitigate it.
- Shadows and pips are drawn only for mounted bodies.
- Bodies fade in on mount.

### Focus card

- It gained a label-plate clearance and a narrow layout beside the controls obstacle.
- **Bug found in the lab's own pass-2 change:** `onContentSizeChange` missed rows that arrive late, so the card clipped at 180 dp. It is now measured with `onLayout` on a wrapper.

### Smaller decisions

- The "first switch after cold start doesn't animate" report was explained as a same-System re-select. Nothing was changed.
- **Side observation, not investigated:** after force-stopping in a custom System, the app restored to All Contacts.
- Trails were thinned near the sun.

## 8. Release reality check: `730899b4` (`evidence/final/PERF-RESULTS.md`)

This was the **first release build**. Legacy and Lab A were run in the same process via the A/B toggle.

**"Legacy" here is not main.** It is main's declarative renderer running inside the lab build, with:
- the 45° Home tilt (`deriveHomePose` is shared);
- the perf-pass fixes;
- the stale-camera fix;
- the initials fix.

Main itself was never measured in release.

**Result: both renderers are slow in release.**

| Measure | Lab's legacy renderer | Lab A |
|---|---|---|
| Idle | ≈12 fps, main thread ≈91% busy | ≈12 fps, main thread ≈92% busy |
| Pan | ≈5 fps | ≈5 fps |
| Focus response | 3.7–6.7 s | 3.6–8.9 s |
| Reduced-motion idle | goes to 0 | **still redraws ~10/s at 91% CPU** |
| Late entering identity | — | 1.2–6.8 s after settle |

**This reframed the lab.** The visual direction was fine, but the main thread was saturated in **both** renderers. It became the dominant problem, and a shared one.

## 9. Architecture perf pass: imperative renderer, `fd7f09c8`, `2111be64` (`_notes/ARCH-PERF-PASS.md`)

### Root cause

The root cause came from reading the RN-Skia 2.6.2 source plus simpleperf:
- **Every** shared value captured anywhere in the tree drives one mapper. That mapper re-converts **every** animated prop (~550), replays the whole command list, and renders on the **main thread**.
- Each `layer` prop is an **unbounded `saveLayer`**, so there were about 120 full-canvas offscreen passes per frame. Mali framebuffer churn was 58% of main-thread time.
- Clock-captured derived values returned fresh objects (uniform objects, `createPicture`), so the scene redrew every tick, **even under reduced motion**.

### Decision

Replace the Lab node tree with an **imperative renderer**:
- `LabScene` is one Group of five `<Picture>`s (below, sun, above, reticle, top), recorded on the UI thread from the one `frame`.
- Resources (specs, paragraphs, images, effects) are prepared on JS as immutable objects.
- There are no full-canvas layers; a bounded layer opens only while something fades.
- Ambient time is a **primitive** quantised to 30 Hz (−1 under reduced motion).
- `below` is cached as a base texture.
- Photo custody moved to a hand-off: the hook passes retired images to a UI-side custodian. This is D-41 rule 3 moved, not weakened. The legacy path is unchanged.

### Results (release)

| | Before | After |
|---|---|---|
| Main-thread CPU, idle | 92% | 16% |
| Idle frame rate | — | about 22 fps (ambient-capped) |
| Pan | ≈5 fps | ≈18 fps |
| Focus response | 3.6–8.9 s | 0.06–0.18 s |
| Reduced-motion idle redraws | ~10/s | **0** |
| PSS after 10 switches | 1010 MB | 559 MB |
| Entering identity | 1.2–6.8 s after settle | resolved at settle |

Visual parity was verified (`arch-perf/parity-*.jpg`).

### Pending owner decisions this pass created

- **H1 vs H2.** Main's Orrery has the same per-body/label `layer` pattern and declarative tree (verified in code at `3492092`). So it is **inferred** to be slow in release, as the lab's legacy renderer was: ~12 fps idle, ~91% main thread, focus 3.7–6.7 s. Main was **never measured** in release, and measuring it is a prerequisite.
  - **H1:** harvest the cheap fix (remove per-body/label `layer` props, primitive clock values).
  - **H2:** port the imperative renderer.
  - The owner decides after the experiment.
- **TW1 vs TW2.** The twinkle never rendered in Lab A, because `drawPicture` ignores paint, and the imperative renderer reproduces that exactly.
  - **TW1:** keep the sky steady (orchestrator's recommendation).
  - **TW2:** enable a real twinkle, which means a dimmer sky on average and added ambient motion.
  - Owner decision.

## 10. Camera perf pass: `033e7518`, `dc7f8669`, `5fb0f0d7`, `978643c9` (`_notes/CAMERA-PERF-PASS.md`)

**Problem.** Pan was only ≈18 fps. A profile showed:
- JS recording of the plane at 32 ms per frame, mostly JSI conversion of 128-point arrays;
- Ganesh stroke tessellation in the base-texture flush, 9 ms;
- a TextureView present ceiling of about 24–26 presents/s.

**Decisions:**
1. **World plane in world space under the homography,** using cached unit `SkVertices` annulus bands and a unit disc. The strokes are **analytic in screen dp** (`RING_WORLD_SKSL`, `GRID_SKSL`) via the per-pixel Jacobian, so nothing is stroked under perspective.
   - The literal idea, "record a world picture and `concat(H)`", was rejected because of the pass-2 finding.
2. **Base texture baked only once the scene is static** (2 ambient ticks).
3. **Opaque canvas.** RN-Skia then uses a **SurfaceView**: 26 → 59 presents/s in the same debug build.
4. **Lab frames skip the 128-point `ringPath`.** It was 88% of the frame worklet; the 32-gon dash perimeter is within 0.5%.

**Result (release `5fb0f0d7`):**

| Metric | Value |
|---|---|
| Camera animation | **82–92 presents/s**, median gap 8.3 ms |
| Scripted pan | 63/s, the adb-injection ceiling |
| Switch | 83–120 visible changes to settle |
| Focus | 5–45 ms first change, settled in about 0.63 s |

**Cost:**
- Idle main-thread CPU rose from 17% to 32%, because the SurfaceView keeps the panel at 120 Hz and the always-on clock loop runs at 120 Hz.
- The SurfaceView adds about 29 MB of EGL buffers.

That release build is left installed on the Pixel.

## Owner decisions: status at the end of the lab

| ID | Decision | Status |
|---|---|---|
| Infra | Own package, droid dir, Metro 8083; share droid with Experiment B | Owner-approved (lab only) |
| **K** | 45° tilted Home | **Kept for testing only.** It reverses phase-08 dossier §C/§P and 29-UI-SPEC ORRC-04/05. Production adoption is an owner decision. |
| **H1 / H2** | How main's (inferred) slow release Orrery gets fixed | **Pending.** The owner decides after the experiment, ideally after a release measurement of main itself. |
| **TW1 / TW2** | Star twinkle | **Pending.** The owner decides. |
| Ambient motion | Corona harmonics, granulation, reticle scan, 30 Hz ambient vs ADR-048/077 "starfield twinkle + sun pulse are the sole ambient animation" | **Pending owner decision** for production. |
| D-41 | Module SkImage photo cache | Not done; an owner decision if ever wanted. |

Recommendations for each are in [RECOMMENDATIONS.md](RECOMMENDATIONS.md) §5.
