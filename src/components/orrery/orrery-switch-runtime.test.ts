import { describe, expect, it, vi } from "vitest";
import type { CameraPose, WorldBody } from "@/logic/orrery-camera-logic";

vi.mock("react-native-reanimated", () => ({
  cancelAnimation: vi.fn(),
  ReduceMotion: { Never: "never" },
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
  useAnimatedReaction: vi.fn(),
  useSharedValue: (value: unknown) => ({ value }),
  withTiming: (value: unknown) => value,
}));

import {
  beginOrrerySwitchRuntime,
  createSettledOrrerySwitchRuntime,
  pauseOrrerySwitchRuntime,
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
