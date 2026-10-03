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
}));
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
vi.mock("./orrery-clock-context", () => ({ useOrreryClock: () => null }));
// The bodies' photo hook (38.6-04 D-11) — a photo-less render, as `useImage: () => null` was.
vi.mock("./use-orrery-photo", () => ({ useOrreryPhoto: () => null }));
vi.mock("@/theme/use-reduced-motion", () => ({
  useReducedMotionShared: () => ({ value: false }),
}));
vi.mock("./OrreryCanvas", () => ({
  OrreryCanvas: ({ children }: { children: ReactNode }) => children,
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
    Picture: "skPicture",
    createPicture: (draw: (canvas: unknown) => void) => {
      const commands: string[] = [];
      draw(new Proxy({}, { get: (_t, op: string) => () => commands.push(op) }));
      return { commands };
    },
    DashPathEffect: "dash",
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
      Color: (c: string) => c,
      Paint: () => ({ setAlphaf: () => {} }),
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
    // [base rings picture, clip Group [bodies, labels], overlay picture]
    const bodies = tree[1].children[0];
    expect(bodies.children.map((n) => n.type)).toEqual([
      "skGroup",
      "skGroup",
      "skGroup",
    ]);
    const moon = bodies.children[2];
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
    // 38.7-06: the rings are the V2 base picture and Polaris, the reorder
    // outline and the focus outlines the overlay picture, around the legacy
    // body/label slot (v2/draw-overlay.test.ts covers their drawing).
    expect(tree.map((node) => node.type)).toEqual([
      "skPicture",
      "skGroup",
      "skPicture",
    ]);
    const [bodies, labels] = tree[1].children;
    expect(bodies.children.map((child) => child.type)).toEqual([
      "skGroup",
      "skGroup",
    ]);
    expect(labels.children.length).toBe(1);
    const [contact, sun] = bodies.children;
    const depth = (node: Node) =>
      (node.props.zIndex as { value: number }).value;
    expect(depth(contact)).toBeLessThan(depth(sun));
    pose.value = { ...pose.value, yaw: Math.PI };
    expect(depth(contact)).toBeGreaterThan(depth(sun));
    for (const body of bodies.children)
      expect(body.props.layer).toHaveProperty("value");
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
    expect(
      (contact.props.transform as { value: unknown[] }).value,
    ).toHaveLength(3);
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
    const labels = tree[1].children[1];
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
