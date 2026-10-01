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
export type AnimatedFrameBody = ProjectedFrame["bodies"][number] & {
  opacity: number;
  interactive: boolean;
  visible: boolean;
};
export type AnimatedFrame = Omit<ProjectedFrame, "bodies"> & {
  bodies: AnimatedFrameBody[];
  /**
   * Perf pass: bodyKey → first index into `bodies`, built once per frame so
   * per-body consumers stop scanning N bodies (and building N key strings)
   * each. A hit is verified against the body's own key, so a derived frame
   * (`{...frame, bodies: filtered}`) can never return the wrong body.
   */
  keyIndex?: Record<string, number>;
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
/** First body with `key`, as `bodies.find(b => bodyKey(b) === key)` — O(1) when indexed. */
export function frameBody(
  frame: AnimatedFrame,
  key: string,
): AnimatedFrameBody | undefined {
  "worklet";
  const index = frame.keyIndex?.[key];
  if (index !== undefined) {
    const body = frame.bodies[index];
    if (body && bodyKey(body) === key) return body;
  }
  return frame.bodies.find((body) => bodyKey(body) === key);
}
function indexFrameKeys(
  bodies: readonly AnimatedFrameBody[],
): Record<string, number> {
  "worklet";
  const index: Record<string, number> = {};
  for (let i = 0; i < bodies.length; i++) {
    const key = bodyKey(bodies[i]);
    if (index[key] === undefined) index[key] = i;
  }
  return index;
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
export function projectAnimatedFrame(
  transition: WorldTransition,
  fraction: number,
  pose: CameraPose,
  viewport: CameraViewport,
  /** Lab A camera perf pass: false → empty `ringPath`s (see projectFrame). */
  ringPaths = true,
): AnimatedFrame {
  "worklet";
  const world = sampleWorldTransition(transition, fraction);
  const frame = projectFrame(
    world,
    pose,
    viewport,
    transition.generation,
    ringPaths,
  );
  const bodies = frame.bodies.map((body, index) => {
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
  });
  return { ...frame, bodies, keyIndex: indexFrameKeys(bodies) };
}

/** One choreography sample is the sole world for projection, rings and hits. */
export function projectSwitchChoreographyFrame(
  transition: SwitchChoreography,
  fraction: number,
  pose: CameraPose,
  viewport: CameraViewport,
): AnimatedFrame & { sample: SwitchChoreographySample } {
  "worklet";
  const sample = sampleSwitchChoreography(transition, fraction);
  const frame = projectFrame(
    sample.world,
    pose,
    viewport,
    transition.generation,
  );
  return {
    ...frame,
    sample,
    bodies: frame.bodies.map((body, index) => {
      const current = sample.world[index];
      const opacity = current.opacity;
      const reach = body.radius * (body.kind === "sun" ? 2 : 1.3);
      return {
        ...body,
        opacity,
        interactive: current.interactive && opacity > 0,
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
  const b = frameBody(frame, key);
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

/** Per-key billboard inputs, built once per frame (perf pass). */
export interface BillboardSample {
  x: number;
  y: number;
  radius: number;
  depth: number;
  /** Already culled: `visible ? opacity : 0`, as billboardPose. */
  opacity: number;
}
export type BillboardMap = Record<string, BillboardSample>;
/**
 * The frame's billboard data keyed by bodyKey (first body per key, like
 * `frameBody`). Body/moon mappers read this small map instead of the whole
 * frame: a mapper created on the JS thread runs its first sample there, and a
 * frame read clones every body's 128-point ring path back to JS.
 */
export function billboardMap(frame: AnimatedFrame): BillboardMap {
  "worklet";
  const out: BillboardMap = {};
  for (const b of frame.bodies) {
    const key = bodyKey(b);
    if (out[key] !== undefined) continue;
    out[key] = {
      x: b.x,
      y: b.y,
      radius: b.radius,
      depth: b.depth,
      opacity: b.visible ? b.opacity : 0,
    };
  }
  return out;
}
/** Exactly `billboardPose(frame, key, radius)`, read from `billboardMap(frame)`. */
export function billboardFromMap(
  map: BillboardMap,
  key: string,
  radius: number,
): BillboardPose {
  "worklet";
  const b = map[key];
  return b
    ? {
        x: b.x,
        y: b.y,
        scale: b.radius / radius,
        depth: b.depth,
        opacity: b.opacity,
      }
    : { x: 0, y: 0, scale: 1, depth: 0, opacity: 0 };
}
