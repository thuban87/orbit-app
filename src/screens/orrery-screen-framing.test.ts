import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { canvasViewport } from "@/components/orrery/orrery-obstacle-logic";
import * as overlayLogic from "@/components/orrery/orrery-overlay-logic";
import * as switchLogic from "@/components/orrery/orrery-switch-animation";
import * as occlusionSources from "@/components/orrery/v2/occlusion-sources";
import * as cameraLogic from "@/logic/orrery-camera-logic";
import * as focusCardLogic from "@/logic/orrery-focus-card-logic";
import * as focusLogic from "@/logic/orrery-focus-logic";
import * as frameLogic from "@/logic/orrery-frame";
import * as gestureLogic from "@/logic/orrery-gesture-logic";
import * as recoveryLogic from "@/logic/orrery-recovery-logic";
import * as satelliteLogic from "@/logic/orrery-satellite-logic";
import * as sessionLogic from "@/logic/orrery-session-logic";
import * as systemLogic from "@/logic/orrery-system-logic";
import {
  createShellObstacleStore,
  createWindowMeasurement,
  sameWindowRect,
} from "@/stores/shell-obstacle-store";

const require = createRequire(import.meta.url);
const babel = require("@babel/core");
type Element = {
  type: unknown;
  props: Record<string, unknown> & { children?: Element | Element[] };
};
type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
type HomeProfileName = keyof typeof cameraLogic.HOME_PROFILES;
/** The camera module the screen sees, with Home switched to `profile` (D-03). */
function cameraFor(profile: HomeProfileName): typeof cameraLogic {
  if (profile === cameraLogic.ACTIVE_HOME_PROFILE) return cameraLogic;
  const chosen = cameraLogic.HOME_PROFILES[profile];
  return {
    ...cameraLogic,
    HOME_CAMERA: {
      ...cameraLogic.HOME_CAMERA,
      tilt: chosen.tilt,
      lensShift: chosen.lensShift,
    },
    deriveHomePose: (world, viewport) =>
      cameraLogic.deriveHomePose(world, viewport, chosen),
  };
}
/** Discrete React effect/cleanup ordering, with delayed native layout and animation completion. */
function harness(
  profile: HomeProfileName = cameraLogic.ACTIVE_HOME_PROFILE,
  options: {
    canvas?: { width: number; height: number };
    controls?: cameraLogic.CameraRect;
    moons?: boolean;
    /** 38.7-12 (D-39): the floating title's window rect (an obstacle). */
    header?: cameraLogic.CameraRect;
  } = {},
) {
  const camera = cameraFor(profile);
  const canvas = options.canvas ?? { width: 400, height: 600 };
  const slots: Slot[] = [];
  let cursor = 0,
    dirty = false;
  let effects: (() => void)[] = [];
  function nextSlot(initial: Slot = {}) {
    slots[cursor] ??= initial;
    return slots[cursor++];
  }
  const hooks = {
    useRef(value: unknown) {
      const slot = nextSlot({ value: { current: value } });
      return slot.value;
    },
    useState(value: unknown) {
      const slot = nextSlot({
        value: typeof value === "function" ? value() : value,
      });
      return [
        slot.value,
        (next: unknown) => {
          const value = typeof next === "function" ? next(slot.value) : next;
          if (!Object.is(value, slot.value)) {
            slot.value = value;
            dirty = true;
          }
        },
      ];
    },
    useMemo(factory: () => unknown, deps: unknown[]) {
      const slot = nextSlot();
      if (!slot.deps || deps.some((d, i) => !Object.is(d, slot.deps?.[i]))) {
        slot.value = factory();
        slot.deps = deps;
      }
      return slot.value;
    },
    useCallback(callback: unknown, deps: unknown[]) {
      return hooks.useMemo(() => callback, deps);
    },
    useEffect(effect: () => (() => void) | undefined, deps: unknown[]) {
      const slot = nextSlot();
      if (!slot.deps || deps.some((d, i) => !Object.is(d, slot.deps?.[i]))) {
        slot.deps = deps;
        effects.push(() => {
          slot.cleanup?.();
          slot.cleanup = effect();
        });
      }
    },
  };
  const members = [1, 2].map((id) => ({
    id,
    uid: `u${id}`,
    name: `Person ${id}`,
  }));
  const scene = {
    generation: 7,
    system: systemLogic.ALL_CONTACTS_SYSTEM,
    preferences: { density: "balanced" },
    extent: 120,
    contacts: members,
    world: members.map((m, i) => ({
      id: m.id,
      kind: "contact" as const,
      x: 0,
      y: [-58, -92][i],
      radius: 16,
      ringRadius: [58, 92][i],
    })),
    systemSnapshot: { members, resolvedSunIdentity: null },
    sun: {},
  };
  const state = {
    snapshot: scene,
    status: "ready",
    generation: 7,
    requested: { id: "builtin:all-contacts" },
    current: () => scene,
    select: vi.fn(),
    reload: vi.fn(),
  };
  type StoreState = typeof state;
  const listeners = new Set<(next: StoreState, previous: StoreState) => void>();
  const store = Object.assign(() => state, {
    getState: () => state,
    subscribe: (listener: (next: StoreState, previous: StoreState) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
  // 38.7-11: the focused person's moons (the satellite publisher's index).
  const satelliteSpec: satelliteLogic.OrrerySatelliteSpec = options.moons
    ? {
        sceneGeneration: 7,
        status: "ready",
        index: satelliteLogic.indexSatellites(
          ["m-a", "m-b"].map((uid) => ({
            uid,
            parentId: 1,
            parentUid: "u1",
            personName: uid,
            relationType: null,
          })),
          members,
        ),
      }
    : satelliteLogic.EMPTY_SATELLITE_SPEC;
  const switchProgress = { value: 1 };
  const prefs = {
    committed: { density: "balanced", satellitesEnabled: 0 },
    hydrated: true,
    hydrate: async () => {},
  };
  const prefStore = Object.assign(
    (selector: (s: unknown) => unknown) => selector(prefs),
    { getState: () => prefs },
  );
  const session: {
    resume: string;
    resumed: () => void;
    generation: number;
    saved?: unknown;
  } = {
    resume: "active",
    resumed: () => {
      session.resume = "active";
    },
    generation: 0,
  };
  const sessionStore = Object.assign(
    (selector: (s: unknown) => unknown) => selector(session),
    { getState: () => session },
  );
  const obstacles = createShellObstacleStore();
  obstacles
    .getState()
    .publish(
      "controls",
      options.controls ?? { x: 184, y: 400, width: 200, height: 180 },
    );
  if (options.header)
    obstacles.getState().publish("orrery-immersive-header", options.header);
  const pending: {
    target: cameraLogic.CameraPose;
    complete: (success: boolean) => void;
    cancelled: boolean;
  }[] = [];
  const navigation = { getState: () => ({ routes: [], index: 0 }) };
  const reanimated = {
    useSharedValue(value: unknown) {
      return (
        hooks.useRef({ value }) &&
        (slots[cursor - 1].value as { current: unknown }).current
      );
    },
    runOnUI: (fn: unknown) => fn,
    runOnJS: (fn: unknown) => fn,
    useAnimatedReaction: () => {},
    useDerivedValue: (fn: () => unknown) => ({
      get value() {
        return fn();
      },
    }),
    ReduceMotion: { Never: "never" },
    cancelAnimation: () => {
      for (const p of pending) p.cancelled = true;
    },
    withTiming(
      target: cameraLogic.CameraPose,
      _config: unknown,
      complete: (success: boolean) => void,
    ) {
      pending.push({ target, complete, cancelled: false });
      return { ...camera.HOME_CAMERA };
    },
  };
  let cameraModule: Record<string, unknown>;
  const modules: Record<string, unknown> = {
    react: hooks,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-native": {
      View: "View",
      StyleSheet: { create: (x: unknown) => x },
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove: () => {} }),
      },
    },
    "react-native-reanimated": reanimated,
    "@react-navigation/native": {
      useIsFocused: () => true,
      useNavigation: () => navigation,
      useFocusEffect: (fn: () => () => void) => hooks.useEffect(fn, [fn]),
    },
    "@shopify/react-native-skia": { useFonts: () => null },
  };
  const load = (path: string) => {
    const exports = {};
    runInNewContext(
      babel.transformFileSync(path, { envName: "production" }).code,
      {
        exports,
        require: (id: string) => {
          if (modules[id]) return modules[id];
          if (id.startsWith("@babel/runtime/")) return require(id);
          if (id.includes("use-orrery-camera")) return cameraModule;
          if (id.includes("orrery-camera-logic")) return camera;
          if (id.includes("orrery-focus-card-logic")) return focusCardLogic;
          if (id.includes("orrery-focus-logic")) return focusLogic;
          if (id.includes("orrery-frame")) return frameLogic;
          if (id.includes("orrery-satellite-logic")) return satelliteLogic;
          if (id.includes("orrery-gesture-logic")) return gestureLogic;
          if (id.includes("orrery-recovery-logic")) return recoveryLogic;
          if (id.includes("orrery-system-logic")) return systemLogic;
          if (id.includes("orrery-session-logic")) return sessionLogic;
          if (id.includes("orrery-switch-animation")) return switchLogic;
          if (id.includes("use-orrery-switch-runtime"))
            return {
              useOrrerySwitchRuntime: () =>
                (
                  hooks.useRef({
                    publish: () => {},
                    pause: () => {},
                    resume: () => {},
                    resources: [],
                    progress: switchProgress,
                    transition: { value: { generation: 7 } },
                  }) as { current: unknown }
                ).current,
            };
          if (id.includes("orrery-overlay-logic")) return overlayLogic;
          if (id.includes("occlusion-sources")) return occlusionSources;
          if (id.includes("orrery-obstacle-logic")) return { canvasViewport };
          if (id.includes("orrery-system-store"))
            return { createOrrerySystemStore: () => store };
          if (id.includes("orrery-preferences-store"))
            return { useOrreryPreferencesStore: prefStore };
          if (id.includes("orrery-session-store"))
            return { useOrrerySessionStore: sessionStore };
          if (id.includes("shell-obstacle-store"))
            return {
              sameWindowRect,
              useShellObstacleStore: (selector: (s: unknown) => unknown) =>
                selector(obstacles.getState()),
            };
          if (id.includes("shell-transient-store"))
            return {
              shellTransientStore: Object.assign(() => false, {
                getState: () => ({
                  openTransient: () => {},
                  closeTransient: () => {},
                }),
              }),
            };
          if (id.includes("use-window-measurement"))
            return {
              useWindowMeasurement: (publish: (r: unknown) => void) => {
                hooks.useEffect(() => {
                  publish({ x: 0, y: 0, ...canvas });
                  return undefined;
                }, []);
                return {};
              },
            };
          if (id.includes("orrery-scene"))
            return {
              createOrrerySatelliteController: () => ({ reload: () => {} }),
            };
          // 38.7-10 (C-M3): the satellite publisher (no satellites here).
          if (id.includes("orrery-satellite-publisher"))
            return {
              createOrrerySatellitePublisher: () => ({
                source: { current: () => satelliteSpec },
                noteScene: () => {},
                publish: () => {},
                switchStarted: () => {},
                switchSettled: () => {},
              }),
            };
          if (id.includes("orrery-action-read"))
            return {
              readOrreryContactTargetValidation: async (
                _: unknown,
                __: unknown,
                target: unknown,
              ) => ({ status: "ready", identity: target, isMember: true }),
            };
          if (id.includes("systems-catalog-read"))
            return {
              countBuiltinAndCategorySystemMembers: async () => new Map(),
              countSystemMembers: async () => ({ count: 0, brokenRules: [] }),
              readSystemsCatalog: async () => [],
            };
          if (id.includes("/db/database")) return { getExecutor: () => ({}) };
          if (id.includes("use-reduced-motion"))
            return {
              useReducedMotionShared: () => reanimated.useSharedValue(false),
            };
          if (id.includes("OrreryClusterPanel"))
            return {
              OrreryClusterPanel: "Panel",
              CLUSTER_OBSTACLE: "orrery-cluster-panel",
            };
          if (id.includes("OrreryWorld")) return { OrreryWorld: "World" };
          if (id.includes("OrreryFocusContext"))
            return { OrreryFocusContext: "FocusCard" };
          if (id.includes("OrreryImmersiveHeader"))
            return {
              OrreryImmersiveHeader: "Header",
              ORRERY_HEADER_OBSTACLE: "orrery-immersive-header",
            };
          if (id.includes("ShellAppBar")) return { ShellAppBar: "ShellAppBar" };
          if (id.includes("OrreryFeedback"))
            return { OrreryFeedback: "Feedback", OrreryNotice: "Notice" };
          if (id.includes("OrrerySystemSelector"))
            return { OrrerySystemSelector: "Selector" };
          if (id.includes("OrreryViewOptions"))
            return { OrreryViewOptions: "ViewOptions" };
          if (id.includes("OrreryControls"))
            return {
              OrreryControls: "Controls",
              ORRERY_CONTROLS_OBSTACLE: "orrery-camera-controls",
            };
          if (id.includes("/theme"))
            return { useTheme: () => ({ colors: {} }), SPACING: {} };
          return new Proxy(
            {},
            {
              get: (_target, key) => (key === "__esModule" ? true : () => null),
            },
          );
        },
      },
    );
    return exports;
  };
  cameraModule = load("src/components/orrery/use-orrery-camera.ts");
  const screen = load("src/screens/OrreryScreen.tsx") as {
    OrreryScreen: () => Element;
    systemAttentionFeedback: (
      validity: "valid" | "needs-attention" | undefined,
      brokenCount: number,
    ) => { heading: string; detail: string | null } | null;
  };
  let tree: Element;
  function render() {
    let turns = 0;
    do {
      dirty = false;
      cursor = 0;
      effects = [];
      tree = screen.OrreryScreen();
      for (const effect of effects) effect();
      if (++turns > 20) throw new Error("Unsettled React effects");
    } while (dirty);
  }
  function find(type: string, element = tree): Element | undefined {
    return findAll(type, element).at(0);
  }
  function findAll(type: string, element = tree): Element[] {
    if (!element || typeof element !== "object") return [];
    return [
      ...(element.type === type ? [element] : []),
      ...[element.props?.children ?? []]
        .flat()
        .flatMap((child) => findAll(type, child)),
    ];
  }
  const measurement = createWindowMeasurement((rect) =>
    obstacles.getState().publish("orrery-cluster-panel", rect),
  );
  return {
    scene,
    camera,
    attention: screen.systemAttentionFeedback,
    pending,
    render,
    find,
    findAll,
    tree: () => tree,
    measurement,
    async ready() {
      render();
      await Promise.resolve();
      await Promise.resolve();
      render();
    },
    async group() {
      const world = find("World")!;
      await (world.props.onIntent as (i: unknown) => Promise<void>)({
        kind: "group",
        generation: 7,
        ids: [1, 2],
        targets: members.map((m) => ({ ...m, kind: "member" })),
      });
      render();
    },
    settle() {
      const p = pending.findLast((p) => !p.cancelled);
      expect(p).toBeDefined();
      p?.complete(true);
    },
    frame() {
      const world = find("World")!;
      return cameraLogic.projectFrame(
        scene.world,
        (world.props.pose as { value: cameraLogic.CameraPose }).value,
        world.props.viewport as cameraLogic.CameraViewport,
        7,
      );
    },
    state,
    session,
    switchProgress,
    world: () => find("World")!,
    /** A real System switch (in-session, retained focus) reaching listeners. */
    emitSwitch() {
      const before = { ...state, status: "loading", snapshot: null };
      const ready = { ...state, generation: 7 };
      for (const listener of [...listeners])
        listener(ready, before as unknown as StoreState);
      const loading = {
        ...state,
        status: "loading",
        generation: 8,
        requested: { id: "builtin:favorites" },
      };
      for (const listener of [...listeners]) listener(loading, ready);
      const landed = {
        ...loading,
        status: "ready",
        snapshot: { ...scene, generation: 8 },
      };
      for (const listener of [...listeners])
        listener(landed as StoreState, loading);
      render();
    },
    async focus(id = 1) {
      await (find("World")!.props.onIntent as (i: unknown) => Promise<void>)({
        kind: "focus",
        generation: 7,
        ids: [id],
        targets: [{ kind: "member", id, uid: `u${id}` }],
      });
      render();
    },
    /** The focus card reports a measured height (its onLayout). */
    height(value: number) {
      const card = find("FocusCard");
      expect(card).toBeDefined();
      (card!.props.onHeight as (h: number) => void)(value);
      render();
    },
    pose: () =>
      (find("World")!.props.pose as { value: cameraLogic.CameraPose }).value,
    /** The focused body, its moons (full split) and the docked card. */
    layout(cardHeight: number) {
      const world = find("World")!;
      const pose = (world.props.pose as { value: cameraLogic.CameraPose })
        .value;
      const viewport = world.props.viewport as cameraLogic.CameraViewport;
      const moons = satelliteLogic.deriveSatelliteBodies(
        scene.world.map((b) => ({ ...b, opacity: 1, interactive: true })),
        satelliteSpec.index,
        true,
        1,
      ).moons;
      const frame = cameraLogic.projectFrame(
        [...scene.world, ...moons],
        pose,
        viewport,
        7,
      );
      const body = frame.bodies.find(
        (b) => b.id === 1 && b.kind === "contact",
      )!;
      return {
        frame,
        body,
        moons: frame.bodies.filter((b) => b.kind === "satellite"),
        card: focusCardLogic.focusCardPlacement(viewport, body, cardHeight),
      };
    },
  };
}

it.each(["tilted", "flat"] as const)(
  "lands on the %s Home profile: every Home axis, including tilt and lens shift",
  async (profile) => {
    const h = harness(profile);
    await h.ready();
    const frame = h.frame();
    const chosen = cameraLogic.HOME_PROFILES[profile];
    expect(frame.pose.tilt).toBeCloseTo(chosen.tilt, 12);
    expect(frame.pose.lensShift).toBe(chosen.lensShift);
    expect(frame.pose.yaw).toBe(0);
    expect(frame.pose).toEqual(
      h.camera.deriveHomePose(h.scene.world, frame.viewport),
    );
    expect(frame.bodies.every((body) => !body.culled)).toBe(true);
  },
);

it.each([
  ["tilted", 180],
  ["tilted", 200],
  ["flat", 180],
  ["flat", 200],
] as const)(
  "frames a group from the %s Home after delayed measurement and font reflow to y=%s; close rejects late measurement",
  async (profile, top) => {
    const h = harness(profile);
    await h.ready();
    await h.group();
    expect(h.find("Panel")).toBeDefined();
    expect(h.pending).toHaveLength(0); // No recovery against the pre-panel viewport.
    const measured = h.measurement.begin();
    measured(0, 200, 400, 200);
    h.render();
    expect(h.pending).toHaveLength(1);
    const old = h.pending[0];
    // A larger-font layout invalidates the first native measurement and recovery.
    h.measurement.clear();
    h.render();
    h.measurement.begin()(0, top, 400, 400 - top);
    h.render();
    expect(old.cancelled).toBe(true);
    old.complete(true); // generation check rejects the stale animation completion.
    h.settle();
    const frame = h.frame(),
      rect = cameraLogic.usableCameraRect(frame.viewport)!;
    for (const body of frame.bodies) {
      expect(body.y - body.hitRadius).toBeGreaterThanOrEqual(rect.y - 1e-6);
      expect(body.y + body.hitRadius).toBeLessThanOrEqual(
        rect.y + rect.height + 1e-6,
      );
    }
    const late = h.measurement.begin();
    (h.find("Panel")!.props.onClose as () => void)();
    h.measurement.clear();
    h.render();
    late(0, 180, 400, 220);
    h.render();
    expect(h.find("Panel")).toBeUndefined();
    expect(h.frame().viewport.obstacles).toHaveLength(1);
    expect(h.find("World")!.props.focusedIds).toEqual([]);
  },
);

it("shows canonical Needs Attention feedback without inventing malformed-rule detail", () => {
  const h = harness();
  expect(h.attention("needs-attention", 0)).toEqual({
    heading: "This System needs attention",
    detail: null,
  });
  expect(h.attention("needs-attention", 2)).toEqual({
    heading: "This System needs attention",
    detail: "2 membership rules could not be applied.",
  });
  expect(h.attention("valid", 0)).toBeNull();
});

// ── 38.7-11 (D-19/D-47/C-M2/C3-M1/C4-M3): single focus above the docked card ──

/** A tall canvas whose controls column sits on the right, as on the phone. */
const PHONE = {
  canvas: { width: 400, height: 800 },
  controls: { x: 340, y: 520, width: 55, height: 200 },
  moons: true,
} as const;

function expectAboveCard(
  layout: ReturnType<ReturnType<typeof harness>["layout"]>,
) {
  const { body, moons, card } = layout;
  expect(card.visible).toBe(true);
  expect(body.y + body.radius).toBeLessThan(card.y);
  expect(moons.length).toBeGreaterThan(0);
  for (const moon of moons) expect(moon.y + moon.radius).toBeLessThan(card.y);
}

it.each(["tilted", "flat"] as const)(
  "focuses one person beyond the old IDENTITY_ZOOM cap with the card docked below (%s)",
  async (profile) => {
    const h = harness(profile, PHONE);
    await h.ready();
    await h.focus(1);
    expect(h.pending).toHaveLength(1);
    h.settle();
    const layout = h.layout(focusCardLogic.FOCUS_CARD_ESTIMATED_HEIGHT);
    expect(layout.frame.pose.zoom).toBeGreaterThan(cameraLogic.IDENTITY_ZOOM);
    expect(layout.body.magnification).toBeGreaterThan(
      cameraLogic.IDENTITY_ZOOM,
    );
    expectAboveCard(layout);
    // The card is positioned from the shared UI-thread rect, not the frame.
    const card = h.find("FocusCard")!;
    expect(card.props.placement).toBeDefined();
    expect(card.props.cardHeight).toBeDefined();
  },
);

it("refits once when the real card is taller, once more on growth, never within the threshold or on repeats (C3-M1)", async () => {
  const h = harness("tilted", PHONE);
  await h.ready();
  await h.focus(1);
  h.settle();
  const live = () => h.pending.filter((p) => !p.cancelled).length;
  const started = h.pending.length;
  h.height(
    focusCardLogic.FOCUS_CARD_ESTIMATED_HEIGHT +
      focusCardLogic.FOCUS_CARD_REFIT_PX,
  );
  expect(h.pending).toHaveLength(started);
  h.height(260);
  expect(h.pending).toHaveLength(started + 1);
  expect(live()).toBe(1);
  h.settle();
  expectAboveCard(h.layout(260));
  h.height(260);
  expect(h.pending).toHaveLength(started + 1);
  // Context and moons loaded: the card grows again.
  h.height(330);
  expect(h.pending).toHaveLength(started + 2);
  h.settle();
  expectAboveCard(h.layout(330));
  h.height(330);
  h.height(334);
  expect(h.pending).toHaveLength(started + 2);
});

it("never refits after a manual camera gesture", async () => {
  const gesture = harness("tilted", PHONE);
  await gesture.ready();
  await gesture.focus(1);
  gesture.settle();
  const camera = gesture.world().props.camera as { stop: () => void };
  camera.stop(); // a pan or pinch begins (every touch stops the camera)
  const pose = { ...gesture.pose() };
  const count = gesture.pending.length;
  gesture.height(300);
  expect(gesture.pending).toHaveLength(count);
  expect(gesture.pose()).toEqual(pose);
});

it("never writes a pose from the refit while a switch is running", async () => {
  const switching = harness("tilted", PHONE);
  await switching.ready();
  await switching.focus(1);
  switching.settle();
  switching.switchProgress.value = 0.5;
  const before = switching.pending.length;
  switching.height(300);
  expect(switching.pending).toHaveLength(before);
});

it("a retained focus stays at destination Home after a System switch, even when the card then grows (C4-M3)", async () => {
  const h = harness("tilted", PHONE);
  await h.ready();
  await h.focus(1);
  h.settle();
  h.emitSwitch();
  // Shared focus is retained through the switch (dossier §V) …
  expect(h.world().props.focusedIds).toEqual([1]);
  const pose = { ...h.pose() };
  const count = h.pending.length;
  // … and the held satellite content flushing at settle grows the card.
  h.height(320);
  expect(h.pending).toHaveLength(count);
  expect(h.pose()).toEqual(pose);
});

it("a restored session (Profile Back) ends the framing's authority (C4-M3)", async () => {
  const restored = harness("tilted", PHONE);
  await restored.ready();
  await restored.focus(1);
  restored.settle();
  const saved = cameraLogic.clampCameraPose(
    { ...cameraLogic.HOME_CAMERA, x: 5, y: -40, zoom: 1.4 },
    400,
  );
  restored.session.saved = {
    pose: saved,
    focus: { kind: "member", id: 1, uid: "u1" },
    systemId: "builtin:all-contacts",
  };
  restored.session.resume = "restore";
  restored.render();
  expect(restored.session.resume).toBe("active");
  const count = restored.pending.length;
  restored.height(300);
  expect(restored.pending).toHaveLength(count);
  expect(restored.pose()).toEqual(saved);
});

it("Recenter ends the framing's authority (C4-M3)", async () => {
  const recentered = harness("tilted", PHONE);
  await recentered.ready();
  await recentered.focus(1);
  recentered.settle();
  // A layout callback from the card that is still in flight at Recenter.
  const lateHeight = recentered.find("FocusCard")!.props.onHeight as (
    h: number,
  ) => void;
  (recentered.find("Controls")!.props.onRecenter as () => void)();
  recentered.render();
  recentered.settle();
  // Recenter clears focus and goes Home; the late re-measure moves nothing.
  expect(recentered.find("FocusCard")).toBeUndefined();
  const home = { ...recentered.pose() };
  const count = recentered.pending.length;
  lateHeight(300);
  recentered.render();
  expect(recentered.pending).toHaveLength(count);
  expect(recentered.pose()).toEqual(home);
});

it("a density change ends the framing's authority (C4-M3)", async () => {
  const density = harness("tilted", PHONE);
  await density.ready();
  await density.focus(1);
  density.settle();
  density.state.snapshot = {
    ...density.scene,
    preferences: { density: "dense" },
  };
  density.render();
  const reframed = { ...density.pose() };
  const before = density.pending.length;
  density.height(300);
  expect(density.pending).toHaveLength(before);
  expect(density.pose()).toEqual(reframed);
});

it.each([
  ["tilted", PHONE],
  ["flat", PHONE],
  [
    "tilted",
    {
      canvas: { width: 320, height: 480 },
      controls: { x: 262, y: 300, width: 55, height: 170 },
      moons: true,
    },
  ],
] as const)(
  "measure → place → project cycles are stable with an unchanged camera (C-M2, %s)",
  async (profile, options) => {
    const h = harness(profile, options);
    await h.ready();
    await h.focus(1);
    h.settle();
    const pending = h.pending.length;
    let height = focusCardLogic.FOCUS_CARD_ESTIMATED_HEIGHT;
    let previous: unknown = null;
    for (let cycle = 0; cycle < 6; cycle++) {
      const { frame, body, card } = h.layout(height);
      // The card measures its laid-out rect and reports it; the screen
      // republishes and rebuilds its viewport.
      height = card.height;
      h.height(height);
      const viewport = h.world().props.viewport as cameraLogic.CameraViewport;
      const now = {
        card,
        body: { x: body.x, y: body.y },
        usable: cameraLogic.usableCameraRect(frame.viewport),
        obstacles: viewport.obstacles,
      };
      if (cycle >= 1) expect(now).toEqual(previous);
      previous = now;
    }
    expect(h.pending).toHaveLength(pending);
    // The card never reaches a camera viewport (no self-feedback).
    const viewport = h.world().props.viewport as cameraLogic.CameraViewport;
    expect(viewport.obstacles).toHaveLength(1);
  },
);

// ── 38.7-12 (D-39): the map runs up under the Orrery title ──────────────────

it("the canvas fills the root under the title; the title's rect is a camera obstacle kept out of the usable rect", async () => {
  const BAR = 52;
  // The Orrery root (below the status bar) is 400 × 800. Before D-39 the bar
  // sat in flow and the canvas was 800 − BAR tall, starting below it.
  const h = harness("tilted", {
    canvas: { width: 400, height: 800 },
    controls: { x: 340, y: 560, width: 55, height: 200 },
    header: { x: 0, y: 0, width: 400, height: BAR },
  });
  await h.ready();
  const viewport = h.world().props.viewport as cameraLogic.CameraViewport;
  // The canvas viewport grew by the header height: it is the whole root.
  expect(viewport.height).toBe(800);
  expect(viewport.height - BAR).toBe(800 - BAR);
  expect(viewport.obstacles).toContainEqual({
    x: 0,
    y: 0,
    width: 400,
    height: BAR,
  });
  const usable = cameraLogic.usableCameraRect(viewport)!;
  expect(usable.y).toBeGreaterThanOrEqual(BAR);
  // Home framing keeps every body clear of the title.
  for (const body of h.frame().bodies)
    expect(body.y - body.hitRadius).toBeGreaterThanOrEqual(BAR - 1e-6);
  // Layout: the canvas container is an absolute fill of the root, and the
  // unchanged root ShellAppBar renders exactly once, inside the Orrery-local
  // header overlay that follows (draws above) the canvas.
  const root = h.tree();
  const children = [root.props.children].flat() as Element[];
  const canvasIndex = children.findIndex(
    (child) => child?.props?.testID === "orrery-canvas-container",
  );
  const headerIndex = children.findIndex((child) => child?.type === "Header");
  expect(canvasIndex).toBeGreaterThanOrEqual(0);
  expect(headerIndex).toBeGreaterThan(canvasIndex);
  expect(children[canvasIndex].props.style).toMatchObject({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
  const bars = h.findAll("ShellAppBar");
  expect(bars).toHaveLength(1);
  expect(bars[0].props).toEqual({ variant: "root", title: "Orrery" });
  expect(h.find("ShellAppBar", children[headerIndex])).toBe(bars[0]);
  expect(h.find("ShellAppBar", children[canvasIndex])).toBeUndefined();
  // The HUD triggers are told the bar's height so they sit below it.
  expect(h.find("Header")!.props.barHeight).toBe(0);
  (h.find("Header")!.props.onBarHeight as (height: number) => void)(BAR);
  h.render();
  expect(h.find("Header")!.props.barHeight).toBe(BAR);
  expect(h.find("Selector")!.props.topInset).toBe(BAR);
  expect(h.find("ViewOptions")!.props.topInset).toBe(BAR);
});

it("38.7-12 (D-30): opening the Orrery shows no loading box while the System loads; the other notices stay", async () => {
  const h = harness();
  const state = h.state as unknown as Record<string, unknown>;
  for (const status of ["initial", "loading"]) {
    state.status = status;
    state.snapshot = null;
    state.current = () => null;
    h.render();
    expect(h.findAll("Feedback")).toEqual([]);
    expect(h.findAll("Notice")).toEqual([]);
  }
  // A read failure still shows its notice.
  state.status = "error";
  h.render();
  expect(h.findAll("Notice").map((n) => n.props.kind)).toEqual(["read"]);
});
