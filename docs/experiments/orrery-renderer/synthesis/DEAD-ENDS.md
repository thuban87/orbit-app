# Orrery V2: Dead Ends Not to Rediscover

These are consolidated from all three labs and the owner's review. They were verified against code where they can be recovered ([audits/](audits/)).

**Path prefixes:** `A:`, `B:` and `C:` refer to the lab worktrees `~/projects/orbit-orrery-lab-{a,b,c}`. Commits live on those local branches.

## Rendering and performance (technical)

| Dead end | Why | Where / proof |
|---|---|---|
| Declarative RN-Skia tree with a `layer` prop per body or label | About 120 unbounded full-canvas saveLayers, a whole-tree prop re-conversion on every SharedValue change, and a re-record on every React commit. In release: ≈12 fps idle with the main thread ≈92% busy. **Main's renderer has the same pattern.** | `A:` tree at `6ad5a307`, replaced in `fd7f09c8` |
| Clock-captured derived values that return fresh objects (uniform objects, `createPicture` per tick) | Redraws at display rate even under reduced motion | `A:` `6ad5a307:…/lab/BodyOverlays.tsx` |
| Strokes, dashes or ovals under a perspective CTM (tilted rings) on Mali | GPU cliff: B 3–9 fps at Dense 120 (6 Pro); A 150–200 ms idle p50 | `A:` `c862c30a:…/world-plane.ts:293`; `B:` `12-phone/isolation-dense-sf.txt` |
| Per-ring ellipse, oval-op and inverse-shader variants | 31 / 31.5 / 16 fps tilted | `B:` `14-tilt-fix/probe/` |
| Ring field on the **untilted** plane | 64.5 vs 97.8 fps for the circle op | `B:` `matrix-v6` |
| GPU fbm/hash noise in mediump (nebula) | Facets and seams on Mali | `A:` `NEBULA_SKSL` at `b450f47e`; `direction-1/00`, `01a` |
| `DashPathEffect`, `drawOval` for large ellipses, sweep gradients, `JOIN_ROUND` and non-convex paths on hot paths | Each slow on Ganesh/Mali (JOIN_ROUND ≈650 ms) | `A:` DEAD-ENDS A5–A9 (not committed) |
| Re-baking the base texture on every camera frame | 18 MB per frame | `A:` DEAD-ENDS A10 |
| JS-projected 128-point ring polygons per body per frame | 32 ms per frame. **Main still does this** (`orrery-camera-logic.ts:513-528`). | `A:` `2111be64` |
| TextureView canvas | Presents capped at ≈24–26/s regardless of scene | `A:` DEAD-ENDS A12 |
| `drawPicture` with a paint (to twinkle) | The paint is ignored, so twinkle never rendered | `A:` `6ad5a307:…/DeepFieldBackdrop.tsx:411,414` |
| One Skia Paragraph and ParagraphBuilder per label or body, never disposed | About 1 MB of external memory pressure each, GC churn, and a likely 800-body crash. **Main does this today.** | `C:` `e4d9e842`; `B:` `83c9033a` |
| Worklets capturing runtime objects or scene snapshots | ≈241k nodes materialised per mapper restart; 3–7 s switch freezes. **Main does this today.** | `A:` `842f1f36`; `B:` `ea137306` |
| Full display-rate ambient redraw | B CPU-bound and warmer; SurfaceView pins 120 Hz | `B:` `14-tilt-fix/perfetto/field-best-dense-idle.summary.txt` |
| Re-rendering the renderer on every photo arrival | Post-switch jank train | `B:` `LabBRenderer.tsx:414-432` |
| Particles, comets, flares and shockwave trims during the switch | The switch ran at ~20–29 fps on the 6 Pro | `B:` `14-tilt-fix/switch/summary.tsv` |
| Bloom, tilt-shift, lens flare, heat-haze (`fxShockFilter`) | Taste or legibility (bloom washes out the sun; tilt-shift blurs faces). The owner never noticed them (D25). The heat-haze filter is still compiled at every mount in B. | `B:` flags `bloom`, `tiltShift`, `lensFlare`, `fxShockFilter` |
| Progress WAKE trails | The costliest single effect before the tilt fix (4.6 → 18.5 fps without it); repeats what position already shows (O3) | `B:` `ringWake` |
| Visual-only minimum body size (B FLOOR) | Hits and label gaps ignore it, so bodies overlap their labels | `B:` `LabLayerPictures.tsx:220-224` (C-69) |

## Renderer choice

| Dead end | Why | Where |
|---|---|---|
| three.js WebGPU via react-native-webgpu as the Orrery renderer | +20.6 MB native libraries per ABI; minSdk 26; a 0.x dependency renamed May 2026; a JS-thread loop capped at 60 Hz; +52 MB Hermes external memory per mount (unexplained); two GPU stacks (Skia still renders text); weaker light themes. Owner D1. | `C:` whole branch; `C:` RECOMMENDATIONS |
| Matching the old view pixel for pixel in 3D ("parity camera") | It looked 2.5D because main's focal is telephoto | `C:` `205c1462` |
| Whole-disc Home fit for large Systems | Specks and moiré at 120 contacts | `C:` `84f5d646` → reverted `9ae99523` |
| Releasing GPU buffers at dispose to fix the per-mount memory floor | The floor did not move | `C:` `1d052ca2` |

## Product and taste (owner-rejected, 2026-10-02)

| Dead end | Owner's words / ruling |
|---|---|
| One-finger orbit camera; two-finger pan replacing two-finger tilt | "1 finger to rotate is awful. 2 fingers to pan and tilt is very sensitive" (C) |
| Gravity-well grid under the System | "can go" (B) |
| B's moons (nearly invisible at high zoom) and C's moons (inclined revolving orbits) | "Virtually impossible to see" (B); "bad all around" (C) |
| C's reorder (no ghost) | "Terrible, almost no indicator" |
| The loading box when the Orrery opens | Disliked in A and B. It is production `OrreryNotice kind="world-loading"` (`main:src/screens/OrreryScreen.tsx:1210-1218`). |
| Dark, fogged overview and dark faces | "Hard to find people, most are too dark" (C); "faces are too dark" (B) |
| Busy nebula | "Background is too busy" (B); "nebula is a little too everywhere" (A) |
| Focus card above the person | "should be below" (A) |
| Bodies drifting off their orbit line | "That's horrible, the contacts need to be on their actual orbit line." Ruled D12 (reverses HANDOFF §7). |
| Full-intensity FLOW pulses | Kept, but "not very obvious" (D10) |
| Camera effects (D25) | Off |
