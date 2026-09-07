import { describe, expect, it, vi } from "vitest";
import { createOrreryGestures } from "@/components/orrery/use-orrery-camera";
import {
  clampCameraPose,
  projectWorldPoint,
  unprojectToWorldPlane,
} from "./orrery-camera-logic";
import {
  beginInput,
  cameraGestureStep,
  cancelInput,
  claimHold,
  HOLD_MS,
  initialInput,
  moveInput,
  PAN_DISTANCE,
  TILT_DISTANCE,
} from "./orrery-gesture-logic";

const viewport = { width: 400, height: 600 };
const extent = 1000;
const home = clampCameraPose({ x: 0, y: 0, zoom: 1 }, extent);

vi.mock("react-native-reanimated", () => ({ runOnJS: (fn: unknown) => fn }));
vi.mock("react-native-gesture-handler", () => {
  const builder = () => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const config: Record<string, unknown> = {};
    const chain = new Proxy(
      { handlers, config },
      {
        get(target, key: string) {
          if (key in target) return target[key as keyof typeof target];
          return (...args: unknown[]) => {
            if (key.startsWith("on"))
              handlers[key] = args[0] as (...args: unknown[]) => void;
            else config[key] = args;
            return chain;
          };
        },
      },
    );
    return chain;
  };
  return {
    Gesture: {
      Tap: builder,
      Pan: builder,
      Pinch: builder,
      Rotation: builder,
      Race: (...gestures: unknown[]) => ({ gestures }),
      Simultaneous: (...gestures: unknown[]) => ({ gestures }),
    },
  };
});
describe("camera input ownership", () => {
  it("registered adapters rebase pinch/rotation starts, gate actions, and keep finalize cleanup-only", () => {
    const pose = { value: home };
    const frame = {
      get value() {
        return {
          generation: 7,
          pose: pose.value,
          viewport,
          bodies: [],
          center: { x: 200, y: 300 },
        };
      },
    };
    const send = vi.fn(),
      stop = vi.fn();
    const live = { value: true };
    const input = { value: initialInput() };
    const samples = {
      value: {
        panX: 0,
        panY: 0,
        scale: 1,
        rotation: 0,
        tiltY: 0,
        tiltActive: false,
      },
    };
    type Native = { handlers: Record<string, (...args: unknown[]) => void> };
    const tree = createOrreryGestures({
      pose,
      frame,
      extent,
      send,
      stop,
      camera: { input, samples, live },
    }) as unknown as { gestures: [Native, { gestures: Native[] }] };
    const [tap, group] = tree.gestures;
    const [pan, pinch, rotation, tilt] = group.gestures;
    tap.handlers.onBegin();
    pan.handlers.onBegin();
    pan.handlers.onUpdate({
      numberOfPointers: 1,
      translationX: 20,
      translationY: 0,
    });
    expect(pose.value.x).toBe(-20);
    tap.handlers.onEnd({ x: 0, y: 0 }, true);
    expect(send).not.toHaveBeenCalled();
    pan.handlers.onTouchesDown({ numberOfTouches: 2 });
    pinch.handlers.onStart({ scale: 1.2 });
    const before = pose.value;
    pinch.handlers.onUpdate({
      numberOfPointers: 2,
      scale: 1.2,
      focalX: 230,
      focalY: 230,
    });
    expect(pose.value).toEqual(before);
    rotation.handlers.onStart({ rotation: 0.2 });
    pinch.handlers.onUpdate({
      numberOfPointers: 2,
      scale: 1.8,
      focalX: 230,
      focalY: 230,
    });
    rotation.handlers.onUpdate({ numberOfPointers: 2, rotation: 0.5 });
    expect(pose.value.zoom).toBeCloseTo(1.5);
    expect(pose.value.yaw).toBeCloseTo(0.3);
    tilt.handlers.onStart({ translationY: 30 });
    tilt.handlers.onUpdate({ numberOfPointers: 2, translationY: 40 });
    expect(pose.value.tilt).toBeCloseTo(0.04);
    live.value = false;
    const paused = pose.value;
    pinch.handlers.onUpdate({
      numberOfPointers: 2,
      scale: 3,
      focalX: 230,
      focalY: 230,
    });
    for (const gesture of group.gestures)
      gesture.handlers.onFinalize({}, false);
    tap.handlers.onEnd({ x: 0, y: 0 }, false);
    expect(pose.value).toEqual(paused);
    expect(send).not.toHaveBeenCalled();
    live.value = true;
    tap.handlers.onBegin();
    tap.handlers.onEnd({ x: 0, y: 0 }, true);
    expect(send).toHaveBeenCalledWith({
      kind: "clear",
      ids: [],
      generation: 7,
    });
  });
  it("movement before a stationary prolonged hold belongs to pan", () => {
    const pending = beginInput(initialInput(), 1);
    expect(claimHold(pending, HOLD_MS - 1, 0).owner).toBe("pending");
    const moved = moveInput(pending, 1, PAN_DISTANCE);
    expect(moved.owner).toBe("pan");
    expect(claimHold(moved, HOLD_MS + 1, 0).owner).toBe("pan");
    expect(claimHold(pending, HOLD_MS, 0).owner).toBe("reorder");
  });
  it("second pointer cancels rank ownership; release never revives a prior hold", () => {
    const held = claimHold(beginInput(initialInput(), 1), HOLD_MS, 0);
    const multi = moveInput(held, 2, 0);
    expect(multi.owner).toBe("multi");
    expect(multi.generation).toBeGreaterThan(held.generation);
    expect(moveInput(multi, 1, 0).owner).toBe("pan");
    expect(claimHold(moveInput(multi, 1, 0), HOLD_MS, 0).owner).toBe("pan");
    expect(cancelInput(multi).owner).toBe("cancelled");
  });
  it("pinch anchors the current world point and simultaneous yaw does not overwrite zoom", () => {
    const focal = { x: 250, y: 240 };
    const anchor = unprojectToWorldPlane(focal, home, viewport);
    const zoom = cameraGestureStep(
      home,
      { kind: "pinch", delta: 1.5, focal },
      viewport,
      extent,
    );
    const yaw = cameraGestureStep(
      zoom,
      { kind: "yaw", delta: 0.3 },
      viewport,
      extent,
    );
    expect(projectWorldPoint(anchor, zoom, viewport).x).toBeCloseTo(focal.x, 8);
    expect(projectWorldPoint(anchor, zoom, viewport).y).toBeCloseTo(focal.y, 8);
    expect(yaw.zoom).toBe(1.5);
    expect(yaw.yaw).toBeCloseTo(0.3);
  });
  it("tilt has a deliberate dead zone, bounded axes, and rebased zero deltas do not jump", () => {
    expect(
      cameraGestureStep(
        home,
        { kind: "tilt", delta: 5, travel: TILT_DISTANCE - 1 },
        viewport,
        extent,
      ),
    ).toEqual(home);
    const tilted = cameraGestureStep(
      home,
      { kind: "tilt", delta: 10000, travel: TILT_DISTANCE },
      viewport,
      extent,
    );
    expect(tilted.tilt).toBeCloseTo(Math.PI / 3);
    expect(
      cameraGestureStep(
        tilted,
        { kind: "pan", dx: 0, dy: 0 },
        viewport,
        extent,
      ),
    ).toEqual(tilted);
    expect(
      cameraGestureStep(
        tilted,
        { kind: "pinch", delta: 1, focal: { x: 200, y: 300 } },
        viewport,
        extent,
      ),
    ).toEqual(tilted);
  });
});
