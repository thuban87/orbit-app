/**
 * ADR-077: a finite sun-centered inspection camera is separate from canonical
 * world placement. Pan/zoom never change a person's timestamp angle or rank.
 * This first slice is top-down; bounded tilt/yaw extend this projection in 29-04.
 */
export interface WorldPoint {
  x: number;
  y: number;
}
export type CameraPose = { x: number; y: number; zoom: number };
export interface CameraViewport {
  width: number;
  height: number;
}
export interface WorldBody extends WorldPoint {
  /** 0 identifies self, which has no Profile action. */
  id: number;
  kind: "contact" | "sun";
  radius: number;
  ringRadius: number;
}
export interface ProjectedBody extends WorldBody {
  hitRadius: number;
}
export interface ProjectedFrame {
  generation: number;
  pose: CameraPose;
  viewport: CameraViewport;
  bodies: ProjectedBody[];
  center: WorldPoint;
}
export const HOME_CAMERA: CameraPose = { x: 0, y: 0, zoom: 1 };
export const IDENTITY_ZOOM = 2;
export const FOCUS_MS = 300;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;
const MIN_HIT_RADIUS = 22;

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

export function constrainCamera(pose: CameraPose, extent: number): CameraPose {
  "worklet";
  const bound = Number.isFinite(extent) ? Math.max(1, extent) : 1;
  return {
    x: Number.isFinite(pose.x) ? Math.max(-bound, Math.min(bound, pose.x)) : 0,
    y: Number.isFinite(pose.y) ? Math.max(-bound, Math.min(bound, pose.y)) : 0,
    zoom: Number.isFinite(pose.zoom)
      ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pose.zoom))
      : 1,
  };
}

export function projectWorldPoint(
  point: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): WorldPoint {
  "worklet";
  assertProjection(point, pose, viewport);
  return {
    x: viewport.width / 2 + (point.x - pose.x) * pose.zoom,
    y: viewport.height / 2 + (point.y - pose.y) * pose.zoom,
  };
}
export function unprojectToWorldPlane(
  point: WorldPoint,
  pose: CameraPose,
  viewport: CameraViewport,
): WorldPoint {
  "worklet";
  assertProjection(point, pose, viewport);
  return {
    x: pose.x + (point.x - viewport.width / 2) / pose.zoom,
    y: pose.y + (point.y - viewport.height / 2) / pose.zoom,
  };
}
export function projectFrame(
  world: readonly WorldBody[],
  pose: CameraPose,
  viewport: CameraViewport,
  generation: number,
): ProjectedFrame {
  "worklet";
  return {
    generation,
    pose,
    viewport,
    center: projectWorldPoint({ x: 0, y: 0 }, pose, viewport),
    bodies: world.map((body) => ({
      ...body,
      ...projectWorldPoint(body, pose, viewport),
      radius: body.radius * pose.zoom,
      ringRadius: body.ringRadius * pose.zoom,
      hitRadius: Math.max(MIN_HIT_RADIUS, body.radius * pose.zoom),
    })),
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
        (x - body.x) ** 2 + (y - body.y) ** 2 <= body.hitRadius ** 2,
    )
    .map((body) => body.id);
}
export interface OrreryIntent {
  kind: "none" | "clear" | "focus" | "profile" | "group";
  ids: number[];
  generation: number;
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
): CameraPose {
  "worklet";
  return constrainCamera(
    { ...start, x: start.x - dx / start.zoom, y: start.y - dy / start.zoom },
    extent,
  );
}
