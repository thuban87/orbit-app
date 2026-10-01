# Switch stall — investigation and fix (Lab B)

Date 2026-10-01. Branch `experiment/orrery-skia-unleashed`. Commits: `ea137306` (fix 1),
`038a8d97` (fix 2), `3c0f691b` (fix 3). Evidence: `evidence/07-switch-stall/`.

**All numbers come from the desktop EMULATOR (`emulator-5554`) on RELEASE builds.** They are
relative A/B on one target, not phone performance. R1 must repeat them on the Pixel.

## 1. Symptom

A switch between large Systems (All Contacts 140 ↔ Lab B Dense 120 ↔ Lab B Inner Circle 12)
blocked the Android main thread for 3–7 s right at the start: Choreographer reported
160–430 skipped frames. It happened on both renderers. It did not depend on the switch FX or
on the bodies, labels or rings flags. The switch choreography runs on wall-clock time, so a
big switch was nearly over before any frame appeared. Small ↔ small switches were fine. A
single `kill -3` sample showed `RNSkia::JsiRecorder::applyUpdates` on the main thread.

## 2. Method

There is no profiler for a release, non-debuggable app on this emulator image, so I used
temporary instrumentation. The full patch is in `evidence/07-switch-stall/12-instrumentation.patch`
and was never committed. Metro bundles the three libraries from `src/`, so I patched the
copies in `node_modules` and synced them to droid:

- **Reanimated `mappers.ts`.** Logs any gap between mapper runs over 100 ms (= main thread
  busy), each mapper start/stop count, any slow mapper over 3 ms, and any `extractInputs`
  walk over 5 ms. It also prints a per-worklet breakdown (`stallTimed`) on slow frames.
- **Worklets `threads.native.ts`.** Times every `scheduleOnUI` batch on the UI thread: wall
  time, time inside jobs, and the gap before each job. The gap before a job is the time
  spent deserialising its closure.
- **RN Skia `Container.native.ts`.** Logs each canvas redraw with its JS-side visit time and
  the number of bound SharedValues, plus the first-draw and `applyUpdates` / `play` times on
  the UI thread.
- **App.** A JS event-loop lag probe, store transitions, and the publish worklet's start and
  end.

I drove the panel quick switch with adb, read logcat, and toggled layer flags by deep link.
Uninstrumented before/after runs use `dumpsys gfxinfo` plus Choreographer skips over a 10 s
window, and normal-speed `screenrecord` clips analysed with ffprobe for frame gaps.

## 3. Root cause

### 3.1 The main-thread stall: one mapper restarted on every render, with a huge closure

`OrreryWorld`'s `frame` derived value is the projection worklet in the model half, shared by
both renderers. Its closure captured two things:

- **`switchRuntime`.** `useOrrerySwitchRuntime` returns a new object literal on every
  `OrreryScreen` render. It carries `resources`, roughly 260 entries during a big switch,
  and every entry references a whole `OrrerySceneSnapshot`.
- **`scene`.** The whole snapshot: contacts, world, gravity map and system snapshot.

`useDerivedValue` without explicit dependencies uses the closure values as its dependencies.
The worklet was therefore re-created on **every `OrreryScreen` render**, and a big switch
causes 6–11 of them: store loading, ready, publish, focus, satellites, prune and so on. Each
re-creation schedules a `startMapper` job on the UI thread. The instrumentation identifies it
as the only slow mapper start, `svInputs=9`, which is exactly the frame worklet's shared
values. Each start costs:

- **0.43–0.65 s** to deserialise the closure on the UI thread. This is the "GAP-before" of
  the job (`08-instrumented-baseline…txt`).
- **~0.15 s** in `extractInputs`, which walks every plain object and array of the closure
  recursively, looking for shared values.

All UI jobs scheduled within one JS tick run as one batch. The restarts therefore line up
into contiguous main-thread blocks: on Inner → Dense, 4–6 batches of 0.6–0.8 s, a 3.6–4.5 s
gap and 216–267 skipped frames. Skia's `applyUpdates` never took more than 8 ms. It showed up
in the original stack sample only because the Skia mapper runs at the end of those batches.
The cost grows with the captured graph, meaning resources × scene, which is why only big
switches stalled. It sits in the model half, which is why it hit both renderers and ignored
every layer flag. With bodies, labels and rings all off (27 bound values), the stall stayed
(202 skipped).

### 3.2 The remaining JS-thread blocks and slow frames: declarative per-body Skia nodes

Once 3.1 was fixed there were no more skipped frames. But the JS thread still froze for
**2.5–7.3 s** per big switch (`09-instrumented-fix1…txt`), and the entering bodies were
committed to the canvas long after the 2.1 s choreography had started. The cause is RN Skia
2.6.2's declarative recorder:

- **Every commit to the canvas re-records the whole tree on the JS thread, twice.**
  `SkiaSGRoot.render()` redraws again after the reconciler's `resetAfterCommit` has already
  done so.
- **Every bound SharedValue is read during recording.** The C++ `convertProperty` calls
  `.value` on the JS runtime. Reanimated 4's guest getter turns a dirty value into a
  **synchronous `runOnUISync`**, which waits for the UI thread.
- **Lab B Dense bound 3,193 values:** labels 1,920 (about 16 per label), bodies 877 and rings
  369. They ran through 3,786 mappers, at about 80–126 ms of UI per animated frame.
- **The result:** each redraw visit blocked JS for 1–4.5 s while the UI was busy, the
  canvas's own mapper restarted over all 3,193 values, and `OrreryScreen` re-rendered about
  11 times per switch. In the component path a simple focus change also took more than 5 s
  to commit (`13-…jpg`).

### 3.3 Ruled out (measured)

| Suspect | Finding |
|---|---|
| SQLite / scene load | From the loading to the ready transition takes 200–350 ms on JS, before publish. It does not run on the main thread. |
| Photo decode | Photos load asynchronously off the critical path. Skia first-draw stayed under 8 ms and `play` under 35 ms. |
| Shader re-creation / `applyUpdates` | Under 8 ms per run, even with 3,193 values. |
| Switch FX | The stall was identical with FX on and off (WP-2.1). After the fix, FX are the largest per-frame cost (§5). |
| Debug-only artefact | The stall reproduces on the uninstrumented RELEASE build: 6e6fd2a3 skipped 216–371 frames in the lab and 216–427 in legacy. |

## 4. Fixes

1. **`ea137306`, model half (`OrreryWorld`, so it also fixes legacy).** The frame worklet
   now captures only the switch runtime's shared values (destructured), scalars from the
   scene (`generation`, `extent`) and id/uid member identities. Empty `[]`/`{}` defaults are
   stable constants, and `clusterIds` is keyed by its content. The tap and north gesture
   worklets capture the same small data. The frame-mapper test's capture map is updated.
   There is no semantic change.
2. **`038a8d97`, flag `layerPictures` (default ON).** Contact bodies and moons, labels, and
   class rings and wakes each draw as **one SkPicture recorded per frame on the UI thread
   from one derived value**:
   - **Plans are pure worklets** (`labb-layer-plan.ts`). They reuse `labBillboard`,
     `hudTagPlacement` and the legacy label rule, and depth-sort with ties stable, split
     around the sun, which stays declarative.
   - **Uniforms** use the same blocks, flattened in SkSL declaration order.
   - **Photos** load through `useOrreryPhoto` probes outside the canvas. The picture
     captures cover-fit image shaders (C-50).
   - **Results:** bound values on Dense fall from 3,193 to 47 and mappers from 3,786 to 85.
   - **Unchanged:** hit-testing, label allocation and taps (the model half is untouched),
     focus visuals and depth order. A/B screenshots (`07`, `13`, `14`) differ only in
     animated pixels. Reduced motion stays static (`06`: diff only in the HUD box).
3. **`3c0f691b`, `memo(LabBRenderer)`.** A comparator checks `switchRuntime` by its parts
   and the ghost element by its props. Canvas renders per switch drop from about 11 to 6–7,
   each still a double redraw in the library.

## 5. Before / after

Emulator, release builds, uninstrumented. Full table in
`evidence/07-switch-stall/15-gfxinfo-summary.txt`.

| Big switch, 10 s window | Before 6e6fd2a3 | After 3c0f691b |
|---|---|---|
| Choreographer skipped frames, max per event (lab) | 216–371 | **0** |
| Same with `layerPictures:0` (fixes 1 + 3 only) | — | 0 (but p50 34 ms) |
| Legacy renderer, skipped max | 216–427 | 33–120 (its own ~200 ms frames) |
| gfx frames rendered (lab) | 67–163 | 196–260 |
| Longest frozen interval in a normal-speed recording | 3.8 s / 4.9 s | 0.18 s / 0.17 s |
| Bound SharedValues (Dense) / mappers | 3,193 / 3,786 | 47 / 85 |
| JS-thread blocks per switch (instrumented) | 3–4.5 s stall, then up to 7.3 s after fix 1 | ≤ ~1 s |
| UI mapper time per animated switch frame (instrumented) | 80–126 ms | 50–60 ms |

**Remaining per-frame UI cost during a switch** (`11-…txt`):

| Worklet | ms per frame |
|---|---|
| WP-2.1 ring-trim picture | 15–24 |
| Wake picture, at settle | 11–14 |
| Frame projection | 5–8 |
| Bodies picture | 2–7 |
| Label allocation | 1.5–3 |
| Rings picture | 1–2 |

The trim picture builds one `Paint` and one `MakeSweepGradient` per leaving or entering
ring. This is the next target (C-48), not the stall. The before/after sheet is
`05-sheet…jpg`: before, the screen is frozen from 1.0 to 4.5 s and then jumps to the end
state. After, the full showcase plays at normal speed (streaks, comets, entering bodies).

## 6. Implications

**Is declarative RN Skia viable at 100+ bodies?** Not as one component per body with
animated props, on RN Skia 2.6.2 and Reanimated 4.5:

- The cost is O(bound values) synchronous cross-thread reads on every canvas commit
  (doubled by the library), plus O(mappers) per frame, plus O(nodes) React mount at a
  switch.
- The declarative tree remains a good fit for the scene structure: layers, the sun, FX and
  overlays. N-body content should be **one imperative UI-thread picture per layer**, or an
  Atlas where a single texture fits, fed by one derived value. That is what the lab now
  does, and it costs less per frame too (bodies picture 2–7 ms).

**V2 rules:**

1. **Worklet closures capture only shared values and small, identity-stable data.** Never
   a scene, a resources list, a context object or a fresh `{}`/`[]` default. A capture
   regression silently re-creates a mapper on every render and deserialises the graph on
   the main thread. Guard it with capture tests like `orrery-frame-mapper.test.ts`.
2. **Keep React renders away from the canvas.** Use memo boundaries with part-wise
   comparators. Every canvas commit re-records twice and synchronously re-reads every bound
   value.
3. **Use layer pictures for any per-entity layer.** Keep the bound-value count per canvas
   in the tens.
4. **Upstream / patch candidates** (not done in the lab: no library patches):
   - drop the redundant second `redraw()` in `SkiaSGRoot.render`;
   - skip the JS-side `.value` read of animated props at record time.

**Legacy renderer.** Fix 1 already applies; its skipped frames per switch fell 3–4×. Fix 3
applies directly as a memo around the `OrreryCanvas` children. Fix 2 is the renderer
rewrite that V2 implies. Legacy keeps its own per-frame ring `Path` cost (WP-1.3/1.4).

**Phone (R1):** repeat §5 on the Pixel 6 Pro with Perfetto on both the JS and UI threads.
Check texture memory for C-50 there, and the trim-picture cost.
