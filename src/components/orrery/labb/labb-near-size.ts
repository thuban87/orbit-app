/**
 * ORRERY LAB B — R3 near-body size clamp (flag `nearSizeClamp`).
 *
 * With the R2 Home tilt the orbital plane recedes, and at detail zoom the body
 * nearest the camera grows into a disc that can sit under the FAB column
 * (R2-REPORT §6.6). Two soft limits on the PROJECTED radius, applied to the
 * frame itself (so the bodies picture, label gaps, hit radii, focus reticle
 * and card keep-out all read the same number):
 *
 * 1. Perspective size knee: positions keep the full perspective (the plane
 *    still recedes), but a body's SIZE grows by at most `NEAR_PERSPECTIVE_KNEE`
 *    from perspective — the "map billboard" rule of strategy-game star maps.
 *    Far-side shrink (perspective < 1) is untouched.
 * 2. Viewport cap: the drawn radius approaches `NEAR_RADIUS_FRACTION` of the
 *    viewport's short side through a tanh knee, so no contact can fill the
 *    screen at the deepest zoom. The sun is exempt (it is the scene's anchor).
 *
 * Hit radius keeps the product floor (`MIN_HIT_RADIUS`), so small bodies stay
 * as tappable as before. Positions, depth and the model are unchanged.
 * COMPROMISES C-71.
 *
 * Worklet-safe and pure (tested in `labb-near-size.test.ts`). Helpers are
 * defined above their callers (Hermes worklet ordering).
 */
import {
  MIN_HIT_RADIUS,
  type ProjectedFrame,
} from "@/logic/orrery-camera-logic";

/** Max size growth from perspective (0.06 = a near body is ≤ 6 % larger). */
export const NEAR_PERSPECTIVE_KNEE = 0.06;
/** Drawn radius asymptote, as a fraction of the viewport's short side. */
export const NEAR_RADIUS_FRACTION = 0.08;
/** Where the viewport cap starts to bend (fraction of the asymptote). */
export const NEAR_RADIUS_KNEE = 0.7;

/** Soft knee: identity below `knee`, tanh-compressed toward `cap` above. */
export function labSoftCap(value: number, knee: number, cap: number): number {
  "worklet";
  if (!(value > knee) || cap <= knee) return value;
  const span = cap - knee;
  return knee + span * Math.tanh((value - knee) / span);
}

/** Size multiplier that limits perspective growth to the knee. */
export function labNearPerspectiveScale(depth: number, focal: number): number {
  "worklet";
  const denominator = focal - depth;
  if (!(denominator > 0) || !Number.isFinite(focal)) return 1;
  const p = focal / denominator;
  if (!(p > 1)) return 1;
  const k = NEAR_PERSPECTIVE_KNEE;
  return (1 + k * Math.tanh((p - 1) / k)) / p;
}

/** The frame with near-body sizes clamped; the same object when nothing changes. */
export function labClampNearSizes<F extends ProjectedFrame>(
  frame: F,
  on: boolean,
): F {
  "worklet";
  if (!on) return frame;
  const focal = frame.pose.focalDistance ?? 256;
  const short = Math.min(frame.viewport.width, frame.viewport.height);
  const cap = short * NEAR_RADIUS_FRACTION;
  const knee = cap * NEAR_RADIUS_KNEE;
  let changed = false;
  const bodies = frame.bodies.map((body) => {
    if (body.kind === "sun") return body;
    const scaled = body.radius * labNearPerspectiveScale(body.depth, focal);
    const radius = labSoftCap(scaled, knee, cap);
    if (radius === body.radius) return body;
    changed = true;
    return { ...body, radius, hitRadius: Math.max(MIN_HIT_RADIUS, radius) };
  });
  return changed ? ({ ...frame, bodies } as F) : frame;
}
