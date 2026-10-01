# Lab A: architecture performance pass

**Date:** 2026-10-01.
**Device:** Pixel 6 Pro (`raven`), USB, 120 Hz, thermal status 1 throughout. Seeded Lab data (40 contacts, 39 orbiting; Lab Dense 32; Lab Inner Circle 3; satellites on).
**Builds:**
- *Debug-native + production-mode JS* (BUILD-LOOP §(i)): the scratchpad debug APK, JS from Metro :8083 (`dev=false&minify=true`). Used for attribution (simpleperf) and relative before/after only.
- *Release* (`assembleRelease` on droid, Hermes, embedded bundle, not debuggable) of commit `fd7f09c8`, sha256 `d009c3301f26e567…`, 208 MB. **Left installed** on the phone.

**Commits:** `fd7f09c8` (renderer + tests); this doc and `evidence/arch-perf/` in the next commit.

## Headline

The ~12 fps / ~91 % main-thread ceiling was **not** Skia drawing, Hermes or the frame worklet. It was how RN-Skia 2.6.2's *declarative* Canvas redraws, combined with two patterns in our tree (a `layer` on every body/label root, and clock-driven values that produce new objects every tick). Replacing the Lab A node tree with an **imperative renderer** (five pictures recorded on the UI thread from the one sampled `frame`) took the release build from 92 % to 16 % main-thread CPU at idle, from ~12 to ~22 fps at idle (now capped on purpose by the ambient rate), from ~5 to ~18 fps while panning, focus response from 3.6–8.9 s to 0.06–0.18 s, reduced-motion idle redraws from ~10/s to **0**, and memory after 10 switches from 1010 MB to 559 MB PSS. Visuals are unchanged (parity sheets below).

**Answer to the lab's core question:** Skia + Reanimated *is* a plausible production architecture for the Orrery, **used imperatively**. The declarative RN-Skia tree with hundreds of animated props and per-node layers is the anti-pattern, and main's legacy renderer has it too.

## 1. Root cause (evidence)

### How RN-Skia 2.6.2 redraws on Android (read from `node_modules/@shopify/react-native-skia`)

- `sksg/Container.native.ts` `NativeReanimatedContainer.redraw()`: on every **React commit** of the Canvas children it walks the node tree on the JS thread (`visit`), building a C++ `JsiRecorder` command list and collecting **every shared value used as a prop**; then `startMapper(…, sharedValues)`.
- That mapper runs on the UI runtime (= the Android **main thread**) whenever **any** of those shared values changes, and does three things, all on the main thread:
  1. `JsiRecorder::applyUpdates` — re-converts **every** animated prop of the tree, changed or not (JSI reads + conversion; a shader `uniforms` object is converted into a `std::map<string, vector<float>>` by name).
  2. `Recorder::play` — replays the whole command list into a new `SkPicture` (zIndex groups sorted per batch).
  3. `setJsiProperty(nativeId,"picture")` → `RNSkView::requestRedraw` → `runOnMainThread` → `RNSkPictureRenderer::renderImmediate` → draw the picture into the `TextureView`'s GL surface → `GrDirectContext::flushAndSubmit` + `eglSwapBuffers`.
- A `layer` prop on a Group (`cpp/api/recorder/Paint.h` `saveCTM`) is `canvas->saveLayer(nullptr, &paint)` — **no bounds**, so every such layer is a full-canvas offscreen render target.
- Reanimated 4.5.1 `useDerivedValue` inputs are **every shared value captured in the worklet closure** (`Object.values(updater.__closure)`, recursing into plain objects), whether or not it is read; `valueSetter` suppresses propagation only when the new value is `===` the old one (primitives), so a derived value that returns a fresh object/picture propagates on every run.

### What our tree did per redraw

- ~40 body roots + ~78 label groups each carried `layer` → ~120 **full-canvas `saveLayer`s per frame** (legacy has the same body/label layers).
- ~550 animated props (per body: transform, zIndex, layer paint, photo opacity, shader uniforms; per label: x, y, textX, textY, opacity, tick x/y, leader path; …) all re-converted per redraw.
- The clock ticked every vsync. Clock-captured derived values (twinkle, corona/sun-disc `uniforms` objects, the reticle `createPicture`) returned new objects every tick → a full redraw every tick, **also under reduced motion** (they captured the clock even when they did not read it): that is why Lab A kept redrawing ~10/s under RM while legacy (primitive-returning clock values) went idle.
- Every React commit (focus, publication, label rebuild, photo resolve) re-recorded the tree on JS with blocking sync reads of every animated prop (PERF-PASS residual 1/2) — while the main thread, which owns the UI-runtime lock, was saturated. Hence 6–9 s focus responses and identities arriving seconds after a switch settled.

### simpleperf, main thread, idle on All Contacts (debug-native + prod JS, 6 s @ 4 kHz)

`evidence/arch-perf/simpleperf/before-idle-main-thread.txt`:

| Inclusive | Where |
|---|---|
| 98.8 % | Reanimated frame callback → Skia container mapper |
| **58.2 %** | `renderImmediate` → `flushAndSubmit`: Mali driver framebuffer binds/subpass allocation per layer — `__ioctl` 15.2 % self, `munmap` 12.8 % self (`cmemp_hoard_purge_hunks`), `gles_fb_bind_framebuffer` 13.7 %, `make_subpass_attachment` 11.9 % |
| **25.1 %** | `JsiRecorder::applyUpdates`, of which **15.1 %** converting `map<string, vector<float>>` (shader uniforms) |
| **13.5 %** | `Recorder::play` (replaying the command list) |
| 3.9 % | all of Hermes (the worklets themselves are cheap) |

So: ~58 % layer/driver churn + ~39 % RN-Skia declarative bookkeeping; JS was never the problem.

## 2. The design (prototype, committed)

`src/components/orrery/lab/`:

| File | Role |
|---|---|
| `LabScene.tsx` | The only Lab A node inside `<Canvas>`: **one Group of five `<Picture>`**. All inputs are shared values, so React commits never change this tree and RN-Skia never re-records it. |
| `scene-draw.ts` | UI-thread worklets drawing everything imperatively: sky (`drawSky`), Polaris, reorder ghost, contact/sun/moon bodies (incl. BODY/CORONA/SUN_DISC runtime shaders with flat uniform arrays), labels + context lines + leaders, stack pips. `orderBodies` reproduces RN-Skia's zIndex flush (depth asc, source-order ties). |
| `scene-specs.ts` | JS-thread builders of immutable per-body specs (token RGBA, pre-shaped initials `SkParagraph`s, SkImage + size, fade stamps). |
| `use-lab-photos.tsx` | Photo loading (unchanged `useOrreryPhoto`, one null-rendering slot per body, **outside** the Canvas) + SkImage custody. |
| `reticle-draw.ts`, `sky-resources.ts` | Moved, unchanged, out of the deleted `FocusReticleLayer` / `DeepFieldBackdrop`. |
| `world-plane.ts` | Unchanged (`drawWorldPlane`). |

Deleted: `WorldPlaneLayer.tsx`, `BodyStackLayer.tsx`, `DeepFieldBackdrop.tsx`, `FocusReticleLayer.tsx`. The **legacy renderer** (A/B toggle off) keeps the declarative tree, with its dead Lab branches removed from `OrreryWorld`.

### The five pictures and when each re-records

| Picture | Content | Re-recorded when |
|---|---|---|
| `below` | sky, world plane, Polaris, ghost, bodies drawn before the sun | frame / switchFx / focus / specs / drag / fade window change |
| `sun` | the sun(s): corona, granulation, flare | + each **ambient** tick |
| `above` | bodies drawn after the sun (depth order) | as `below` |
| `reticle` | focus reticle (lock-on, scan) | focus / lock / ambient — a **reference-stable empty picture** when nothing is focused |
| `top` | labels, context lines, leaders, stack pips | frame / allocations / label specs |

- **Base texture cache.** After the skip experiment below showed the world plane's stroked polygons dominated the remaining flush cost (Ganesh re-tessellates them every flush), `below` is rasterised once per change into a device-pixel offscreen surface (`Skia.Surface.MakeOffscreen`, same thread-local GL context as the view; released on unmount) and drawn as one image. Ambient-only redraws now blit it.
- **No full-canvas layers.** A body/label opens a layer only while partially transparent (mount/switch fades), **bounded** to its own extent. The pass-3 focus dim is a background-ink veil over the disc plus halo-alpha (layer-free).
- **Conditional redraw.** `ambient` is a primitive: the single clock quantised to `AMBIENT_HZ` (30), or −1 under live reduced motion → an idle canvas under RM redraws nothing; without RM, idle redraws are the sun at 30 Hz.

### What crosses threads, and how

| Resource | Created | Reaches the UI runtime as | Notes |
|---|---|---|---|
| Body specs (token RGBA, sizes, fade stamps) | JS, `useMemo` per publication/photo/theme | shared value written **in render** (async `scheduleOnUI`, never a sync read) | |
| `SkParagraph` (initials, labels) | JS, shaped once (initials cached per style) | host object inside the spec | only `paint` is called on UI, as the declarative `<Paragraph>` did |
| `SkImage` (photos) | JS, `useOrreryPhoto` (D-11/D-41 unchanged) | host object inside the spec | custody below |
| `SkRuntimeEffect` | JS, `labEffect` (cached) | captured host object | `makeShader(float[])` per draw on UI (already proven by the world plane) |
| Star pictures, nebula image, vignette shader, Polaris path | JS, once per size/palette | captured host objects | |
| `frame`, allocations, light map, focus state | UI (unchanged mappers) | shared values | hit testing and label allocation untouched |
| Base texture | **UI thread** (main-thread GL context) | scratch shared value, mutated in place | the RN-Skia rule "GPU resources must be owned by the main thread" holds |

**Photo custody (D-41 rule 3 moved, not weakened).** The renderer draws from a UI-thread copy of its specs, so the hook may no longer dispose a retired image itself. `useOrreryPhoto(path, handOff)` hands each retired image to the custodian (`slot.release`), which disposes it **on the UI runtime, after** the spec write that stopped referencing it (both travel the same FIFO UI queue); on unmount, after a 1.5 s grace. Already-recorded pictures hold their own reference. Last guard: a disposed image throws in RN-Skia, so the photo draw is `try/catch`ed and falls back to the initials. Rules 1, 2, 4 and the default behaviour (legacy path) are unchanged; new slot test.

### Semantics preserved

One sampled frame for rings/bodies/labels/hits (unchanged mappers); hit testing and label allocation untouched (they read `frame`/`allocations`); same draw order incl. zIndex ties; focus/reticle/emphasis/dim; switch FX (trails, ghosts, ripples, flare, warp); reduced motion (fades instant, corona/granulation/scan static, FX idle); theme tokens only (RGBA from tokens; `check:colors` 0); lifecycle (canvas unmount stops everything; surface released); single clock (`OrreryCanvas`); worklet helper order (test scans the new files); accessibility unchanged (canvas still has none; companion sheet).

**Parity notes (deliberate):**
- RN-Skia's `drawPicture` takes no paint, so the declarative twinkle and warp-ghost `Group opacity` **never rendered**: near stars always drew at full alpha, overdrawn by the 5 warp copies. That on-screen result is reproduced exactly (the intended twinkle would dim the sky — an owner call, not taken).
- Photo clip is now anti-aliased (declarative `clipRRect` was not). Slightly cleaner edge.
- Ambient (corona, granulation, reticle scan) now animates at 30 Hz instead of display rate (`AMBIENT_HZ`, one-number tunable).
- During a switch with two suns (old + new), both draw in the sun slot of the first sun in depth order (tilt-0 ties make this invisible in the clips).

## 3. Measurements

### Debug-native + production JS (relative only) — `evidence/arch-perf/debug/`

| Metric | Before (`730899b4` src) | After (`fd7f09c8`) |
|---|---|---|
| Idle frames / 10 s | 48–79 | **223–224** |
| Idle p50 / p90 (ms) | 77–150 / 150–200 | **6–7 / 13** |
| Idle main-thread CPU | 93–94 % | **21 %** |
| Pan frames / 10 s (p50) | 29 (200 ms) | **110 (12 ms)** |
| Reduced-motion idle frames / 10 s | 80–92 | **0** |
| Reduced-motion main-thread CPU | 94 % | 17–26 % |
| All↔Dense switch: frames in 9 s window | 66–90 | 141–144 |
| Switch: visible changes tap→settle | 7–8 (settle 2.5–2.8 s) | 13–14 (settle 2.2–2.4 s) |
| Focus tap → first visible change | **no response within 12 s (3/3)** | **0.18–0.34 s** |

Section-skip experiment (temporary flag, removed), before the texture cache: idle 122 fr / p50 29 ms / 58 % CPU; skipping the sky, bodies or labels changed nothing; **skipping the world plane** gave 187 fr / p50 6 ms / 23 %. That motivated the base-texture cache (→ 223 fr / 6 ms / 21 %).

### Release (same protocol as `evidence/final/PERF-RESULTS.md`; Lab A only — legacy numbers stand there) — `evidence/arch-perf/release/`

| Metric | Lab A before (PERF-RESULTS) | Lab A after |
|---|---|---|
| Idle frames / 10 s (3 runs) | 119 / 118 / 113 | **225 / 225 / 199** (ambient-capped ≈ 22 fps by design) |
| Idle janky / p50 / p90 / p99 (ms) | 100 % / 48–53 / 113–129 / 150 | **1–3 % / 6–9 / 11–13 / 16–23** |
| Idle main-thread CPU | ≈ 92 % | **15–16 %** (RenderThread 8–9 %) |
| Pan frames / 10 s | 51 / 43 / 50 (≈ 4.8 fps) | **188 / 172 / 175 (≈ 18 fps)**, p50 38–40 ms, 53–56 % janky |
| Switch settle All→Dense / Dense→Inner / Inner→All (s) | 2.25–2.53 / 2.40–2.51 / 2.22–2.29 | 2.06–2.13 / 1.80–1.86 (plus one 1.4 change at 2.23–2.30) / 2.13–2.19 |
| Switch visible changes tap→settle | 6–18 | 19–24 |
| Entering identity (photos/initials/status) | 8.0–9.2 s (→Inner), 3.4–3.7 s (→All) | **resolved at settle** (frames at +2.4 s = +5 s; `switch-identity-at-settle-sheet.jpg`) |
| Focus tap → camera/card | 3.6, 6.3, 8.8, 8.8, 8.9, >10 s | **0.06–0.18 s** (6/6), settled ≈ 0.7 s |
| Reduced-motion idle frames / 10 s | 109 / 92 / 85 | **0 / 0 / 0** |
| Reduced-motion main-thread CPU | ≈ 91 % | 4–15 % |
| Memory after load: PSS / GL mtrack / Native | 693 / 315 / 117 MB | **460 / 110 / 106 MB** |
| Memory after 10 switches | 1010 / 592 / 150 MB | **559 / 153 / 151 MB** |
| Thermal | 1 | 1 (battery 37.0 → 35.7 °C) |

Switch timings are screenrecord-based (±0.1 s; the recorder itself is a ~8 fps ceiling on visible-change counts). Low-amplitude (0.3–0.4) changes 2–3 s after settle are the photo/mount fades and the ambient corona, not identity.

### Visual parity — `evidence/arch-perf/`

`parity-release-overview-and-focus.jpg` (final 01 vs release; final 12 vs release focus on Clara), `parity-dense-and-inner-circle.jpg` (final 20 vs now; Inner Circle 3 s after the tap), `parity-themes.jpg` (galaxy light and standard dark: final vs now), `parity-overview-crop.png` (detail crop). No regressions seen; identities are present earlier.

## 4. Gates (at `fd7f09c8`)

`npx tsc --noEmit` clean · `npm run check:colors` 0 · biome on `src/components/orrery` + changed test clean · `npx vitest run src/components/orrery src/logic src/services src/stores src/screens`: **250 files, 2463 passed**.

Tests changed: `orrery-render.test.tsx` now pins the **legacy** declarative tree (the Lab tree no longer exists); new `lab/lab-scene-render.test.tsx` pins the new contract (one Group of five pictures; node count independent of body count; no per-body/label nodes; reticle reference-stable when unfocused = no idle redraw) and the semantics the old tests pinned (moon token ink, hidden at overview; depth order flips with yaw, sun in its own picture; label drawn only when allocated). New `lab/scene-draw.test.ts`: uniform-array lengths equal the SkSL declarations (a mismatch throws in `makeShader` and would kill the render loop), zIndex-equivalent ordering, fades, focus dim. `use-orrery-photo.test.ts`: `release` custody hand-off. `orrery-scene.test.ts`: one mock for the new photo-custody module.

## 5. Limits and residual risks

1. **Pan is ≈ 18 fps, not 60.** Each camera frame re-records `below` and re-rasterises it (plane tessellation + an offscreen pass + a copy-on-write blit of an 18 MB texture). V2: build the plane from cached non-volatile paths or `Vertices`, split the plane from the bodies so only the cheap part re-rasterises, or skip the texture while the camera moves.
2. The base texture costs ~18 MB GPU (1440×3120) plus transient copies; measured memory still dropped 230+ MB overall.
3. Reduced-motion idle still burns 4–15 % main-thread CPU: the always-on `useClock` frame callback + Reanimated's frame loop (legacy has the same floor, ≈ 22 %). V2: stop the clock under RM.
4. Photo custody relies on the FIFO UI queue + a 1.5 s unmount grace; guarded by `try/catch` (worst case: initials instead of a photo for a frame). Not exercised with photo *edits* on device this pass.
5. Two-sun ordering during a switch (above). Pinch/detail-zoom context lines still not device-verified (no multitouch automation).
6. Perf numbers are one device, one data set; the Perfetto trace still unanalysed (no AVX2 here). Debug-native numbers are relative only.
7. The **legacy renderer is unchanged and still slow** (A/B toggle kept for comparison).

## 6. Recommendation (V2 / harvest)

- **Architecture:** adopt the imperative pattern for production: tiny stable Canvas tree, pictures recorded on the UI thread from the shared frame, immutable resources prepared on JS, conditional redraw, cached base texture. Never put `layer` on per-item Groups; never return fresh objects from clock-captured derived values.
- **For main (owner decision):** main's renderer has the same full-canvas body/label layers and the same commit-re-record behaviour. Cheapest harvest: remove per-body/per-label `layer` props (alpha via paint where possible). Proper harvest: port `LabScene`/`scene-draw` with the legacy visuals.
- **Next pass:** the pan path (item 1), then RM clock stop.

## Device / tooling state left

- **Release build of `fd7f09c8` installed** (`com.bwales.orbit.laba`); app data kept.
- Settings restored: animation scales 1/1/1, font scale 1.15, Galaxy + Follow System.
- Lab Metro (tmux `orbit-lab-a`, :8083) **stopped**. `adb reverse` restored to exactly `tcp:8081 tcp:8082` (the main app's Metro on :8082 was listening).
- Scripts: `evidence/arch-perf/tools/` (`proto.sh` debug protocol, `relproto.sh` release protocol, `skiprun.sh` section-skip runner; they source `evidence/final/perf/tools/lib.sh` paths in the session scratchpad).
