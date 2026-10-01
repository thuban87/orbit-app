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
