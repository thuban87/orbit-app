# Lab A — Productionization

This file lists what it would take to ship the Lab A ideas (see [HARVEST.md](HARVEST.md)) in a clean Orrery V2, or to harvest pieces into main.

The branch itself is **never merged** (experiment contract). Everything below assumes a fresh V2 implementation that lifts code and patterns selectively. The state described is HEAD `978643c9`.

## 0. Decision prerequisites (owner, before planning V2)

Each item below is an owner decision. None may be defaulted. Each one changes V2's scope. Recommendations are in [RECOMMENDATIONS.md](RECOMMENDATIONS.md) §5.

| ID | Decision | Why it gates V2 |
|---|---|---|
| **K** | Adopt the 45° tilted Home? Kept for testing only. It reverses phase-08 dossier §C/§P and 29-UI-SPEC ORRC-04/05. | Changes `deriveHomePose`, Recenter, the switch destination, the Home tests and the framing fit. Plane, shadow and depth cues are far weaker at tilt 0. |
| **H1 / H2** | Fix main's release Orrery cheaply (H1: drop per-body/label `layer`, use primitive clock values) or port the imperative renderer (H2)? | H2 *is* most of V2. H1 is a stop-gap that does not deliver Lab A's focus latency or reduced-motion idle. **Prerequisite:** main's slowness is *inferred* from the lab's legacy renderer, which is not main: it ran with the 45° tilt and the M1–M3 fixes. **Measure main's own release build first** (`evidence/arch-perf/tools/relproto.sh` protocol). |
| **TW1 / TW2** | Steady sky (TW1), or a real star twinkle (TW2: a dimmer sky on average and more ambient motion)? | Determines whether `drawSky` gets per-star alpha (a paint on the replay or an Atlas) and whether idle redraws ever include the sky. |
| **Ambient motion** | Corona churn, granulation, reticle scan and 30 Hz ambient vs ADR-048/077 ("starfield twinkle + sun pulse are the sole ambient animation"). | If rejected, the sun and reticle become static, idle redraws drop to zero, and the SurfaceView idle-CPU problem largely disappears. If accepted, an ADR superseding the ambient clause is needed. |
| D-41 (if wanted) | A shared SkImage photo cache to stop photo pop-in on remount. | Reverses D-41. Not needed for Lab A's results; flagged only because remount pop-in remains. |
| Photo custody | Lab A moved D-41 rule 3 (the hook disposes its retired image) to a UI-side custodian hand-off. | Not a reversal in intent, but it rewrites how a recorded rule is enforced. Confirm with the owner. |

## 1. Cleanup (lab scaffolding to remove)

Described **as of commit `7e250e4f`**. A later cleanup commit on this branch may already have removed some of these.

| Item | Where | Action |
|---|---|---|
| Experiment package id and launcher name | `app.config.ts` (`LAB_A_PACKAGE`, `LAB_A_LAUNCHER_NAME`, `void appName`) | Revert to `com.bwales.orbit` / `appName.APP_NAME`. |
| DEV marker | `lab/LabHud.tsx`, `LAB_MARKER_*`, the `LabScene` mount | Delete. |
| Renderer A/B toggle | `lab/deep-field-mode.ts`, `OrreryViewOptions.tsx` ("Lab A renderer (experiment)"), `useDeepFieldEnabled` in `OrreryWorld` / `OrreryFocusContext` | Delete. It is **not DEV-gated**: visible in release. If a comparison flag is needed during the port, make it `__DEV__`-only. |
| `DEEP_FIELD_ENABLED` master switch and every `deepFieldOn ?` branch | `deep-field-config.ts`, `OrreryWorld.tsx` (≈15 sites), `OrreryCanvas.tsx` (`opaque={!!backdrop}`, `legacyStars`), `OrreryFocusContext.tsx` | One renderer. Remove the branches and the legacy tree, or keep the legacy tree only if H1 ships first. |
| **Dead Lab branches in the legacy body components** | `OrbitBody.tsx` (`deepField` prop, `BodyLightOverlay`, enter/photo fades), `SunBody.tsx` (`deepInk`, `flare`, `starText`, `SunCorona`/`SunDisc`), `SatelliteBody.tsx` (`deepField`), `OrreryLabel.tsx` (lab plate/ink props), `lab/BodyOverlays.tsx` | At `7e250e4f` no caller passes `deepField` or `deepInk` (`OrreryWorld.tsx` ~L182 "Legacy (non-Lab) renderer only"), so this is dead code. Delete it. |
| Legacy `SunBody` draw order differs from main | `SunBody.tsx`: the lab draws halo → focus ring → rim; main draws focus ring → halo → rim | Restore main's order if the legacy tree survives (H1). |
| Stale comments | `AMBIENT_HZ` doc says "0 under live reduced motion" (the code uses −1); the `CORONA_SKSL` header says `uTime` is 0 under reduced motion; `LabScene` base-texture rationale predates the static-only bake | Fix or drop with the rename. |
| Unused tunables | `STREAK_ARC`, `STREAK_LEAVING_BOOST`, `STREAK_WIDTH`, `STREAK_ALPHA_DARK/LIGHT`, `PLANE_ARC_STEP`, `HAZE_GLOW_ALPHA`, `WARP_ALPHA` (zero references outside `deep-field-config.ts` at `7e250e4f`), plus the lab `TWINKLE_*` set (inert, because the twinkle never renders) | Delete, or re-use under TW2. |
| Inert twinkle / warp parity | `scene-draw.ts` `drawSky` draws `sky.nearA` 6× even at warp velocity 0. That overdraw *produces the current look*: the near-star group is brighter. | Draw warp copies only while `v > 0`, and re-tune near-star brightness so the look survives. Implement TW1 or TW2 deliberately instead of the parity accident. |
| Superseded screen-space plane path | `RING_SKSL` / screen-space fallback in `world-plane.ts` and `deep-field-shaders.ts` | Keep one path: world-space `RING_WORLD_SKSL` / `GRID_SKSL`. Keep the fallback only if a device without `drawVertices` perspective support appears. |
| Naming | "Lab", "deep field" and "pass N" comments throughout `lab/` | Rename to production terms. Move tunables to `src/services/` or `src/components/orrery/` per the CLAUDE.md "tunables at the top of their service file" convention. Strip the pass-history comments. |
| Tunables file | `deep-field-config.ts` (~140 constants) | Split by subsystem: sky, plane, bodies, HUD, switch FX. Keep the one-number-edit property. Document units (dp vs world). |
| Lab-only doc pointers | `BUILD-LOOP.md`, evidence tool scripts sourcing a scratchpad `lib.sh` | Not shipped. If the tools are kept for V2 verification, re-home them under `scripts/`. |

## 2. Tests

**Current state** (run for this document): `npx vitest run src/components/orrery src/logic` → **79 files, 723 tests passed.** The notes record wider runs: 250 files / 2463 tests at `fd7f09c8`.

**Keep or port as-is (semantic guards):**
- `orrery-frame-mapper.test.ts`: no `camera` capture; it **fails** on `switchRuntime`/`scene`/`resources` captures and settles after publication. The `available` list must be updated deliberately for `ringPaths`.
- `orrery-camera-logic.test.ts`: `projectFrame` ≡ `projectWorldPoint` bit-for-bit under obstacles, tilt and yaw.
- `orrery-frame.test.ts`: `frameBody` key index ≡ `find`; ≤ 1 body touched per `billboardPose`; `billboardMap` equivalence.
- `orrery-switch-runtime.test.ts`: the stale-camera tests (two fail on old code).
- `orrery-label-logic.test.ts`: the missing-`Intl.Segmenter` initials test.
- `world-plane-camera.test.ts`, `deep-field-math.test.ts`: homography exactness, band containment, uniform-block lengths, one `drawVertices` per ring.
- `scene-draw.test.ts`: uniform array lengths equal the SkSL declarations, because a mismatch throws in `makeShader` and kills the render loop. **Extend this to every runtime effect.**
- `lab-scene-render.test.tsx`: node count independent of body count, the reticle reference-stable when unfocused, moon token ink, zIndex flip, label only when allocated.
- `world-plane.test.ts`: status line language, no additive blend in chart mode, segment span.
- `orrery-worklet-order.test.ts`: it must keep scanning the renderer directory.

**Re-home:**
- `orrery-render.test.tsx` now pins the **legacy** tree (including "every body root has `props.layer`"). Under H1 or H2 that pin must be deliberately removed. Its semantic assertions (moon token, zIndex flip, label alpha by level, accent ghost) move to the imperative renderer's tests.

**Missing tests to add:**
- reduced motion ⇒ the ambient value is −1 and no picture input changes over N clock ticks: a unit-level "idle redraw = 0" guard;
- `findStacks` / pips never alter hit or label data, extended to the imperative path;
- a photo custody race (a retired image disposed only after the spec write), beyond the single slot test;
- the focus card placement table (`focus-card.ts`) across obstacle layouts and font scales;
- accent-role contract (`accent-foreground-role-contract.test.ts`) coverage of `reticle-draw.ts`, which now uses `tokenInk(colors.accent)` imperatively rather than a `color={colors.accent}` slot;
- the chart-mode luminance threshold across all four presets.

## 3. Accessibility

- **Canvas a11y is unchanged.** The canvas has none; the companion sheet is the accessible path, as before. V2 must not remove it.
- **Reduced motion** is live and verified on device: crossfade switch, static reticle, corona and granulation, instant fades, 0 idle presents. Keep the ADR-085 shared-value pattern.
- **Font scale** was verified at 1.3 (plates, card, moon card). At 1.3 the nudged label plate touches the reticle's bottom-left bracket at identity zoom (`pass-3/30`). Either the reticle yields at that corner, or this is accepted.
- **Status without colour:** the width/dash/fade channels survive on the hairline and the segment. The 360° ring is quieter, so verify CVD legibility at overview on device (simulated deuteranopia/protanopia screenshots). Not done.
- **Overlay contrast (ADR-149):** overlay translucency was proven "AA against the brightest raw Orrery star". Lab A's sky has a white-hot corona, hero stars and a nebula band behind overlays. **Re-run the contrast proof** against the new sky, especially the corona when the sun sits under the header pills (`final/12`).
- **Tap targets:** the visual body radius (≤ 21 dp) stays inside the 22 dp hit radius. The visible disc is tappable; taps were verified at 45° tilt.
- **Photosensitivity:** switch flare, warp and lock-on flash are brief and gated on reduced motion. No strobing. Keep every flash below a few Hz.

## 4. Performance residuals

All numbers are release builds on the Pixel 6 Pro, from [PERFORMANCE.md](PERFORMANCE.md) and `_notes/CAMERA-PERF-PASS.md`.

| # | Residual | Size | Fix direction |
|---|---|---|---|
| P1 | **Idle main-thread CPU ≈32%** with the SurfaceView. It was ≈17% with the TextureView: the panel stays at 120 Hz and the always-on `useClock` frame callback plus Reanimated's frame loop run at 120 Hz. | Battery-relevant at idle; this is the biggest blocker for shipping V3. | Stop the clock between ambient ticks, or drive ambient time from a timer-free source. Or vote a 30 Hz frame rate on the surface (RN-Skia patch). If static ambient is chosen (§0), stop the clock entirely when nothing ambient is visible. |
| P2 | **≈8–10 ms main thread per camera frame.** Camera animation runs at 82–92 fps, not a locked 120. | — | One draw for all rings (uniform arrays, or a per-ring world strip without per-ring `concat`). Skip body uniforms when unchanged (35 floats + ~10 JSI calls per body). Cache label paragraphs (already pre-shaped). |
| P3 | Reduced-motion idle CPU 12–13% with 0 presents | The clock frame loop | Same as P1: no frame callback under reduced motion. The lab's legacy renderer had a floor of ≈22%; main is presumably similar (unmeasured). |
| P4 | SurfaceView memory: +≈29 MB EGL. The base texture is ≈18 MB at 1440×3120. | PSS after 10 switches: 562 MB (it was 1010 before the arch pass) | Acceptable. Consider a half-resolution base texture for the static plane. |
| P5 | Conservative band strips waste near-side fragments | GPU time unmeasured (HWUI GPU columns do not apply; Perfetto unavailable on this box) | Measure GPU on another machine (Perfetto UI). Tighten bands per segment if needed. |
| P6 | Nebula CPU bake | ~140 ms for two palettes in node; **not measured on device** | Measure. Move off the mount path (idle callback) or ship a pre-baked asset tinted by uniforms. |
| P7 | **One device, one data set** (40 contacts) | — | Measure on the Pixel 3a (the other test phone) and at 100–150 contacts (the Phase 40 high-count calibration). |
| P8 | Unanalysed Perfetto trace (`evidence/final/perf/trace-lab-switch-all-to-dense.pftrace`) | Pre-arch-pass | Analyse a fresh trace of the final build off-box. |

## 5. Dependency status

- **No new dependency** was added. The stack is `@shopify/react-native-skia` 2.6.2 (Ganesh/OpenGL; Graphite off), `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.4, and RNGH 2.32.0.
- **APIs relied on:**
  - `Skia.RuntimeEffect` with uniform arrays;
  - `Skia.Surface.MakeOffscreen` on the UI-thread GL context;
  - `SkVertices` under a perspective `concat`;
  - `createPicture`;
  - `Skia.Image.MakeImage` for the CPU nebula;
  - the `opaque` Canvas prop (→ SurfaceView).
- **Upgrade risk.** Any RN-Skia upgrade must re-verify:
  - `drawVertices` under perspective (no CPU fallback);
  - `drawPicture` paint semantics (relevant to TW2);
  - the `opaque` → SurfaceView mapping;
  - thread ownership of offscreen surfaces;
  - uniform-array conversion cost.
- **Worklets 0.10.4 serialisation behaviour.** `SerializableObject::toJSValue` builds a fresh object per reference on the UI side. That is why wide closures were catastrophic. Keep the frame-mapper capture guard regardless of version.
- **Assets:** none added. Everything is procedural. Seed photos in `tools/` are synthetic test data (see [ASSET-MANIFEST.md](ASSET-MANIFEST.md)).

## 6. RN-Skia upstream issues and possible patches

| Issue | Evidence | Upstream / patch idea |
|---|---|---|
| Declarative `Container.redraw` re-converts **every** animated prop and replays the whole command list on any shared-value change, on the main thread | `_notes/ARCH-PERF-PASS.md` §1, simpleperf | Report as a perf characteristic. Avoid it by using the imperative pattern. |
| A `layer` prop = an **unbounded** `saveLayer` (`cpp/api/recorder/Paint.h` `saveCTM`) | same | Upstream suggestion: accept bounds. Production: never use per-item layers. |
| `drawPicture` takes no paint, so `Group opacity` over `<Picture>` is silently dropped | `scene-draw.ts` `drawSky` note | Upstream doc/bug. Under TW2, apply alpha via `saveLayerAlpha` bounded to the star layer, or draw stars as an Atlas. |
| Re-record on Canvas `children` identity change, done twice (commit + explicit `redraw`) with blocking `runOnUISync` reads | `_notes/PERF-PASS.md` cause 3 | Memoise Canvas content; the imperative pattern makes it moot. |
| No way to request a lower present rate on the SurfaceView | `_notes/CAMERA-PERF-PASS.md` residual 1 | Patch: `Surface.setFrameRate(30)` when only ambient content is animating. |
| `SkiaTextureView … LegacySurfaceTexture is not attached!` logcat spam (~30 Hz, 26k lines in 15 min) | `_notes/PASS-1.md` §8: A/B shows legacy emits it too | A library TextureView issue. The SurfaceView path may avoid it; **not re-checked after `dc7f8669`**. |

## 7. Edge cases still open

1. **Two suns during a switch.** Both draw in the sun slot of the first sun in depth order. Invisible at tilt-0 ties; could mis-order at high tilt.
2. **Edge pop.** The drawn body extent (up to 1.6r disc × 1.5 halo) and the corona (2.7r) exceed the cull reaches (1.3r, sun 2r), so they pop at screen edges. Fix: cull on visual extent in the renderer only, never in the frame.
3. **A moon's focus card covers its parent's label** (`final/11`). Only the focused body's own label is cleared.
4. **Sun under the header pills** when a near-sun body is focused (`final/12`). Camera framing (usable-rect centring), not presentation.
5. **Lab Dense (32) does not fit at Home** (`final/20`). This is the recorded Phase 29 rule ("fit until readability fails, then let outer rings extend off-screen"). Low-count Home sits high and small (usable-rect centring, zoom ≤ 1). Both are camera/product rules, not renderer bugs.
6. **Focus camera latency on main:** the camera started about 1.7 s after the tap in debug (pass 3). Release Lab A is 5–45 ms. Main presumably still pays the declarative re-record (M4). This is inferred, not measured.
7. **Photo-edit ownership.** Photo custody (hand-off + 1.5 s unmount grace + `try/catch` → initials) was never exercised with a photo *edit* or replacement on device.
8. **Photo-sun path** (a self-sun with a photo) is not device-verified; the test self-sun has no photo.
9. **Arrival ghosts are neutral** because the frame has no status. Keep them transient.
10. **Ink-in, capture ripples and glint** were never judged at full frame rate after the arch and camera passes.
11. **First-bake nebula fade** runs only once per palette per process. A theme switch mid-session pops the new palette's nebula in over 450 ms. That is fine, but check that a theme change does not leak the old palette's `SkImage`: the cache is never disposed, so it holds at most four entries.
12. **M6 / M7** ("Unavailable System", custom System not restored): baseline bugs, uninvestigated.

## 8. Device verification still needed

| Item | Why it was not done | Who |
|---|---|---|
| **Pinch zoom and two-finger tilt/yaw feel** at the new present rate | Multitouch cannot be scripted over adb | **Owner, hands-on** |
| **Real-finger pan smoothness** | Scripted pans are input-bound at ≈63/s; the renderer measured 82–92 fps on a camera animation | Owner, hands-on |
| **Detail-zoom context lines** (label context plates beyond focus framing) | Needs pinch past focus framing | Owner, or an agent with a zoom control |
| **Photo edit / replace while the Orrery is mounted or remounting** (custody race) | Not exercised | Agent on a debug build |
| **Self-sun with a profile photo** | No such fixture | Agent: seed a self photo |
| Screen-transition animations over the SurfaceView, frame by frame | Not inspected | Agent: screenrecord |
| Logcat spam with the SurfaceView | Not re-checked | Agent |
| Pixel 3a (lower-end GPU), and 100–150 contacts | Single device and data set | Agent |
| CVD simulation of the quieter ring language | Not done | Agent: screenshots plus daltonize |
| ADR-149 overlay contrast over the new sky | Not done | Agent: unit proof plus device screenshot |

## 9. Suggested V2 order

Ownership is decided at planning time. This is ordering advice only.

1. Owner decisions in §0.
2. **Main-line fixes M1–M3** (independent and test-pinned). They can land in main before V2. **Measure main's release build** before and after them, to settle the H1/H2 premise.
3. The imperative renderer skeleton with legacy visuals (H2 core): tiny tree, pictures, specs, photo custody, conditional redraw. Verify parity with the legacy look and measure.
4. World-space plane (V2) and the frame without ring polygons.
5. Opaque canvas plus the idle clock fix (P1) together.
6. The visual layer (V4–V17) per the owner's taste calls, with K, TW and the ambient-motion decisions applied.
7. Release measurement on both test phones with the measurement toolkit (V21).
