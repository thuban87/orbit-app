import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CameraPose, WorldBody } from "@/logic/orrery-camera-logic";
import { bodyKey } from "@/logic/orrery-frame";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";

/**
 * Single-render hook harness: the repo has no react-test-renderer, so React
 * hooks are identity/record stubs and Reanimated runs worklets synchronously.
 * `withTiming` records its completion callback instead of animating, so a test
 * decides when (and with which generation) a switch driver completes.
 */
const harness = vi.hoisted(() => ({
  state: { value: undefined as unknown },
  timings: [] as ((finished: boolean) => void)[],
  reactions: [] as ((current: unknown, previous: unknown) => void)[],
}));

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => {
    harness.state.value = initial;
    return [
      initial,
      (next: unknown) => {
        harness.state.value =
          typeof next === "function"
            ? (next as (current: unknown) => unknown)(harness.state.value)
            : next;
      },
    ];
  },
}));

vi.mock("react-native-reanimated", () => ({
  cancelAnimation: vi.fn(),
  ReduceMotion: { Never: "never" },
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
  useAnimatedReaction: (
    _prepare: unknown,
    react: (current: unknown, previous: unknown) => void,
  ) => {
    harness.reactions.push(react);
  },
  useSharedValue: (value: unknown) => ({ value }),
  withTiming: (
    _target: unknown,
    _config: unknown,
    callback?: (finished: boolean) => void,
  ) => {
    if (callback) harness.timings.push(callback);
    return 0;
  },
}));

import {
  beginOrrerySwitchRuntime,
  createSettledOrrerySwitchRuntime,
  type OrreryBodyResource,
  pauseOrrerySwitchRuntime,
  useOrrerySwitchRuntime as renderOrrerySwitchRuntimeOnce,
  resumeOrrerySwitchRuntime,
  sampleOrrerySwitchRuntime,
} from "./use-orrery-switch-runtime";

const sourceWorld: WorldBody[] = [
  { id: 0, kind: "sun", x: 0, y: 0, radius: 18, ringRadius: 0 },
  { id: 1, kind: "contact", x: 0, y: -80, radius: 12, ringRadius: 80 },
  { id: 2, kind: "contact", x: 90, y: 0, radius: 12, ringRadius: 90 },
];
const destinationWorld: WorldBody[] = [
  { id: 0, kind: "sun", x: 0, y: 0, radius: 18, ringRadius: 0 },
  { id: 2, kind: "contact", x: 0, y: 96, radius: 12, ringRadius: 96 },
  { id: 3, kind: "contact", x: -110, y: 0, radius: 12, ringRadius: 110 },
];
const sourceCamera: CameraPose = {
  x: 31,
  y: -24,
  zoom: 1.7,
  tilt: 0.3,
  yaw: -0.2,
  focalDistance: 420,
};
const homeCamera: CameraPose = {
  x: 0,
  y: 0,
  zoom: 0.9,
  tilt: 0,
  yaw: 0,
  focalDistance: 320,
};

const visibleGeometry = (
  sample: ReturnType<typeof sampleOrrerySwitchRuntime>,
) =>
  sample.world
    .filter((body) => body.opacity > 0)
    .map(({ interactive: _interactive, ...body }) => body);

describe("screen-owned Orrery switch runtime", () => {
  it("starts at the exact displayed world/camera and settles exactly at destination Home", () => {
    const settled = createSettledOrrerySwitchRuntime(
      sourceWorld,
      1,
      sourceCamera,
    );
    const running = beginOrrerySwitchRuntime(
      settled,
      destinationWorld,
      2,
      homeCamera,
      { intensity: 1, reducedMotion: false },
    );

    const first = sampleOrrerySwitchRuntime(running, 0);
    const before = sampleOrrerySwitchRuntime(settled, 1);
    expect(first.camera).toEqual(before.camera);
    expect(visibleGeometry(first)).toEqual(visibleGeometry(before));
    const completed = sampleOrrerySwitchRuntime(running, 1);
    expect(completed.camera).toEqual(homeCamera);
    expect(completed.world.filter((body) => body.opacity > 0)).toEqual(
      destinationWorld.map((body) => ({
        ...body,
        opacity: 1,
        interactive: true,
      })),
    );
  });

  it("re-targets from the displayed A->B sample rather than stale source geometry", () => {
    const ab = beginOrrerySwitchRuntime(
      createSettledOrrerySwitchRuntime(sourceWorld, 1, sourceCamera),
      destinationWorld,
      2,
      homeCamera,
      { intensity: 0.7, reducedMotion: false },
    );
    const displayed = sampleOrrerySwitchRuntime(ab, 0.53);
    const cWorld = destinationWorld.map((body) => ({
      ...body,
      x: body.x + 20,
    }));
    const bc = beginOrrerySwitchRuntime(
      { ...ab, progress: 0.53 },
      cWorld,
      3,
      { ...homeCamera, zoom: 0.75 },
      { intensity: 0.5, reducedMotion: false },
    );
    const retargeted = sampleOrrerySwitchRuntime(bc, 0);
    expect(retargeted.camera).toEqual(displayed.camera);
    expect(visibleGeometry(retargeted)).toEqual(visibleGeometry(displayed));
  });

  it("holds byte-identical progress, world, and camera across pause/remount/resume", () => {
    const running = {
      ...beginOrrerySwitchRuntime(
        createSettledOrrerySwitchRuntime(sourceWorld, 1, sourceCamera),
        destinationWorld,
        2,
        homeCamera,
        { intensity: 0.8, reducedMotion: false },
      ),
      progress: 0.47,
    };
    const paused = pauseOrrerySwitchRuntime(running);
    const departure = sampleOrrerySwitchRuntime(paused, paused.progress);
    expect(sampleOrrerySwitchRuntime(paused, paused.progress)).toEqual(
      departure,
    );
    const resumed = resumeOrrerySwitchRuntime(paused);
    expect(sampleOrrerySwitchRuntime(resumed, resumed.progress)).toEqual(
      departure,
    );
    expect(resumed.remainingFraction).toBeCloseTo(0.53);
  });

  it("Reduced Motion interpolates directly without angular or radial spectacle", () => {
    const reduced = beginOrrerySwitchRuntime(
      createSettledOrrerySwitchRuntime(sourceWorld, 1, sourceCamera),
      destinationWorld,
      2,
      homeCamera,
      { intensity: 1, reducedMotion: true },
    );
    const mid = sampleOrrerySwitchRuntime(reduced, 0.5);
    expect(mid.sample.accumulatedRotation).toBe(0);
    expect(mid.sample.angularVelocity).toBe(0);
    expect(reduced.transition.radialDisplacement).toBe(0);
  });
});

const sceneOf = (generation: number, world: WorldBody[]) =>
  ({ generation, world }) as unknown as OrrerySceneSnapshot;
const keysOf = (world: readonly WorldBody[]) => world.map(bodyKey);

function mountRuntime() {
  harness.state.value = undefined;
  harness.timings.length = 0;
  harness.reactions.length = 0;
  const pose = { value: { ...sourceCamera } };
  const reducedMotion = { value: false };
  const runtime = renderOrrerySwitchRuntimeOnce(
    pose as never,
    reducedMotion as never,
  );
  return {
    runtime,
    pose,
    reducedMotion,
    resources: () => harness.state.value as OrreryBodyResource[],
    entryKeys: () => runtime.transition.value.entries.map(({ key }) => key),
    /** Completes the most recent driver, as `withTiming` would on the UI thread. */
    complete: () => harness.timings[harness.timings.length - 1](true),
  };
}

describe("settled Orrery geometry retirement (RG-027, performance/AUD-PERF-001)", () => {
  beforeEach(() => {
    harness.timings.length = 0;
  });

  it("finish compacts the UI-thread choreography to the destination and prunes departed resources", () => {
    const mounted = mountRuntime();
    mounted.runtime.publish(sceneOf(1, sourceWorld), false, 0, sourceCamera);
    expect(mounted.entryKeys()).toEqual(keysOf(sourceWorld));

    mounted.runtime.publish(sceneOf(2, destinationWorld), true, 1, homeCamera);
    expect(mounted.entryKeys()).toEqual([
      "sun:0",
      "contact:1",
      "contact:2",
      "contact:3",
    ]);
    expect(mounted.runtime.running.value).toBe(true);
    const beforeSettle = sampleOrrerySwitchRuntime({
      transition: mounted.runtime.transition.value,
      progress: 1,
      cameraFrom: mounted.runtime.cameraFrom.value,
      cameraTo: mounted.runtime.cameraTo.value,
      status: "settled",
      remainingFraction: 0,
    }).world.filter((body) => body.opacity > 0);

    mounted.runtime.progress.value = 0.6;
    mounted.complete();

    expect(mounted.runtime.progress.value).toBe(1);
    expect(mounted.runtime.running.value).toBe(false);
    expect(mounted.pose.value).toEqual(homeCamera);
    expect(mounted.runtime.transition.value.generation).toBe(2);
    expect(mounted.entryKeys()).toEqual(keysOf(destinationWorld));
    expect(
      sampleOrrerySwitchRuntime({
        transition: mounted.runtime.transition.value,
        progress: 1,
        cameraFrom: homeCamera,
        cameraTo: homeCamera,
        status: "settled",
        remainingFraction: 0,
      }).world,
    ).toEqual(beforeSettle);
    expect(mounted.resources().map(({ key }) => key)).toEqual(
      keysOf(destinationWorld),
    );
  });

  it("a stale driver completion never compacts a switch that is still running", () => {
    const mounted = mountRuntime();
    const cWorld: WorldBody[] = [
      { id: 0, kind: "sun", x: 0, y: 0, radius: 18, ringRadius: 0 },
      { id: 4, kind: "contact", x: 0, y: -140, radius: 12, ringRadius: 140 },
    ];
    mounted.runtime.publish(sceneOf(1, sourceWorld), false, 0, sourceCamera);
    mounted.runtime.publish(sceneOf(2, destinationWorld), true, 1, homeCamera);
    const bDriver = harness.timings[0];
    mounted.runtime.progress.value = 0.4;
    mounted.runtime.publish(sceneOf(3, cWorld), true, 1, homeCamera);
    const running = mounted.entryKeys();
    expect(running).toEqual(
      expect.arrayContaining([
        "contact:1",
        "contact:2",
        "contact:3",
        "contact:4",
      ]),
    );

    bDriver(true);
    expect(mounted.entryKeys()).toEqual(running);
    expect(mounted.runtime.running.value).toBe(true);

    mounted.complete();
    expect(mounted.entryKeys()).toEqual(keysOf(cWorld));
    expect(mounted.resources().map(({ key }) => key)).toEqual(keysOf(cWorld));
  });
});
