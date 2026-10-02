# Lab B — Dead ends

These ideas were rejected, demoted to a toggle, or disproved, including attractive ideas
that turned out too slow. Each entry has the commit, file or flag where it can be
recovered. The raw log is `research/DEAD-ENDS-LOG.md`. Costs are **emulator-relative**.

## 1. Beautiful but too costly

| Idea | What it looked like | Why dropped | Recoverable at |
|---|---|---|---|
| **Bloom pass** (one bright-pass + blur saveLayer over sky + world) | Real HDR feel: a broad sun halo, glowing rims and inner rings, light-smeared streaks (`evidence/10-r2/final-hero-bloom-flare.jpg`) | A full-screen offscreen + blur **every frame** is the classic Android GPU cliff. The emulator can't measure it (GPU p50 +2–5 ms hint). At threshold 0.62 it flattened the sun's granulation, and it defeats R1's sun glow cap (legibility). | flag `bloom`, `LabStage.tsx` `labBloomPaint` (`ff90df99`) |
| **Live full-res fbm nebula** | Identical to the bake (same density function), with evolving warp | gfx p50 32 vs 18 ms, every frame janky, even on a desktop GPU | flag `nebulaLive`, effect `nebulaLive` (`79cc89eb`) |
| **Runtime shader per moon** | Detailed lit moons | ~67 tiny moons cost ≈14 ms p50 for invisible detail | flag `moonShader` (`0922d223`) |

## 2. Failed

| Idea | Why it failed | Recoverable at |
|---|---|---|
| **Displacement shockwave image filter** (heat-haze lensing + chroma split at the lock), even retuned to 2× amplitude and elliptical | Visible only in slow motion; at normal speed it drowns in streaks and comets. It costs a full-screen saveLayer for the whole lock phase. The projected-ring shockwave already carries the beat. | flag `fxShockFilter`; `evidence/10-r2/05-shockfilter/`, `evidence/06-wp2.1-switch/15-…mp4`, `26-EXPERIMENT-filter-lensing-band.jpg` |
| **Tilt-shift depth of field** (4 BackdropBlur bands) | Hard band edges. It blurs faces and bodies while their labels stay sharp, which hurts the information architecture. Four backdrop saveLayers; a per-body depth blur would scale with N. | flag `tiltShift`, `LabStage.tsx` `LabTiltShift`; `evidence/10-r2/03-iter2/sheet-hero*.jpg` |
| **Depth of field (any)** | Rejected on analysis in research 03: it blurs faces | — |

## 3. Too slow, replaced by a cheaper equivalent

| Idea | Cost (emulator) | Replacement | Recoverable at |
|---|---|---|---|
| Far stars as a 760-sprite Atlas | ~2× gfx p50 (32 vs 17 ms); twinkle-off didn't help, so the cost was the per-replay `drawAtlas` | Analytic hash-grid stars inside the nebula shader | `54188b10`; far Atlas kept as the fallback |
| Scalar uniforms per body shader (25 × ~190) | p50 65 vs 32 ms | Packed `float4` uniforms | `469440db` → `0922d223` |
| Legacy rings: 128-pt Path rebuilt per ring per frame + CPU `DashPathEffect` | 40–47 frames / 15 s vs 212 rings-off | Circles under one homography + shader dashes | flag `ringsPathRebuild` (`LabRingsPathRebuild`) |
| Wakes as 3 stacked stroked sub-arc paths per class; tethers as stroked segment paths | +56 / +12 ms p50: Ganesh re-tessellates stroked paths every replay | `ringWake` shader circles; rotated rects | `eb860615` (reverted by `41495969`) |
| Ring unwind/draw-on as one React component per ring | ~9 s debug UI freeze at a dense switch | One UI-thread picture per frame | not committed (DECISIONS WP-2.1 §4) |
| **Declarative per-entity Skia components** (bodies, labels, rings) with animated props | 3 193 bound SVs → seconds of JS blocking per commit, ~80–126 ms UI mappers per frame | Layer pictures | flag `layerPictures:0` (the A/B baseline) |
| Wakes per ring re-recorded every pan/fly-in frame at 400 rings | 34–40 ms per frame | Camera split + motion gate + LOD 160 | `83c9033a` |
| Ring energy flow on dense Systems via a split static/flow picture | Rejected on analysis: the flow lives in the same stroke shader, so every ring re-records anyway; 400–800 rings of comets read as clutter | Density LOD (C-59) | — |

## 4. Rejected on analysis (not built)

| Idea | Why |
|---|---|
| Reduced-resolution live nebula (offscreen ¼-res per frame) | Needs a per-frame offscreen surface + snapshot on the UI thread (GPU-sync risk). The bake gives the same low-frequency image. |
| Atlas / Picture batching of *photo* bodies | Each photo needs its own ImageShader (an Atlas has one texture). The idea survives as "**photo texture atlas**", if a phone shows bodies as the bottleneck. |
| Batching ring circles into one static path per class | Circles were already at the floor; a combined stroked path would hit the tessellation trap. Built, then removed before commit. |
| One full-screen shader for all rings | Circles were already free. It would need a per-ring data texture and a switch/reorder fallback. Revisit only if the phone shows circle cost under perspective. |
| Caching trim sweep gradients | Per-ring cut positions differ every frame; quantising risks visible arc steps. Trim remains the top switch-FX cost (C-48). |
| Patching RN Skia/Reanimated in `node_modules` (drop the redundant second `redraw()`, skip record-time `.value` reads) | Lab rule: no library patches, and the app-side fixes removed the stall. **An upstream candidate for V2.** |
| Raising the focus card's opacity / adding a scrim to stop ghosting | It would push the glass past ADR-149's ceiling, i.e. the rejected "opaque Orrery cards": an owner reversal. Canvas-side occlusion was used instead (C-61). |

## 5. Disproved hypotheses and broken methods

| Hypothesis / method | Outcome |
|---|---|
| "The big-switch stall is the bodies/labels/rings Skia cost" (the stack showed `JsiRecorder::applyUpdates`) | Disproved. With those layers off the stall stayed (202 skipped); `applyUpdates` ≤ 8 ms. The cause was the model-half mapper restart (SWITCH-STALL §3.1). |
| gfxinfo as the opaque-canvas meter | SurfaceView frames are invisible to gfxinfo (0 frames ≠ idle). Use SurfaceFlinger `--latency`. |
| The lab FPS HUD as a measurement | It disagreed with gfx in every WP. Treat it as a convenience only. |
| "Measured" overlay contrast by a single luminance split | Glyph antialiasing polluted the backdrop set (everything read ~2:1). Fixed by dilating the glyph mask 4 px. |
| Iterating the switch on DEBUG builds via deep links | Each link remounts the Orrery, and debug JS took > 7 s per System load. Moved to release builds. |

## 6. Art iterations that were wrong (fixed in place)

| What went wrong | Where it is visible | Fix |
|---|---|---|
| Shockwave as a filled glow disc read as a **soap bubble** | `evidence/06-wp2.1-switch/29-pass1-sheet-before-tuning-bubble-shockwave.jpg` | Thin front + faint trailing glow |
| R2 iteration 1: a 0.55·extent light pool turned the whole nebula brown, and the cartesian grid drew a crosshair through the sun | `evidence/10-r2/02-iter1/` | 0.32·extent pool; half-cell grid offset |
| Uppercase tracked caps on the System name truncated it | — | Caps only on fixed chrome words |
| Stacked full-width focus-card actions were clipped under the anchoring cap | — | One wrapping row |
| Axis-aligned sun granulation read as blocky squares on device | — | Rotated, domain-warped lattice |

## 7. R3 dead ends

| Idea | Why it was dropped | Where |
|---|---|---|
| Immersive header scrim as **abutting** stepped bands (17 bands, +0.5 dp overlaps) | The overlaps drew dark hairlines across the map at every band edge. Replaced by nested top-anchored bands solved to the target profile | `evidence/11-r3/01-iter1/02-overview-dense.jpg`; final `13c706ad` (`labb-header-scrim.ts`) |
| Near-body cap at **9.5 %** of the short side | Still read as a disc under the FAB column at detail zoom → 8 % | `11-r3/01-iter1/04-detail-dense.jpg` vs `02-iter2/04-detail-dense.jpg` |
| Keep the canvas below an opaque bar and only fade a strip | Rejected on analysis: it still reads as an app header over a picture | — |
| Screenrecord at native 1280×2856 | Fails with `err=-22`; always pass `--size 720x1606` | tooling |
| Judging a Polaris / Reset-north recovery from a screenrecord started *after* the tap | The recovery (≤ 850 ms) finishes before the recorder starts, so it looked like "no rotation". Start the recorder first (FINAL-VALIDATION §1) | `11-r3/03-paths/north-*`, `np-*` vs `13-final/01-polaris/` |

## Phone-pass dead ends (Pixel 6 Pro)

| Tried | Result | Evidence |
|---|---|---|
| **Plain saveLayer around the world layers** (flag `worldLayer`, an A/B build). The idea came from "Everything" and `fxShockFilter` (a world-wrapping saveLayer with a runtime image filter), which ran the tilted Dense at 24–49 fps against best's 5 | **No effect**: 4.6 vs 4.7 fps. The filter layer's speed-up is not the offscreen itself; with the filter, the GPU cost moves to 20–50 ms of CPU per frame on main (Perfetto). Unexplained (Ganesh path-renderer choice?). Reverted, never committed | `12-phone/isolation-dense-sf.txt` (iso3 rows), PHONE-PASS-RESULTS §3 |
| **Stroked world circles under the tilted plane's perspective matrix** (rings, wakes) | 100–350 ms of GPU per frame on Mali-G78 at Dense; 3–9 fps. The emulator showed them as free. Not a dead end for the *idea* (tilt + world-space orbits), but the draw strategy is rejected for Android | `12-phone/perf/summary.tsv`, `perfetto/best-dense-idle.pftrace.gz` |
| Trusting an emulator "GPU-cheap" verdict for any geometry under perspective | The desktop GPU behind the emulator's GLES translator hid a 30× cost | — |
