import { describe, expect, it, vi } from "vitest";
import { createOrreryGestures } from "@/components/orrery/use-orrery-camera";
import { clampCameraPose, projectFrame } from "./orrery-camera-logic";
import { HOLD_MS, initialInput } from "./orrery-gesture-logic";
import type { ReorderDrag } from "./orrery-reorder-logic";
import {
  captureReorder,
  moveReorder,
  releaseReorder,
} from "./orrery-reorder-logic";

const request = {
  system: { kind: "builtin" as const, id: "all-contacts" as const },
  expectedFullOrderedIds: [1, 2, 3],
  expectedSavedSunContactId: null,
  expectedEligibleVisibleIds: [1, 2, 3],
  expectedContactIdentities: [
    { id: 1, uid: "a" },
    { id: 2, uid: "b" },
    { id: 3, uid: "c" },
  ],
};
const world = [1, 2, 3].map((id, i) => ({
  id,
  kind: "contact" as const,
  x: 0,
  y: -(60 + i * 40 + 30),
  radius: 10,
  ringRadius: 60 + i * 40,
}));
const frame = projectFrame(
  world,
  clampCameraPose({ x: 0, y: 0, zoom: 1, tilt: 0.5, yaw: 0.6 }, 300),
  { width: 500, height: 700 },
  7,
);
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
describe("deliberate ring drag", () => {
  it("stationary release remains same rank for drifted tilted/yawed targets, including off-center touch", () => {
    const body = frame.bodies[1];
    const captured = captureReorder(frame, request, body.x + 3, body.y + 2)!;
    expect(captured).not.toBeNull();
    const moved = moveReorder(captured, frame, body.x + 3, body.y + 2);
    expect(moved.reorderedVisibleIds).toEqual([1, 2, 3]);
    expect(releaseReorder(moved, 7, true)).toBeNull();
  });
  it("moves to the nearest eligible slot and emits only success in its captured generation", () => {
    const a = frame.bodies[0],
      c = frame.bodies[2];
    const captured = captureReorder(frame, request, a.x, a.y)!;
    const moved = moveReorder(captured, frame, c.x, c.y);
    expect(moved.reorderedVisibleIds).toEqual([2, 3, 1]);
    expect(
      releaseReorder(moved, 7, true)?.request.expectedContactIdentities,
    ).toEqual(request.expectedContactIdentities);
    expect(releaseReorder(moved, 8, true)).toBeNull();
    expect(releaseReorder(moved, 7, false)).toBeNull();
  });
  it("does not capture neutral or ambiguous targets", () => {
    const a = frame.bodies[0];
    expect(
      captureReorder(
        frame,
        { ...request, expectedEligibleVisibleIds: [2, 3] },
        a.x,
        a.y,
      ),
    ).toBeNull();
    expect(
      captureReorder(
        { ...frame, bodies: [...frame.bodies, { ...a, id: 4 }] },
        request,
        a.x,
        a.y,
      ),
    ).toBeNull();
  });
});

describe("registered hold recognizer", () => {
  function harness() {
    const drag = { value: null as ReorderDrag | null };
    const input = { value: initialInput() };
    const live = { value: true };
    const commit = vi.fn(),
      acknowledge = vi.fn();
    const current = { value: frame };
    const tree = createOrreryGestures({
      pose: { value: frame.pose },
      frame: current,
      extent: 300,
      send: vi.fn(),
      stop: vi.fn(),
      camera: {
        input,
        live,
        samples: {
          value: {
            panX: 0,
            panY: 0,
            scale: 1,
            rotation: 0,
            tiltY: 0,
            tiltActive: false,
          },
        },
      },
      reorder: {
        drag,
        expectation: request,
        generation: 7,
        acknowledge,
        commit,
      },
    }) as unknown as {
      gestures: [Native, { gestures: [Native, { gestures: Native[] }] }];
    };
    const [tap, group] = tree.gestures;
    const [hold, others] = group.gestures;
    const pan = others.gestures[0];
    tap.handlers.onBegin();
    pan.handlers.onBegin();
    const a = frame.bodies[0];
    hold.handlers.onTouchesDown(
      { numberOfTouches: 1, allTouches: [a] },
      { fail: vi.fn() },
    );
    const start = () =>
      hold.handlers.onStart({
        numberOfPointers: 1,
        translationX: 0,
        translationY: 0,
      });
    const move = () =>
      hold.handlers.onUpdate({ ...frame.bodies[2], numberOfPointers: 1 });
    return {
      hold,
      pan,
      drag,
      live,
      input,
      current,
      commit,
      acknowledge,
      start,
      move,
    };
  }
  type Native = {
    handlers: Record<string, (...args: unknown[]) => void>;
    config: Record<string, unknown>;
  };
  it("activates before movement, acknowledges once, previews, then commits only on successful release", () => {
    const h = harness();
    expect(h.hold.config.activateAfterLongPress).toEqual([HOLD_MS]);
    h.pan.handlers.onFinalize();
    expect(h.input.value.owner).toBe("pending");
    h.start();
    expect(h.drag.value?.active).toBe(true);
    expect(h.acknowledge).toHaveBeenCalledOnce();
    h.pan.handlers.onFinalize();
    expect(h.input.value.owner).toBe("reorder");
    h.move();
    expect(h.drag.value?.reorderedVisibleIds).toEqual([2, 3, 1]);
    h.hold.handlers.onEnd({ numberOfPointers: 1 }, true);
    h.hold.handlers.onFinalize();
    expect(h.commit).toHaveBeenCalledOnce();
    expect(h.drag.value).toBeNull();
  });
  it.each(["finalize", "failure", "pointer", "blur", "generation"])(
    "cancels %s without a write",
    (reason) => {
      const h = harness();
      h.start();
      h.move();
      if (reason === "finalize") h.hold.handlers.onFinalize();
      if (reason === "pointer")
        h.hold.handlers.onTouchesDown(
          { numberOfTouches: 2 },
          { fail: vi.fn() },
        );
      if (reason === "blur") h.live.value = false;
      if (reason === "generation")
        h.current.value = { ...frame, generation: 8 };
      h.hold.handlers.onEnd({ numberOfPointers: 1 }, reason !== "failure");
      h.hold.handlers.onFinalize();
      expect(h.commit).not.toHaveBeenCalled();
      expect(h.drag.value).toBeNull();
    },
  );
  it("movement before activation pans and never acknowledges or persists reorder", () => {
    const h = harness();
    h.pan.handlers.onUpdate({
      numberOfPointers: 1,
      translationX: 20,
      translationY: 0,
    });
    h.start();
    h.move();
    h.hold.handlers.onEnd({ numberOfPointers: 1 }, true);
    expect(h.acknowledge).not.toHaveBeenCalled();
    expect(h.commit).not.toHaveBeenCalled();
  });
});
