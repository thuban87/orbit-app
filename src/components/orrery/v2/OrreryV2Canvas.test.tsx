/**
 * 38.7-08 (D-49): the canvas wiring of the quantised ambient value and the
 * base bake. Unlike orrery-render.test.tsx, this harness MEMOISES derived
 * values by their tracked inputs (as Reanimated does), so it can prove that an
 * unchanged ambient tick re-records nothing and that the base swaps to a
 * snapshot and back by picture identity. The draw modules are stubs that
 * record which inputs each picture read.
 */
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rt = vi.hoisted(() => {
  type Dep = { version: number; read(): unknown };
  let tracking: Set<Dep> | null = null;
  const reactions: {
    prepare: () => unknown;
    react: (value: unknown, previous: unknown) => void;
    previous: unknown;
  }[] = [];
  const frames: (() => void)[] = [];
  function sv<T>(initial: T) {
    let value = initial;
    const dep: Dep = { version: 0, read: () => value };
    return {
      dep,
      get value(): T {
        tracking?.add(dep);
        return value;
      },
      set value(next: T) {
        value = next;
        dep.version++;
      },
    };
  }
  function derived<T>(fn: () => T) {
    let cached: T | undefined;
    let deps: Map<Dep, number> | null = null;
    const dep: Dep = { version: 0, read: () => get() };
    function stale(): boolean {
      if (!deps) return true;
      for (const [d, version] of deps) {
        d.read();
        if (d.version !== version) return true;
      }
      return false;
    }
    function get(): T {
      if (stale()) {
        const outer = tracking;
        const seen = new Set<Dep>();
        tracking = seen;
        let out: T;
        try {
          out = fn();
        } finally {
          tracking = outer;
        }
        deps = new Map([...seen].map((d) => [d, d.version]));
        if (out !== cached) dep.version++;
        cached = out;
      }
      return cached as T;
    }
    return {
      dep,
      get value(): T {
        tracking?.add(dep);
        return get();
      },
    };
  }
  return {
    sv,
    derived,
    reactions,
    frames,
    clock: null as null | { value: number },
    reduced: null as unknown as { value: boolean },
    clockCalls: 0,
    reducedState: false,
    host: {} as Record<string, unknown>,
    surfaces: 0,
    log: [] as string[],
    pictures: 0,
    pulseScans: 0,
  };
});

/** Runs every reaction (prepare → react), then the queued UI frames. */
function flush(passes = 1) {
  for (let pass = 0; pass < passes; pass++) {
    for (const reaction of rt.reactions) {
      const value = reaction.prepare();
      reaction.react(value, reaction.previous);
      reaction.previous = value;
    }
    for (const frame of rt.frames.splice(0)) frame();
  }
}

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => unknown) => {
    effect();
  },
}));
vi.mock("react-native-reanimated", () => ({
  default: { View: "animatedView" },
  useAnimatedStyle: (fn: () => unknown) => rt.derived(fn),
  withTiming: (value: unknown) => value,
  useSharedValue: (value: unknown) => rt.sv(value),
  useDerivedValue: (fn: () => unknown) => rt.derived(fn),
  useAnimatedReaction: (
    prepare: () => unknown,
    react: (value: unknown, previous: unknown) => void,
  ) => {
    rt.reactions.push({ prepare, react, previous: null });
  },
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
}));
vi.mock("react-native-gesture-handler", () => ({
  GestureDetector: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/theme/use-reduced-motion", () => ({
  useReducedMotionShared: () => rt.reduced,
  useReducedMotion: () => rt.reducedState,
}));
vi.mock("@shopify/react-native-skia", () => {
  const recorder = (ops: unknown[][]) =>
    new Proxy(
      {},
      {
        get:
          (_t, op: string) =>
          (...args: unknown[]) => {
            ops.push([op, ...args]);
          },
      },
    );
  return {
    Canvas: "skCanvas",
    Picture: "skPicture",
    FilterMode: { Nearest: 0 },
    MipmapMode: { None: 0 },
    useClock: () => {
      rt.clockCalls++;
      rt.clock = rt.sv(0);
      return rt.clock;
    },
    createPicture: (draw: (canvas: unknown) => void) => {
      const ops: unknown[][] = [];
      draw(recorder(ops));
      return { id: ++rt.pictures, ops, dispose: () => {} };
    },
    Skia: {
      XYWHRect: (x: number, y: number, width: number, height: number) => ({
        x,
        y,
        width,
        height,
      }),
      Surface: {
        MakeOffscreen: (w: number, h: number) => {
          rt.surfaces++;
          const ops: unknown[][] = [];
          return {
            ops,
            getCanvas: () => recorder(ops),
            flush: () => {},
            makeImageSnapshot: () => ({
              label: `snapshot ${w}x${h}`,
              dispose: () => rt.log.push("dispose image"),
            }),
            dispose: () => rt.log.push("dispose surface"),
          };
        },
      },
    },
  };
});
vi.mock("./render-host", () => ({
  resolveOrreryRenderHost: () => ({
    platform: "android",
    opaqueCanvas: false,
    ambientDriver: "frame-clock",
    bakePath: "none",
    ringMethod: "world-plane",
    ringFieldMinRings: 400,
    devicePixelRatio: () => 2,
    ...rt.host,
  }),
}));
vi.mock("./scene-specs", () => ({
  ORRERY_LAYER: {
    sky: "sky",
    base: "base",
    bodiesBehind: "bodiesBehind",
    sun: "sun",
    bodiesFront: "bodiesFront",
    labels: "labels",
  },
  baseHandle: (epoch: number, id: number) => `b|${epoch}|${id}`,
}));
// Draw stubs: each records the inputs its picture read.
vi.mock("./draw-sky", () => ({
  // 38.7-09: the sky reads its spec, the baked image, the frame's pose and
  // the ambient value (−1 = still).
  drawSky: (
    canvas: { sky(...tags: unknown[]): void },
    sky: { tag: unknown },
    image: { generation: number },
    pose: { tag?: unknown },
    ambient: number,
  ) => canvas.sky(sky.tag, image.generation, pose.tag, ambient),
}));
vi.mock("./draw-plane", () => ({
  // 38.7-15: the base key — a frame's `ringTag` (what its rings and grid
  // depend on), else its tag. A spinning world under a still camera keeps it.
  basePlaneKey: (frame: { tag: unknown; ringTag?: unknown }) => ({
    tag: frame.ringTag ?? frame.tag,
  }),
  sameBasePlaneKey: (
    key: { tag: unknown },
    frame: { tag: unknown; ringTag?: unknown },
  ) => key.tag === (frame.ringTag ?? frame.tag),
  drawPlaneRings: (
    canvas: { rings(tag: unknown): void },
    frame: { tag: unknown },
  ) => canvas.rings(frame.tag),
  // 38.7-09: the grid (base) and the pulses (their own ambient picture).
  drawPlaneGrid: (
    canvas: { grid(opacity: unknown): void },
    _frame: unknown,
    grid: { opacity: number },
  ) => {
    if (grid.opacity > 0) canvas.grid(grid.opacity);
  },
  // The eligible-ring scan: counted, so a test can prove an ambient tick
  // reuses it (38.7-09, cheaper pulses).
  pulseRings: (frame: { tag: unknown }, specs: unknown) => {
    rt.pulseScans++;
    return { frame: frame.tag, specs };
  },
  drawPlanePulses: (
    canvas: { pulses(ms: unknown): void },
    _rings: unknown,
    pulse: { budget: number },
    ambient: number,
  ) => {
    if (ambient >= 0 && pulse.budget > 0) canvas.pulses(ambient);
  },
  ringBands: () => null,
  gridDisc: () => null,
}));
vi.mock("./draw-bodies", () => ({
  orderBodies: () => [],
  drawBodies: () => {},
  drawSun: (
    canvas: { sun(p: unknown): void },
    _f: unknown,
    _b: unknown,
    _o: unknown,
    pulse: unknown,
  ) => canvas.sun(pulse),
  sunPulse: (ms: number, reduced: boolean) => (reduced ? 0 : ms),
}));
vi.mock("./draw-labels", () => ({ drawLabels: () => {} }));
// 38.7-13: the orbit streaks record the frame and signal they drew.
vi.mock("./draw-switch", () => ({
  drawOrbitTrails: (
    canvas: { trails(frame: unknown, trail: unknown): void },
    frame: { tag: unknown },
    _specs: unknown,
    signal: { trail: number },
  ) => canvas.trails(frame.tag, signal.trail),
}));
vi.mock("./draw-overlay", () => ({ drawOverlay: () => {} }));
vi.mock("./shaders", () => ({ orreryShader: () => null }));

import { AMBIENT_STEP_MS } from "./ambient-clock";
import { BAKE_AFTER_STILL_TICKS, EMPTY_BAKE_REGISTRY } from "./base-bake";
import { COVER_PRESENT_TIMEOUT_MS } from "./cover-gate";
import { OrreryV2Canvas } from "./OrreryV2Canvas";

interface Node {
  type: string;
  props: Record<string, unknown>;
  children: Node[];
}
function resolve(node: ReactNode): Node[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function")
    return resolve(
      (element.type as (props: unknown) => ReactNode)(element.props),
    );
  if (typeof element.type !== "string") return resolve(element.props.children);
  return [
    {
      type: element.type,
      props: element.props,
      children: resolve(element.props.children),
    },
  ];
}

beforeEach(() => {
  rt.reactions.length = 0;
  rt.frames.length = 0;
  rt.clock = null;
  rt.reduced = rt.sv(false);
  rt.clockCalls = 0;
  rt.reducedState = false;
  rt.host = {};
  rt.surfaces = 0;
  rt.log = [];
  rt.pulseScans = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    rt.frames.push(callback);
    return rt.frames.length;
  });
});

function mount() {
  const props = {
    width: 400,
    height: 800,
    gesture: {} as never,
    frame: rt.sv({ tag: "frame-1", pose: { tag: "pose-1" } }),
    sky: rt.sv({ tag: "sky-1" }),
    skyImage: rt.sv({ generation: 0, mountEpoch: 0, image: null, key: "" }),
    coverColor: "sky-base-token",
    ringSpecs: rt.sv({}),
    plane: rt.sv({
      grid: { opacity: 0 },
      pulse: { budget: 8, intensity: 0.25 },
    }),
    switchFx: rt.sv({ generation: 1, trail: 0, warp: 0 }),
    switchRoles: rt.sv({ generation: 1, byKey: {} }),
    trailLook: { peak: 0.42, additive: true, budget: 120 },
    overlay: rt.sv({}),
    reorder: rt.sv(null),
    hold: rt.sv({ charge: 0, flash: 1, reduced: false }),
    focus: rt.sv({ spec: {}, mix: 0, lock: 2 }),
    occlusion: rt.sv([]),
    bodies: rt.sv({ generation: 1, mountEpoch: 1, bodies: [] }),
    ackRecorded: vi.fn(),
    labels: rt.sv({ generation: 1, mountEpoch: 1 }),
    allocationIndex: rt.sv({}),
    busy: rt.sv(false),
    bakeRegistry: rt.sv(EMPTY_BAKE_REGISTRY),
    onBaseBaked: vi.fn(),
  };
  const tree = resolve(OrreryV2Canvas(props as never));
  const layer = (i: number) =>
    (
      tree[0].children[i].props.picture as {
        value: { id: number; ops: unknown[][] };
      }
    ).value;
  return { props, tree, layer };
}
/** A mounted tree's layer `i` (its recorded picture). */
const mountedLayer = (tree: ReturnType<typeof mount>["tree"], i: number) =>
  (
    tree[0].children[i].props.picture as {
      value: { id: number; ops: unknown[][] };
    }
  ).value;
const SKY = 0;
const BASE = 1;
const PULSES = 2;
const SWITCH = 3;
const SUN = 5;

describe("OrreryV2Canvas: the quantised ambient value (D-49)", () => {
  it("frame-clock: ONE useClock; an unchanged quantised tick re-records nothing", () => {
    const { tree, layer } = mount();
    expect(rt.clockCalls).toBe(1);
    expect(tree[0].children.map((n) => n.type)).toEqual(
      Array(9).fill("skPicture"),
    );
    flush();
    const first = layer(SKY);
    expect(first.ops).toEqual([["sky", "sky-1", 0, "pose-1", 0]]);
    const clock = rt.clock as { value: number };
    clock.value = 20; // inside the first step
    flush();
    expect(layer(SKY)).toBe(first);
    expect(layer(SUN).ops).toEqual([["sun", 0]]);
    clock.value = 40; // the next step
    flush();
    expect(layer(SKY)).not.toBe(first);
    expect(layer(SKY).ops).toEqual([
      ["sky", "sky-1", 0, "pose-1", AMBIENT_STEP_MS],
    ]);
  });
  it("reduced motion freezes every ambient consumer at −1 and stops re-recording", () => {
    const { layer } = mount();
    const clock = rt.clock as { value: number };
    clock.value = 40;
    flush();
    expect(layer(SKY).ops).toEqual([
      ["sky", "sky-1", 0, "pose-1", AMBIENT_STEP_MS],
    ]);
    rt.reduced.value = true;
    flush();
    const still = layer(SKY);
    expect(still.ops).toEqual([["sky", "sky-1", 0, "pose-1", -1]]);
    expect(layer(SUN).ops).toEqual([["sun", 0]]);
    clock.value = 5000;
    flush();
    expect(layer(SKY)).toBe(still);
  });
  it("interval: no useClock; JS ticks write the value", () => {
    vi.useFakeTimers({
      toFake: ["setInterval", "clearInterval", "Date"],
    });
    rt.host = { ambientDriver: "interval" };
    const { layer } = mount();
    expect(rt.clockCalls).toBe(0);
    const first = layer(SKY);
    vi.advanceTimersByTime(AMBIENT_STEP_MS * 3 + 1);
    expect(layer(SKY)).not.toBe(first);
    vi.useRealTimers();
  });
});

describe("OrreryV2Canvas: the base bake (D-49, H3)", () => {
  /** Advances the clock one ambient step per pass. */
  function settle(steps: number) {
    const clock = rt.clock as { value: number };
    for (let i = 0; i < steps; i++) {
      clock.value += AMBIENT_STEP_MS + 1;
      flush();
    }
  }
  it("bakes once still, blits the snapshot, acks it, and falls back to live the moment the scene moves", () => {
    rt.host = { bakePath: "gpu-offscreen" };
    const { props, layer } = mount();
    flush();
    expect(layer(BASE).ops).toEqual([["rings", "frame-1"]]);
    settle(BAKE_AFTER_STILL_TICKS + 2);
    expect(rt.surfaces).toBe(1);
    expect(props.onBaseBaked).toHaveBeenCalledTimes(1);
    expect(props.onBaseBaked).toHaveBeenLastCalledWith(1, 1, 1);
    const baked = layer(BASE);
    expect(baked.ops[0][0]).toBe("drawImageRectOptions");
    expect(baked.ops[0][2]).toEqual({ x: 0, y: 0, width: 800, height: 1600 });
    expect(props.ackRecorded).toHaveBeenCalledWith("base", 1, 1);
    // Ambient keeps ticking: the snapshot stays, no re-bake.
    settle(5);
    expect(layer(BASE)).toBe(baked);
    expect(rt.surfaces).toBe(1);
    // The scene moves: the base is live AT ONCE (before any reaction ran)…
    props.frame.value = { tag: "frame-2", pose: { tag: "pose-2" } };
    expect(layer(BASE).ops).toEqual([["rings", "frame-2"]]);
    // …and the reaction publishes the live generation, which the base acks.
    flush(2);
    expect(props.onBaseBaked).toHaveBeenLastCalledWith(1, 2, null);
    expect(props.ackRecorded).toHaveBeenLastCalledWith("base", 2, 1);
    // Still again: a second snapshot, from the same surface.
    settle(BAKE_AFTER_STILL_TICKS + 1);
    expect(props.onBaseBaked).toHaveBeenLastCalledWith(1, 3, 2);
    expect(rt.surfaces).toBe(1);
    expect(Object.keys(props.bakeRegistry.value.snapshots)).toEqual(["1", "2"]);
  });
  it("never bakes while busy (switch, gesture or camera motion)", () => {
    rt.host = { bakePath: "gpu-offscreen" };
    const { props } = mount();
    props.busy.value = true;
    flush();
    settle(BAKE_AFTER_STILL_TICKS * 3);
    expect(props.onBaseBaked).not.toHaveBeenCalled();
    expect(rt.surfaces).toBe(0);
    props.busy.value = false;
    settle(BAKE_AFTER_STILL_TICKS + 1);
    expect(props.onBaseBaked).toHaveBeenCalledTimes(1);
  });
  it("bake off (the host default today): the base is always live and nothing is published", () => {
    const { props, layer } = mount();
    flush();
    settle(BAKE_AFTER_STILL_TICKS * 3);
    expect(props.onBaseBaked).not.toHaveBeenCalled();
    expect(rt.surfaces).toBe(0);
    expect(layer(BASE).ops[0]).toEqual(["rings", "frame-1"]);
    expect(props.ackRecorded).not.toHaveBeenCalledWith(
      "base",
      expect.anything(),
      expect.anything(),
    );
  });
});

describe("OrreryV2Canvas: the painted sky layer (38.7-09)", () => {
  it("is the bottom picture; it acks each baked sky image generation (H3/C-H2)", () => {
    const { props, layer } = mount();
    flush();
    expect(layer(SKY).ops[0][0]).toBe("sky");
    expect(props.ackRecorded).not.toHaveBeenCalledWith(
      "sky",
      expect.anything(),
      expect.anything(),
    );
    // The neutral bake lands: generation 1 of epoch 1.
    props.skyImage.value = {
      generation: 1,
      mountEpoch: 1,
      image: { tag: "image-1" } as never,
      key: "galaxy/dark/512x896",
    };
    flush(2);
    expect(layer(SKY).ops[0]).toEqual(["sky", "sky-1", 1, "pose-1", 0]);
    expect(props.ackRecorded).toHaveBeenCalledWith("sky", 1, 1);
  });

  it("a System change (a new sky spec) re-records only the sky, never the base", () => {
    const { props, layer } = mount();
    flush();
    const base = layer(BASE);
    const sky = layer(SKY);
    props.sky.value = { tag: "sky-2" };
    flush();
    expect(layer(SKY)).not.toBe(sky);
    expect(layer(SKY).ops[0][1]).toBe("sky-2");
    expect(layer(BASE)).toBe(base);
  });

  it("an ambient tick re-records the ambient layers (sky, pulses, sun) and nothing else", () => {
    const { tree, layer } = mount();
    flush();
    const before = tree[0].children.map((_, i) => layer(i));
    const clock = rt.clock as { value: number };
    clock.value = AMBIENT_STEP_MS * 4;
    flush();
    const after = tree[0].children.map((_, i) => layer(i));
    const changed = after
      .map((picture, i) => (picture === before[i] ? null : i))
      .filter((i) => i !== null);
    // C3-L4: the sky (drift, twinkle), the orbit pulses and the sun pulse.
    expect(changed).toEqual([SKY, PULSES, SUN]);
  });

  it("38.7-13: the switch layer is one shared empty picture at rest; streaks record per frame only while the signal trails", () => {
    const { props, layer } = mount();
    flush();
    const rest = layer(SWITCH);
    expect(rest.ops).toEqual([]);
    // A pan at rest re-records nothing here (the same empty picture).
    props.frame.value = { tag: "frame-2", pose: { tag: "pose-2" } };
    flush();
    expect(layer(SWITCH)).toBe(rest);
    // Mid-switch: one recording per frame, of that frame.
    props.switchFx.value = { generation: 2, trail: 0.8, warp: 0.5 };
    flush();
    const mid = layer(SWITCH);
    expect(mid.ops).toEqual([["trails", "frame-2", 0.8]]);
    props.frame.value = { tag: "frame-3", pose: { tag: "pose-3" } };
    flush();
    expect(layer(SWITCH)).not.toBe(mid);
    expect(layer(SWITCH).ops).toEqual([["trails", "frame-3", 0.8]]);
    // Settled (or reduced motion): back to the shared empty picture.
    props.switchFx.value = { generation: 2, trail: 0, warp: 0 };
    flush();
    expect(layer(SWITCH)).toBe(rest);
  });

  it("opaque canvas: a non-touchable cover in the sky base colour lifts only once the content frame is presented (38.7-15)", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    rt.host = { opaqueCanvas: true };
    const { tree, props } = mount();
    // The native view (ref): the presented probe's arm calls.
    const armed: number[] = [];
    (tree[0].props.ref as { current: unknown }).current = {
      getNativeId: () => null,
      armPresentProbe: (token: number) => armed.push(token),
    };
    const answer = tree[0].props.onAndroidPresented as (event: {
      token: number;
      outcome: string;
    }) => void;
    const cover = tree[1];
    expect(cover.type).toBe("animatedView");
    expect(cover.props.pointerEvents).toBe("none");
    const [box, animated] = cover.props.style as [
      Record<string, unknown>,
      { value: { opacity: number } },
    ];
    expect(box).toMatchObject({
      position: "absolute",
      backgroundColor: "sky-base-token",
      width: 400,
      height: 800,
    });
    expect(animated.value.opacity).toBe(1);
    // A warm return whose body specs have not been published yet.
    props.bodies.value = { generation: 0, mountEpoch: 0, bodies: [] };
    // The layers are recorded, but the native surface has not reported yet:
    // the cover stays.
    flush(2);
    expect(animated.value.opacity).toBe(1);
    // Until the surface exists (plus two frames), the first-frame state
    // draws the sky's plain gradient (no baked nebula) and no other layer:
    // the first buffer posts at once and is the theme's sky.
    const sky = mountedLayer(tree, 0);
    expect(sky.ops[0]).toEqual(["sky", "sky-1", 0, "pose-1", 0]);
    expect(mountedLayer(tree, 1).ops).toEqual([]);
    // No native view API in node: the bounded fallback reports the surface;
    // two UI frames later the full scene records.
    vi.advanceTimersByTime(1000);
    flush(3);
    expect(mountedLayer(tree, 1).ops).toEqual([["rings", "frame-1"]]);
    // No content yet (no body specs): nothing is armed, the cover stays.
    flush(2);
    expect(armed).toEqual([]);
    expect(animated.value.opacity).toBe(1);
    // The specs land: the probe is armed for the frame just recorded…
    props.bodies.value = { generation: 1, mountEpoch: 1, bodies: [] };
    flush(1);
    expect(armed).toHaveLength(1);
    // …and the cover waits for ITS answer (not a proxy, not another token).
    flush(4);
    answer({ token: armed[0] + 1, outcome: "presented" });
    expect(animated.value.opacity).toBe(1);
    answer({ token: armed[0], outcome: "presented" });
    expect(animated.value.opacity).toBe(0);
    vi.useRealTimers();
  });

  it("opaque canvas: without an answer the cover still lifts (bounded: it never sticks)", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    rt.host = { opaqueCanvas: true };
    const { tree } = mount();
    const [, animated] = tree[1].props.style as [
      unknown,
      { value: { opacity: number } },
    ];
    vi.advanceTimersByTime(1000);
    flush(3);
    // Armed (no native view in node: nothing answers).
    expect(animated.value.opacity).toBe(1);
    vi.advanceTimersByTime(COVER_PRESENT_TIMEOUT_MS);
    expect(animated.value.opacity).toBe(0);
    vi.useRealTimers();
  });

  it("translucent canvas: no cover", () => {
    const { tree } = mount();
    expect(tree).toHaveLength(1);
  });
});

describe("OrreryV2Canvas: grid and orbit pulses (38.7-09: D-09, D-10, D-37)", () => {
  it("the grid draws in the (baked) base only above opacity 0", () => {
    const { props, layer } = mount();
    flush();
    expect(layer(BASE).ops).toEqual([["rings", "frame-1"]]);
    props.plane.value = {
      grid: { opacity: 0.12 },
      pulse: { budget: 8, intensity: 0.25 },
    };
    flush();
    expect(layer(BASE).ops).toEqual([
      ["grid", 0.12],
      ["rings", "frame-1"],
    ]);
  });

  it("pulses move on ambient ticks, never in the base; reduced motion freezes them", () => {
    const { layer } = mount();
    const clock = rt.clock as { value: number };
    clock.value = AMBIENT_STEP_MS * 2;
    flush();
    const base = layer(BASE);
    expect(layer(PULSES).ops).toEqual([["pulses", AMBIENT_STEP_MS * 2]]);
    clock.value = AMBIENT_STEP_MS * 5 + 1;
    flush();
    const moved = layer(PULSES).ops as [string, number][];
    expect(moved[0][0]).toBe("pulses");
    expect(moved[0][1]).toBeCloseTo(AMBIENT_STEP_MS * 5, 6);
    expect(layer(BASE)).toBe(base);
    rt.reduced.value = true;
    flush();
    const still = layer(PULSES);
    expect(still.ops).toEqual([]);
    clock.value = 9000;
    flush();
    expect(layer(PULSES)).toBe(still);
  });

  it("38.7-15: a frame that moves bodies but not the base (a spin under a still camera) reuses the base picture; a base change re-records it", () => {
    const { props, layer } = mount();
    flush();
    const base = layer(BASE);
    expect(base.ops).toEqual([["rings", "frame-1"]]);
    layer(PULSES);
    const scans = rt.pulseScans;
    // The lead's plateau: bodies spin, camera still — same base key.
    props.frame.value = {
      tag: "frame-2",
      ringTag: "frame-1",
      pose: { tag: "pose-1" },
    } as never;
    flush();
    expect(layer(BASE)).toBe(base);
    // The frame itself did change (the pulses' ring scan re-ran for it).
    layer(PULSES);
    expect(rt.pulseScans).toBeGreaterThan(scans);
    // The camera moves (a new key): re-recorded at once.
    props.frame.value = { tag: "frame-3", pose: { tag: "pose-3" } };
    flush();
    expect(layer(BASE).ops).toEqual([["rings", "frame-3"]]);
    // Same key, but new ring specs / grid / focus dim: each re-records.
    const keyed = layer(BASE);
    props.ringSpecs.value = { "contact:1": {} };
    flush();
    expect(layer(BASE)).not.toBe(keyed);
    const respecced = layer(BASE);
    props.plane.value = {
      grid: { opacity: 0.12 },
      pulse: { budget: 8, intensity: 0.25 },
    };
    flush();
    expect(layer(BASE).ops).toEqual([
      ["grid", 0.12],
      ["rings", "frame-3"],
    ]);
    expect(layer(BASE)).not.toBe(respecced);
    const gridded = layer(BASE);
    props.focus.value = { spec: {}, mix: 0.5, lock: 2 };
    flush();
    expect(layer(BASE)).not.toBe(gridded);
  });

  it("an ambient tick reuses the eligible-ring scan; a frame or ring-spec change re-runs it", () => {
    const { props, layer } = mount();
    flush();
    // Derived values are lazy here: reading the layer records it.
    layer(PULSES);
    expect(rt.pulseScans).toBe(1);
    const clock = rt.clock as { value: number };
    for (let tick = 1; tick <= 6; tick++) {
      const before = layer(PULSES);
      clock.value = AMBIENT_STEP_MS * tick;
      flush();
      // The pulses moved, but the scan did not run again.
      expect(layer(PULSES)).not.toBe(before);
    }
    expect(rt.pulseScans).toBe(1);
    props.frame.value = { tag: "frame-2", pose: { tag: "pose-2" } };
    flush();
    layer(PULSES);
    expect(rt.pulseScans).toBe(2);
    props.ringSpecs.value = { "contact:1": {} };
    flush();
    layer(PULSES);
    expect(rt.pulseScans).toBe(3);
    clock.value = AMBIENT_STEP_MS * 9;
    flush();
    layer(PULSES);
    expect(rt.pulseScans).toBe(3);
  });

  it("budget 0: the pulses picture holds still (no re-recording on ticks)", () => {
    const { props, layer } = mount();
    props.plane.value = {
      grid: { opacity: 0 },
      pulse: { budget: 0, intensity: 0.25 },
    };
    flush();
    const first = layer(PULSES);
    const clock = rt.clock as { value: number };
    clock.value = AMBIENT_STEP_MS * 9;
    flush();
    expect(layer(PULSES)).toBe(first);
    expect(first.ops).toEqual([]);
  });
});
