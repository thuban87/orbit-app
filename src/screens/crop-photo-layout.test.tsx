/**
 * Crop Photo sizing (38.6 review WR5-02): the in-flow assist banner (D-38)
 * takes height from every screen, and Crop Photo has no scroll container, so
 * the canvas must give up height before the Cancel / Use photo footer does.
 *
 * Pure layout tests plus a shallow render with a small persistent hook
 * harness (the repo has no react-test-renderer): state, refs and shared values
 * persist by call order across renders, and effects run on `flush()`.
 */
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cropRectFromTransform } from "@/services/photos/crop-geometry";
import { THEME_PRESETS } from "@/theme/theme-presets";
import {
  CROP_DIM_BAND,
  CROP_MIN_BAND,
  CROP_SCREEN_PADDING,
  cropLayout,
  cropNaturalHeight,
} from "./crop-photo-layout";

const h = vi.hoisted(() => {
  type Effect = {
    deps?: readonly unknown[];
    cleanup?: (() => void) | undefined;
  };
  const store = {
    states: [] as unknown[],
    refs: [] as { current: unknown }[],
    shared: [] as { value: unknown }[],
    effects: [] as Effect[],
    queued: [] as (() => void)[],
    i: { state: 0, ref: 0, shared: 0, effect: 0 },
    image: null as null | { width: () => number; height: () => number },
  };
  return {
    store,
    reset() {
      store.states = [];
      store.refs = [];
      store.shared = [];
      store.effects = [];
      store.queued = [];
    },
    begin() {
      store.i = { state: 0, ref: 0, shared: 0, effect: 0 };
    },
    flush() {
      const run = store.queued;
      store.queued = [];
      for (const effect of run) effect();
    },
  };
});

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = h.store.i.state++;
    if (!(index in h.store.states)) h.store.states[index] = initial;
    return [
      h.store.states[index],
      (next: unknown) => {
        h.store.states[index] =
          typeof next === "function"
            ? (next as (value: unknown) => unknown)(h.store.states[index])
            : next;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = h.store.i.ref++;
    h.store.refs[index] ??= { current: initial };
    return h.store.refs[index];
  },
  useCallback: (fn: unknown) => fn,
  useEffect: (
    effect: () => (() => void) | undefined,
    deps: readonly unknown[],
  ) => {
    const index = h.store.i.effect++;
    if (!h.store.effects[index]) h.store.effects[index] = {};
    const slot = h.store.effects[index];
    if (
      !slot.deps ||
      deps.some((dep, at) => !Object.is(dep, slot.deps?.[at]))
    ) {
      slot.deps = deps;
      h.store.queued.push(() => {
        slot.cleanup?.();
        slot.cleanup = effect();
      });
    }
  },
}));
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
  useWindowDimensions: () => ({ width: 393, height: 807, fontScale: 1 }),
}));
vi.mock("@shopify/react-native-skia", () => ({
  Canvas: "Canvas",
  Fill: "Fill",
  Group: "Group",
  Rect: "Rect",
  Image: "SkiaImage",
  useImage: () => h.store.image,
}));
vi.mock("react-native-gesture-handler", () => {
  const builder = (): Record<string, unknown> =>
    new Proxy({} as Record<string, unknown>, {
      get: (_object, _key, proxy) => () => proxy,
    });
  return {
    GestureDetector: "GestureDetector",
    Gesture: {
      Pan: builder,
      Pinch: builder,
      Simultaneous: (...gestures: unknown[]) => ({ gestures }),
    },
  };
});
vi.mock("react-native-reanimated", () => ({
  useSharedValue: (initial: unknown) => {
    const index = h.store.i.shared++;
    h.store.shared[index] ??= { value: initial };
    return h.store.shared[index];
  },
  useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/db/contacts-dao", () => ({
  getContactPhotoIdentity: vi.fn(),
  setContactPhotoForUid: vi.fn(),
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: vi.fn(),
}));
vi.mock("@/db/profile-dao", () => ({ setProfilePhoto: vi.fn() }));
vi.mock("@/services/photos/derivative-cache", () => ({
  discardDerivative: vi.fn(),
}));
vi.mock("@/services/photos/manipulator-derivatives", () => ({
  renderPreviewDownscale: vi.fn(),
}));
vi.mock("@/services/photos/owned-master", () => ({
  withCanonicalPathLock: vi.fn(),
}));
vi.mock("@/services/photos/photo-pipeline", () => ({
  PhotoPipelineError: class extends Error {},
  persistCroppedMaster: vi.fn(),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  relPathForTarget: vi.fn(),
}));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged: vi.fn(),
}));
vi.mock("@/stores/photo-result-store", () => ({ publishCropResult: vi.fn() }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { CropPhotoScreen } = await import("./CropPhotoScreen");

/** A 393-dp-wide (Pixel 3a class) window, 807 dp tall. */
const WIDTH = 393;
const WINDOW = 807;
const STATUS_BAR = 24;
/** The banner at its measured sizes (review WR5-01/WR5-02). */
const BANNER = 184;
const BANNER_WITH_NOTE = BANNER + 98;
/** Crop Photo's fixed rows: the title header and the button footer. */
const HEADER = 61;
const FOOTER = 76;

const slotFor = (banner: number) =>
  WINDOW - STATUS_BAR - banner - HEADER - FOOTER;

describe("cropLayout (38.6 review WR5-02)", () => {
  it("keeps the original fixed layout when there is room", () => {
    const natural = cropNaturalHeight(WIDTH);
    expect(natural).toBe(WIDTH - 2 * CROP_SCREEN_PADDING + 2 * CROP_DIM_BAND);
    for (const available of [null, natural, natural + 200]) {
      expect(cropLayout(WIDTH, available)).toEqual({
        viewport: WIDTH - 2 * CROP_SCREEN_PADDING,
        squareX: CROP_SCREEN_PADDING,
        squareY: CROP_DIM_BAND,
        canvasW: WIDTH,
        canvasH: natural,
      });
    }
  });

  it("fits the canvas, and so the footer, under the banner on a Pixel 3a-class screen", () => {
    for (const banner of [BANNER, BANNER + 52, BANNER_WITH_NOTE]) {
      const available = slotFor(banner);
      const layout = cropLayout(WIDTH, available);
      expect(layout.canvasH).toBeLessThanOrEqual(available);
      // Header + canvas + footer fit the screen's container.
      expect(HEADER + layout.canvasH + FOOTER).toBeLessThanOrEqual(
        WINDOW - STATUS_BAR - banner,
      );
      // The square stays whole inside the canvas, with a dim band either side.
      expect(layout.squareY).toBeGreaterThanOrEqual(CROP_MIN_BAND);
      expect(layout.squareY + layout.viewport).toBeLessThanOrEqual(
        layout.canvasH,
      );
      expect(layout.squareX + layout.viewport).toBeLessThanOrEqual(WIDTH);
    }
  });

  it("shrinks the dim bands before the square", () => {
    // 184 dp banner: 462 dp left, still room for the full-width square.
    const banner = cropLayout(WIDTH, slotFor(BANNER));
    expect(banner.viewport).toBe(WIDTH - 2 * CROP_SCREEN_PADDING);
    expect(banner.squareY).toBe((banner.canvasH - banner.viewport) / 2);
    // Note field open too: the square gives up the rest.
    const note = cropLayout(WIDTH, slotFor(BANNER_WITH_NOTE));
    expect(note.viewport).toBe(note.canvasH - 2 * CROP_MIN_BAND);
    expect(note.squareX).toBe((WIDTH - note.viewport) / 2);
  });

  it("ignores an unusable measurement", () => {
    for (const bad of [0, -1, Number.NaN])
      expect(cropLayout(WIDTH, bad).canvasH).toBe(cropNaturalHeight(WIDTH));
  });
});

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}
const byTestId = (tree: TestElement[], id: string) =>
  tree.find((node) => node.props.testID === id);
const flatStyle = (element: TestElement | undefined) => {
  const style = element?.props.style;
  return (
    Array.isArray(style) ? Object.assign({}, ...style) : (style ?? {})
  ) as Record<string, unknown>;
};

function render(): TestElement[] {
  h.begin();
  return nodes(
    CropPhotoScreen({
      navigation: { goBack: vi.fn() },
      route: {
        params: {
          rawUri: "file:///picked.jpg",
          target: { kind: "profile" },
        },
      },
    } as never),
  );
}
function layoutSlot(tree: TestElement[], height: number) {
  const onLayout = byTestId(tree, "crop-photo-canvas-slot")?.props.onLayout as
    | ((event: unknown) => void)
    | undefined;
  if (!onLayout) throw new Error("no canvas slot");
  onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height } } });
}

describe("CropPhotoScreen sizing (38.6 review WR5-02)", () => {
  beforeEach(() => {
    h.reset();
    h.store.image = { width: () => 4000, height: () => 3000 };
  });

  it("puts the canvas in a shrinkable slot whose natural size is the original canvas, between the header and the footer", () => {
    const tree = render();
    const slot = byTestId(tree, "crop-photo-canvas-slot");
    expect(flatStyle(slot)).toMatchObject({
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cropNaturalHeight(WIDTH),
      minHeight: 0,
      overflow: "hidden",
    });
    const rootChildren = (tree[0]?.props.children ?? []) as ReactNode[];
    const children = rootChildren.filter(
      (child) => child && typeof child === "object",
    ) as TestElement[];
    expect(children.map((child) => child.props.testID ?? child.type)).toEqual([
      "View",
      "crop-photo-canvas-slot",
      "View",
    ]);
    expect(
      byTestId(nodes(children[2]), "crop-photo-use")?.props.accessibilityLabel,
    ).toBe("Use photo");
    expect(flatStyle(byTestId(tree, "crop-photo-canvas"))).toEqual({
      width: WIDTH,
      height: cropNaturalHeight(WIDTH),
    });
  });

  it("sizes the canvas and crop frame to the measured slot", () => {
    layoutSlot(render(), slotFor(BANNER_WITH_NOTE));
    const tree = render();
    const expected = cropLayout(WIDTH, slotFor(BANNER_WITH_NOTE));
    expect(flatStyle(byTestId(tree, "crop-photo-canvas"))).toEqual({
      width: WIDTH,
      height: expected.canvasH,
    });
    const frame = tree.find(
      (node) => node.type === "Rect" && node.props.style === "stroke",
    );
    expect(frame?.props).toMatchObject({
      x: expected.squareX,
      y: expected.squareY,
      width: expected.viewport,
      height: expected.viewport,
    });
  });

  it("keeps the same crop when the banner changes the square after the photo is framed", () => {
    render();
    h.flush(); // one-time geometry init at the natural square
    const [scale, tx, ty, svViewport, svBaseScale] = h.store.shared;
    const natural = cropLayout(WIDTH, null).viewport;
    expect(svViewport?.value).toBe(natural);
    // The user zooms and pans.
    (scale as { value: number }).value = 2;
    (tx as { value: number }).value = 120;
    (ty as { value: number }).value = -40;
    const before = cropRectFromTransform({
      viewport: natural,
      srcW: 4000,
      srcH: 3000,
      baseScale: natural / 3000,
      scale: 2,
      tx: 120,
      ty: -40,
    });

    // A question with its note field open arrives: the slot shrinks.
    layoutSlot(render(), slotFor(BANNER_WITH_NOTE));
    render();
    h.flush();
    const next = cropLayout(WIDTH, slotFor(BANNER_WITH_NOTE)).viewport;
    expect(next).toBeLessThan(natural);
    expect(svViewport?.value).toBe(next);
    expect(svBaseScale?.value).toBeCloseTo(next / 3000);
    const after = cropRectFromTransform({
      viewport: next,
      srcW: 4000,
      srcH: 3000,
      baseScale: svBaseScale?.value as number,
      scale: (scale as { value: number }).value,
      tx: (tx as { value: number }).value,
      ty: (ty as { value: number }).value,
    });
    for (const key of ["originX", "originY", "width", "height"] as const)
      expect(after[key]).toBeCloseTo(before[key]);
  });
});
