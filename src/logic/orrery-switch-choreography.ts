import type { WorldBody } from "./orrery-camera-logic";

// Device-tunable phase and spectacle constants. Plan 30-12 owns Pixel tuning.
export const ACCELERATE_END = 0.2;
export const SHED_START = 0.18;
export const SHED_END = 0.58;
export const CAPTURE_START = 0.44;
export const CAPTURE_END = 0.82;
export const SETTLE_START = 0.72;
export const BASE_RADIAL_DISPLACEMENT = 52;
export const RADIAL_DISPLACEMENT_RANGE = 118;
export const INTERACTION_READY_PROGRESS = CAPTURE_END;
export const STAGGER_WINDOW = 0.035;

export type SwitchChoreographyRole =
  | "retained"
  | "leaving"
  | "entering"
  | "anchor";
export type SwitchChoreographyPhase =
  | "accelerate"
  | "shed"
  | "capture"
  | "settle"
  | "complete";

export interface ChoreographyWorldBody extends WorldBody {
  opacity: number;
  interactive: boolean;
}

export interface SwitchChoreographyEntry {
  key: string;
  role: SwitchChoreographyRole;
  source?: ChoreographyWorldBody;
  destination?: ChoreographyWorldBody;
  stagger: number;
}

export interface SwitchChoreographyOptions {
  intensity: number;
  reducedMotion: boolean;
}

export interface SwitchChoreography {
  generation: number;
  entries: SwitchChoreographyEntry[];
  intensity: number;
  reducedMotion: boolean;
  spinTurns: number;
  maximumRotation: number;
  radialDisplacement: number;
}

export interface SwitchChoreographySample {
  generation: number;
  progress: number;
  phase: SwitchChoreographyPhase;
  accumulatedRotation: number;
  angularVelocity: number;
  world: ChoreographyWorldBody[];
}

function clamp01(value: number): number {
  "worklet";
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
}

function mix(from: number, to: number, progress: number): number {
  "worklet";
  return from + (to - from) * progress;
}

function smoothstep(progress: number): number {
  "worklet";
  const t = clamp01(progress);
  return t * t * (3 - 2 * t);
}

function intervalProgress(
  progress: number,
  start: number,
  end: number,
): number {
  "worklet";
  return clamp01((progress - start) / (end - start));
}

function keyOf(
  body: Pick<WorldBody, "id" | "kind" | "satelliteTarget">,
): string {
  "worklet";
  if (body.kind === "satellite" && body.satelliteTarget) {
    const target = body.satelliteTarget;
    return `satellite:${JSON.stringify([target.parentId, target.parentUid, target.uid])}`;
  }
  return `${body.kind}:${body.id}`;
}

function stableUnit(key: string): number {
  "worklet";
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++)
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  return (hash >>> 0) / 4294967295;
}

function animated(
  body: WorldBody &
    Partial<Pick<ChoreographyWorldBody, "opacity" | "interactive">>,
): ChoreographyWorldBody {
  "worklet";
  return {
    ...body,
    opacity: body.opacity ?? 1,
    interactive: body.interactive ?? true,
  };
}

function bodyAngle(body: WorldBody): number {
  "worklet";
  return Math.atan2(body.x, -body.y);
}

function forwardAngle(from: number, to: number): number {
  "worklet";
  const turn = Math.PI * 2;
  return (((to - from) % turn) + turn) % turn;
}

function atPolar(
  template: ChoreographyWorldBody,
  radialDistance: number,
  angle: number,
  ringRadius: number,
  radius: number,
  opacity: number,
  interactive: boolean,
): ChoreographyWorldBody {
  "worklet";
  return {
    ...template,
    x: radialDistance * Math.sin(angle),
    y: -radialDistance * Math.cos(angle),
    ringRadius,
    radius,
    opacity,
    interactive,
  };
}

function phaseAt(progress: number): SwitchChoreographyPhase {
  "worklet";
  if (progress >= 1) return "complete";
  if (progress < ACCELERATE_END) return "accelerate";
  if (progress < CAPTURE_START) return "shed";
  if (progress < SETTLE_START) return "capture";
  return "settle";
}

function rotationIntegral(progress: number): number {
  "worklet";
  const p = clamp01(progress);
  if (p <= ACCELERATE_END)
    return (p * p * p) / (3 * ACCELERATE_END * ACCELERATE_END);
  const acceleratedArea = ACCELERATE_END / 3;
  if (p <= SETTLE_START) return acceleratedArea + (p - ACCELERATE_END);
  const duration = 1 - SETTLE_START;
  const u = (p - SETTLE_START) / duration;
  return (
    acceleratedArea +
    (SETTLE_START - ACCELERATE_END) +
    duration * (u - u * u + (u * u * u) / 3)
  );
}

function rotationIntegralTotal(): number {
  "worklet";
  return (
    ACCELERATE_END / 3 +
    (SETTLE_START - ACCELERATE_END) +
    (1 - SETTLE_START) / 3
  );
}

function normalizedRotation(progress: number): number {
  "worklet";
  return rotationIntegral(progress) / rotationIntegralTotal();
}

function normalizedAngularVelocity(progress: number): number {
  "worklet";
  const p = clamp01(progress);
  const scale = 1 / rotationIntegralTotal();
  if (p < ACCELERATE_END) return (p / ACCELERATE_END) ** 2 * scale;
  if (p < SETTLE_START) return scale;
  const remaining = (1 - p) / (1 - SETTLE_START);
  return remaining * remaining * scale;
}

function spinTurnsForIntensity(intensity: number): number {
  "worklet";
  if (intensity <= 0) return 0;
  return 1 + Math.round(clamp01(intensity) * 2);
}

function sampleAnchor(
  entry: SwitchChoreographyEntry,
  progress: number,
): ChoreographyWorldBody {
  "worklet";
  const source = entry.source ?? entry.destination;
  const destination = entry.destination ?? entry.source;
  if (!source || !destination)
    throw new Error("Choreography anchor has no geometry");
  return {
    ...destination,
    x: mix(source.x, destination.x, progress),
    y: mix(source.y, destination.y, progress),
    radius: mix(source.radius, destination.radius, progress),
    ringRadius: mix(source.ringRadius, destination.ringRadius, progress),
    opacity: mix(
      entry.source ? source.opacity : 0,
      entry.destination ? destination.opacity : 0,
      progress,
    ),
    interactive: !!entry.destination,
  };
}

function sampleReduced(
  entry: SwitchChoreographyEntry,
  progress: number,
): ChoreographyWorldBody {
  "worklet";
  const source = entry.source ?? entry.destination;
  const destination = entry.destination ?? entry.source;
  if (!source || !destination)
    throw new Error("Reduced choreography entry has no geometry");
  const position = smoothstep(progress);
  return {
    ...destination,
    x: mix(source.x, destination.x, position),
    y: mix(source.y, destination.y, position),
    radius: mix(source.radius, destination.radius, position),
    ringRadius: mix(source.ringRadius, destination.ringRadius, position),
    opacity: mix(
      entry.source ? source.opacity : 0,
      entry.destination ? destination.opacity : 0,
      position,
    ),
    interactive: !!entry.destination && progress >= 1,
  };
}

function sampleRetained(
  entry: SwitchChoreographyEntry,
  progress: number,
  rotationProgress: number,
  turns: number,
): ChoreographyWorldBody {
  "worklet";
  const source = entry.source;
  const destination = entry.destination;
  if (!source || !destination)
    throw new Error("Retained choreography entry is missing geometry");
  const sourceDistance = Math.hypot(source.x, source.y);
  const destinationDistance = Math.hypot(destination.x, destination.y);
  const sourceAngle = bodyAngle(source);
  const pathAngle =
    forwardAngle(sourceAngle, bodyAngle(destination)) + turns * Math.PI * 2;
  return atPolar(
    destination,
    mix(sourceDistance, destinationDistance, smoothstep(progress)),
    sourceAngle + pathAngle * rotationProgress,
    mix(source.ringRadius, destination.ringRadius, smoothstep(progress)),
    mix(source.radius, destination.radius, smoothstep(progress)),
    1,
    true,
  );
}

function sampleLeaving(
  entry: SwitchChoreographyEntry,
  progress: number,
  rotation: number,
  radialDisplacement: number,
): ChoreographyWorldBody {
  "worklet";
  const source = entry.source;
  if (!source)
    throw new Error("Leaving choreography entry is missing source geometry");
  const shed = smoothstep(
    intervalProgress(
      progress,
      SHED_START + entry.stagger,
      SHED_END + entry.stagger,
    ),
  );
  const distance = Math.hypot(source.x, source.y) + radialDisplacement * shed;
  return atPolar(
    source,
    distance,
    bodyAngle(source) + rotation,
    source.ringRadius + radialDisplacement * shed,
    source.radius * (1 - 0.25 * shed),
    source.opacity * (1 - shed),
    false,
  );
}

function sampleEntering(
  entry: SwitchChoreographyEntry,
  progress: number,
  rotationProgress: number,
  turns: number,
  radialDisplacement: number,
): ChoreographyWorldBody {
  "worklet";
  const destination = entry.destination;
  if (!destination)
    throw new Error(
      "Entering choreography entry is missing destination geometry",
    );
  const capture = smoothstep(
    intervalProgress(
      progress,
      CAPTURE_START + entry.stagger,
      CAPTURE_END + entry.stagger,
    ),
  );
  const destinationDistance = Math.hypot(destination.x, destination.y);
  const remainingRotation = (1 - rotationProgress) * turns * Math.PI * 2;
  return atPolar(
    destination,
    destinationDistance + radialDisplacement * (1 - capture),
    bodyAngle(destination) - remainingRotation,
    destination.ringRadius + radialDisplacement * (1 - capture),
    destination.radius * (0.75 + 0.25 * capture),
    destination.opacity * capture,
    progress >= INTERACTION_READY_PROGRESS,
  );
}

export function beginSwitchChoreography(
  sourceWorld: readonly (
    | WorldBody
    | (WorldBody &
        Partial<Pick<ChoreographyWorldBody, "opacity" | "interactive">>)
  )[],
  destinationWorld: readonly WorldBody[],
  generation: number,
  options: SwitchChoreographyOptions,
): SwitchChoreography {
  "worklet";
  const source = sourceWorld.map(animated);
  const destination = destinationWorld.map(animated);
  const keys = [
    ...source.map(keyOf),
    ...destination
      .map(keyOf)
      .filter((key) => !source.some((body) => keyOf(body) === key)),
  ];
  const entries = keys.flatMap((key): SwitchChoreographyEntry[] => {
    const from = source.find((body) => keyOf(body) === key);
    const to = destination.find((body) => keyOf(body) === key);
    const contact = (from ?? to)?.kind === "contact";
    if (!from && !to) return [];
    return [
      {
        key,
        source: from,
        destination: to,
        role: !contact
          ? "anchor"
          : from && to
            ? "retained"
            : from
              ? "leaving"
              : "entering",
        stagger: contact ? stableUnit(key) * STAGGER_WINDOW : 0,
      },
    ];
  });
  const intensity = clamp01(options.intensity);
  const spinTurns = options.reducedMotion
    ? 0
    : spinTurnsForIntensity(intensity);
  return {
    generation,
    entries,
    intensity,
    reducedMotion: options.reducedMotion,
    spinTurns,
    maximumRotation: spinTurns * Math.PI * 2,
    radialDisplacement:
      options.reducedMotion || intensity <= 0
        ? 0
        : BASE_RADIAL_DISPLACEMENT + RADIAL_DISPLACEMENT_RANGE * intensity,
  };
}

export function sampleSwitchChoreography(
  transition: SwitchChoreography,
  fraction: number,
): SwitchChoreographySample {
  "worklet";
  const progress = clamp01(fraction);
  const rotationProgress = transition.reducedMotion
    ? 0
    : normalizedRotation(progress);
  const accumulatedRotation = transition.maximumRotation * rotationProgress;
  const angularVelocity = transition.reducedMotion
    ? 0
    : transition.maximumRotation * normalizedAngularVelocity(progress);
  return {
    generation: transition.generation,
    progress,
    phase: phaseAt(progress),
    accumulatedRotation,
    angularVelocity,
    world: transition.entries.map((entry) => {
      "worklet";
      if (progress >= 1 && entry.destination)
        return { ...entry.destination, opacity: 1, interactive: true };
      if (progress >= 1 && entry.source)
        return { ...entry.source, opacity: 0, interactive: false };
      if (transition.reducedMotion) return sampleReduced(entry, progress);
      if (entry.role === "retained")
        return sampleRetained(
          entry,
          progress,
          rotationProgress,
          transition.spinTurns,
        );
      if (entry.role === "leaving")
        return sampleLeaving(
          entry,
          progress,
          accumulatedRotation,
          transition.radialDisplacement,
        );
      if (entry.role === "entering")
        return sampleEntering(
          entry,
          progress,
          rotationProgress,
          transition.spinTurns,
          transition.radialDisplacement,
        );
      return sampleAnchor(entry, progress);
    }),
  };
}
