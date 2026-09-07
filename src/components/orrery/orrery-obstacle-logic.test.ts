import { describe, expect, it } from "vitest";
import {
  deriveHomePose,
  frameBodies,
  projectWorldPoint,
  usableCameraRect,
} from "@/logic/orrery-camera-logic";
import {
  createShellObstacleStore,
  createWindowMeasurement,
} from "@/stores/shell-obstacle-store";
import {
  cameraControlState,
  canvasViewport,
  controlsRegion,
  northOrientation,
  polarisWorldPoint,
  resetNorthPose,
} from "./orrery-obstacle-logic";

describe("measured shell obstacles", () => {
  it("updates keyed rectangles without duplicate publications and removes invalid bounds", () => {
    const store = createShellObstacleStore();
    const rect = { x: 300, y: 500, width: 56, height: 56 };
    store.getState().publish("fab", rect);
    const same = store.getState();
    store.getState().publish("fab", { ...rect });
    expect(store.getState()).toBe(same);
    store.getState().publish("fab", { ...rect, y: 420 });
    expect(store.getState().rects.fab.y).toBe(420);
    for (const invalid of [
      null,
      { ...rect, width: 0 },
      { ...rect, x: NaN },
      { ...rect, height: Infinity },
    ]) {
      store.getState().publish("fab", rect);
      store.getState().publish("fab", invalid);
      expect(store.getState().rects).toEqual({});
    }
  });

  it("ignores delayed callbacks after relayout, hide and unmount", () => {
    const store = createShellObstacleStore();
    const measure = createWindowMeasurement((rect) =>
      store.getState().publish("fab", rect),
    );
    const old = measure.begin();
    const next = measure.begin();
    next(20, 30, 56, 56);
    old(900, 900, 56, 56);
    expect(store.getState().rects.fab.x).toBe(20);
    const pending = measure.begin();
    measure.clear();
    pending(1, 1, 56, 56);
    expect(store.getState().rects).toEqual({});
    measure.begin()(10, 20, 56, 56);
    const unmounted = measure.begin();
    measure.clear();
    unmounted(1, 1, 56, 56);
    expect(store.getState().rects).toEqual({});
  });

  it("subtracts actual canvas origin and clips partial/outside obstructions without double tab clearance", () => {
    const viewport = canvasViewport(
      { x: 10, y: 100, width: 400, height: 600 },
      [
        { x: 0, y: 0, width: 420, height: 100 },
        { x: 0, y: 700, width: 420, height: 80 },
        { x: 350, y: 620, width: 56, height: 56 },
        { x: 0, y: 680, width: 420, height: 40 },
      ],
    );
    expect(viewport.obstacles).toEqual([
      { x: 340, y: 520, width: 56, height: 56 },
      { x: 0, y: 580, width: 400, height: 20 },
    ]);
    expect(usableCameraRect(viewport)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 520,
    });
    expect(canvasViewport(null, []).width).toBe(0);
    expect(
      usableCameraRect(
        canvasViewport({ x: NaN, y: 0, width: 400, height: 600 }, []),
      ),
    ).toBeNull();
  });

  it("uses the translated region for Home and arbitrary focused bodies across shell relayout", () => {
    const world = [
      {
        id: 1,
        kind: "contact" as const,
        x: 30,
        y: 20,
        radius: 20,
        ringRadius: 40,
      },
    ];
    for (const y of [550, 400]) {
      const viewport = canvasViewport(
        { x: 0, y: 80, width: 400, height: 600 },
        [{ x: 0, y, width: 400, height: 160 }],
      );
      const home = deriveHomePose(world, viewport);
      expect(home).not.toBeNull();
      const origin = projectWorldPoint({ x: 0, y: 0 }, home!, viewport);
      expect(origin.y).toBe((y - 80) / 2);
      const framed = frameBodies(world, viewport, 100)!;
      expect(framed.fits).toBe(true);
      const point = projectWorldPoint(world[0], framed.pose, viewport);
      expect(point.y + world[0].radius * framed.pose.zoom).toBeLessThanOrEqual(
        y - 80,
      );
    }
  });
});

describe("reachable camera controls", () => {
  it("reserves the bottom-right column above FAB and tabs with 16 edge and 8 obstacle gaps", () => {
    const region = controlsRegion({
      width: 400,
      height: 700,
      obstacles: [
        { x: 0, y: 640, width: 400, height: 60 },
        { x: 324, y: 568, width: 56, height: 56 },
        { x: 220, y: 16, width: 164, height: 60 },
      ],
    });
    expect(region).toEqual({ x: 184, y: 84, width: 200, height: 476 });
    expect(region!.x + region!.width).toBe(384);
  });
  it("makes large-text controls scroll within the actual free column and rejects unavailable bounds", () => {
    expect(
      controlsRegion({
        width: 160,
        height: 300,
        obstacles: [{ x: 0, y: 240, width: 160, height: 60 }],
      }),
    ).toEqual({ x: 16, y: 16, width: 128, height: 216 });
    expect(controlsRegion({ width: 400, height: 0 })).toBeNull();
    expect(controlsRegion({ width: 40, height: 700 })).toBeNull();
    expect(
      controlsRegion({
        width: 400,
        height: 700,
        obstacles: [{ x: 0, y: 0, width: 400, height: 700 }],
      }),
    ).toBeNull();
  });
  it("enables Contacts during initial/load/error and guards only camera recovery before measurement", () => {
    expect(cameraControlState(false)).toEqual({
      contactsDisabled: false,
      recenterDisabled: true,
      northDisabled: true,
    });
    expect(cameraControlState(true)).toEqual({
      contactsDisabled: false,
      recenterDisabled: false,
      northDisabled: false,
    });
    expect(northOrientation(Math.PI / 2, false)).toBeUndefined();
    expect(northOrientation(Math.PI / 2, true)).toBe("90 degrees from north");
    expect(northOrientation(-Math.PI / 2, true)).toBe("270 degrees from north");
    expect(northOrientation(NaN, true)).toBeUndefined();
  });
  it("resets yaw alone and keeps Polaris a world landmark even without contacts", () => {
    const pose = {
      x: 45,
      y: -20,
      zoom: 2,
      tilt: 0.4,
      yaw: 1,
      focalDistance: 1200,
    };
    expect(resetNorthPose(pose)).toEqual({ ...pose, yaw: 0 });
    const point = polarisWorldPoint(1);
    expect(point.x).toBe(0);
    expect(point.y).toBeLessThan(0);
    const viewport = { width: 400, height: 600 };
    const north = projectWorldPoint(
      point,
      deriveHomePose([], viewport)!,
      viewport,
    );
    const east = projectWorldPoint(
      point,
      { ...deriveHomePose([], viewport)!, yaw: Math.PI / 2 },
      viewport,
    );
    expect(north.y).toBeLessThan(300);
    expect(east.x).toBeGreaterThan(200);
  });
});
