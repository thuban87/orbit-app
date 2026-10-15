import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of the root Snackbar host (38.10 review CR-01). D-143 puts
 * the root pill over the open + dial's rows, and App.tsx renders the Snackbar
 * after UniversalFab, so while the dial is open the host must be
 * touch-transparent: a tap on "Add Contact" reaches the dial, never the pill's
 * Undo. The pill keeps its D-143 place and look; only touch and accessibility
 * change.
 */

const shell = vi.hoisted(() => ({
  dialOpen: false,
  snackbar: null as null | {
    kind: "success" | "warning" | "error";
    label: string;
    action?: { label: string; accessibilityLabel: string; onPress: () => void };
  },
}));

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: {},
    hairlineWidth: 1,
  },
  useWindowDimensions: () => ({ width: 400, height: 800, fontScale: 1 }),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/stores/shell-transient-store", async () => {
  const { FAB_DIAL_TRANSIENT_ID } = await import(
    "@/components/universal-fab-logic"
  );
  return {
    shellTransientStore: (
      select: (state: { entries: { id: string }[] }) => unknown,
    ) =>
      select({
        entries: shell.dialOpen ? [{ id: FAB_DIAL_TRANSIENT_ID }] : [],
      }),
  };
});
vi.mock("@/stores/overlay-registry-store", async (original) => ({
  ...(await original<typeof import("@/stores/overlay-registry-store")>()),
  overlayRegistryStore: (select: (state: { entries: unknown[] }) => unknown) =>
    select({ entries: [] }),
}));
vi.mock("@/stores/snackbar-store", () => ({
  snackbarStore: (
    select: (state: {
      snackbar: typeof shell.snackbar;
      dismiss: () => void;
    }) => unknown,
  ) => select({ snackbar: shell.snackbar, dismiss: () => {} }),
}));
// The universal + is on screen, so the root pill sits above its row (D-143).
vi.mock("@/stores/shell-obstacle-store", () => ({
  useShellObstacleStore: (
    select: (state: { rects: Record<string, unknown> }) => unknown,
  ) => select({ rects: { "shell-fab": {} } }),
}));
vi.mock("@/stores/section-fab-store", async (original) => ({
  ...(await original<typeof import("@/stores/section-fab-store")>()),
  useSectionFabStore: (
    select: (state: { owners: ReadonlySet<string> }) => unknown,
  ) => select({ owners: new Set<string>() }),
}));
vi.mock("@/stores/tab-bar-layout-store", () => ({
  useMeasuredTabBarHeight: () => 64,
}));

const { Snackbar } = await import("./Snackbar");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function render(): TestElement {
  const root = Snackbar({}) as TestElement | null;
  if (!root) throw new Error("the root snackbar host rendered nothing");
  return root;
}

describe("root Snackbar while the + dial is open (38.10 review CR-01)", () => {
  beforeEach(() => {
    shell.dialOpen = false;
    shell.snackbar = {
      kind: "success",
      label: "Logged a touchpoint",
      action: { label: "Undo", accessibilityLabel: "Undo", onPress: vi.fn() },
    };
  });

  it("keeps only the pill touchable while the dial is closed", () => {
    const root = render();
    expect(root.props.pointerEvents).toBe("box-none");
    expect(root.props.importantForAccessibility).toBe("auto");
    expect(root.props.accessibilityElementsHidden).toBe(false);
  });

  it("takes no touches at all, and hides from accessibility, while the dial is open", () => {
    shell.dialOpen = true;
    const root = render();
    expect(root.props.pointerEvents).toBe("none");
    expect(root.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(root.props.accessibilityElementsHidden).toBe(true);
  });

  it("keeps the pill and its Undo where D-143 put them while the dial is open", () => {
    const closed = render();
    shell.dialOpen = true;
    const open = render();
    expect(open.props.style).toEqual(closed.props.style);
    const undo = nodes(open).find(
      (node) => node.props.accessibilityLabel === "Undo",
    );
    expect(undo?.type).toBe("Pressable");
  });
});
