# Lab A direction 1: refinement pass 2 (motion, depth, interaction)

**Date:** 2026-10-01.
**Target:** Pixel 6 Pro, `com.bwales.orbit.laba`, DEBUG APK running **production-mode JS** (`dev=false&minify=true`, see BUILD-LOOP §(i)). This is not a release build. No native rebuild was needed, and droid was not used.
**Commits:** `527bd5b4` (main pass), `7899aacb` (photo cross-fade). This doc, the BUILD-LOOP update and the evidence are in the next commit.
**Evidence:** `evidence/pass-2/`. Files 40–43 are before (pass 1) / after composites. The 10–20 series are mp4s and contact sheets.

## Headline findings

1. **The switch freeze is not dev mode.** It is the same in production-mode JS, and with the legacy renderer (`DEEP_FIELD_ENABLED = false`).
   - **Symptom:** one main-thread block of 3.4–4.6 s right after the switch starts, then frames of about 600 ms for a few seconds.
   - **Scaling:** it grows with body count.
     - Small Systems (2–3 bodies) animate continuously, at about 16–20 fps. Progress samples arrive every 50–60 ms.
     - All Contacts (40) ↔ Lab Dense (32) still freezes and then jumps (10b, 11).
   - **Profile:** simpleperf puts the block in `libworklets` (shareable serialisation) plus Hermes on the main thread.
   - **Focus taps show the same pattern.** They take about 2.4 s to respond, then the camera moves in discrete jumps.
   - **Suspects (not proven):**
     - React commits that rebuild RN-Skia's whole recording and re-register mappers. `Container.redraw` → `startMapper` over every animated prop.
     - The frame worklet capturing whole `switchRuntime` and `scene` objects. It closes over `switchRuntime.transition.value`, which pulls `resources` and every scene into the closure. That is visible in the bundle's `OrreryWorldTsx3.__closure`.
   - **Ownership:** this is baseline and production code (the frame worklet, the switch runtime, the screen), so it was not touched. It is the main HARVEST/PRODUCTIONIZATION item, and it needs a release build plus a Hermes profile.
2. **Lab A had made idle frames about 3× slower than the legacy renderer.** Fixed (see "Plane performance").
3. **Baseline bug: the switch starts from a stale camera.**
   - In `use-orrery-switch-runtime.ts` `publish()`, the "displayed camera" is `interpolateCamera(cameraFrom, cameraTo, progress)`. When `progress ≥ 1` that returns the *previous switch's* `cameraTo`, not `pose.value`. The frame worklet uses `pose.value` once settled.
   - **Effect:** after any pan, zoom or recenter, or after a cold start where Home was applied outside the runtime, the first switch frame snaps the camera to an old pose. Recordings show a top-down snap at switch start after relaunch.
   - **Suggested fix:** use `pose.value` when `progress ≥ 1`. This is choreography/runtime code, so it was documented and not changed.
4. **Baseline layout finding: the focus card covered the body.** The full analysis is under item 4 below.

## Plane performance

Root cause and fix, measured on the Pixel. All numbers are idle `gfxinfo` p50 on All Contacts in production-mode JS. They are UI/RenderThread only, rough, and not perf claims.

| State | Idle p50 | Notes |
|---|---|---|
| Pass-1 plane | 150–200 ms | about 5 fps |
| No plane at all | 42–48 ms | |
| Legacy renderer | 46 ms | |
| Plane after this pass | **≈ 73 ms** | |
| Lab Inner Circle (3 bodies) after this pass | ≈ 18 ms | |

The pass-1 plane was recorded under `canvas.concat(H)`. Bisection found three costs:

1. **Perspective strokes and dashes.** Ganesh has no GPU path for them, so they fall back to CPU path masks plus `glTexImage2D` uploads on every frame. Idle ambient frames replay the picture, so this happened even when nothing moved.
2. **`drawOval` ellipse ops.** They draw *bounding quads*. With about 80 rings that is roughly 80 near-screen-size quads, so the plane became fragment-bound.
3. **Round joins and non-convex paths.** Both drop Ganesh to the software renderer. A single tick path made of 120 separate lines is one such non-convex path.

The fix (`world-plane.ts`):
- **Everything is projected on the CPU and drawn with an identity matrix.**
- **Rings use the frame's own `ringPath` (128 points) as one closed convex polygon.** The stroke has default miter joins and no path effect.
- **Every ring style comes from one analytic runtime shader, `RING_SKSL` in `deep-field-shaders.ts`:**
  - the far → near ink ramp;
  - the status segment ramp, which is zero outside the segment, so stroking the full polygon draws only the segment;
  - the dash channel, as angle on/off pairs;
  - the ink-in reveal.
- **Lines are `drawLine`, and fills are convex.**
- **Tests pin the fast-path rules.** `world-plane.test` asserts no path effects, no `drawOval` or `drawArc`, and that the hairline polygon is the frame's `ringPath`.
- **Rejected attempts:** see "Tried and rejected".

## Outcome per item

### 0. Production-mode JS: works, but did not fix the freeze

The method is in BUILD-LOOP §(i). It needs a prefs file, not Metro flags, because the APK has no dev-client.

Small-System switches now animate continuously. Large ones still freeze: see headline 1.

Metro is left running in production mode (tmux `orbit-lab-a`), and the device prefs are left at `js_dev_mode_debug=false`. BUILD-LOOP has the one-line revert.

### 1. Switch as a jump: implemented

Judged on small Systems: 12 (best), 12b, 12d and 12e.

**Motion-blur trails** (they replace pass-1's fixed streak arcs):
- **History.** Each body's real recent path is kept in world space, as the plane layer's own UI-thread scratch `SharedValue`, mutated in place and never reassigned.
- **Resampling.** The path is resampled in polar form about the sun, so a 60 ms frame chord does not draw as a polygon. Compare 12c, the first attempt, which shows chunky straight ribbons.
- **Drawing.** Each trail is one stroked arc of at most 2.4 rad (still convex), with alpha ramping up toward the body.
- **Leaving bodies peel off.** They get longer and brighter trails that follow their real outward spiral; EK is visible in 12e.
- **Rough look on device:** reads as a comet-like smear. Fine at 16–20 fps, slightly heavy on bodies near the sun.

**Starfield warp:** five ghost copies of the near-star layer, scaled out from the centre by velocity². It reads as short radial dashes at peak spin, and is subtle.

**Bezel dial swing and grid brightening:** both track spin velocity and return to rest at settle.

**Entering rings ink in from the sun outward:**
- The draw-on is delayed by normalised ring radius (`INK_IN_SPREAD`).
- A starlight glint rides the drawing head.

**Capture ripple:** an on-plane ellipse expands from each entering body over the last 38% of its capture stage. Retained bodies ripple once over progress 0.8–1.

**Sun flare at capture:** the corona flare is unchanged. In addition, the sun disc core heats up (`uFlare` in `SUN_DISC_SKSL`). Visible in 12e.

**Seen on device:** trails, the leaving-body peel-off, flare and warp. **Barely seen:** ink-in, capture ripples and the head glint.
- The device frames between capture start and settle are sparse.
- A React commit around `INTERACTION_READY` (progress 0.82) appears to block.
- Entering bodies therefore appear late, in 2–3 frames.
- **Needs a release build to judge.**

**Reduced motion** (`transition_animation_scale = 0`; captures 18a, 18b): a short crossfade only. `SwitchFx` stays idle, so there are no trails, warp, flare, glints, ripples or bezel swing. The scale was restored to 1 and verified (`settings get`).

**Semantics:** choreography timing and classification are untouched. Every effect reads `computeSwitchFx`, the frame and the progress value.

### 2. Depth: done

- **Far bodies draw up to 16% smaller** (`bodyDepthScale`, a presentation-only transform). They also keep the pass-1 cool `voidTone` tint.
- **Depth haze:** the plane footprint fades toward background ink, from the far bezel to the plane centre. The amount is gated on tilt.
- **Near-side rings are brighter and more saturated:** `RING_NEAR_TINT`, mixed toward the status hue.
- **Lighting is consistent:** the sun-lit pool, body terminators and contact shadows all share the single sun light.
- **Rejected:** a cool horizon glow band (see "Tried and rejected").

### 3. Co-angular overlap: done

- **Separation keyline.** A background-ink keyline of `BODY_KEYLINE_DP` 1.6 sits just outside every disc, drawn in the body shader. Bodies draw near-over-far, so the nearer keyline cuts the farther disc: BB and CC now read as two discs (03).
- **Stack pips.** `lab/body-stack.ts` `findStacks` groups overlapping *drawn* discs. `BodyStackLayer` puts one pip per hidden body, in that body's status hue, at the front body's upper right. Pips are capped at 4, with a "more" ring, and are hidden during a switch.
- **No change to data.** Positions, `radius`, `hitRadius` and labels are unchanged; a test pins this.
- **Tap ambiguity is not re-verified.** The group panel was not exercised this pass, because tap targeting and hit logic are untouched.

### 4. Focus state: fixed at the presentation layer

**Where the overlap came from:**
- **Framing:** `frameBodies` in OrreryScreen centres the focused body in `usableCameraRect(viewport)`.
- **The card is not an obstacle.** `orrery-focus-context` is only filtered out of the controls and panel viewports and never registers itself.
- **The clamp:** `OrreryFocusContext` placed the card at `body.y + r + 8`, then clamped it into the region. Its height can reach half the region (about 200 dp), so it was clamped *up* over the body and reticle.

**Fix** (`lab/focus-card.ts`, lab-gated in `OrreryFocusContext`):
- The card clears the drawn body and the reticle.
- It goes below the body if it fits, otherwise above.
- If neither fits, it takes the roomier side and caps its height to that room (at least 112 dp), so its content scrolls.
- The natural height comes from `onContentSizeChange`, because the capped layout height would otherwise feed back into the placement.
- Framing and the usable rect are unchanged. Registering the card as an obstacle would be circular and would change camera semantics.
- Result: 02 and 43.
- **Remaining gap:** the card can cover the body's own label plate.

**Reticle lock-on** (20, 20-sheet):
- On focus the brackets start 85% wider and 45° rotated and converge over 720 ms. A single accent ping ring then leaves the body.
- It is one UI-thread `withTiming`; there is no React state per frame.
- It is static under reduced motion.
- The ambient spin from pass 1 is unchanged.

### 5. Identity and detail zoom

**Moons**
- `SatelliteBody` in lab mode draws a small lit moon (the body shader, with terminator and atmosphere), at a visual minimum radius of 4.5 dp. The hit radius stays the frame's (≥ 22 dp).
- Each moon gets its own orbit hairline around its parent, on the plane (in 02, "Tom" around Clara).
- The `orrery-render` moon pins still pass.

**Sun surface**
- The disc now uses three incommensurate octaves of warped sine cells, "wrapped" by μ toward the limb, plus a brighter intergranular network and a thin chromosphere band at the limb.
- It runs off the single clock and is static under reduced motion.
- No hashes are used and all coordinates are O(1).
- At close zoom it now reads as a textured star rather than a flat coin (crop in 02 and in the zoom-out crop of 01).

**Labels:** the instrument plates are unchanged and still legible.

### 6. Photo pop-in: SkImage cache rejected, fade-in added

- **Why no cache:** `use-orrery-photo.ts` D-41 says "SkImage objects are never cached". Each hook owns exactly the image it published and disposes it after the replacing commit (the 4-step contract).
- **What a module cache would need:** ref-counting shared host objects across hooks, and a change to that recorded design (D-41 superseded D-37's in-memory cache). That is an owner and productionization decision, so it goes to **HARVEST**.
- **What was added instead:** a presentation-only cross-fade (`PHOTO_FADE_MS` 260). The initials stay underneath and the photo fades in when it resolves. The hook and its disposal contract are untouched, and it is instant under reduced motion.

### 7. Palettes: no regression

All four palettes were checked (01, 13, 14, 16, 17):
- In light "chart" modes the keylines become paper and the pips stay legible.
- **Restored:** Galaxy + Follow System.
- **Side effect:** Standard's own stored mode was set to Follow System. It had been showing dark under the dark phone and its original value was not visible in the UI, so it was probably Follow System already.

## Constraints check

- **Frame worklet untouched; no new captures in it.**
- **Single clock:** the reticle lock uses `withTiming`, as the nebula fade does.
- **Tokens as uniforms:** `uKey` is `ink.background`, and `RING_SKSL` inks are token RGBA.
- **Lazy shader compile:** `labEffect("ring")`.
- **Precision-safe:** `RING_SKSL` uses only screen-coordinate differences and `atan`, and the sun disc uses O(1) sines.
- **Worklet order:** the order test is green.
- **No setState per frame.** The focus card's `setHeight` fires on content size change only.
- **Gates** (at `7899aacb`):
  - `tsc` is clean.
  - `check:colors` exits 0.
  - biome is clean on `src/components/orrery`.
  - vitest (orrery, logic, scene, theme): **100 files, 1453 passed**.

## Tunables (`lab/deep-field-config.ts`, pass 2 block)

| Group | Tunables |
|---|---|
| Plane | `PLANE_CIRCLE_SEGMENTS 96`, `RING_NEAR_TINT 0.35`, `HAZE_ALPHA_DARK/LIGHT 0.5/0.55` |
| Bodies | `BODY_FAR_SHRINK 0.16`, `BODY_KEYLINE_DP 1.6` (alpha 0.9/0.95) |
| Stacks | `STACK_OVERLAP 0.8`, `STACK_PIP_R 3.2`, `MAX 4`, `STEP 0.42`, `ANGLE −0.75` |
| Moons | `MOON_VISUAL_MIN_RADIUS 4.5`, `MAX 2.2`, `MOON_ORBIT_ALPHA 0.42` |
| Ink-in | `INK_IN_SPREAD 0.55`, `INK_GLINT_R 3.2`, `INK_GLINT_ALPHA 0.95` |
| Trails | `TRAIL_MS 160`, `LEAVING_MS 340`, `TRAIL_WIDTH 1.15`, `ALPHA 0.42/0.26`, `MAX_ARC 2.4` |
| Pulses | `PULSE_START 0.62`, `REACH 2.6`, `ALPHA 0.85`, `SETTLE_PULSE_START 0.8` |
| Dial and grid | `BEZEL_SPIN 0.42`, `GRID_FX_GAIN 0.9` |
| Warp | `WARP_COPIES 5`, `STEP 0.014`, `ALPHA 0.55` |
| Reticle | `RETICLE_LOCK_MS 720`, `SPREAD 0.85`, `PING_REACH 0.9` |
| Photo | `PHOTO_FADE_MS 260` (`OrbitBody.tsx`) |
| Focus card | `FOCUS_CARD_MIN_HEIGHT 112` (`lab/focus-card.ts`) |

## Tried and rejected (for DEAD-ENDS)

1. **Screen-space sampled polylines** with dash `PathEffect`s, open-arc segments and one multi-line tick path: still about 150 ms idle. Dashes, non-convex paths and round joins all go to the software renderer.
2. **Exact projected ellipses through `drawOval`** under translate+rotate (conic transform): about 150 ms. The ellipse ops are bounding quads, which made the plane fragment-bound.
3. **Per-ring 4-stop sweep-gradient segments:** about 30 ms extra per idle frame. Replaced by `RING_SKSL`.
4. **`JOIN_ROUND` on polygon strokes:** 650 ms per frame, a software fallback.
5. **Bounding each body's opacity `layer` with a clip:** no measurable gain, so it was reverted.
6. **Frame-chord motion trails** as tapered quads between history samples: they read as chunky polygons at device fps (12c).
7. **Full-screen cool horizon glow band:** it read as a horizontal artifact across the sky.
8. **Module-level SkImage cache:** not attempted; it collides with D-41 (item 6).

## Remaining shortcomings (ranked)

1. **Switch and focus freezes in large Systems** (baseline; headline 1). This blocks judging the jump where it matters most. It needs a release build plus a Hermes profile, then likely:
   - a narrower frame-worklet closure;
   - fewer React commits during a switch;
   - RN-Skia mapper churn work.
2. **Stale-camera snap at switch start** (baseline bug, headline 3).
3. **Idle cost.** The plane still adds about 25 ms over no-plane, and the whole lab scene sits at about 73 ms p50 idle on All Contacts with debug native. A release-build measurement is needed.
4. **Ink-in, capture ripples and glints are effectively unseen** because of sparse device frames late in the switch. Their tuning is unverified.
5. **The focus card can cover the focused body's label plate.** The card height also stays capped until its content changes.
6. **Trails are heavy for bodies close to the sun.** Their width does not shrink with ring radius.
7. **Low-count Home sits high**, a camera rule carried over from pass 1. The Home tilt of 45° is still the owner's decision.

## Recorded-decision collisions

- **D-41 (photo hook: no SkImage cache).** A shared cache would reverse it, so it was not done.
- **ADR-077 ambient motion.** The reticle lock and ping are triggered by focus, not ambient, so this is noted rather than flagged.
- **Phase-8 §C top-down Home.** Unchanged from pass 1: still a lab constant and still the owner's call.
- No other collisions were found. The focus card side and placement are not specified in the 29-UI-SPEC or the dossier.
