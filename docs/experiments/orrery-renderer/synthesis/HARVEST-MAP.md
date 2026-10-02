# Orrery V2 Harvest Map

Every idea V2 keeps, mapped to its owner decision, source lab, code, commits, visual evidence and a lift class.

**Path prefixes:**
- Code paths are relative to the lab worktree root:
  - `A:` = `~/projects/orbit-orrery-lab-a`
  - `B:` = `~/projects/orbit-orrery-lab-b`
  - `C:` = `~/projects/orbit-orrery-lab-c`
- Evidence paths are relative to that lab's package `evidence/` folder:
  - A: `docs/experiments/orrery-renderer/lab-a-production-skia/evidence/`
  - B: `docs/experiments/orrery-renderer/lab-b-skia-unleashed/evidence/`
  - C: `docs/experiments/orrery-renderer/lab-c/evidence/`

The audits checked that each cited evidence file exists ([audits/](audits/)).

**Class:**
- **T** = transplant: lift the code nearly as-is, then retune.
- **R** = reimplement: keep the concept, write fresh.
- **N** = new: no lab built it.

**D-codes** are the owner's field-sheet decisions ([OWNER-REVIEW.md](OWNER-REVIEW.md)). The dossier uses the same numbers as D-01..D-30. M1/W1/I1/S1/G1/O1–O5 are the chat rulings.

## Camera and layout

| Idea | D | Src | Code | Commit | Evidence | Class | Notes |
|---|---|---|---|---|---|---|---|
| Home profile `{tilt, lensShift, fitRule}`, ~62° | D3 | C | `C:src/logic/orrery-camera-logic.ts:77,82-89` (`LAB_HOME_TILT=1.08`), `deriveHomePose` `:357-486` | `da5433a9`, `0219e4a8` | `08-final/02-inner-overview.png`, `01-dense-overview.png` | T | It is not one tunable in C: Dense Systems use 0.85 rad. 62° is above main's `MAX_TILT` of 60°. Flat needs lens shift 1.0 plus a whole-disc fit. |
| Dolly focal model (`720/zoom`) | D2, D3 | C | `C:src/logic/orrery-camera-logic.ts:75-80` | `da5433a9` | as above | T | This is what gives the "3D strategy" depth. Watch the near-plane clamps (`perspectiveScale`, `unprojectToWorldPlane`). |
| Lens shift / strategy composition | D2 | C | `cameraCenterRect` `:252-265`; viewport `height × 0.62` `C:src/screens/OrreryScreen.tsx:227-251` | `0219e4a8` | `03-checkpoint-b/10-visual-overview-lens-shift-fills-canvas.png` | T | — |
| Near-side size clamp | D6 | B | `B:src/components/orrery/labb/labb-near-size.ts` `labClampNearSizes` | `13c706ad` | `11-r3/01-iter1/04-detail-dense.jpg` vs `11-r3/02-iter2/04-detail-dense.jpg` | T | The near side stays bounded at 62°. The far side shrinks unchecked, so pair it with min size. |
| Min on-screen size (world-radius inflation) | D16 | C | `C:src/components/orrery/OrreryWorld3D.tsx:522-537` | `7dd23580` | `05-checkpoint-d/03-…sun-min-size.png` | T | Preferred over B's FLOOR, which is visual-only (hits and labels ignore it). |
| Ring density fade | — | C | `C:src/components/orrery/three/orrery-scene3d.ts:1017-1029` | `84f5d646`, `7dd23580` | `05-checkpoint-d/02-…ring-fade.png` | T | Extract into a pure function. |
| Top-inset fade | — | C | `OrreryWorld3D.tsx:584-597` | `7dd23580` | — | T | — |
| Projected-size label tiers | X2 | C | `effectiveLabelZoom` `OrreryWorld3D.tsx:204-225` | `823bd69f` | `03-checkpoint-b/04…06-labels-*` | T | Required once zoom becomes a dolly. |
| Nearest-first label allocation | — | C | sort key `C:src/logic/orrery-label-logic.ts:138` | `823bd69f` | — | T | One line. |
| Body exclusions for labels | — | C | `OrreryWorld3D.tsx:189,725-746` | `97d94229` | — | T | Use padding 1.0–1.05 for 2D discs. |
| Pan coast, small but perceptible | D5 | main | `main:src/logic/orrery-recovery-logic.ts:16-17` (`COAST_MS 120`) | — | — | R | Retune only. The owner saw no coast. |
| Projection-basis hoist | fix | A, B | `A:src/logic/orrery-camera-logic.ts` `projectionBasis`/`projectWithBasis`; `B:` `89c2f1dd` | `ba3cef68` | — | T | Bit-exact test exists. |

## Renderer foundation

| Idea | D | Src | Code | Commit | Evidence | Class | Notes |
|---|---|---|---|---|---|---|---|
| Stable 5-picture imperative tree | D1 | A | `A:src/components/orrery/lab/LabScene.tsx:540-556`, `scene` mapper `:304-383` | `fd7f09c8` | `arch-perf/release/*` | R (pattern) | The single biggest perf lever: idle main thread ≈92% → 15–16%, focus response 3.6–10 s → 0.06–0.18 s (release). |
| JS-prepared immutable specs written to SharedValues | D1 | A | `A:src/components/orrery/lab/scene-specs.ts` | `fd7f09c8` | — | R | — |
| Quantised 30 Hz ambient clock (−1 under reduced motion) | O2, O5 | A | `LabScene.tsx:177-180`; `AMBIENT_HZ` `deep-field-config.ts:331` | `fd7f09c8` | — | T | Pulses, twinkle and sun pulse all ride it. |
| Pausable idle clock | O5 | B | `B:src/components/orrery/labb/LabCanvas.tsx:120-135`, `labb-clock-logic.ts:22-50` | — | — | T | Combine with A's quantisation. |
| Base bake only when static | O5 | A | `LabScene.tsx:394-444` | `033e7518` | — | T + fix | **Dispose the old snapshot.** `LabScene.tsx:432` leaks about 18 MB per settle until GC. |
| World plane under the exact homography (analytic screen-dp strokes on cached `SkVertices`) | D3, X3 | A | `planeHomography` `deep-field-math.ts:267`; `world-plane.ts` `makePlaneShapes` `:339`, `drawWorldPlane` `:806`; `RING_WORLD_SKSL` `deep-field-shaders.ts:296`, `GRID_SKSL` `:367` | `033e7518`, `5fb0f0d7` | `camera-perf/*` | T | Default tilted-ring method, subject to the X3 spike. |
| Full-screen ring field | X3 | B | `B:src/components/orrery/labb/LabRingField.tsx`, `labb-ring-field.ts`, `ringField` in `labb-effects.ts:646+` | `19dae74b`, `7350b643`, `9aa7e725` | `14-tilt-fix/matrix/summary.tsv` | T (fallback) | Rebuilds a 4096-bin LUT on every switch frame while tilted. Fix that if adopted. |
| Projected-ellipse helpers | — | B | `labb-plane-ellipse.ts`, `labb-plane-draw.ts` | `b22b6ae4` | — | T | Used for single overlays (focus, reorder, shockwave). |
| No ring polygons in the frame | — | A | `projectFrame` `ringPaths=false` | `5fb0f0d7` | — | R | — |
| Opaque canvas (SurfaceView) | O5 | A | `OrreryCanvas.tsx` `opaque` | `dc7f8669` | `camera-perf/release/relfinal-cam3.txt` | T (behind the host interface) | Android-only. It pins the panel at 120 Hz, so it needs the idle frame-rate fix. |
| Paragraph cache + shared builder | fix | C | `C:src/components/orrery/orrery-text-cache.ts:33-101`; builder in the `OrreryLabel.tsx` diff | `e4d9e842` | `07-checkpoint-e/s1-paragraph-cache-mount-log.txt` | T | Sweep only after the commit that stops drawing the old Paragraph (use-after-free risk). |
| Narrow worklet captures + memoised runtime | fix | A, B | `A:` `842f1f36`; `B:` `ea137306` | — | `A: perf/latency-summary.txt` | R (port by hand) | Update `main:orrery-frame-mapper.test.ts:104,115`, which currently *expects* the bad captures. |
| O(1) `bodyKey` index | fix | A, B | `A:src/logic/orrery-frame.ts` `keyIndex`; `B:` `labb-frame-index.ts:19`, `83c9033a` | — | — | T | Also `ProjectedOrbitRing.tsx:18`, which neither lab fixed. |
| Stale camera on switch | fix | A | `displayedSwitchCamera` `use-orrery-switch-runtime.ts:95` | `20538bd1` | `pass-3/35` | T | — |

## Visual language

| Idea | D | Src | Code | Commit | Evidence | Class | Notes |
|---|---|---|---|---|---|---|---|
| Star sun (corona + granulation) | D15 | A | `scene-draw.ts:520` `drawSunBody`; `CORONA_SKSL` `deep-field-shaders.ts:27`; `SUN_DISC_SKSL` `:79` | `b450f47e`, `c862c30a`, `527bd5b4` | `final/21`, `final/41`, `pass-2/12e` | T | Corona churn is ambient motion. Under O2 it is frozen (A's reduced-motion phase), or limited to the existing sun pulse. The photo-sun path was not verified on a device. |
| Thin rings with dash/fade cues | D11 | B | `labb-rings-logic.ts:43-52` + profile alphas `src/theme/orrery-lab-fx.ts` | `ff7ddbdd`, `387b20c8` | `10-r2/before-after-overview.jpg` | R | The constants transplant; draw with the X3 method. Open item: a11y contrast of the thinnest light-theme styles (C-35). |
| Sun-lit rim on rings | D11 | B | shader term `uSpin.zw` in `ringInstrument`/`ringField` (`labb-effects.ts` ~`:395-399`) | `ff90df99` | as above | T | — |
| Subtle orbit light pulses | D10 | B | comet term in the ring shaders; `LabRings.tsx:1178-1203` | `ff7ddbdd` | `04-wp1.3/09-flow-comets-overview-dense.mp4` | R | Set `flow` to about 0.2–0.3, slow it down, put it on the 30 Hz clock. Off under reduced motion. |
| Status rim + atmosphere body shader | D14 | B | `BODY_LIT` `labb-effects.ts:218-310`; `labBodyMaterial` `labb-bodies-logic.ts:56-68` | `469440db`, `0922d223` | `05-m1-checkpoint/18-face-detail-…png` | T | Decay/rogue photo desaturation is a product signal (C-16). Confirm it on device. |
| Lighter face shading | D13 | B | `lightFloor` 0.55/0.75, `LIGHT_Z` 0.4, `wrap` 0.35, far-side haze | `469440db` | `12-phone/shots/02-dense-best-ada-overview-crop-2x.jpg` | T + retune | Proposed: `lightFloor` ≥ 0.8 (dark), `LIGHT_Z` 0.8–1.0, `wrap` 0.5, no haze on faces. Tune on device with real photos. |
| Sky profiles: Standard graphite, light ink | D7, D26, D27 | B | `STANDARD_DARK_ENV`, `LIGHT_ENV` in `B:src/theme/orrery-lab-fx.ts`; `LabEnvironment.tsx` | `11c21745`, `0acdc848`, `54188b10` | `10-r2/06-final/07-overview-dense-standard-dark.jpg`, `13-final/02-shots/07-overview-dense-galaxy-light.jpg` | T (values) / R (render) | Render through A's baked base. Galaxy: more stars than A, a quieter nebula. Galaxy Light needs more flavour. |
| CPU-baked nebula with a per-palette cache | D7 | A | `A:src/components/orrery/lab/nebula-bake.ts` | `c862c30a` | `final/01-04` | R | The bake runs on the JS thread at first mount, unmeasured on a device. A's star look depends on the `nearA` 6× replay quirk (`scene-draw.ts:691-708`), so retune after removing it. |
| Per-System sky hue | D8 | B | `systemSkyIndex` `labb-switch-logic.ts:433-450`; crossfade `LabBRenderer.tsx:497-536` | `30026fda` | `06-wp2.1-switch/05-settled-inner-circle-galaxy-dark-gold-sky-hue.jpg` | T + widen | It is already keyed by the stable `systemRefId`. Only 6 buckets, so widen. No schema change. |
| Orbital-plane grid (optional) | D9 | C | `planePattern()` `C:src/components/orrery/three/orrery-textures3d.ts:329-368` | `0219e4a8`, `c5533857` | `03-checkpoint-b/09-visual-plane-grid-first-pass.png` | T (bake) / R (draw) | Draw with one Skia perspective matrix. Opacity 0 = off. |
| Stack pips (hidden co-angular contacts) | M1 | A | `body-stack.ts:44` `findStacks`; `scene-draw.ts:880` `drawStackPips` | `527bd5b4` | `pass-2/03-crop-co-angular-stack-keyline-pip.png`, `final/01` | T | O(n²) per re-record; fine at 40 bodies, unmeasured at 800. Index it. |
| Moon bump at far zoom that splits on zoom-in | M1, D17 | — | none | — | — | N | Reverses phase-08 "far overview → hidden". Must be visually distinct from pips. The focus card already lists moons (`main:src/screens/OrreryScreen.tsx:1109-1131`). |
| Light-theme blending rule | D26 | C, A | `C:` `applyColors` `orrery-scene3d.ts:805-857`; `A:` chart-mode no-additive rule (`world-plane.test`) | `2ca56317` | `08-final/07a/07b` | R | Use additive/screen blends in dark themes and src-over with ink tokens on pale backgrounds. Key it from the theme store, not luminance. |

## Focus, HUD and interaction

| Idea | D | Src | Code | Commit | Evidence | Class | Notes |
|---|---|---|---|---|---|---|---|
| Reticle | D18 | A | `A:src/components/orrery/lab/reticle-draw.ts`; `deep-field-math.ts:144,160`; `LabScene.tsx:465-518` | `3cd7695d`, `fd7f09c8` | `pass-3/41`, `pass-3/20`, `final/32` | T | Accent only. Under O2 the scan arc is not idle motion: lock-on only. |
| Dim the rest while focused | D21 | B | `BODY_LIT` uK.w defocus; ring `focusDim`; label text dim (floor 0.66) | `11c21745` | `08-wp2.2-focus/07-debug-dense-120-focus-world-response.jpg` | T | The sun is exempt. Lighten the face dim along with D13. |
| Docked focus card + system framing | D19 | C | `C:src/components/orrery/orrery-focus-card-layout.ts:23-64`; focus loop `C:src/screens/OrreryScreen.tsx:754-866` | `97d94229`, `4ece2978`, `7d558d87` | `08-final/05a-dense-focus-fly-in-ava-abara.png`, `07-checkpoint-e/s5-focus-system-framed.png` | T | Re-key `orreryFocusSystemRadius` (C hero scale and moons). Removing the `IDENTITY_ZOOM` cap interacts with tap-to-Profile (X2). |
| Cluster tap zooms in | D19 | — | prod `frameBodies` + `OrreryClusterPanel` | — | — | N | Prod frames the group and opens the panel. The owner wants an actual zoom-in. |
| Card occlusion dim (for AA) | D28, G1 | B | `focusCardOcclusion` (C-61) | — | `09-r1/shots/01-focus-card-occlusion-off-vs-on-dense-eli.jpg` | R | This dims what is drawn under the card, not the card itself (G1 keeps today's glass). |
| Corner-bracket chrome | D22 | B | `B:src/components/orrery/OrreryHudCorners.tsx` | `11c21745` | `08-wp2.2-focus/03-debug-galaxy-dark-home-vs-focus-hud-chrome.jpg` | T | Plain RN, portable. |
| Map under the Orrery title (immersive header) | O4 | B | `13c706ad` (R3 immersive header) | `13c706ad` | `11-r3/05-final/presets-02-overview-dense.jpg` | R | Title stays ≥ 9.9:1 (B measured). |
| Reorder charge arc + projected orbit outline | D23 | B | `LabFeedbackPicture` `B:src/components/orrery/labb/LabFocusFx.tsx:528-597` | `11c21745` | `08-wp2.2-focus/12-debug-sheet-reorder-hold-charge-held-ring-slot.jpg`, `16-debug-reorder-hold-drag.mp4` | T | Drive the charge from the gesture's hold state, not an independent `withTiming`. |

## System switch

| Idea | D | Src | Code | Commit | Evidence | Class | Notes |
|---|---|---|---|---|---|---|---|
| Star warp in/out | D24, W1 | B | `LabEnvironment.tsx:665-797` (Atlas streaks), `labb-switch-logic.ts` (`warpAmount`, `STREAK_*`); pure `sampleSwitchSignal` | `30026fda`, `413d6999` | `06-wp2.1-switch/27-sheet-dense-to-inner-slowmo20-pass2.jpg`, `06-wp2.1-switch/01-first-switch-after-cold-launch-work-to-inner-normal-speed.mp4` | R | Fixed sprite budget. No particles, comets or trims. Keep the pure-signal pattern. |
| Orbit trails (real history, polar resample) | D24 | A | `A:src/components/orrery/lab/world-plane.ts:1306-1410` | `527bd5b4` | `pass-2/12-AFTER-…BEST.mp4`, `pass-3/32`, `final/30-31` | R | Don't mutate scratch state inside a mapper. |
| Camera swirl back to centre | D24 | A (prod) | prod `interpolateCamera` made visible by `20538bd1` | `20538bd1` | `pass-3/35` | R | Make it deliberate: shortest-arc yaw plus an optional authored spin. Part of today's swirl may be a yaw-wrap artifact. |
| Camera breath | D24 | C | `C:src/components/orrery/OrreryWorld3D.tsx:447-466`, `switchBreath` `:266-271` | `64858959` | `08-final/rec-01-system-switch-inner-to-dense-12s.mp4` | T | Compose its yaw with the swirl; don't stack them. |
| Spin / shed / capture choreography | W1 | main | `main:src/logic/orrery-switch-choreography.ts` | — | — | keep | 2100 ms; 180 ms under reduced motion; interaction ready at 0.82. |

## Tooling worth keeping (dev only)

| Idea | Src | Where | Notes |
|---|---|---|---|
| Separate lab app id for side-by-side installs | all | `app.config.ts` package overrides | — |
| Seeds through real write paths (shared 120-contact Size cast) | all | `A:tools/seed-lab-a.py --sizes-only`, `B:src/__dev__/lab-b-seed.ts`, `C:src/__dev__/lab-c-seed.ts` | Rebuild as one dev seed in V2. |
| SurfaceFlinger present counting | A, B | `A:` `evidence/*/tools/`, `B:` `tools/sf-sampler.py` | gfxinfo cannot see a SurfaceView. |
| Per-worklet perf probe | B | `labb-perf-probe.ts` | — |
| Camera presets for screenshots | C | lab badge presets | — |
