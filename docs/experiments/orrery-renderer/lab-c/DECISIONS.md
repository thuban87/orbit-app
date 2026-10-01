# Orrery Lab C — decisions log

## 2026-10-01 — Parity camera abandoned; real perspective camera adopted

**Dead end (commit 205c1462).** The first true-3D build drew a three.js WebGPU scene but
viewed it through `orreryCameraRig` configured to reproduce the production ADR-077 pinhole
pixel-for-pixel: focal distance derived from the scene extent (~4.6× extent, telephoto),
`zoom` narrowing the FOV instead of moving the camera, default tilt 0 (top-down), max tilt 60°.
The output was indistinguishable from the 2.5D Skia Orrery, so the owner's goal (a visibly
deep, game-like star-system map) was not met. The parity requirement was an orchestrator
mistake and is withdrawn. (fff81462 additionally left `LAB_STAGE="context"` and
`LAB_C_TRUE_3D=false`, so nothing 3D rendered at all; both removed/flipped.)

**New camera model.** Still one pinhole formula shared by the UI-thread projection
(`orrery-frame-lite`, hits/labels/focus) and the three camera (`orrery-camera-rig`), so
drawn == tappable — but with real-camera parameters (`src/logic/orrery-camera-logic.ts`):
- fixed focal length `LAB_FOCAL_PX = 720` logical px (≈50° vertical FOV on the Pixel 6 Pro);
- dolly distance `F / zoom` from the pivot (`clampCameraPose` writes it into `focalDistance`),
  so pinch is a dolly and perspective strength grows as you move in;
- default tilt `LAB_HOME_TILT = 1.08` rad (~62° from vertical), `MAX_TILT = 1.32` (~76°);
- yaw orbits the pivot; focus flies the pivot to the contact and dollies in;
- points at/behind the camera no longer throw on the UI thread: `perspectiveScale`/unproject
  clamp the denominator and frame-lite culls bodies inside 12% of the dolly distance.

Depth cues in `orrery-scene3d.ts`: sun point light + low ambient (lit side / terminator on
body spheres), per-pixel sun lambert on the photo billboards (view-space sun vector per
instance), range fog to the background token, ring opacity falloff with view distance,
thinner ring strokes, star sphere around the camera (rotational parallax), emissive sun core
with limb darkening + additive glow + wide corona.

Known consequences: 7 vitest cases in camera/frame/gesture/recovery/reorder logic encode the
old 2.5D contract (tilt 0 home, 60° max, throw-on-horizon) and now fail; to be rewritten
for the 3D contract in a follow-up.

## 2026-10-01 — Checkpoint B.1: strategy-map camera gestures

`createOrreryGestures({ strategyCamera: true })` (3D world only; the Skia world and its tests keep
the production mapping):
- **one-finger drag orbits**: new `CameraStep` `orbit` — `yaw -= dx·0.0076` (full-width drag ≈ 180°,
  grab-the-turntable sign), `tilt -= dy·0.0052` (drag up leans toward the horizon), clamped to
  `[0, MAX_TILT]` by `clampCameraPose`. Every sample composes on the UI thread into `pose`.
- **inertia**: release velocity → `inertiaTarget(kind "orbit")` (velocity × 0.32 s, capped ±1.2 rad
  yaw / ±0.35 rad tilt) played as a 900 ms coast on the existing quintic ease-out recovery curve
  (reads as damping). Reduced Motion disables it, as for pan/yaw coast. Any new touch `stop()`s it.
- **two-finger drag pans** the pivot (the former 2-finger vertical-tilt recognizer, now activating
  on centroid travel in any direction, feeding `panCamera`); pan stays bounded by
  `clampCameraPose` (pivot within ±extent) so the system cannot be lost.
- pinch = dolly (unchanged), two-finger twist = yaw (unchanged), tap/long-press reorder unchanged
  (reorder's hold still fails on > HOLD_SLOP movement before the orbit claims ownership).
- recenter = `deriveHomePose` (tilt 1.08, yaw 0, home zoom) via `camera.recover` — unchanged.
Device-verified: adb swipe orbits (screens 01→02), tap after orbit focuses (03). Not device-testable
via adb: two-finger pan, pinch (multi-touch).

## 2026-10-01 — Checkpoint B.2: framing, hero bodies, label tiers for the 3D camera

- **Framing.** `CameraViewport.camera` (new, optional) is the rect whose centre is the projection
  centre; `cameraCenterRect()` falls back to the usable rect, so the production/2D path is unchanged.
  OrreryScreen sets it to the canvas minus full-width bars only (selector row, tab bar) — the right
  control column, cluster panel and focus card stay obstacles for labels/framing but no longer push
  the whole system into the top third. Used by projection, unprojection, frame-lite and the three rig
  (drawn == tappable preserved).
- **Focus framing.** `focus()` re-caps zoom to IDENTITY_ZOOM after `frameBodies`; with a lower
  projection centre that slid the body under the focus card. Single-body focus now solves the pivot
  (3 fixed-point steps of project/unproject) so the body lands on the usable-rect centre at the final
  zoom; the card then sits below it.
- **Hero bodies.** Contacts' world radius ×1.9 (`CONTACT_HERO_SCALE`) inside the 3D world's sample —
  the same radius feeds the UI-thread frame (hits) and the GPU packet, so drawn == tappable. Hit
  circles grow with it (more `group` taps where bodies overlap — accepted for the lab).
- **Label tiers.** The PRODUCT rule (overview: focused/cluster only; identity: names; detail: names +
  context; thresholds IDENTITY 2 / DETAIL 3 with hysteresis) is unchanged. Its input is re-derived:
  instead of `pose.zoom` it is the median on-screen magnification of visible contacts relative to their
  un-heroed world radius (`effectiveLabelZoom`) — i.e. names appear when bodies are as large on screen as
  when the old near-orthographic camera crossed the tier. Satellites' tier uses the same level.
- **Label legibility/occlusion.** Labels keep the theme `surface` plate (existing rasterizer); gap to
  body 8→4 px so the name visibly belongs to its body; allocation now ranks same-priority labels
  nearest-first (`LabelCandidate.depth`), and every visible body is an exclusion, so a far label can't
  sit on a near body. The focus card is not a shell obstacle (it follows the body), so the 3D world
  reserves a 290×230 rect below the focused body — no label renders under the translucent card.
- Lab badge presets now also dolly (×1, ×2.2, ×3.4 home zoom) to reach the tiers without pinch.

## 2026-10-01 — Checkpoint B.3: visual pass (overview composition, star, plane)

- **Overview composition.** `CameraViewport.camera` height ×0.62 ⇒ a lens shift putting the pivot (sun)
  at ~31% of the canvas, so the receding far half reaches the top of the canvas and the near half fills
  the bottom (screens 10 vs 04). `deriveHomePose` additionally dollies in while the far rim stays under
  the camera-rect top and the system half-width ≤ 0.6 viewport — on the dense seed the width bound
  already binds at the top-down fit, so the lens shift is what fixes the empty sky. (deriveHomePose was
  moved BELOW projectWorldPoint: worklet forward-reference rule.)
- **Star.** Sun core is an emissive sphere with limb darkening + drifting 2-octave
  `mx_fractal_noise_float` granulation on the local normal + a hot core term; sun ×1.45 hero scale.
  The occupant is a framed medallion (face inset to 80% of the plate, glow-token gold bezel with a bevel
  highlight and warm vignette), plate 0.74 of the sun radius, so the person sits IN the star.
  Compromise: the seeded self occupant has no photo and its tile renders as a plain swatch, so the
  medallion interior is still a flat periwinkle (not a renderer limitation — a real photo fills it).
- **Orbital plane.** One additive CircleGeometry disc (1.18 extents) under the plane: radial dust falloff
  + 9 polar grid rings + 24 spokes, tinted by the theme `accent` token, faded at the edge.
- **Bloom: not added.** A real bloom pass (three PostProcessing BloomNode) adds 2+ full-screen passes;
  the frame is already JS/present-bound. The existing additive sun glow + corona stands in. Dead end
  candidate for a GPU-thread renderer, not tried.
- **Cost.** Renderer log on the Pixel 6 Pro: before B.3 ~47–51 fps (jsRender ~11.3 ms); after, 42 fps at
  overview, 31–34 fps dollied in close (present 4.9→10.6 ms: fill cost of the noise star + plane at
  close range). Overdraw is the lever (smaller plane disc, cheaper noise) if this ships.

## 2026-10-01 — Checkpoint B.4/B.5: "Unavailable System", tests

- **"Unavailable System" is pre-existing app behaviour, not the seed or the lab.** On screen focus,
  OrreryScreen restores `preferences.lastSystem` via `select(system, undefined)` (no name). The store's
  name fallback (`orrery-system-store.ts` ~104) resolves names only for built-ins and categories; for a
  `custom` System (all three Lab C seed Systems are custom) the name falls to "Unavailable System", and
  the post-load `currentName` again resolves categories only, so it never recovers. Files are unchanged
  vs `main`. Would reproduce in production for any user whose last System is custom. Fix (not applied —
  production behaviour, owner's call): pass the catalog entry's name on restore, or resolve custom names
  from the loaded snapshot.
- **Tests.** The 7 old-2.5D-contract cases (tilt-0 home, 60° max, throw-on-horizon, …) were NOT rewritten
  in this checkpoint (time box); they still fail exactly as at da5433a9. New coverage:
  `orrery-strategy-camera.test.ts` (orbit step, orbit inertia cap + Reduced Motion, two-finger pan bound).
  `npx tsc --noEmit` clean.
- **Sun occupant without a photo** still renders as a flat swatch inside the bezel: the seeded self has
  no photo and (apparently) empty initials. Next step: initials/icon on a shaded plate with the star
  glowing through.

## 2026-10-01 — Checkpoint C.1: "Unavailable System" fixed on the LAB BRANCH ONLY

OrreryScreen now reconciles `requested.name` from the loaded Systems catalog whenever the requested
System is `custom` (one effect after the catalog loader; `useSystemStore.setState`). The store itself is
untouched. This is a **pre-existing main-app bug** (any user whose last System is custom sees
"Unavailable System" after re-entering the Orrery); this branch is never merged, and the fix on `main`
is the owner's decision. Device: selector reads "Lab C Inner" after relaunch
(evidence/04-checkpoint-c/01-system-name-restored-lab-c-inner.png).

## 2026-10-01 — Checkpoint C.2: System switching reinterpreted in 3D

The production choreography is untouched: `sampleSwitchChoreography` (roles retained/leaving/entering/anchor,
phases SHED 0.18–0.58, CAPTURE 0.44–0.82, SETTLE 0.72, stagger 0.035, spin turns by intensity, 2100 ms
driver, 180 ms Reduced Motion crossfade) still owns x/y, radius, opacity and interactivity. The 3D world
ADDS, all computed on the UI thread inside the existing packet reaction / sampled camera (no React state):
- **Vertical axis** (`switchDepth`, packet stride 6→8: `lift`, `flare`): leaving bodies fall below the plane
  (`0.42·extent·shed²`) while they spiral out and fade, so they sink into the range fog; entering bodies
  streak in from above (`0.55·extent·(1−capture)²`) and land on their orbit; retained bodies stay ON the
  plane (they are interactive throughout, so drawn == tappable is preserved; entering bodies only become
  interactive at 0.82, when their residual lift is ≈0).
- **Capture flare**: in a 0.16-progress window around each entering body's capture end, its orbit ring
  brightens (alpha ×(1+1.4f)) and widens (×(1+2f)), plus a small additive accent-token halo (pool of 24).
- **Camera breath** in the sampled switch camera: dolly-out up to 24%, yaw +0.38 rad, tilt −0.1 rad on a
  sin² envelope scaled by intensity — zero at p=0 and p=1, so the destination Home is landed exactly.
  It lives in the sampled pose, so the UI-thread frame and the three camera stay one pinhole.
- Reduced Motion: no lift, no flare, no breath (the production 180 ms crossfade only).
- Evidence: `04-checkpoint-c/02-switch-inner-to-core-to-dense.mp4`, `03-switch-dense-to-inner.mp4`,
  `04-switch-mid-t*.png` (frames pulled from the recording). Log line `[lab-c] switch gen=… retained/leaving/
  entering` proves the choreography fires (Dense→Inner: retained 10, leaving 110, entering 7, intensity 0.85).
- **Orchestrator review (a)** "Core→Dense shows no transition": the first recording simply ended while the
  Dense snapshot was still loading (~2 s scene read for 120 contacts; the old System stays mounted until the
  destination is ready — production behaviour). The renderer log confirms Dense renders 121 bodies.
- **Review (b)** "destination doesn't frame the whole System": not changed. Home is the production
  readability rule (`zoom ≥ 10/minRadius`, research §7: "large Systems overflow and you pan") plus the B.3 lab
  composition. Fitting the full extent would shrink bodies below the readability floor — a product call,
  flagged for the owner rather than reversed here.
- Known issues seen in the recordings: (1) the scene read for a switch takes 1.4–2.5 s before any motion
  (pre-existing load latency, not renderer); (2) one frame right after the selector closes shows the upper
  canvas black (a single-frame present glitch, not chased); (3) a camera step when the selector closes,
  before the choreography starts (not chased).

## 2026-10-01 — Checkpoint C.3: sun occupant without a photo

The seeded self has no photo and an empty name, so the medallion was a flat periwinkle swatch. Now the sun
tile is drawn as a **shaded plate**: theme `surface` token disc, darkened rim (neutral alpha radial ramp),
soft top-left highlight, and the star's glow token as ink — the occupant's initials, or a **person glyph**
(head + shoulders) when there are none (`BodyAtlas.drawInitials(..., plate)`; `BodyInfo.plateInk`). In the
shader the medallion interior is 86% opaque so the emissive star core glows through it, and the warm
rim tint now starts at 30% of the plate radius (was 60%) so the glow wraps further in. A real photo still
replaces the tile. Evidence: `05-sun-occupant-glyph-overview.png`, `06-sun-occupant-glyph-close.png`.
Side observation: one relaunch showed "Couldn't load this System" (transient; Reload System recovered it,
no JS error logged) — likely the force-stop/relaunch racing the DB open; not investigated.
