# Lab A "Production Skia": evidence audit

Branch `experiment/orrery-skia-production`, worktree `/home/bwales/projects/orbit-orrery-lab-a`, HEAD `62ed49c1`, base `main@3492092`. Read-only audit. Paths are relative to the worktree's `src/components/orrery/` unless they start with `src/` or `evidence/` (= `docs/experiments/orrery-renderer/lab-a-production-skia/evidence/`). Every claim below was checked against code on disk unless it is marked DOC-ONLY.

Checks I ran (read-only):
- `npm run check:colors` → exit 0.
- `npx tsc --noEmit` → exit 0.
- vitest over the lab, camera, frame, label, switch-runtime, frame-mapper, worklet-order and render suites → 14 files, 102 tests, all passed.
- No new dependencies (no package.json change).

---

## 0. Headline corrections (research package or owner premise vs code)

| # | Claim | Verdict |
|---|---|---|
| X1 | **D17 "A's moons: a bump on the parent at far zoom that splits into moons on zoom-in."** | **The code has no such moon behaviour.** Moons come from the **unchanged production** `src/logic/orrery-satellite-logic.ts:31`: `deriveSatelliteBodies` returns `[]` at `overview`, so no moon exists in the frame below zoom 2 (IDENTITY_ENTER). When moons do appear, they sit `parent.radius + 24` world units from the parent centre (`PARENT_GAP`, L18/L68), which is ≥ 48 dp of clear gap at zoom ≥ 2. They are never a bump. **What the owner most likely saw is Lab A's *stack pip*.** `lab/body-stack.ts` `findStacks` groups co-angular contacts whose *drawn* discs overlap, and `scene-draw.ts:880` `drawStackPips` puts one small dot per hidden body on the front body's rim (in the hidden body's ring colour). Zooming in separates the stacked contacts, so the pip "splits" into separate bodies. Those bodies are **other contacts, not moons**. Evidence: `evidence/final/01` (CC and FB carry pips) and `evidence/pass-2/03-crop-co-angular-stack-keyline-pip.png`. Real moons look like `evidence/final/11` (small grey moons on their own orbit, far from the parent). **The owner should confirm which one he meant** before V2 designs D17. |
| X2 | D24 "A's camera swirl back to centre" | **Not a Lab A effect.** It is production `interpolateCamera` (`use-orrery-switch-runtime.ts:60`, unchanged), which smoothsteps the live pose toward `destinationHome`. It only became *visible* in A because of the M2 fix (`20538bd1`): the switch now starts from the live pose instead of snapping. Yaw is mixed linearly on raw values. `clampCameraPose` normalises yaw to [0, 2π) (`src/logic/orrery-camera-logic.ts:254`), so a slightly negative yaw is stored as about 6.2 rad and unwinds almost a full turn. Part of the "swirl" can therefore be an accidental artifact of yaw wrap; I inferred this from the code and did not check it on a device. V2 should author the swirl on purpose (shortest-arc yaw, plus an optional deliberate spin). |
| X3 | D20 "keep A's glassiness" | The card glass is **main's** `GlassSurface treatment="orrery-overlay"`. It is identical on main and in A (`OrreryFocusContext.tsx:183` vs main L87). A changed only the card's **placement** and height cap. There is nothing glass-related to lift. Android blur is off (D-61), so on Android the glass is a translucent tint. |
| X4 | HARVEST M3: the initials fix is a plain bug fix with "Decision: None" | **Partly false.** Main's full-name fallback was a deliberate Phase 29 choice: `.planning/phases/29-orrery-camera-scale-exploration/29-05-SUMMARY.md:93` says it passes the full name "rather than slicing UTF-16 or manufacturing partial emoji". The lab fix uses `Array.from(word)[0]` (`src/logic/orrery-label-logic.ts:34`). That is a *code point*, so it can still produce partial emoji: the first code point of a ZWJ sequence, or a single regional-indicator letter of a flag. It is a recorded plan-level choice, not an ADR, so whether it may be changed is the owner's call. A safe fix keeps the grapheme intent with a Hermes-safe grapheme fallback. |
| X5 | DEAD-ENDS / ARCH: "tilt is one tunable" | `LAB_HOME_TILT_DEG` is one tunable (`src/logic/orrery-camera-logic.ts:74`), but **62° is silently clamped to 60°**: `MAX_TILT = Math.PI/3` (L80), and both `deriveHomePose` (L287) and `clampCameraPose` (L253) clamp to it. See §5. |
| X6 | HARVEST M6 "Unavailable System: not investigated" | I found the root cause on main (§3). |
| X7 | ARCHITECTURE and HARVEST line refs and commits | The ones I spot-checked all held: LabScene structure, `planeHomography` at `deep-field-math.ts:267`, `drawSky` warp loop, the dead-end recovery commits (§4). |

---

## 1. Architecture actually on the branch

**How it hangs together.** `OrreryWorld.tsx` holds one UI-thread `frame` mapper (L306-343): `sampleSwitchChoreography` → camera (live `pose` when settled, else `sampleOrrerySwitchCamera`) → `previewReorder` → `deriveSatelliteBodies` → `projectAnimatedFrame(..., ringPaths = !deepFieldOn)`. This production logic is unchanged apart from the hoisted basis and the `ringPaths` flag.

These mappers derive from that frame:
- `switchFx` (`computeSwitchFx`, L358);
- `bodyLight` (`computeBodyLight`, L366);
- `focusState` / `focusMix`, written during render (L374-411);
- the label allocations.

`lab/LabScene.tsx` is the only Lab node inside the Canvas.

| Piece | Where (file:line) | Commit | V2 classification |
|---|---|---|---|
| Five-picture imperative renderer: `<Group>` of `below / sun / above / reticle / top` `<Picture>`s, all inputs shared values, so the tree never changes | `lab/LabScene.tsx:540-556`; `scene` mapper L304-383 (bodies split at the first sun, from `orderBodies` `scene-draw.ts:381`) | `fd7f09c8` | **General pattern: adopt** |
| Specs built on JS (token RGBA, pre-shaped `SkParagraph`, `SkImage`) and written to shared values during render | `lab/scene-specs.ts` `buildBodySpecs`; `OrreryWorld.tsx` | `fd7f09c8` | General |
| Bounded layers only while fading; focus dim drawn as a background-ink veil, not a layer | `scene-draw.ts:216` `boundedLayer`, `:469` | `fd7f09c8` | General (**never** a `layer` per item) |
| Primitive ambient clock: `floor(clock/33.3)·33.3`, or −1 under reduced motion / no clock | `LabScene.tsx:177-180`; `AMBIENT_HZ = 30` (`deep-field-config.ts:331`) | `fd7f09c8` | General |
| Base texture baked only when static (≥ 2 ambient ticks unchanged); offscreen surface at device pixels | `LabScene.tsx:394-444`; disposed on unmount via `runOnUI` L291-301 | `033e7518` | General, but see leak note §6 |
| Opaque Canvas → SurfaceView | `OrreryCanvas.tsx` `<Canvas opaque={!!backdrop}>` | `dc7f8669` | General for Android. iOS and web have no SurfaceView; `opaque` is harmless there but the gain is Android-specific. |
| World-space plane under the exact homography | `deep-field-math.ts:267` `planeHomography`; `lab/world-plane.ts` `makePlaneShapes` L339 (30 `SkVertices` annulus strips, ε ladder `0.001·1.25^k` L322), `ringBand` L416, `circleMatrix` L536, `drawWorldPlane` L806; shaders `RING_WORLD_SKSL` (`deep-field-shaders.ts:296`) and `GRID_SKSL` (L367) | `033e7518`, `5fb0f0d7` | **General: adopt** (analytic screen-dp strokes; never stroke under a perspective CTM) |
| `ringPaths=false`, so Lab frames carry no 128-point ring polygons | `src/logic/orrery-camera-logic.ts` `projectFrame`; `OrreryWorld.tsx:305` | `5fb0f0d7` | General |
| Effect cache: `labEffect` lazy and memoised, null fallback | `deep-field-shaders.ts:458` | `0a73a54c` | General |
| Reduced-motion gating | `ambient=-1`: corona phase 1.7, granulation 2.3 (`scene-draw.ts:550,561`); reticle locked with scan parked (`LabScene.tsx:470,487-489`); `computeSwitchFx` idle under live or transition RM (`deep-field-math.ts:214`); `fadeIn` returns 1 (`scene-draw.ts:401`); `focusMix` instant (`OrreryWorld.tsx:407`); nebula fade instant (`LabScene.tsx:206`) | various | General |
| Lifecycle | One `useClock` in `OrreryCanvas`, read via `OrreryClockContext`. The canvas unmounts when not `measured && isFocused && appActive` (`src/screens/OrreryScreen.tsx:610`, production, unchanged). Base surface disposed on unmount. Photo custody in `lab/use-lab-photos.tsx` (UI-thread dispose after the spec write; 1.5 s unmount grace, L30). Nebula and effect caches are module-level and never disposed. | — | General, with the custody owner question below |
| A/B toggle store | `lab/deep-field-mode.ts` (zustand, not DEV-gated) | `b1cfde37` | Lab-only, drop |
| DEV marker | `lab/LabHud.tsx` | — | Lab-only |
| Owner question | Photo custody moves D-41 rule 3 (dispose) to a hand-off | — | Owner (D-41) |

---

## 2. Harvest map for the owner's picks

| Feature | Files / functions / shaders | Commit | Evidence (exists ✓) | Tunables (`deep-field-config.ts`) | Perf | Tokens | Reduced motion | Class |
|---|---|---|---|---|---|---|---|---|
| **Star sun (D15)** | `scene-draw.ts:520` `drawSunBody`; `CORONA_SKSL` (`deep-field-shaders.ts:27`; sum-of-sines rays, no hash); `SUN_DISC_SKSL` (L79; 3-octave warped-sine granulation plus μ heat and limb band); uniform builders L324 (14 floats) and L351 (13); photo-sun branch L562 | `b450f47e`, `c862c30a`, `527bd5b4` | `final/21` ✓, `final/41` ✓, `pass-2/12e` ✓ | `CORONA_EXTENT 2.7`, `CORONA_SPEED 0.00045`, `CORONA_ALPHA_DARK 1 / LIGHT 0.85`, `SUN_GRANULE_SPEED 0.00035`, `FLARE_GAIN 1.25` | The `sun` picture re-records at 30 Hz: the only idle redraw (21 presents/s, release). | Colours are uniforms from `spec.fill` (occupant glow) and `orreryStarlight` / background. No literals. | Frozen phase. | **TRANSPLANT** the shaders and draw function (precision-safe, token-only, length-pinned in `scene-draw.test.ts`). Churn and granulation are new ambient motion (ADR-048/077), an owner call; a frozen phase has no collision. The photo-sun path was not device-verified (DOC). |
| **"Moons" (D17)** | See X1: what the owner saw is **stack pips**: `body-stack.ts:44` `findStacks` (union-find over drawn-disc overlap, contacts only, opacity ≥ 0.5); `scene-draw.ts:880` `drawStackPips` (hidden in switch FX). Real moons: production placement plus `scene-draw.ts:476` `drawMoonBody` (lit body shader, min 4.5 dp) and moon orbits at `world-plane.ts:1205`. | `527bd5b4` | `pass-2/03` ✓, `final/01` ✓; moons `final/11` ✓ | Pips: `STACK_OVERLAP 0.8`, `STACK_PIP_R 3.2`, `MAX 4`, `STEP 0.42`, `ANGLE -0.75`. Moons: `MOON_VISUAL_MIN_RADIUS 4.5`, `MOON_VISUAL_MAX 2.2`, `MOON_ORBIT_ALPHA`; production `PARENT_GAP 24`, `MOON_RADIUS 4`, visible from zoom ≥ 2 (exit 1.85). | `findStacks` is O(n²) per `top` re-record (fine at 40 bodies; unmeasured at 800). | Pip ink = hidden body's ring colour, fallback `textSecondary`; moon ink `textSecondary`. | Pips static. | **Hit-testing:** none added. A tap on a stack goes to production `resolveOrreryTap`, so an ambiguous overlap opens the existing group panel; moon taps use production `resolveSatelliteTap` (`orrery-satellite-logic.ts:88`, `MIN_HIT_RADIUS 22`). **REIMPLEMENT:** if the owner means "parent shows its moons as a bump at far zoom, splitting on zoom-in", nothing in any code does that. It needs new semantics (an overview moon cue + split threshold), written against ADR-105 and D-09/D-11. If he means stack pips, `findStacks` + `drawStackPips` are TRANSPLANT-grade. Also new: list moons on focus. |
| **Reticle (D18)** | `lab/reticle-draw.ts` `drawReticle`: axis-aligned screen-dp brackets with outBack converge, lock ring + ticks + scan arc, flash and ping. Geometry `deep-field-math.ts:144` `reticleDrawnRadius`, L160 `reticleGeometry`. Lock timeline `LabScene.tsx:465-480`; picture L481-518 (a stable `empty` picture when unfocused). Focus state written during render (`OrreryWorld.tsx:374-400`). | `3cd7695d`, moved in `fd7f09c8` | `pass-3/41` ✓, `pass-3/20` ✓, `pass-3/21` ✓, `final/32` ✓ | `RETICLE_GAP_DP 5`, `GAP_FRAC .16`, `ARM_FRAC .34`, `ARM 6..15`, `STROKE 2`, `RING_DP 3.5`, `SCAN_ARC .8`, `SCAN_SPEED .0007`, `LOCK_MS 760`, `OVERSHOOT 1.6` | 30 Hz re-record while focused (scan). | `colors.accent` only | Locked; scan parked; no flash or ping. | **TRANSPLANT** (self-contained worklet, needs only a drawn radius). The scan arc is ambient motion (owner call) and can be dropped. Size the reticle from V2's drawn radius. |
| **Switch trails (D24)** | `world-plane.ts:1306-1410`: real-history trails, kept in world space (inverse homography), polar resample about the sun, gradient stroke, inner-ring thinning, leaving-body peel-off. Trail history is mutable UI scratch (`LabScene.tsx:272`), mutated inside the `scene` mapper's picture callback. Spin and velocity: `computeSwitchFx` (`deep-field-math.ts:208`) mirrors the choreography curve. Also: glints L1412, ripples L1434, sky warp/kick `scene-draw.ts:631`. | `527bd5b4` (polar trails), `3cd7695d` | `pass-2/12-AFTER-...BEST.mp4` ✓, `12e` ✓, `pass-3/32` ✓, `final/30`, `31` ✓ | `TRAIL_MS 160`, `TRAIL_LEAVING_MS 340`, `TRAIL_WIDTH 1.15`, `TRAIL_INNER_REF 9`, `FLOOR .3`, `TRAIL_ALPHA_DARK .42 / LIGHT .26`, `TRAIL_MAX_ARC 2.4`; warp `WARP_COPIES 5`, `WARP_STEP .014`, `SWITCH_STAR_STRETCH .06`, `SWITCH_SKY_KICK .16` | One stroked convex open arc per moving body per frame, during the switch only. Release switch: 83-120 visible changes tap→settle (screenrecord-limited). | Ring colour (token-derived); `BLEND_PLUS` in dark, src-over in chart | All off (`fx` idle). | **REIMPLEMENT-lite.** The algorithm is good and could almost be lifted, but the scratch-mutation-in-mapper design is fragile, and it must be re-tied to V2's choreography (B's warp). Note: the "planets streaking around their orbits" are the **production choreography spin** (`orrery-switch-choreography.ts`, untouched) plus A's trails. |
| **Camera swirl (D24)** | Production `interpolateCamera` (`use-orrery-switch-runtime.ts:60`) + `displayedSwitchCamera` (L95, `20538bd1`) | `20538bd1` | `pass-3/35` ✓ | — | — | — | Choreography RM crossfade | **REIMPLEMENT** as a deliberate camera path (see X2). Keep the M2 fix. |
| **Glassy card (D20)** | main `GlassSurface` (see X3); A's placement is `lab/focus-card.ts` | `527bd5b4`, `3cd7695d`, `0c0b18b4` | `final/41` ✓, `pass-3/10` ✓ | `focus-card.ts` min width 168, min height 112 | — | tokens | — | Glass: **nothing to lift**. Placement: **do not take**. Owner D19 wants C's docked card; A's card-above is rejected. A's obstacle-avoidance math is reference only. |
| **Body lighting / presence** | `BODY_SKSL` (`deep-field-shaders.ts:137`; terminator, limb, status rim, specular, far tint, halo, keyline); `bodyUniforms` 35 floats (`scene-draw.ts:274`); `computeBodyLight` (`deep-field-math.ts:347`); `bodyVisualScale` / `bodyDepthScale` (L78/L92) | `c862c30a`, `527bd5b4` | `final/12` ✓, `pass-2/03` ✓ | `BODY_VISUAL_MIN_RADIUS 21`, `BODY_VISUAL_MAX 1.6`, `BODY_SHADOW_MAX_*`, `BODY_RIM_*`, `BODY_FAR_SHRINK` | One shader draw per body, ≈10 JSI calls + 35 floats each (DOC). | tokens | static | **REIMPLEMENT.** The owner picked B rim + glow (D14) and lighter faces (D13). The keyline idea and the visual-minimum idea are worth keeping; D16 (B FLOOR) overlaps with A's visual minimum. |
| **Base sky** | `LabScene.tsx:210-269` (stars recorded once per size and palette, vignette); `sky-resources.ts` `scatter` / `recordStars`; `nebula-bake.ts` (CPU float64 value-noise band, 256² RGBA, module cache per palette); `drawSky` (`scene-draw.ts:631`, parallax) | `c862c30a` | `final/01-04` ✓, `pass-1/40` ✓ | `STARS_FAR_COUNT 240`, `STARS_NEAR_COUNT 70` (chart: 90 / 26), `STARS_HERO_COUNT 7`, `NEBULA_ALPHA_DARK .32`, `NEBULA_BAND_WIDTH .11`, `NEBULA_GAIN 1.8`, `NEBULA_DUST_STRENGTH .75` | The bake runs **on the JS thread during the first mount's `useMemo`**; its cost was never measured on a device. Plausible contributor to the 3a "sluggish open" (unverified). | tokens | Nebula fade instant | **REIMPLEMENT.** The owner wants more stars and a much quieter nebula, and B's graphite and per-System hue. Keep the "CPU bake / never GPU fbm on Mali" rule and the per-palette cache. Note that the current look depends on a bug: `nearA` is replayed **6×** at rest (`scene-draw.ts:691-708`; WARP loop with v=0), which compounds its alpha. Retune after removing that. |
| **Light / chart-paper theme** | `deep-field-ink.ts` (`chart` = background luminance > 0.5); chart branches in shaders (corona engraved rays, L64), `world-plane.ts` (`fxBlend` src-over), `nebula-bake.ts`; six `orrery*` tokens in all four presets (`src/theme/theme-types.ts`, `theme-presets.ts`) | `202b0d6c`, `b450f47e`, `c862c30a` | `final/02`, `04` ✓, `pass-1/41` ✓, `direction-1/14`, `15` ✓ | `NEBULA_CHART_INK .2`, `*_LIGHT` alphas | — | Token-only (`check:colors` passes) | — | **Principle TRANSPLANT** (no additive blends in light; `world-plane.test` pins it). Owner D26 prefers B's light mode, so the look is REIMPLEMENT. |

---

## 3. Main-line fixes A found

All four code fixes are confirmed **still present as bugs on main** today (`/home/bwales/projects/orbit-app`, HEAD `34920925`).

| Fix | Commit / files | Root cause (verified) | On main today? |
|---|---|---|---|
| **Switch / focus freeze (worklet captures)** | `842f1f36`: `OrreryWorld.tsx` (frame worklet captures only shared values and `{id, uid}`), `use-orrery-switch-runtime.ts` (publish ships `world` + `generation`; `useMemo` return), `src/logic/orrery-frame.ts` (`keyIndex` O(1) `frameBody` L50-55, `billboardMap` L275), `OrreryCanvas.tsx` (memoised content), `SatelliteBody.tsx`, `ProjectedOrbitRing.tsx`. Guard: `orrery-frame-mapper.test.ts:207` fails on capturing `switchRuntime` / `scene` / `resources`. | Worklets 0.10.4 materialise every captured object per mapper start. About 241k nodes per restart were measured (`evidence/perf/closure-bench.test.ts.txt`, DOC). | **Yes.** Main's frame worklet captures `switchRuntime.*` and `scene.*` directly (main `OrreryWorld.tsx` ~L225-245). The runtime returns a fresh object (main `use-orrery-switch-runtime.ts:401`). `runOnUI` captures `scene` (L298-320). |
| **Projection basis hoist** | `ba3cef68`: `src/logic/orrery-camera-logic.ts` `projectionBasis` / `projectWithBasis`; bit-exact test | `projectWorldPoint` re-derives `usableCameraRect` (obstacle subdivision + sort) and the trig **per point**: about 128 × N per frame. | **Yes.** Main `projectFrame` calls `projectWorldPoint` per ring point (main `orrery-camera-logic.ts:509-529`). |
| **Stale camera on switch** | `20538bd1`: `displayedSwitchCamera` (`use-orrery-switch-runtime.ts:95`), 3 tests in `orrery-switch-runtime.test.ts` | When settled, `interpolateCamera(from, to, 1)` returns the *previous* switch's target, so the first switch frame snaps after any pan, zoom, recenter or cold-start Home. | **Yes.** Main L313 and L371 still use `interpolateCamera`. |
| **Hermes initials "El…"** | `c862c30a` (code) + `864f7e04` (test): `src/logic/orrery-label-logic.ts:21-40` | Hermes lacks `Intl.Segmenter`, and main returns the whole name. | **Yes** (main `orrery-label-logic.ts:22`). See X4: the full-name fallback was a recorded Phase 29 choice, and A's code-point fallback can split emoji. |
| **"Unavailable System" label** | Not fixed in A | Main `src/stores/orrery-system-store.ts:95-104`. On cold-start restore, `OrreryScreen.tsx:466` calls `select(system, undefined, false)`. For a **custom** System there is no name source, so `name ?? categoryName ?? (previous id match ? … : "Unavailable System")`. The post-load refresh (L122-131) only fills `currentName` for `kind === "category"`, so **a custom System keeps "Unavailable System" after a successful load.** Categories self-heal after load. | **Yes.** The code path is verified; I did not reproduce it on a device. The fix: resolve the custom System's name from the loaded snapshot or systems DAO in the post-load `set`. |
| Paragraph cache / 800-body crash | Not from A. A has a JS initials `ParagraphCache` in `scene-specs.ts`. The 800-body crash is not in A's commits. | — | — |

M5 (focus card covering the body) is real on main, but D19 replaces the card placement anyway.

---

## 4. Dead ends (verified where recoverable)

| Dead end | Verified |
|---|---|
| A1: declarative tree with per-body `layer` (about 120 full-canvas saveLayers; release ≈12 fps idle, 92 % main thread) | Tree at `6ad5a307`; deleted in `fd7f09c8`. Main still pins `layer` on every body root (`orrery-render.test`, DOC). |
| A2: clock-captured derived values returning fresh objects (redraws at display rate, even under RM) | `6ad5a307:…/lab/BodyOverlays.tsx` (8 clock refs) ✓ |
| A3: GPU fbm nebula on Mali (facets, seam) | `NEBULA_SKSL` exists at `b450f47e:…/deep-field-shaders.ts` ✓; evidence `direction-1/00`, `01a` ✓ |
| A4: strokes and dashes under a perspective CTM (CPU path masks, 150-200 ms idle p50) | `c862c30a:…/world-plane.ts:293 canvas.concat(H)` ✓ |
| A5-A9: DashPathEffect, drawOval quads, sweep gradients, JOIN_ROUND (650 ms), clipped layers | Not committed (DOC-ONLY) |
| A10: re-baking the 18 MB base texture every camera frame | `fd7f09c8:…/LabScene.tsx` (DOC) |
| A11: JS-projected 128-point ring polygons per frame (32 ms) | `2111be64` (DOC) |
| A12: TextureView present ceiling ≈24-26/s | Legacy path at HEAD (`opaque={!!backdrop}`) ✓ |
| A14: `executeOnUIRuntimeSync` switch start | Not committed |
| A15 / B16: `drawPicture` ignores paint, so twinkle never rendered; `nearA` replayed 6× at rest | `6ad5a307:…/DeepFieldBackdrop.tsx:411,414` `<Group opacity={twinkleA/B}>` ✓; HEAD `scene-draw.ts:619-708` ✓ |
| B6: Home tilt 28° imperceptible (f ≈ 4.65 × extent, weak perspective) | Consistent with `deriveFocalDistance` (§5) |
| B9: chord trails polygonal | `pass-2/12c` mp4 ✓ |
| B11 / B12: spinning or React-mounted reticle | `527bd5b4` (DOC) |
| C1: nebula `usePictureAsTexture` re-raster on remount | `0a73a54c:…/DeepFieldBackdrop.tsx` ✓ |
| C2: module SkImage photo cache (reverses D-41, owner) | Not attempted |
| D1-D6 (method): CanvasKit previews hide Mali bugs; debug perf is relative only; UI `console.log` arrival is not a timestamp; `gfxinfo` blind to SurfaceView; `adb swipe` input-bound; Perfetto `trace_processor` crashes on this CPU | DOC; consistent with the tooling |

---

## 5. Tilt: what depends on it, and 62°

**The 62° trap.** `LAB_HOME_TILT_DEG` (`src/logic/orrery-camera-logic.ts:74`) is clamped by `MAX_TILT = π/3 = 60°` (L80) in `deriveHomePose` (L287) and `clampCameraPose` (L253). Setting 62 yields 60.

Raising `MAX_TILT` is not a local change:
- `deriveFocalDistance(extent) = max(256, extent·(1+√2)·sin(MAX_TILT)/0.45)` (L100-108), so f changes, and with it the perspective of **every** pose, user tilts included;
- `projectFrame`'s depth clamp also uses `sin(MAX_TILT)` (L585-589);
- the ring far-alpha normaliser does too (`world-plane.ts:966`).

V2 should make Home tilt and the max tilt separate, deliberate tunables.

**What depends on tilt in A:**

| Consumer | Behaviour at 45° → 60-62° |
|---|---|
| Home fit `deriveHomePose` | `near = f/(f − e·sin t)`. With f ≈ 4.65e: 1.18 at 45°, 1.23 at 60°. Fit = min(w / 2e·near, h / 2e·near·cos t). cos 62° = 0.47, so height stops binding and width binds; zoom is about 4 % lower. |
| Near/far scale | Near/far ratio ≈ 1.36 at 45° vs ≈ 1.46 at 60°. Perspective stays weak: it is mostly vertical squash (cos t), not depth. C's "62°" look came from a different camera. Expect A's projection at 62° to read as **flattened, not deep**. |
| D6 near-side size cap | A has no clamp, only `BODY_FAR_SHRINK` (far side smaller). The near-side enlargement (×1.23) is uncapped. B's CLAMP is needed. |
| Ring strokes (`RING_WORLD_SKSL`) | Analytic screen-dp widths via the Jacobian, so they hold. The band ladder tops out at ε ≈ 0.65 R, ample. Radial compression grows (cos t), so bands widen and early-out overdraw rises. Unmeasured (GPU time is unmeasured since the SurfaceView change). |
| Grid, pool, haze | Analytic under H, so exact at any tilt. Haze and shadow gates saturate at `SHADOW_TILT_FULL` (0.45 rad), so they are at full strength at both angles. |
| Bodies, labels | Bodies are screen-facing billboards. Labels are allocated in screen space from `frame` (unchanged). The vertical squash packs rings closer on screen, so there are **more co-angular stacks and pips** and more label-allocation conflicts on the near and far sides. |
| Moons | World-space offset, so the moon gap squashes vertically (×0.47 vs ×0.71). Still separate. |
| Sky parallax | `drawSky` slides layers by `tilt × slide` dp: near stars 160/rad gives 126 dp at 45° and ≈ 168-173 dp at 60-62°. The sky disc radius is `hypot(w,h)/2 + SKY_MARGIN (140)`, and at Home zoom < 1 the near-star scale is < 1. **Bare bottom corners are likely at 60°+**; verify on a device. |
| Light / far factor | `computeBodyLight` uses sin t, so far tint grows slightly. |
| Hit-testing | Exact homography = `projectWorldPoint`; taps stay exact. |

`deriveHomePose` is shared, so the legacy renderer and Recenter tilt too. That reverses the phase-08 dossier "top-down Home" and the systems doc "Recenter restores Home axes" (owner D3 knows).

---

## 6. Lifecycle, accessibility, theme, maintainability

- **Tests added** (all pass):
  - `lab/lab-scene-render.test.tsx`: node count independent of body count; empty reticle picture is reference-stable;
  - `world-plane-camera.test.ts`: H ≡ `projectWorldPoint` ≡ `ringPath` at 1e-6; uniform lengths; one `drawVertices` per ring;
  - `world-plane.test.ts` (no additive blend in chart mode), `scene-draw.test.ts` (uniform lengths), `deep-field-math.test.ts`, `pass2/pass3-presentation.test.ts`;
  - `orrery-frame.test.ts`, `orrery-switch-runtime.test.ts` (M2), `orrery-label-logic.test.ts` (no-Segmenter case);
  - the worklet-order test also scans the lab files (Hermes forward-ref rule).
- **Theme:** `check:colors` passes. The only numeric colours are a transparent clear (`LabScene.tsx:121`) and a black `tokenInk` fallback for mocks (`deep-field-ink.ts:29`). Six new `orrery*` tokens are set in all four presets.
- **Possible leak / memory pressure:** every bake calls `surface.makeImageSnapshot()` (`LabScene.tsx:432`) and **never disposes the previous snapshot**. That is an ≈18 MB GPU image per settle (pan-stop, focus, switch end), reclaimed only by JSI GC. The measured plateau (562 MB after 10 switches) suggests GC keeps up on the 6 Pro. Unproven on the 3a. V2: dispose the old snapshot when it is replaced.
- **Fragility:**
  - trail history is mutated inside a `createPicture` callback within a derived mapper (side effects in a mapper);
  - `drawMoonBody` uses `moonVisualScale` for its geometry but `bodyVisualScale` for its AA uniform (`scene-draw.ts:488` vs `:506`), a minor inconsistency;
  - the `nearA` ×6 replay is load-bearing for today's look.
- **Idle cost:** the SurfaceView keeps the panel at 120 Hz while ambient changes at 30 Hz. Release idle main thread is 32 % (`evidence/camera-perf/release/relfinal-cam3.txt`). The always-on `useClock` is the cause. V2 must stop the clock between ticks or drive ambient differently. This bears directly on D29 heat.
- **Accessibility:**
  - focus emphasis and reticle are instant or static under RM;
  - status stays distinguishable without colour (dash and width channels pinned in `world-plane.test`);
  - no new a11y labels; the canvas is unchanged, and hit and label semantics are untouched.
  - A moon's focus card can cover its parent's label (residual, visible in `final/11`).
- **Portability:**
  - SkSL runtime effects, `SkVertices`, `Surface.MakeOffscreen` and pictures exist in RN-Skia on iOS and web (CanvasKit). Offscreen-surface memory on web is untested;
  - SurfaceView is Android-only;
  - the precision lesson (no hashes or fbm in SkSL) applies to every mobile GPU.
- **Not for V2:** the A/B toggle (`b1cfde37`, visible in release builds), `LabHud`, and package id `com.bwales.orbit.laba`.
- **The loading box the owner dislikes is not Lab A code.** It is production `OrreryNotice kind="world-loading"` (`src/screens/OrreryScreen.tsx:1210-1218`); A has no screen changes.

---

## 7. Perf facts (as quoted; source; device)

All figures are from the Pixel 6 Pro (`raven`) only, with the seeded 40 / 32 / 3 contact Systems. There is **no Pixel 3a measurement in Lab A**; the owner's 3a notes are his own observations.

| Fact | Build | Source |
|---|---|---|
| "idle presents/s over 3s: 21.0"; "idle refresh vsyncRate=120.00 Hz"; "ales.orbit.laba:32%" | release `5fb0f0d7` | `evidence/camera-perf/release/relfinal-cam3.txt` ✓ |
| "pan presents in last 1.0 s: 63 median gap 16.6 ms p90 25.0 ms" (input-injection-bound); pan CPU "61%" | release | same ✓ |
| "rm presents/s over 3s: 0.0"; RM CPU "13%" | release | same ✓ |
| Recenter animation bursts "84 fps", "92 fps", "82 fps", median gap 8.3 ms | release | same ✓ |
| PSS "449239" kB after load, "561896" kB after 10 switches; EGLmtrack 161820 kB | release | same ✓ |
| Thermal status 1, 349 → 353 (tenths °C) over a 2-min soak | release | same ✓ |
| Imperative renderer vs declarative: idle main thread ≈92 % → 15-16 %; focus first change 3.6->10 s → 0.06-0.18 s; PSS after 10 switches 1010 → 559 MB | release `6ad5a307` → `fd7f09c8` | `PERFORMANCE.md` §3.4 / `evidence/arch-perf/release/*.json` (files exist; I did not recompute) |
| Freeze fix: max Davey 4984 / 4609 / 3881 ms → 0; frame-worklet 345-475 ms → 4-8 ms | debug-native + production JS (relative only) | `evidence/perf/latency-summary.txt` (DOC) |
| Plane record 32 → 4.8-5.6 ms per camera frame; frame worklet 4.1 → 0.45 ms | debug probes (relative) | `_notes/CAMERA-PERF-PASS.md` (DOC) |
| Switch settle 1.89-2.61 s; 83-120 visible changes tap→settle | release | `PERFORMANCE.md` §3.5 (DOC) |
| Nebula bake ≈140 ms for 2 palettes | **node, not device** | DOC |
| GPU time; real-finger pan and pinch | **unmeasured** | — |
