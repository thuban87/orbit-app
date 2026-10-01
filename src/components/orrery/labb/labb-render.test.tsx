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
import { BODY_REACH, SUN_REACH } from "./labb-bodies-logic";
import { resetLabEffectsForTest } from "./labb-effects";

const lab = vi.hoisted(() => ({
  flags: {} as Record<string, boolean>,
  /** When true the mocked Skia compiles every runtime effect (lit path). */
  effects: false,
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
  PixelRatio: { get: () => 3 },
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
    SweepGradient: "sweepGradient",
    Picture: "picture",
    BlurMask: "blurMask",
    RuntimeShader: "runtimeShader",
    useTexture: () => ({ value: null }),
    useRSXformBuffer: () => ({ value: [] }),
    useRectBuffer: () => ({ value: [] }),
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
      RuntimeEffect: {
        Make: (source: string) => (lab.effects ? { source } : null),
      },
      Path: {
        Make: () => ({ moveTo() {}, lineTo() {}, close() {}, addArc() {} }),
      },
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
  lab.effects = false;
  resetLabEffectsForTest();
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
    // the bake texture exists) + far, WP-2.1 hyperspace-streak and mid/near
    // star Atlases.
    expect(environment.children[0].type).toBe("fill");
    expect(environment.children[1].children.map((c) => c.type)).toEqual([
      "atlas",
      "atlas",
      "atlas",
    ]);
    const [rings, polaris, ghost, bodies, labels, fx] = world.children;
    // L1 (WP-1.3): ONE homography Group; rings are static world circles
    // grouped by instrument class — no per-ring path rebuilt per frame.
    const orbit = rings.children[0];
    expect(orbit.props.matrix).toHaveProperty("value");
    const [classGroup] = orbit.children;
    expect(classGroup.children.map((c) => c.type)).toEqual(["circle"]);
    expect(polaris.children[0].type).toBe("skGroup");
    expect(ghost.type).toBe("path");
    expect(ghost.props.color).toBe(THEME_PRESETS.galaxy.dark.accent);
    expect(bodies.children.map((c) => c.type)).toEqual(["skGroup", "skGroup"]);
    expect(labels.children.length).toBe(1);
    // WP-2.1 switch FX: under the bodies (on the world plane, inside L1) the
    // comet / smear Atlas (the shockwave needs its runtime effect: null here);
    // over the bodies (L7) the particle and capture-flare Atlases.
    const under = rings.children[1];
    expect(under.children.map((c) => c.type)).toEqual(["atlas"]);
    expect(fx.children[0].children.map((c) => c.type)).toEqual([
      "atlas",
      "atlas",
    ]);
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

  it("rings: the homography maps the world ring circle onto the frame's projected ring", async () => {
    const pose = { value: { ...HOME_CAMERA, zoom: 1.7, tilt: 0.4, yaw: 0.6 } };
    const { tree, scene } = await renderLab(pose);
    const orbit = tree[1].children[0].children[0];
    const m = (orbit.props.matrix as { value: number[] }).value;
    expect(m).toHaveLength(9);
    const circle = orbit.children[0].children[0];
    const r = (circle.props.r as { value: number }).value;
    const world = scene.world.find((b) => b.kind === "contact");
    expect(r).toBeCloseTo(world?.ringRadius ?? -1, 6);
    expect(circle.props.cx).toBe(0);
    expect(circle.props.cy).toBe(0);
    // The ring's north point lands where projectFrame put ringPath[0]
    // (exactness of the matrix itself is pinned in labb-rings-logic.test).
    const { applyHomography } = await import("./labb-rings-logic");
    const { projectFrame } = await import("@/logic/orrery-camera-logic");
    const projected = projectFrame(
      scene.world,
      pose.value,
      { width: 500, height: 700 },
      0,
    ).bodies.find((b) => b.kind === "contact");
    const north = applyHomography(m, 0, -r);
    expect(north.x).toBeCloseTo(projected?.ringPath[0].x ?? Number.NaN, 4);
    expect(north.y).toBeCloseTo(projected?.ringPath[0].y ?? Number.NaN, 4);
  });

  it("HUD tag: plate geometry equals the prepared text measurement", async () => {
    const pose = { value: { ...HOME_CAMERA, zoom: 2 } };
    const { tree } = await renderLab(pose);
    const tag = tree[1].children[4].children[0].children[0].children[1];
    const plates = tag.children.filter(
      (c) => c.type === "roundRect" && c.props.style === undefined,
    );
    // [halo, plate]: the plate is EXACTLY the prepared width/height.
    const plate = plates[1];
    // prepareOrreryText (mocked paragraph): longest line 90 + 2×sm padding.
    expect(plate.props.width).toBe(90 + 2 * 8);
    expect(plate.props.height).toBeGreaterThanOrEqual(40);
    expect((plate.props.x as { value: number }).value).toBeTypeOf("number");
    expect(tag.children.some((c) => c.type === "paragraph")).toBe(true);
    expect(tag.children.filter((c) => c.type === "line")).toHaveLength(2);
  });

  it("labelHud off keeps the legacy plate", async () => {
    lab.flags = { fpsHud: false, labelHud: false };
    const { tree } = await renderLab({ value: { ...HOME_CAMERA, zoom: 2 } });
    const tag = tree[1].children[4].children[0].children[0].children[1];
    expect(tag.children.some((c) => c.type === "line")).toBe(false);
  });

  it("ringsPathRebuild flag restores the WP-1.0 per-ring Path baseline", async () => {
    lab.flags = { fpsHud: false, ringsPathRebuild: true };
    const { tree } = await renderLab({ value: { ...HOME_CAMERA } });
    const rings = tree[1].children[0].children[0];
    expect(rings.children.map((c) => c.type)).toEqual(["path"]);
  });

  it("unmounts heavy layers whose flag is off", async () => {
    lab.flags = {
      fpsHud: false,
      environment: false,
      rings: false,
      bodies: false,
      labels: false,
      polaris: false,
      fx: false,
    };
    const { tree } = await renderLab({ value: { ...HOME_CAMERA } });
    expect(tree).toHaveLength(1);
    const [rings, polaris, , bodies, labels, fx] = tree[0].children;
    expect(rings.children).toEqual([]);
    expect(polaris.children).toEqual([]);
    expect(bodies.children).toEqual([]);
    expect(labels.children).toEqual([]);
    expect(fx.children).toEqual([]);
  });

  it("WP-2.1: each switch effect unmounts with its flag", async () => {
    lab.flags = {
      fpsHud: false,
      fxComets: false,
      fxShockwave: false,
      fxParticles: false,
      fxFlares: false,
      fxStreaks: false,
    };
    const { tree } = await renderLab({ value: { ...HOME_CAMERA } });
    const [environment, world] = tree;
    expect(environment.children[1].children.map((c) => c.type)).toEqual([
      "atlas",
      "atlas",
    ]);
    const [rings, , , , , fx] = world.children;
    expect(rings.children[1].children).toEqual([]);
    expect(fx.children[0].children).toEqual([]);
  });

  it("WP-2.1 experiment: the displacement filter wraps L1–L5 in ONE saveLayer, labels outside", async () => {
    lab.effects = true;
    lab.flags = { fpsHud: false, fxShockFilter: true };
    const filtered = (await renderLab({ value: { ...HOME_CAMERA } })).tree[1];
    const [wrapped, labels, over] = filtered.children;
    // RN Skia's Group turns an element `layer` into skLayer(paint, skGroup).
    expect(wrapped.type).toBe("skLayer");
    const [paint, group] = wrapped.children;
    expect(paint.type).toBe("paint");
    expect(paint.children[0].type).toBe("runtimeShader");
    expect(group.children).toHaveLength(4);
    expect(labels.children.length).toBe(1);
    expect(over.children[0].children.map((c) => c.type)).toEqual([
      "atlas",
      "atlas",
    ]);
  });

  it("mounts the FPS HUD only while its flag is on", async () => {
    lab.flags = { fpsHud: true };
    const { tree } = await renderLab({ value: { ...HOME_CAMERA } });
    const hud = tree[2];
    expect(hud.children[0].type).toBe("roundRect");
    expect(hud.children.some((c) => c.type === "path")).toBe(true);
  });

  it("falls back to flat discs when every runtime effect is null", async () => {
    const { tree } = await renderLab({ value: { ...HOME_CAMERA } });
    const [contact, sun] = tree[1].children[3].children;
    expect(contact.children.some((c) => c.type === "shader")).toBe(false);
    expect(contact.children[0].type).toBe("circle");
    expect(sun.children.some((c) => c.type === "circle")).toBe(true);
  });

  it("lit path: ONE shader circle per body at r·reach, disc uniform = world radius", async () => {
    lab.effects = true;
    const pose = { value: { ...HOME_CAMERA } };
    const { tree, scene } = await renderLab(pose);
    const [contact, sun] = tree[1].children[3].children;
    const worldR = (kind: string) =>
      scene.world.find((b) => b.kind === kind)?.radius ?? 0;
    const lit = contact.children.filter(
      (c) => c.children[0]?.type === "shader",
    );
    expect(lit).toHaveLength(1);
    expect(lit[0].props.r).toBeCloseTo(worldR("contact") * BODY_REACH, 6);
    const uniforms = lit[0].children[0].props.uniforms as {
      value: { uA: number[] };
    };
    // The shader's disc is EXACTLY the world radius (the transform scales it to
    // the frame radius), so hit/label/focus geometry is unchanged.
    expect(uniforms.value.uA[0]).toBe(worldR("contact"));
    pose.value = { ...pose.value, zoom: 2 };
    expect(uniforms.value.uA[1]).toBeCloseTo(0.5, 5);
    const [, , lx, ly] = uniforms.value.uA;
    expect(Math.hypot(lx, ly)).toBeCloseTo(1, 5);
    const sunLit = sun.children.find((c) => c.children[0]?.type === "shader");
    expect(sunLit?.props.r).toBeCloseTo(worldR("sun") * SUN_REACH, 6);
    for (const body of [contact, sun]) expect(body.props.layer).toBeUndefined();
  });

  it("bodyLighting off keeps the flat path even when effects compile", async () => {
    lab.effects = true;
    lab.flags = { fpsHud: false, bodyLighting: false };
    const { tree } = await renderLab({ value: { ...HOME_CAMERA } });
    const [contact] = tree[1].children[3].children;
    expect(contact.children.some((c) => c.children[0]?.type === "shader")).toBe(
      false,
    );
  });

  it("derives real initials when Hermes returned the whole name", () => {
    expect(labInitials("Eli Novak")).toBe("EN");
    expect(labInitials("EN")).toBe("EN");
    expect(labInitials("cleo okafor jones")).toBe("CO");
    expect(labInitials("")).toBe("");
  });
});
