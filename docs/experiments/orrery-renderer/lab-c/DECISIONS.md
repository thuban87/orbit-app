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
