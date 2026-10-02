# Orrery Lab C — performance log

**Build: DEBUG** (dev client + Metro, JS not minified, Hermes debug). Release-build numbers come later and
will differ (usually better on the JS side). Device: Pixel 6 Pro (Mali-G78), 120 Hz panel, on USB power.
Source: the renderer's own 5 s log line (`[lab-c] frames=… fps=… jsRenderAvg … presentAvg … drawAvg`):
`fps` = JS-thread rAF cadence of the 3D loop, `jsRenderAvg` = CPU to build + submit one frame,
`presentAvg` = time blocked in `context.present()` (GPU back-pressure / fill cost), `drawAvg` = three's
render() CPU. Camera states: "overview" = Home pose; "near" = lab badge preset 1 (×2.2 dolly, identity
label tier); "close" = preset 2 (×3.4 dolly, detail tier).

**Caveat — thermals.** During the Checkpoint C session the phone reached `Thermal Status: 3` (SEVERE,
`dumpsys thermalservice`) after ~25 min of screen recording + rendering while charging. Numbers taken in the
same session are comparable with each other only roughly; the 20 ms `presentAvg` plateaus (≈22.7 fps) seen
after screen recordings are almost certainly GPU throttling, not the scene.

## Checkpoint B.3 (reference, from DECISIONS.md)
- before B.3 (no granulated star / plane disc): ~47–51 fps, jsRender ~11.3 ms
- after B.3: ~42 fps overview, 31–34 fps close (present 4.9 → 10.6 ms)

## Checkpoint C.4 — what changed
1. **DPR cap 2.5 → 2.0** (buffer 1028×1813 → 822×1450, MSAA kept). The decisive lever: the frame is
   fill-bound whenever large bodies / the star / the plane cover the screen.
2. **Orbital-plane disc baked** into a 768² alpha texture once (was `atan` + 2×`fract` + smoothsteps per
   fragment over most of the screen).
3. **Star granulation baked**: 128² tileable 2-octave value noise sampled by longitude/latitude (was
   `mx_fractal_noise_float`, 2 octaves of 3D gradient noise per star fragment).
4. Corona sprite 16 → 11 sun radii (additive full-screen-ish overdraw).
5. Sphere 24×16 → 20×14 segments; ring strip 256 → 160 segments (−32% triangles in Dense: 173.8k → 117.5k).

## Numbers (this session, debug)

| System / camera | before C.4 | after (1–5, DPR 2.5) | after (1–5 + DPR 2.0) |
|---|---|---|---|
| Inner (18 bodies) overview, fresh launch | 43.7 fps (present 3.9 ms) | — | **45.2 fps** (present 3.8 ms) |
| Inner close (×3.4) | 40.6–41.0 fps (present 3.7–4.5) | — | 35.4 fps (present 8.7) ⚠ thermal SEVERE at this point |
| Dense (121 bodies) overview | 32.1 fps (present 10.9) | 35.4 fps (present 7.7) | **47.0 fps** (present 2.0) |
| Dense near (×2.2, 152 incl. moons) | 28.5 fps (present 13.2) | 22.6 fps (present 20.0) ⚠ | **33.6 fps** (present 8.4) |

Reading: steps 2–5 cut GPU cost moderately (Dense overview present 10.9 → 7.7 ms); the DPR cap removed
most of the rest (→ 2.0 ms). At overview the loop is now **JS-bound**: `jsRenderAvg` ≈ 11–13 ms of which
`drawAvg` (three's CPU render + WebGPU encode) is ≈ 10.5–12 ms for only 13–16 draw calls, plus
Reanimated/packet work on the same thread — that ceiling (~45–47 fps) needs a release build or moving the
render loop off the JS thread, not more shader cuts.

Targets: ≥45 overview — **met** (Inner 45.2, Dense 47.0). ≥40 close — **not met in this session**
(Inner close 35.4, Dense near 33.6) with the phone at thermal status SEVERE; re-measure cool.

Not done: dynamic resolution, label-mesh batching (one mesh per label), bloom (still none).

## Checkpoint D.5 — lifecycle / memory (one pass, debug, thermal status 2)

Sequence on Lab C Dense: launch → Orrery, then leave the tab (Digest) and return ×3, then Home/relaunch
(background/foreground) ×3. Renderer log (`[lab-c] mount #N … external=`):

| mount | trigger | Hermes `external` | heap |
|---|---|---|---|
| #1 | first open (after ~2 min of use in the previous process this was 881 MB at first mount, too) | 860 MB | 34 MB |
| #2 | return to tab (after ~2 min viewing, incl. moon orbit) | 2243 MB | 168 MB |
| #3 | return to tab | 2847 MB | 168 MB |
| #4 | return to tab | 3258 MB | 168 MB |
| #5 | foreground | 3696 MB | 159 MB |

Every mount logged `renderer ready` (~2.0 s) and every unmount `loop stopped, GPU resources disposed`;
no device-lost, no JS error. **`external` climbs ~400–600 MB per mount and also grows while the Orrery
stays open** (#1→#2 spans 2 minutes of rendering). Not investigated in this checkpoint (time box spent on
D.1/D.2). Hypotheses to test first, in order: (1) per-flush `ArrayBuffer`s from the body atlas / label
rasterisation (`orrery-textures3d.ts` readPixels-style copies) that Hermes counts as external until a full
GC — check whether `external` drops after a forced `gc()`; (2) DataTexture backing arrays retained by
three's WebGPU backend after `dispose()` (renderer-side texture cache keyed per renderer instance);
(3) the per-mount GPUDevice (`acquireOrreryDevice`) and its buffers if `releaseOrreryDevice` does not
`destroy()`. 860 MB at the very first mount already suggests most of it is allocated before/at module load
(prewarm device, star/plane/noise textures) or comes from photo decoding (40 SkImages) — needs a
per-stage `external` log. **Open: real risk of OOM after many tab visits; must be resolved before any
production decision.**

### D.6 — leak pass (one device session, debug, thermal status 1)

Log: `evidence/06-leak/mount-log-after.txt` (renderer `mem` line every 5 s, `post-unmount` line with a
forced `gc()`, plus `dumpsys meminfo` snapshots from the same session).

| | Hermes `external` | real process memory (`dumpsys meminfo`) |
|---|---|---|
| before Orrery (Digest) | 881 MB at mount #1 | Native Heap 484 MB, Graphics 112 MB, PSS 790 MB |
| mount #1, +5 s | 1569 MB | Native 740 MB, Graphics 271 MB, PSS 1239 MB |
| mount #1, +50 s open (idle) | 1415 MB (flat / falling) | Native 767 MB, Graphics 279 MB, PSS 1271 MB |
| unmount #1 / #2 / #3 → forced `gc()` | 1389→1359 / 2225→1682 / 2759→2257 MB | — |
| mount #2 / #3 / #4 | 2491 / 2815 / 2898 MB | after #4: Native 793 MB, Graphics 283 MB, PSS 1328 MB |

**Finding: the `external` counter mostly isn't real memory.** It still climbs about 300–1100 MB per
mount, but over the same three remounts the real native heap grew only about 26 MB (767→793 MB) and
Graphics about 4 MB. The three counters stay flat (`texs=8 geos=5`, `labelsLive=0`). A forced `gc()`
drops 500 MB or more after each unmount. So most of the counter is **GC-pending host-object memory
pressure that the libraries report**, not retained buffers:

- RN Skia's `JsiSkParagraph.getMemoryPressure()` returns a **flat 1 MB per Paragraph**
  (`node_modules/@shopify/react-native-skia/cpp/api/JsiSkParagraph.h:174`), even after it is disposed.
  The `labels` memo (`OrreryWorld3D.tsx`, `prepareOrreryText` ×2 per body) builds about 240 Paragraphs.
  It rebuilds them on every focus, viewport or scene change and never disposes them. That is about
  240 MB of `external` per rebuild. `BodyAtlas.drawInitials` adds 1 MB per body per `setBodies`.
  The "grows while open" seen in D.5 lines up with focus and moon-orbit changes, not with frames:
  with the Orrery idle in D.6, `external` stayed flat.
- `BodyAtlas.flush` took a full 2560² snapshot (about 26 MB of image pressure) per flush.
  Fixed: it now snapshots only each dirty tile.

**Open:** after a forced `gc()`, the floor still rises about 300–575 MB per mount, so some
pressure-carrying wrappers survive a full GC. Their real cost (a few MB) is small, but Hermes uses this
counter to schedule GCs (about 6–100 GC/s here). Next steps: dispose the old label Paragraphs when
the memo is replaced or the Orrery unmounts, and find what keeps the old wrappers reachable
(suspects: closures captured by worklets or Reanimated, and three's WeakMaps keyed on the destroyed
device). OOM risk is lower than D.5 suggested, because PSS grows only about 20 MB per remount.

### E.1 — Paragraph churn fixed (Checkpoint E, one device session, debug, thermal status 0)

Log: `evidence/07-checkpoint-e/s1-paragraph-cache-mount-log.txt` (Dense System, 121 bodies; launch →
Digest → Orrery, one focus tap, then Digest↔Orrery ×3).

**Root cause, refined:** RN Skia charges a flat 1 MB of Hermes external pressure per **ParagraphBuilder**
as well as per Paragraph (`JsiSkParagraphBuilder.h:119`), and a builder has **no `dispose()`** — it only
goes away when collected. `prepareOrreryText` and `BodyAtlas.drawInitials` built a fresh builder per
text, so every label was ~2 MB of pressure, and every memo rerun repeated it. A Paragraph's `dispose()`
does reset its pressure to 256 B (`JsiSkHostObjects.h`, `dispose` host function).

**Fix:**
- `orreryParagraphBuilder(fontProvider)` (`OrreryLabel.tsx`): one builder per font provider, `reset()`
  before each use. Used by `prepareOrreryText` and the atlas initials.
- `OrreryTextCache` (`orrery-text-cache.ts`): Paragraphs keyed by (provider, role, font scale, width, ink
  colour, text). The labels memo reuses them; after `setLabelTexts` commits, entries the committed set no
  longer references are disposed; everything is disposed on unmount. Unit tests in
  `orrery-text-cache.test.ts`.
- `OrreryScene3D.setLabelTexts` keeps a label's raster when its Paragraph object is unchanged (a focus
  change used to re-rasterize every label). Rasters are dropped on a backplate (`surface`) colour change.
- Renderer log adds `gcPerS`, `paragraphs`, `created`, `disposed`.

| | before (D.6) | after (E.1) |
|---|---|---|
| Hermes `external` at mount #1 → +5 s | 881 → 1569 MB | 140 → 297 MB |
| Paragraphs alive / created per mount | ~240 + ~240 builders, never disposed | 132 alive, 132 created, 0 recreated on focus |
| post-unmount forced-gc floor, #1/#2/#3 | 1359 / 1682 / 2257 MB (+300–575 per mount) | 102 / 173 / 245 MB (+~70 per mount) |
| GC rate, Orrery idle at overview | ~6.6 /s | 6.0–7.4 /s |
| GC rate, first 5 s after a mount | ~50–100 /s | ~23–24 /s |
| fps at Dense overview (debug, JS rAF) | 43.3 (thermal SEVERE, C.5) | 52–56 steady (mount #1); 41–46 in the first 5 s of remounts |
| `dumpsys meminfo` after mount #4 | Native 793 MB, Graphics 283 MB | Native 743 MB, Graphics 269 MB |

**Honest reading:** the counter is now ~5× lower and the post-gc floor grows ~70 MB per mount instead of
300–575 MB. The idle GC rate did not drop: ~6–7 GC/s at idle is driven by per-frame JS allocation
(packets, frame objects), not by external pressure. The first-5-s fps after a remount is lower than steady
state because of the atlas/photos/label build.

**Remaining floor (~70 MB/mount, 20-min cap):** its size matches one scene's CPU-side buffers (the 26 MB
atlas `Uint8Array` + the atlas's Skia surface + texture copies), which suggests the disposed
`OrreryScene3D` stays reachable. The retainer was **not identified** (no heap snapshot tooling on device in
the time box; suspects unchanged: three's renderer-side WeakMaps/backends keyed on the destroyed device,
Reanimated-held JS callbacks). Mitigation in the same commit: `OrreryScene3D.dispose()` now drops the
atlas pixels, every DataTexture's `image`, label texts, infos and the last packet, so a retained scene
costs bytes. Re-measured in E.2's session (see below).

**E.1 re-measure (session 2, `evidence/07-checkpoint-e/s2-focus-moon-mount-log.txt`), with the dispose-time
buffer release:** post-unmount forced-gc floor 73 → 145 MB (+72 per mount), i.e. unchanged. So the
remaining per-mount growth is **not** the scene's CPU buffers; the mitigation stays (harmless) but the
retainer is still unidentified. At idle the GC rate settles to ~2.6–3.0 /s after ~40 s open (7 /s in the
first half-minute while photos/atlas settle). fps at Dense overview 52–56 steady, 31–41 in the first 5 s after
a mount (debug build, JS-thread rAF, thermal status 0 throughout).

## Release (final) — Checkpoint F.2 (one device session 19:58–20:02, RELEASE build, thermal status 0 → 0)

Build: `assembleRelease`, arm64-v8a, Hermes bytecode, minified, `__DEV__=false`, installed over the seeded
debug app (`flags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]`, no DEBUGGABLE). Pixel 6 Pro on USB power, battery 37%,
`dumpsys thermalservice` status **0 at start and 0 at end**. No screen recording during the measured run.
The `[lab-c] frames=…` renderer log is **not** stripped in release (no remove-console plugin) and is the main
source. Logs: `evidence/08-final/f2-release-perf-session-log.txt`, `f2-release-gfxinfo-meminfo.txt`
(timing marks, gfxinfo, full meminfo). Each row = the 5 s windows fully inside that camera state.

| System / camera | fps (JS rAF) | avg / p95 frame dt | jsRenderAvg (p95) | drawAvg | presentAvg | tris |
|---|---|---|---|---|---|---|
| Dense (121 bodies) overview, steady (5 windows) | 59.6–60.6 | 16.5–16.8 / 17.2–17.5 ms | 9.8–10.5 ms (12.5–13.0) | 8.0–8.6 ms | 0.38–0.78 ms | 145k |
| Dense, first 5 s after mount (photos/atlas build) | 53.8 | 18.6 / 17.5 ms, max 465 ms | 12.6 ms (13.4) | 10.5 ms | 0.46 ms | 145k |
| Dense near (preset 1, ×2.2) | 58.0–60.2 | 16.6–17.2 / 17.4–22.6 ms | 9.4–11.1 ms (12.8–13.7) | 7.7–9.1 ms | 0.40–1.10 ms | 138–141k |
| Dense close (preset 2, ×3.4) | 58.7–59.4 | 16.8–17.0 / 17.3–22.7 ms | 9.4–11.2 ms (12.9–13.6) | 7.8–9.3 ms | 0.40–1.12 ms | 114k |
| Dense orbit-swung (preset 3) | 56.7 | 17.6 / 25.3 ms | 10.4 ms (14.1) | 8.7 ms | 0.79 ms | 145k |
| **System switch** Dense → Inner (110 leaving, 7 entering, 10 retained) | 56.3, then 54.8 | 17.8–18.2 / 24.6–26.0 ms, max 54 ms | 10.8–10.9 ms (13.5–14.3) | 9.2–9.9 ms | 0.39–0.42 ms | 65k → 26k |
| Inner (17 + star) overview | 59.5–59.8 | 16.7–16.8 / 17.4 ms | 10.0–10.6 ms (12.5–12.8) | 9.4–9.8 ms | 0.41–0.42 ms | 26k |
| Inner near (preset 1, ×2.2) — re-measured, see note | 57.6–59.8 | 16.7–17.4 / 17.3–24.4 ms | 10.4–10.5 ms (12.6–13.2) | 9.7–9.8 ms | 0.35–0.41 ms | 21k |
| Inner close (preset 2, ×3.4) — re-measured | 59.2–59.3 | 16.9 / 17.4–19.3 ms | 10.0–10.5 ms (12.9–13.5) | 9.3–9.8 ms | 0.37–0.69 ms | 22k |

**Inner near/close re-measure (lab-tool bug found during evidence review).** In the first session the Inner
"near/close" presets actually zoomed **out**: the lab badge captured its home zoom once (on Dense) and kept
multiplying that stale value after the switch (`evidence/08-final/03b-*`, `04b-*` first versions showed a tiny
system). Fixed in 4a82ae85 (re-capture on leaving preset 0), release rebuilt and re-installed, and the two Inner
rows above re-measured in a second short session (20:11–20:12, thermal status 1 → 1, log
`evidence/08-final/f2b-release-inner-presets-session-log.txt`); screenshots replaced. The Dense rows were not
affected (home captured on Dense). Earlier checkpoints' near/close rows taken after a System switch within the
same mount may carry the same stale base; not re-checked.

**gfxinfo** (`dumpsys gfxinfo com.bwales.orbit.labc`, reset before each state) covers **only the UI/RenderThread
(HWUI)**, not the WebGPU canvas: the 3D frames are presented by Dawn straight to their own surface from the JS
thread. Dense overview window (includes the tab change + mount): 136 HWUI frames, 0.74% janky, p50 6 / p90 8 /
p95 10 / p99 42 ms. Dense near and close: **0 HWUI frames** in 12 s each (nothing on the UI thread changed —
proof the 3D loop does not touch HWUI, and also that gfxinfo says nothing about the 3D frame rate). Switch window:
2 HWUI frames (selector close).

**Memory, 3 Orrery leave/return cycles** (Orrery → Digest → Orrery ×3, single pass; mounts #2–#4 on Inner, since
the switch persisted):

| | before cycles (mount #1 open, ~3 min) | after 3 cycles (mount #4 open, +10 s) |
|---|---|---|
| TOTAL PSS | 677 MB | 612 MB |
| Native Heap PSS | 251 MB | 188 MB |
| Graphics (EGL + GL mtrack) | 276 MB | 276 MB |
| Hermes `external` post-unmount forced-gc floor | — | 54 → 106 → 159 MB (#1/#2/#3, +~52 per mount) |

`renderer ready` 486–567 ms per mount (debug: ~2.0 s at D.5). Every unmount logged `loop stopped, GPU resources
disposed`. PSS did not grow over the cycles; the `external` gc floor still climbs ~50 MB per mount (same
unidentified retainer as E.1, now ~52 instead of ~72 MB).

**Honest reading / caveats.**
- The loop is **pinned at ~60 fps** (avg dt 16.5–17 ms) in every steady state, Dense included. The panel runs at
  120 Hz (`SurfaceFlinger activeMode vsyncRate=120`), but the JS rAF cadence of this loop is 60 Hz; the 60 fps
  cap is a cadence ceiling, not the scene cost. Headroom: jsRenderAvg ~10–11 ms (p95 ≤14.3 ms) of the 16.7 ms
  budget, so a 120 Hz target would **not** fit on the JS thread as built. Not investigated why rAF is 60 Hz.
- GPU is not the bottleneck at DPR 2.0 (presentAvg ≤1.1 ms everywhere). Debug→release mostly removed the
  extra JS cost: Dense overview 47.0 (C.4) / 52–56 (E.1) debug → 59.6–60.6 release.
- The "near/close" lab presets are bounded by the 3D dolly camera (467b973b); on Dense they read only a little
  closer than overview (see `evidence/08-final/03-*`, `04-*`; same as the Checkpoint D debug shot). The truly close
  view is the focus fly-in (`05-*`), not measured separately in this session.
- Switch dips to 54.8–56.3 fps with p95 ~25 ms and one 54 ms frame — visible but small.
- One session, one phone, cool, on USB power; 5 s windows; no long-soak or hot-phone numbers in release.
