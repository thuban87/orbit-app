import { describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  useCallback: <T>(value: T) => value,
  useEffect: vi.fn(),
  useRef: <T>(value: T) => ({ current: value }),
  useState: <T>(value: T) => [value, vi.fn()],
}));
vi.mock("react-native", () => ({
  AccessibilityInfo: {},
  findNodeHandle: vi.fn(),
  Modal: "Modal",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: {
    absoluteFill: {},
    create: (value: unknown) => value,
    hairlineWidth: 1,
  },
  useWindowDimensions: () => ({ width: 360, height: 800 }),
  View: "View",
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/GlassSurface", () => ({
  GlassSurface: "GlassSurface",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

const { placeAnchoredMenu } = await import("./AnchoredMenu");

describe("placeAnchoredMenu", () => {
  it("prefers below/end and clamps to the safe-area inset", () => {
    expect(
      placeAnchoredMenu({
        anchor: { x: 330, y: 100, width: 44, height: 44 },
        window: { width: 360, height: 800 },
        menu: { width: 200, height: 220 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
        alignment: "end",
      }),
    ).toEqual({ left: 144, top: 144, maxHeight: 640, placement: "below" });
  });

  it("flips above when the requested height does not fit below", () => {
    expect(
      placeAnchoredMenu({
        anchor: { x: 280, y: 650, width: 44, height: 44 },
        window: { width: 360, height: 800 },
        menu: { width: 180, height: 220 },
        insets: { top: 24, right: 0, bottom: 24, left: 0 },
        alignment: "end",
      }),
    ).toEqual({ left: 144, top: 430, maxHeight: 610, placement: "above" });
  });

  it("bounds scrolling when neither direction can fit", () => {
    expect(
      placeAnchoredMenu({
        anchor: { x: 20, y: 180, width: 44, height: 44 },
        window: { width: 320, height: 420 },
        menu: { width: 240, height: 500 },
        insets: { top: 24, right: 0, bottom: 24, left: 0 },
        alignment: "start",
      }),
    ).toEqual({ left: 20, top: 224, maxHeight: 156, placement: "below" });
  });
});
