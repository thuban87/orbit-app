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
