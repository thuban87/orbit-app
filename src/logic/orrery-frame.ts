/** ADR-077: interpolate world state once, then project once for every consumer. */
import {
  type CameraPose,
  type CameraViewport,
  type ProjectedFrame,
  projectFrame,
  type WorldBody,
} from "./orrery-camera-logic";
import {
  type SwitchChoreography,
  type SwitchChoreographySample,
  sampleSwitchChoreography,
} from "./orrery-switch-choreography";

export interface AnimatedWorldBody extends WorldBody {
  opacity: number;
  interactive: boolean;
}
export interface WorldTransition {
  generation: number;
  from: AnimatedWorldBody[];
  to: AnimatedWorldBody[];
}
/**
 * D-52: per-frame O(1) body indexes, built in the same pass as the frame's
 * bodies. `keyIndex`: bodyKey → index of the FIRST body with that key.
 * `idIndex`: id → index of the FIRST non-satellite body with that id. Read them
 * through `frameBodyByKey` / `frameBodyById`, never directly.
 */
export interface FrameBodyIndex {
  keyIndex?: Record<string, number>;
  idIndex?: Record<number, number>;
}
export type AnimatedFrame = Omit<ProjectedFrame, "bodies"> &
  FrameBodyIndex & {
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
  // D-53: O(N) keyed setup; each index holds the FIRST body for a key, exactly
  // what the previous per-key `find` returned. Keys are "kind:..." prefixed, so
  // a plain object never collides with an Object.prototype name.
  const keys: string[] = [];
  const fromIndex: Record<string, number> = {};
  for (let index = 0; index < from.length; index++) {
    const key = bodyKey(from[index]);
    keys.push(key);
    if (fromIndex[key] === undefined) fromIndex[key] = index;
  }
  const worldIndex: Record<string, number> = {};
  for (let index = 0; index < world.length; index++) {
    const key = bodyKey(world[index]);
    if (worldIndex[key] === undefined) worldIndex[key] = index;
    if (fromIndex[key] === undefined) keys.push(key);
  }
  const starts: AnimatedWorldBody[] = [],
    ends: AnimatedWorldBody[] = [];
  for (const key of keys) {
    const previousIndex = fromIndex[key];
    const nextIndex = worldIndex[key];
    const previous =
      previousIndex === undefined ? undefined : from[previousIndex];
    const next = nextIndex === undefined ? undefined : world[nextIndex];
    const live = !!next;
    const base = next ?? previous;
    if (!base) continue;
    starts.push({
      ...(previous ?? base),
      radius: previous?.radius ?? base.radius * 0.75,
      opacity: previous?.opacity ?? 0,
      interactive: live,
    });
    ends.push({
      ...base,
      radius: live ? base.radius : base.radius * 0.75,
      opacity: live ? 1 : 0,
      interactive: live,
    });
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

/**
 * Adds a short, reversible per-body sweep to a System transition. It only
 * rotates projected world geometry; opacity and radius stay owned by the
 * transition sampler above. At zero intensity the returned geometry is the
 * steady-state frame exactly.
 */
export function spinSwitchWorld(
  world: readonly AnimatedWorldBody[],
  intensity: number,
  progress: number,
): AnimatedWorldBody[] {
  "worklet";
  const phase = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI);
  if (intensity <= 0 || Math.abs(phase) < 1e-9) return [...world];
  return world.map((body) => {
    if (body.kind !== "contact") return body;
    const direction = body.id % 2 === 0 ? 1 : -1;
    const angle = direction * intensity * phase * 0.22;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return {
      ...body,
      x: body.x * cosine - body.y * sine,
      y: body.x * sine + body.y * cosine,
    };
  });
}
/**
 * Decorates projected bodies with opacity/interactivity/visibility from the
 * sampled world and builds the frame's key and id indexes in the same pass.
 */
function animateProjectedBodies(
  projected: ProjectedFrame["bodies"],
  world: readonly { opacity: number; interactive: boolean }[],
  viewport: CameraViewport,
): Pick<AnimatedFrame, "bodies"> & Required<FrameBodyIndex> {
  "worklet";
  const bodies: AnimatedFrame["bodies"] = [];
  const keyIndex: Record<string, number> = {};
  const idIndex: Record<number, number> = {};
  for (let index = 0; index < projected.length; index++) {
    const body = projected[index];
    const opacity = world[index].opacity;
    // Halo-aware media culling only. The full frame remains the hit authority.
    // H2: a body beyond the horizon is neither drawn nor tappable.
    const reach = body.radius * (body.kind === "sun" ? 2 : 1.3);
    bodies.push({
      ...body,
      opacity,
      interactive: world[index].interactive && opacity > 0 && !body.culled,
      visible:
        opacity > 0 &&
        !body.culled &&
        body.x + reach >= 0 &&
        body.y + reach >= 0 &&
        body.x - reach <= viewport.width &&
        body.y - reach <= viewport.height,
    });
    const key = bodyKey(body);
    if (keyIndex[key] === undefined) keyIndex[key] = index;
    if (body.kind !== "satellite" && idIndex[body.id] === undefined)
      idIndex[body.id] = index;
  }
  return { bodies, keyIndex, idIndex };
}
/** Forwarded to `projectFrame` (ring paths on/off, the camera pan extent). */
export type ProjectFrameOptions = Parameters<typeof projectFrame>[4];
export function projectAnimatedFrame(
  transition: WorldTransition,
  fraction: number,
  pose: CameraPose,
  viewport: CameraViewport,
  options?: ProjectFrameOptions,
): AnimatedFrame {
  "worklet";
  const world = sampleWorldTransition(transition, fraction);
  const frame = projectFrame(
    world,
    pose,
    viewport,
    transition.generation,
    options,
  );
  return {
    ...frame,
    ...animateProjectedBodies(frame.bodies, world, viewport),
  };
}

/** One choreography sample is the sole world for projection, rings and hits. */
export function projectSwitchChoreographyFrame(
  transition: SwitchChoreography,
  fraction: number,
  pose: CameraPose,
  viewport: CameraViewport,
  options?: ProjectFrameOptions,
): AnimatedFrame & { sample: SwitchChoreographySample } {
  "worklet";
  const sample = sampleSwitchChoreography(transition, fraction);
  const frame = projectFrame(
    sample.world,
    pose,
    viewport,
    transition.generation,
    options,
  );
  return {
    ...frame,
    sample,
    ...animateProjectedBodies(frame.bodies, sample.world, viewport),
  };
}

type IndexedBodies<B> = { bodies: readonly B[] } & FrameBodyIndex;
type KeyedBody = Pick<WorldBody, "id" | "kind" | "satelliteTarget">;

/** O(1) when the frame carries its index; otherwise the equivalent first-match scan. */
export function frameBodyByKey<B extends KeyedBody>(
  frame: IndexedBodies<B>,
  key: string,
): B | undefined {
  "worklet";
  const index = frame.keyIndex;
  if (!index) return frame.bodies.find((body) => bodyKey(body) === key);
  const found = index[key];
  return found === undefined ? undefined : frame.bodies[found];
}

/** The first non-satellite body with `id` (contacts and the sun); O(1) when indexed. */
export function frameBodyById<B extends KeyedBody>(
  frame: IndexedBodies<B>,
  id: number,
): B | undefined {
  "worklet";
  const index = frame.idIndex;
  if (!index)
    return frame.bodies.find(
      (body) => body.kind !== "satellite" && body.id === id,
    );
  const found = index[id];
  return found === undefined ? undefined : frame.bodies[found];
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
  const b = frameBodyByKey(frame, key);
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
