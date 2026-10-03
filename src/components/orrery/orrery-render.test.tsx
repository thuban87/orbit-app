import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { readOrrerySatellites } from "@/db/orrery-satellites-read";
import { addRelationship } from "@/db/relationships-dao";
import { HOME_CAMERA } from "@/logic/orrery-camera-logic";
import { IDENTITY_ENTER } from "@/logic/orrery-label-logic";
import { beginSwitchChoreography } from "@/logic/orrery-switch-choreography";
import { loadOrreryScene } from "@/services/orrery-scene";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { prepareOrreryText } from "./OrreryLabel";
import { OrreryWorld } from "./OrreryWorld";
import { useOrreryCamera } from "./use-orrery-camera";
import { sampleOrrerySwitchCamera } from "./use-orrery-switch-runtime";

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
  providedClock: null as unknown,
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
vi.mock("./orrery-clock-context", () => ({
  useOrreryClock: () => null,
  OrreryClockContext: {
    Provider: ({
      value,
      children,
    }: {
      value: unknown;
      children: ReactNode;
    }) => {
      native.providedClock = value;
      return children;
    },
  },
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
}));
vi.mock("react-native-reanimated", () => ({
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
    BlendMode: { Dst: 2 },
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
  native.providedClock = null;
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

describe("production Orrery native tree and resource contracts", () => {
  it("renders tokenized moons in the same actual native depth batch and hides them at overview", async () => {
    const exec = nodeSqliteExecutor(db);
    await exec.runAsync(
      "INSERT INTO contacts(uid,name,tracking_enabled,interval_days,created_at,modified_at) VALUES ('p','Parent',1,30,'2026-09-07','2026-09-07')",
    );
    const scene = await loadOrreryScene(exec, 1);
    await addRelationship(exec, {
      contactId: scene.contacts[0].id,
      personName: "Moon",
      createdAt: "2026-09-07",
      now: "2026-09-07",
    });
    const satellites = await readOrrerySatellites(
      exec,
      scene.systemSnapshot.members,
    );
    const pose = { value: { ...HOME_CAMERA, zoom: 2 } };
    const tree = resolve(
      OrreryWorld({
        scene,
        satellites,
        pose: pose as never,
        viewport: { width: 500, height: 700 },
        camera: useOrreryCamera({
          pose: pose as never,
          enabled: true,
          extent: scene.extent,
          viewport: { width: 500, height: 700 },
          reduced: { value: false } as never,
        }),
        colors: THEME_PRESETS.galaxy.dark,
        fontProvider: {} as never,
        onIntent: vi.fn(),
        onReorder: vi.fn(),
        onReorderActivated: vi.fn(),
        focusedIds: [],
        switchRuntime: switchRuntime(scene, pose as never) as never,
      }),
    );
    // canvas [base, stars, bodiesBehind, sun, bodiesFront,
    //         clip Group [moons, labels], overlay] (38.7-07 Task 1)
    const moons = tree[0].children[5].children[0];
    expect(moons.children.map((n) => n.type)).toEqual(["skGroup"]);
    const moon = moons.children[0];
    expect(moon.children[0].props.color).toBe(
      THEME_PRESETS.galaxy.dark.textSecondary,
    );
    const transform = moon.props.transform as { value: { scale?: number }[] };
    expect(transform.value[2].scale).toBeGreaterThan(0);
    expect(transform.value[2].scale).toBeLessThanOrEqual(8);
    pose.value = { ...pose.value, zoom: 1 };
    expect(transform.value[2].scale).toBe(1); // absent frame -> hidden billboard, not a hit target
  });
  it("keeps actual sun/contact root Groups in one consecutive batch with shared native paint layers", async () => {
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
        fontProvider: {} as never,
        onIntent: () => {},
        onReorder: () => {},
        onReorderActivated: () => {},
        focusedIds: [],
        switchRuntime: switchRuntime(scene, pose as never) as never,
      }),
    );
    // 38.7-07: contacts and the sun are picture layers split around the sun
    // by projected depth (M14); the legacy slot keeps moons and labels.
    expect(tree[0].type).toBe("skCanvas");
    expect(tree[0].children.map((node) => node.type)).toEqual([
      "skPicture",
      "skPicture",
      "skPicture",
      "skPicture",
      "skPicture",
      "skGroup",
      "skPicture",
    ]);
    const [, , behind, sunLayer, front] = tree[0].children;
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
    const [, labels] = tree[0].children[5].children;
    expect(labels.children.length).toBe(1);
    const nameLayer = labels.children[0].children[0];
    expect(nameLayer.type).toBe("skLayer");
    const alpha = nameLayer.children[0].props.opacity as { value: number };
    expect(alpha.value).toBe(0);
    // D-47: the tier follows on-screen magnification. This contact sits on
    // the far side of a 0.5 rad tilt, so zoom 2.4 is what magnifies it past
    // IDENTITY_ENTER (zoom 2 leaves it at ≈1.83, still overview).
    pose.value = { ...pose.value, yaw: 0, zoom: 2.4 };
    // 38.7-04 M3: the identity tier reaches the text publisher through UI
    // reactions; only then does the (unfocused) label get a Paragraph.
    flushUi();
    expect(alpha.value).toBe(1);
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
        fontProvider: {} as never,
        onIntent: () => {},
        onReorder: () => {},
        onReorderActivated: () => {},
        focusedIds: [],
        switchRuntime: runtime as never,
      }),
    );
    flushUi();
    const findAll = (node: Node, type: string): Node[] => [
      ...(node.type === type ? [node] : []),
      ...node.children.flatMap((child) => findAll(child, type)),
    ];
    const labels = tree[0].children[5].children[1];
    const [nameParagraph] = findAll(labels, "paragraph");
    const drawn = () =>
      (nameParagraph.props.paragraph as { value: { text?: string } | null })
        .value;
    // Overview: an unfocused body gets no label Paragraph at all.
    expect(drawn()).toBeNull();
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
    expect(drawn()?.text).toBe("Ada Lovelace");
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

describe("38.7-06 D-43: the stable picture tree and the single ambient clock", () => {
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

  it("the same Picture layers for a 3-body and a 120-body System; rings are draws, not nodes", async () => {
    const smallScene = await sceneWith(3);
    const small = renderWorld(
      smallScene,
      useOrreryCamera(cameraInput(smallScene)),
    );
    const smallPictures = findAll(small[0], "skPicture");
    const largeScene = await sceneWith(117);
    const large = renderWorld(
      largeScene,
      useOrreryCamera(cameraInput(largeScene)),
    );
    const largePictures = findAll(large[0], "skPicture");
    expect(smallPictures).toHaveLength(6);
    expect(largePictures).toHaveLength(smallPictures.length);
    expect(large[0].children.map((n) => n.type)).toEqual(
      small[0].children.map((n) => n.type),
    );
    // No ring/Polaris/overlay node anywhere outside the pictures.
    for (const tree of [small, large])
      expect(findAll(tree[0], "path")).toHaveLength(0);
    // The base picture: the sky fill, then one world-plane draw per ring.
    const base = recorded(largePictures[0]);
    expect(base[0]).toEqual({
      op: "drawPaint",
      color: [...parseInk(THEME_PRESETS.galaxy.dark.background)],
    });
    expect(base.filter((c) => c.op === "drawVertices")).toHaveLength(120);
    expect(
      recorded(smallPictures[0]).filter((c) => c.op === "drawVertices"),
    ).toHaveLength(3);
  });
  it("a re-render with a new focus keeps the tree; only the overlay's spec changes", async () => {
    const scene = await sceneWith(3);
    const before = renderWorld(scene, useOrreryCamera(cameraInput(scene)));
    const id = scene.contacts[0].id;
    const after = renderWorld(scene, useOrreryCamera(cameraInput(scene)), [id]);
    const shape = (tree: Node[]) =>
      tree[0].children.map((n) => [n.type, n.children.length]);
    expect(shape(after)).toEqual(shape(before));
    const overlayBefore = recorded(before[0].children[6]);
    const overlayAfter = recorded(after[0].children[6]);
    const accent = [...parseInk(THEME_PRESETS.galaxy.dark.accent)];
    const accentCircles = (commands: Recorded["commands"]) =>
      commands.filter(
        (c) =>
          c.op === "drawCircle" &&
          c.color !== undefined &&
          c.color.slice(0, 3).every((v, i) => v === accent[i]),
      );
    expect(accentCircles(overlayBefore)).toHaveLength(0);
    expect(accentCircles(overlayAfter)).toHaveLength(1);
  });
  it("the stars picture: today's 44 stars; its input holds under reduced motion", async () => {
    const scene = await sceneWith(1);
    const tree = renderWorld(scene, useOrreryCamera(cameraInput(scene)));
    const stars = tree[0].children[1];
    const at = (ms: number) => {
      native.clock.value = ms;
      return recorded(stars).map((c) => c.color?.[3]);
    };
    expect(at(0)).toHaveLength(44);
    expect(at(0)).not.toEqual(at(650));
    native.reduced.value = true;
    expect(at(0)).toEqual(at(650));
    expect(at(1234)).toEqual(at(98765));
  });
  it("useClock runs exactly once per canvas mount and reaches the legacy sun pulse", async () => {
    const scene = await sceneWith(2);
    renderWorld(scene, useOrreryCamera(cameraInput(scene)));
    expect(native.clockCalls).toBe(1);
    expect(native.providedClock).toBe(native.clock);
  });
});
