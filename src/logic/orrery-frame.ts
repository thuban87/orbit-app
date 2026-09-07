/** ADR-077: interpolate world state once, then project once for every consumer. */
import {
  type CameraPose,
  type CameraViewport,
  type ProjectedFrame,
  projectFrame,
  type WorldBody,
} from "./orrery-camera-logic";

export interface AnimatedWorldBody extends WorldBody {
  opacity: number;
  interactive: boolean;
}
export interface WorldTransition {
  generation: number;
  from: AnimatedWorldBody[];
  to: AnimatedWorldBody[];
}
export type AnimatedFrame = Omit<ProjectedFrame, "bodies"> & {
  bodies: (ProjectedFrame["bodies"][number] & {
    opacity: number;
    interactive: boolean;
    visible: boolean;
  })[];
};
export function bodyKey(
  body: Pick<WorldBody, "id" | "kind" | "satelliteTarget">,
): string {
  "worklet";
  if (body.kind === "satellite" && body.satelliteTarget) {
    const target = body.satelliteTarget;
    return `satellite:${JSON.stringify([target.parentId, target.parentUid, target.uid])}`;
  }
  return `${body.kind}:${body.id}`;
}
/** Retained keys keep their source order (native stable equal-depth ties).
 * Departures remain decorative; new entries begin at their resolved position.
 */
export function beginWorldTransition(
  from: readonly AnimatedWorldBody[],
  world: readonly WorldBody[],
  generation: number,
): WorldTransition {
  "worklet";
  const keys = [
    ...from.map(bodyKey),
    ...world
      .map(bodyKey)
      .filter((key) => !from.some((b) => bodyKey(b) === key)),
  ];
  const starts: AnimatedWorldBody[] = [],
    ends: AnimatedWorldBody[] = [];
  for (const key of keys) {
    const previous = from.find((b) => bodyKey(b) === key);
    const next = world.find((b) => bodyKey(b) === key);
    const live = !!next;
    const base = next ?? previous;
    if (!base) continue;
    starts.push({
      ...(previous ?? base),
      opacity: previous?.opacity ?? 0,
      interactive: live,
    });
    ends.push({ ...base, opacity: live ? 1 : 0, interactive: live });
  }
  return { generation, from: starts, to: ends };
}
export function sampleWorldTransition(
  transition: WorldTransition,
  fraction: number,
): AnimatedWorldBody[] {
  "worklet";
  const t = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 1));
  return transition.to.map((end, index) => {
    const start = transition.from[index];
    const mix = (a: number, b: number) => {
      "worklet";
      return a + (b - a) * t;
    };
    return {
      ...end,
      x: mix(start.x, end.x),
      y: mix(start.y, end.y),
      radius: mix(start.radius, end.radius),
      ringRadius: mix(start.ringRadius, end.ringRadius),
      opacity: mix(start.opacity, end.opacity),
    };
  });
}
export function projectAnimatedFrame(
  transition: WorldTransition,
  fraction: number,
  pose: CameraPose,
  viewport: CameraViewport,
): AnimatedFrame {
  "worklet";
  const world = sampleWorldTransition(transition, fraction);
  const frame = projectFrame(world, pose, viewport, transition.generation);
  return {
    ...frame,
    bodies: frame.bodies.map((body, index) => {
      const opacity = world[index].opacity;
      // Halo-aware media culling only. The full frame remains the hit authority.
      const reach = body.radius * (body.kind === "sun" ? 2 : 1.3);
      return {
        ...body,
        opacity,
        interactive: world[index].interactive && opacity > 0,
        visible:
          opacity > 0 &&
          body.x + reach >= 0 &&
          body.y + reach >= 0 &&
          body.x - reach <= viewport.width &&
          body.y - reach <= viewport.height,
      };
    }),
  };
}

export interface BillboardPose {
  x: number;
  y: number;
  scale: number;
  depth: number;
  opacity: number;
}
export function billboardPose(
  frame: AnimatedFrame,
  key: string,
  radius: number,
): BillboardPose {
  "worklet";
  const b = frame.bodies.find((body) => bodyKey(body) === key);
  return b
    ? {
        x: b.x,
        y: b.y,
        scale: b.radius / radius,
        depth: b.depth,
        opacity: b.visible ? b.opacity : 0,
      }
    : { x: 0, y: 0, scale: 1, depth: 0, opacity: 0 };
}
