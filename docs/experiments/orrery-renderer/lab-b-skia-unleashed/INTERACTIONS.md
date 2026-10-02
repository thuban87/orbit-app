# Lab B — Interactions

This covers camera, gestures, focus, zoom, System switching and reduced motion as of
`bfc8f36c`, with R3 and final-validation notes added (`research/R3-REPORT.md` §2–§4,
`research/FINAL-VALIDATION.md`). Every observation below comes from the **emulator**. Pinch,
twist and two-finger tilt cannot be injected with `adb input`, so zoom levels and yaw were
reached through focus fly-ins, panel camera presets and pose deep links. No physical-touch
session on a phone has happened yet. The Pixel 6 Pro pass (`research/PHONE-PASS-RESULTS.md`) was
adb-driven too, so pinch, twist and two-finger tilt still need a physical check by hand.

R3 interaction changes:
- `nearSizeClamp` (C-71) limits the drawn size of near bodies at detail zoom with the Home
  tilt. It is applied to the frame, so hit radii, label gaps, reticle and card keep-out
  follow it (`MIN_HIT_RADIUS` floor kept).
- `immersiveChrome` (C-72) makes the floating header an obstacle (`orrery-lab-header`), so
  Home framing and focus-card placement keep clear of it. The three controls become one
  rail with the same names and 55 dp targets.
- Home tilt applies only to the lab renderer (Legacy = production Home).

## 1. What did not change (semantic guarantees)

The model half in `OrreryWorld.tsx` is shared with the legacy renderer and keeps its
semantics:

- the gestures (pan, pinch, two-finger rotate and tilt, tap, long-press reorder);
- `resolveTap` (allocations → label tap → body/cluster/satellite intent) and `hitPolaris`;
- the camera clamp, MIN_ZOOM 0.25–4 and tilt 0–60°;
- the recovery paths (focus fly-in, Recenter, reset north);
- semantic levels (overview / identity / detail);
- label allocation, focus-lost reactions, cluster and satellite focus, reorder hold and
  commit.

The lab only adds one thing to this half: side-stamps (`fxTap`, C-20/C-54) that feed visual
feedback without changing the returned intent.

Every lab body is drawn at **exactly** the frame radius, so hit radii, label anchors and
focus framing are unchanged. The single exception is R2's `bodySizeFloor` (C-69). It draws
bodies under 12 dp up to 1.4× larger at overview, while hit radius and labels stay as they
were.

## 2. Camera and Home

| Change | Flag | Owner? |
|---|---|---|
| **Home tilts the plane to 0.56 rad (≈32°)**. Applied at the 3 `OrreryScreen` Home call sites (switch destination Home, scene Home framing, Recenter) through `labHomePose`. `deriveHomePose` is untouched. | `homeTilt` (ON) | **Yes, C-66.** `docs/systems/orrery.md` says "Recenter … restores all Home axes" (Home = tilt 0). |
| The sky parallaxes with pan, zoom, yaw and tilt, read from the *animated frame*, so it follows the sampled camera during switches. | `parallax` | No (pure visual) |
| Rings, chart, wakes, tethers, shockwave and ripples sit on the world plane under one homography, so they stay exact in any tilt and yaw. | — | No |
| Debug camera presets: zoom 0.4/1/2.2/3.2/4, tilt 0/30°/max, yaw 0/90/180, pan to sun. They run through the normal `camera.recover` path. | panel only | No (C-25, delete) |

**Side effect of the Home tilt.** At detail zoom, the near-side body grows large and can
slide under the FAB column (`evidence/10-r2/06-final/04-detail-dense.jpg`). Perspective is
working as designed. The deeper cause is that presets zoom about the view centre, not the
content.

## 3. Focus

The focus logic is in `LabFocusFx.tsx` `useLabFocusState` and `labb-focus-logic.ts`.

**Focus state.**

- **`mix` and `keys` are written only in a `useEffect` keyed on focus identity** (the joined
  body keys). No React state is updated per frame.
- `mix` fades in over 340 ms and out over 260 ms. `keys` is kept after a clear, so the
  release can fade out.

**Seek, then lock.**

- While the camera's recovery flies in (`camera.active`, the new contract field
  `cameraActive`), the reticle **seeks**. Its spread and spin are a pure function of the
  body's remaining on-screen distance to the usable-rect centre, so it converges *with* the
  camera.
- Once the camera settles, it **locks** over 380 ms. If no fly-in starts, there is a 160 ms
  grace before the lock.
- When the lock completes there is a one-shot flash ring, then a static dashed range circle.
  There is no continuous spin.

**Cluster and satellite focus.**

- Cluster: one reticle per member, plus a dashed hull circle.
- Satellite: a reticle at 0.8× size.
- The legacy accent focus ring is suppressed while `fxFocus` is on.

**World response** (`fxFocusDim`, C-52).

- Non-focused worlds desaturate and dim.
- Non-focused rings dim, driven by the animated `mix`.
- Non-focused label *text* dims to a floor of 0.66.
- The vignette deepens by up to 16 %.
- The focused world gains atmosphere.
- The sun is never dimmed.

**Focus card.**

- **Anchoring** (`focusCardAnchor`, `orrery-focus-placement.ts`, tested). A keep-out box
  covers the body plus a label reserve of 58 dp × fontScale. The card tries below, above,
  right, then left. If none fits whole, it takes the roomier vertical side with a height cap
  (the card then scrolls, C-57); failing that, it docks. Its natural height comes from
  `onContentSizeChange`. Under `hudChrome`, the two actions share one wrapping row.
- **Occlusion** (`focusCardOcclusion`, C-61). Bodies under the card's rect draw at 0.12
  alpha, and labels there are dropped. The ADR-149 glass is unchanged. This removed the
  "ghost word through the glass" artefact (`evidence/09-r1/shots/01-focus-card-occlusion-off-vs-on-dense-eli.jpg`).

**Verified on the emulator:**

- photo and initials focus;
- Dense 120;
- all four themes;
- reduced motion;
- background → foreground while focused (focus restored, reticle re-locks);
- a switch while focused (focus cleared, no stale reticle);
- satellite focus (`evidence/08-wp2.2-focus/15-release-satellite-focus-small-reticle.jpg`).

**Verified later on the emulator (R3 `evidence/11-r3/03-paths/`, final `evidence/13-final/`):**

- a far-zoom (0.4) focus flies in and locks (`farfocus-*`);
- a cluster (group) tap opens the group panel with a reticle per member (`cluster-1-panel.jpg`);
- the Polaris north tap fires the flare **and** recovers yaw to north, in legacy and lab
  (`13-final/01-polaris/`). R3's "no rotation" note was a recording that started after
  the ≤ 850 ms recovery had finished (FINAL-VALIDATION §1).

## 4. Feedback (`fxFeedback`, `LabFeedbackPicture`)

| Event | Visual | Duration |
|---|---|---|
| Tap a body | Sonar ping (two rings, the second an echo) that follows the body | 620 ms |
| Tap empty space | Ripple on the world plane (a circle at the unprojected tap point under the homography, i.e. a projected ellipse), 78 dp, alpha 0.7 | 620 ms |
| North tap (Polaris hit) | Polaris flare: cross spikes plus a ring | 620 ms |
| Reduced motion | A fixed ring that fades | 150 ms |

None of these layers reads the ambient clock. Every animation is a `withTiming` SharedValue,
so the layers do not re-record at rest.

## 5. Reorder (`fxReorder`, C-55)

- A **hold-charge arc** fills around the body over `HOLD_MS` from touch-down.
- Once the hold is active:
  - the held body's ring glows on the plane, and its radius is the candidate slot;
  - the ring flashes on every slot change (340 ms, event-driven, not ambient);
  - a locked reticle rides the body.
- The haptic is unchanged. The legacy accent ghost path is hidden while this flag is on.

A motion-event drag on the emulator reordered and committed: the "EN" contact moved slots
after a reload (`evidence/08-wp2.2-focus/12-debug-sheet-reorder-hold-charge-held-ring-slot.jpg`,
`16-debug-reorder-hold-drag.mp4`). An adb long-press drag on the canvas is unreliable, so
this was only checked once.

## 6. System switching — the showcase (WP-2.1)

**The choreography is unchanged:** 2 100 ms normal, 180 ms reduced
(`use-orrery-switch-runtime.ts`), with phases accelerate / shed / capture / settle
(`orrery-switch-choreography.ts`). The lab exports three pure samplers:

- `sampleSwitchSignal(transition, progress)` returns phase, rotation, angular velocity,
  normalised velocity, intensity and the reduced flag;
- `sampleSwitchEntry(...)` is byte-identical to the full sample for one entry;
- `entryWindow(...)`.

Every effect is a pure function of the signal, the role map and the animated frame.

| Phase | Added visual (flag) |
|---|---|
| **accelerate** | **Hyperspace streaks** (`fxStreaks`): mid and near stars become streak sprites from a 32-band texture, head-anchored, with the tail toward the camera vanishing point, twisted by the spin. Far stars smear inside the nebula shader. **Sky push**: zoom ×(1 + 0.14·warp·depth). **Corona flare** +40 % and **ring-flow spool-up** (`fxSpool`). **Motion smears** on retained bodies (their spiral sampled 0.025 earlier, `fxComets`). |
| **shed** | **Dissolve** (`fxDissolve`): a noise threshold plus a glowing status edge in the body shader. Initials fade with it. **Particle bursts** (`fxParticles`): a stateless Atlas with capacity 640, budgeted over *on-screen* leaving bodies, in the status hue with hot sparks. **Ring unwind** (`fxRingTrim`): the visible arc trails the body from 1 to 0, drawn as one UI-thread picture per frame with sweep-gradient masks. |
| **capture** | **Arrival comets** (`fxComets`): the tail is the body's inbound spiral sampled 0.07 earlier. **Ring draw-on** from 0 to 1, then a crossfade back to the class style. **Capture flare** (`fxFlares`): a body-shader limb flash plus glow and glint sprites, with alpha shared across simultaneous arrivals (1/√(n/8)). |
| **settle** | Streaks relax. **System-lock shockwave** (`fxShockwave`): a world-space circle under the homography, so it is a projected ellipse, with a crisp front and a soft trailing glow in the destination sky hue. There is none below intensity 0.25. **Sky-hue crossfade** to the destination System's hue (`fxSkyHue`, C-05). |
| **retarget** | Effects follow the rebased sample automatically. Particles key on `(generation, entry key)`. |
| **Reduced motion** | None of the above: the existing 180 ms crossfade plus the sky-hue crossfade (`evidence/06-wp2.1-switch/02a`, `02b`). |

**Intensity scaling is kept.** A low-turnover switch produces fewer particles, shorter
streaks and no shockwave below intensity 0.25. Example: Dense → All has high continuity, so
there are few streaks and no lock drama.

**Warm-up.** No first-switch compile hitch was attributable to warm-up. The first switch
after a cold launch measured p50 17 / p90 40 / p99 117 ms with 0 skipped frames, the same as
warm switches (emulator release; `evidence/06-wp2.1-switch/01-…mp4`).

**Big switches.** Between large Systems they used to freeze for 3–7 s (a pre-existing stall
in the shared model half). They now play at normal speed with 0 skipped frames, after the
switch-stall fix (`evidence/07-switch-stall/05-sheet-…jpg`, `03-AFTER-…mp4`). A switch into
Stress 800 also plays (`evidence/09-r1/shots/06-release-switch-inner-to-stress800-opaque.mp4`).

**Experiment, flag off: displacement shockwave image filter** (`fxShockFilter`). It lenses
the nebula and rings with a chroma-split band. At normal speed it is invisible. The verdict
is **failed** (R2-REPORT §3b, `evidence/10-r2/05-shockfilter/`).

**Owner-taste notes.**

- Capture flares, comets and particles draw *over* faces for ≤ ~0.3 s per body (C-47).
- Departing faces dissolve.

## 7. Reduced motion

- **Source.** The OS signal, or the lab override (`On`/`Off`/`Follow OS`, applied app-wide
  and live, C-21). It is read inside every ambient worklet (ADR-085).
- **Effect.** The scene is static and complete, with no ambient motion. Parallax still
  follows the user's own gestures, and feedback becomes a ≤150 ms opacity ring.
- **Proof.** There are 0 changed pixels between captures in every milestone:
  - M1: `evidence/05-m1-checkpoint/24a/24b`;
  - focus: `evidence/08-wp2.2-focus/08`;
  - R2 with everything on: `evidence/10-r2/06-final/09`.
- **Idle clock.** Under reduced motion, an untouched Orrery draws **0 frames per 10 s**. It
  was 190 before R1 (PERF-LOG R1).

## 8. Lifecycle interactions

- **Tab blur and app background.** The canvas unmounts (existing mount gate) and draws 0 gfx
  frames. On return it remounts, and focus is restored with the reticle re-locking.
- **Mid-switch remount.** Effects are pure in `progress`, so a remount resumes from the exact
  sample. This holds by construction. It was not separately recorded on device beyond the
  deep-link remounts used throughout WP-2.1.
- **Opaque canvas (SurfaceView, default ON since R1).** The glass overlays, the focus card,
  tab switches and screenshots all composite correctly on the emulator
  (`evidence/09-r1/shots/02`, `03`). This **needs a phone check** (C-07).
