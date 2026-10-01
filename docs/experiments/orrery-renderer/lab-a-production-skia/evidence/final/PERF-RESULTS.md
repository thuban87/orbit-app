# Lab A: release-build performance results

**Date:** 2026-10-01.
**Build:** a **release** APK (`assembleRelease`, JS bundle embedded, Hermes, minified, not debuggable) of commit `6ad5a307` (HEAD of `experiment/orrery-skia-production`).
- **Built on:** `droid`, from a clean `git archive` of HEAD.
- **APK:** `com.bwales.orbit.laba`, "Orbit Lab A", 208 MB (all 4 ABIs), sha256 `6444f3c5…e4555f`.
- **Signing:** prebuild debug keystore. It installed over the debug build with `adb install -r`, so app data (the seed) was kept.

**Device:** Pixel 6 Pro (`raven`), USB, 1440×3120, display at **120 Hz** (frame budget 8.3 ms).
- Thermal status was 1 (light) for the whole session.
- The phone was on USB power, but the battery still fell from 61 % to 48 % during testing.

**Data:** the seeded Lab set.
- All Contacts: 40 contacts, 39 orbiting.
- Lab Dense: 32 members.
- Lab Inner Circle: 3 members.
- Satellites on (5 moons). Density Balanced. Galaxy theme, dark.

**Renderer A/B:** both renderers ran in the same release process through View options → "Lab A renderer (experiment)". That toggle is **not** DEV-gated and works in release. It is in-memory and resets to Lab A on app start.

Runs alternated legacy / Lab A to spread drift and heat evenly. No probes or instrumentation were added to the app.

## What the numbers cover (read this first)

### RN-Skia draws into a TextureView, not into the HWUI frame

RN-Skia 2.6.2 on Android draws each `<Canvas>` into a **`SkiaTextureView`** (`SkiaBaseView` creates a `TextureView` unless `opaque` is set; `OrreryCanvas` does not set it).
- Rendering is posted to the **main thread**: `RNSkView::requestRedraw` → `runOnMainThread` → `renderImmediate`.
- Skia renders into the TextureView's `SurfaceTexture` there, on its own GPU context.
- Every new texture frame invalidates the view. HWUI then composites the texture as a layer in the app window's next frame.

### What that means for `dumpsys gfxinfo`

- **Frame count:** it counts the app window's HWUI frames. Each Skia present causes one, so the count *is* a fair measure of how often the Orrery reaches the screen.
- **Frame time:** HWUI frame time (`IntendedVsync` → `FrameCompleted`) is mostly time the main thread was busy. That includes the Reanimated frame callbacks in the animation phase, and the posted Skia render when it delays the next `doFrame`. It does **not** isolate Skia's own draw cost.
- **`gpu` percentiles:** these are HWUI's GPU work for the window composite. They are **not** Skia's GPU time for the texture.
- **JS thread:** gfxinfo does not see it.

### Complementary measures used

- **Per-thread CPU** from `/proc/<pid>/task/*/stat` deltas.
- **`screenrecord` frame analysis:** number of captured frames, plus content changes between consecutive frames at 180×390 grey, with the status bar excluded.
- **Tap-relative timelines.** The device clock is stamped at the tap and at screenrecord's "Content area" line; the video's pts 0 is taken to be that line.
  - Checked against a sheet-open tap: the response showed 0.2–0.3 s later.
  - Timings are **±0.1 s**. Video frames are 60–250 ms apart in these scenes, so that is also the resolution.

### Perfetto

One Perfetto system trace of a Lab A switch is saved (`perf/trace-lab-switch-all-to-dense.pftrace`): atrace gfx/view/input/am/dalvik plus sched, app tracing on.
- It was **not analysed**: `trace_processor_shell` (v30–v57) dumps core on this box's Ivy Bridge CPU, which has no AVX2.
- Open it at ui.perfetto.dev on another machine.

## 1. Idle on All Contacts overview, 10 s (ambient running)

Recenter, wait 3 s, `gfxinfo reset`, wait 10 s, dump. 3 runs each.

| | Legacy (3 runs) | Lab A (3 runs) |
|---|---|---|
| Frames in 10 s | 127 / 126 / 121 (**≈12.5 fps**) | 119 / 118 / 113 (**≈11.7 fps**) |
| Janky | 100 % | 100 % |
| p50 / p90 / p95 / p99 (ms) | 44–46 / 109–113 / 113–121 / 121–133 | 48–53 / 113–129 / 150 / 150 |
| HWUI GPU p50 / p90 / p99 (ms) | 9 / 11 / 11 | 12 / 14–16 / 17 |
| Animation phase in `doFrame`, p50 / p90 (ms, framestats) | 19 / 44–68 | 20 / 41–58 |
| RenderThread sync→complete p50 (ms) | 9.3 | 11.8 |
| screenrecord frames captured (8 s) | 9.2 fps | 12.5 fps |
| **Main-thread CPU** (`/proc`) | **≈91 %** | **≈92 %** |
| RenderThread / JS thread CPU | 2 % / ≈0 % | 2 % / 1–2 % |

**What this shows:**
- **The Orrery saturates the main thread in both renderers.** With the Orrery unmounted (Digest tab), main-thread CPU is ≈10 % and no frames are produced.
- The JS thread is nearly idle.
- In release, both renderers present about 12 frames per second at idle on a 120 Hz panel.
- Lab A's extra GPU composite cost is small: about +3 ms HWUI GPU and +2.5 ms RenderThread.

## 2. Scripted pan, 10 s

Alternating `adb shell input touchscreen swipe 300 1800 1100 1600 600` and its reverse: 12 swipes in 10 s. 3 runs each.

| | Legacy | Lab A |
|---|---|---|
| Frames in 10 s | 47 / 52 / 53 (**≈5 fps**) | 51 / 43 / 50 (**≈4.8 fps**) |
| Janky | 100 % | 100 % |
| p50 / p90 / p95 / p99 (ms) | 113–150 / 150 / 150–200 / 200 | 125–150 / 150–200 / 200 / 200–250 |
| HWUI GPU p50 / p90 (ms) | 8 / 10 | 13–14 / 15–16 |
| Animation phase p50 / p90 (ms) | 26–35 / 52–72 | 25–44 / 58–83 |
| screenrecord, while panning | ≈6 captured fps; camera visibly steps every 200–250 ms | ≈5.6 captured fps; same stepping (`vpan-lab` sheet) |

Panning in release is **≈4–5 fps in both renderers**. Lab A is not measurably worse than legacy here. Both are far from smooth.

## 3. System switch (screenrecord + gfxinfo)

Times are seconds after the tap. 3 runs per direction per renderer.
- **Settle:** the last content change ≥ 0.8 (mean grey diff) in the motion burst.
- **Visible frames:** distinct changes between the tap and the settle.
- In every run, the first visible response (the selector sheet closing) came 0.02–0.3 s after the tap.

| Switch | Legacy settle | Legacy visible frames (fps) | Lab A settle | Lab A visible frames (fps) | Lab A identity resolved |
|---|---|---|---|---|---|
| All → Lab Dense (39 → 32) | 2.42 / 2.45 / 2.49 | 9–10 (3.6–4.1) | 2.25 / 2.44 / 2.53 | 6–10 (2.7–4.1) | no entering bodies, so n/a |
| Lab Dense → Inner Circle (32 → 3) | 2.42 / 2.72 / 2.77 | 8–17 (2.9–7.0) | 2.40 / 2.41 / 2.51 | 12–13 (4.8–5.4) | **8.0 / 9.1 / 9.2 s** |
| Inner Circle → All (3 → 39) | 2.19 / 2.36 / 2.38 | 18–28 (7.6–12.8) | 2.22 / 2.23 / 2.29 | 18 (≈8) | **3.4 / 3.5 / 3.7 s** |

**What gfxinfo shows over the 12 s window** (switch plus about 9 s settled; window-level context only):
- **Legacy:** 136–322 frames, p50 8–53 ms, p99 117–250 ms.
- **Lab A:** 134–193 frames, p50 16–61 ms, p99 150–300 ms.

**No skipped-frame or Davey lines were logged by the app's process** during the focus runs where logcat was captured. The only "Skipped ~680 frames" lines came from *other* processes (`com.bwales.orbit` and Plex in the background).

**Interpretation.**
- The multi-second freeze is gone in release, as it was in production JS (PERF-PASS).
- Both renderers play the full ≈2.2–2.5 s choreography and settle on time.
- The switch is shown at only **3–13 visible fps**. The main thread is the limit.

**"Late identity" (PERF-PASS residual 1 / PASS-3 item 3) persists in release.**
- When bodies *enter* (Lab Dense → Inner Circle, Inner Circle → All), Lab A shows the neutral arrival ghosts at settle.
- Real discs, photos, initials and status ink resolve later:
  - **≈1.2–1.5 s after settle** going into All Contacts;
  - **≈5.5–6.8 s after settle** going into Inner Circle (8.0–9.2 s after the tap; 8.7 s in `31-…mp4`).
- Legacy has no ghost stage and shows nothing missing at settle in these clips.
- Two of the three Lab A All → Lab Dense runs show a low-amplitude whole-frame change at ≈8.5 s, with no visible identity change. Its cause was not identified.

## 4. Focus tap on Clara Ruiz (All Contacts overview)

The focus is measured as the first large change after the tap: the camera jump plus the card.
- Legacy: 6 runs. Lab A: 5 runs with a response, plus 1 run with **no response within the 10 s window**.

| | Legacy | Lab A |
|---|---|---|
| Tap → camera/card (s) | 0.43, 3.7, 6.0, 6.6, 6.7, 6.7 | 3.6, 6.3, 8.8, 8.8, 8.9, (>10 once); evidence clip `32`: 3.2 |
| Tap → reticle (Lab A) | — | Same burst as the camera, about +0.2–0.3 s after the card (`32` sheet: card 3.0–3.2 s, reticle 3.45 s, labels 3.8 s) |
| Camera motion | Jumps in 2–3 visible frames | Jumps in 2–4 visible frames |

**Focus response latency is long and highly variable in release, in both renderers.** Lab A is slower on median: about 8.8 s against 6.3 s.
- The app logged no main-thread skip. The JS thread is nearly idle at the time of the tap.
- So the wait is consistent with queued work behind a saturated main thread, which carries the mount, the sync reads and the Skia re-record. **This was not traced; it is not a proven attribution.**
- The PASS-3 claim "reticle lands in the same frame the camera starts" still holds in release.
- The *camera* itself starts seconds after the tap, so the user waits regardless (PASS-3 shortcoming 2).

## 5. Reduced motion (`transition_animation_scale=0.0`, restored to 1 afterwards)

| | Legacy | Lab A |
|---|---|---|
| Idle frames in 10 s (3 runs) | **0 / 0 / 0** (static, no redraws) | **109 / 92 / 85** (≈9–11 fps) |
| p50 / p90 (ms) | — | 57–81 / 97–150 |
| Main-thread CPU | ≈22 % | **≈91 %** |
| Picture changes (screenrecord, 8 s) | — | 7 small changes, max diff 0.3: visually static |

**Finding:**
- Under reduced motion, Lab A's picture is visually static, as designed (sky, sun, corona, reticle and twinkle all have static paths).
- But Lab A **still re-renders about 10 times a second and keeps the main thread saturated**. Legacy stops completely.
- Something on the Lab A path produces a new drawn input every frame even when every animated value is static. Candidates include derived uniform objects (`BodyOverlays` corona/granule `uniforms`, `DeepFieldBackdrop`), which return fresh objects each run. **Not root-caused.**
- The Reduced-Motion switch itself behaves correctly (`33`): the sheet closes, then the scene cuts or crossfades to the settled destination within about 0.5–0.75 s.

## 6. Memory (`dumpsys meminfo`, PSS in MB)

Each renderer started from a cold app start. A **switch** here is one All ↔ Lab Dense change.

| Point | Legacy | Lab A |
|---|---|---|
| After load (All Contacts) | PSS 806, GL mtrack 418, Native 120 | PSS 693, GL mtrack 315, Native 117 |
| After 10 switches | PSS **1014**, GL 602, Native 143 | PSS **1010**, GL 592, Native 150 |
| Same process, after 10 more switches | PSS 1085, GL 644, Native 159 | — |
| Same process, after 9 more (one picker miss) | PSS 1027, GL 571, Native 174 | — |
| Same process, toggled to Lab A, after 10 more | — | PSS 1060, GL 598, Native 188 |
| After 10 more | — | PSS 1069, GL 609, Native 186 |

**Interpretation:**
- Both renderers grow by about 200–320 MB over the first 10 switches, mostly **GL mtrack** (GPU textures).
- They then **plateau around 1.0–1.09 GB PSS** over a further 39 switches. That is not unbounded growth, so it is **no evidence of a leak**.
- Native heap creeps up by about 10–20 MB per 10 switches through the later phase.
- About **1 GB PSS** steady state is heavy for a phone, and the same for both renderers. It points to shared texture/picture caching (photo derivatives, Skia caches), not to Lab A.

## 7. Thermal (2-minute Lab A soak: pans plus switches)

| | Before | After |
|---|---|---|
| Thermal status | 1 | 1 |
| Battery temp (°C) | 38.5 | 38.6 |
| CPU BIG / MID / LITTLE (°C) | 63 / 61 / 60 | 65 / 64 / 64 |
| GPU G3D (°C) | 58 | 58 |
| Battery level | 50 % | 49 % |

The soak ran 6 switches plus continuous pans. gfxinfo over it: 1976 frames (≈13 fps, picker sheet animations included), 97.5 % janky, p50 57 ms.

There was no thermal escalation. Note that the phone was already warm, at status 1, from about an hour of testing.

## Limits of these claims

- **One device and one data set.** The Pixel 6 Pro (Tensor G1) has a strong GPU, and the main thread is the limit.
- **gfxinfo frame times measure the main thread and HWUI composite, not Skia's draw.**
- CPU percentages are tick deltas over a sampling window that includes the `/proc` scan, so they read slightly low. ±10 points.
- **Video timings are ±0.1 s.** "Visible frames" undercounts near-identical frames (threshold 0.3 mean grey diff).
- **Recording costs CPU.** screenrecord runs were separate from the gfxinfo-only idle and pan runs; the switch gfxinfo was captured *with* recording on.
- **The adb pan is not a real finger.** Event rate and velocity differ. Only the relative legacy-vs-Lab A comparison is meaningful.
- **The Perfetto trace is unanalysed.** No root cause is claimed for the main-thread saturation, the focus latency or the reduced-motion redraws.

## Bottom line

1. **In release, Lab A costs about the same as legacy:** idle ≈12 fps, pan ≈5 fps, switch settle ≈2.2–2.5 s, same memory plateau, no thermal rise. Its HWUI GPU composite is ≈3–5 ms higher.
2. **Release does not make the Orrery smooth in either renderer.** The main thread is ≈90 % busy at idle. This is the dominant problem and it is **shared** (frame worklet plus RN-Skia main-thread rendering), not specific to Lab A.
3. **Lab A regressions confirmed in release:**
   - late identity on entering bodies: 1.2–6.8 s after settle;
   - continuous redraws under reduced motion (legacy goes idle);
   - slower median focus response.

## Files

- **`perf/raw/`:**
  - per-run `gfxinfo` and `framestats` dumps, plus parsed `.json`: `idle-*`, `pan-*`, `rm-idle-*`, `sw-*`, `fo-*`, `soak-lab` (the screenrecord idle and pan figures are quoted in the text; those clips are not committed);
  - `meminfo` (`mem-*`);
  - thermal and battery (`soak-*`);
  - focus logcat;
  - `switch-timelines.jsonl` and `focus-timelines.jsonl`, the tap-relative change timelines.
- **`perf/tools/`:** `gfxparse.py`, `vfps.py`, `swan.py`, `swsum.py`, `lib.sh` (the drivers used; paths are the session scratchpad) and `pf.cfg` (the Perfetto config).
- **`perf/trace-lab-switch-all-to-dense.pftrace`:** a Perfetto trace of one Lab A All → Lab Dense switch, about 7 s, tap ≈1.5 s in.
