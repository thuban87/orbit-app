# Lab B — Recommendations

My judgement after M1, M2, R1 and R2. All evidence is from the **emulator**. The **R3
polish pass and the Pixel phone pass are PENDING**, and either could move a verdict; the
placeholders below must be filled.

## 1. Where is the practical visual ceiling of RN Skia for the Orrery?

It is **higher than the current Orrery uses, and the limit is architecture, not shaders.**

**What RN Skia 2.6.2 handled well on this target** (all of it emulator-relative):

- a full-screen procedural sky, painted every frame;
- lit photo worlds;
- a stellar sun with corona;
- hundreds of hairline orbits on a tilted perspective plane;
- HUD labels;
- a sun-lit stage plane;
- a multi-effect System-switch sequence.

**What breaks it is how work reaches Skia:**

- per-entity declarative components with animated props;
- worklet closures that capture object graphs;
- stroked paths re-tessellated every replay;
- uniforms resolved by name;
- any per-tick re-record that scales with N.

With those fixed, the lab reached **940 bodies with about 10 ms of UI worklet time per pan
frame and no crash**, against a legacy renderer that is unusable from about 120 bodies on
the same target.

**The genuine cost ceiling is full-screen offscreen work.** Bloom and backdrop blurs are the
Android GPU cliff, and the emulator cannot measure it. The phone pass decides how many
full-screen passes the default can afford: the nebula sample, the stage plane, and possibly
the flare streak.

## 2. Best experiments

1. **The switch-stall root cause and fix** (`ea137306` + layer pictures). This turned a 3–7 s
   freeze on *both* renderers into a fully playing showcase. It is the most valuable finding,
   and part of it ships to today's app (HARVEST H-A1).
2. **Home tilt + sun light pool (R2).** This is the single biggest visual jump: from radar
   target to star-system map, for almost no cost. The depth stack (far-side ring fade, haze,
   perspective) was already built, and the tilt finally showed it (`evidence/10-r2/before-after-overview.jpg`).
3. **Plane homography for instrument geometry.** 120 orbits cost the same as zero, and they
   are exact in any tilt.
4. **The System-switch showcase.** Streaks, dissolve, comets, flares and a projected
   shockwave, all as pure functions of the choreography. It reads as a game beat and stays
   correct under pause, remount and retarget.
5. **The target-lock reticle with seek→lock tied to the camera, plus the anchored focus
   card.** These fixed the two ugliest M1 elements.
6. **The baked tiling nebula with colour at sample time.** A full-screen sky for one texture
   fetch, with no rebake on a theme or sky-hue change.
7. **Standard's graphite sky + chart graticule.** It gives the second package its own,
   arguably more premium, identity.

## 3. Worst experiments

1. **Tilt-shift DoF.** It blurs faces while their names stay sharp; failed.
2. **Displacement shockwave filter.** Invisible at normal speed and costs a full-screen
   layer; failed.
3. **Stroked static paths for wakes and tethers.** They looked static, but Ganesh
   re-tessellates them every replay (+56 ms p50). Reverted.
4. **Per-ring React components for the switch trims.** A ~9 s debug freeze.
5. **Bloom.** The best-looking of the failures: beautiful, but a per-frame full-screen
   offscreen blur, and it undoes the legibility work.
6. **Ring energy flow.** It works technically, but it is mood motion on the data lines
   (HANDOFF §7 "Motion encodes data, not mood"), and it forces the clock on.

## 4. Performance envelope (emulator-relative; phone PENDING)

| Bodies | Result |
|---|---|
| 12–120 | Comfortable. The lab renders ~6× the legacy frame count at Dense 120 (release). |
| 400–800 | Smooth after R1: pan p50 17 / p99 48 ms on gfx, 0 skipped frames, no crash. |
| 940 (All Contacts) | Mounts and switches. |

- **Under reduced motion or when nothing ambient animates**, an idle Orrery draws 0 frames.
- **The presented rate** is 60 fps with the opaque canvas vs ~28 fps with TextureView, on
  this emulator.
- **Unknown until the phone pass:**
  - absolute frame times;
  - Mali fill for the full-screen shaders;
  - thermal and battery;
  - texture memory;
  - whether the opaque-canvas win is real on hardware.

## 5. Top HARVEST items (ranked)

1. **H-A1** Frame-worklet capture discipline (`ea137306`). Ship to main now.
2. **H-A2** Paragraph cache (`83c9033a`). Fixes a crash on large Systems; ship to main now.
3. **H-A3 / H-A4** O(N) allocation and satellites; `projectFrame` hoisting. Ship to main now.
4. **H-A5** Hermes-safe initials. Today's app shows "El…" instead of "EN" on Android.
5. **H-B1** Layer pictures as the V2 per-entity architecture.
6. **H-B3** The plane homography for all instrument geometry.
7. **H-B2** The idle clock.
8. **H-C17 + H-C18** Tilted Home + sun light pool (owner TILT, STAGE).
9. **H-D1** The switch showcase.
10. **H-C1 / C4 / C6 / C10 / C15** Sky, lit worlds, stellar sun, hairline orbits, HUD tags.
11. **H-D3 / D4 / D7** Reticle, world response, anchored focus card.
12. **H-C22** Standard chart identity.

## 6. What production V2 should steal from Lab B

- **Architecture.**
  - The model half stays as is (plus the shared fixes).
  - The renderer is a small declarative scene tree (sky, stage, sun, FX, overlays) plus
    **one imperative UI-thread picture or Atlas per N-entity layer**.
  - One pausable ambient clock.
  - Every animated thing is a pure function of shared values (switch signal, focus `mix`,
    camera).
- **Rules (write them into the V2 plan as acceptance criteria):**
  1. Worklets capture only SharedValues and small stable data (with capture tests).
  2. No per-entity bound SharedValues; keep the bound-value count in the tens.
  3. Instrument geometry = circles, rects and shaders under one homography; never stroked
     paths per replay.
  4. Runtime effects are lazy, memoised and null-safe, with packed `float4` uniforms and a
     uniform-contract test.
  5. Sky and instrument layers read `frame.pose`, never `pose`.
  6. Ambient animation pauses when nothing ambient is visible; reduced motion = 0 frames.
  7. Hermes traps: no forward worklet references, no worklet default params referencing
     module constants, no `null` matrices.
  8. Measure with the probe + gfx/SurfaceFlinger + Perfetto. Never trust an FPS HUD.
- **Look:** the two-register language (physical = no data, instrument = all data); a tilted
  Home; the sun as the scene's light source; worlds, not avatars; hairline status orbits that
  keep the weight order; HUD-tag labels; per-package identity (Galaxy deep field, Standard
  chart).
- **Moments:** the switch showcase; the target lock.

## 7. Carry forward / reject

| Carry forward | Simplify | Reject |
|---|---|---|
| Shared fixes (H-A1…A5, A7) | Gravity-well grid (texture or fold into the pool pass) | Bloom as a default |
| Layer pictures, idle clock, homography, pure switch signal | Lens flare → streak only | Tilt-shift DoF |
| Baked nebula + analytic far stars | Procedural initials worlds → smaller etched initials, more surface identity | Displacement shock filter |
| Lit photo worlds, stellar sun + glow cap, cheap moons | HUD chrome (light touch) | Live fbm nebula |
| Hairline instrument rings, density fade, tethers | Particles/comets if phone p99 demands | Per-moon shaders by default |
| HUD-tag labels, text-only defocus | Wakes (only if the owner wants progress visible; single-shader version) | Ring energy flow (owner FLOW) |
| Home tilt, sun light pool, rim light, size floor | — | Declarative per-entity components |
| Switch showcase, sky hue (stable hash) | — | Stroked paths for static instrument geometry |
| Reticle + world response, feedback, reorder language, anchored card + occlusion | — | Raising card opacity to fix ghosting (ADR-149 reversal) |
| Standard chart identity, per-theme profiles | — | — |

## 8. Lessons

1. **Measure before you optimise, and distrust convenient meters.** The FPS HUD lied in
   every WP. gfxinfo cannot see a SurfaceView. The emulator's TextureView path capped
   everything at ~28 fps. The switch-stall's "obvious" Skia stack sample was a red herring.
2. **The expensive part is how often and how much the JS/UI bridge touches Skia, not what
   the GPU draws.** Shaders were nearly free on this target; object graphs, bound values and
   re-records were not.
3. **The biggest visual win was a camera decision, not an effect.** Tilt revealed depth that
   was already there.
4. **Pure-function effects pay for themselves.** Remount, retarget and reduced motion came
   out correct without special cases.
5. **Taste needs real content.** The fictional portrait set answered the face question that
   the flat seed avatars could not.
6. **Lab legibility work must be re-run after every art pass.** R2 brightened the plane
   after R1 had proved the contrast.

## 9. What I would do with one additional day

In priority order:

1. **Run the Pixel phone pass** (once the owner frees the phone). First fix the script gaps:
   add the R2 rows (`planeLight/planeGrid` off, `bloom` on) and switch the R2 flags off in
   `labmin`. Then fill PERFORMANCE §9. Everything below depends on it.
2. **Re-run legibility** (`tools/r1-legibility.sh`) on the R2/R3 defaults in all 4 themes,
   and fix any < 4.5:1 overlay case canvas-side (GLASS).
3. **Fold the stage plane into the nebula pass** (one full-screen pass instead of two), and
   time tilt (perspective) cost now that Home is tilted.
4. **Cut switch p99:** one shared trim shader with per-ring uniforms instead of a Paint +
   sweep gradient per ring, and typed-array particles.
5. **Build the photo texture atlas** (one image for all faces) to close C-50 and halve the
   bodies picture.
6. **Prepare the PORT patch for main:** the six shared fixes as clean commits with tests,
   ready for a separate phase.
7. **Fix the stale header comments** in `LabEnvironment.tsx`, `LabRings.tsx`,
   `LabBRenderer.tsx` and `labb-effects.ts`.

## PLACEHOLDER — R3 polish outcome

> _TBD: what R3 changed, whether any verdict above moved, and updated "best" evidence
> images._

## PLACEHOLDER — Phone pass outcome

> _TBD: which "unknown until the phone pass" items resolved, and how; whether the opaque
> canvas, the stage plane and the switch FX stay default; and the final envelope for V2
> planning._
