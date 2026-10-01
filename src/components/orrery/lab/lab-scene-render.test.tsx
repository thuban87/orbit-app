/**
 * ORRERY LAB A — ARCH PERF PASS contract of the imperative scene renderer.
 *
 * Structural intent (perf regression guards):
 *  - the Lab A Canvas tree is ONE Group of five `<Picture>` nodes, whatever
 *    the body count — no per-body / per-label Skia nodes, no animated prop
 *    other than the pictures (RN-Skia converts every animated prop of the
 *    tree on each redraw, and re-records the tree on any change);
 *  - the reticle picture is reference-stable when nothing is focused, and
 *    no ambient clock is read without one (idle → no redraw).
 * Semantic intent (what the replaced declarative tests pinned):
 *  - moons draw in the textSecondary token ink, hidden at overview;
 *  - body draw order follows depth (flips with yaw), ties in source order;
 *  - labels draw only when allocated (overview: none; zoom 2: the name).
 */
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { readOrrerySatellites } from "@/db/orrery-satellites-read";
import { addRelationship } from "@/db/relationships-dao";
import { HOME_CAMERA } from "@/logic/orrery-camera-logic";
import { beginSwitchChoreography } from "@/logic/orrery-switch-choreography";
import { loadOrreryScene } from "@/services/orrery-scene";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { OrreryWorld } from "../OrreryWorld";
import { useOrreryCamera } from "../use-orrery-camera";

/** Token string → a unique RGBA (so draw calls can be traced to tokens). */
const inks = vi.hoisted(() => {
  const byToken = new Map<string, number[]>();
  return {
    of(token: string): number[] {
      let v = byToken.get(token);
      if (!v) {
        v = [(byToken.size + 1) / 1000, 0.5, 0.25, 1];
        byToken.set(token, v);
      }
      return v;
    },
    tokenOf(color: ArrayLike<number>): string | undefined {
      for (const [token, v] of byToken)
        if (Math.abs(v[0] - color[0]) < 1e-6 && v[1] === color[1]) return token;
      return undefined;
    },
  };
});

vi.mock("expo-sqlite", () => ({}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useRef: (value: unknown) => ({ current: value }),
  useEffect: () => {},
  useState: (factory: () => unknown) => [factory(), () => {}],
}));
vi.mock("react-native", () => ({
  useWindowDimensions: () => ({ fontScale: 1, scale: 1 }),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoUri: (path: string) => path,
}));
vi.mock("../orrery-clock-context", () => ({ useOrreryClock: () => null }));
vi.mock("../use-orrery-photo", () => ({ useOrreryPhoto: () => null }));
vi.mock("@/theme/use-reduced-motion", () => ({
  useReducedMotionShared: () => ({ value: false }),
}));
vi.mock("../OrreryCanvas", () => ({
  OrreryCanvas: ({
    children,
    backdrop,
  }: {
    children: ReactNode;
    backdrop?: ReactNode;
  }) => [backdrop ?? null, children],
}));
vi.mock("react-native-reanimated", () => ({
  useDerivedValue: (fn: () => unknown) => ({
    get value() {
      return fn();
    },
  }),
  useSharedValue: (value: unknown) => ({ value }),
  useAnimatedReaction: () => {},
  cancelAnimation: () => {},
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
  withTiming: (v: unknown) => v,
  Easing: { linear: (t: number) => t },
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
  const { Group } = await import(
    "../../../../node_modules/@shopify/react-native-skia/lib/module/renderer/components/Group.js"
  );
  // Any other Skia factory/object: an inert chainable stub.
  const stub: unknown = new Proxy(() => stub, {
    get: (_t, key) => (key === Symbol.toPrimitive ? () => 0 : stub),
    apply: () => stub,
  });
  const paint = () => {
    const state: Record<string, unknown> = { alpha: 1 };
    return new Proxy(state, {
      get: (target, key: string) =>
        key in target
          ? target[key]
          : (...args: unknown[]) => {
              if (key === "setColor") target.color = args[0];
              if (key === "setAlphaf") target.alpha = args[0];
              if (key === "setShader") target.shader = args[0];
              return undefined;
            },
    });
  };
  return {
    Group,
    Circle: "circle",
    Paragraph: "paragraph",
    Paint: "paint",
    Path: "path",
    DashPathEffect: "dash",
    RoundedRect: "roundRect",
    Image: "image",
    Picture: "picture",
    Rect: "rect",
    Shader: "shader",
    createPicture: (draw: (canvas: unknown) => void) => ({ recorded: draw }),
    TextAlign: { Center: 2, Left: 0 },
    rect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
    rrect: (r: unknown) => r,
    Skia: {
      Color: (c: string) => Float32Array.from(inks.of(c)),
      Paint: paint,
      XYWHRect: (x: number, y: number, width: number, height: number) => ({
        x,
        y,
        width,
        height,
      }),
      RRectXY: (rect: unknown) => rect,
      Path: { Make: () => stub, MakeFromSVGString: () => stub },
      PathBuilder: { Make: () => stub },
      Shader: stub,
      Matrix: () => stub,
      Surface: { MakeOffscreen: () => null },
      ParagraphBuilder: {
        Make: () => {
          let text = "";
          const builder = {
            pushStyle: () => builder,
            addText: (t: string) => {
              text += t;
              return builder;
            },
            pop: () => builder,
            build: () => ({
              text,
              layout: () => {},
              getLongestLine: () => 90,
              getHeight: () => 20,
              paint: (canvas: Recorder, x: number, y: number) =>
                canvas.calls.push(["paragraph", text, x, y]),
            }),
          };
          return builder;
        },
      },
    },
  };
});

type Call = [string, ...unknown[]];
interface Recorder {
  calls: Call[];
}
/** A canvas that records every call (paint colour kept as its token). */
function recorder(): Recorder & Record<string, unknown> {
  const calls: Call[] = [];
  return new Proxy(
    { calls },
    {
      get: (target, key: string) =>
        key === "calls"
          ? target.calls
          : (...args: unknown[]) => {
              const last = args[args.length - 1] as
                | { color?: ArrayLike<number>; alpha?: number }
                | undefined;
              calls.push([
                key,
                ...args,
                last?.color ? inks.tokenOf(last.color) : undefined,
              ]);
              return 0;
            },
    },
  ) as Recorder & Record<string, unknown>;
}

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
function all(nodes: Node[]): Node[] {
  return nodes.flatMap((n) => [n, ...all(n.children)]);
}
function draw(node: Node): Call[] {
  const picture = (
    node.props.picture as { value: { recorded?: (c: unknown) => void } }
  ).value;
  const canvas = recorder();
  picture.recorded?.(canvas);
  return canvas.calls;
}

let db: ReturnType<typeof openTestDb>;
beforeEach(async () => {
  db = openTestDb();
  let uid = 0;
  await runMigrations(nodeSqliteExecutor(db), MIGRATIONS, TARGET_VERSION, {
    now: "2026-09-07 12:00:00",
    newUid: () => `lab-${++uid}`,
    defaultPhoneRegion: "US",
  });
});
afterEach(() => db.close());

async function world(
  contacts: string[],
  pose: { value: typeof HOME_CAMERA },
  options: { moon?: boolean; focusedIds?: number[] } = {},
) {
  const exec = nodeSqliteExecutor(db);
  for (const name of contacts)
    await exec.runAsync(
      "INSERT INTO contacts(uid,name,tracking_enabled,interval_days,created_at,modified_at) VALUES (?,?,1,30,'2026-09-07','2026-09-07')",
      [`u-${name}`, name],
    );
  let scene = await loadOrreryScene(exec, 1);
  if (options.moon) {
    await addRelationship(exec, {
      contactId: scene.contacts[0].id,
      personName: "Moon",
      createdAt: "2026-09-07",
      now: "2026-09-07",
    });
    scene = await loadOrreryScene(exec, 1);
  }
  const satellites = options.moon
    ? await readOrrerySatellites(exec, scene.systemSnapshot.members)
    : [];
  const viewport = { width: 500, height: 700 };
  const tree = resolve(
    OrreryWorld({
      scene,
      satellites,
      pose: pose as never,
      viewport,
      // biome-ignore lint/correctness/useHookAtTopLevel: React is stubbed (plain function render harness)
      camera: useOrreryCamera({
        pose: pose as never,
        enabled: true,
        extent: scene.extent,
        viewport,
        reduced: { value: false } as never,
      }),
      colors: THEME_PRESETS.galaxy.dark,
      fontProvider: {} as never,
      onIntent: vi.fn(),
      onReorder: vi.fn(),
      onReorderActivated: vi.fn(),
      focusedIds: options.focusedIds ?? [],
      switchRuntime: {
        transition: {
          value: beginSwitchChoreography(
            scene.world,
            scene.world,
            scene.generation,
            { intensity: 0, reducedMotion: false },
          ),
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
      } as never,
    }),
  );
  return { tree, scene };
}

describe("Lab A imperative scene renderer: canvas tree contract", () => {
  it("is one Group of five pictures, independent of the body count", async () => {
    const small = await world(["Ann"], { value: HOME_CAMERA });
    const [root] = small.tree;
    expect(root.type).toBe("skGroup");
    expect(root.children.map((n) => n.type)).toEqual([
      "picture",
      "picture",
      "picture",
      "picture",
      "picture",
    ]);
    db.close();
    db = openTestDb();
    await runMigrations(nodeSqliteExecutor(db), MIGRATIONS, TARGET_VERSION, {
      now: "2026-09-07 12:00:00",
      newUid: (() => {
        let n = 0;
        return () => `lab2-${++n}`;
      })(),
      defaultPhoneRegion: "US",
    });
    const big = await world(["Ann", "Ben", "Cat", "Dev", "Eli", "Fay"], {
      value: HOME_CAMERA,
    });
    // No per-body/per-label nodes: same node count for 1 or 6 contacts.
    expect(all(big.tree).length).toBe(all(small.tree).length);
    expect(
      all(big.tree).filter((n) =>
        ["circle", "paragraph", "image", "roundRect", "path"].includes(n.type),
      ),
    ).toEqual([]);
  });

  it("keeps the reticle picture reference-stable while nothing is focused", async () => {
    const { tree } = await world(["Ann"], { value: HOME_CAMERA });
    const reticle = tree[0].children[3].props.picture as { value: unknown };
    expect(reticle.value).toBe(reticle.value);
  });
});

describe("Lab A imperative scene renderer: drawn semantics", () => {
  it("draws the moon in the textSecondary token, and hides it at overview", async () => {
    const pose = { value: { ...HOME_CAMERA, zoom: 2 } };
    const { tree } = await world(["Parent"], pose, { moon: true });
    const moonInk = THEME_PRESETS.galaxy.dark.textSecondary;
    const unitCircle = (calls: Call[]) =>
      calls.filter((c) => c[0] === "drawCircle" && c[3] === 1);
    const pictures = tree[0].children;
    const zoomed = [...draw(pictures[0]), ...draw(pictures[2])];
    expect(unitCircle(zoomed).map((c) => c[c.length - 1])).toEqual([moonInk]);
    pose.value = { ...pose.value, zoom: 1 };
    const overview = [...draw(pictures[0]), ...draw(pictures[2])];
    expect(unitCircle(overview)).toEqual([]);
  });

  it("orders bodies by depth (flips with yaw) and keeps the sun in its own picture", async () => {
    const pose = { value: { ...HOME_CAMERA, tilt: 0.5 } };
    const { tree } = await world(["Zoë"], pose);
    const [below, sun, above] = tree[0].children;
    const contactIn = (calls: Call[]) =>
      calls.some((c) => c[0] === "paragraph" && c[1] === "Z");
    // The sun has its own picture (the only ambient-driven body).
    expect(draw(sun).some((c) => c[0] === "translate")).toBe(true);
    const rearFirst = contactIn(draw(below));
    pose.value = { ...pose.value, yaw: Math.PI };
    const rearAfterYaw = contactIn(draw(below));
    expect(rearFirst).not.toBe(rearAfterYaw);
    expect(contactIn(draw(above))).toBe(!rearAfterYaw);
  });

  it("draws a name plate only once allocated (none at overview, the name at zoom 2)", async () => {
    const pose = { value: { ...HOME_CAMERA } };
    const { tree } = await world(["Zoë"], pose);
    const top = tree[0].children[4];
    const plates = () =>
      draw(top).filter((c) => c[0] === "paragraph" && c[1] === "Zoë");
    expect(plates()).toEqual([]);
    pose.value = { ...pose.value, zoom: 2 };
    expect(plates()).toHaveLength(1);
  });
});
