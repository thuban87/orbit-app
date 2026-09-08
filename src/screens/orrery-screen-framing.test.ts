import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { canvasViewport } from "@/components/orrery/orrery-obstacle-logic";
import * as overlayLogic from "@/components/orrery/orrery-overlay-logic";
import * as switchLogic from "@/components/orrery/orrery-switch-animation";
import * as cameraLogic from "@/logic/orrery-camera-logic";
import * as focusLogic from "@/logic/orrery-focus-logic";
import * as gestureLogic from "@/logic/orrery-gesture-logic";
import * as recoveryLogic from "@/logic/orrery-recovery-logic";
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
/** Discrete React effect/cleanup ordering, with delayed native layout and animation completion. */
function harness() {
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
  const store = Object.assign(() => state, {
    getState: () => state,
    subscribe: () => () => {},
  });
  const prefs = {
    committed: { density: "balanced", satellitesEnabled: 0 },
    hydrated: true,
    hydrate: async () => {},
  };
  const prefStore = Object.assign(
    (selector: (s: unknown) => unknown) => selector(prefs),
    { getState: () => prefs },
  );
  const session = { resume: "active", resumed: () => {}, generation: 0 };
  const sessionStore = Object.assign(
    (selector: (s: unknown) => unknown) => selector(session),
    { getState: () => session },
  );
  const obstacles = createShellObstacleStore();
  obstacles
    .getState()
    .publish("controls", { x: 184, y: 400, width: 200, height: 180 });
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
      return { ...cameraLogic.HOME_CAMERA };
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
          if (id.includes("orrery-camera-logic")) return cameraLogic;
          if (id.includes("orrery-focus-logic")) return focusLogic;
          if (id.includes("orrery-gesture-logic")) return gestureLogic;
          if (id.includes("orrery-recovery-logic")) return recoveryLogic;
          if (id.includes("orrery-system-logic")) return systemLogic;
          if (id.includes("orrery-switch-animation")) return switchLogic;
          if (id.includes("orrery-overlay-logic")) return overlayLogic;
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
                  publish({ x: 0, y: 0, width: 400, height: 600 });
                  return undefined;
                }, []);
                return {};
              },
            };
          if (id.includes("orrery-scene"))
            return {
              createOrrerySatelliteController: () => ({ reload: () => {} }),
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
    if (!element || typeof element !== "object") return undefined;
    if (element.type === type) return element;
    return [element.props?.children ?? []]
      .flat()
      .flatMap((child) => find(type, child) ?? [])
      .at(0);
  }
  const measurement = createWindowMeasurement((rect) =>
    obstacles.getState().publish("orrery-cluster-panel", rect),
  );
  return {
    scene,
    pending,
    render,
    find,
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
  };
}

it.each([180, 200])(
  "frames a group after delayed measurement and font reflow to y=%s; close rejects late measurement",
  async (top) => {
    const h = harness();
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
