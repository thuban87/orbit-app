# Lab A direction 1: refinement pass 3 (close-up and interaction layer)

**Date:** 2026-10-01.
**Target:** Pixel 6 Pro, `com.bwales.orbit.laba`, DEBUG APK running **production-mode JS** (BUILD-LOOP §(i)). This is not a release build. JS-only changes: no native rebuild, and droid was not used.
**Metro:** restarted with a cleared cache (`--clear`) in tmux `orbit-lab-a` on :8083, with the same flags as before (`--dev-client --no-dev --minify`). `adb reverse` 8081→8083 and 8083→8083 were verified in place.
**Commits:**
- `3cd7695d`: focus layer (reticle HUD, emphasis, card clears label, mount fade, mounted-only shadows/pips, trail thinning).
- `b1af0a57`: arrival ghosts.
- `0c0b18b4`: focus card narrow layout and natural height, plus tests.

This doc and the evidence are in the next commit.
**Evidence:** `evidence/pass-3/`. Files 40/41 are before (pass 2) / after composites.

## Headline finding: the reticle was a React child, so it played late

The pass-2 reticle was mounted by the focused `OrbitBody`. On device it appeared only after the focus commit's full RN-Skia re-record, which is the PERF-PASS residual 2.
- **Measured:** after a tap on CR, the camera moves about 1.7 s later. With the pass-2 code the reticle was still absent 9 s after the tap (22). The baseline was measured with the same procedure on HEAD~ source.
- **What the pass-2 screenshot showed:** the "huge, asymmetric chevrons" in pass-2 `02` are the lock-on caught mid-converge. At that point the brackets were 1.85× scale, ~25° rotated, dim, and still spinning at 17°/s. The bottom-right bracket was hidden under the card. The geometry was also authored in local units (`radius + 7`), so the gap scaled with zoom.

## Outcome per item

### 1. Focus presentation: done, and moved off the React path

**`lab/FocusReticleLayer.tsx`** is one always-mounted per-frame picture, placed between the body batch and the labels.
- **Inputs:** a UI-thread `FocusState` (`keys`, `targets`, `generation`), the frame, the light map, a lock timeline and the single clock.
- **When the state is written:** `OrreryWorld` writes `FocusState` *in the render that receives the focus*. That is an async shared-value hand-off, never a sync read.
- **Result:** the reticle, ring emphasis and body dim now land in the same frame the camera starts moving (20). They no longer wait 5–10 s.

**Geometry**
- Authored in screen dp around the **drawn** disc: projected radius × `bodyVisualScale` × `bodyDepthScale`; ×`moonVisualScale` for moons; plain for the sun. `reticleDrawnRadius` is tested against `orbitBodyScale`.
- Box half-size = drawn + max(5 dp, 16%). Arms are 6–15 dp and the stroke is 2 dp.
- Axis-aligned once locked. Centred on the body by construction, and a billboard, so it is correct under the 45° tilt (41).

**Instrument styling**
- A thin lock ring at drawn + 3.5 dp.
- Four cardinal ticks.
- A short "scan" arc riding the ring off the single clock. This is the only ambient motion.

**Lock-on:** on every `generation` change (UI-thread `useAnimatedReaction` → `withTiming`, 760 ms):
- the brackets converge from 1.9× and 45° with an outBack snap (overshoot 1.6);
- a flash stroke (2.6× width) peaks at the lock;
- one ping ring leaves.

**Reduced motion (live):** already locked, with no flash, ping or scan (21, `transition_animation_scale=0`, restored to 1).

**Selected-body emphasis**
- **The focused contact's ring:** its hairline goes to full status ink along the whole ring. Width ×0.6 status width, alpha 0.85, with the same dash channel. It uses `world-plane.ts` `PlaneFocus`.
- **Other rings:** hairlines dim 55% and segments dim 33%.
- **Other bodies:** alpha −22% (`OrbitBody` layer).
- The emphasis fades 320 ms on the UI thread (instant under reduced motion).
- Semantics, hit geometry, `radius`, `hitRadius` and label metrics are untouched.

**Removed**
- The pass-2 React-mounted `FocusReticle` (body, sun and moon).
- Its ambient spin.

The legacy (non-Lab) focus rings are unchanged.

### 2. Focus card vs body and label: fixed (presentation only)

**Label clearance (`lab/focus-card.ts`)**
- `focusLabelBlock` mirrors `prepareOrreryText`: plate = 20 × fontScale + 8, plus a context plate at detail zoom.
- The plate's side mirrors `allocateLabels`: below when it fits the usable rect, else above.
- Placement clears max(reticle, label stack) on that side.

**Why the card still landed on the sun:** the camera's usable rect excludes the whole band beside the controls obstacle. On device that obstacle is a 200×173 dp block (`orrery-camera-controls`), probed at x = 195. That forced the card *above* the body, over the sun and Ada's label.

**`focusCardRoom` + `focusCardLayout`**
- Only obstacles under the card's own x-span bound it.
- If the centred 280 dp card cannot show fully, a narrower card (≥ 168 dp, +44 dp wrap slack) is tried beside each obstacle *below* the body. The candidate that shows the most of the card wins.
- Result: body, label, sun and Ada are all visible (02, 10, 40).

**Real bug fixed in passing:** the card's natural height came from `onContentSizeChange`, which never reported the relationship rows or wrapped lines that arrive later. The height stayed at its 180 dp default and clipped "Tom / Spouse of Clara Ruiz" (probed: `height 180`).
- It now comes from a wrapper `View`'s `onLayout`.
- The Lab cap is 0.55 × canvas height. The layout then caps it to the room.

**Camera framing was not changed.** Focus centring in the usable rect is camera semantics. The sun is still partly under the header pills when Clara is focused; that is framing, documented here and not fixed.

### 3. Entering bodies late on large switches: mitigated

The root cause is unchanged (PERF-PASS residual 1).

**Measured with the same video method, Lab Dense → All:**

| Build | Settle | Last entering disc on screen |
|---|---|---|
| Baseline | ≈ 2.5 s | ≈ 8.1–8.4 s |
| Pass 3 | ≈ 2.5 s | ≈ 8.2 s |

It is neither better nor worse in absolute terms. What pass 3 changes is what the viewer sees meanwhile:
- **Arrival ghosts (`world-plane.ts` §5b).** Every contact in the frame whose resource is not mounted yet draws on time, in the plane picture:
  - a neutral "unresolved" disc at its exact drawn size (background mixed 45% to grid ink, tinted hairline);
  - a neutral orbit hairline.
  The system's structure is complete at settle, and identity and status resolve when the components mount (33 vs 34).
- **No shadow before the disc.** Contact shadows are drawn only for mounted bodies; ring specs come from the same resource commit. Stack pips are only drawn for a mounted front body.
- **Mount fade.** Bodies fade in over 280 ms on mount (instant under reduced motion), so the late resolve is a dissolve over the ghost, not a pop.

### 4. First switch after cold start "doesn't animate": not reproducible. Root cause of the PERF-PASS observation explained.

A temporary probe was placed on the `OrreryScreen` store subscription and removed afterwards.
- **Cold start on All, then Lab Dense:** `ready->loading` with `hasReadySystem=true`, then `publishSwitch(…, isSwitch=true)` with 40 source ids. It animates (35).
- **Cold start restored on Lab Dense:** the same result.

**The PERF-PASS case.** The scenario ended on Lab Dense (s6), and `lastSystem` persists. So the next run's cold start opened *Lab Dense*, and its "All → Lab Dense" s1 was really a same-System re-select (`next.requested.id === previous.requested.id`). That is correctly a settled publication. There is no runtime bug, and nothing was changed.

**Side observation, not investigated:** after switching to the custom System Lab Inner Circle and force-stopping about 5 s later, the cold start opened All Contacts.

### 5. Heavy trails and segments near the sun: tuned

- **At rest:** the overview segments near the sun were already fine (01).
- **During the switch:** the heaviness was the trails. Trail width and alpha now scale with `clamp(ringScreenRadius / (9 × drawn), 0.3, 1)`: width × that, alpha × (0.45 + 0.55 × that). Inner trails are thin threads and outer trails keep their comet read (32).

### 6. Identity and detail labels, all palettes, font scale 1.3: verified

- **Palettes:** galaxy and standard × light and dark, focus on Clara at identity zoom (10). The plates, the status tick, the reticle in the accent, the lit ring and the card are legible in all four.
- **Font scale 1.3** (30, 31; restored to the original **1.15**, not 1.0):
  - plates and card scale cleanly;
  - the card's narrow layout wraps the relation line and shows it fully;
  - the moon reticle and the moon card are correct.
- **Detail-level context lines:** these need a zoom beyond the focus framing, and pinch cannot be automated. They were **not** device-verified this pass.

### 7. Other close-range issues fixed

The top items were the reticle lateness (item 1) and the clipped card (item 2), both fixed.

## Perf spot-check (BUILD-LOOP §(j) method)

A temporary UI-timestamp probe was re-implemented minimally. The old patch no longer applies. The probe was removed and nothing was committed.

| Switch | Tap → settled | Frame-worklet runs | Work p50 / max | Davey / skipped |
|---|---|---|---|---|
| All → Lab Dense | 2538 ms | 14 | 6 / 7 ms | 0 / 0 |
| Lab Dense → All | 2420 ms | 20 | 5 / 7 ms | 0 / 0 |
| All → Lab Dense | 2363 ms | 13 | 5 / 7 ms | 0 / 0 |
| Lab Dense → All | 2422 ms | 19 | 7 / 8 ms | 0 / 0 |

This matches PERF-PASS (2.4–2.7 s, no Davey). **No multi-second block returned.** Logs are in `evidence/pass-3/perf/`.

## Constraints check

- **Frame worklet:** semantics and captures unchanged.
- **New UI-thread readers:**
  - `FocusReticleLayer`: shared values plus the plain `accent` RGBA.
  - `WorldPlaneLayer`: `focus`/`focusMix` shared values.
- **No forbidden captures:** none of them capture `switchRuntime`, `scene` or `resources`.
- **Stable references:** `FocusState` is written once per focus change (ref-guarded signature). `accentInk` and the context memos are stable.
- **No O(N) per body per frame:** the reticle uses `frameBody` (indexed). The plane builds one `mounted` map per frame from `rings`.
- **Single clock (`useOrreryClock`); no setState per frame.** The card's `setHeight` fires on layout change only.
- **Tokens:** the reticle uses `tokenInk(colors.accent)`. Ghosts use ink background, grid and starlight. `check:colors` exits 0.
- **Worklet order:** all helpers sit above their callers. `reticleDrawnRadius`, `moonVisualScale`, `orbitBodyScale`, `reticleGeometry` and `easeOutBack` moved to `deep-field-math.ts`. The order test is green.
- **Test adapted:** `orrery-render.test` now expects the reticle picture between the body batch and the labels.

**Gates** (at `0c0b18b4`):
- `tsc --noEmit`: clean.
- `check:colors`: 0.
- biome on `src/components/orrery` and the screen: clean.
- `vitest src/components/orrery src/logic src/services src/stores src/screens`: **248 files, 2453 passed**.

**Device settings restored:** Galaxy + Follow System (Standard also Follow System), `font_scale` 1.15, all animation scales 1, prod-JS prefs unchanged, adb reverse unchanged.

## Tunables (`lab/deep-field-config.ts`, pass 3 block)

| Group | Tunables |
|---|---|
| Reticle | `RETICLE_GAP_DP 5`, `GAP_FRAC 0.16`, `ARM_FRAC 0.34` (6–15), `STROKE_DP 2`, `RING_DP 3.5`, `RING_ALPHA 0.55`, `TICK_DP 4`, `SCAN_ARC 0.8`, `SCAN_SPEED 0.0007` |
| Lock-on | `LOCK_MS 760`, `SPREAD 0.9`, `ROTATE π/4`, `OVERSHOOT 1.6`, `FLASH_ALPHA 0.45`, `PING_REACH 0.9` |
| Emphasis | `FOCUS_FADE_MS 320`, `RING_DIM 0.55`, `RING_ALPHA 0.85`, `RING_WIDTH 0.6`, `BODY_DIM 0.22` |
| Arrival | `GHOST_FILL_ALPHA 0.92`, `BODY_TINT 0.45`, `LINE_ALPHA 0.75`, `LINE_DP 1.3`, `LINE_TINT 0.6`, `RING_ALPHA 0.75`, `BODY_ENTER_FADE_MS 280` |
| Trails | `TRAIL_INNER_REF 9`, `TRAIL_INNER_FLOOR 0.3` |
| Card (`focus-card.ts`, `OrreryFocusContext`) | `FOCUS_CARD_NARROW 168`, `NARROW_SLACK 44`, `LAB_CARD_MAX_FRACTION 0.55`, `CARD_CHROME 24` |

## Tried and rejected

1. **Screen-dp `FocusReticle` as a React child of the body** (first attempt this pass). Correct geometry, but it appeared seconds after the focus, as the pass-2 one did. Replaced by the UI-thread layer.
2. **Dark "hole" ghosts** (background fill only). They read as black holes punched in the plane. Replaced by grid-tinted discs plus an orbit hairline.
3. **Ghost orbit hairline at 1.6× hairline alpha.** Brighter than the real rings. Now 0.75×.
4. **Capping only the card root height (+chrome).** The clip was the stale 180 dp natural height, not the root cap.

## Remaining shortcomings (ranked)

1. **Focus commits and large switch commits still cost one full RN-Skia re-record**, about 5–8 s of JS in debug native. Identity (photo, initials, status ink) and the card arrive late; the reticle, emphasis and ghosts now do not. Architecture-level (PERF-PASS options); judge on a release build.
2. **Focus camera jump.** The camera starts about 1.7 s after the tap and lands in 1–2 visible frames, in both the baseline and pass 3. The lock-on therefore plays on a camera that has already landed. Pre-existing, in the focus intent/validation path.
3. **The sun is partly under the header pills when a near-sun body is focused.** This is camera framing (usable-rect centring) and was not changed.
4. **A moon's focus card can cover its parent's label plate.** Only the focused body's own label is cleared.
5. **At font scale 1.3 the nudged label plate touches the bottom-left bracket** at identity zoom (30). The label metrics are fixed, so the fix would be the reticle yielding at that corner.
6. **Detail-zoom context lines were not device-verified** (pinch cannot be automated).
7. **Arrival ghosts are neutral by necessity.** The frame carries no status or identity, so status ink can only arrive with the mount.

## Evidence (`evidence/pass-3/`)

| File | Content |
|---|---|
| 01 | Overview, All Contacts, galaxy dark |
| 02 | Focus Clara, galaxy dark (final) |
| 10, 1x-* | Focus Clara in all four palettes |
| 20 (mp4 + sheet) | Lock-on, 3 fps sheet from the tap |
| 21 | Reduced motion: static reticle |
| 22 | BEFORE: the pass-2 reticle still absent 9 s after the tap |
| 30, 31 | Font scale 1.3: Clara and moon focus |
| 32 | Mid-switch trails, inner thinned |
| 33 (mp4 + sheet) / 34 | Arrival ghosts AFTER / BEFORE |
| 35 | First switch after cold start animates |
| 40, 41 | Before/after focus and the reticle crop |
| `perf/` | Latency spot-check |
