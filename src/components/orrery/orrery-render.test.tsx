import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { HOME_CAMERA } from "@/logic/orrery-camera-logic";
import { loadOrreryScene } from "@/services/orrery-scene";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { prepareOrreryText } from "./OrreryLabel";
import { OrreryWorld } from "./OrreryWorld";

const native = vi.hoisted(() => ({
  paragraphs: [] as {
    text: string;
    style: Record<string, unknown>;
    options: Record<string, unknown>;
  }[],
}));
vi.mock("expo-sqlite", () => ({}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => {},
  useState: (factory: () => unknown) => [factory(), () => {}],
}));
vi.mock("react-native", () => ({
  useWindowDimensions: () => ({ fontScale: 2 }),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoUri: (path: string) => path,
}));
vi.mock("./orrery-clock-context", () => ({ useOrreryClock: () => null }));
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
  useAnimatedReaction: () => {},
  cancelAnimation: () => {},
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
  withTiming: (v: unknown) => v,
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
          const item = { text: "", style: {}, options };
          const builder = {
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
              native.paragraphs.push(item);
              return {
                layout: () => {},
                getLongestLine: () => 90,
                getHeight: () => 40,
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
  native.paragraphs = [];
  db = openTestDb();
  let uid = 0;
  await runMigrations(nodeSqliteExecutor(db), MIGRATIONS, TARGET_VERSION, {
    now: "2026-09-07 12:00:00",
    newUid: () => `render-${++uid}`,
    defaultPhoneRegion: "US",
  });
});
afterEach(() => db.close());

describe("production Orrery native tree and resource contracts", () => {
  it("keeps actual sun/contact root Groups in one consecutive batch with shared native paint layers", async () => {
    const exec = nodeSqliteExecutor(db);
    await exec.runAsync(
      "INSERT INTO contacts(uid,name,tracking_enabled,interval_days,created_at,modified_at) VALUES ('name','Zoë',1,30,'2026-09-07','2026-09-07')",
    );
    const scene = await loadOrreryScene(exec, 1);
    const pose = { value: { ...HOME_CAMERA, tilt: 0.5 } };
    const tree = resolve(
      OrreryWorld({
        scene,
        pose: pose as never,
        viewport: { width: 500, height: 700 },
        colors: THEME_PRESETS.galaxy.dark,
        fontProvider: {} as never,
        onIntent: () => {},
        focusedIds: [],
      }),
    );
    const [rings, bodies, labels] = tree[0].children;
    expect(rings.children.every((child) => child.type === "path")).toBe(true);
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
    pose.value = { ...pose.value, yaw: 0, zoom: 2 };
    expect(alpha.value).toBe(1);
    expect(
      (contact.props.transform as { value: unknown[] }).value,
    ).toHaveLength(3);
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
