import { readFileSync } from "node:fs";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  overviewColumnWidth,
  overviewTileWidth,
} from "@/components/profile/overview-geometry";
import { FACTORY_PROFILE_LAYOUT } from "@/profile/presentation-schema";
import { SPACING } from "@/theme/tokens/spacing";

// The preview measures its tile container via onLayout into state (RG-033
// ui-accessibility/AUD-UIA-021). The component is called directly, so
// `useState` returns the test-controlled measured width.
let measuredWidth = 0;
let windowWidth = 360;
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: () => [measuredWidth, vi.fn()],
}));
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Switch: "Switch",
  View: "View",
  useWindowDimensions: () => ({ width: windowWidth, fontScale: 1 }),
}));
vi.mock("react-native-reorderable-list", () => ({
  NestedReorderableList: "NestedReorderableList",
  ScrollViewContainer: "ScrollViewContainer",
  useReorderableDrag: () => vi.fn(),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/GlassSurface", () => ({
  GlassSurface: "GlassSurface",
}));
vi.mock("@/components/ui/Sheet", () => ({ Sheet: "Sheet" }));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: vi.fn(),
}));
vi.mock("@/db/profile-presentation-dao", () => ({
  setContactFreeformLayout: vi.fn(),
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: {} }),
}));

const { ProfileLayoutPreview } = await import("./ProfileLayoutEditor");

interface Node {
  type: string;
  props: Record<string, unknown>;
  children: Node[];
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
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map((entry) => flatStyle(entry)));
  }
  return (style ?? {}) as Record<string, unknown>;
}

function render() {
  return all(resolve(ProfileLayoutPreview({ layout: FACTORY_PROFILE_LAYOUT })));
}

function tiles(nodes: Node[]) {
  return nodes.filter((node) =>
    String(node.props.testID ?? "").startsWith("profile-layout-preview-tile-"),
  );
}

beforeEach(() => {
  measuredWidth = 0;
  windowWidth = 360;
});

describe("ProfileLayoutPreview geometry (RG-033 ui-accessibility/AUD-UIA-021)", () => {
  it("measures its tile container and renders no tiles until measured", () => {
    const nodes = render();
    const container = nodes.find(
      (node) => node.props.testID === "profile-layout-preview-tiles",
    );
    expect(typeof container?.props.onLayout).toBe("function");
    expect(tiles(nodes)).toHaveLength(0);
  });

  it("packs ONE column at 360dp like the real overview and sizes tiles to the preview width", () => {
    measuredWidth = 360 - 2 * SPACING.lg - 4 - 2 * SPACING.base; // 276
    const nodes = render();
    const rendered = tiles(nodes);
    expect(rendered).toHaveLength(6);
    for (const tile of rendered) {
      expect(flatStyle(tile.props.style).width).toBe(measuredWidth);
    }
  });

  it("packs two columns at 411dp with the overview's gap/column formulas", () => {
    windowWidth = 411;
    measuredWidth = 411 - 2 * SPACING.lg - 4 - 2 * SPACING.base; // 327
    const nodes = render();
    const column = overviewColumnWidth(measuredWidth, 2);
    const byId = new Map(
      tiles(nodes).map((tile) => [
        String(tile.props.testID).replace("profile-layout-preview-tile-", ""),
        flatStyle(tile.props.style).width,
      ]),
    );
    // Factory: status 2x1 | gravity 1x1 (orphan → stretched) | intensity 2x1 |
    // last-interaction 2x1 | frequency 1x1 + snooze 1x1.
    expect(byId.get("orbit-status")).toBe(overviewTileWidth(2, column));
    expect(byId.get("gravity")).toBe(overviewTileWidth(2, column));
    expect(byId.get("contact-frequency")).toBe(overviewTileWidth(1, column));
    expect(byId.get("snooze")).toBe(overviewTileWidth(1, column));
    const rows = nodes.filter((node) =>
      String(node.props.testID ?? "").startsWith("profile-layout-preview-row-"),
    );
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(flatStyle(row.props.style).gap).toBe(SPACING.sm);
    }
  });
});

describe("ProfileLayoutEditor source contract", () => {
  const source = readFileSync(
    new URL("./ProfileLayoutEditor.tsx", import.meta.url),
    "utf8",
  );

  it("drops percentage-basis preview sizing", () => {
    expect(source).not.toContain("flexBasis");
  });

  it("themes the layout switch and keeps its accessible name (ui-accessibility/AUD-UIA-003)", () => {
    expect(source).toContain(
      "trackColor={{ false: colors.border, true: colors.accent }}",
    );
    expect(source).toContain("thumbColor={colors.surfaceElevated}");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: asserts literal source text.
    expect(source).toContain("accessibilityLabel={`Show ${definition.label}`}");
  });
});
