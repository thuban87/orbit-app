# Lab A: performance pass (switch/focus freeze)

**Date:** 2026-10-01.
**Target:** Pixel 6 Pro (`raven`), `com.bwales.orbit.laba`, **DEBUG native APK running production-mode JS** (`dev=false&minify=true`, BUILD-LOOP §(i)). This is **not a release build**. No native rebuild was done and droid was not used.
**Commits:** `ba3cef68` (projection basis), `842f1f36` (freeze fix), `20538bd1` (stale camera), `b1cfde37` (renderer A/B toggle). These notes and the evidence are in the next commit.
**Evidence:** `evidence/perf/`. Read `latency-summary.txt` first. The `logs/` folder has probe and Choreographer logs, and the mp4s and contact sheets are numbered before (0x) and after (1x).

## Headline

**Before:** a System switch between large Systems was one main-thread block of 3–5 s followed by a jump to the end (0–2 intermediate frames). A focus tap gave 0.7–1.4 s Daveys.

**After:** on the same device and build type, every measured switch looks like this:
- it starts 0.1–0.4 s after the scene loads;
- it plays the full 2.1 s choreography continuously;
- tap to settled is 2.4–2.8 s;
- there is no Davey or skipped-frame warning.

Both renderers behave this way. A focus tap shows no Davey and no skipped frames.

| Switch | Before: tap→settled | Before: frames | Before: max Davey | After, Lab A: tap→settled | After, Lab A: frames | After, legacy: tap→settled | After, legacy: frames |
|---|---|---|---|---|---|---|---|
| Lab Dense → All (32→39) | jump (0 frames) | 0 | **4984 ms** | 2.53 s | 19 | 2.76 s | 33 |
| All → Lab Dense (after focus) | 5.4 s | 2 | **4609 ms** | 2.67 s | 20 | 2.56 s | 33 |
| Lab Dense → Inner Circle | 4.3 s | 2 | **3881 ms** | 2.42 s | 28 | 2.56 s | 39 |
| Inner Circle → Lab Dense | 3.2 s | 7 | 1695 ms | 2.37 s | 62 | 2.45 s | 95 |
| Focus tap on CR (All Contacts) | — | — | 707 / 1124 / 1424 ms; skips up to 115 | — | none | — | — |

"Frames" counts runs of the UI-thread frame worklet while the switch is in progress, which is an upper bound on distinct frames. The screen itself updates at roughly 4–10 fps here, because RN-Skia draw cost in a debug-native build dominates.

The frame worklet's own cost per run was **345–475 ms before and 4–8 ms after**.

## Root cause

There were two compounding causes, both in the shared runtime/frame/worklet path. That is why the legacy renderer froze too.

### 1. Re-serialising whole scene snapshots into the UI runtime on every mapper restart (the multi-second block)

**What was captured.** `OrreryWorld`'s frame `useDerivedValue` closed over the whole `switchRuntime` and the whole `scene`. The compiled `__closure` contains them; `scratchpad closures.cjs` lists every worklet capture.
- `switchRuntime.resources` holds one `OrreryBodyResource` per body.
- Each of those holds the **entire `OrrerySceneSnapshot`**: contacts, System snapshot, the gravity `Map`, and the world.

**Why that is expensive.** The JS side de-duplicates serialisation through a `WeakMap`. The UI side does not: `SerializableObject::toJSValue` in react-native-worklets 0.10.4 builds a **fresh object per reference** (`RetainingSerializable` is only used with `shouldRetainRemote`). In addition, `startMapper` ships the closure twice (the worklet plus its `inputs`), and `extractInputs` walks it on the UI thread.

**Measured size.** The node bench (`evidence/perf/closure-bench.test.ts.txt`) on the real seeded device DB, during an All→Dense switch with 41 resources:
- **241,054 materialised nodes per frame-mapper start**;
- 292 once narrowed.

**Why it repeated.** `useDerivedValue` re-creates its mapper whenever a captured value changes identity. `useOrrerySwitchRuntime` returned a **new object on every screen render**, so every OrreryScreen render restarted the mapper and paid the full materialisation cost on the main thread. That covers store status changes, `satellites`, viewport/obstacle changes and focus state.

simpleperf matches: `libworklets` (`makeSerializableClone` / `toJSValue`) plus Hermes on the main thread.

### 2. The frame worklet re-derived the usable rect for every projected point (~390 ms per frame)

**What it did.** `projectFrame` built 128 ring points per body through `projectWorldPoint`, and each call ran:
- `assertProjection`, which allocates an array;
- `projectionCenter` → `usableCameraRect`, which subdivides the region around every obstacle rect (4–6 on this screen) and then sorts;
- the yaw trig, twice.

**Cost.** For 41 bodies that is about 5,248 rect derivations per frame.
- Node: 26 ms per frame.
- Device (debug native): about 390 ms per frame-worklet run, measured with `Date.now()` around the worklet (probe).

So even after the block, only 2–3 frames fitted into a switch.

### 3. Exposed once 1 and 2 were fixed: needless RN-Skia re-records

**The mechanism.** RN-Skia 2.6.2 re-records the whole scene on the JS thread whenever the Canvas `children` identity changes. `Reconciler.render` does it twice: a commit, then an explicit `redraw`.

While recording, it reads every dirty animated prop with Reanimated 4's **blocking `runOnUISync`** (`USE_SYNCHRONIZABLE_FOR_MUTABLES`). Each read waits for the UI runtime lock, which the main thread holds for a whole Skia draw pass (≈50–100 ms in debug native).

**Measured cost.** About 250 dirty props × ≈50 ms. A probed switch logged **13.6 s of JS blocked in sync reads**:
- `saveCTM` 117 reads / 5.75 s;
- `pushShader` 59 / 2.9 s;
- initial runs of new body mappers cloning the whole frame, 7 / 1.9 s.

**Where the re-records came from.** `OrreryCanvas` built a fresh children array on every render. `OrreryWorld` also passed fresh `[]`/`{}` defaults (`satellites`, `clusterIds`, `focusedRelationById`), which rebuilt every label paragraph on every render.

**Effect.** A re-record during a System load starved the scene read's promise continuations. The DB read went from 0.1 s to 5–12 s (mutex probe: held 5.6–12.8 s; the same read takes 112–400 ms when no re-record overlaps).

This was hidden in the baseline because the UI freeze in cause 1 left the lock free.

### Why the baseline evidence looked like "serialisation + Hermes"

Causes 1 and 2 are exactly that. Cause 3 only appears once the UI thread is free to render during the commit.

## Fixes (all semantics-preserving)

| Fix | Where | Semantics guard |
|---|---|---|
| The projection basis (usable-rect centre, yaw/tilt trig, focal) is computed once per frame. `projectWithBasis` uses the **identical arithmetic in the identical order**. | `orrery-camera-logic.ts` | New test: `projectFrame` equals `projectWorldPoint` **bit-for-bit** (`toBe`) for bodies, centre and every ring point under obstacles, tilt and yaw. Invalid input still throws. |
| The frame worklet captures only shared values (`transition/progress/cameraFrom/cameraTo`), `sceneGeneration`, memoised `{id, uid}` member identities, `satellites` and `viewport`. Publish ships only `world` + `generation`, not the scene. `onNorth` captures `sceneExtent`. | `OrreryWorld.tsx`, `use-orrery-switch-runtime.ts` | The `orrery-frame-mapper.test` intent is kept: no `camera` capture, and the mapper settles after publication. It now also **fails** on a `switchRuntime`, `scene` or `resources` capture (they are absent from `available`, so the capture is reported as unhandled). |
| `useOrrerySwitchRuntime` returns a memoised object. | runtime | Existing runtime tests pass (the harness gained `useMemo`). |
| `frameBody(frame, key)` does an O(1) lookup through a per-frame `keyIndex`, built once in `projectAnimatedFrame` with first-occurrence semantics. A hit is verified against the body's key, so derived frames (`{...frame, bodies: filtered}`) fall back to a scan. Used by `billboardPose`, labels, rings, label leaders and the focused-satellite reaction. The focus card's satellite key is hoisted out of its `find`. | `orrery-frame.ts` + consumers | Tests: identical to `find(bodyKey)`, safe on filtered frames, and a Proxy check that `billboardPose` touches **≤ 1 body** (the O(N)-per-body regression guard). |
| `billboardMap(frame)` is one small per-frame map. Body and moon billboards read it instead of the whole frame, so a newly created mapper's first JS-side sample no longer clones every ring path. | `orrery-frame.ts`, `OrreryWorld`, `SatelliteBody` | Test: `billboardFromMap(billboardMap(f))` equals `billboardPose(f)` for every key and for a missing key. |
| Skia re-records happen only when drawn inputs change: memoised Canvas content; memoised world, backdrop and overlay layers; stable empty defaults; a HUD viewport object keyed on width and height; moon *components* kept mounted while the same scene briefly withholds rows during a load. The withheld moons are absent from the frame, so they draw nothing and cannot be hit. | `OrreryCanvas.tsx`, `OrreryWorld.tsx` | All render tests unchanged and green. |
| **Stale-camera bug:** `displayedSwitchCamera` uses the live `pose` when settled and the interpolated camera while running. | runtime | 3 new tests: settled switch plus pan/zoom; cold-start Home; mid-switch retarget ignores `pose`. The first two **fail on the old code** (verified by reverting). |
| **Renderer A/B toggle:** a "Lab A renderer (experiment)" switch in View options, backed by an in-memory store (`lab/deep-field-mode.ts`) that defaults to `DEEP_FIELD_ENABLED` and is never persisted. Device-verified: it flips to the legacy flat renderer live (`20-…png`). | `OrreryViewOptions`, `OrreryWorld`, `OrreryFocusContext` | Experiment-only and clearly labelled. The hook avoids zustand's selector hook so the stubbed-React render tests keep working. |

**Unchanged:**
- choreography stages, timing and classification;
- the single sampled world for rings, bodies, labels and hits;
- retarget from the displayed sample;
- lifecycle pause/resume;
- reduced motion (crossfade path untouched);
- settled resource retirement (`settleSwitchChoreography` and prune).

**Tried and dropped:**
- **Starting the switch with `executeOnUIRuntimeSync` instead of `runOnUI`.** It gained only about 100–200 ms; the UI-timestamped start is 90–170 ms after publish with `runOnUI`. Not worth a blocking JS→UI call, so it was reverted.
- **An early `publish→first frame` metric** that read logcat arrival times of UI-thread `console.log`s. It was invalid, because UI logs are forwarded through the busy JS thread. All numbers above use `Date.now()` taken on the UI thread.

## Measurement method

All measurements are on a Pixel 6 Pro with a debug-native APK and production-mode JS from Metro on port 8083, using seeded Lab data (40 contacts, Lab Dense with 32, Lab Inner Circle with 3). Thermal status was 1 throughout.

**Instrumentation.** A temporary probe recorded:
- UI-thread `Date.now()` around the frame worklet: first switch frame, per-run work, run count and wall time;
- JS timestamps for store transitions and publish;
- in some runs, DB-mutex hold/wait and a JS-sync-read timer patched into the bundled Reanimated `mutables.ts` (reverted).

The full patch is in `evidence/perf/probe-instrumentation.patch.txt`. All probes are removed from the committed code.

**Scenario.** Each run: cold start, then All→Lab Dense (the first switch after launch is a settled publication, `isSwitch:false`, in both builds), Lab Dense→All, a focus tap on CR, All→Lab Dense, Lab Dense→Inner Circle, and Inner Circle→Lab Dense. Each step was recorded with `screenrecord`, frame-diffed with `vidan.py`, and the logcat Choreographer/Davey lines were captured. The scripts are in `evidence/perf/logs/` (`scenario.sh`, `lat2.py`).

**Before and after** were measured with identical probes and the same procedure:
- "Before" is HEAD `15ec425a` source plus probes.
- The legacy renderer was measured on the after-build through the new runtime toggle.

**simpleperf** (`-g`, 4 s) was used for thread and symbol attribution.

## What is and is not a valid claim

**Valid:**
- The multi-second main-thread freeze on large-System switches and focus taps is gone.
- The frame-worklet cost fell about 70×.
- The closure payload fell about 800× (bench).
- The switch now animates continuously from start to settle in both renderers.
- All of this holds on this device in debug-native + production-mode JS.

**Not valid:**
- Any fps or frame-time figure for a release build. A release build is needed: debug-native C++ (worklets, RN-Skia glue) inflates every per-frame and per-read cost.
- Absolute switch smoothness. The screen updates at about 4–10 fps here, mostly Skia draw on the main thread.
- Any GPU or RenderThread claim.
- Anything about the emulator.

## Residual issues (ranked)

1. **Entering bodies appear late on large switches.**
   - New bodies' components arrive with the publish commit, and RN-Skia's full re-record then costs seconds of JS through sync reads.
   - Their contact shadows (drawn from the frame) are visible before their discs: `13-committed-…sheet.jpg`, frames 9–12.
   - Retained and leaving bodies, rings, trails and the camera animate on time, and the settled scene is correct.
   - The fix belongs at library/architecture level, not here, and should be judged on a release build. Options:
     - pre-mount body components for the destination before publish;
     - fewer animated props per body (each is a sync read);
     - RN-Skia not re-recording twice per render;
     - drawing bodies from one imperative Picture.
2. **Each Canvas commit (focus change, label change, publish/prune) costs one full scene re-record with blocking sync reads.**
   - It is now rare, but a commit that coincides with a load or a switch is expensive in debug native.
   - Its size in a release build is unknown.
3. **The idle frame is still about 70–100 ms on the main thread** in debug native for Lab A, against about 46 ms legacy (pass 2). This multiplies every sync read (lock-hold time).
4. **The first switch after a cold start is a settled publication** (`isSwitch:false`): it does not animate, in either build. This was observed and not investigated; it looks like the `hasReadySystem` / restore path in `OrreryScreen`.

## HARVEST-worthy for main

This freeze exists on main too: the same frame worklet, runtime and canvas. Each fix is independent and semantics-preserving.
1. `projectFrame` projection basis (`ba3cef68`): pure logic with a bit-exact test, and the largest per-frame win.
2. Narrow frame-worklet captures plus a memoised `useOrrerySwitchRuntime` return plus publish capturing `world`/`generation` only, and the strengthened mapper-test guard.
3. `frameBody` key index and `billboardMap`, with their tests.
4. Memoised Canvas content in `OrreryCanvas` and stable empty defaults in `OrreryWorld`. Main has the same fresh-`[]` defaults and the same fresh Canvas children.
5. The moon-component "keep mounted while rows are withheld" rule. It depends on the satellite gate in `OrreryScreen`; review it against the D-09/11 satellite rules when harvesting.
6. The stale-camera fix (`20538bd1`) with its tests. It is a real baseline bug on main.

Not for main: the A/B toggle, which is experiment-only.

## Device state left

- Device in production-mode JS (`js_dev_mode_debug=false`).
- Metro running on port 8083 (tmux `orbit-lab-a`).
- `adb reverse tcp:8081 tcp:8083` still in place.
- Lab A renderer selected (the toggle resets on app start).
