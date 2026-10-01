/**
 * ADR-077: a finite sun-centered inspection camera is separate from canonical
 * world placement. Pan/zoom never change a person's timestamp angle or rank.
 * Projection is a single invertible tilted plane; billboards stay screen-facing.
 */
import type { OrreryContactTarget } from "./orrery-focus-logic";
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
  /**
   * Lab C: the rect whose centre is the PROJECTION centre (where the camera
   * pivot lands on screen). Lets the 3D camera centre the system in the whole
   * canvas between the header and tab bar while side controls and cards still
   * remain label/framing obstacles. Defaults to the usable rect.
   */
  camera?: CameraRect;
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
  ringPath: WorldPoint[];
  depth: number;
}
export interface ProjectedFrame {
  generation: number;
  pose: CameraPose;
  viewport: CameraViewport;
  bodies: ProjectedBody[];
  center: WorldPoint;
}
/**
 * ORRERY LAB C — TRUE 3D camera model (supersedes the 2.5D pinhole parity).
 * A real perspective camera: fixed focal length LAB_FOCAL_PX (logical px, i.e.
 * a fixed ~50° vertical FOV on a phone) dollied to distance F / zoom from the
 * pivot, so "zoom" is a DOLLY, not a telephoto narrowing. The projection math
 * below is unchanged (it always was a true pinhole); only the focal distance
 * is now short, which makes near bodies visibly bigger than far ones.
 */
export const LAB_FOCAL_PX = 720;
/** Default look-down angle from vertical (~62°): the system recedes into depth. */
export const LAB_HOME_TILT = 1.08;
export function labFocalDistance(zoom: number): number {
  "worklet";
  return LAB_FOCAL_PX / Math.max(1e-3, zoom);
}
export const HOME_CAMERA: CameraPose = {
  x: 0,
  y: 0,
  zoom: 1,
  tilt: LAB_HOME_TILT,
  yaw: 0,
  focalDistance: 256,
};
export const IDENTITY_ZOOM = 2;
/** Lab C home framing: far rim margin under the camera rect top (px) and the
 * max half-width of the system at the pivot depth, in viewport widths. */
export const LAB_HOME_TOP_MARGIN = 24;
export const LAB_HOME_MAX_HALF_SPAN = 0.6;
/**
 * Lab C (Checkpoint C.5): Systems with more contacts than this get a WHOLE-DISC
 * Home — lower tilt and a dolly-out until every rim point projects inside the
 * usable rect (between the header controls and the tab bar). Smaller Systems
 * keep the strategy-map composition (far rim at the top, near rim may run off).
 * This deliberately lets Home go below the production readability floor
 * (MIN_READABLE_RADIUS) for large Systems — lab-only, flagged for the owner.
 */
/** DEAD END (C.5, see DEAD-ENDS.md): disabled — whole-disc fit destroys legibility at 120 contacts. */
export const LAB_FIT_ALL_ENABLED = false;
export const LAB_FIT_ALL_MIN_CONTACTS = 24;
export const LAB_FIT_ALL_TILT = 0.9;
export const LAB_FIT_ALL_MARGIN = 12;
/**
 * Lab C (Checkpoint D.1): dense Systems frame their POPULATED CORE — the disc
 * holding LAB_CORE_FRACTION of the contacts — instead of the readability floor
 * (which showed ~30 of 121) or the outer ring (whole-disc fit: dead end, see
 * DEAD-ENDS.md). Legibility at that distance comes from the renderer's
 * minimum on-screen body size (OrreryWorld3D MIN_BODY_PX), not from zoom.
 */
export const LAB_CORE_MIN_CONTACTS = 24;
export const LAB_CORE_FRACTION = 0.5;
export const LAB_CORE_TILT = 0.85;
export const LAB_CORE_MARGIN = 20;
/** Radius (world) holding `fraction` of the contacts, plus their body radius. */
export function coreRadius(
  world: readonly WorldBody[],
  fraction: number,
): number {
  "worklet";
  const d: number[] = [];
  let r = 0;
  for (const b of world)
    if (b.kind === "contact") {
      d.push(Math.hypot(b.x, b.y));
      r = Math.max(r, b.radius);
    }
  if (!d.length) return 1;
  d.sort((a, b) => a - b);
  const k = Math.min(d.length - 1, Math.max(0, Math.ceil(d.length * fraction) - 1));
  return Math.max(1, d[k] + r);
}
export const FOCUS_MS = 300;
export const MIN_ZOOM = 0.08;
export const MAX_ZOOM = 4;
export const MAX_TILT = 1.32;
export const MIN_READABLE_RADIUS = 10;
export const MIN_HIT_RADIUS = 22;
const MIN_FOCAL_DISTANCE = 256;
const MAX_DEPTH_FRACTION = 0.45;
const RING_SEGMENTS = 128;

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
/** Includes square pan bounds plus radial world extent at maximum legal tilt. */
export function deriveFocalDistance(extent: number): number {
  "worklet";
  return Math.max(
    MIN_FOCAL_DISTANCE,
    ((1 + Math.SQRT2) *
      Math.max(1, Number.isFinite(extent) ? extent : 1) *
      Math.sin(MAX_TILT)) /
      MAX_DEPTH_FRACTION,
  );
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
/** Lab C: projection-centre rect (explicit `camera` rect, else usable rect). */
export function cameraCenterRect(viewport: CameraViewport): CameraRect | null {
  "worklet";
  const usable = usableCameraRect(viewport);
  const camera = viewport.camera;
  if (
    !usable ||
    !camera ||
    ![camera.x, camera.y, camera.width, camera.height].every(Number.isFinite) ||
    camera.width <= 0 ||
    camera.height <= 0
  )
    return usable;
  return camera;
}
function projectionCenter(viewport: CameraViewport): WorldPoint {
  "worklet";
  const rect = cameraCenterRect(viewport);
  if (!rect) throw new Error("Invalid Orrery usable camera measurement");
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
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
export function perspectiveScale(point: WorldPoint, pose: CameraPose): number {
  "worklet";
  const focal = pose.focalDistance ?? MIN_FOCAL_DISTANCE;
  const denominator =
    focal - cameraPlane(point, pose).y * Math.sin(pose.tilt ?? 0);
  if (!Number.isFinite(denominator)) return 1;
  // Lab C: points at/behind the camera get a huge-but-finite scale; frame
  // consumers cull them (see orrery-frame-lite) instead of throwing on the UI thread.
  return focal / Math.max(denominator, focal * 0.02);
}

function assertProjection(
  p: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): void {
  "worklet";
  if (
    ![
      p.x,
      p.y,
      pose.x,
      pose.y,
      pose.zoom,
      pose.tilt ?? 0,
      pose.yaw ?? 0,
      pose.focalDistance ?? MIN_FOCAL_DISTANCE,
      viewport.width,
      viewport.height,
    ].every(Number.isFinite) ||
    pose.zoom <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    throw new Error("Invalid Orrery projection input");
  }
}

export function clampCameraPose(pose: CameraPose, extent: number): CameraPose {
  "worklet";
  const bound = Number.isFinite(extent) ? Math.max(1, extent) : 1;
  return {
    x: Number.isFinite(pose.x) ? Math.max(-bound, Math.min(bound, pose.x)) : 0,
    y: Number.isFinite(pose.y) ? Math.max(-bound, Math.min(bound, pose.y)) : 0,
    zoom: Number.isFinite(pose.zoom)
      ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pose.zoom))
      : 1,
    tilt: clamp(pose.tilt ?? 0, 0, MAX_TILT, 0),
    yaw: Number.isFinite(pose.yaw ?? 0)
      ? (((pose.yaw ?? 0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      : 0,
    focalDistance: labFocalDistance(
      Number.isFinite(pose.zoom)
        ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pose.zoom))
        : 1,
    ),
  };
}
export const constrainCamera = clampCameraPose;

export function projectWorldPoint(
  point: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): WorldPoint {
  "worklet";
  assertProjection(point, pose, viewport);
  const center = projectionCenter(viewport),
    plane = cameraPlane(point, pose),
    scale = perspectiveScale(point, pose) * pose.zoom;
  return {
    x: center.x + plane.x * scale,
    y: center.y + plane.y * Math.cos(pose.tilt ?? 0) * scale,
  };
}
/** Home enforces readability instead of imposing a maximum member count. */
export function deriveHomePose(
  world: readonly WorldBody[],
  viewport: CameraViewport,
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
  const fit = Math.min(usable.width, usable.height) / (2 * extent);
  const base = clampCameraPose(
    { ...HOME_CAMERA, zoom: Math.min(1, Math.max(floor, fit)) },
    extent,
  );
  // Lab C: the top-down fit leaves the tilted disc floating low with empty
  // sky above it. Dolly in until the FAR rim reaches the top of the camera
  // rect (near rim may run off the bottom, as on a strategy map), without
  // letting the system's width overflow the canvas by more than ~20%.
  const rect = cameraCenterRect(viewport) ?? usable;
  const fits = (zoom: number) => {
    "worklet";
    const pose = clampCameraPose({ ...HOME_CAMERA, zoom }, extent);
    const far = projectWorldPoint({ x: 0, y: -extent }, pose, viewport);
    const side = projectWorldPoint({ x: extent, y: 0 }, pose, viewport);
    const cx = rect.x + rect.width / 2;
    return (
      far.y >= rect.y + LAB_HOME_TOP_MARGIN &&
      side.x - cx <= viewport.width * LAB_HOME_MAX_HALF_SPAN
    );
  };
  const contacts = world.filter((b) => b.kind === "contact").length;
  if (LAB_FIT_ALL_ENABLED && contacts > LAB_FIT_ALL_MIN_CONTACTS) {
    const wholeDisc = (zoom: number) => {
      "worklet";
      const pose = clampCameraPose(
        { ...HOME_CAMERA, tilt: LAB_FIT_ALL_TILT, zoom },
        extent,
      );
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const p = projectWorldPoint(
          { x: Math.cos(a) * extent, y: Math.sin(a) * extent },
          pose,
          viewport,
        );
        if (
          p.x < usable.x + LAB_FIT_ALL_MARGIN ||
          p.x > usable.x + usable.width - LAB_FIT_ALL_MARGIN ||
          p.y < usable.y + LAB_FIT_ALL_MARGIN ||
          p.y > usable.y + usable.height - LAB_FIT_ALL_MARGIN
        )
          return false;
      }
      return true;
    };
    let lo = MIN_ZOOM,
      hi = Math.max(MIN_ZOOM, base.zoom * 4);
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (wholeDisc(mid)) lo = mid;
      else hi = mid;
    }
    return clampCameraPose(
      { ...HOME_CAMERA, tilt: LAB_FIT_ALL_TILT, zoom: lo },
      extent,
    );
  }
  if (contacts > LAB_CORE_MIN_CONTACTS) {
    // Dense: the populated core disc must project inside the canvas between
    // the System selector row (camera rect top) and the usable bottom.
    const core = coreRadius(world, LAB_CORE_FRACTION);
    const top = rect.y + LAB_CORE_MARGIN;
    const bottom = usable.y + usable.height - LAB_CORE_MARGIN;
    const coreFits = (zoom: number) => {
      "worklet";
      const pose = clampCameraPose(
        { ...HOME_CAMERA, tilt: LAB_CORE_TILT, zoom },
        extent,
      );
      for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2;
        const p = projectWorldPoint(
          { x: Math.cos(a) * core, y: Math.sin(a) * core },
          pose,
          viewport,
        );
        if (
          p.x < LAB_CORE_MARGIN ||
          p.x > viewport.width - LAB_CORE_MARGIN ||
          p.y < top ||
          p.y > bottom
        )
          return false;
      }
      return true;
    };
    let lo = MIN_ZOOM,
      hi = MAX_ZOOM;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (coreFits(mid)) lo = mid;
      else hi = mid;
    }
    return clampCameraPose(
      { ...HOME_CAMERA, tilt: LAB_CORE_TILT, zoom: lo },
      extent,
    );
  }
  if (!fits(base.zoom)) return base;
  let lo = base.zoom,
    hi = MAX_ZOOM;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return clampCameraPose({ ...HOME_CAMERA, zoom: lo }, extent);
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
  const center = projectionCenter(viewport),
    focal = pose.focalDistance ?? MIN_FOCAL_DISTANCE,
    tilt = pose.tilt ?? 0,
    yaw = pose.yaw ?? 0;
  const sx = (point.x - center.x) / pose.zoom,
    sy = (point.y - center.y) / pose.zoom;
  const denominator = focal * Math.cos(tilt) + sy * Math.sin(tilt);
  if (!Number.isFinite(denominator)) return { x: pose.x, y: pose.y };
  // Lab C: sky above the horizon maps to a far point on the plane (no throw).
  const safe = Math.max(denominator, focal * 0.05);
  const y = (sy * focal) / safe,
    x = (sx * (focal - y * Math.sin(tilt))) / focal;
  return {
    x: pose.x + x * Math.cos(yaw) + y * Math.sin(yaw),
    y: pose.y - x * Math.sin(yaw) + y * Math.cos(yaw),
  };
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
  const center = projectionCenter(viewport);
  for (const pose of [start, next]) {
    const focal = pose.focalDistance ?? MIN_FOCAL_DISTANCE;
    const sy = (screen.y - center.y) / pose.zoom;
    if (focal * Math.cos(pose.tilt ?? 0) + sy * Math.sin(pose.tilt ?? 0) <= 0)
      return next;
  }
  const anchor = unprojectToWorldPlane(screen, start, viewport);
  const after = unprojectToWorldPlane(screen, next, viewport);
  return clampCameraPose(
    { ...next, x: next.x + anchor.x - after.x, y: next.y + anchor.y - after.y },
    extent,
  );
}

export interface CameraFraming {
  pose: CameraPose;
  fits: boolean;
  usable: CameraRect;
}
/** Arbitrary sets frame their projected circular media AND minimum touch bounds.
 * Infeasible sets still return a bounded recovery pose, with fits:false.
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
  const bounds = (pose: CameraPose) => {
    "worklet";
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    for (const body of world) {
      const point = projectWorldPoint(body, pose, viewport);
      const radius = Math.max(
        MIN_HIT_RADIUS,
        body.radius * pose.zoom * perspectiveScale(body, pose),
      );
      left = Math.min(left, point.x - radius);
      right = Math.max(right, point.x + radius);
      top = Math.min(top, point.y - radius);
      bottom = Math.max(bottom, point.y + radius);
    }
    return { left, right, top, bottom };
  };
  const candidate = (zoom: number) => {
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
    for (let iteration = 0; iteration < 32; iteration++) {
      const b = bounds(pose);
      const mid = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
      if (Math.hypot(mid.x - center.x, mid.y - center.y) < 1e-8) break;
      const target = unprojectToWorldPlane(mid, pose, viewport);
      pose = clampCameraPose({ ...pose, x: target.x, y: target.y }, bound);
    }
    const b = bounds(pose);
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
  if (!result.fits) return result;
  const maximum = candidate(high);
  if (maximum.fits) return maximum;
  for (let i = 0; i < 36; i++) {
    const mid = (low + high) / 2,
      next = candidate(mid);
    if (next.fits) {
      low = mid;
      result = next;
    } else high = mid;
  }
  return result;
}

/** Gesture samples can lie beyond the ground-plane horizon at legal tilt/zoom. */
export function tryUnprojectToWorldPlane(
  point: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): WorldPoint | null {
  "worklet";
  const rect = cameraCenterRect(viewport);
  const focal = pose.focalDistance ?? MIN_FOCAL_DISTANCE;
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
  const sy = (point.y - rect.y - rect.height / 2) / pose.zoom;
  const denominator =
    focal * Math.cos(pose.tilt ?? 0) + sy * Math.sin(pose.tilt ?? 0);
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  const result = unprojectToWorldPlane(point, pose, viewport);
  return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : null;
}
export function projectFrame(
  world: readonly WorldBody[],
  pose: CameraPose,
  viewport: CameraViewport,
  generation: number,
): ProjectedFrame {
  "worklet";
  const current = clampCameraPose(
    pose,
    Math.max(
      worldExtent(world),
      ((pose.focalDistance ?? 0) * MAX_DEPTH_FRACTION) /
        ((1 + Math.SQRT2) * Math.sin(MAX_TILT)),
    ),
  );
  return {
    generation,
    pose: current,
    viewport,
    center: projectWorldPoint({ x: 0, y: 0 }, current, viewport),
    bodies: world.map((body) => {
      const scale = current.zoom * perspectiveScale(body, current);
      const ringPath: WorldPoint[] = [];
      if (body.ringRadius > 0)
        for (let i = 0; i < RING_SEGMENTS; i++) {
          const angle = (i * 2 * Math.PI) / RING_SEGMENTS;
          ringPath.push(
            projectWorldPoint(
              {
                x: body.ringRadius * Math.sin(angle),
                y: -body.ringRadius * Math.cos(angle),
              },
              current,
              viewport,
            ),
          );
        }
      return {
        ...body,
        ...projectWorldPoint(body, current, viewport),
        radius: body.radius * scale,
        ringRadius: body.ringRadius * current.zoom,
        hitRadius: Math.max(MIN_HIT_RADIUS, body.radius * scale),
        ringPath,
        depth: cameraPlane(body, current).y * Math.sin(current.tilt ?? 0),
      };
    }),
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
          : frame.pose.zoom >= IDENTITY_ZOOM
            ? "profile"
            : "focus",
  };
}

/** Structural cells allow the exact UI callbacks to run in the Node tracer. */
export interface CameraCell<T> {
  value: T;
}
export function panCamera(
  start: CameraPose,
  dx: number,
  dy: number,
  extent: number,
  viewport?: CameraViewport,
): CameraPose {
  "worklet";
  if (viewport) {
    const center = projectionCenter(viewport);
    const focal = start.focalDistance ?? deriveFocalDistance(extent),
      tilt = start.tilt ?? 0;
    const reach = 2 * Math.SQRT2 * Math.max(1, extent);
    const minY =
      (-reach * Math.cos(tilt) * focal) / (focal + reach * Math.sin(tilt));
    const farDen = focal - reach * Math.sin(tilt);
    const maxY =
      farDen > 0 ? (reach * Math.cos(tilt) * focal) / farDen : Infinity;
    // Restrict gesture sampling to the reachable plane before inverse math;
    // projection itself is never patched with a denominator clamp.
    const sampleY = clamp(-dy / start.zoom, minY, maxY, 0);
    const anchor = unprojectToWorldPlane(
      { x: center.x - dx, y: center.y + sampleY * start.zoom },
      start,
      viewport,
    );
    return clampCameraPose({ ...start, x: anchor.x, y: anchor.y }, extent);
  }
  return constrainCamera(
    { ...start, x: start.x - dx / start.zoom, y: start.y - dy / start.zoom },
    extent,
  );
}
