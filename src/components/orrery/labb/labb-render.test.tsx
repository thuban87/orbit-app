/**
 * ORRERY LAB B — pins the lab renderer's tree contract (research 03 §2.7),
 * with the same mocked-Skia technique as `orrery-render.test.tsx` (which keeps
 * pinning the LEGACY renderer, still shipped as the A/B baseline).
 */
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { HOME_CAMERA } from "@/logic/orrery-camera-logic";
import { beginSwitchChoreography } from "@/logic/orrery-switch-choreography";
import { loadOrreryScene } from "@/services/orrery-scene";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { OrreryWorld } from "../OrreryWorld";
import { useOrreryCamera } from "../use-orrery-camera";
import { labInitials } from "./LabBodies";

const lab = vi.hoisted(() => ({
  flags: {} as Record<string, boolean>,
}));

vi.mock("@/stores/orrery-labb-fx-store", async (original) => {
  const real = await original<typeof import("@/stores/orrery-labb-fx-store")>();
  return {
    ...real,
    useLabFxStore: (selector: (s: unknown) => unknown) =>
      selector({
        renderer: "lab",
        flags: { ...real.defaultLabFlags(), ...lab.flags },
        intensity: 1,
      }),
  };
});
vi.mock("expo-sqlite", () => ({}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useRef: (value: unknown) => ({ current: value }),
  useEffect: () => {},
  useContext: () => null,
  useState: (value: unknown) => [
    typeof value === "function" ? (value as () => unknown)() : value,
    () => {},
  ],
}));
vi.mock("react-native", () => ({
  useWindowDimensions: () => ({ fontScale: 1 }),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoUri: (path: string) => path,
}));
vi.mock("../use-orrery-photo", () => ({ useOrreryPhoto: () => null }));
vi.mock("@/theme/use-reduced-motion", () => ({
  useReducedMotionShared: () => ({ value: false }),
}));
vi.mock("./LabCanvas", () => ({
  LabCanvas: ({ children }: { children: ReactNode }) => children,
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
  return {
    Group,
    Circle: "circle",
    Fill: "fill",
    Paragraph: "paragraph",
    Paint: "paint",
    Path: "path",
    DashPathEffect: "dash",
    RoundedRect: "roundRect",
    Image: "image",
    Text: "text",
    Line: "line",
    Shader: "shader",
    ImageShader: "imageShader",
    Atlas: "atlas",
    Rect: "rect",
    RadialGradient: "radialGradient",
    LinearGradient: "linearGradient",
    useTexture: () => ({ value: null }),
    useRSXformBuffer: () => ({ value: [] }),
    useColorBuffer: () => ({ value: [] }),
    vec: (x: number, y: number) => ({ x, y }),
    matchFont: () => ({ measureText: () => ({ width: 10 }) }),
    TextAlign: { Center: 2 },
    rect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
    rrect: (rect: unknown) => rect,
    Skia: {
      Color: (c: string) => c,
      Path: { Make: () => ({ moveTo() {}, lineTo() {}, close() {} }) },
      ParagraphBuilder: {
        Make: () => {
          const builder = {
            pushStyle: () => builder,
            addText: () => builder,
            pop: () => builder,
            build: () => ({
              layout: () => {},
              getLongestLine: () => 90,
              getHeight: () => 40,
            }),
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

let db: ReturnType<typeof openTestDb>;
beforeEach(async () => {
  lab.flags = { fpsHud: false };
  db = openTestDb();
  let uid = 0;
  await runMigrations(nodeSqliteExecutor(db), MIGRATIONS, TARGET_VERSION, {
    now: "2026-09-07 12:00:00",
    newUid: () => `labb-${++uid}`,
    defaultPhoneRegion: "US",
  });
});
afterEach(() => db.close());

async function renderLab(pose: { value: typeof HOME_CAMERA }) {
  const exec = nodeSqliteExecutor(db);
  await exec.runAsync(
    "INSERT INTO contacts(uid,name,tracking_enabled,interval_days,created_at,modified_at) VALUES ('name','Zoë',1,30,'2026-09-07','2026-09-07')",
  );
  const scene = await loadOrreryScene(exec, 1);
  const tree = resolve(
    OrreryWorld({
      // biome-ignore lint/correctness/useHookAtTopLevel: harness calls the hook body directly (mocked React)
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
  return { scene, tree };
}

describe("Lab B renderer tree contract", () => {
  it("draws the layer slots in fixed order with a contiguous, layer-free body batch", async () => {
    const pose = { value: { ...HOME_CAMERA, tilt: 0.5 } };
    const { tree } = await renderLab(pose);
    const [environment, world] = tree;
    // L0: sky/nebula fill (the baked sample falls back to a token Fill until
    // the bake texture exists) + far and mid/near star Atlases.
    expect(environment.children[0].type).toBe("fill");
    expect(environment.children[1].children.map((c) => c.type)).toEqual([
      "atlas",
      "atlas",
    ]);
    const [rings, polaris, ghost, bodies, labels, fx] = world.children;
    expect(rings.children[0].children.length).toBe(1);
    expect(rings.children[0].children.every((c) => c.type === "path")).toBe(
      true,
    );
    expect(polaris.children[0].type).toBe("skGroup");
    expect(ghost.type).toBe("path");
    expect(ghost.props.color).toBe(THEME_PRESETS.galaxy.dark.accent);
    expect(bodies.children.map((c) => c.type)).toEqual(["skGroup", "skGroup"]);
    expect(labels.children.length).toBe(1);
    expect(fx.children).toEqual([]);
    // No per-body saveLayer: alpha is Group opacity.
    for (const body of bodies.children) {
      expect(body.props.layer).toBeUndefined();
      expect(body.props.opacity).toHaveProperty("value");
    }
    const [contact, sun] = bodies.children;
    const depth = (n: Node) => (n.props.zIndex as { value: number }).value;
    expect(depth(contact)).toBeLessThan(depth(sun));
    pose.value = { ...pose.value, yaw: Math.PI };
    expect(depth(contact)).toBeGreaterThan(depth(sun));
  });

  it("draws every body at the frame radius and hides labels at overview", async () => {
    const pose = { value: { ...HOME_CAMERA } };
    const { tree, scene } = await renderLab(pose);
    const world = tree[1];
    const contact = world.children[3].children[0];
    const transform = contact.props.transform as {
      value: { scale?: number }[];
    };
    expect(transform.value).toHaveLength(3);
    const worldRadius =
      scene.world.find((b) => b.kind === "contact")?.radius ?? 0;
    expect(worldRadius).toBeGreaterThan(0);
    pose.value = { ...pose.value, zoom: 2 };
    // projected radius = world radius × zoom × perspective (1 at tilt 0)
    expect((transform.value[2].scale ?? 0) * worldRadius).toBeCloseTo(
      worldRadius * 2,
      5,
    );
    pose.value = { ...pose.value, zoom: 1 };
    const nameLayer = world.children[4].children[0].children[0];
    const alpha = nameLayer.children[0].props.opacity as { value: number };
    expect(alpha.value).toBe(0);
    pose.value = { ...pose.value, zoom: 2 };
    expect(alpha.value).toBe(1);
  });

  it("unmounts heavy layers whose flag is off", async () => {
    lab.flags = {
      fpsHud: false,
      environment: false,
      rings: false,
      bodies: false,
      labels: false,
      polaris: false,
    };
    const { tree } = await renderLab({ value: { ...HOME_CAMERA } });
    expect(tree).toHaveLength(1);
    const [rings, polaris, , bodies, labels] = tree[0].children;
    expect(rings.children).toEqual([]);
    expect(polaris.children).toEqual([]);
    expect(bodies.children).toEqual([]);
    expect(labels.children).toEqual([]);
  });

  it("mounts the FPS HUD only while its flag is on", async () => {
    lab.flags = { fpsHud: true };
    const { tree } = await renderLab({ value: { ...HOME_CAMERA } });
    const hud = tree[2];
    expect(hud.children[0].type).toBe("roundRect");
    expect(hud.children.some((c) => c.type === "path")).toBe(true);
  });

  it("derives real initials when Hermes returned the whole name", () => {
    expect(labInitials("Eli Novak")).toBe("EN");
    expect(labInitials("EN")).toBe("EN");
    expect(labInitials("cleo okafor jones")).toBe("CO");
    expect(labInitials("")).toBe("");
  });
});
