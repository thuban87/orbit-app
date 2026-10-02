# Lab B "Skia Unleashed": evidence audit for the Orrery V2 synthesis

## Scope and method

- **Target.** Worktree `/home/bwales/projects/orbit-orrery-lab-b`, branch `experiment/orrery-skia-unleashed`, HEAD `8fed9f82`. The base is `34920925`, which is still main's HEAD, so "main today" means the base code.
- **Size.** 56 commits; 79 `src` files changed, +20,557 / −242.
- **Read-only.** Nothing was edited, built or run on a device.
- **Method.** Every claim below was checked against the files on the branch, with file:line where it matters. Two read-only sub-audits (main-line fixes; switch, perf and dead ends) were run, and I re-checked their key claims myself (spot-checks marked ✔).
- **Abbreviations.**
  - `PKG` = `docs/experiments/orrery-renderer/lab-b-skia-unleashed/`
  - `L` = `src/components/orrery/labb/`
- **Device coverage.** Every phone number comes from the **Pixel 6 Pro** (Mali-G78, 120 Hz). **The Pixel 3a was never measured by Lab B**: no doc or evidence file mentions a 3a or an Adreno GPU.

---

## 1. Architecture on the branch

| Area | What is actually there (verified) | Notes |
|---|---|---|
| Renderer entry | `OrreryWorld.tsx:664` mounts `LabBRenderer` when `renderer === "lab"`; otherwise the legacy `OrreryCanvas`. The model half (frame, allocations, gestures, camera) is shared. | Only one canvas and one clock are ever mounted. |
| Production `frame` consumption | Reads the shared `frame` `SharedValue<AnimatedFrame>`, which is built in `OrreryWorld.tsx:291-335`. The lab adds two things to it: `labClampNearSizes` (`:334`) and the `ringPathMode` capture. Each frame builds one `key→index` map (`L/labb-frame-index.ts:19 indexFrame`); every layer looks bodies up with `bodyAt`. | Same frame contract as production, so hits, labels and focus stay in agreement. |
| Canvas | `L/LabCanvas.tsx`: one pausable clock (`useLabClock` via `useFrameCallback(tick, active)`, `:120-135`), a 400 ms warm-up (`WARMUP_MS`, `:69`) and `<Canvas opaque={opaque}>` (`:200`). | `opaque` gives a SurfaceView, which is Android-specific. iOS and web behaviour is unknown (portability). |
| Memo boundary | `memo(LabBRendererImpl, sameContract)` (`LabBRenderer.tsx:314`), comparing `switchRuntime` part by part (`:286-312`). | — |
| UI-thread pictures per layer | Bodies: two pictures (behind/front around the sun), `L/LabLayerPictures.tsx:652-799`. Labels: `LabLabelsPicture`. Rings: `RingClassesPicture` (`L/LabRings.tsx:794-952`), plus `WakesPicture`, `TrimRingPicture`, focus/feedback pictures (`L/LabFocusFx.tsx`) and switch FX (`L/LabSwitchFx.tsx`). | The sun, Polaris, tethers, ticks and chart are still declarative components. |
| Untilted rings (hybrid) | One picture: `drawCircle(0,0,r)` per ring, inside `<Group matrix={planeHomography}>`, with one `ringInstrument` shader per class (`LabRings.tsx:1336-1371`). Each of these returns an empty picture while tilted (`planeTilted`, `:141`). | — |
| Tilted rings: ring field | `L/LabRingField.tsx` plus `L/labb-ring-field.ts`, shader `ringField` (`L/labb-effects.ts:646+`). One full-screen rect per frame. Per pixel: inverse homography, then a radius LUT (4096 bins), then the nearest ring and its neighbour from an RGBA8 ring table, with coverage taken from the Jacobian. The data textures rebuild only when entries change (`sameEntries`, `:279`). The picture returns empty when `!hasPerspective(m)` (`:301`). | **The field data worklet still runs when untilted** (`:205`). So PHONE-PASS §10.3's "the untilted path is the pre-fix code" is **FALSE**, though the extra cost is small (~0.3 ms). |
| Projected-ellipse rings | `L/labb-plane-ellipse.ts` (conic from the adjugate) and `L/labb-plane-draw.ts` `strokePlaneCircleAuto`. These are used for single overlays: focus glow/lock, ripples, the held reorder ring and the shockwave. Per-ring ellipses (`b22b6ae4`) are now only a fallback (`ringField:0`). | Tested < 1e-3 px against `projectWorldPoint` (`labb-plane-ellipse.test.ts`, 10 cases). |
| Flag / preset system | `src/stores/orrery-labb-fx-store.ts`. `LAB_FLAG_REGISTRY` (`:33-535`) gives each flag a section, a default and a `heavy` marker (heavy = unmount while off). Presets `best / shipSafe / everything / legacy` via `labPresetFlags` (`:592`), with `NOT_SHIP_SAFE` at `:561`. The store is mirrored into one `fxFlags` SharedValue (`LabBRenderer.tsx:341-351`). | Debug-section flags keep their current value across presets (`:595-597`). So **`fpsHud` (default ON) stays on in every preset**, including what the owner tested. |
| Perf harness | `L/labb-perf-probe.ts` (per-worklet probe, logcat `[labb-probe]`); `L/debug/LabFpsOverlay.tsx`; the deep-link parser in `L/debug/LabFxPanel.tsx`; and `PKG/tools/*.sh` / `sf-sampler.py` (SurfaceFlinger presents). | Phone matrix rows ran with `idleClock:0` (clock always on), which is **not** the shipped default. |
| Lifecycle | `OrreryScreen.tsx:436-446,638` computes `visible = measured && isFocused && appActive`. `:1078` mounts the world only while `visible && sessionReady && scene`, so blur or background **unmounts** the canvas and the clock stops. | Every return to the screen re-bakes the 768² nebula (`LabEnvironment.tsx:412 useTexture`), re-warms shaders and re-decodes photos. That is part of the "slow to reload after tab return" the owner saw in all labs. |
| Lifecycle evidence | FINAL-VALIDATION: 0 frames on another tab or in the background. The phone pass agrees. | — |
| Reduced motion | `labAmbientNeeded` (`L/labb-clock-logic.ts:22-50`) pauses the clock under reduced motion. Switch FX are gated by `switchFxLive` (`L/labb-switch-logic.ts:101-108`); with reduced motion the switch is a crossfade only. Focus, ping and slot use instant or short flashes (`labb-focus-logic.ts` `RM_*`). | Lab override: `src/theme/reduced-motion-override.ts` (C-21, delete before shipping). |
| Reduced-motion evidence | Phone: 0 presents and 0 changed pixels (`14-tilt-fix/phone/rm-static-*`). | — |

### Lab A versus Lab B as the V2 foundation

| | Lab A (`orbit-orrery-lab-a/src/components/orrery/lab/LabScene.tsx`) | Lab B |
|---|---|---|
| Canvas tree | **Five `<Picture>` nodes whose inputs are shared values only.** React commits (focus, photo resolve, label rebuild) write shared values and **never change the tree** (`LabScene.tsx:1-25`). | Many layers, plus `photoVersion` React state inside the renderer (`LabBRenderer.tsx:414-432`). Each photo arrival re-renders the renderer, re-records the canvas and restarts the bodies worklet (deps include `photoVersion`, `LabLayerPictures.tsx:646`). |
| Ambient redraw | Quantised to `AMBIENT_HZ = 30` (`deep-field-config.ts:331`). The static base is **rasterised once** to an offscreen surface when the scene has settled, and the image is blitted (`LabScene.tsx:390-445`). | Full display rate, 120 Hz on the 6 Pro. Nebula drift, twinkle, sun corona and flow all tick, and flow re-records the ring picture (untilted) or the field (tilted) on every tick. |
| Owner perception | A: smooth and cool. | B: a little janky and warmer. |
| Worth taking from B | — | The ring field (the only proven way to draw tilted orbits on Mali), the projected-ellipse helpers, packed `float4` uniforms, the pausable idle clock, the pure switch signal, the flag registry, and SurfaceFlinger tooling. |

**Recommendation:** use **Lab A's scene architecture as the V2 base** (a stable tree, a quantised ambient clock and baked statics). Port **B's ring field, ellipse maths and switch-signal purity** into it. B's evidence supports this:
- the post-fix Perfetto shows B CPU-bound at about 60 fps on a 120 Hz phone (`animation` 14.6 ms, main 79 % Running; `PKG/evidence/14-tilt-fix/perfetto/field-best-dense-idle.summary.txt`);
- the owner reports B as warmer.

---

## 2. Harvest map for the owner's picks

**Perf convention.** Numbers are emulator-relative unless marked "6 Pro". The 6 Pro numbers are release, preset best, from PHONE-PASS / PERFORMANCE §9–§11.

**Token convention.** No colour literals appear in lab code; a grep of `labb/` and `OrreryHudCorners.tsx` found none. "Formula-mixed" means numeric mixes of tokens inside SkSL or `mixVec`, which C-03, C-32, C-40, C-44 and C-53 flag as "needs authored tokens".

| Pick | Files / functions / shader | Commit | Tunables | Cost | Tokens | Reduced motion | Evidence (exists ✔) | Verdict |
|---|---|---|---|---|---|---|---|---|
| **D11 RINGS (thin)** | `L/labb-rings-logic.ts:43-52` `ringInstrumentClass` (`width×0.42+0.2` → 1.04 / 1.46 / 1.88 dp); `ringInstrument` and `ringField` shaders (dashes, far-side depth fade) | `ff7ddbdd`, `387b20c8` | `RING_WIDTH_SCALE` 0.42, `RING_WIDTH_BASE` 0.2, `DASHED_PERIOD` 11 / `DUTY` 0.58, `TRACE_*`, `FADED_ALPHA` 0.7, `TRACE_ALPHA` 0.42, `RING_CLUTTER_GAP_DP` 20 / `FLOOR` 0.35. Profile `alpha` 0.5 dark / 0.7 light, `farAlpha` 0.32 / 0.4 (`src/theme/orrery-lab-fx.ts`) | Untilted: free on the circle op. Tilted: the field, one screen of fragments | Status tokens via `orreryRingStyle`. Alpha is lowered, so the a11y contrast check is open (C-35) | Static | `10-r2/before-after-overview.jpg` ✔ | **REIMPLEMENT** as a style spec. The constants transplant; the draw must be the field (tilted) or circle op (flat) inside A's scene |
| **D11 RIM (sun-lit)** | Shader term `uSpin.zw`: `lit = gain·exp(−r/R)`; `col = mix(col, uHi, min(lit·0.35, 0.5))`; `a *= 1+lit` (`labb-effects.ts` RINGINSTRUMENT ~`:395-399`; `ringField`, same maths). Radius = `sunLightRadius × outermost ring` (`LabRings.tsx:1139-1143`) | `ff90df99` | `sunLightRadius` 0.32; `sunLightGain` 1.1 (Galaxy Dark) / 0.6 (Standard Dark) / 0.35 (light) | Two uniforms | `uHi` = `flowHighlight` = `textPrimary`; the lean toward it is formula-mixed (C-68) | Static | same ✔ | **TRANSPLANT** (the shader maths) |
| **D10 FLOW (make subtle)** | Comet term in `ringInstrument` / `ringField` (`uFlow`, `uHi.a`): 3 comets per ring (`seg = τR/3`, hard-coded), phase `fract(R·0.618)`; `col` mixed toward `uHi` by `comet×1.4`. The `flow` derived value is at `LabRings.tsx:1178-1203` | `ff7ddbdd`, LOD `83c9033a` | **Intensity:** profile `flow` (1 Galaxy Dark, 0.45 Standard Dark, 0.5 light) × density fade² × global intensity; the `1.4` mix gain is in the shader. **Shape:** `cometLength` 48, `cometSpeed` 36 world/s; comet count 3 (shader literal). **LOD:** `FLOW_LOD_MAX_RINGS` 160. **Spool:** `FLOW_SPOOL` 0.55, warp boost ×1.4 | **Forces continuous redraw: yes.** It is one of the `labAmbientNeeded` triggers (`labb-clock-logic.ts:38-46`). Untilted, the ring picture re-records every tick (one `makeShader` per class plus N `drawCircle`). Tilted, one rect re-records each tick (cheap to record, full-screen GPU). Emulator: Ship-safe p50 18–20 vs best 23–26 ms "because `ringFlow` re-records the rings picture every tick" (README R3). 6 Pro isolation: `ringFlow:0` 5.0 vs 4.6 fps pre-fix (noise; GPU-bound then). Never measured alone post-fix | `textPrimary` highlight, formula mix | Off (`!ctx.reducedMotion.value`, `:1181`) | `04-wp1.3/09-flow-comets-overview-dense.mp4` ✔ | **REIMPLEMENT:** keep the shader term with lower `flow` (~0.2–0.3) and slower speed, and drive it from A's 30 Hz quantised ambient so it does not force 120 Hz redraws |
| **D14 STATUS rim + glow** | `BODY_LIT` (`labb-effects.ts:218-310`): crisp rim `uRimPx` / `uRimStr`, Fresnel limb in status hue, additive atmosphere (`uAtmo`, reach `BODY_REACH` 1.3). Material per status: `labBodyMaterial` (`L/labb-bodies-logic.ts:56-68`) | `469440db`, `0922d223` | `rimPx` 1.5 / 2, `rimStrength` 0.9 / 1, `fresnel` 0.35 / 0.28, `atmosphere` 0.85 / 0.22, `atmosphereAdditive` 0.65 / 0 (dark / light). Decay: atmosphere 0.4, desaturate 0.25. Rogue: atmosphere 0, desaturate 0.45 | +2 ms p50 / +14 ms p90 vs flat discs (emulator). One shader per body per record | Status from `orreryRingStyle().bodyFill` | Static | `05-m1-checkpoint/18…` ✔ | **TRANSPLANT** the shader (it is self-contained, with packed uniforms). The desaturation of decay/rogue photos is product semantics (C-16): confirm with the owner |
| **D13 face lighting (too dark)** | Lambert with wrap, `light = mix(1, floor+(1−floor)·lam, uLit)` (`BODY_LIT`); light vector `(dir, LIGHT_Z)` | `469440db` | **The constants that darken faces:** `lightFloor` **0.55 dark / 0.75 light** (`orrery-lab-fx.ts` `DARK_BODIES` / `LIGHT_BODIES`); `LIGHT_Z` **0.4** (`labb-bodies-logic.ts:29`, low elevation = side light); `wrap` 0.35; `haze` 0.15 / 0.1 toward the sky on the far side; status `desaturate`; defocus `×(1−0.32·dfc)`, plus 0.22 toward the sky and 30 % desaturation (`BODY_LIT` uK.w); dissolve | — | — | Static | C-30 log ✔ | **TRANSPLANT and retune:** raise `lightFloor` to ≥ 0.8 (dark), raise `LIGHT_Z` (~0.8–1.0) and `wrap` (~0.5), and cut the far-side haze on faces |
| **D16 FLOOR** | `LabLayerPictures.tsx:220-225,685-703`: bodies under `minBodyDp` are drawn up to ×1.4 | `ff90df99` | `minBodyDp` 12 (`LabStageProfile`), `SIZE_FLOOR_MAX_BOOST` 1.4 | min/max per body | n/a | n/a | `10-r2/06-final/02-overview-dense.jpg` ✔ | **REIMPLEMENT** in the projection. It is **visual only**: hit radius and label gaps ignore it (`:220-224`, C-69), so drawn bodies can overlap their labels |
| **D6 CLAMP** | `L/labb-near-size.ts` `labClampNearSizes`, applied to the frame (`OrreryWorld.tsx:334`) | `13c706ad` | `NEAR_PERSPECTIVE_KNEE` 0.06 (size grows at most +6 % from perspective, tanh); `NEAR_RADIUS_FRACTION` 0.08 of the short side (asymptote); `NEAR_RADIUS_KNEE` 0.7 | Frame probe 0.8–1.0 ms (emulator) | n/a | n/a | `11-r3/01-iter1/04-detail-dense.jpg` vs `02-iter2/…` ✔ | **TRANSPLANT** the pure function (4 tests). Calls the frame `.map` on every body per frame; fine |
| **D6 CLAMP: how it is computed** | Perspective factor `p = focal/(focal − depth)` with `depth = planeY·sin(tilt)` (`orrery-camera-logic.ts:570`); only `p > 1` (the near side) is compressed; the sun is exempt; `hitRadius = max(MIN_HIT_RADIUS, radius)` | — | — | — | — | — | — | — |
| **D6 CLAMP at ~62° vs 32°** | Near-side depth grows ×sin62/sin32 ≈ **1.66**, but the knee still caps growth at ≤ +6 %, so near bodies stay bounded (good). **The far side is untouched** (`p < 1` passes through), so far bodies shrink much more at 62°. Pair it with FLOOR in the projection. **62° exceeds production `MAX_TILT = π/3` (60°)** (`orrery-camera-logic.ts:72`), and `deriveFocalDistance` / `MAX_DEPTH_FRACTION` are built on `sin(MAX_TILT)` (`:94-97`, `:510`). So D3 needs a MAX_TILT and focal re-derivation, not just a pose constant | — | — | — | — | — | — | — |
| **D8 HUE** | `systemSkyIndex` (`L/labb-switch-logic.ts:433-450`): an FNV-1a hash of `kind:uid` (custom or category) or `builtin:id` → one of 6 `starPalette` candidates `[4,2,5,3,0,1]`; All Contacts keeps the default. Crossfade on the UI thread: `displayedSkyHue` (`:464`), `LabBRenderer.tsx:497-536` | `30026fda` | `SKY_HUE_CANDIDATES`, `SKY_HUE_START` 0.55 | One uniform | `starPalette` token index (compliant) | Instant under reduced motion (no running signal) | `06-wp2.1-switch/05-settled-inner-circle-galaxy-dark-gold-sky-hue.jpg` ✔ | **TRANSPLANT.** It is **already tied to the durable `uid`** (`OrrerySystemRef`, `src/logic/orrery-system-logic.ts:24-27`): stable across launches, not across a backup re-key. With only 6 buckets, collisions are frequent; the owner may want a stored hue |
| **D21 DIM** | Bodies: `BODY_LIT` uK.w defocus (−32 % brightness, 30 % desaturation, 0.22 toward the sky; the focused body brightens its atmosphere). Rings: `focusDim` 0.35 / 0.4. Labels: text-only dim with floor `LABEL_TEXT_DIM_MIN` 0.66, `LABEL_DEFOCUS` 0.38. Driven by `focus.mix` `withTiming` (`FOCUS_MIX_MS` 340 / release 260, `L/labb-focus-logic.ts:33-34`; `LabFocusFx.tsx:162-171`) | `11c21745` | above | Uniform only | Formula mix toward the sky (C-52) | Instant under reduced motion (`LabFocusFx.tsx:168`) | `08-wp2.2-focus/07-debug-dense-120-focus-world-response.jpg` ✔ | **TRANSPLANT** the maths. The sun is exempt. Lighten the face dim with D13 |
| **D22 CHROME** | `src/components/orrery/OrreryHudCorners.tsx` (four RN `View` brackets: `ARM` 7, `STROKE` 1.5, `INSET` 3, opacity 0.85, `accent` border). `HUD_PLATE` = `RADII.sm`. Wired through the `hud` prop in `OrreryFocusContext` / `OrrerySystemSelector` / `OrreryViewOptions` / `OrreryControls` | `11c21745` | above | Static views | Tokens; a11y-hidden, `pointerEvents="none"` | n/a | `08-wp2.2-focus/03-debug-galaxy-dark-home-vs-focus-hud-chrome.jpg` ✔ | **TRANSPLANT** (plain RN; portable to iOS and web). Drop the lab-flag plumbing |
| **D23 REORDER** | `LabFeedbackPicture` (`L/LabFocusFx.tsx:528-597`). Charge: a track ring plus an `addArc` filling over `HOLD_MS` (`holdT` `withTiming`, `:265`). Held: the body's orbit as a projected ellipse (`strokePlaneCircleAuto`) glow + line + slot flash, with a locked reticle | `11c21745` | `CHARGE_DP`, `CHARGE_TRACK_ALPHA`, `HELD_GLOW_DP` / `ALPHA`, `HELD_LINE_*`, `SLOT_FLASH_MS` 340 | Re-records only while held | `accent` as an instrument stroke via vec4 (bypasses the accent-role analyzer, C-53) | Charge is instant; flash `RM_FLASH_MS` 150 | `08-wp2.2-focus/12-debug-sheet-reorder-hold-charge-held-ring-slot.jpg`, `16-debug-reorder-hold-drag.mp4` ✔ | **TRANSPLANT** the draw functions. The charge arc runs on its own `withTiming`, not from the gesture's actual hold claim, so V2 should drive it from gesture state |
| **D24 SWITCH warp** | Streaks and sky push: `LabEnvironment.tsx:665-797` (Atlas streaks, `streakXform`), `labb-switch-logic.ts` (`warpAmount`, `STREAK_*`, `WARP_PUSH` 0.14, `WARP_SWIRL` 0.32, `STREAK_MAX_DP` 190). Plus particles, comets, flares, shockwave and trims in `LabSwitchFx.tsx`. All pure in `sampleSwitchSignal` (`src/logic/orrery-switch-choreography.ts`) | `30026fda`, `413d6999` | `PARTICLE_CAPACITY` 640, `TRAIL` 256, `FLARE` 128, `SHOCK_START` 0.7, `SHOCK_MIN_INTENSITY` 0.25, `CORONA_FLARE` 0.4 | Emulator during a switch: p90 +12–14, p99 +65–85 ms (C-48); trim 15–24 ms per frame. The 6 Pro shows the choreography at ~25 fps (§3) | Status, sky-hue and `avatarSwatchText` tints (C-44) | Crossfade only | `10-r2/final-switch.jpg`, `06-wp2.1-switch/27-sheet-dense-to-inner-slowmo20-pass2.jpg` ✔ | **REIMPLEMENT.** Keep the streak/warp **look** and the pure-signal pattern. Rebuild inside A's stable-tree scene with a budget: no particles, comets or trims; streaks only on a fixed sprite budget |
| **D7 / D26 light-mode sky** | `LIGHT_ENV` (`orrery-lab-fx.ts`): `glow` 0, `dust` 0.05, `vignette` 0.13 toward `textSecondary`, ink-speck stars (`starAlpha` 0.42, `density` 0.4, no twinkle); `STANDARD_LIGHT_INTENSITY` 0.35 vs Galaxy 0.7 | `54188b10`, `f2b1d02b` | profile fields | Baked nebula ≈ free (18 vs 17 ms p50, emulator) | Formula mixes of `accent` / `starPalette` (C-03) | Drift and twinkle frozen | `13-final/02-shots/07-overview-dense-galaxy-light.jpg` ✔ | **TRANSPLANT** the profile values as a starting point; render through A's baked base. Galaxy Light needs more flavour (D26) |
| **D7 / D27 Standard-Dark graphite** | `STANDARD_DARK_ENV`: `strengthA` 0.09, `strengthB` 0.07, `glow` 0.02, `ember` 0, `dust` 0.1, `vignette` 0.5, `starDensity` 0.55, `starAlpha` 0.7, `twinkle` 0.06. `LabChart.tsx` graticule (`alpha` 0.1, `spokeDeg` 30, 6 rings) | `11c21745`, `0acdc848` | profile fields | Chart re-records on camera change | as above | Static | `10-r2/06-final/07-overview-dense-standard-dark.jpg` ✔ | **TRANSPLANT** the values (the "calm default feel"). The graticule is optional (the owner is unsure about any grid, D9) |

**Not picked, but entangled:**
- `planeGrid` (the gravity-well grid) **defaults ON in best**. It is OUT per D9/D30.
- `ringTethers` and `ringWake` default ON. Tethers become moot under D12.

---

## 3. Why B's switch felt janky (both phones, especially the 3a)

### Measured evidence (6 Pro only, release, preset best)

- **The published "switch 7 → 58–63 fps" is a whole-window average** (9–10 s), not the 2.1 s switch.
- ✔ In `PKG/evidence/14-tilt-fix/switch/summary.tsv`, row `sw-after-400 switch_out` has only **43 `frame` worklet runs**, against 574 presents. The choreography is `NORMAL_SWITCH_DURATION_MS = 2100` (`use-orrery-switch-runtime.ts:25`), so **the switch ran at about 20–29 fps**.
- ✔ Row `switch_in` has **`frame` = 1**, so that window probably did **not contain a switch at all**. The 63.1 fps figure is unverified as switch performance.
- Probe logs in `12-phone/perf/notilt-*` show the nebula tick rate falling from ~75 Hz to 33–45 Hz around the switch and staying low for the next 3 s window. That is consistent with the owner's "post-switch jank".
- Pre-fix Perfetto of the Dense→400 switch: **JS thread 56.7 % busy**, eglSwap 130 ms, GPU 99.5 % (`12-phone/perfetto/perfetto-summary.txt`).
- Emulator after the stall fixes: UI mappers 50–60 ms per switch frame, p95 57–65 ms (`07-switch-stall/15-gfxinfo-summary.txt`).

### Likely causes in code (ranked)

1. **The switch itself is CPU-heavy on the UI thread.**
   - O(N²) choreography setup: `find`/`some` plus a key string per comparison (`orrery-switch-choreography.ts:348-432`, `keyOf :89-98`). It runs at publish and again at settle.
   - Per-frame `entries.map` sampling (f.sample 2.9 ms on the 6 Pro).
   - Bodies, trims, streaks, particles and flares are all re-recorded every frame, with new Paint/Recorder/shader objects per element (GC pressure; `hades` 135–722 ms per 12 s).
2. **The ring-field data rebuilds every switch frame while tilted.** Ring alphas and trims change, so `buildRingField` (a 4096-bin LUT) and two `Skia.Image.MakeImage` calls run on every frame (`LabRingField.tsx:279-288`). Old textures are left to GC. fieldData 2.0 ms mean / 5.5 ms max.
3. **The post-switch train of React re-renders.** The prune at settle (`use-orrery-switch-runtime.ts:249-266`) and every **photo arrival** (`photoVersion` bump, `LabBRenderer.tsx:414-432`) re-render the renderer. That re-creates the bodies, labels, rings and field-spec worklets and commits the canvas, which RN Skia re-records twice. Photos are re-decoded with no image cache (`use-orrery-photo.ts:33`). Wakes also return at settle (re-record and fade, `LabRings.tsx:1205-1228`). **This is the best explanation for the "few seconds" after the switch.** Lab A avoids it by design (§1).
4. **Full-screen fragment passes.** While tilted: nebula, stage plane, ring field and the shockwave disc (up to 1.36 × extent, Plus blend, last 30 %). Labels use one unbounded `saveLayer` plus a blur MaskFilter each, every record (`LabLayerPictures.tsx:916-964`). On a 3a-class GPU this is very likely over budget. **Unmeasured.**
5. **Smaller items.**
   - Display-rate ambient (no quantisation).
   - `fpsHud` on by default (copies a 120-slot array and strokes a path every tick).
   - Adaptive 60/120 Hz on unpinned phones.
   - The warm-up covers only `probe` + `shockFilter` + `warm`-gated FX probes within 400 ms. The ring field compiles only if the scene is tilted at mount, which is the default, so this is probably fine.
   - The flat ring picture allocates a new empty picture every tilted frame (`LabRings.tsx:857-861`) instead of the shared `emptyPicture()`.

### Hybrid toggle mid-switch

None in practice. The switch destination is `labHomePose` with tilt 0.56 (`labb-home-tilt.ts:24-34`; `OrreryScreen.tsx` Home call sites), so tilted-to-tilted never crosses the hybrid seam.

### Drift off the ring: confirmed

- Bodies are drawn at `polarToXY(ringRadius + push)` (`src/logic/orrery-world-logic.ts:136`). This is the **shared production logic**, not lab code.
- The push is `ROGUE_DRIFT_SPAN` 80, or decay scaled by `DECAY_DRIFT_SPAN` 40 (`:61-72`).
- B adds a **drift tether** for decay and rogue: `tetherSegment` from the rail point to the body's limb (`L/labb-rings-logic.ts:209-230`), drawn as declarative rects (`LabRings.tsx:687-734`).
- D12 (bodies stay on the ring) is a change to `orrery-world-logic.ts`, not to the renderer, and it makes the tether moot.

---

## 4. Main-line fixes B found (main = `34920925`, unchanged)

| Fix | Commit / files | Root cause (verified) | Still broken on main? |
|---|---|---|---|
| Switch stall fix 1 (closure capture) | `ea137306`: `OrreryWorld.tsx`, `orrery-frame-mapper.test.ts` | The frame `useDerivedValue` captured `switchRuntime` (a new object each render, carrying `resources` → a scene per entry, `use-orrery-switch-runtime.ts:401-411`) and `scene`. Reanimated derives deps from `__closure`, so every OrreryScreen render restarted the mapper and deserialised the graph on the UI thread. | **Yes.** `OrreryWorld.tsx:222-259`; fresh defaults at `:175-182`; `OrreryScreen.tsx:1060,1063` pass fresh arrays. Port by hand (its context lines are lab code). |
| Fix 2 (layer pictures) | `038a8d97`: lab only | 3,193 bound SharedValues in a declarative tree. | It applies only as a V2 architecture choice; there is nothing to port. |
| Fix 3 (canvas memo) | `3c0f691b`: `LabBRenderer.tsx` only | About 11 canvas commits per switch. | The pattern applies to main (no memo anywhere in OrreryWorld/Canvas/Screen), but **it was never built or measured on legacy**. H-A7's "applies directly" is **UNVERIFIABLE**. |
| Paragraph cache (800-body Hermes crash) | `83c9033a`: `OrreryWorld.tsx` `textCache` | A Skia Paragraph per label rebuilt on each focus, cluster or scene change; SIGSEGV in `JsiHostObject::get`. The root cause is **inferred** (C-63). | **Yes, and worse than described.** Main's `labels` memo depends on `clusterIds` / `focusedRelationById`, which are fresh on every OrreryScreen render (`OrreryScreen.tsx:1063`, `OrreryWorld.tsx:176`). So main rebuilds every Paragraph **on every parent render** (`OrreryWorld.tsx:277-337`). The claim that legacy also crashed at 800 is **UNVERIFIABLE**: there are no legacy-800 rows in `09-r1/perf/A-baseline`. The phone confirms no crash at 800 in ~2.5 h (lab). |
| O(N) lookups | `83c9033a`: `OrreryWorld.tsx` `allocations` `byKey`; `orrery-satellite-logic.ts` maps | O(N²) `bodies.find(bodyKey…)` per label; `some`/`find`/`includes` per satellite row. | **Yes.** ✔ `OrreryWorld.tsx:366`; `orrery-satellite-logic.ts:32-62`. Also `ProjectedOrbitRing.tsx:18` does a `find` per ring per frame, which B did not touch. |
| `projectFrame` hoisting | `89c2f1dd`: `orrery-camera-logic.ts` (+ test) | `usableCameraRect` / `cameraPlane` were computed per body. | **Yes** (`:490-541`). "Bit-identical" is TRUE for finite inputs; on the throw path only the error message differs. |
| "El…" initials | Found in `c8a82eaf`. Worked around in lab only: `LabBodies.tsx:91-101` `labInitials` | ✔ `orrery-label-logic.ts:21-22` returns the **whole name** when `Intl.Segmenter` is missing, and Hermes lacks it (reproduced on the 6 Pro, `12-phone/shots/02-dense-legacy.jpg` ✔). | **Yes, not fixed in shared code.** `labInitials` turns "Al" into "AL" where the grapheme path gives "A". `src/components/avatar-initials.ts:27` is unaffected. |
| "Unavailable System" after cold start | Not fixed (FINAL-VALIDATION §3) | ✔ `orrery-system-store.ts:94-105`: on restore of a custom System, `name` and `categoryName` are undefined and the `before.requested.id` check fails, so the label is "Unavailable System". The success path corrects only categories (`:122-131`), and `reload` re-passes the wrong name. | **Yes.** Fix by resolving the custom name from the load result or the catalog (the selector already has `row.name`). |
| Legacy renderer at Dense 120 on the 6 Pro | Measured, not fixed | 128-point Path per ring per frame plus `DashPathEffect`, plus `find` per ring (`ProjectedOrbitRing.tsx`). The renderer files are unchanged against main. | **Production main is likely ~2–5 fps at Dense 120 and ANRs at 400 on this phone** (`12-phone/anr-labb-summary.txt`). Caveats: one run, swap pressure, thermal, satellites on. |

---

## 5. Dead ends

| Entry | Verified status | Flag in code |
|---|---|---|
| **Tilted-ring Mali cliff** (stroked circles and wakes under a perspective CTM) | Strong. Pre-fix Dense 3.2 fps; `ringWake:0` → 18.5; `labmin` 120.2; `homeTilt0` 96.7 / 92.0 (✔ `12-phone/isolation-dense-sf.txt`). Perfetto: eglSwap 147 ms, GPU 99.7 %. **Rule: never stroke under perspective; use the ring field.** | `ringPlaneDraw` / `ringField` (debug, ON); `ringPlaneDraw:0` = the pre-fix draw |
| Per-ring ellipse, oval and inverse-shader variants | 31 / 31.5 / 16 fps tilted (`14-tilt-fix/probe/`) | `ringOvalOp`, `ringShaderInv` (off) |
| Field on the untilted plane | 64.5 vs 97.8 fps (`matrix-v6`); reverted by the hybrid | — |
| Bloom | Dropped for taste and legibility (flattens the sun, defeats the glow cap). **The phone never showed a bloom GPU cliff**: best+bloom was *faster* at 400 (25 vs 18) and 800 (47 vs 36). | `bloom` (off) |
| Lens flare / tilt-shift | Taste (tilt-shift blurs faces; four BackdropBlurs) | `lensFlare`, `tiltShift` (off) |
| Heat-haze / "wobble" = `fxShockFilter` | Visible only in slow motion. Anomaly: it made tilted Dense **faster** (Perfetto 528 vs 66 frames). It is still compiled at every mount (`WARMUP_FILTERS`), so V2 should drop it. | `fxShockFilter` (off) |
| Gravity-well grid | **Not a DEAD-ENDS entry.** It is "simplify / optional" (C-67), off in Ship-safe and **ON in best**. Cost not separable (5.4 vs 4.6, noise). The owner killed it (D30). | `planeGrid` |
| WAKE | Pre-fix the dominant term (4.6 → 18.5 fps without it). Now in-shader in the field, LOD-off above 160 rings. Emulator 34–40 ms per frame at 400 before the LOD. | `ringWake` |
| `eb860615` stroked static paths | The commit only *adds* an unwired file and was reverted 4 s later. The +56 / +12 ms numbers come from an uncommitted session. **Not reproducible from the commit.** | — |
| DEAD-ENDS §4 "One full-screen shader for all rings: rejected on analysis" | **Stale.** It later became the adopted fix (C-74). | — |
| `worldLayer` saveLayer A/B (4.6 vs 4.7) | The citation to `isolation-dense-sf.txt` / "iso3 rows" is **FALSE**: the file has no such rows. | never committed |

---

## 6. Lifecycle, accessibility, theme, maintainability, tests

### Lifecycle

Unmount on blur or background (§1) gives 0 frames off-screen; this is verified. The cost is a full rebuild on every return:
- nebula bake (768² RGBA, ~2.3 MB, C-13);
- warm-up;
- photo decode;
- label paragraphs.

V2 should keep some state (textures, photo cache) across blur, or at least cache decoded photos.

### Accessibility

- **GLASS.** ✔ `11-r3/04-legibility-after/contrast-results.tsv`: Standard Dark glass `textSecondary` **4.42:1**; Galaxy Dark 4.51, Galaxy Light 5.56, Standard Light 5.10. The model uses a **pure-white extreme pixel (L = 1.0)** under the card, which is an initials glyph, not the sky. So the shortfall comes from white content under the glass, whatever the sky does. B's focus-card occlusion (`focusCardOcclusion`, bodies at 0.12 alpha under the card, C-61) is the lever; card opacity is not (ADR-149). This is a D28 hard gate.
- **Labels.** Text-only defocus with a 0.66 floor gives ≥ 4.95:1 (model) in all four themes (`09-r1/legibility/after/contrast-results.tsv` ✔ exists). The canvas carries no a11y; the RN surfaces do.
- **Chrome.** Brackets are a11y-hidden; touch targets are unchanged (C-56). Tracked caps apply only to fixed words.

### Theme

- No colour literals: grep is clean. `check:colors` was reported as exiting 0; not re-run.
- Every colour is a token or a numeric mix of tokens. **Formula-mixed** colours: nebula, vignette, stars (C-03); body band and shadow (C-32); instrument ticks (C-40); switch FX (C-44); accent instrument strokes (C-53); rim lean (C-68). V2 needs authored sky and instrument tokens per palette.

### Maintainability

- `LabRings.tsx` is 1,627 lines with about **six parallel ring paths**: path-rebuild, components, pictures, plane pictures, oval and inverse variants, and the field.
- `labb-effects.ts` is 1,054 lines of SkSL in strings.
- 50+ flags and lab props threaded into shared overlays (`hud`, `anchor`, `rail`, `topInset`).
- Module-level mutables: the card channel, reduced-motion override and force-fallback.
- React-side `scene.contacts.find` inside loops: `LabBRenderer.tsx` `labelStatus` / `photoPaths` / `keyColors` and `LabBody`, all O(N²) per resources change.
- **Harvest functions and shaders, not files.**

### Tests

- 25 changed or added test files; about 134 lab `it`/`test` cases. These are pure-logic tests: ring field encoding, ellipse vs projection, near-size, sky, switch logic, layer plan, focus, bodies, clock, store. There is also a mocked-Skia tree-contract test (`labb-render.test.tsx`, 21 cases).
- The Skia mock throws on a missing `children` array (`1c339064`).
- The package reports "full suite 554 files / 6,254 green" at R3; **not re-run**.
- There are no GPU or perf regression tests, by nature.

---

## 7. Perf facts (Pixel 6 Pro unless noted; release arm64; opaque canvas; SurfaceFlinger presents)

| Fact (quoted) | Conditions | Source | Audit note |
|---|---|---|---|
| Dense 120, Lab B best (tilted, pre-fix) idle **3.2 fps**; "3–9" | best, `idleClock:0`, thermal 1→2 | `12-phone/perf/summary.tsv`; PHONE-PASS §1 | ✔. The "isolation 4.6–8.8" range: **8.8 not found** (isolation shows 4.0–5.4) |
| best − Home tilt **99 / 81** (idle/pan) | same | same | frames ÷ window |
| Stress 400: best **18**, untilted **95**, Legacy **ANR** | same | PHONE-PASS §2 | ✔ ANR summary exists |
| Ship-safe **26**, Everything **23** (Dense idle) | same | summary.tsv | — |
| Legacy (production) Dense 120 "~5 fps" | untilted (legacy ignores homeTilt) | PHONE-PASS §1 | The real rate is **~2–3 fps** (50 presents in one 0.5 s burst; gfx p50 250 ms; video ~2.3 fps) |
| Tilt fix: Dense 120 Home tilt **67.7 / 58.4**, max tilt **66.4 / 57.9**, flat **67.8 / 58.2** | best, `min_refresh_rate` pinned 120, thermal 1 | `14-tilt-fix/matrix/summary.tsv`, PHONE-PASS §10.1 | Intervals p50 16.6 ms, i.e. a **60 Hz cadence** on a 120 Hz panel |
| Tilt fix: Stress 400 Home **66.8 / 60.5**, flat **74.1 / 68.3** (before-flat 104.8 / 75.9) | same | same | The "noise" explanation is untested |
| "Big switch … **6.9 → 58.1 / 63.1**" | same, perfProbe on | `14-tilt-fix/switch/summary.tsv` ✔ | **Misleading**: window averages. The probe shows ~43 frame runs across a 2.1 s switch; switch_in contains no switch |
| Perfetto best Dense idle: 66 frames / 12 s → **672 / 10 s**; eglSwap **147 → 3.4 ms**; `animation` **175 → 14.6 ms**; main Running 16 → **79 %**; GPU 99.7 → 98.6 % | pre / post fix | `12-phone/perfetto/perfetto-summary.txt`, `14-tilt-fix/perfetto/field-best-dense-idle.summary.txt` | ✔. PERFORMANCE §11's "~11 ms per frame" conflicts (11.2 was the pre-fix *untilted* trace). **Post-fix, B is CPU-bound on the main thread** |
| Per-worklet at 800, idle: frame 9.0, bodies 9.5, rings 7.1 ms; "≈ 11–13 µs per body" | best, thermal 2 | PHONE-PASS §2.3 (`perf-800-rerun/`) | — |
| Soak 5 min Dense best: thermal 1; skin **40.9 → 42.3 °C**; **36 mAh / 5 min (35 GPU)**, model estimate; PSS **1.44 GB** | pre-fix (GPU-pinned at ~5 fps) | `12-phone/soak/` ✔ | Pre-fix only; there is **no post-fix thermal or battery data** |
| Emulator switch stall: skipped max **216–371 → 0** (lab), **216–427 → 33–120** (legacy); bound values **3,193 → 47** | emulator release, uninstrumented | `07-switch-stall/15-gfxinfo-summary.txt` ✔ | Never repeated on a phone |
| Emulator: Ship-safe p50 **18–20** vs best **23–26 ms** | emulator | README R3 | Relative only |
| Pixel 3a | — | — | **None exists** |

### Claims found FALSE or unverifiable

| Status | Claim | Source |
|---|---|---|
| FALSE | "untilted path is the pre-fix code" | PHONE-PASS §10.3; the field data worklet still runs |
| FALSE | `worldLayer` evidence citation | DEAD-ENDS |
| Stale | "one full-screen ring shader rejected" | DEAD-ENDS §4 |
| Misleading | "switch 58–63 fps" | PHONE-PASS §10.1 |
| Unverifiable | Legacy 800 crash | DECISIONS-LOG §3 / PERF-LOG |
| Unverifiable | H-A7 memo applies "directly" to legacy | HARVEST H-A7 |
| Unverifiable | Several isolation rows (sky/bodies/stage/… "no change") | PHONE-PASS §1 |
| Not reproducible | `eb860615` cost numbers | DEAD-ENDS |
| Value error | "isolation 4.6–8.8"; 8.8 not found | PHONE-PASS §1 |
| Value conflict | "~11 ms per frame" vs 14.6 ms in the trace | PERFORMANCE §11 |
