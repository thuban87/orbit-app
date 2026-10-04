import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { readOrrerySatellites } from "@/db/orrery-satellites-read";
import { addRelationship } from "@/db/relationships-dao";
import { HOME_CAMERA } from "@/logic/orrery-camera-logic";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { IDENTITY_ENTER, IDENTITY_EXIT } from "@/logic/orrery-label-logic";
import {
  EMPTY_SATELLITE_SPEC,
  moonSplitFactor,
  resolveSatelliteTap,
} from "@/logic/orrery-satellite-logic";
import { beginSwitchChoreography } from "@/logic/orrery-switch-choreography";
import {
  createOrrerySatelliteController,
  loadOrreryScene,
  type OrrerySatelliteState,
} from "@/services/orrery-scene";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { OrreryWorld } from "./OrreryWorld";
import { createOrrerySatellitePublisher } from "./orrery-satellite-publisher";
import { prepareOrreryText } from "./resources/orrery-text-service";
import { useOrreryCamera } from "./use-orrery-camera";
import { sampleOrrerySwitchCamera } from "./use-orrery-switch-runtime";
import { GRID_OPACITY } from "./v2/visual-tunables";

const switchRuntime = (
  scene: Awaited<ReturnType<typeof loadOrreryScene>>,
  pose: { value: typeof HOME_CAMERA },
) => ({
  transition: {
    value: beginSwitchChoreography(scene.world, scene.world, scene.generation, {
      intensity: 0,
      reducedMotion: false,
    }),
  },
  progress: { value: 1 },
  cameraFrom: pose,
  cameraTo: pose,
  running: { value: false },
  resources: scene.world.map((body) => ({
    key: `${body.kind}:${body.id}`,
    body,
    scene,
  })),
  publish: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
});

const native = vi.hoisted(() => ({
  paragraphs: [] as {
    text: string;
    style: Record<string, unknown>;
    options: Record<string, unknown>;
  }[],
  builders: 0,
  disposed: 0,
  /** M3 render-count spy: OrreryWorld calls useWindowDimensions once per render. */
  renders: 0,
  setStateCalls: 0,
  reactions: [] as {
    prepare: () => unknown;
    react: (value: unknown, previous: unknown) => void;
    previous: unknown;
  }[],
  frames: [] as (() => void)[],
  /** 38.7-06: the ambient clock, its owner calls and the reduced-motion flag. */
  clock: { value: 0 },
  clockCalls: 0,
  reduced: { value: false },
  /** 38.7-08: the reduced-motion state twin (interval driver) and host overrides. */
  reducedState: false,
  host: {} as Record<string, unknown>,
  /** Paragraph texts painted by the label/body pictures, in order. */
  painted: [] as string[],
}));
/** A deterministic stand-in for Skia's token parser: distinct per token. */
const parseInk = vi.hoisted(() => (token: string) => {
  let hash = 0;
  for (let i = 0; i < token.length; i++)
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  return Float32Array.of(
    (hash % 251) / 256,
    ((hash >> 8) % 251) / 256,
    ((hash >> 16) % 251) / 256,
    1,
  );
});
/** Runs every recorded UI reaction (prepare → react), then queued UI frames and timers. */
function flushUi(passes = 4) {
  for (let pass = 0; pass < passes; pass++) {
    for (const reaction of native.reactions) {
      const value = reaction.prepare();
      reaction.react(value, reaction.previous);
      reaction.previous = value;
    }
    const frames = native.frames.splice(0);
    for (const frame of frames) frame();
    vi.advanceTimersByTime(300);
  }
}
vi.mock("expo-sqlite", () => ({}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useRef: (value: unknown) => ({ current: value }),
  // Effects run synchronously (cleanups are not exercised here).
  useEffect: (effect: () => unknown) => {
    effect();
  },
  useState: (factory: () => unknown) => [
    factory(),
    () => {
      native.setStateCalls++;
    },
  ],
}));
vi.mock("react-native", () => ({
  useWindowDimensions: () => {
    native.renders++;
    return { fontScale: 2 };
  },
  Platform: { OS: "android" },
  PixelRatio: { get: () => 2 },
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoUri: (path: string) => path,
}));
// 38.7-07 (D-53): the shared photo cache — a photo-less render unless a test
// publishes a drawn photo through the owner's onReady callback.
const photoCache = vi.hoisted(() => ({
  drawn: new Map<string, { id: number; image: unknown }>(),
  ready: null as null | (() => void),
  requests: [] as unknown[][],
}));
vi.mock("./resources/orrery-photo-cache", () => ({
  orreryPhotoCache: {
    mount: (_owner: string, onReady: () => void) => {
      photoCache.ready = onReady;
      return 1;
    },
    request: (_owner: string, entries: unknown[]) => {
      photoCache.requests.push(entries);
    },
    drawn: () => photoCache.drawn,
    confirmRetired: () => 0,
    release: () => 1,
    confirmReleased: () => 0,
    clearUnheld: () => 0,
  },
}));
vi.mock("@/theme/use-reduced-motion", () => ({
  useReducedMotionShared: () => native.reduced,
  useReducedMotion: () => native.reducedState,
}));
// 38.7-08: the render host as the canvas resolves it, plus a per-test override.
vi.mock("./v2/render-host", async (original) => {
  const actual = await original<typeof import("./v2/render-host")>();
  return {
    ...actual,
    resolveOrreryRenderHost: (platform?: string) =>
      actual.applyOrreryHostOverride(
        actual.resolveOrreryRenderHost(platform),
        native.host,
      ),
  };
});
vi.mock("react-native-reanimated", () => ({
  // 38.7-09: the first-frame cover (an Animated.View with an animated style).
  default: { View: "animatedView" },
  useAnimatedStyle: (fn: () => unknown) => fn(),
  useDerivedValue: (fn: () => unknown) => ({
    get value() {
      return fn();
    },
  }),
  useSharedValue: (value: unknown) => ({ value }),
  useAnimatedReaction: (
    prepare: () => unknown,
    react: (value: unknown, previous: unknown) => void,
  ) => {
    native.reactions.push({ prepare, react, previous: null });
  },
  cancelAnimation: () => {},
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
  withTiming: (v: unknown) => v,
  ReduceMotion: { Never: "never" },
}));
vi.mock("react-native-gesture-handler", () => {
  const chain = new Proxy({}, { get: () => () => chain });
  return {
    GestureDetector: ({ children }: { children: ReactNode }) => children,
    Gesture: {
      Tap: () => chain,
      Pan: () => chain,
      Race: () => chain,
      Pinch: () => chain,
      Rotation: () => chain,
      Simultaneous: () => chain,
    },
  };
});
vi.mock("@shopify/react-native-skia", async () => {
  // Use the INSTALLED production Group implementation, including its skLayer behavior.
  const { Group } = await import(
    "../../../node_modules/@shopify/react-native-skia/lib/module/renderer/components/Group.js"
  );
  return {
    Group,
    Circle: "circle",
    Paragraph: "paragraph",
    Paint: "paint",
    Path: "path",
    Canvas: "skCanvas",
    Picture: "skPicture",
    useClock: () => {
      native.clockCalls++;
      return native.clock;
    },
    PaintStyle: { Fill: 0, Stroke: 1 },
    BlendMode: { Dst: 2, SrcOver: 3, Plus: 12, Screen: 14 },
    PointMode: { Points: 0 },
    StrokeCap: { Butt: 0, Round: 1 },
    TileMode: { Clamp: 0 },
    ClipOp: { Difference: 0, Intersect: 1 },
    FilterMode: { Nearest: 0, Linear: 1 },
    MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
    // A recording canvas: each command with the paint colour it drew with.
    createPicture: (draw: (canvas: unknown) => void) => {
      const commands: { op: string; color?: number[] }[] = [];
      draw(
        new Proxy(
          {},
          {
            get:
              (_t, op: string) =>
              (...args: unknown[]) => {
                const paint = args.at(-1) as { color?: number[] } | undefined;
                commands.push({ op, color: paint?.color });
              },
          },
        ),
      );
      return { commands };
    },
    VertexMode: { Triangles: 0, TriangleStrip: 1, TriangleFan: 2 },
    RoundedRect: "roundRect",
    Image: "image",
    TextAlign: { Center: 2 },
    useImage: () => null,
    rect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
    rrect: (rect: unknown) => rect,
    Skia: {
      Color: parseInk,
      XYWHRect: (x: number, y: number, width: number, height: number) => ({
        x,
        y,
        width,
        height,
      }),
      RRectXY: (rect: unknown, rx: number, ry: number) => ({ rect, rx, ry }),
      Paint: () => {
        const paint = {
          color: [] as number[],
          setAlphaf: () => {},
          setAntiAlias: () => {},
          setStyle: () => {},
          setStrokeWidth: () => {},
          setStrokeCap: () => {},
          setBlendMode: () => {},
          setColorFilter: () => {},
          setShader: () => {},
          setColor: (c: Float32Array) => {
            paint.color = [...c];
          },
        };
        return paint;
      },
      Path: {
        Make: () => ({ moveTo: () => {}, lineTo: () => {}, close: () => {} }),
      },
      // The ring effect and strips, so the base picture records ring draws.
      RuntimeEffect: {
        Make: () => ({ makeShader: (uniforms: number[]) => ({ uniforms }) }),
      },
      MakeVertices: () => ({}),
      ParagraphBuilder: {
        Make: (options: Record<string, unknown>) => {
          native.builders++;
          let item = { text: "", style: {}, options };
          const builder = {
            reset: () => {
              item = { text: "", style: {}, options };
            },
            pushStyle: (style: Record<string, unknown>) => {
              item.style = style;
              return builder;
            },
            addText: (text: string) => {
              item.text += text;
              return builder;
            },
            pop: () => builder,
            build: () => {
              native.paragraphs.push({ ...item });
              return {
                text: item.text,
                layout: () => {},
                getLongestLine: () => 90,
                getHeight: () => 40,
                paint: () => {
                  native.painted.push(item.text);
                },
                dispose: () => {
                  native.disposed++;
                },
              };
            },
          };
          return builder;
        },
      },
    },
  };
});

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
let db: ReturnType<typeof openTestDb>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    native.frames.push(callback);
    return native.frames.length;
  });
  native.paragraphs = [];
  native.reactions = [];
  native.frames = [];
  native.renders = 0;
  native.setStateCalls = 0;
  native.clock = { value: 0 };
  native.clockCalls = 0;
  native.reduced = { value: false };
  native.reducedState = false;
  native.host = {};
  native.painted = [];
  db = openTestDb();
  let uid = 0;
  await runMigrations(nodeSqliteExecutor(db), MIGRATIONS, TARGET_VERSION, {
    now: "2026-09-07 12:00:00",
    newUid: () => `render-${++uid}`,
    defaultPhoneRegion: "US",
  });
});
afterEach(() => {
  db.close();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A scene with one parent contact and `moons` relationships (moons). */
async function moonScene(moons: number) {
  const exec = nodeSqliteExecutor(db);
  await exec.runAsync(
    "INSERT INTO contacts(uid,name,tracking_enabled,interval_days,created_at,modified_at) VALUES ('p','Parent',1,30,'2026-09-07','2026-09-07')",
  );
  const scene = await loadOrreryScene(exec, 1);
  for (let i = 0; i < moons; i++)
    await addRelationship(exec, {
      contactId: scene.contacts[0].id,
      personName: `Moon ${i}`,
      createdAt: "2026-09-07",
      now: "2026-09-07",
    });
  const rows = await readOrrerySatellites(exec, scene.systemSnapshot.members);
  return { scene, rows };
}
/** 38.7-10 (C-M3): a satellite publisher with `rows` already published as ready. */
function readySatellites(
  scene: Awaited<ReturnType<typeof loadOrreryScene>>,
  rows: OrrerySatelliteState["rows"],
) {
  const spec = { value: EMPTY_SATELLITE_SPEC };
  const setState = vi.fn();
  const publisher = createOrrerySatellitePublisher({ spec, setState });
  publisher.noteScene(scene.generation, scene.systemSnapshot.members);
  publisher.publish({
    status: "ready",
    sceneGeneration: scene.generation,
    rows,
  });
  return { spec, setState, publisher };
}

describe("production Orrery native tree and resource contracts", () => {
  it("renders tokenized moons in the same actual native depth batch; at overview only the decorative bump (no moon body to hit)", async () => {
    const { scene, rows } = await moonScene(1);
    const { publisher } = readySatellites(scene, rows);
    // Flat, so the parent's on-screen magnification is the zoom (identity tier).
    const pose = { value: { ...HOME_CAMERA, tilt: 0, zoom: 2.4 } };
    const camera = useOrreryCamera({
      pose: pose as never,
      enabled: true,
      extent: scene.extent,
      viewport: { width: 1200, height: 1600 },
      reduced: { value: false } as never,
    });
    const tree = resolve(
      OrreryWorld({
        scene,
        satelliteSource: publisher.source,
        pose: pose as never,
        // Large enough that the moon is on screen wherever today's date puts
        // its parent on the ring (angles follow the real clock).
        viewport: { width: 1200, height: 1600 },
        camera,
        colors: THEME_PRESETS.galaxy.dark,
        themeMode: "dark",
        themePackage: "galaxy",
        fontProvider: {} as never,
        onIntent: vi.fn(),
        onReorder: vi.fn(),
        onReorderActivated: vi.fn(),
        focusedIds: [],
        switchRuntime: switchRuntime(scene, pose as never) as never,
      }),
    );
    // 38.7-07: moons are drawn by the body pictures (same depth rules).
    const moonInk = [...parseInk(THEME_PRESETS.galaxy.dark.textSecondary)];
    const moonDraws = () =>
      [tree[0].children[3], tree[0].children[5]]
        .flatMap(
          (picture) =>
            (
              picture.props.picture as {
                value: { commands: { op: string; color?: number[] }[] };
              }
            ).value.commands,
        )
        .filter(
          (c) =>
            c.op === "drawCircle" &&
            c.color !== undefined &&
            c.color.every((v, i) => v === moonInk[i]),
        ).length;
    flushUi();
    expect(moonDraws()).toBe(1);
    pose.value = { ...pose.value, zoom: 1 };
    flushUi();
    // Overview (D-31): no moon body in the frame, so nothing to hit; the one
    // moon-ink draw is the parent's bump.
    const frame = camera.frame.value as AnimatedFrame;
    expect(frame.bodies.some((b) => b.kind === "satellite")).toBe(false);
    expect(frame.moonSplit).toBe(0);
    expect(frame.moonBumps).toEqual({
      [`contact:${scene.contacts[0].id}`]: expect.objectContaining({
        count: 1,
      }),
    });
    expect(moonDraws()).toBe(1);
  });
  it("M13: the split factor, the drawn moons and the tappable moons all come from one frame's sampled camera zoom — mid-zoom and mid-switch", async () => {
    const { scene, rows } = await moonScene(2);
    const { publisher } = readySatellites(scene, rows);
    const pose = { value: { ...HOME_CAMERA, tilt: 0, zoom: 1 } };
    const runtime = switchRuntime(scene, pose as never);
    const camera = useOrreryCamera({
      pose: pose as never,
      enabled: true,
      extent: scene.extent,
      viewport: { width: 1200, height: 1600 },
      reduced: { value: false } as never,
    });
    const tree = resolve(
      OrreryWorld({
        scene,
        satelliteSource: publisher.source,
        pose: pose as never,
        viewport: { width: 1200, height: 1600 },
        camera,
        colors: THEME_PRESETS.galaxy.dark,
        themeMode: "dark",
        themePackage: "galaxy",
        fontProvider: {} as never,
        onIntent: vi.fn(),
        onReorder: vi.fn(),
        onReorderActivated: vi.fn(),
        focusedIds: [],
        switchRuntime: runtime as never,
      }),
    );
    const moonInk = [...parseInk(THEME_PRESETS.galaxy.dark.textSecondary)];
    const drawnMoons = () =>
      [tree[0].children[3], tree[0].children[5]]
        .flatMap(
          (picture) =>
            (
              picture.props.picture as {
                value: { commands: { op: string; color?: number[] }[] };
              }
            ).value.commands,
        )
        .filter(
          (c) =>
            c.op === "drawCircle" &&
            c.color?.every((v, i) => v === moonInk[i]) === true,
        ).length;
    const identities = scene.systemSnapshot.members.map((m) => ({
      kind: "member" as const,
      id: m.id,
      uid: m.uid,
    }));
    const members = scene.systemSnapshot.members;
    const check = (expectedZoom: number) => {
      flushUi(1);
      const frame = camera.frame.value as AnimatedFrame;
      const split = moonSplitFactor(expectedZoom);
      // The split input is THIS frame's camera (the one it was projected with).
      expect(frame.pose.zoom).toBeCloseTo(expectedZoom, 12);
      expect(frame.moonSplit).toBe(split);
      const moons = frame.bodies.filter((b) => b.kind === "satellite");
      // Drawn == the frame's moons (the bump has faded out of full ink).
      expect(drawnMoons()).toBe(moons.length);
      // Tappable == the frame's interactive moons, on the same frame.
      const tappable = moons.filter(
        (moon) =>
          resolveSatelliteTap(frame, moon.x, moon.y, identities, members)
            .kind === "satellite",
      );
      expect(tappable).toEqual(moons.filter((moon) => moon.interactive));
      return { split, moons, tappable };
    };
    // Mid-zoom (settled): moons are out but not yet interactive.
    const mid = (IDENTITY_EXIT + IDENTITY_ENTER) / 2;
    pose.value = { ...pose.value, zoom: mid };
    const midZoom = check(mid);
    expect(midZoom.split).toBeGreaterThan(0);
    expect(midZoom.split).toBeLessThan(1);
    expect(midZoom.moons).toHaveLength(2);
    expect(midZoom.tappable).toHaveLength(0);
    // Fully split: interactive, and taps resolve to the moon.
    pose.value = { ...pose.value, zoom: IDENTITY_ENTER };
    expect(check(IDENTITY_ENTER).tappable).toHaveLength(2);
    // Mid-switch: the switch camera, not the (stale) pose, drives the split.
    runtime.progress.value = 0.5;
    runtime.cameraFrom = { value: { ...pose.value, zoom: 1.7 } } as never;
    runtime.cameraTo = { value: { ...pose.value, zoom: 2.1 } } as never;
    const rerendered = resolve(
      OrreryWorld({
        scene,
        satelliteSource: publisher.source,
        pose: pose as never,
        viewport: { width: 1200, height: 1600 },
        camera,
        colors: THEME_PRESETS.galaxy.dark,
        themeMode: "dark",
        themePackage: "galaxy",
        fontProvider: {} as never,
        onIntent: vi.fn(),
        onReorder: vi.fn(),
        onReorderActivated: vi.fn(),
        focusedIds: [],
        switchRuntime: runtime as never,
      }),
    );
    tree.splice(0, tree.length, ...rerendered);
    const switchZoom = sampleOrrerySwitchCamera(
      runtime.cameraFrom.value,
      runtime.cameraTo.value,
      0.5,
    ).zoom;
    expect(switchZoom).not.toBe(pose.value.zoom);
    const midSwitch = check(switchZoom);
    expect(midSwitch.split).toBeGreaterThan(0);
    expect(midSwitch.split).toBeLessThan(1);
  });
  it("C-M3: a satellite load resolving mid-switch (loading, ready, error) writes the SharedValue the frame reads and commits no OrreryWorld render; the held React copy flushes once on settle", async () => {
    const { scene, rows } = await moonScene(1);
    const spec = { value: EMPTY_SATELLITE_SPEC };
    const setState = vi.fn();
    const publisher = createOrrerySatellitePublisher({ spec, setState });
    const loads: {
      resolve: (rows: OrrerySatelliteState["rows"]) => void;
      reject: (error: Error) => void;
    }[] = [];
    const controller = createOrrerySatelliteController((loaded) => {
      publisher.noteScene(loaded.generation, loaded.systemSnapshot.members);
      return new Promise((resolve, reject) => loads.push({ resolve, reject }));
    }, publisher.publish);
    // A switch is in flight: progress 0.5, the camera already at identity.
    const pose = { value: { ...HOME_CAMERA, tilt: 0, zoom: 2.4 } };
    const runtime = {
      ...switchRuntime(scene, pose as never),
      progress: { value: 0.5 },
    };
    const camera = useOrreryCamera({
      pose: pose as never,
      enabled: true,
      extent: scene.extent,
      viewport: { width: 1200, height: 1600 },
      reduced: { value: false } as never,
    });
    resolve(
      OrreryWorld({
        scene,
        satelliteSource: publisher.source,
        pose: pose as never,
        viewport: { width: 1200, height: 1600 },
        camera,
        colors: THEME_PRESETS.galaxy.dark,
        themeMode: "dark",
        themePackage: "galaxy",
        fontProvider: {} as never,
        onIntent: vi.fn(),
        onReorder: vi.fn(),
        onReorderActivated: vi.fn(),
        focusedIds: [],
        switchRuntime: runtime as never,
      }),
    );
    flushUi();
    const renders = native.renders;
    const moonBodies = () =>
      (camera.frame.value as AnimatedFrame).bodies.filter(
        (b) => b.kind === "satellite",
      ).length;
    expect(moonBodies()).toBe(0);
    publisher.switchStarted(scene.generation);
    // loading (published synchronously by the controller)
    const first = controller.reload(scene, true);
    expect(spec.value.status).toBe("loading");
    // ready rows land mid-switch: the NEXT frame shows the moon.
    loads[0].resolve(rows);
    await first;
    expect(spec.value).toMatchObject({
      status: "ready",
      sceneGeneration: scene.generation,
    });
    flushUi();
    expect(moonBodies()).toBe(1);
    // The index is built once per (generation, rows), never per frame.
    const index = spec.value.index;
    flushUi();
    expect(spec.value.index).toBe(index);
    publisher.publish({
      status: "ready",
      sceneGeneration: scene.generation,
      rows: spec.value.index.rows as OrrerySatelliteState["rows"],
    });
    // a failed reload (error)
    const second = controller.reload({ ...scene }, true);
    loads[1].reject(new Error("read failed"));
    await second;
    expect(spec.value.status).toBe("error");
    flushUi();
    expect(moonBodies()).toBe(0);
    // Not one React render or state update for any of it.
    expect(native.renders).toBe(renders);
    expect(native.setStateCalls).toBe(0);
    expect(setState).not.toHaveBeenCalled();
    // Settle: the held React copy flushes exactly once, with the latest state.
    publisher.switchSettled(scene.generation);
    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState.mock.calls[0][0]).toMatchObject({ status: "error" });
    publisher.switchSettled(scene.generation);
    expect(setState).toHaveBeenCalledTimes(1);
    // Settled: publications reach React directly again.
    publisher.publish({
      status: "ready",
      sceneGeneration: scene.generation,
      rows,
    });
    expect(setState).toHaveBeenCalledTimes(2);
  });
  it("draws contacts behind or in front of the sun by projected depth, and labels in their own picture", async () => {
    const exec = nodeSqliteExecutor(db);
    await exec.runAsync(
      "INSERT INTO contacts(uid,name,tracking_enabled,interval_days,created_at,modified_at) VALUES ('name','Zoë',1,30,'2026-09-07','2026-09-07')",
    );
    const scene = await loadOrreryScene(exec, 1);
    const pose = { value: { ...HOME_CAMERA, tilt: 0.5 } };
    const tree = resolve(
      OrreryWorld({
        camera: useOrreryCamera({
          pose: { value: HOME_CAMERA } as never,
          enabled: true,
          extent: scene.extent,
          viewport: { width: 400, height: 600 },
          reduced: { value: false } as never,
        }),
        scene,
        pose: pose as never,
        viewport: { width: 500, height: 700 },
        colors: THEME_PRESETS.galaxy.dark,
        themeMode: "dark",
        themePackage: "galaxy",
        fontProvider: {} as never,
        onIntent: () => {},
        onReorder: () => {},
        onReorderActivated: () => {},
        focusedIds: [],
        switchRuntime: switchRuntime(scene, pose as never) as never,
      }),
    );
    // 38.7-09: sky, base, pulses, bodiesBehind, sun, bodiesFront, labels, overlay.
    expect(tree[0].type).toBe("skCanvas");
    expect(tree[0].children.map((node) => node.type)).toEqual(
      Array(8).fill("skPicture"),
    );
    const [, , , behind, sunLayer, front, labels] = tree[0].children;
    const circles = (picture: Node) =>
      (
        picture.props.picture as {
          value: { commands: { op: string }[] };
        }
      ).value.commands.filter((c) => c.op === "drawCircle").length;
    flushUi();
    // Tilted: the contact is deeper than the sun → drawn behind it.
    expect(circles(behind)).toBe(2);
    expect(circles(front)).toBe(0);
    expect(circles(sunLayer)).toBe(3);
    pose.value = { ...pose.value, yaw: Math.PI };
    expect(circles(behind)).toBe(0);
    expect(circles(front)).toBe(2);
    pose.value = { ...pose.value, yaw: 0 };
    const plates = () =>
      (
        labels.props.picture as { value: { commands: { op: string }[] } }
      ).value.commands.filter((c) => c.op === "drawRRect").length;
    expect(plates()).toBe(0);
    // D-47: the tier follows on-screen magnification. This contact sits on
    // the far side of a 0.5 rad tilt, so zoom 2.4 is what magnifies it past
    // IDENTITY_ENTER (zoom 2 leaves it at ≈1.83, still overview).
    pose.value = { ...pose.value, yaw: 0, zoom: 2.4 };
    // 38.7-04 M3: the identity tier reaches the text publisher through UI
    // reactions; only then does the (unfocused) label get a Paragraph.
    flushUi();
    expect(plates()).toBe(1);
    expect(native.painted).toContain("Zoë");
  });
  it("M3: a switch whose camera crosses IDENTITY_ENTER publishes label text through UI reactions and commits no OrreryWorld render", async () => {
    const exec = nodeSqliteExecutor(db);
    await exec.runAsync(
      "INSERT INTO contacts(uid,name,tracking_enabled,interval_days,created_at,modified_at) VALUES ('m3','Ada Lovelace',1,30,'2026-09-07','2026-09-07')",
    );
    const scene = await loadOrreryScene(exec, 1);
    const pose = { value: { ...HOME_CAMERA } };
    const runtime = {
      ...switchRuntime(scene, pose as never),
      progress: { value: 0 },
      cameraFrom: { value: { ...HOME_CAMERA, zoom: 1 } },
      cameraTo: { value: { ...HOME_CAMERA, zoom: 2.6 } },
    };
    const tree = resolve(
      OrreryWorld({
        camera: useOrreryCamera({
          pose: pose as never,
          enabled: true,
          extent: scene.extent,
          viewport: { width: 500, height: 700 },
          reduced: { value: false } as never,
        }),
        scene,
        pose: pose as never,
        viewport: { width: 500, height: 700 },
        colors: THEME_PRESETS.galaxy.dark,
        themeMode: "dark",
        themePackage: "galaxy",
        fontProvider: {} as never,
        onIntent: () => {},
        onReorder: () => {},
        onReorderActivated: () => {},
        focusedIds: [],
        switchRuntime: runtime as never,
      }),
    );
    flushUi();
    const labels = tree[0].children[6];
    const drawn = () => {
      native.painted = [];
      void (labels.props.picture as { value: unknown }).value;
      return native.painted;
    };
    // Overview: an unfocused body gets no label Paragraph at all.
    expect(drawn()).toEqual([]);
    const rendersBefore = native.renders;
    expect(rendersBefore).toBe(1);
    const zooms: number[] = [];
    for (const progress of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      runtime.progress.value = progress;
      zooms.push(
        sampleOrrerySwitchCamera(
          runtime.cameraFrom.value,
          runtime.cameraTo.value,
          progress,
        ).zoom,
      );
      flushUi();
    }
    // The drawn switch camera really crossed into the identity tier mid-switch…
    expect(zooms[0]).toBeLessThan(IDENTITY_ENTER);
    expect(zooms[8]).toBeGreaterThanOrEqual(IDENTITY_ENTER);
    // …the publisher prepared the label (UI reaction → runOnJS → SharedValue)…
    expect(drawn()).toContain("Ada Lovelace");
    expect(
      native.paragraphs.some(
        (p) =>
          p.text === "Ada Lovelace" &&
          (p.style.fontStyle as { weight?: number })?.weight === 600,
      ),
    ).toBe(true);
    // …and no React render or state update was committed for it.
    expect(native.renders).toBe(rendersBefore);
    expect(native.setStateCalls).toBe(0);
  });
  it("passes complete Unicode to native ellipsis and derives dimensions/font sizes from native measurement", () => {
    const name = "👨‍👩‍👧‍👦 e\u0301 東京 مرحبا";
    const text = prepareOrreryText(
      name,
      "label",
      2,
      200,
      {} as never,
      THEME_PRESETS.galaxy.dark,
    );
    expect(text?.text).toBe(name);
    expect(text?.width).toBe(106);
    expect(text?.height).toBe(48);
    expect(native.paragraphs[0]).toMatchObject({
      text: name,
      options: { maxLines: 1, ellipsis: "…" },
      style: {
        fontSize: 28,
        fontFamilies: ["Inter"],
        fontStyle: { weight: 600 },
      },
    });
    expect(
      prepareOrreryText(name, "label", 1, 200, null, THEME_PRESETS.galaxy.dark),
    ).toBeNull();
  });
});

describe("38.7-07 D-43: the stable picture tree (contract) and the single ambient clock", () => {
  type Scene = Awaited<ReturnType<typeof loadOrreryScene>>;
  let inserted = 0;
  /** Adds `count` contacts to the System (calls accumulate within a test). */
  async function sceneWith(count: number): Promise<Scene> {
    const exec = nodeSqliteExecutor(db);
    for (let i = 0; i < count; i++) {
      inserted++;
      await exec.runAsync(
        "INSERT INTO contacts(uid,name,tracking_enabled,interval_days,created_at,modified_at) VALUES (?,?,1,30,'2026-09-07','2026-09-07')",
        [`stable-${inserted}`, `Person ${inserted}`],
      );
    }
    return loadOrreryScene(exec, 1);
  }
  const pose = { value: { ...HOME_CAMERA } };
  /** The camera hook's input (the hook itself is called inline per test). */
  const cameraInput = (scene: Scene) => ({
    pose: pose as never,
    enabled: true,
    extent: scene.extent,
    viewport: { width: 500, height: 700 },
    reduced: { value: false } as never,
  });
  function renderWorld(
    scene: Scene,
    camera: ReturnType<typeof useOrreryCamera>,
    focusedIds: number[] = [],
  ) {
    return resolve(
      OrreryWorld({
        camera,
        scene,
        pose: pose as never,
        viewport: { width: 500, height: 700 },
        colors: THEME_PRESETS.galaxy.dark,
        themeMode: "dark",
        themePackage: "galaxy",
        fontProvider: {} as never,
        onIntent: () => {},
        onReorder: () => {},
        onReorderActivated: () => {},
        focusedIds,
        switchRuntime: switchRuntime(scene, pose as never) as never,
      }),
    );
  }
  const findAll = (node: Node, type: string): Node[] => [
    ...(node.type === type ? [node] : []),
    ...node.children.flatMap((child) => findAll(child, type)),
  ];
  type Recorded = { commands: { op: string; color?: number[] }[] };
  const recorded = (picture: Node) =>
    (picture.props.picture as { value: Recorded }).value.commands;

  /** The whole node tree as types (the D-43 shape). */
  const shape = (tree: Node[]) => {
    const walk = (node: Node): unknown => [node.type, node.children.map(walk)];
    return tree.map(walk);
  };
  const LAYERS = 8; // sky, base, pulses, bodiesBehind, sun, bodiesFront, labels, overlay

  it("the same Picture layers for 3, 120 and 1,000 bodies; no per-body node — rings, bodies and labels are draws", async () => {
    const smallScene = await sceneWith(3);
    const small = renderWorld(
      smallScene,
      useOrreryCamera(cameraInput(smallScene)),
    );
    flushUi(1);
    const mediumScene = await sceneWith(117);
    const medium = renderWorld(
      mediumScene,
      useOrreryCamera(cameraInput(mediumScene)),
    );
    flushUi(1);
    const largeScene = await sceneWith(880);
    const large = renderWorld(
      largeScene,
      useOrreryCamera(cameraInput(largeScene)),
    );
    flushUi(1);
    const trees = [small, medium, large];
    for (const tree of trees) {
      // The canvas, then (opaque SurfaceView canvas on Android, D-64) the
      // non-touchable first-frame cover in the sky's base token (38.7-09).
      expect(tree).toHaveLength(2);
      expect(tree[1].type).toBe("animatedView");
      expect(tree[1].props.pointerEvents).toBe("none");
      expect(JSON.stringify(tree[1].props.style)).toContain(
        THEME_PRESETS.galaxy.dark.orrerySkyBase,
      );
      expect(tree[0].type).toBe("skCanvas");
      expect(tree[0].children.map((n) => n.type)).toEqual(
        Array(LAYERS).fill("skPicture"),
      );
      // Nothing else anywhere: no Group, Circle, Paragraph, Path or layer node.
      expect(findAll(tree[0], "skPicture")).toHaveLength(LAYERS);
      for (const type of ["skGroup", "circle", "paragraph", "path", "skLayer"])
        expect(findAll(tree[0], type)).toHaveLength(0);
    }
    expect(shape(medium)).toEqual(shape(small));
    expect(shape(large)).toEqual(shape(small));
    // 38.7-09: the sky picture opens with the sky's base token (this Skia
    // mock has no gradient shader, so the plain base fill), whatever the size.
    for (const tree of trees)
      expect(recorded(tree[0].children[0])[0]).toEqual({
        op: "drawPaint",
        color: [...parseInk(THEME_PRESETS.galaxy.dark.orrerySkyBase)],
      });
    // The base picture: the optional plane grid (D-09: one draw, none at
    // opacity 0), then one world-plane draw per ring (no sky fill any more).
    const grid = GRID_OPACITY > 0 ? 1 : 0;
    const base = recorded(large[0].children[1]);
    expect(base.filter((c) => c.op === "drawPaint")).toHaveLength(0);
    expect(base.filter((c) => c.op === "drawVertices")).toHaveLength(
      1000 + grid,
    );
    expect(
      recorded(small[0].children[1]).filter((c) => c.op === "drawVertices"),
    ).toHaveLength(3 + grid);
    // Bodies are recorded draws inside the two body pictures.
    const bodyCircles = (tree: Node[]) =>
      [tree[0].children[3], tree[0].children[5]]
        .flatMap(recorded)
        .filter((c) => c.op === "drawCircle").length;
    expect(bodyCircles(small)).toBe(3 * 2);
    expect(bodyCircles(large)).toBeGreaterThan(bodyCircles(small));
  });

  it("a focus change, a photo-ready notification and an unrelated parent re-render never change the node tree; a photo only rewrites the body specs", async () => {
    const exec = nodeSqliteExecutor(db);
    await sceneWith(3);
    await exec.runAsync(
      "UPDATE contacts SET photo = 'avatars/contact-1.jpg' WHERE uid = ?",
      [`stable-${inserted}`],
    );
    const scene = await loadOrreryScene(exec, 1);
    const camera = useOrreryCamera(cameraInput(scene));
    const before = renderWorld(scene, camera);
    flushUi();
    // The photo was requested from the shared cache (no decode in the tree).
    expect(
      (photoCache.requests.at(-1) as { key: string }[]).map((r) => r.key),
    ).toEqual(["avatars/contact-1.jpg"]);
    // A focus change: a re-render, same tree.
    const focused = renderWorld(scene, camera, [scene.contacts[0].id]);
    expect(shape(focused)).toEqual(shape(before));
    // An unrelated parent re-render with equal (new) props: same tree.
    const again = renderWorld(scene, camera, [scene.contacts[0].id]);
    expect(shape(again)).toEqual(shape(before));
    flushUi();
    // A photo arrives: no React render, no state; only the body specs move.
    const renders = native.renders;
    const snapshot = (tree: Node[]) =>
      tree[0].children.map((picture) => JSON.stringify(recorded(picture)));
    const [sky, base, pulses, behind, sun, front, labels, overlay] =
      snapshot(again);
    photoCache.drawn.set("avatars/contact-1.jpg", {
      id: 1,
      image: { width: () => 512, height: () => 512 },
    });
    photoCache.ready?.();
    flushUi();
    expect(native.renders).toBe(renders);
    expect(native.setStateCalls).toBe(0);
    const after = snapshot(again);
    expect([
      after[0],
      after[1],
      after[2],
      after[4],
      after[6],
      after[7],
    ]).toEqual([sky, base, pulses, sun, labels, overlay]);
    const images = [again[0].children[3], again[0].children[5]]
      .flatMap(recorded)
      .filter((c) => c.op === "drawImageRectOptions");
    expect(images).toHaveLength(1);
    expect([after[3], after[5]]).not.toEqual([behind, front]);
    expect(shape(again)).toEqual(shape(before));
    photoCache.drawn.clear();
  });
  it("38.7-09: the sky picture's stars twinkle on the ambient clock and hold still under reduced motion", async () => {
    const scene = await sceneWith(1);
    const tree = renderWorld(scene, useOrreryCamera(cameraInput(scene)));
    const sky = tree[0].children[0];
    // 38.7-08: the clock reaches the pictures through the quantised ambient
    // value the frame-clock driver's reaction writes.
    const at = (ms: number) => {
      native.clock.value = ms;
      flushUi(1);
      return recorded(sky)
        .filter((c) => c.op === "drawPoints")
        .map((c) => c.color?.[3]);
    };
    // Galaxy Dark draws its star batches (tone × size × twinkle phase).
    expect(at(0).length).toBeGreaterThan(3);
    expect(at(0)).not.toEqual(at(650));
    native.reduced.value = true;
    expect(at(0)).toEqual(at(650));
    expect(at(1234)).toEqual(at(98765));
  });
  it("useClock runs exactly once per canvas mount and drives the sun picture's pulse (still under reduced motion)", async () => {
    const scene = await sceneWith(2);
    const tree = renderWorld(scene, useOrreryCamera(cameraInput(scene)));
    expect(native.clockCalls).toBe(1);
    flushUi();
    const sun = tree[0].children[4];
    const glowAlpha = (ms: number) => {
      native.clock.value = ms;
      flushUi(1);
      return recorded(sun).find((c) => c.op === "drawCircle")?.color?.[3];
    };
    expect(glowAlpha(0)).not.toEqual(glowAlpha(700));
    // Inside one ambient step (~33 ms) nothing moves (D-49 quantisation).
    expect(glowAlpha(700)).toEqual(glowAlpha(710));
    native.reduced.value = true;
    expect(glowAlpha(0)).toEqual(glowAlpha(700));
  });
  it("38.7-08: the interval driver ticks the ambient value from a JS timer, never calls useClock, and stops under reduced motion", async () => {
    native.host = { ambientDriver: "interval" };
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    });
    const scene = await sceneWith(2);
    const tree = renderWorld(scene, useOrreryCamera(cameraInput(scene)));
    expect(native.clockCalls).toBe(0);
    const sun = tree[0].children[4];
    const glow = () =>
      recorded(sun).find((c) => c.op === "drawCircle")?.color?.[3];
    const first = glow();
    vi.advanceTimersByTime(700);
    expect(glow()).not.toEqual(first);
    // Mounted under reduced motion (the OS state twin): no timer runs and
    // the value stays −1, so the glow holds still. (Stopping a running timer
    // on a live toggle is covered by ambient-clock.test.ts: this harness
    // cannot re-render a component with persistent memo/effect state.)
    native.reducedState = true;
    const still = renderWorld(scene, useOrreryCamera(cameraInput(scene)));
    const stillGlow = () =>
      recorded(still[0].children[4]).find((c) => c.op === "drawCircle")
        ?.color?.[3];
    const held = stillGlow();
    vi.advanceTimersByTime(1500);
    expect(stillGlow()).toEqual(held);
    expect(native.clockCalls).toBe(0);
  });
});
