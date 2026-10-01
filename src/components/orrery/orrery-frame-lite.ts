/**
 * ORRERY LAB C — the published AnimatedFrame WITHOUT the 128-point ring paths.
 *
 * `projectFrame` (orrery-camera-logic) builds `ringPath` (128 projected points
 * per body, each re-deriving `usableCameraRect`) for the Skia ring/reorder-ghost
 * draws. The 3D renderer draws rings on the GPU and never reads `ringPath`, and
 * no hit/label/focus/reorder consumer reads it either (only OrreryWorld's
 * ReorderGhost and ProjectedOrbitRing do). At 200 bodies that per-frame work
 * (~25k projections) dominated the UI thread on the Pixel 6 Pro.
 *
 * Same math as `projectAnimatedFrame(…, from = to, fraction 1)`: identical
 * clamp, projection centre, perspective scale, hit radius, depth and culling;
 * parity is pinned by `orrery-frame-lite.test.ts`. Helpers are defined ABOVE
 * their callers (Hermes worklet forward-reference rule).
 */
import {
  type CameraPose,
  type CameraViewport,
  clampCameraPose,
  MAX_TILT,
  MIN_HIT_RADIUS,
  perspectiveScale,
  cameraCenterRect,
  type WorldBody,
  worldExtent,
} from "@/logic/orrery-camera-logic";
import type { AnimatedFrame, AnimatedWorldBody } from "@/logic/orrery-frame";

/** Mirrors orrery-camera-logic's private MAX_DEPTH_FRACTION. */
const MAX_DEPTH_FRACTION = 0.45;
/** Lab C: bodies closer than this fraction of the dolly distance are culled. */
const NEAR_CULL_FRACTION = 0.12;

export function projectAnimatedFrameLite(
  world: readonly AnimatedWorldBody[],
  pose: CameraPose,
  viewport: CameraViewport,
  generation: number,
): AnimatedFrame {
  "worklet";
  const current = clampCameraPose(
    pose,
    Math.max(
      worldExtent(world as readonly WorldBody[]),
      ((pose.focalDistance ?? 0) * MAX_DEPTH_FRACTION) /
        ((1 + Math.SQRT2) * Math.sin(MAX_TILT)),
    ),
  );
  const rect = cameraCenterRect(viewport);
  if (!rect) throw new Error("Invalid Orrery usable camera measurement");
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const yaw = current.yaw ?? 0;
  const tilt = current.tilt ?? 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const zoom = current.zoom;
  const focal = current.focalDistance ?? 1;
  const centerScale = perspectiveScale({ x: 0, y: 0 }, current) * zoom;
  const ox = -current.x;
  const oy = -current.y;
  const center = {
    x: cx + (ox * c - oy * s) * centerScale,
    y: cy + (ox * s + oy * c) * cosT * centerScale,
  };
  const bodies: AnimatedFrame["bodies"] = [];
  for (let i = 0; i < world.length; i++) {
    const body = world[i];
    const dx = body.x - current.x;
    const dy = body.y - current.y;
    const px = dx * c - dy * s;
    const py = dx * s + dy * c;
    const scale = zoom * perspectiveScale(body, current);
    // Lab C true-3D: bodies at/behind the near plane are culled (not tappable).
    const inFront =
      focal - py * sinT > focal * NEAR_CULL_FRACTION + body.radius;
    const x = cx + px * scale;
    const y = cy + py * cosT * scale;
    const radius = body.radius * scale;
    const reach = radius * (body.kind === "sun" ? 2 : 1.3);
    const opacity = inFront ? body.opacity : 0;
    bodies.push({
      ...body,
      x,
      y,
      radius,
      ringRadius: body.ringRadius * zoom,
      hitRadius: Math.max(MIN_HIT_RADIUS, radius),
      ringPath: [],
      depth: py * sinT,
      opacity,
      interactive: body.interactive && opacity > 0,
      visible:
        opacity > 0 &&
        x + reach >= 0 &&
        y + reach >= 0 &&
        x - reach <= viewport.width &&
        y - reach <= viewport.height,
    });
  }
  return { generation, pose: current, viewport, center, bodies };
}
