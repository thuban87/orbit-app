/**
 * ADR-077: a finite sun-centered inspection camera is separate from canonical
 * world placement. Pan/zoom never change a person's timestamp angle or rank.
 * Projection is a single invertible tilted plane; billboards stay screen-facing.
 *
 * 38.7-05 (D-03/D-45): Home is one tunable profile {tilt, lensShift, fitRule};
 * the focal distance follows a dolly model (DOLLY_FOCAL_PX / zoom), so a steep
 * tilt reads as depth, not squash. A point at or behind the camera's near plane
 * ("beyond the horizon") is CULLED through the non-throwing primitives
 * `tryProjectWithBasis` / `tryProjectWorldPoint`; no reachable UI-thread path
 * projects through a throwing call.
 */
import type { OrreryContactTarget } from "./orrery-focus-logic";

// ── Tunables (single-number edits; owner device checkpoints) ────────────────
export type HomeFitRule = "strategy" | "whole-disc";
export interface HomeProfile {
  /** Look-down angle from vertical, radians. */
  tilt: number;
  /** Projection-centre height as a fraction of the usable rect (1 = centred). */
  lensShift: number;
  fitRule: HomeFitRule;
}
/**
 * D-03/D-45 Home profiles. "tilted" is Lab C's 62° strategy map (pivot at
 * ~31 % of the usable rect); "flat" is today's top-down whole-disc Home.
 */
export const HOME_PROFILES = {
  tilted: { tilt: (62 * Math.PI) / 180, lensShift: 0.62, fitRule: "strategy" },
  flat: { tilt: 0, lensShift: 1, fitRule: "whole-disc" },
} as const satisfies Record<string, HomeProfile>;
/** THE single D-03 switch (the owner rules on it at the Plan 14 checkpoint). */
export const ACTIVE_HOME_PROFILE: keyof typeof HOME_PROFILES = "tilted";
/** Maximum user (two-finger) tilt; must be ≥ every Home profile tilt. */
export const MAX_USER_TILT = (68 * Math.PI) / 180;
/** Dolly focal length in logical px (Lab C): focal distance = this / zoom. */
export const DOLLY_FOCAL_PX = 720;
/**
 * Near-plane guard: a point whose perspective denominator is at most this
 * fraction of the focal distance (perspective scale ≥ 1 / epsilon) is culled.
 */
export const HORIZON_EPSILON = 0.05;
/** Lens-shift clamp range (1 = centred projection). */
export const MIN_LENS_SHIFT = 0.3;
export const MAX_LENS_SHIFT = 1;
/** Strategy Home: the far rim sits at least this far under the usable top (px). */
export const HOME_STRATEGY_TOP_MARGIN = 24;
/** Strategy Home: max half-width of the System at the pivot, in viewport widths. */
export const HOME_STRATEGY_MAX_HALF_SPAN = 0.6;
/** Strategy Home never dollies in past this zoom (Lab C used MAX_ZOOM). */
export const HOME_STRATEGY_MAX_ZOOM = 4;
/**
 * D-48/D-16: minimum ON-SCREEN body diameters (logical px, Lab C). A body
 * that would project smaller is inflated in the projection itself, so the
 * drawn radius, the hit radius and the label gap all agree.
 */
export const MIN_CONTACT_PX = 18;
export const MIN_SATELLITE_PX = 10;
export const MIN_SUN_PX = 34;
/**
 * D-06 near-side cap (Lab B CLAMP), people and moons only (the sun is the
 * anchor). Perspective may grow a body by at most this fraction above its
 * pivot-depth size; far-side shrink is untouched.
 */
export const NEAR_PERSPECTIVE_KNEE = 0.06;
/** Near-side drawn radius asymptote, as a fraction of the viewport short side. */
export const NEAR_RADIUS_FRACTION = 0.08;
/** Where that cap starts to bend (fraction of the asymptote). */
export const NEAR_RADIUS_KNEE = 0.7;
/**
 * D-04 pan: a drag anchors at the touched ground point only while that point
 * projects with at least this perspective scale (well below the horizon);
 * nearer the horizon the drag falls back to the centre-anchored mapping.
 */
export const PAN_HORIZON_MIN_PERSPECTIVE = 0.4;
/**
 * D-04 pan: one gesture update moves the pivot at most this many screen points
 * at pivot depth (PAN_MAX_STEP_POINTS / zoom world units), so a drag near the
 * far rim or the horizon can never fling the map. Real updates are ~5-30 pt.
 */
export const PAN_MAX_STEP_POINTS = 160;

export interface WorldPoint {
  x: number;
  y: number;
}
/** Relationship identity is never accepted as a contact command capability. */
export interface OrrerySatelliteTarget {
  kind: "satellite";
  uid: string;
  parentId: number;
  parentUid: string;
}
export type CameraPose = {
  x: number;
  y: number;
  zoom: number;
  tilt?: number;
  yaw?: number;
  focalDistance?: number;
  /** Projection-centre height fraction of the usable rect; default 1. */
  lensShift?: number;
};
export interface CameraRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface CameraViewport {
  width: number;
  height: number;
  usable?: CameraRect;
  obstacles?: readonly CameraRect[];
}
export interface WorldBody extends WorldPoint {
  /** 0 identifies self, which has no Profile action. */
  id: number;
  kind: "contact" | "sun" | "satellite";
  satelliteTarget?: OrrerySatelliteTarget;
  radius: number;
  ringRadius: number;
}
export interface ProjectedBody extends WorldBody {
  /** Decorative transition departures must never produce live actions. */
  interactive?: boolean;
  hitRadius: number;
  /**
   * Visible projected ring samples in drawing order. Samples beyond the
   * horizon are omitted: `ringBreaks` lists the indexes that start a new run
   * (pen up before them) and `ringClosed` is true only for a complete ring.
   */
  ringPath: WorldPoint[];
  ringBreaks: number[];
  ringClosed: boolean;
  depth: number;
  /**
   * The world body's own `ringRadius`, copied unchanged (38.7-05, M12). The
   * single source of world ring radii for reorder, the V2 ring drawing and the
   * reorder outline; never recover it as projected `ringRadius / zoom`.
   */
  worldRingRadius: number;
  /** True when the centre is beyond the horizon: radius 0, never tappable. */
  culled: boolean;
  /**
   * D-47: on-screen magnification of the body (zoom × perspective), before
   * the near cap and min-size inflation; 0 when culled. Equals zoom at tilt 0.
   */
  magnification: number;
}
export interface ProjectedFrame {
  generation: number;
  pose: CameraPose;
  viewport: CameraViewport;
  bodies: ProjectedBody[];
  /** The projected world origin; null when it is beyond the horizon. */
  center: WorldPoint | null;
  /**
   * D-47: the semantic-tier input — the median magnification of the visible,
   * interactive contacts (pose.zoom when there are none). At a flat, centred
   * Home it equals pose.zoom, so tiers behave exactly as before 38.7.
   */
  labelMagnification: number;
}
export const IDENTITY_ZOOM = 2;
export const FOCUS_MS = 300;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const MIN_READABLE_RADIUS = 10;
export const MIN_HIT_RADIUS = 22;
const RING_SEGMENTS = 128;
/** Smallest zoom the dolly divides by (zoom is clamped well above it). */
const DOLLY_MIN_ZOOM = 1e-3;
/** Where a culled body is parked: finite and far off every screen. */
const CULLED_POSITION = -1e4;

const ACTIVE_PROFILE: HomeProfile = HOME_PROFILES[ACTIVE_HOME_PROFILE];
/** Home derived from the active profile (zoom 1; deriveHomePose fits zoom). */
export const HOME_CAMERA: CameraPose = {
  x: 0,
  y: 0,
  zoom: 1,
  tilt: ACTIVE_PROFILE.tilt,
  yaw: 0,
  focalDistance: DOLLY_FOCAL_PX,
  lensShift: ACTIVE_PROFILE.lensShift,
};

function clamp(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  "worklet";
  return Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}
/** D-45 dolly: the camera moves toward the pivot as zoom grows. */
export function dollyFocalDistance(zoom: number): number {
  "worklet";
  return (
    DOLLY_FOCAL_PX / Math.max(Number.isFinite(zoom) ? zoom : 1, DOLLY_MIN_ZOOM)
  );
}
function poseFocal(pose: CameraPose): number {
  "worklet";
  return pose.focalDistance ?? dollyFocalDistance(pose.zoom);
}
function poseLensShift(pose: CameraPose): number {
  "worklet";
  return clamp(pose.lensShift ?? 1, MIN_LENS_SHIFT, MAX_LENS_SHIFT, 1);
}
/** Soft knee: identity up to `knee`, tanh-compressed toward `cap` above. */
function softCap(value: number, knee: number, cap: number): number {
  "worklet";
  if (!(value > knee) || cap <= knee) return value;
  const span = cap - knee;
  return knee + span * Math.tanh((value - knee) / span);
}
/**
 * D-48/D-06/D-16: THE size mechanism — the projected radius of a body with
 * world radius `worldRadius` at perspective scale `perspective`.
 * 1. near cap (people and moons): perspective growth above the pivot-depth
 *    size is limited to NEAR_PERSPECTIVE_KNEE and then soft-capped toward
 *    NEAR_RADIUS_FRACTION of the short side (never below the pivot size, so a
 *    zoomed-in focus keeps its magnification);
 * 2. minimum on-screen size by kind.
 * projectFrame, its hit radius and frameBodies all use this one function.
 */
export function projectedBodyRadius(
  kind: WorldBody["kind"],
  worldRadius: number,
  zoom: number,
  perspective: number,
  shortSide: number,
): number {
  "worklet";
  const pivot = worldRadius * zoom;
  // Same operation order as the pre-38.7 radius (r · (zoom · perspective)).
  let radius = worldRadius * (zoom * perspective);
  if (kind !== "sun" && perspective > 1) {
    const grown =
      pivot *
      (1 +
        NEAR_PERSPECTIVE_KNEE *
          Math.tanh((perspective - 1) / NEAR_PERSPECTIVE_KNEE));
    const cap = shortSide * NEAR_RADIUS_FRACTION;
    radius = Math.max(pivot, softCap(grown, cap * NEAR_RADIUS_KNEE, cap));
  }
  const minimum =
    (kind === "sun"
      ? MIN_SUN_PX
      : kind === "satellite"
        ? MIN_SATELLITE_PX
        : MIN_CONTACT_PX) / 2;
  return Math.max(radius, minimum);
}
export function worldExtent(world: readonly WorldBody[]): number {
  "worklet";
  return world.reduce(
    (extent, b) =>
      Math.max(
        extent,
        Math.hypot(b.x, b.y) + b.radius,
        b.ringRadius + b.radius,
      ),
    1,
  );
}
/** Largest axis-aligned unobstructed region; obstacles are measured canvas units.
 * Framing returns null rather than manufacturing geometry from zero measurement.
 */
export function usableCameraRect(viewport: CameraViewport): CameraRect | null {
  "worklet";
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  )
    return null;
  const requested = viewport.usable ?? {
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  };
  if (
    ![requested.x, requested.y, requested.width, requested.height].every(
      Number.isFinite,
    ) ||
    requested.width <= 0 ||
    requested.height <= 0
  )
    return null;
  const x = Math.max(0, requested.x),
    y = Math.max(0, requested.y);
  let regions: CameraRect[] = [
    {
      x,
      y,
      width: Math.min(viewport.width, requested.x + requested.width) - x,
      height: Math.min(viewport.height, requested.y + requested.height) - y,
    },
  ];
  for (const obstacle of viewport.obstacles ?? []) {
    if (
      ![obstacle.x, obstacle.y, obstacle.width, obstacle.height].every(
        Number.isFinite,
      ) ||
      obstacle.width <= 0 ||
      obstacle.height <= 0
    )
      return null;
    const next: CameraRect[] = [];
    for (const r of regions) {
      const left = Math.max(r.x, obstacle.x),
        right = Math.min(r.x + r.width, obstacle.x + obstacle.width);
      const top = Math.max(r.y, obstacle.y),
        bottom = Math.min(r.y + r.height, obstacle.y + obstacle.height);
      if (left >= right || top >= bottom) {
        next.push(r);
        continue;
      }
      next.push(
        { x: r.x, y: r.y, width: left - r.x, height: r.height },
        { x: right, y: r.y, width: r.x + r.width - right, height: r.height },
        { x: r.x, y: r.y, width: r.width, height: top - r.y },
        { x: r.x, y: bottom, width: r.width, height: r.y + r.height - bottom },
      );
    }
    regions = next.filter((r) => r.width > 0 && r.height > 0);
  }
  return (
    regions
      .filter((r) => r.width > 0 && r.height > 0)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null
  );
}
/** The projection centre: the usable rect's centre, its height scaled by lensShift. */
function rectProjectionCenter(rect: CameraRect, lensShift: number): WorldPoint {
  "worklet";
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + (rect.height * lensShift) / 2,
  };
}
function projectionCenter(
  viewport: CameraViewport,
  pose: CameraPose,
): WorldPoint {
  "worklet";
  const rect = usableCameraRect(viewport);
  if (!rect) throw new Error("Invalid Orrery usable camera measurement");
  return rectProjectionCenter(rect, poseLensShift(pose));
}
function cameraPlane(point: WorldPoint, pose: CameraPose): WorldPoint {
  "worklet";
  const yaw = pose.yaw ?? 0,
    c = Math.cos(yaw),
    s = Math.sin(yaw);
  const x = point.x - pose.x,
    y = point.y - pose.y;
  return { x: x * c - y * s, y: x * s + y * c };
}
/** Throws beyond the horizon: only for direct, validated-input use. Reachable
 * paths use the basis primitives below, which cull instead. */
export function perspectiveScale(point: WorldPoint, pose: CameraPose): number {
  "worklet";
  const focal = poseFocal(pose);
  const denominator =
    focal - cameraPlane(point, pose).y * Math.sin(pose.tilt ?? 0);
  if (!Number.isFinite(denominator) || denominator <= 0)
    throw new Error("Point outside finite Orrery camera plane");
  return focal / denominator;
}

function projectionInputValid(
  p: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): boolean {
  "worklet";
  return (
    [
      p.x,
      p.y,
      pose.x,
      pose.y,
      pose.zoom,
      pose.tilt ?? 0,
      pose.yaw ?? 0,
      poseFocal(pose),
      viewport.width,
      viewport.height,
    ].every(Number.isFinite) &&
    pose.zoom > 0 &&
    viewport.width > 0 &&
    viewport.height > 0
  );
}
function assertProjection(
  p: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): void {
  "worklet";
  if (!projectionInputValid(p, pose, viewport))
    throw new Error("Invalid Orrery projection input");
}

export function clampCameraPose(pose: CameraPose, extent: number): CameraPose {
  "worklet";
  const bound = Number.isFinite(extent) ? Math.max(1, extent) : 1;
  const zoom = Number.isFinite(pose.zoom)
    ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pose.zoom))
    : 1;
  return {
    x: Number.isFinite(pose.x) ? Math.max(-bound, Math.min(bound, pose.x)) : 0,
    y: Number.isFinite(pose.y) ? Math.max(-bound, Math.min(bound, pose.y)) : 0,
    zoom,
    tilt: clamp(pose.tilt ?? 0, 0, MAX_USER_TILT, 0),
    yaw: Number.isFinite(pose.yaw ?? 0)
      ? (((pose.yaw ?? 0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      : 0,
    focalDistance: dollyFocalDistance(zoom),
    lensShift: poseLensShift(pose),
  };
}
export const constrainCamera = clampCameraPose;

/**
 * D-52: per-frame projection constants. `projectWorldPoint` used to re-derive
 * the usable rect (obstacle subdivision + sort) and the pose trig for EVERY
 * point, and a frame projects 128 ring points per body. The basis hoists
 * exactly the values that computation used, once, so `projectWithBasis` is
 * bit-for-bit identical (same operations in the same order — pinned by
 * orrery-camera-logic.test). Defined above every caller (Hermes worklet
 * forward-reference hazard).
 */
export interface ProjectionBasis {
  /** Pan and zoom of the validated pose. */
  x: number;
  y: number;
  zoom: number;
  focal: number;
  cosYaw: number;
  sinYaw: number;
  sinTilt: number;
  cosTilt: number;
  center: WorldPoint;
}
export function projectionBasis(
  pose: CameraPose,
  viewport: CameraViewport,
): ProjectionBasis {
  "worklet";
  // The same pose/viewport checks as assertProjection, once per basis.
  assertProjection({ x: 0, y: 0 }, pose, viewport);
  const yaw = pose.yaw ?? 0,
    tilt = pose.tilt ?? 0;
  return {
    x: pose.x,
    y: pose.y,
    zoom: pose.zoom,
    focal: poseFocal(pose),
    cosYaw: Math.cos(yaw),
    sinYaw: Math.sin(yaw),
    sinTilt: Math.sin(tilt),
    cosTilt: Math.cos(tilt),
    center: projectionCenter(viewport, pose),
  };
}
export function projectWithBasis(
  basis: ProjectionBasis,
  px: number,
  py: number,
): WorldPoint {
  "worklet";
  if (!Number.isFinite(px) || !Number.isFinite(py))
    throw new Error("Invalid Orrery projection input");
  // cameraPlane, then perspectiveScale * zoom, in projectWorldPoint's order.
  const x = px - basis.x,
    y = py - basis.y;
  const planeX = x * basis.cosYaw - y * basis.sinYaw,
    planeY = x * basis.sinYaw + y * basis.cosYaw;
  const denominator = basis.focal - planeY * basis.sinTilt;
  if (!Number.isFinite(denominator) || denominator <= 0)
    throw new Error("Point outside finite Orrery camera plane");
  const scale = (basis.focal / denominator) * basis.zoom;
  return {
    x: basis.center.x + planeX * scale,
    y: basis.center.y + planeY * basis.cosTilt * scale,
  };
}
/**
 * H2: the perspective scale (zoom excluded) of a world point, or null when the
 * point is at/beyond the horizon (denominator ≤ HORIZON_EPSILON · focal) or not
 * finite. Same arithmetic as `projectWithBasis`.
 */
export function basisPerspectiveScale(
  basis: ProjectionBasis,
  px: number,
  py: number,
): number | null {
  "worklet";
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  const x = px - basis.x,
    y = py - basis.y;
  const planeY = x * basis.sinYaw + y * basis.cosYaw;
  const denominator = basis.focal - planeY * basis.sinTilt;
  if (
    !Number.isFinite(denominator) ||
    denominator <= HORIZON_EPSILON * basis.focal
  )
    return null;
  return basis.focal / denominator;
}
/** H2: the non-throwing twin of `projectWithBasis`; null beyond the horizon. */
export function tryProjectWithBasis(
  basis: ProjectionBasis,
  px: number,
  py: number,
): WorldPoint | null {
  "worklet";
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  const x = px - basis.x,
    y = py - basis.y;
  const planeX = x * basis.cosYaw - y * basis.sinYaw,
    planeY = x * basis.sinYaw + y * basis.cosYaw;
  const denominator = basis.focal - planeY * basis.sinTilt;
  if (
    !Number.isFinite(denominator) ||
    denominator <= HORIZON_EPSILON * basis.focal
  )
    return null;
  const scale = (basis.focal / denominator) * basis.zoom;
  const result = {
    x: basis.center.x + planeX * scale,
    y: basis.center.y + planeY * basis.cosTilt * scale,
  };
  return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : null;
}
export function projectWorldPoint(
  point: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): WorldPoint {
  "worklet";
  // Point checks first, so error precedence matches the pre-basis version.
  assertProjection(point, pose, viewport);
  return projectWithBasis(projectionBasis(pose, viewport), point.x, point.y);
}
/** H2: never throws; null for invalid input, an unusable viewport, or a point
 * beyond the horizon. */
export function tryProjectWorldPoint(
  point: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): WorldPoint | null {
  "worklet";
  if (
    !projectionInputValid(point, pose, viewport) ||
    !usableCameraRect(viewport)
  )
    return null;
  return tryProjectWithBasis(projectionBasis(pose, viewport), point.x, point.y);
}
// Defined ABOVE its callers on purpose: a Reanimated worklet that references
// another worklet defined LATER in the same module captures it as `undefined`
// on-device (the transform breaks function hoisting), crashing with
// "undefined is not a function" on the UI thread — while Node/vitest, which
// keeps normal hoisting, passes. Phase 29 pinch/recenter crash. Keep every
// worklet helper defined before the worklets that call it.
export function unprojectToWorldPlane(
  point: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): WorldPoint {
  "worklet";
  assertProjection(point, pose, viewport);
  const center = projectionCenter(viewport, pose),
    focal = poseFocal(pose),
    tilt = pose.tilt ?? 0,
    yaw = pose.yaw ?? 0;
  const sx = (point.x - center.x) / pose.zoom,
    sy = (point.y - center.y) / pose.zoom;
  const denominator = focal * Math.cos(tilt) + sy * Math.sin(tilt);
  if (!Number.isFinite(denominator) || denominator <= 0)
    throw new Error("Point outside inverse Orrery camera plane");
  const y = (sy * focal) / denominator,
    x = (sx * (focal - y * Math.sin(tilt))) / focal;
  return {
    x: pose.x + x * Math.cos(yaw) + y * Math.sin(yaw),
    y: pose.y - x * Math.sin(yaw) + y * Math.cos(yaw),
  };
}
/** Gesture samples can lie beyond the ground-plane horizon at legal tilt/zoom. */
export function tryUnprojectToWorldPlane(
  point: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): WorldPoint | null {
  "worklet";
  const rect = usableCameraRect(viewport);
  const focal = poseFocal(pose);
  if (
    !rect ||
    ![
      point.x,
      point.y,
      pose.x,
      pose.y,
      pose.zoom,
      pose.tilt ?? 0,
      pose.yaw ?? 0,
      focal,
    ].every(Number.isFinite) ||
    pose.zoom <= 0 ||
    focal <= 0
  )
    return null;
  const center = rectProjectionCenter(rect, poseLensShift(pose));
  const sy = (point.y - center.y) / pose.zoom;
  const denominator =
    focal * Math.cos(pose.tilt ?? 0) + sy * Math.sin(pose.tilt ?? 0);
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  const result = unprojectToWorldPlane(point, pose, viewport);
  return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : null;
}
/** Preserve the world point under a screen anchor AFTER zoom/axis clamping.
 * If preserving it would leave legal pan bounds, those bounds take precedence.
 */
export function anchorCameraPose(
  start: CameraPose,
  requested: CameraPose,
  screen: WorldPoint,
  viewport: CameraViewport,
  extent: number,
): CameraPose {
  "worklet";
  const next = clampCameraPose(requested, extent);
  // At wide zoom a screen point can be sky, beyond the finite plane's horizon.
  // Such a pinch has no world anchor; zoom about the current camera center.
  const anchor = tryUnprojectToWorldPlane(screen, start, viewport);
  const after = tryUnprojectToWorldPlane(screen, next, viewport);
  if (!anchor || !after) return next;
  return clampCameraPose(
    { ...next, x: next.x + anchor.x - after.x, y: next.y + anchor.y - after.y },
    extent,
  );
}

/** The highest zoom in [low, high] for which `fits` holds (fits(low) assumed). */
function bisectZoom(
  low: number,
  high: number,
  fits: (zoom: number) => boolean,
): number {
  "worklet";
  let lo = low,
    hi = high;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
/**
 * Home enforces readability instead of imposing a maximum member count.
 * "whole-disc" fits the projected outer ring into the usable rect (at tilt 0
 * and lensShift 1 this is exactly the pre-38.7 formula). "strategy" is Lab C's
 * composition: dolly in until the far rim reaches the top margin, without the
 * System's half-width at the pivot passing HOME_STRATEGY_MAX_HALF_SPAN. Both
 * keep the readability floor, so large Systems put outer rings off-screen
 * rather than shrinking bodies to specks.
 */
export function deriveHomePose(
  world: readonly WorldBody[],
  viewport: CameraViewport,
  profile: HomeProfile = ACTIVE_PROFILE,
): CameraPose | null {
  "worklet";
  const usable = usableCameraRect(viewport);
  if (
    !usable ||
    world.some(
      (b) =>
        ![b.x, b.y, b.radius, b.ringRadius].every(Number.isFinite) ||
        b.radius <= 0 ||
        b.ringRadius < 0,
    )
  )
    return null;
  const extent = worldExtent(world);
  const minRadius = world.length
    ? Math.min(...world.map((b) => b.radius))
    : MIN_READABLE_RADIUS;
  const floor = Math.max(MIN_ZOOM, MIN_READABLE_RADIUS / minRadius);
  const home = (zoom: number) => {
    "worklet";
    return clampCameraPose(
      {
        x: 0,
        y: 0,
        zoom,
        tilt: profile.tilt,
        yaw: 0,
        lensShift: profile.lensShift,
      },
      extent,
    );
  };
  const flatFit = Math.min(usable.width, usable.height) / (2 * extent);
  const shape = home(1);
  if (profile.fitRule === "whole-disc") {
    let fit = flatFit;
    if ((shape.tilt ?? 0) !== 0 || shape.lensShift !== 1) {
      const center = rectProjectionCenter(usable, shape.lensShift ?? 1);
      const flat =
        Math.min(
          center.x - usable.x,
          usable.x + usable.width - center.x,
          center.y - usable.y,
          usable.y + usable.height - center.y,
        ) / extent;
      const discFits = (zoom: number) => {
        "worklet";
        const pose = home(zoom);
        const basis = projectionBasis(pose, viewport);
        for (let i = 0; i < RING_SEGMENTS / 2; i++) {
          const angle = (i * 4 * Math.PI) / RING_SEGMENTS;
          const p = tryProjectWithBasis(
            basis,
            extent * Math.sin(angle),
            -extent * Math.cos(angle),
          );
          if (
            !p ||
            p.x < usable.x - 1e-7 ||
            p.x > usable.x + usable.width + 1e-7 ||
            p.y < usable.y - 1e-7 ||
            p.y > usable.y + usable.height + 1e-7
          )
            return false;
        }
        return true;
      };
      fit =
        (shape.tilt ?? 0) === 0
          ? flat
          : discFits(MIN_ZOOM)
            ? bisectZoom(MIN_ZOOM, 1, discFits)
            : MIN_ZOOM;
    }
    return home(Math.min(1, Math.max(floor, fit)));
  }
  const base = home(Math.min(1, Math.max(floor, flatFit)));
  const strategyFits = (zoom: number) => {
    "worklet";
    const pose = home(zoom);
    const basis = projectionBasis(pose, viewport);
    const far = tryProjectWithBasis(basis, 0, -extent);
    const side = tryProjectWithBasis(basis, extent, 0);
    return (
      !!far &&
      !!side &&
      far.y >= usable.y + HOME_STRATEGY_TOP_MARGIN &&
      side.x - basis.center.x <= viewport.width * HOME_STRATEGY_MAX_HALF_SPAN
    );
  };
  if (!strategyFits(base.zoom)) return base;
  return home(
    bisectZoom(
      base.zoom,
      Math.max(base.zoom, Math.min(MAX_ZOOM, HOME_STRATEGY_MAX_ZOOM)),
      strategyFits,
    ),
  );
}

export interface CameraFraming {
  pose: CameraPose;
  fits: boolean;
  usable: CameraRect;
}
/** Arbitrary sets frame their projected circular media AND minimum touch bounds.
 * Infeasible sets still return a bounded recovery pose, with fits:false. A
 * trial pose that puts any selected body beyond the horizon never fits; when
 * no trial pose is safe the result is null (callers keep the previous pose).
 */
export function frameBodies(
  world: readonly WorldBody[],
  viewport: CameraViewport,
  extent: number,
  orientation: CameraPose = HOME_CAMERA,
): CameraFraming | null {
  "worklet";
  const usable = usableCameraRect(viewport);
  if (
    !usable ||
    world.length === 0 ||
    world.some(
      (b) =>
        ![b.x, b.y, b.radius, b.ringRadius].every(Number.isFinite) ||
        b.radius <= 0,
    )
  )
    return null;
  const bound = Math.max(extent, worldExtent(world));
  const center = {
    x: usable.x + usable.width / 2,
    y: usable.y + usable.height / 2,
  };
  const shortSide = Math.min(viewport.width, viewport.height);
  const bounds = (pose: CameraPose) => {
    "worklet";
    const basis = projectionBasis(pose, viewport);
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    for (const body of world) {
      const point = tryProjectWithBasis(basis, body.x, body.y);
      const scale = basisPerspectiveScale(basis, body.x, body.y);
      if (!point || scale === null) return null;
      const radius = Math.max(
        MIN_HIT_RADIUS,
        projectedBodyRadius(
          body.kind,
          body.radius,
          pose.zoom,
          scale,
          shortSide,
        ),
      );
      left = Math.min(left, point.x - radius);
      right = Math.max(right, point.x + radius);
      top = Math.min(top, point.y - radius);
      bottom = Math.max(bottom, point.y + radius);
    }
    return { left, right, top, bottom };
  };
  const candidate = (zoom: number): CameraFraming | null => {
    "worklet";
    let pose = clampCameraPose(
      {
        ...orientation,
        zoom,
        x:
          (Math.min(...world.map((b) => b.x)) +
            Math.max(...world.map((b) => b.x))) /
          2,
        y:
          (Math.min(...world.map((b) => b.y)) +
            Math.max(...world.map((b) => b.y))) /
          2,
      },
      bound,
    );
    // Correct perspective/asymmetric media bounds, rather than averaging bodies.
    // The usable centre need not be the (lens-shifted) projection centre, so
    // the pivot moves by the world offset between the two screen points.
    for (let iteration = 0; iteration < 32; iteration++) {
      const b = bounds(pose);
      if (!b) return null;
      const mid = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
      if (Math.hypot(mid.x - center.x, mid.y - center.y) < 1e-8) break;
      const target = tryUnprojectToWorldPlane(mid, pose, viewport);
      const here = tryUnprojectToWorldPlane(center, pose, viewport);
      if (!target || !here) return null;
      pose = clampCameraPose(
        {
          ...pose,
          x: pose.x + target.x - here.x,
          y: pose.y + target.y - here.y,
        },
        bound,
      );
    }
    const b = bounds(pose);
    if (!b) return null;
    return {
      pose,
      fits:
        b.left >= usable.x - 1e-7 &&
        b.right <= usable.x + usable.width + 1e-7 &&
        b.top >= usable.y - 1e-7 &&
        b.bottom <= usable.y + usable.height + 1e-7,
      usable,
    };
  };
  let low = MIN_ZOOM,
    high = MAX_ZOOM,
    result = candidate(low);
  if (!result?.fits) return result;
  const maximum = candidate(high);
  if (maximum?.fits) return maximum;
  for (let i = 0; i < 36; i++) {
    const mid = (low + high) / 2,
      next = candidate(mid);
    if (next?.fits) {
      low = mid;
      result = next;
    } else high = mid;
  }
  return result;
}

/** Anything with Skia-path-like pen commands (also a Node test sink). */
export interface RingPathSink {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  close(): unknown;
}
/**
 * H2: trace a projected ring's visible samples. A gap (samples beyond the
 * horizon) lifts the pen and an incomplete ring is never closed, so no segment
 * is ever drawn across the horizon.
 */
export function traceRingPath(
  sink: RingPathSink,
  ring: Pick<ProjectedBody, "ringPath" | "ringBreaks" | "ringClosed">,
): void {
  "worklet";
  const points = ring.ringPath;
  if (!points.length) return;
  const breaks = ring.ringBreaks ?? [];
  let next = 0;
  for (let i = 0; i < points.length; i++) {
    if (i === 0) sink.moveTo(points[i].x, points[i].y);
    else if (next < breaks.length && breaks[next] === i) {
      next++;
      sink.moveTo(points[i].x, points[i].y);
    } else sink.lineTo(points[i].x, points[i].y);
  }
  if (ring.ringClosed && breaks.length === 0) sink.close();
}
/**
 * `options.ringPaths` (default true): when false every `ringPath` is empty and
 * all other body data is identical. Today's renderer keeps the 128-point ring
 * polygons; the V2 renderer (Plan 06) draws rings from world geometry.
 * `options.extent`: the camera (pan) extent the pose was clamped to; the pan
 * bound is the larger of it and the world's own extent.
 */
export function projectFrame(
  world: readonly WorldBody[],
  pose: CameraPose,
  viewport: CameraViewport,
  generation: number,
  options?: { ringPaths?: boolean; extent?: number },
): ProjectedFrame {
  "worklet";
  const ringPaths = options?.ringPaths ?? true;
  const extent = options?.extent;
  const current = clampCameraPose(
    pose,
    Math.max(
      worldExtent(world),
      extent !== undefined && Number.isFinite(extent) ? extent : 0,
    ),
  );
  // D-52: one basis per frame for the centre, every body and every ring point.
  const basis = projectionBasis(current, viewport);
  const shortSide = Math.min(viewport.width, viewport.height);
  const bodies = world.map((body): ProjectedBody => {
    let ringPath: WorldPoint[] = [];
    const ringBreaks: number[] = [];
    let ringClosed = false;
    if (ringPaths && body.ringRadius > 0) {
      const samples: (WorldPoint | null)[] = [];
      let firstGap = -1;
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const angle = (i * 2 * Math.PI) / RING_SEGMENTS;
        const sample = tryProjectWithBasis(
          basis,
          body.ringRadius * Math.sin(angle),
          -body.ringRadius * Math.cos(angle),
        );
        samples.push(sample);
        if (!sample && firstGap < 0) firstGap = i;
      }
      if (firstGap < 0) {
        // Every sample is present: the sample list IS the closed ring.
        ringPath = samples as WorldPoint[];
        ringClosed = true;
      } else {
        // Start right after a gap so the visible arc is one run in order.
        let penDown = false;
        for (let k = 1; k <= RING_SEGMENTS; k++) {
          const sample = samples[(firstGap + k) % RING_SEGMENTS];
          if (!sample) {
            penDown = false;
            continue;
          }
          if (!penDown && ringPath.length) ringBreaks.push(ringPath.length);
          ringPath.push(sample);
          penDown = true;
        }
      }
    }
    const depth = cameraPlane(body, current).y * Math.sin(current.tilt ?? 0);
    const point = tryProjectWithBasis(basis, body.x, body.y);
    const perspective = basisPerspectiveScale(basis, body.x, body.y);
    if (!point || perspective === null)
      return {
        ...body,
        x: CULLED_POSITION,
        y: CULLED_POSITION,
        radius: 0,
        ringRadius: body.ringRadius * current.zoom,
        worldRingRadius: body.ringRadius,
        hitRadius: 0,
        interactive: false,
        culled: true,
        ringPath,
        ringBreaks,
        ringClosed,
        depth,
        magnification: 0,
      };
    // D-48: one size mechanism; the hit radius derives from the SAME radius.
    const radius = projectedBodyRadius(
      body.kind,
      body.radius,
      current.zoom,
      perspective,
      shortSide,
    );
    return {
      ...body,
      ...point,
      radius,
      ringRadius: body.ringRadius * current.zoom,
      worldRingRadius: body.ringRadius,
      hitRadius: Math.max(MIN_HIT_RADIUS, radius),
      culled: false,
      ringPath,
      ringBreaks,
      ringClosed,
      depth,
      magnification: current.zoom * perspective,
    };
  });
  // D-47: median magnification of the on-screen, interactive contacts.
  const magnifications: number[] = [];
  for (const body of bodies) {
    const reach = body.radius * 1.3;
    if (
      body.kind === "contact" &&
      !body.culled &&
      body.interactive !== false &&
      body.x + reach >= 0 &&
      body.y + reach >= 0 &&
      body.x - reach <= viewport.width &&
      body.y - reach <= viewport.height
    )
      magnifications.push(body.magnification);
  }
  magnifications.sort((a, b) => a - b);
  return {
    generation,
    pose: current,
    viewport,
    center: tryProjectWithBasis(basis, 0, 0),
    bodies,
    labelMagnification: magnifications.length
      ? magnifications[Math.floor(magnifications.length / 2)]
      : current.zoom,
  };
}
export function collectHitCandidates(
  frame: ProjectedFrame,
  x: number,
  y: number,
): number[] {
  "worklet";
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x > frame.viewport.width ||
    y > frame.viewport.height
  )
    return [];
  return frame.bodies
    .filter(
      (body) =>
        body.id > 0 &&
        body.interactive !== false &&
        (x - body.x) ** 2 + (y - body.y) ** 2 <= body.hitRadius ** 2,
    )
    .map((body) => body.id);
}
export interface OrreryIntent {
  kind: "none" | "clear" | "focus" | "profile" | "group" | "satellite";
  satelliteTarget?: OrrerySatelliteTarget;
  ids: number[];
  generation: number;
  targets?: OrreryContactTarget[];
}
export function tapIntent(
  frame: ProjectedFrame,
  x: number,
  y: number,
  success: boolean,
): OrreryIntent {
  "worklet";
  const ids = success ? collectHitCandidates(frame, x, y) : [];
  return {
    generation: frame.generation,
    ids,
    kind: !success
      ? "none"
      : ids.length === 0
        ? "clear"
        : ids.length > 1
          ? "group"
          : // D-60: a body tap never opens Profile (only the focus card does).
            "focus",
  };
}

/** Structural cells allow the exact UI callbacks to run in the Node tracer. */
export interface CameraCell<T> {
  value: T;
}
/**
 * D-04: one-finger pan. With `from` (the finger's screen position before this
 * update) the drag is anchored at the touched ground point: that world point
 * stays under the finger, exactly, while it projects with at least
 * PAN_HORIZON_MIN_PERSPECTIVE. Near or above the horizon, or without `from`
 * (coast), it falls back to the pre-38.7 centre-anchored mapping. Either way
 * one update moves the pivot at most PAN_MAX_STEP_POINTS (pivot-depth points).
 */
export function panCamera(
  start: CameraPose,
  dx: number,
  dy: number,
  extent: number,
  viewport?: CameraViewport,
  from?: WorldPoint,
): CameraPose {
  "worklet";
  if (!Number.isFinite(dx) || !Number.isFinite(dy))
    return clampCameraPose(start, extent);
  if (viewport) {
    let deltaX = 0,
      deltaY = 0,
      anchored = false;
    if (from && Number.isFinite(from.x) && Number.isFinite(from.y)) {
      const grabbed = tryUnprojectToWorldPlane(from, start, viewport);
      const target = tryUnprojectToWorldPlane(
        { x: from.x + dx, y: from.y + dy },
        start,
        viewport,
      );
      if (grabbed && target) {
        const basis = projectionBasis(start, viewport);
        const grabbedScale = basisPerspectiveScale(basis, grabbed.x, grabbed.y);
        const targetScale = basisPerspectiveScale(basis, target.x, target.y);
        if (
          grabbedScale !== null &&
          targetScale !== null &&
          grabbedScale >= PAN_HORIZON_MIN_PERSPECTIVE &&
          targetScale >= PAN_HORIZON_MIN_PERSPECTIVE
        ) {
          // A pivot translation translates every unprojection equally, so
          // moving the pivot by (grabbed − target) puts `grabbed` under the
          // finger's new position.
          deltaX = grabbed.x - target.x;
          deltaY = grabbed.y - target.y;
          anchored = true;
        }
      }
    }
    if (!anchored) {
      const center = projectionCenter(viewport, start);
      const focal = poseFocal(start),
        tilt = start.tilt ?? 0;
      const reach = 2 * Math.SQRT2 * Math.max(1, extent);
      const minY =
        (-reach * Math.cos(tilt) * focal) / (focal + reach * Math.sin(tilt));
      // Under the dolly the near reach can lie behind the camera; the near side
      // of the inverse is then unbounded (it never crosses the horizon).
      const nearDenominator = focal - reach * Math.sin(tilt);
      const maxY =
        nearDenominator > 0
          ? (reach * Math.cos(tilt) * focal) / nearDenominator
          : Number.POSITIVE_INFINITY;
      // Restrict gesture sampling to the reachable plane before inverse math;
      // projection itself is never patched with a denominator clamp.
      const sampleY = clamp(-dy / start.zoom, minY, maxY, 0);
      const anchor = tryUnprojectToWorldPlane(
        { x: center.x - dx, y: center.y + sampleY * start.zoom },
        start,
        viewport,
      );
      if (!anchor) return clampCameraPose(start, extent);
      deltaX = anchor.x - start.x;
      deltaY = anchor.y - start.y;
    }
    const step = Math.hypot(deltaX, deltaY);
    const maxStep = PAN_MAX_STEP_POINTS / start.zoom;
    if (step > maxStep) {
      deltaX *= maxStep / step;
      deltaY *= maxStep / step;
    }
    return clampCameraPose(
      { ...start, x: start.x + deltaX, y: start.y + deltaY },
      extent,
    );
  }
  return constrainCamera(
    { ...start, x: start.x - dx / start.zoom, y: start.y - dy / start.zoom },
    extent,
  );
}
