import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CameraPose, WorldBody } from "@/logic/orrery-camera-logic";
import { bodyKey } from "@/logic/orrery-frame";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";

/**
 * Minimal hook harness: the repo has no react-test-renderer, so React and
 * Reanimated hooks are slot-based stubs (stable across re-renders, deps compared
 * like React) and Reanimated runs worklets synchronously. `withTiming` records
 * its completion callback instead of animating, so a test decides when (and
 * with which generation) a switch driver completes.
 */
const harness = vi.hoisted(() => {
  const state = {
    state: { value: undefined as unknown },
    timings: [] as ((finished: boolean) => void)[],
    reactions: [] as ((current: unknown, previous: unknown) => void)[],
    slots: [] as unknown[],
    cursor: 0,
  };
  const slot = <T>(init: () => T): { fresh: boolean; value: T } => {
    const index = state.cursor++;
    const fresh = index >= state.slots.length;
    if (fresh) state.slots[index] = init();
    return { fresh, value: state.slots[index] as T };
  };
  const sameDeps = (a: readonly unknown[], b: readonly unknown[]) =>
    a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  const memo = <T>(factory: () => T, deps: readonly unknown[]): T => {
    const cell = slot(() => ({ value: factory(), deps }));
    if (!cell.fresh && !sameDeps(cell.value.deps, deps)) {
      cell.value.value = factory();
      cell.value.deps = deps;
    }
    return cell.value.value;
  };
  return Object.assign(state, { slot, memo });
});

vi.mock("react", () => ({
  useCallback: (fn: unknown, deps: readonly unknown[]) =>
    harness.memo(() => fn, deps),
  useMemo: (factory: () => unknown, deps: readonly unknown[]) =>
    harness.memo(factory, deps),
  useEffect: () => {},
  useRef: (current: unknown) => harness.slot(() => ({ current })).value,
  useState: (initial: unknown) => {
    if (harness.slot(() => true).fresh) harness.state.value = initial;
    return [
      harness.state.value,
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
    if (harness.slot(() => true).fresh) harness.reactions.push(react);
  },
  useSharedValue: (value: unknown) => harness.slot(() => ({ value })).value,
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
  displayedSwitchCamera,
  nextOrreryResources,
  type OrreryBodyResource,
  pauseOrrerySwitchRuntime,
  pruneOrreryResources,
  useOrrerySwitchRuntime as renderOrrerySwitchRuntimeOnce,
  resumeOrrerySwitchRuntime,
  sampleOrrerySwitchCamera,
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
  harness.slots.length = 0;
  harness.cursor = 0;
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
    /** Re-renders the hook with the same inputs (React re-render semantics). */
    rerender: () => {
      harness.cursor = 0;
      return renderOrrerySwitchRuntimeOnce(
        pose as never,
        reducedMotion as never,
      );
    },
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

const cWorldOf = (): WorldBody[] => [
  { id: 0, kind: "sun", x: 0, y: 0, radius: 18, ringRadius: 0 },
  { id: 3, kind: "contact", x: 0, y: -60, radius: 12, ringRadius: 60 },
  { id: 5, kind: "contact", x: 70, y: 0, radius: 12, ringRadius: 70 },
];
const resourceKeys = (resources: readonly OrreryBodyResource[]) =>
  resources.map(({ key }) => key);
const generations = (resources: readonly OrreryBodyResource[]) => [
  ...new Set(resources.map(({ scene }) => scene.generation)),
];

describe("Orrery resource cardinality (RG-027, performance/AUD-PERF-001)", () => {
  const a = sceneOf(1, sourceWorld);
  const b = sceneOf(2, destinationWorld);
  const c = sceneOf(3, cWorldOf());

  it("a settled publication replaces resources with the current scene", () => {
    const current = nextOrreryResources([], a, false);
    const next = nextOrreryResources(current, b, false);
    expect(resourceKeys(next)).toEqual(keysOf(destinationWorld));
    expect(generations(next)).toEqual([2]);
  });

  it("a running switch keeps departures until the prune, which leaves only the destination", () => {
    const current = nextOrreryResources([], a, false);
    const running = nextOrreryResources(current, b, true);
    expect(resourceKeys(running)).toEqual([
      "sun:0",
      "contact:1",
      "contact:2",
      "contact:3",
    ]);
    const retained = running.find(({ key }) => key === "contact:2");
    expect(retained?.scene).toBe(b);
    const pruned = pruneOrreryResources(running, b);
    expect(resourceKeys(pruned)).toEqual(keysOf(destinationWorld));
    expect(generations(pruned)).toEqual([2]);
    expect(nextOrreryResources([], b, true)).toEqual(
      nextOrreryResources([], b, false),
    );
  });

  it("A->B->C completed switches retain only C resources and C geometry", () => {
    let resources = nextOrreryResources([], a, false);
    for (const scene of [b, c]) {
      resources = pruneOrreryResources(
        nextOrreryResources(resources, scene, true),
        scene,
      );
    }
    expect(resourceKeys(resources)).toEqual(keysOf(cWorldOf()));
    expect(generations(resources)).toEqual([3]);

    const mounted = mountRuntime();
    mounted.runtime.publish(a, false, 0, sourceCamera);
    for (const scene of [b, c]) {
      mounted.runtime.publish(scene, true, 1, homeCamera);
      mounted.complete();
      expect(mounted.entryKeys()).toEqual(keysOf(scene.world));
      expect(resourceKeys(mounted.resources())).toEqual(keysOf(scene.world));
      expect(mounted.runtime.transition.value.entries).toHaveLength(
        mounted.resources().length,
      );
    }
    expect(generations(mounted.resources())).toEqual([3]);
  });

  it("repeated same-System removals drop each removed body immediately", () => {
    const mounted = mountRuntime();
    let world = [...sourceWorld];
    mounted.runtime.publish(sceneOf(1, world), false, 0, sourceCamera);
    for (const [generation, removedId] of [
      [2, 2],
      [3, 1],
    ] as const) {
      world = world.filter((body) => body.id !== removedId);
      mounted.runtime.publish(sceneOf(generation, world), false, 0, homeCamera);
      expect(resourceKeys(mounted.resources())).toEqual(keysOf(world));
      expect(mounted.entryKeys()).toEqual(keysOf(world));
      expect(generations(mounted.resources())).toEqual([generation]);
    }
    expect(resourceKeys(mounted.resources())).toEqual(["sun:0"]);
  });

  it("an interrupted switch followed by a refresh leaves only the latest scene", () => {
    const mounted = mountRuntime();
    mounted.runtime.publish(a, false, 0, sourceCamera);
    mounted.runtime.publish(b, true, 1, homeCamera);
    mounted.runtime.progress.value = 0.35;
    mounted.runtime.publish(c, true, 0.8, homeCamera);
    expect(resourceKeys(mounted.resources())).toEqual(
      expect.arrayContaining([
        "contact:1",
        "contact:2",
        "contact:3",
        "contact:5",
      ]),
    );
    const refreshed = sceneOf(4, cWorldOf());
    mounted.runtime.publish(refreshed, false, 0, homeCamera);
    expect(resourceKeys(mounted.resources())).toEqual(keysOf(cWorldOf()));
    expect(generations(mounted.resources())).toEqual([4]);
    expect(mounted.entryKeys()).toEqual(keysOf(cWorldOf()));
    expect(mounted.runtime.running.value).toBe(false);
  });

  it("reduced-motion completion retains only destination entries and resources", () => {
    const published = mountRuntime();
    published.reducedMotion.value = true;
    published.runtime.publish(a, false, 0, sourceCamera);
    published.runtime.publish(b, true, 1, homeCamera);
    expect(published.runtime.transition.value.reducedMotion).toBe(true);
    published.complete();
    expect(published.entryKeys()).toEqual(keysOf(destinationWorld));
    expect(published.runtime.transition.value.reducedMotion).toBe(true);
    expect(resourceKeys(published.resources())).toEqual(
      keysOf(destinationWorld),
    );

    const toggled = mountRuntime();
    toggled.runtime.publish(a, false, 0, sourceCamera);
    toggled.runtime.publish(b, true, 1, homeCamera);
    toggled.runtime.progress.value = 0.3;
    toggled.reducedMotion.value = true;
    for (const react of harness.reactions) react(true, false);
    expect(toggled.runtime.transition.value.reducedMotion).toBe(true);
    toggled.complete();
    expect(toggled.entryKeys()).toEqual(keysOf(destinationWorld));
    expect(resourceKeys(toggled.resources())).toEqual(keysOf(destinationWorld));
    expect(generations(toggled.resources())).toEqual([2]);
  });

  it("settling an empty world yields zero entries and no resources", () => {
    const mounted = mountRuntime();
    mounted.runtime.publish(a, false, 0, sourceCamera);
    mounted.runtime.publish(sceneOf(2, []), true, 1, homeCamera);
    mounted.complete();
    expect(mounted.runtime.transition.value.entries).toEqual([]);
    expect(mounted.resources()).toEqual([]);
    mounted.runtime.publish(sceneOf(3, []), false, 0, homeCamera);
    expect(mounted.resources()).toEqual([]);
  });
});

describe("D-52 (6): a switch starts from the camera actually on screen", () => {
  const panned: CameraPose = { ...sourceCamera, x: -140, y: 65, zoom: 2.4 };

  it("displayedSwitchCamera returns the live pose once settled and the drawn sample before", () => {
    for (const progress of [1, 1.5]) {
      const shown = displayedSwitchCamera(
        sourceCamera,
        homeCamera,
        progress,
        panned,
      );
      expect(shown).toEqual(panned);
      expect(shown).not.toBe(panned);
    }
    for (const progress of [0, 0.25, 0.5, 0.999]) {
      expect(
        displayedSwitchCamera(sourceCamera, homeCamera, progress, panned),
      ).toEqual(sampleOrrerySwitchCamera(sourceCamera, homeCamera, progress));
    }
  });

  it("a publish after a settled publication starts cameraFrom at the live pose, not the stale target", () => {
    const mounted = mountRuntime();
    mounted.runtime.publish(sceneOf(1, sourceWorld), false, 0, sourceCamera);
    expect(mounted.runtime.cameraTo.value).toEqual(sourceCamera);
    mounted.pose.value = { ...panned };
    mounted.runtime.publish(sceneOf(2, destinationWorld), true, 1, homeCamera);
    expect(mounted.runtime.cameraFrom.value).toEqual(panned);
    expect(mounted.runtime.cameraTo.value).toEqual(homeCamera);
  });

  it("a publish after a completed switch starts from the live pose the user moved to", () => {
    const mounted = mountRuntime();
    mounted.runtime.publish(sceneOf(1, sourceWorld), false, 0, sourceCamera);
    mounted.runtime.publish(sceneOf(2, destinationWorld), true, 1, homeCamera);
    mounted.complete();
    expect(mounted.pose.value).toEqual(homeCamera);
    mounted.pose.value = { ...panned };
    mounted.runtime.publish(sceneOf(3, cWorldOf()), true, 1, homeCamera);
    expect(mounted.runtime.cameraFrom.value).toEqual(panned);
  });

  it("a mid-switch retarget still starts from the interpolated camera drawn that frame", () => {
    const mounted = mountRuntime();
    mounted.runtime.publish(sceneOf(1, sourceWorld), false, 0, sourceCamera);
    mounted.pose.value = { ...panned };
    mounted.runtime.publish(sceneOf(2, destinationWorld), true, 1, homeCamera);
    mounted.runtime.progress.value = 0.4;
    const drawn = sampleOrrerySwitchCamera(
      mounted.runtime.cameraFrom.value,
      mounted.runtime.cameraTo.value,
      0.4,
    );
    mounted.runtime.publish(sceneOf(3, cWorldOf()), true, 1, homeCamera);
    expect(mounted.runtime.cameraFrom.value).toEqual(drawn);
  });
});

describe("D-52 freeze: runtime identity", () => {
  it("returns the same runtime object across a re-render with unchanged inputs", () => {
    const mounted = mountRuntime();
    const again = mounted.rerender();
    expect(again).toBe(mounted.runtime);
    expect(again.publish).toBe(mounted.runtime.publish);
    expect(again.transition).toBe(mounted.runtime.transition);
  });

  it("changes identity only when something it owns changes (resources)", () => {
    const mounted = mountRuntime();
    mounted.runtime.publish(sceneOf(1, sourceWorld), false, 0, sourceCamera);
    const published = mounted.rerender();
    expect(published).not.toBe(mounted.runtime);
    expect(published.resources.map(({ key }) => key)).toEqual(
      keysOf(sourceWorld),
    );
    expect(mounted.rerender()).toBe(published);
  });
});

describe("D-53 keyed resource merge/prune", () => {
  /** FROZEN copies of the pre-38.7 implementations (do not edit). */
  const legacyResourcesFor = (scene: OrrerySceneSnapshot) =>
    scene.world.map((body) => ({ key: bodyKey(body), body, scene }));
  const legacyNext = (
    current: readonly OrreryBodyResource[],
    scene: OrrerySceneSnapshot,
    isSwitch: boolean,
  ): OrreryBodyResource[] => {
    if (!(isSwitch && current.length > 0)) return legacyResourcesFor(scene);
    const fresh = legacyResourcesFor(scene);
    return [
      ...current.map(
        (old) => fresh.find((item) => item.key === old.key) ?? old,
      ),
      ...fresh.filter((item) => !current.some((old) => old.key === item.key)),
    ];
  };
  const legacyPrune = (
    current: readonly OrreryBodyResource[],
    scene: OrrerySceneSnapshot,
  ) =>
    current.filter((resource) =>
      scene.world.some((body) => bodyKey(body) === resource.key),
    );

  let seed = 17;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const randomScene = (generation: number): OrrerySceneSnapshot => {
    const world: WorldBody[] = [];
    for (let id = 0; id < 60; id++) {
      if (random() < 0.5) continue;
      world.push(
        id === 0
          ? { id: 0, kind: "sun", x: 0, y: 0, radius: 18, ringRadius: 0 }
          : {
              id,
              kind: "contact",
              x: random() * 200,
              y: random() * 200,
              radius: 12,
              ringRadius: 80,
            },
      );
    }
    for (let i = world.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [world[i], world[j]] = [world[j], world[i]];
    }
    return sceneOf(generation, world);
  };

  it("merge and prune match the frozen old scans on randomised publication chains", () => {
    for (let chain = 0; chain < 40; chain++) {
      let current: OrreryBodyResource[] = [];
      let legacyCurrent: OrreryBodyResource[] = [];
      for (let step = 1; step <= 8; step++) {
        const scene = randomScene(step);
        const isSwitch = random() < 0.7;
        current = nextOrreryResources(current, scene, isSwitch);
        legacyCurrent = legacyNext(legacyCurrent, scene, isSwitch);
        expect(current).toEqual(legacyCurrent);
        // Same retained objects (keyed media survive), not just equal ones.
        current.forEach((resource, index) => {
          expect(resource.scene).toBe(legacyCurrent[index].scene);
        });
        if (random() < 0.5) {
          current = pruneOrreryResources(current, scene);
          legacyCurrent = legacyPrune(legacyCurrent, scene);
          expect(current).toEqual(legacyCurrent);
        }
      }
    }
  });
});

describe("38.7-05 (D-45): the switch camera carries the lens shift", () => {
  it("mixes lensShift with the other axes, falling back to 1 (centred)", () => {
    const tilted = { ...homeCamera, tilt: 1.0821, lensShift: 0.62 };
    expect(sampleOrrerySwitchCamera(sourceCamera, tilted, 0)).toEqual(
      sourceCamera,
    );
    expect(sampleOrrerySwitchCamera(sourceCamera, tilted, 0.5).lensShift).toBe(
      0.81,
    );
    expect(sampleOrrerySwitchCamera(sourceCamera, tilted, 1)).toEqual(tilted);
    expect(
      sampleOrrerySwitchCamera(
        { ...sourceCamera, lensShift: 0.4 },
        homeCamera,
        0.5,
      ).lensShift,
    ).toBeCloseTo(0.7, 12);
  });
});
