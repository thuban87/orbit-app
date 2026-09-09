import { useCallback, useEffect, useRef, useState } from "react";
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
  beginSwitchChoreography,
  type ChoreographyWorldBody,
  type SwitchChoreography,
  type SwitchChoreographyOptions,
  type SwitchChoreographySample,
  sampleSwitchChoreography,
} from "@/logic/orrery-switch-choreography";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";

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
    yaw: mix(from.yaw, to.yaw, 0),
    focalDistance: mix(from.focalDistance, to.focalDistance, 256),
  };
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
    camera: interpolateCamera(runtime.cameraFrom, runtime.cameraTo, fraction),
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

function mergeResources(
  previous: readonly OrreryBodyResource[],
  scene: OrrerySceneSnapshot,
): OrreryBodyResource[] {
  const current = resourcesFor(scene);
  return [
    ...previous.map(
      (old) => current.find((item) => item.key === old.key) ?? old,
    ),
    ...current.filter((item) => !previous.some((old) => old.key === item.key)),
  ];
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
}

export function useOrrerySwitchRuntime(
  pose: SharedValue<CameraPose>,
  reducedMotion: SharedValue<boolean>,
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

  const prune = useCallback((generation: number) => {
    setResources((current) => {
      const scene = latestScene.current;
      if (!scene || scene.generation !== generation) return current;
      return current.filter((resource) =>
        scene.world.some((body) => bodyKey(body) === resource.key),
      );
    });
  }, []);

  const finish = useCallback(
    (generation: number) => {
      "worklet";
      if (transition.value.generation !== generation) return;
      running.value = false;
      progress.value = 1;
      pose.value = { ...cameraTo.value };
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
      setResources((current) =>
        current.length ? mergeResources(current, scene) : resourcesFor(scene),
      );
      runOnUI(() => {
        "worklet";
        cancelAnimation(progress);
        const reduced = reducedMotion.value;
        if (!isSwitch || transition.value.generation === 0) {
          transition.value = beginSwitchChoreography(
            scene.world,
            scene.world,
            scene.generation,
            { intensity: 0, reducedMotion: reduced },
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
        const displayedCamera = interpolateCamera(
          cameraFrom.value,
          cameraTo.value,
          progress.value,
        );
        transition.value = beginSwitchChoreography(
          displayed,
          scene.world,
          scene.generation,
          { intensity, reducedMotion: reduced },
        );
        cameraFrom.value = displayedCamera;
        cameraTo.value = { ...destinationHome };
        progress.value = 0;
        startDriver(1, reduced, scene.generation);
      })();
    },
    [
      cameraFrom,
      cameraTo,
      progress,
      reducedMotion,
      running,
      startDriver,
      transition,
    ],
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
      const displayedCamera = interpolateCamera(
        cameraFrom.value,
        cameraTo.value,
        progress.value,
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

  return {
    transition,
    progress,
    cameraFrom,
    cameraTo,
    running,
    resources,
    publish,
    pause,
    resume,
  };
}

export function sampleOrrerySwitchCamera(
  from: CameraPose,
  to: CameraPose,
  progress: number,
): CameraPose {
  "worklet";
  return interpolateCamera(from, to, progress);
}
