import { describe, expect, it, vi } from "vitest";
import { createOrreryGestures } from "@/components/orrery/use-orrery-camera";
import {
  type CameraPose,
  clampCameraPose,
  DOLLY_FOCAL_PX,
  HOME_CAMERA,
  HOME_PROFILES,
  MAX_USER_TILT,
  PAN_MAX_STEP_POINTS,
  projectWorldPoint,
  unprojectToWorldPlane,
  type WorldPoint,
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
          labelMagnification: 1,
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
    const activate = vi.fn();
    tilt.handlers.onTouchesDown({ allTouches: [{ y: 100 }, { y: 140 }] });
    tilt.handlers.onTouchesMove(
      { allTouches: [{ y: 110 }, { y: 150 }] },
      { activate },
    );
    expect(activate).not.toHaveBeenCalled();
    tilt.handlers.onTouchesMove(
      { allTouches: [{ y: 128 }, { y: 168 }] },
      { activate },
    );
    expect(activate).toHaveBeenCalledOnce();
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
  it("CR-02: the pointer count (the canvas `busy` input) returns to 0 once every recognizer finalized — after a tap, a pinch, a rotation and a hold", () => {
    type Native = { handlers: Record<string, (...args: unknown[]) => void> };
    function setup(withReorder: boolean) {
      const pose = { value: home };
      const frame = {
        get value() {
          return {
            generation: 7,
            pose: pose.value,
            viewport,
            bodies: [],
            center: { x: 200, y: 300 },
            labelMagnification: 1,
          };
        },
      };
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
      const send = vi.fn();
      const tree = createOrreryGestures({
        pose,
        frame,
        extent,
        send,
        stop: vi.fn(),
        camera: { input, samples, live: { value: true } },
        ...(withReorder
          ? {
              reorder: {
                drag: { value: null },
                expectation: {} as never,
                generation: 6, // ≠ the frame's: the hold fails at touch-down
                acknowledge: vi.fn(),
                commit: vi.fn(),
              },
            }
          : {}),
      }) as unknown as {
        gestures: [
          Native,
          Native | { gestures: [Native, { gestures: Native[] }] },
        ];
      };
      const [tap, rest] = tree.gestures;
      const hold = withReorder
        ? (rest as { gestures: [Native, { gestures: Native[] }] }).gestures[0]
        : null;
      const group = withReorder
        ? (rest as { gestures: [Native, { gestures: Native[] }] }).gestures[1]
        : (rest as unknown as { gestures: Native[] });
      const [pan, pinch, rotation, tilt] = group.gestures;
      /** A first finger down: every recognizer begins tracking. */
      const down = () => {
        tap.handlers.onBegin();
        pan.handlers.onBegin({ x: 200, y: 300 });
        pinch.handlers.onBegin();
        rotation.handlers.onBegin();
        tilt.handlers.onBegin();
        hold?.handlers.onBegin();
      };
      return { pose, input, send, tap, hold, pan, pinch, rotation, tilt, down };
    }
    // A tap: before, the pointer count stuck at 1 (busy forever).
    {
      const g = setup(false);
      g.down();
      expect(g.input.value.pointers).toBe(1);
      g.tap.handlers.onEnd({ x: 0, y: 0 }, true);
      expect(g.send).toHaveBeenCalledOnce();
      for (const r of [g.tap, g.pan, g.pinch, g.rotation])
        r.handlers.onFinalize({}, false);
      expect(g.input.value.pointers).toBe(1); // tilt still tracks the finger
      g.tilt.handlers.onFinalize({}, false);
      expect(g.input.value.pointers).toBe(0);
    }
    // A tap cancelled by the pan that wins the touch: ownership is untouched
    // and the pan still moves the camera (no reset mid-gesture).
    {
      const g = setup(false);
      g.down();
      g.tap.handlers.onFinalize({}, false);
      expect(g.input.value).toMatchObject({ owner: "pending", pointers: 1 });
      g.pan.handlers.onUpdate({
        numberOfPointers: 1,
        translationX: 20,
        translationY: 0,
      });
      expect(g.input.value.owner).toBe("pan");
      expect(g.pose.value.x).not.toBe(home.x);
      for (const r of [g.pinch, g.rotation, g.tilt, g.pan])
        r.handlers.onFinalize({}, false);
      expect(g.input.value.pointers).toBe(0);
    }
    // A pinch with a rotation: pointers 2 while either still tracks.
    {
      const g = setup(false);
      g.down();
      g.pan.handlers.onTouchesDown({ numberOfTouches: 2 });
      g.tap.handlers.onFinalize({}, false);
      g.pan.handlers.onFinalize({}, false);
      g.pinch.handlers.onStart({ scale: 1 });
      g.rotation.handlers.onStart({ rotation: 0 });
      g.pinch.handlers.onUpdate({
        numberOfPointers: 2,
        scale: 1.5,
        focalX: 200,
        focalY: 300,
      });
      expect(g.input.value).toMatchObject({ owner: "multi", pointers: 2 });
      g.pinch.handlers.onFinalize({}, false);
      expect(g.input.value.pointers).toBe(2);
      g.rotation.handlers.onFinalize({}, false);
      expect(g.input.value.pointers).toBe(2);
      g.tilt.handlers.onFinalize({}, false);
      expect(g.input.value.pointers).toBe(0);
    }
    // A rotation alone (the pinch recognizer never activates).
    {
      const g = setup(false);
      g.down();
      g.tap.handlers.onFinalize({}, false);
      g.pan.handlers.onFinalize({}, false);
      g.rotation.handlers.onStart({ rotation: 0 });
      g.rotation.handlers.onUpdate({ numberOfPointers: 2, rotation: 0.4 });
      expect(g.pose.value.yaw).toBeCloseTo(0.4);
      for (const r of [g.rotation, g.pinch, g.tilt])
        r.handlers.onFinalize({}, false);
      expect(g.input.value.pointers).toBe(0);
    }
    // With the reorder hold in the race: its tracking counts too.
    {
      const g = setup(true);
      g.down();
      g.hold?.handlers.onTouchesDown(
        { numberOfTouches: 1, allTouches: [{ x: 0, y: 0 }] },
        { fail: vi.fn() },
      );
      for (const r of [g.tap, g.pan, g.pinch, g.rotation, g.tilt])
        r.handlers.onFinalize({}, false);
      expect(g.input.value.pointers).toBe(1);
      g.hold?.handlers.onFinalize({}, false);
      expect(g.input.value.pointers).toBe(0);
    }
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
    expect(tilted.tilt).toBeCloseTo(MAX_USER_TILT);
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

describe("38.7-05 D-04: one-finger pan mapping at 0°, 45° and 62°", () => {
  const phone = {
    width: 412,
    height: 780,
    usable: { x: 0, y: 64, width: 412, height: 620 },
  };
  const panExtent = 3000;
  const tilts = [0, Math.PI / 4, HOME_PROFILES.tilted.tilt];
  /** A drag as the gesture delivers it: small steps, each from the finger. */
  const drag = (
    start: CameraPose,
    from: WorldPoint,
    dx: number,
    dy: number,
    steps = 10,
  ) => {
    let pose = start;
    for (let i = 0; i < steps; i++)
      pose = cameraGestureStep(
        pose,
        {
          kind: "pan",
          dx: dx / steps,
          dy: dy / steps,
          from: { x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps },
        },
        phone,
        panExtent,
      );
    return pose;
  };
  it.each(tilts)(
    "tilt %s: a 100 px drag starting at the pivot moves the pivot 100 px ± 1",
    (tilt) => {
      const pose = clampCameraPose(
        { ...HOME_CAMERA, tilt, zoom: 0.8, yaw: 0.3, x: 40, y: -60 },
        panExtent,
      );
      const pivot = { x: pose.x, y: pose.y };
      const at = projectWorldPoint(pivot, pose, phone);
      for (const [dx, dy] of [
        [100, 0],
        [0, 100],
        [0, -100],
        [-70.71, 70.71],
      ]) {
        const moved = projectWorldPoint(pivot, drag(pose, at, dx, dy), phone);
        expect(Math.abs(moved.x - (at.x + dx))).toBeLessThanOrEqual(1);
        expect(Math.abs(moved.y - (at.y + dy))).toBeLessThanOrEqual(1);
      }
    },
  );
  it.each(tilts)(
    "tilt %s: a drag starting halfway to the far rim keeps the touched content within ±25 % of the finger",
    (tilt) => {
      const rim = 720; // a ~20-ring System at Balanced spacing
      const pose = clampCameraPose(
        { ...HOME_CAMERA, tilt, zoom: 0.7 },
        panExtent,
      );
      const pivot = projectWorldPoint({ x: 0, y: 0 }, pose, phone);
      const far = projectWorldPoint({ x: 0, y: -rim }, pose, phone);
      const start = { x: pivot.x, y: (pivot.y + far.y) / 2 };
      const touched = unprojectToWorldPlane(start, pose, phone);
      for (const [dx, dy] of [
        [100, 0],
        [0, 100],
        [60, -80],
      ]) {
        const moved = projectWorldPoint(
          touched,
          drag(pose, start, dx, dy),
          phone,
        );
        expect(
          Math.hypot(moved.x - (start.x + dx), moved.y - (start.y + dy)),
        ).toBeLessThanOrEqual(0.25 * Math.hypot(dx, dy));
      }
    },
  );
  it.each(tilts)(
    "tilt %s: no update moves the pivot more than the capped step, and a drag from above the horizon never throws",
    (tilt) => {
      const pose = clampCameraPose(
        { ...HOME_CAMERA, tilt, zoom: 1.3 },
        panExtent,
      );
      const cap = PAN_MAX_STEP_POINTS / pose.zoom + 1e-9;
      const step = (from: WorldPoint | undefined, dx: number, dy: number) => {
        const next = cameraGestureStep(
          pose,
          { kind: "pan", dx, dy, from },
          phone,
          panExtent,
        );
        expect(Object.values(next).every(Number.isFinite)).toBe(true);
        expect(
          Math.hypot(next.x - pose.x, next.y - pose.y),
        ).toBeLessThanOrEqual(cap);
        return next;
      };
      step({ x: 206, y: 300 }, 4000, -3000);
      step(undefined, 0, 5000);
      if (tilt > 0) {
        // The horizon line: DOLLY_FOCAL_PX · cot(tilt) above the pivot.
        const pivot = projectWorldPoint({ x: 0, y: 0 }, pose, phone);
        const horizon = pivot.y - DOLLY_FOCAL_PX / Math.tan(tilt);
        for (const [dx, dy] of [
          [0, 100],
          [0, -100],
          [80, 20],
        ])
          step({ x: 206, y: horizon - 30 }, dx, dy);
        // Just below the horizon (perspective < the anchor minimum): fallback.
        step({ x: 206, y: horizon + 2 }, 0, 40);
      }
    },
  );
  it("the registered pan adapter anchors at the touch-down point", () => {
    const pose = {
      value: clampCameraPose(
        { ...HOME_CAMERA, tilt: HOME_PROFILES.tilted.tilt, zoom: 0.9 },
        panExtent,
      ),
    };
    const frame = {
      get value() {
        return {
          generation: 1,
          pose: pose.value,
          viewport: phone,
          bodies: [],
          center: null,
          labelMagnification: 1,
        };
      },
    };
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
      extent: panExtent,
      send: vi.fn(),
      stop: vi.fn(),
      camera: { input, samples, live: { value: true } },
    }) as unknown as { gestures: [Native, { gestures: Native[] }] };
    const pan = tree.gestures[1].gestures[0];
    const down = { x: 150, y: 330 };
    const touched = unprojectToWorldPlane(down, pose.value, phone);
    pan.handlers.onBegin(down);
    for (let i = 1; i <= 8; i++)
      pan.handlers.onUpdate({
        numberOfPointers: 1,
        translationX: i * 6,
        translationY: i * 9,
      });
    const moved = projectWorldPoint(touched, pose.value, phone);
    expect(moved.x).toBeCloseTo(down.x + 48, 6);
    expect(moved.y).toBeCloseTo(down.y + 72, 6);
  });
});
