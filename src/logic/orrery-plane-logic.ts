/**
 * 38.7-06 (D-44): the world plane under the camera's exact homography.
 *
 * Tilted orbit rings are never stroked under a perspective transform (a Mali
 * GPU cliff, DEAD-ENDS). Instead the V2 renderer draws each ring in WORLD space
 * under `planeHomography`, which maps a world point to exactly what
 * `projectWithBasis` returns for the same clamped pose (centre with lens shift,
 * yaw, tilt, dolly focal and zoom), so drawn == tappable. Stroke widths stay in
 * screen dp through the SkSL Jacobian (`v2/shaders.ts`).
 *
 * The homography is row-major, in Skia's 3×3 order:
 * [scaleX, skewX, transX, skewY, scaleY, transY, persp0, persp1, persp2].
 * Its third row is the camera depth normalised by the focal distance:
 * w = (focal − planeY · sin(tilt)) / focal, so `w ≤ HORIZON_EPSILON` is exactly
 * the near-plane cull of `tryProjectWithBasis` ("beyond the horizon").
 *
 * Every helper is a worklet defined above its callers (Hermes forward-ref rule).
 */
import {
  type CameraPose,
  type CameraViewport,
  HORIZON_EPSILON,
  projectionBasis,
  type WorldPoint,
} from "./orrery-camera-logic";

// ── Tunables (single-number edits; owner device checkpoints) ────────────────
/**
 * Ring density fade (Lab C): when neighbouring orbits sit closer than this on
 * screen, the rings thin out so the bodies, not a moiré of lines, carry the
 * overview.
 */
export const RING_MIN_SPACING_PX = 20;
/** The faintest a packed ring fades to (fraction of its normal alpha). */
export const RING_DENSITY_FLOOR = 0.15;
/** A ring whose final alpha is below this is not drawn at all. */
export const RING_SKIP_ALPHA = 0.01;

/** A row-major 3×3 homography (see the header for the element order). */
export type Homography = readonly number[];

/**
 * The world-plane → screen homography of `projectWithBasis` for `pose` and
 * `viewport`. Uses the same basis (clamped lens shift, dolly focal, usable-rect
 * centre), so it can only throw where `projectFrame` itself would have thrown
 * (an invalid pose or viewport), never at the horizon.
 */
export function planeHomography(
  pose: CameraPose,
  viewport: CameraViewport,
): number[] {
  "worklet";
  const basis = projectionBasis(pose, viewport);
  const c = basis.cosYaw,
    s = basis.sinYaw;
  const k = basis.sinTilt / basis.focal;
  const z = basis.zoom,
    ct = basis.cosTilt;
  const cx = basis.center.x,
    cy = basis.center.y;
  // planeX = c·x − s·y − a0, planeY = s·x + c·y − b0 (pivot-relative).
  const a0 = c * basis.x - s * basis.y;
  const b0 = s * basis.x + c * basis.y;
  // w = 1 − k·planeY; screen = centre + z·(planeX, planeY·cos tilt) / w.
  const w0 = 1 + k * b0;
  return [
    z * c - cx * k * s,
    -z * s - cx * k * c,
    -z * a0 + cx * w0,
    z * ct * s - cy * k * s,
    z * ct * c - cy * k * c,
    -z * ct * b0 + cy * w0,
    -k * s,
    -k * c,
    w0,
  ];
}

/** Inverse of a 3×3 (adjugate / determinant); null when it is singular. */
export function invertHomography(m: Homography): number[] | null {
  "worklet";
  const a = m[0],
    b = m[1],
    c = m[2],
    d = m[3],
    e = m[4],
    f = m[5],
    g = m[6],
    h = m[7],
    i = m[8];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  return [
    A * inv,
    -(b * i - c * h) * inv,
    (b * f - c * e) * inv,
    B * inv,
    (a * i - c * g) * inv,
    -(a * f - c * d) * inv,
    C * inv,
    -(a * h - b * g) * inv,
    (a * e - b * d) * inv,
  ];
}

/** The homogeneous depth `w` of a world point (≤ HORIZON_EPSILON = culled). */
export function homographyDepth(h: Homography, x: number, y: number): number {
  "worklet";
  return h[6] * x + h[7] * y + h[8];
}

/** Map a point through `h`; null at or beyond the horizon (near-plane cull). */
export function applyHomography(
  h: Homography,
  x: number,
  y: number,
): WorldPoint | null {
  "worklet";
  const w = homographyDepth(h, x, y);
  if (!Number.isFinite(w) || w <= HORIZON_EPSILON) return null;
  const px = (h[0] * x + h[1] * y + h[2]) / w;
  const py = (h[3] * x + h[4] * y + h[5]) / w;
  return Number.isFinite(px) && Number.isFinite(py) ? { x: px, y: py } : null;
}

/**
 * The screen y of the plane's vanishing line (the image of the line at
 * infinity): the far side of the plane converges to it and the inverse
 * projection's denominator vanishes on it. −Infinity at tilt 0 (no horizon).
 */
export function horizonScreenY(
  pose: CameraPose,
  viewport: CameraViewport,
): number {
  "worklet";
  const basis = projectionBasis(pose, viewport);
  if (basis.sinTilt <= 0) return Number.NEGATIVE_INFINITY;
  return (
    basis.center.y - (basis.focal * basis.zoom * basis.cosTilt) / basis.sinTilt
  );
}

/**
 * True when the whole disc of radius `radius` about the world origin is at or
 * beyond the horizon, so nothing of a ring (or its annulus strip) can show.
 */
export function discBeyondHorizon(h: Homography, radius: number): boolean {
  "worklet";
  return h[8] + Math.abs(radius) * Math.hypot(h[6], h[7]) <= HORIZON_EPSILON;
}

/** Samples used for the radial-scale and perimeter estimates. */
const RING_PROBE_SAMPLES = 8;
const RING_PERIMETER_SAMPLES = 32;

/**
 * The smallest screen-dp-per-world-unit RADIAL scale of the projection on the
 * ring of radius `radius` (sampled; only samples in front of the horizon), or
 * 0 when no sample is in front. The ring's annulus strip must be at least
 * (stroke half-width + AA) / this wide in world units.
 */
export function minRadialScale(h: Homography, radius: number): number {
  "worklet";
  let low = Number.POSITIVE_INFINITY;
  for (let i = 0; i < RING_PROBE_SAMPLES; i++) {
    const a = (i * 2 * Math.PI) / RING_PROBE_SAMPLES;
    const dx = Math.sin(a),
      dy = -Math.cos(a);
    const px = radius * dx,
      py = radius * dy;
    const w = homographyDepth(h, px, py);
    if (!(w > HORIZON_EPSILON)) continue;
    const sx = (h[0] * px + h[1] * py + h[2]) / w;
    const sy = (h[3] * px + h[4] * py + h[5]) / w;
    const hd = h[6] * dx + h[7] * dy;
    const jx = (h[0] * dx + h[1] * dy - sx * hd) / w;
    const jy = (h[3] * dx + h[4] * dy - sy * hd) / w;
    low = Math.min(low, Math.hypot(jx, jy));
  }
  return Number.isFinite(low) ? low : 0;
}

/**
 * The on-screen length (dp) of the visible part of the ring of radius
 * `radius`: a 32-gon, counting only segments whose ends are both in front of
 * the horizon. Drives the dash count, so dashes keep today's screen period.
 */
export function ringScreenPerimeter(h: Homography, radius: number): number {
  "worklet";
  let total = 0;
  let previous: WorldPoint | null = null;
  for (let i = 0; i <= RING_PERIMETER_SAMPLES; i++) {
    const a = (i * 2 * Math.PI) / RING_PERIMETER_SAMPLES;
    const p = applyHomography(h, radius * Math.sin(a), -radius * Math.cos(a));
    if (p && previous) total += Math.hypot(p.x - previous.x, p.y - previous.y);
    previous = p;
  }
  return total;
}

/**
 * Average on-screen spacing between neighbouring orbits (Lab C): the outer
 * ring radius over the ring count, at the camera zoom.
 */
export function ringScreenSpacing(
  extent: number,
  ringCount: number,
  zoom: number,
): number {
  "worklet";
  const spacing =
    (Math.max(1, Number.isFinite(extent) ? extent : 1) /
      Math.max(1, Number.isFinite(ringCount) ? ringCount : 1)) *
    (Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
  return spacing;
}

/**
 * Ring density fade (Lab C squared ramp): 1 at or above RING_MIN_SPACING_PX,
 * falling with the square of the spacing ratio to RING_DENSITY_FLOOR.
 */
export function ringDensityFade(spacingPx: number): number {
  "worklet";
  if (!Number.isFinite(spacingPx)) return 1;
  const ramp = Math.max(0, Math.min(1, spacingPx / RING_MIN_SPACING_PX));
  return Math.max(RING_DENSITY_FLOOR, ramp * ramp);
}
