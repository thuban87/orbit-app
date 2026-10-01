import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Discrete hook harness (the repo has no react-test-renderer): per-instance
 * hook slots and layout effects queued until `flush()` like a React commit.
 */
const rt = vi.hoisted(() => {
  type Slot = {
    value?: unknown;
    deps?: readonly unknown[];
    cleanup?: (() => void) | undefined;
  };
  let slots: Slot[] = [];
  let cursor = 0;
  let queued: (() => void)[] = [];
  const changed = (slot: Slot, deps: readonly unknown[]) =>
    !slot.deps || deps.some((dep, i) => !Object.is(dep, slot.deps?.[i]));
  const next = (): Slot => {
    slots[cursor] ??= {};
    return slots[cursor++];
  };
  const hooks = {
    useRef: (value: unknown) => {
      const slot = next();
      if (!slot.deps) {
        slot.value = { current: value };
        slot.deps = [];
      }
      return slot.value;
    },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
      const slot = next();
      if (changed(slot, deps)) {
        slot.value = factory();
        slot.deps = deps;
      }
      return slot.value;
    },
    useCallback: (callback: unknown, deps: readonly unknown[]) =>
      hooks.useMemo(() => callback, deps),
    useLayoutEffect: (
      effect: () => (() => void) | undefined,
      deps: readonly unknown[],
    ) => {
      const slot = next();
      if (changed(slot, deps)) {
        slot.deps = deps;
        queued.push(() => {
          slot.cleanup?.();
          slot.cleanup = effect();
        });
      }
    },
  };
  return {
    hooks,
    render<T>(instance: Slot[], component: () => T): T {
      slots = instance;
      cursor = 0;
      return component();
    },
    flush() {
      const run = queued;
      queued = [];
      for (const effect of run) effect();
    },
  };
});

vi.mock("react", () => rt.hooks);
// zustand's React binding resolves the real React outside this mock, so the
// subscription hook reads the store snapshot directly (one render = one read).
vi.mock("@/stores/shell-offset-store", async (original) => {
  const actual = await original<typeof import("@/stores/shell-offset-store")>();
  return {
    ...actual,
    useShellTopOffset: () => actual.useShellOffsetStore.getState().topOffset,
  };
});
vi.mock("react-native", () => ({
  View: "View",
  useWindowDimensions: () => ({ width: 393, height: 807, fontScale: 1 }),
}));

import { canvasViewport } from "@/components/orrery/orrery-obstacle-logic";
import type { CameraRect } from "@/logic/orrery-camera-logic";
import {
  useWindowMeasurement,
  useWindowObstacle,
} from "@/navigation/use-window-measurement";
import { useShellObstacleStore } from "@/stores/shell-obstacle-store";
import {
  setShellTopOffset,
  useShellOffsetStore,
} from "@/stores/shell-offset-store";
import { SPACING } from "@/theme/tokens/spacing";

const STATUS_BAR = 24;
const WINDOW_HEIGHT = 807;
const TAB_BAR = 80;
/** A measured "Did you reach…?" banner (WR5-01: about 184 dp). */
const BANNER = 184;

/** The native layout: everything below the banner moves with it. */
function nativeLayout(banner: number) {
  const top = STATUS_BAR + banner;
  return {
    canvas: {
      x: 0,
      y: top,
      width: 393,
      height: WINDOW_HEIGHT - top - TAB_BAR,
    },
    // The System selector trigger: absolute `top: SPACING.base` in a full-canvas
    // root, so its frame relative to its parent never changes.
    trigger: { x: SPACING.base, y: top + SPACING.base, width: 160, height: 48 },
  };
}

function fakeView(rect: () => CameraRect) {
  return {
    measureInWindow: (
      callback: (x: number, y: number, w: number, h: number) => void,
    ) => {
      const { x, y, width, height } = rect();
      callback(x, y, width, height);
    },
  };
}

function layoutEvent(rect: CameraRect) {
  return {
    nativeEvent: { layout: { ...rect, x: 0, y: 0 } },
  } as never;
}

describe("window measurements follow the in-flow assist banner (38.6 review WR5-01)", () => {
  beforeEach(() => {
    useShellObstacleStore.setState({ rects: {} });
    useShellOffsetStore.setState({ topOffset: 0 });
  });

  it("re-measures an Orrery HUD trigger whose own onLayout does not fire when the banner hides or shows", () => {
    let banner = BANNER;
    setShellTopOffset(banner);
    let canvasRect: CameraRect | null = null;
    const publishCanvas = (rect: CameraRect | null) => {
      canvasRect = rect;
    };
    const canvasSlots: never[] = [];
    const triggerSlots: never[] = [];
    const renderCanvas = () =>
      rt.render(canvasSlots, () => useWindowMeasurement(publishCanvas));
    const renderTrigger = () =>
      rt.render(triggerSlots, () =>
        useWindowObstacle("orrery-system-trigger", true),
      );

    const canvas = renderCanvas();
    const trigger = renderTrigger();
    (canvas.ref as { current: unknown }).current = fakeView(
      () => nativeLayout(banner).canvas,
    );
    (trigger.ref as { current: unknown }).current = fakeView(
      () => nativeLayout(banner).trigger,
    );
    rt.flush();

    const triggerY = () => {
      const viewport = canvasViewport(
        canvasRect,
        Object.values(useShellObstacleStore.getState().rects),
      );
      return (viewport.obstacles ?? []).map((rect) => rect.y);
    };
    expect(triggerY()).toEqual([SPACING.base]);

    // "Don't log": the banner leaves. The canvas resizes, so its onLayout
    // fires; the trigger keeps its parent-relative frame, so its does not.
    banner = 0;
    setShellTopOffset(0);
    renderCanvas().onLayout(layoutEvent(nativeLayout(banner).canvas));
    renderTrigger();
    rt.flush();
    expect(triggerY()).toEqual([SPACING.base]);

    // A new question arrives while the Orrery is focused.
    banner = BANNER;
    setShellTopOffset(banner);
    renderCanvas().onLayout(layoutEvent(nativeLayout(banner).canvas));
    renderTrigger();
    rt.flush();
    expect(triggerY()).toEqual([SPACING.base]);

    // The banner grows ("N more pending", the note field) without hiding.
    banner = BANNER + 52;
    setShellTopOffset(banner);
    renderCanvas().onLayout(layoutEvent(nativeLayout(banner).canvas));
    renderTrigger();
    rt.flush();
    expect(triggerY()).toEqual([SPACING.base]);
  });

  it("stores only a finite, non-negative offset and ignores a repeat", () => {
    setShellTopOffset(BANNER);
    const state = useShellOffsetStore.getState();
    setShellTopOffset(BANNER);
    expect(useShellOffsetStore.getState()).toBe(state);
    setShellTopOffset(Number.NaN);
    expect(useShellOffsetStore.getState().topOffset).toBe(0);
    setShellTopOffset(-4);
    expect(useShellOffsetStore.getState().topOffset).toBe(0);
  });
});
