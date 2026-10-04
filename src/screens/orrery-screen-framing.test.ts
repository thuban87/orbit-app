import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { beforeAll, expect, it, vi } from "vitest";
import { canvasViewport } from "@/components/orrery/orrery-obstacle-logic";
import * as overlayLogic from "@/components/orrery/orrery-overlay-logic";
import { createOrrerySatellitePublisher } from "@/components/orrery/orrery-satellite-publisher";
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
import { createOrrerySatelliteController } from "@/services/orrery-scene";
import { createOrrerySystemStore } from "@/stores/orrery-system-store";
import {
  createShellObstacleStore,
  createWindowMeasurement,
  sameWindowRect,
} from "@/stores/shell-obstacle-store";

// 38.7-13: the real store / satellite modules imported below reach these.
vi.mock("expo-sqlite", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

const require = createRequire(import.meta.url);
const babel = require("@babel/core");
/** Each source is transformed once per file run (every harness re-evaluates it). */
const compiled = new Map<string, string>();
function compile(path: string): string {
  let code = compiled.get(path);
  if (code === undefined) {
    code = babel.transformFileSync(path, { envName: "production" }).code;
    compiled.set(path, code as string);
  }
  return code as string;
}
// The one-time Babel transform of the screen (seconds under a loaded full
// run) is paid here, outside any single test's timeout.
beforeAll(() => {
  compile("src/components/orrery/use-orrery-camera.ts");
  compile("src/screens/OrreryScreen.tsx");
}, 60_000);
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
    /**
     * 38.7-13 (C3-M2): the REAL System store, its scene load and preference
     * write replaced by the test's (controlled) functions.
     */
    realStore?: {
      load: (system: unknown, generation: number) => Promise<unknown>;
      persist: () => Promise<boolean>;
    };
    /**
     * 38.7-13 (C-M3): the REAL satellite publisher and controller, satellites
     * enabled, the row read controlled by the test.
     */
    realSatellites?: { read: () => Promise<unknown[]> };
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
    current: () => scene as unknown,
    select: vi.fn(),
    reload: vi.fn(),
    cancel: vi.fn(),
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
  const switchTransition = { value: { generation: 7 } };
  /** 38.7-15: the route's focus (blur / return) and the runtime's pose. */
  let focused = true;
  let runtimePose: { value: unknown } | null = null;
  /** 38.7-15: the store state a `tapSystem()` left (loading). */
  let tapped: Record<string, unknown> = {};
  /** 38.7-15 (D-76): the lead-in calls the screen made. */
  const leadCalls: string[] = [];
  /** 38.7-15: per render turn, whether the canvas was mounted and its pose. */
  const renderLog: { world: boolean; pose: unknown }[] = [];
  /** 38.7-13: the screen's settle listener, as the runtime received it. */
  let onSettled: ((generation: number) => void) | undefined;
  /** 38.7-13: the real store / satellite publisher, when asked for. */
  let realStore: ReturnType<typeof createOrrerySystemStore> | null = null;
  let realPublisher: ReturnType<typeof createOrrerySatellitePublisher> | null =
    null;
  const theme = { colors: {} };
  /** 38.7-15 (D-58): the warm cache the screen attaches and releases. */
  const warmCache = {
    releases: [] as string[],
    attach: () => () => {},
    release: (reason: string) => {
      warmCache.releases.push(reason);
    },
  };
  /** 38.7-13: every runtime publication (scene, isSwitch, intensity, Home). */
  const publishes: unknown[][] = [];
  // The screen's useAnimatedReaction callbacks of the latest render.
  const reactions: {
    prepare: () => unknown;
    react: (value: unknown, previous: unknown) => void;
  }[] = [];
  const prefs = {
    committed: {
      density: "balanced",
      satellitesEnabled: options.realSatellites ? 1 : 0,
    },
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
    useAnimatedReaction(
      prepare: () => unknown,
      react: (value: unknown, previous: unknown) => void,
    ) {
      reactions.push({ prepare, react });
    },
    // A stable SharedValue across renders (as Reanimated's), recomputed on read.
    useDerivedValue(fn: () => unknown) {
      const ref = hooks.useRef(null) as {
        current: { fn: () => unknown; readonly value: unknown } | null;
      };
      if (!ref.current) {
        const box = {
          fn,
          get value() {
            return box.fn();
          },
        };
        ref.current = box;
      } else ref.current.fn = fn;
      return ref.current;
    },
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
      useIsFocused: () => focused,
      useNavigation: () => navigation,
      // Runs while focused; the cleanup runs on blur (38.7-15 warm returns).
      useFocusEffect: (fn: () => () => void) =>
        hooks.useEffect(() => (focused ? fn() : undefined), [fn, focused]),
    },
    "@shopify/react-native-skia": { useFonts: () => null },
  };
  const load = (path: string) => {
    const exports = {};
    runInNewContext(compile(path), {
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
            useOrrerySwitchRuntime: (
              pose: { value: unknown },
              _reduced: unknown,
              settled?: (generation: number) => void,
            ) => {
              onSettled = settled;
              runtimePose = pose;
              return (
                hooks.useRef({
                  publish: (...args: unknown[]) => {
                    publishes.push(args);
                  },
                  pause: () => {},
                  resume: () => {},
                  // 38.7-15 (D-76): the switch lead-in starts on the tap.
                  beginLead: () => {
                    leadCalls.push("begin");
                  },
                  endLead: () => {
                    leadCalls.push("end");
                  },
                  // 38.7-15 (C5-M2): `finish` for a paused switch (progress
                  // 1, the pose at its destination Home, the prune's settle
                  // notification), then `done`; a no-op otherwise.
                  settle: (done?: () => void) => {
                    if (switchProgress.value < 1) {
                      switchProgress.value = 1;
                      const destination = publishes.at(-1)?.[3];
                      if (runtimePose && destination)
                        runtimePose.value = { ...(destination as object) };
                      onSettled?.(switchTransition.value.generation);
                    }
                    done?.();
                  },
                  resources: [],
                  progress: switchProgress,
                  transition: switchTransition,
                }) as { current: unknown }
              ).current;
            },
          };
        if (id.includes("orrery-overlay-logic")) return overlayLogic;
        if (id.includes("occlusion-sources")) return occlusionSources;
        if (id.includes("orrery-obstacle-logic")) return { canvasViewport };
        if (id.includes("orrery-system-store"))
          return {
            createOrrerySystemStore: options.realStore
              ? (io: Parameters<typeof createOrrerySystemStore>[0]) => {
                  const real = createOrrerySystemStore({
                    ...io,
                    load: options.realStore?.load as never,
                    persist: options.realStore?.persist as never,
                  });
                  realStore = real;
                  return Object.assign(() => real.getState(), {
                    getState: real.getState,
                    subscribe: real.subscribe,
                  });
                }
              : () => store,
          };
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
            createOrrerySatelliteController: options.realSatellites
              ? createOrrerySatelliteController
              : () => ({ reload: () => {} }),
          };
        if (id.includes("orrery-satellites-read") && options.realSatellites)
          return { readOrrerySatellites: options.realSatellites.read };
        // 38.7-10 (C-M3): the satellite publisher (no satellites here).
        if (id.includes("orrery-satellite-publisher") && options.realSatellites)
          return {
            createOrrerySatellitePublisher: (
              publisherOptions: Parameters<
                typeof createOrrerySatellitePublisher
              >[0],
            ) => {
              realPublisher = createOrrerySatellitePublisher(publisherOptions);
              return realPublisher;
            },
          };
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
        // 38.7-15 (D-58): the warm cache (its own suite proves it).
        if (id.includes("orrery-warm-cache"))
          return { orreryWarmCache: warmCache };
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
        // A stable theme context value (as the provider's).
        if (id.includes("/theme"))
          return { useTheme: () => theme, SPACING: {} };
        return new Proxy(
          {},
          {
            get: (_target, key) => (key === "__esModule" ? true : () => null),
          },
        );
      },
    });
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
      reactions.length = 0;
      tree = screen.OrreryScreen();
      const world = find("World", tree);
      renderLog.push({
        world: !!world,
        pose: world
          ? { ...(world.props.pose as { value: object }).value }
          : null,
      });
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
    async group(generation = 7) {
      const world = find("World")!;
      await (world.props.onIntent as (i: unknown) => Promise<void>)({
        kind: "group",
        generation,
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
    obstacles,
    switchProgress,
    publishes,
    renderLog,
    leadCalls,
    /** 38.7-15: the route blurs (false) or is focused again (true). */
    setFocused(value: boolean) {
      focused = value;
      render();
    },
    /** 38.7-13: the real System store (options.realStore). */
    store: () => realStore,
    /** 38.7-13: the real satellite publisher (options.realSatellites). */
    publisher: () => realPublisher,
    /**
     * The switch for `generation` settles: the runtime's settle callback
     * (38.7-13: the screen's settle listener) runs once, then React renders.
     */
    settleSwitch(generation: number) {
      switchTransition.value = { generation };
      switchProgress.value = 1;
      onSettled?.(generation);
      render();
    },
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
    /** 38.7-15: a System tap — the store starts loading another System. */
    tapSystem() {
      const ready = { ...state };
      // The current System's ready publication (as on device) first.
      for (const listener of [...listeners])
        listener(ready, {
          ...state,
          status: "loading",
          snapshot: null,
        } as unknown as StoreState);
      const loading = {
        ...state,
        status: "loading",
        generation: 8,
        requested: { id: "builtin:favorites" },
      };
      for (const listener of [...listeners])
        listener(loading as unknown as StoreState, ready);
      tapped = loading;
      render();
    },
    /** 38.7-15: the tapped System's load fails (the store goes to error). */
    failLoad() {
      const failed = { ...tapped, status: "error", snapshot: null };
      for (const listener of [...listeners])
        listener(
          failed as unknown as StoreState,
          tapped as unknown as StoreState,
        );
      render();
    },
    /**
     * A real System switch that lands: the store moves to generation 8 of
     * another System (All Contacts → Favorites) and its listeners see the
     * loading → ready transition, as on device.
     */
    landSwitch() {
      const ready = { ...state };
      for (const listener of [...listeners])
        listener(ready, {
          ...state,
          status: "loading",
          snapshot: null,
        } as unknown as StoreState);
      const loading = {
        ...state,
        status: "loading",
        generation: 8,
        requested: { id: "builtin:favorites" },
      };
      for (const listener of [...listeners]) listener(loading, ready);
      const landedScene = {
        ...scene,
        generation: 8,
        system: { kind: "builtin" as const, id: "favorites" as const },
      };
      Object.assign(state, {
        status: "ready",
        generation: 8,
        requested: { id: "builtin:favorites" },
        snapshot: landedScene,
        current: () => landedScene,
      });
      for (const listener of [...listeners])
        listener(state, loading as unknown as StoreState);
      render();
      return landedScene;
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
  const canvasStyle = Object.assign(
    {},
    ...[children[canvasIndex].props.style].flat(),
  );
  expect(canvasStyle).toMatchObject({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
  // 38.7-15: the sky's base token paints the area before the canvas mounts.
  expect(canvasStyle).toHaveProperty("backgroundColor");
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

// ── 38.7-12 (carried from 38.7-11, enforces D-19): cluster zoom after a switch ──

it("a cluster tap zooms into the cluster after a System switch in the same session (switch → cluster tap → zoom)", async () => {
  const h = harness("tilted");
  await h.ready();
  h.landSwitch();
  // C4-M3: the switch itself lands at destination Home (the switch runtime
  // animates there); the screen writes no framing of its own at landing.
  expect(h.pending).toHaveLength(0);
  const landed = { ...h.pose() };
  h.switchProgress.value = 1; // the switch has settled
  await h.group(8);
  expect(h.find("Panel")).toBeDefined();
  expect(h.pending).toHaveLength(0); // waits for the panel's measurement
  h.measurement.begin()(0, 400, 400, 200);
  h.render();
  // The cluster zoom fires: one recovery toward a closer pose.
  expect(h.pending).toHaveLength(1);
  expect(h.pending[0].target.zoom).toBeGreaterThan(landed.zoom);
  h.settle();
  const frame = h.frame(),
    rect = cameraLogic.usableCameraRect(frame.viewport)!;
  for (const body of frame.bodies.filter((b) => b.kind === "contact")) {
    expect(body.y - body.hitRadius).toBeGreaterThanOrEqual(rect.y - 1e-6);
    expect(body.y + body.hitRadius).toBeLessThanOrEqual(
      rect.y + rect.height + 1e-6,
    );
  }
});

it("a cluster tapped while the switch is still running waits for it to settle (no pose fights the switch)", async () => {
  const h = harness("tilted");
  await h.ready();
  h.landSwitch();
  h.switchProgress.value = 0.4;
  await h.group(8);
  h.measurement.begin()(0, 400, 400, 200);
  h.render();
  expect(h.pending).toHaveLength(0);
  // The switch settles (the settle reaction re-runs the Home effect).
  h.switchProgress.value = 1;
  h.settleSwitch(8);
  expect(h.pending).toHaveLength(1);
});

it("after the switch landing is consumed, a later reflow in that generation never frames the retained focus (C4-M3)", async () => {
  const h = harness("tilted", PHONE);
  await h.ready();
  await h.focus(1);
  h.settle();
  h.landSwitch();
  // Shared focus is retained through the switch (dossier §V).
  expect(h.world().props.focusedIds).toEqual([1]);
  const count = h.pending.length;
  // The switch runtime's settle writes destination Home (its own pose write).
  const viewport = h.world().props.viewport as cameraLogic.CameraViewport;
  const home = h.camera.deriveHomePose(h.scene.world, viewport)!;
  (h.world().props.pose as { value: cameraLogic.CameraPose }).value = home;
  expect(home.zoom).not.toBeCloseTo(h.pending[0].target.zoom, 3);
  const landed = { ...h.pose() };
  h.settleSwitch(8);
  // A notice appears (a new obstacle), changing the viewport: the Home effect
  // re-runs in generation 8 with the flag consumed.
  h.obstacles
    .getState()
    .publish("orrery-save-feedback", { x: 16, y: 700, width: 300, height: 60 });
  h.render();
  h.height(320);
  expect(h.pending).toHaveLength(count);
  expect(h.pose().zoom).toBeCloseTo(landed.zoom, 12);
  expect(h.pose().x).toBeCloseTo(landed.x, 12);
  expect(h.pose().y).toBeCloseTo(landed.y, 12);
});

// ── 38.7-13 (D-53): the renderer never re-renders mid-switch ───────────────

/** The props that changed between two OrreryWorld renders (a memo commit). */
function changedProps(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): string[] {
  return Object.keys({ ...a, ...b }).filter(
    (key) => !Object.is(a[key], b[key]),
  );
}
async function microtasks(rounds = 12) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}
/** A controlled promise queue. */
function controlled<T>() {
  const queue: { resolve(value: T): void; reject(error: Error): void }[] = [];
  return {
    queue,
    next: () =>
      new Promise<T>((resolve, reject) => queue.push({ resolve, reject })),
  };
}
/** A harness on the REAL System store; `extra` adds options. */
function storeHarness(
  saves: ReturnType<typeof controlled<boolean>>,
  extra: Parameters<typeof harness>[1] = {},
) {
  let base: ReturnType<typeof harness>["scene"] | null = null;
  const h = harness(undefined, {
    ...extra,
    realStore: {
      load: async (system, generation) => ({
        ...(base as NonNullable<typeof base>),
        generation,
        system,
        systemSnapshot: {
          ...(base as NonNullable<typeof base>).systemSnapshot,
          categories: [],
        },
      }),
      persist: saves.next,
    },
  });
  base = h.scene;
  return h;
}
const FAVORITES = { kind: "builtin", id: "favorites" } as const;
const ALL = systemLogic.ALL_CONTACTS_SYSTEM;

it("C3-M2 / C4-M1: a save landing mid-switch (saved, then error) and the save notice's measurement commit nothing to OrreryWorld; the renderer adopts the new viewport only in the settle commit, with no reframe", async () => {
  const saves = controlled<boolean>();
  const h = storeHarness(saves);
  await h.ready();
  await microtasks();
  h.render();
  const store = h.store();
  expect(store?.getState().status).toBe("ready");
  saves.queue[0].resolve(true);
  await microtasks();
  h.render();
  // A user selection: the switch publishes, then its save starts.
  void store?.getState().select(FAVORITES, undefined, true);
  await microtasks();
  h.render();
  expect(store?.getState()).toMatchObject({
    status: "ready",
    persistence: "saving",
  });
  expect(h.publishes.at(-1)?.[1]).toBe(true); // a real switch
  h.switchProgress.value = 0.5;
  h.render();
  const running = { ...h.world().props };
  // (1) saved, mid-switch: zero OrreryWorld commits.
  saves.queue[1].resolve(true);
  await microtasks();
  h.render();
  expect(store?.getState().persistence).toBe("saved");
  expect(changedProps(running, h.world().props)).toEqual([]);
  h.settleSwitch(store?.getState().generation ?? 0);
  // (2) error, mid-switch, then the save notice measures.
  void store?.getState().select(ALL, undefined, true);
  await microtasks();
  h.render();
  const home = h.publishes.at(-1)?.[3] as cameraLogic.CameraPose;
  h.switchProgress.value = 0.5;
  h.render();
  const before = { ...h.world().props };
  const occlusions = (
    before.occlusionRects as { value: readonly cameraLogic.CameraRect[] }
  ).value.length;
  saves.queue[2].reject(new Error("write failed"));
  await microtasks();
  h.render();
  expect(store?.getState().persistence).toBe("error");
  // The notice mounts at once…
  expect(
    h
      .findAll("Feedback")
      .some((node) => node.props.obstacleId === "orrery-save-feedback"),
  ).toBe(true);
  expect(changedProps(before, h.world().props)).toEqual([]);
  // …and publishes its measured rect at once (as OrreryObstacle does through
  // the window measurement): the live viewport changes, the renderer's not.
  h.obstacles
    .getState()
    .publish("orrery-save-feedback", { x: 16, y: 500, width: 368, height: 80 });
  h.render();
  expect(changedProps(before, h.world().props)).toEqual([]);
  // C5-L4: the D-55 occlusion rects follow the measurement right away.
  expect(
    (h.world().props.occlusionRects as { value: unknown[] }).value.length,
  ).toBe(occlusions + 1);
  // Settle: the runtime lands at the publish-time Home, then the screen's
  // settle callback adopts the new viewport inside that one commit.
  const pose = h.world().props.pose as { value: cameraLogic.CameraPose };
  pose.value = { ...home };
  h.settleSwitch(store?.getState().generation ?? 0);
  const settled = h.world().props;
  expect(changedProps(before, settled).sort()).toEqual(
    ["camera", "viewport"].sort(),
  );
  const adopted = settled.viewport as cameraLogic.CameraViewport;
  expect(adopted.obstacles?.length).toBe(
    ((before.viewport as cameraLogic.CameraViewport).obstacles?.length ?? 0) +
      1,
  );
  // No reframe: the Home effect only clamps the landed pose.
  for (const axis of ["x", "y", "zoom", "tilt", "yaw"] as const)
    expect(pose.value[axis]).toBeCloseTo(home[axis] ?? 0, 9);
});

it("C-M3: satellite rows resolving (and, separately, failing) mid-switch reach the frame only through the SharedValue publisher — zero OrreryWorld commits until settle", async () => {
  const saves = controlled<boolean>();
  const reads = controlled<unknown[]>();
  const h = storeHarness(saves, { realSatellites: { read: reads.next } });
  const rows = [
    {
      uid: "m-a",
      parentId: 1,
      parentUid: "u1",
      personName: "Moon A",
      relationType: null,
    },
  ];
  await h.ready();
  await microtasks();
  h.render();
  const store = h.store();
  for (const read of reads.queue.splice(0)) read.resolve(rows);
  saves.queue[0]?.resolve(true);
  await microtasks();
  h.render();
  const spec = () => h.publisher()?.source.spec.value;
  for (const [system, outcome] of [
    [FAVORITES, "ready"],
    [ALL, "error"],
  ] as const) {
    void store?.getState().select(system, undefined, true);
    await microtasks();
    h.render();
    const generation = store?.getState().generation ?? 0;
    expect(spec()).toMatchObject({ status: "loading" });
    h.switchProgress.value = 0.5;
    h.render();
    const running = { ...h.world().props };
    const read = reads.queue.at(-1);
    if (outcome === "ready") read?.resolve(rows);
    else read?.reject(new Error("read failed"));
    await microtasks();
    h.render();
    // The frame's SharedValue has the result…
    expect(spec()).toMatchObject({
      status: outcome,
      sceneGeneration: generation,
    });
    if (outcome === "ready") expect(spec()?.index.rows).toHaveLength(1);
    // …and OrreryWorld committed nothing for it.
    expect(changedProps(running, h.world().props)).toEqual([]);
    // Settle flushes the held React copy; still no OrreryWorld commit.
    h.settleSwitch(generation);
    expect(changedProps(running, h.world().props)).toEqual([]);
    saves.queue.at(-1)?.resolve(true);
    await microtasks();
    h.render();
  }
});

// ── 38.7-15 (D-56, C4-M2, C5-M1/M2/L2/L3): the warm tab return ────────────────

type Harness = ReturnType<typeof harness>;
type Pose = cameraLogic.CameraPose;
const poseOf = (h: Harness) => (h.world().props.pose as { value: Pose }).value;
async function ticks(count = 6): Promise<void> {
  for (let i = 0; i < count; i++) await Promise.resolve();
}

/**
 * Holds the focus reload open: the store is loading (no `current()`, so no
 * action can act on the retained snapshot) until `open()`; then it is ready,
 * optionally with a changed scene.
 */
function holdReload(h: Harness, next?: () => Harness["scene"]) {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const ready = h.state.current;
  h.state.reload = vi.fn(async () => {
    h.state.status = "loading";
    h.state.current = () => null;
    await gate;
    const scene = next?.() ?? h.state.snapshot;
    Object.assign(h.state, {
      status: "ready",
      snapshot: scene,
      current: next ? () => scene : ready,
    });
  });
  return async () => {
    open();
    await ticks();
    h.render();
  };
}

/** Leaves the tab (OrreryStack's blur → leaveTab: resume "home") and returns. */
async function leaveAndReturn(
  h: Harness,
  resume: "home" | "restore" = "home",
): Promise<void> {
  h.setFocused(false);
  expect(h.find("World")).toBeUndefined();
  h.session.resume = resume;
  h.renderLog.length = 0;
  h.setFocused(true);
  await ticks();
  h.render();
}

const firstMounted = (h: Harness) => h.renderLog.find((turn) => turn.world);

it("38.7-15 (a): a warm return from a panned, focused pose draws its first frame at Home with no focus, before sessionReady; unchanged data → no camera change after", async () => {
  const h = harness("tilted", PHONE);
  await h.ready();
  const viewport = h.world().props.viewport as cameraLogic.CameraViewport;
  const home = h.camera.deriveHomePose(h.scene.world, viewport) as Pose;
  await h.focus(1);
  h.settle();
  (h.world().props.pose as { value: Pose }).value = {
    ...poseOf(h),
    x: 40,
    y: -30,
    zoom: 2.2,
  };
  expect(h.world().props.focusedIds).toEqual([1]);
  const open = holdReload(h);
  await leaveAndReturn(h);
  // Mounted on the retained snapshot while the reload is still running.
  expect(h.state.status).toBe("loading");
  const first = firstMounted(h);
  expect(first?.pose).toEqual(home);
  expect(h.world().props.focusedIds).toEqual([]);
  expect(h.find("FocusCard")).toBeUndefined();
  // Warm prep never calls resumed(): the sessionReady Home branch does.
  expect(h.session.resume).toBe("home");
  // Taps during the warm window act on nothing (loading: no current()).
  expect(h.world().props.interactive).toBe(false);
  await (h.world().props.onIntent as (i: unknown) => Promise<void>)({
    kind: "focus",
    generation: 7,
    ids: [1],
    targets: [{ kind: "member", id: 1, uid: "u1" }],
  });
  h.render();
  expect(h.world().props.focusedIds).toEqual([]);
  const warmPose = poseOf(h);
  await open();
  // sessionReady: same data → the drawn Home is kept (no camera change).
  expect(poseOf(h)).toBe(warmPose);
  expect(h.session.resume).toBe("active");
});

it("38.7-15 (b): a warm return mid-switch (paused at 0.5) settles the switch and draws its destination Home first, with no focus and no jump at sessionReady", async () => {
  const h = harness("tilted", PHONE);
  await h.ready();
  await h.focus(1);
  const landed = h.landSwitch();
  h.switchProgress.value = 0.5;
  const open = holdReload(h);
  await leaveAndReturn(h);
  expect(h.switchProgress.value).toBe(1);
  const viewport = h.world().props.viewport as cameraLogic.CameraViewport;
  const home = h.camera.deriveHomePose(landed.world, viewport);
  expect(firstMounted(h)?.pose).toEqual(home);
  expect(h.world().props.focusedIds).toEqual([]);
  const warmPose = poseOf(h);
  await open();
  expect(poseOf(h)).toBe(warmPose);
});

it("38.7-15 (d, C5-M2): an obstacle measured mid-switch is adopted by the warm settle, and warm Home is derived under the adopted viewport", async () => {
  const h = harness("tilted", PHONE);
  await h.ready();
  const landed = h.landSwitch();
  h.switchProgress.value = 0.5;
  const held = h.world().props.viewport as cameraLogic.CameraViewport;
  // A save-error banner measures mid-switch: the renderer keeps the held one.
  h.obstacles
    .getState()
    .publish("orrery-save-feedback", { x: 16, y: 600, width: 368, height: 80 });
  h.render();
  expect(h.world().props.viewport).toEqual(held);
  const open = holdReload(h);
  await leaveAndReturn(h);
  const adopted = h.world().props.viewport as cameraLogic.CameraViewport;
  expect(adopted).not.toEqual(held);
  const home = h.camera.deriveHomePose(landed.world, adopted);
  expect(firstMounted(h)?.pose).toEqual(home);
  expect(h.switchProgress.value).toBe(1);
  const warmPose = poseOf(h);
  await open();
  expect(poseOf(h)).toBe(warmPose);
});

it("38.7-15 (e): a contact added while away reframes Home exactly once at sessionReady", async () => {
  const h = harness("tilted", PHONE);
  await h.ready();
  const grown = {
    ...h.scene,
    generation: 9,
    world: [
      ...h.scene.world,
      {
        id: 3,
        kind: "contact" as const,
        x: 0,
        y: -160,
        radius: 16,
        ringRadius: 160,
      },
    ],
  };
  const open = holdReload(h, () => grown);
  await leaveAndReturn(h);
  const sv = h.world().props.pose as { value: Pose };
  let writes = 0;
  let current = sv.value;
  Object.defineProperty(sv, "value", {
    get: () => current,
    set: (next: Pose) => {
      writes++;
      current = next;
    },
  });
  await open();
  const viewport = h.world().props.viewport as cameraLogic.CameraViewport;
  expect(writes).toBe(1);
  expect(current).toEqual(h.camera.deriveHomePose(grown.world, viewport));
});

it("38.7-15 (f, C5-M1): the warm return is latched per focus — resume flipping to active mid-window keeps the canvas mounted", async () => {
  const h = harness("tilted", PHONE);
  await h.ready();
  const open = holdReload(h);
  await leaveAndReturn(h);
  expect(h.find("World")).toBeDefined();
  h.session.resume = "active";
  h.render();
  expect(h.find("World")).toBeDefined();
  await open();
  expect(h.find("World")).toBeDefined();
});

it.each([["Profile Back"], ["a background return"]])(
  "38.7-15 (c/c2/g): %s (resume restore) draws no early canvas; the restored pose and validated focus appear only after restore",
  async () => {
    const h = harness("tilted", PHONE);
    await h.ready();
    const saved = cameraLogic.clampCameraPose(
      { ...cameraLogic.HOME_CAMERA, x: 5, y: -40, zoom: 1.4 },
      400,
    );
    h.session.saved = {
      pose: saved,
      focus: { kind: "member", id: 1, uid: "u1" },
      systemId: "builtin:all-contacts",
    };
    const open = holdReload(h);
    await leaveAndReturn(h, "restore");
    expect(h.renderLog.some((turn) => turn.world)).toBe(false);
    await open();
    expect(poseOf(h)).toEqual(saved);
    expect(h.world().props.focusedIds).toEqual([1]);
  },
);

it("38.7-15 (g): a return whose requested System differs from the retained snapshot does not mount warm", async () => {
  const h = harness("tilted", PHONE);
  await h.ready();
  const open = holdReload(h);
  h.state.requested = { id: "builtin:favorites" };
  await leaveAndReturn(h);
  expect(h.renderLog.some((turn) => turn.world)).toBe(false);
  h.state.requested = { id: "builtin:all-contacts" };
  await open();
  expect(h.find("World")).toBeDefined();
});

it("38.7-15 (D-76): a System tap starts the switch lead-in at once (before the load lands); a failed load ends it", async () => {
  const h = harness("tilted", PHONE);
  await h.ready();
  h.tapSystem();
  // Loading only: nothing published yet, the lead is already running.
  expect(h.leadCalls).toEqual(["begin"]);
  expect(h.publishes.filter((p) => p[1] === true)).toHaveLength(0);
  h.failLoad();
  expect(h.leadCalls).toEqual(["begin", "end"]);
});
