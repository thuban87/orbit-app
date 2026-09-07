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
}
export interface WorldBody extends WorldPoint {
  /** 0 identifies self, which has no Profile action. */
  id: number;
  kind: "contact" | "sun";
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
export const HOME_CAMERA: CameraPose = {
  x: 0,
  y: 0,
  zoom: 1,
  tilt: 0,
  yaw: 0,
  focalDistance: 256,
};
export const IDENTITY_ZOOM = 2;
export const FOCUS_MS = 300;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const MAX_TILT = Math.PI / 3;
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
function projectionCenter(viewport: CameraViewport): WorldPoint {
  "worklet";
  const rect = usableCameraRect(viewport);
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
  if (!Number.isFinite(denominator) || denominator <= 0)
    throw new Error("Point outside finite Orrery camera plane");
  return focal / denominator;
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
    focalDistance: deriveFocalDistance(bound),
  };
}
export const constrainCamera = clampCameraPose;

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
  return clampCameraPose(
    { ...HOME_CAMERA, zoom: Math.min(1, Math.max(floor, fit)) },
    extent,
  );
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
  if (!Number.isFinite(denominator) || denominator <= 0)
    throw new Error("Point outside inverse Orrery camera plane");
  const y = (sy * focal) / denominator,
    x = (sx * (focal - y * Math.sin(tilt))) / focal;
  return {
    x: pose.x + x * Math.cos(yaw) + y * Math.sin(yaw),
    y: pose.y - x * Math.sin(yaw) + y * Math.cos(yaw),
  };
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
  kind: "none" | "clear" | "focus" | "profile" | "group";
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
    const maxY =
      (reach * Math.cos(tilt) * focal) / (focal - reach * Math.sin(tilt));
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
