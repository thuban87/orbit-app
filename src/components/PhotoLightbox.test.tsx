/**
 * PhotoLightbox render contract (38.6 D-03/D-15/D-16), shallow.
 *
 * Hooks are recorded rather than executed by React: every mocked hook appends
 * its name to `hooks.log`, so one render's hook sequence can be compared with
 * the next. The lightbox stays mounted while `photo` flips between null and a
 * path, and React requires an identical hook sequence on every render of the
 * same instance — so the null → path → null → path case asserts the sequence
 * never changes (a hook below the null return or inside a branch would).
 */
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { PhotoLightbox, type PhotoLightboxProps } from "./PhotoLightbox";
import { LIGHTBOX_SCRIM_OPACITY } from "./photo-lightbox-logic";

const hooks = vi.hoisted(() => ({
  log: [] as string[],
  focus: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => {
    hooks.log.push("useRef");
    return { current: value ?? { node: "close" } };
  },
  useMemo: (factory: () => unknown) => {
    hooks.log.push("useMemo");
    return factory();
  },
  useCallback: (fn: unknown) => {
    hooks.log.push("useCallback");
    return fn;
  },
  useEffect: (effect: () => undefined | (() => void)) => {
    hooks.log.push("useEffect");
    effect();
  },
  useState: (value: unknown) => {
    hooks.log.push("useState");
    return [value, () => {}];
  },
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  Modal: "Modal",
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: { position: "absolute" },
  },
  useWindowDimensions: () => {
    hooks.log.push("useWindowDimensions");
    return { width: 400, height: 800, fontScale: 1 };
  },
  AccessibilityInfo: { setAccessibilityFocus: hooks.focus },
  findNodeHandle: () => 7,
}));
vi.mock("react-native-gesture-handler", () => {
  // Chainable builder stub: every configuration call returns the builder.
  const builder = (kind: string) => {
    const target: Record<string, unknown> = { kind };
    const proxy: Record<string, unknown> = new Proxy(target, {
      get: (object, key: string) => (key in object ? object[key] : () => proxy),
    });
    return proxy;
  };
  return {
    GestureHandlerRootView: "GestureHandlerRootView",
    GestureDetector: "GestureDetector",
    Gesture: {
      Pinch: () => builder("pinch"),
      Pan: () => builder("pan"),
      Tap: () => builder("tap"),
      Race: (...gestures: unknown[]) => ({ kind: "race", gestures }),
      Simultaneous: (...gestures: unknown[]) => ({
        kind: "simultaneous",
        gestures,
      }),
    },
  };
});
vi.mock("react-native-reanimated", () => ({
  default: { View: "AnimatedView" },
  useSharedValue: (value: unknown) => {
    hooks.log.push("useSharedValue");
    return { value };
  },
  useAnimatedStyle: (fn: () => unknown) => {
    hooks.log.push("useAnimatedStyle");
    return fn();
  },
  withTiming: (value: unknown) => value,
  withSpring: (value: unknown) => value,
  runOnJS: (fn: unknown) => fn,
}));
vi.mock("@/theme/use-reduced-motion", () => ({
  useReducedMotionShared: () => {
    hooks.log.push("useReducedMotionShared");
    return { value: false };
  },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => {
    hooks.log.push("useSafeAreaInsets");
    return { top: 24, bottom: 0, left: 0, right: 0 };
  },
}));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/photo-display", () => ({
  usePhotoDisplay: (relative: string | null) => {
    hooks.log.push("usePhotoDisplay");
    return relative
      ? {
          source: { uri: `file:///docs/${relative}?v=3` },
          cachePolicy: "memory",
          revision: 3,
        }
      : null;
  },
}));
vi.mock("@/theme", () => ({
  useTheme: () => {
    hooks.log.push("useTheme");
    return { colors: THEME_PRESETS.galaxy.dark };
  },
  UnscopedTheme: ({ children }: { children?: ReactNode }) => children,
}));

interface Node {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly Node[];
}

function resolve(node: ReactNode): Node[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function") {
    return resolve(
      (element.type as (props: unknown) => ReactNode)(element.props),
    );
  }
  if (typeof element.type !== "string") return resolve(element.props.children);
  return [
    {
      type: element.type,
      props: element.props,
      children: resolve(element.props.children),
    },
  ];
}

function all(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

function flatStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatStyle));
  return (style as Record<string, unknown>) ?? {};
}

const onClose = vi.fn();
const base: PhotoLightboxProps = {
  visible: true,
  photo: "avatars/contact-7.jpg",
  name: "Alex",
  onClose,
};

/** One render of the (conceptually persistent) instance: its tree and hook sequence. */
function render(props: PhotoLightboxProps) {
  hooks.log.length = 0;
  const tree = resolve(PhotoLightbox(props));
  return { nodes: all(tree), hooks: [...hooks.log] };
}

beforeEach(() => {
  onClose.mockReset();
  hooks.focus.mockReset();
});

describe("PhotoLightbox", () => {
  it("renders nothing without a photo", () => {
    expect(render({ ...base, photo: null }).nodes).toEqual([]);
  });

  it("keeps one hook sequence across null → path → null → path", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const sequences = [null, base.photo, null, base.photo].map(
      (photo) => render({ ...base, photo }).hooks,
    );
    expect(sequences[0].length).toBeGreaterThan(0);
    for (const sequence of sequences) expect(sequence).toEqual(sequences[0]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("closes on hardware Back through the Modal's onRequestClose", () => {
    const modal = render(base).nodes.find((node) => node.type === "Modal");
    expect(modal?.props.onRequestClose).toBe(onClose);
    expect(modal?.props.visible).toBe(true);
    expect(modal?.props.transparent).toBe(true);
  });

  it("has a labelled ✕ button that closes, at least 48 square", () => {
    const close = render(base).nodes.find(
      (node) => node.props.accessibilityLabel === "Close photo",
    );
    expect(close?.type).toBe("Pressable");
    expect(close?.props.accessibilityRole).toBe("button");
    const style = flatStyle(close?.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(48);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    const press = close?.props.onPress as () => void;
    press();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      all(close ? [close] : []).some(
        (node) => node.type === "Icon" && node.props.name === "close",
      ),
    ).toBe(true);
  });

  it("moves accessibility focus to the ✕ when opened", () => {
    render(base);
    expect(hooks.focus).toHaveBeenCalledWith(7);
    hooks.focus.mockReset();
    render({ ...base, visible: false });
    expect(hooks.focus).not.toHaveBeenCalled();
  });

  it("uses the theme background for the scrim, never a literal", () => {
    const scrim = render(base).nodes.find(
      (node) => node.props.testID === "photo-lightbox-scrim",
    );
    const style = flatStyle(scrim?.props.style);
    expect(style.backgroundColor).toBe(THEME_PRESETS.galaxy.dark.background);
    // At rest (no swipe) the scrim sits at its near-opaque resting opacity.
    expect(style.opacity).toBe(LIGHTBOX_SCRIM_OPACITY);
  });

  it("wraps the image in one gesture: double-tap racing pinch + pan", () => {
    const nodes = render(base).nodes;
    const detector = nodes.find((node) => node.type === "GestureDetector");
    expect(detector?.props.gesture).toMatchObject({
      kind: "race",
      gestures: [
        { kind: "tap" },
        {
          kind: "simultaneous",
          gestures: [{ kind: "pinch" }, { kind: "pan" }],
        },
      ],
    });
    expect(
      all(detector ? [detector] : []).some((node) => node.type === "Image"),
    ).toBe(true);
  });

  it("shows the display-source image contained, labelled with the name", () => {
    const image = render(base).nodes.find((node) => node.type === "Image");
    expect(image?.props.accessibilityLabel).toBe("Photo of Alex");
    expect(image?.props.contentFit).toBe("contain");
    expect(image?.props.source).toEqual({
      uri: "file:///docs/avatars/contact-7.jpg?v=3",
    });
    expect(image?.props.cachePolicy).toBe("memory");
    // Square at the window's short side.
    expect(flatStyle(image?.props.style)).toMatchObject({
      width: 400,
      height: 400,
    });
  });
});
