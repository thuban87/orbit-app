import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { CameraPose, WorldBody } from "@/logic/orrery-camera-logic";
import { bodyKey } from "@/logic/orrery-frame";
import {
  beginSettledSwitchChoreography,
  beginSwitchChoreography,
  type ChoreographyWorldBody,
  type SwitchChoreography,
  type SwitchChoreographyOptions,
  type SwitchChoreographySample,
  sampleSwitchChoreography,
  settleSwitchChoreography,
} from "@/logic/orrery-switch-choreography";
import {
  applySwitchBreath,
  fxClamp01,
  type SwitchCameraLook,
  type SwitchCameraMotion,
  switchBaseYaw,
  switchBreath,
  switchHasSpectacle,
} from "@/logic/orrery-switch-fx-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import {
  SWITCH_BREATH_PULLBACK,
  SWITCH_BREATH_TILT,
  SWITCH_BREATH_YAW,
  SWITCH_YAW_PATH,
} from "./v2/visual-tunables";

export const NORMAL_SWITCH_DURATION_MS = 2100;
export const REDUCED_SWITCH_DURATION_MS = 180;

export interface OrrerySwitchRuntimeState {
  transition: SwitchChoreography;
  progress: number;
  cameraFrom: CameraPose;
  cameraTo: CameraPose;
  status: "settled" | "running" | "paused";
  remainingFraction: number;
}

export interface OrrerySwitchRuntimeSample {
  world: ChoreographyWorldBody[];
  camera: CameraPose;
  sample: SwitchChoreographySample;
}

export interface OrreryBodyResource {
  key: string;
  body: OrrerySceneSnapshot["world"][number];
  scene: OrrerySceneSnapshot;
}

function clamp01(value: number): number {
  "worklet";
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
}

function smoothstep(value: number): number {
  "worklet";
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
}

/**
 * The switch camera's authored amounts (visual-tunables; one-number edits):
 * Lab C's switch camera, copied (owner S-SWIRL pick, 2026-10-04). Declared
 * above the worklets that read it.
 */
const SWITCH_CAMERA_LOOK: SwitchCameraLook = {
  yawPath: SWITCH_YAW_PATH,
  breathPullback: SWITCH_BREATH_PULLBACK,
  breathYaw: SWITCH_BREATH_YAW,
  breathTilt: SWITCH_BREATH_TILT,
};

/**
 * The plain crossfade camera (Lab C's `interpolateCamera`): every axis
 * smoothstep-mixed. The yaw follows SWITCH_YAW_PATH — "lab-c" is Lab C's raw
 * linear mix (no wrap handling), "shortest" the shortest arc.
 */
function interpolateCamera(
  from: CameraPose,
  to: CameraPose,
  progress: number,
): CameraPose {
  "worklet";
  if (progress <= 0) return { ...from };
  if (progress >= 1) return { ...to };
  const t = smoothstep(progress);
  const mix = (
    a: number | undefined,
    b: number | undefined,
    fallback: number,
  ) => {
    "worklet";
    const start = a ?? fallback;
    return start + ((b ?? fallback) - start) * t;
  };
  return {
    x: mix(from.x, to.x, 0),
    y: mix(from.y, to.y, 0),
    zoom: mix(from.zoom, to.zoom, 1),
    tilt: mix(from.tilt, to.tilt, 0),
    yaw: switchBaseYaw(
      from.yaw ?? 0,
      to.yaw ?? 0,
      t,
      SWITCH_CAMERA_LOOK.yawPath,
    ),
    focalDistance: mix(from.focalDistance, to.focalDistance, 256),
    // 38.7-05 (D-45): the lens shift travels with the other axes.
    lensShift: mix(from.lensShift, to.lensShift, 1),
  };
}

/**
 * The ONE switch camera sampler (C3-H1). Drawing (OrreryWorld's frame
 * worklet), the displayed-camera snapshot (interrupted publish, reduced-motion
 * retarget) and `sampleOrrerySwitchRuntime` all go through it, so a snapshot is
 * always the camera drawn that frame. `motion` is the transition BEING DRAWN
 * (C4-L2: never the live reduced-motion flag). This is Lab C's switch camera
 * (owner S-SWIRL pick, 2026-10-04): the crossfade above plus, with the
 * spectacle, Lab C's breath — dolly-out, yaw swing and lift toward flat, scaled
 * by sin²(πp)·(0.5 + 0.5·intensity) — exactly zero at both ends, so the camera
 * lands exactly on `to` at progress 1; reduced motion (or a spinless switch)
 * is the plain crossfade. Unlike Lab C, the displayed-camera snapshot (a
 * retarget) includes the breath, so a retarget starts from what is drawn.
 * Defined above every worklet that calls it (Hermes forward-ref hazard).
 */
export function sampleOrrerySwitchCamera(
  from: CameraPose,
  to: CameraPose,
  progress: number,
  motion: SwitchCameraMotion,
): CameraPose {
  "worklet";
  const base = interpolateCamera(from, to, progress);
  if (!(progress > 0 && progress < 1) || !switchHasSpectacle(motion))
    return base;
  return applySwitchBreath(
    base,
    switchBreath(progress) * (0.5 + 0.5 * fxClamp01(motion.intensity)),
    SWITCH_CAMERA_LOOK,
  );
}

/**
 * D-52 (6): the camera actually on screen. Once a switch has settled the user
 * owns the live pose (pan/zoom/focus), so `cameraTo` is stale; a new switch or a
 * reduced-motion retarget must start from the live pose, not the old target.
 * `motion` is the OUTGOING transition (read before a new one is written).
 */
export function displayedSwitchCamera(
  from: CameraPose,
  to: CameraPose,
  progress: number,
  live: CameraPose,
  motion: SwitchCameraMotion,
): CameraPose {
  "worklet";
  if (progress >= 1) return { ...live };
  return sampleOrrerySwitchCamera(from, to, progress, motion);
}

export function createSettledOrrerySwitchRuntime(
  world: readonly WorldBody[],
  generation: number,
  camera: CameraPose,
): OrrerySwitchRuntimeState {
  return {
    transition: beginSwitchChoreography(world, world, generation, {
      intensity: 0,
      reducedMotion: false,
    }),
    progress: 1,
    cameraFrom: { ...camera },
    cameraTo: { ...camera },
    status: "settled",
    remainingFraction: 0,
  };
}

export function sampleOrrerySwitchRuntime(
  runtime: OrrerySwitchRuntimeState,
  progress = runtime.progress,
): OrrerySwitchRuntimeSample {
  "worklet";
  const fraction = clamp01(progress);
  const sample = sampleSwitchChoreography(runtime.transition, fraction);
  return {
    world: sample.world,
    camera: sampleOrrerySwitchCamera(
      runtime.cameraFrom,
      runtime.cameraTo,
      fraction,
      runtime.transition,
    ),
    sample,
  };
}

export function beginOrrerySwitchRuntime(
  runtime: OrrerySwitchRuntimeState,
  destinationWorld: readonly WorldBody[],
  generation: number,
  destinationHome: CameraPose,
  options: SwitchChoreographyOptions,
): OrrerySwitchRuntimeState {
  const displayed = sampleOrrerySwitchRuntime(runtime);
  return {
    transition: beginSwitchChoreography(
      displayed.world,
      destinationWorld,
      generation,
      options,
    ),
    progress: 0,
    cameraFrom: displayed.camera,
    cameraTo: { ...destinationHome },
    status: "running",
    remainingFraction: 1,
  };
}

export function pauseOrrerySwitchRuntime(
  runtime: OrrerySwitchRuntimeState,
): OrrerySwitchRuntimeState {
  return runtime.status === "running"
    ? {
        ...runtime,
        status: "paused",
        remainingFraction: 1 - clamp01(runtime.progress),
      }
    : runtime;
}

export function resumeOrrerySwitchRuntime(
  runtime: OrrerySwitchRuntimeState,
): OrrerySwitchRuntimeState {
  return runtime.status === "paused"
    ? {
        ...runtime,
        status: "running",
        remainingFraction: 1 - clamp01(runtime.progress),
      }
    : runtime;
}

function resourcesFor(scene: OrrerySceneSnapshot): OrreryBodyResource[] {
  return scene.world.map((body) => ({ key: bodyKey(body), body, scene }));
}

/** D-53: O(N) keyed merge — same output and order as the per-key find/some scan. */
function mergeResources(
  previous: readonly OrreryBodyResource[],
  scene: OrrerySceneSnapshot,
): OrreryBodyResource[] {
  const current = resourcesFor(scene);
  // First resource per key, exactly what `find` returned.
  const currentByKey = new Map<string, OrreryBodyResource>();
  for (const item of current)
    if (!currentByKey.has(item.key)) currentByKey.set(item.key, item);
  const previousKeys = new Set(previous.map((old) => old.key));
  return [
    ...previous.map((old) => currentByKey.get(old.key) ?? old),
    ...current.filter((item) => !previousKeys.has(item.key)),
  ];
}

/**
 * React resource list after a publication (RG-027, performance/AUD-PERF-001,
 * D-19). Only a running switch keeps departed bodies (their geometry is still
 * choreographed out); the generation-checked prune removes them on completion.
 * A settled publication replaces the list with the current scene. Keys are
 * stable, so bodies present on both sides keep their keyed media.
 */
export function nextOrreryResources(
  current: readonly OrreryBodyResource[],
  scene: OrrerySceneSnapshot,
  isSwitch: boolean,
): OrreryBodyResource[] {
  return isSwitch && current.length > 0
    ? mergeResources(current, scene)
    : resourcesFor(scene);
}

/** Keeps only resources whose key is in the settled scene's world. */
export function pruneOrreryResources(
  current: readonly OrreryBodyResource[],
  scene: OrrerySceneSnapshot,
): OrreryBodyResource[] {
  const keys = new Set(scene.world.map(bodyKey));
  return current.filter((resource) => keys.has(resource.key));
}

export interface OrrerySwitchRuntime {
  transition: SharedValue<SwitchChoreography>;
  progress: SharedValue<number>;
  cameraFrom: SharedValue<CameraPose>;
  cameraTo: SharedValue<CameraPose>;
  running: SharedValue<boolean>;
  resources: OrreryBodyResource[];
  publish: (
    scene: OrrerySceneSnapshot,
    isSwitch: boolean,
    intensity: number,
    destinationHome: CameraPose,
  ) => void;
  pause: () => void;
  resume: () => void;
  /**
   * 38.7-15 (C5-M2): settles a running or paused switch now, through the
   * same path a driven switch completes by (`finish`: progress 1, the pose
   * at the switch's destination, the choreography settled, the prune — whose
   * settle notification adopts Plan 13's held renderer viewport). `done`
   * runs on JS after that prune and settle notification, or (one UI round
   * trip later) when nothing was running: a no-op then.
   */
  settle: (done?: () => void) => void;
}

/**
 * 38.7-13 (D-53, C4-M1): called on JS when a publication or a driven switch
 * settles at `generation`. A driven switch's settle runs INSIDE the prune's JS
 * callback, so whatever React state the screen sets here batches into the
 * settle commit (one commit at settle, never one per notification). A
 * settled publication notifies synchronously inside `publish`, batching into
 * the publish commit.
 */
export type OrrerySwitchSettled = (generation: number) => void;

export function useOrrerySwitchRuntime(
  pose: SharedValue<CameraPose>,
  reducedMotion: SharedValue<boolean>,
  onSettled?: OrrerySwitchSettled,
): OrrerySwitchRuntime {
  const empty = useRef(
    createSettledOrrerySwitchRuntime([], 0, pose.value),
  ).current;
  const transition = useSharedValue(empty.transition);
  const progress = useSharedValue(1);
  const cameraFrom = useSharedValue({ ...pose.value });
  const cameraTo = useSharedValue({ ...pose.value });
  const running = useSharedValue(false);
  const latestScene = useRef<OrrerySceneSnapshot | null>(null);
  const [resources, setResources] = useState<OrreryBodyResource[]>([]);
  // The latest settle listener (a ref, so it never changes the runtime's identity).
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  // 38.7-15 (C5-M2): `settle()` callers waiting for the next settle.
  const settleWaiters = useRef<(() => void)[]>([]);
  const flushSettleWaiters = useCallback(() => {
    const waiting = settleWaiters.current;
    settleWaiters.current = [];
    for (const done of waiting) done();
  }, []);

  const prune = useCallback(
    (generation: number) => {
      setResources((current) => {
        const scene = latestScene.current;
        if (!scene || scene.generation !== generation) return current;
        return pruneOrreryResources(current, scene);
      });
      // Same JS callback as the prune: the screen's settle state joins its commit.
      settledRef.current?.(generation);
      flushSettleWaiters();
    },
    [flushSettleWaiters],
  );

  const finish = useCallback(
    (generation: number) => {
      "worklet";
      if (transition.value.generation !== generation) return;
      running.value = false;
      progress.value = 1;
      pose.value = { ...cameraTo.value };
      // RG-027 / performance/AUD-PERF-001: retire departed geometry on settle.
      transition.value = settleSwitchChoreography(transition.value);
      runOnJS(prune)(generation);
    },
    [cameraTo, pose, progress, prune, running, transition],
  );

  const startDriver = useCallback(
    (remaining: number, reduced: boolean, generation: number) => {
      "worklet";
      const duration =
        (reduced ? REDUCED_SWITCH_DURATION_MS : NORMAL_SWITCH_DURATION_MS) *
        remaining;
      running.value = true;
      progress.value = withTiming(
        1,
        { duration, reduceMotion: ReduceMotion.Never },
        (finished) => {
          if (finished) finish(generation);
        },
      );
    },
    [finish, progress, running],
  );

  const publish = useCallback(
    (
      scene: OrrerySceneSnapshot,
      isSwitch: boolean,
      intensity: number,
      destinationHome: CameraPose,
    ) => {
      latestScene.current = scene;
      setResources((current) => nextOrreryResources(current, scene, isSwitch));
      // D-52: ship only the geometry the UI thread needs. Capturing `scene`
      // would serialise the whole snapshot (contacts, members, gravity map) to
      // the UI runtime on every publication.
      const world = scene.world;
      const generation = scene.generation;
      // A settled publication (the branch below) settles now: notify inside
      // this JS call so the screen's settle state joins the publish commit.
      if (!isSwitch || transition.value.generation === 0)
        settledRef.current?.(generation);
      runOnUI(() => {
        "worklet";
        cancelAnimation(progress);
        const reduced = reducedMotion.value;
        if (!isSwitch || transition.value.generation === 0) {
          // Same choreography as beginSwitchChoreography(world, world, ...)
          // at intensity 0, plus the settled fast path (D-53).
          transition.value = beginSettledSwitchChoreography(
            world,
            generation,
            reduced,
          );
          cameraFrom.value = { ...destinationHome };
          cameraTo.value = { ...destinationHome };
          progress.value = 1;
          running.value = false;
          return;
        }
        const displayed = sampleSwitchChoreography(
          transition.value,
          progress.value,
        ).world;
        // C3-H1: the camera drawn this frame, with the OUTGOING transition's
        // motion (sampled before the new transition is written).
        const displayedCamera = displayedSwitchCamera(
          cameraFrom.value,
          cameraTo.value,
          progress.value,
          pose.value,
          transition.value,
        );
        transition.value = beginSwitchChoreography(
          displayed,
          world,
          generation,
          { intensity, reducedMotion: reduced },
        );
        cameraFrom.value = displayedCamera;
        cameraTo.value = { ...destinationHome };
        progress.value = 0;
        startDriver(1, reduced, generation);
      })();
    },
    [
      cameraFrom,
      cameraTo,
      pose,
      progress,
      reducedMotion,
      running,
      startDriver,
      transition,
    ],
  );

  const settle = useCallback(
    (done?: () => void) => {
      if (done) settleWaiters.current.push(done);
      runOnUI(() => {
        "worklet";
        // `finish` has only a generation guard: a settled switch is a no-op.
        if (progress.value >= 1) {
          runOnJS(flushSettleWaiters)();
          return;
        }
        cancelAnimation(progress);
        finish(transition.value.generation);
      })();
    },
    [finish, flushSettleWaiters, progress, transition],
  );

  const pause = useCallback(() => {
    runOnUI(() => {
      "worklet";
      if (!running.value) return;
      cancelAnimation(progress);
      running.value = false;
    })();
  }, [progress, running]);

  const resume = useCallback(() => {
    runOnUI(() => {
      "worklet";
      if (running.value || progress.value >= 1) return;
      startDriver(
        1 - progress.value,
        transition.value.reducedMotion,
        transition.value.generation,
      );
    })();
  }, [progress, running, startDriver, transition]);

  useAnimatedReaction(
    () => reducedMotion.value,
    (reduced, previous) => {
      if (!reduced || previous !== false || progress.value >= 1) return;
      cancelAnimation(progress);
      const displayed = sampleSwitchChoreography(
        transition.value,
        progress.value,
      ).world;
      // C3-H1 / C4-L2: the camera drawn this frame — the frame worklet still
      // draws the outgoing (non-reduced) transition, Lab C breath included.
      const displayedCamera = displayedSwitchCamera(
        cameraFrom.value,
        cameraTo.value,
        progress.value,
        pose.value,
        transition.value,
      );
      const destination = transition.value.entries.flatMap((entry) =>
        entry.destination ? [entry.destination] : [],
      );
      transition.value = beginSwitchChoreography(
        displayed,
        destination,
        transition.value.generation,
        { intensity: transition.value.intensity, reducedMotion: true },
      );
      cameraFrom.value = displayedCamera;
      progress.value = 0;
      startDriver(1, true, transition.value.generation);
    },
  );

  useEffect(
    () => () => {
      runOnUI(() => {
        "worklet";
        cancelAnimation(progress);
      })();
    },
    [progress],
  );

  // D-52: a stable identity, so an unrelated screen render neither restarts
  // the frame mapper nor rebuilds any consumer keyed on the runtime.
  return useMemo(
    () => ({
      transition,
      progress,
      cameraFrom,
      cameraTo,
      running,
      resources,
      publish,
      pause,
      resume,
      settle,
    }),
    [
      transition,
      progress,
      cameraFrom,
      cameraTo,
      running,
      resources,
      publish,
      pause,
      resume,
      settle,
    ],
  );
}
