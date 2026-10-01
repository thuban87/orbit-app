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
