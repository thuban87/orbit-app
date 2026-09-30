import type { ReactElement, ReactNode } from "react";
import { View } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { GridCard } from "./GridCard";
import {
  GRID_CARD_BORDER,
  GRID_CARD_PADDING,
  GRID_CORNER_HIT,
  GRID_CORNER_INSET,
  GRID_CORNER_OPTICAL_OFFSET,
  gridCardGeometry,
} from "./grid-card-geometry";
import { LIST_AVATAR_SIZE, LIST_ROW_PADDING, ListRow } from "./ListRow";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
}));
// ListRow's swipe-aware tint (D-48) imports Reanimated; these cases render no tint.
vi.mock("react-native-reanimated", () => ({
  default: { View: "AnimatedView" },
  useAnimatedStyle: (fn: () => unknown) => fn(),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/contact-card-ring", () => ({
  ringVisual: () => ({ color: "ring", opacity: 1, width: 1 }),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/icons/StatusGlyph", () => ({
  StatusGlyph: "StatusGlyph",
}));
vi.mock("@/components/ui/GlassSurface", () => ({
  GlassSurface: "GlassSurface",
}));
// GlassSurface itself renders unmocked in the contentStyle cases below (D-09).
vi.mock("expo-blur", () => ({ BlurView: "BlurView" }));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: THEME_PRESETS.galaxy.dark,
    mode: "dark",
    package: "galaxy",
  }),
  useUnscopedTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
  GlassForegroundScope: ({ children }: { children?: ReactNode }) => children,
}));
// The List row's backing is table-driven (38.5-06); no treatment = today's row.
vi.mock("@/theme/use-art-treatment", () => ({ useArtTreatment: () => null }));

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

const baseProps = {
  contactId: 7,
  name: "Alex",
  photo: null,
  categoryLabel: null,
  lastContact: "2026-09-19 12:00:00",
  snoozeUntil: null,
  status: "stable" as const,
  now: "2026-09-20 12:00:00",
  onPress: vi.fn(),
  geometry: gridCardGeometry(393, 3),
};

describe("GridCard line-three presentation", () => {
  it("omits the routine line three in normal Grid mode", () => {
    const nodes = all(
      resolve(
        GridCard({
          ...baseProps,
          line3: { text: "Routine profile excerpt" },
        }),
      ),
    );

    expect(
      nodes.find((node) => node.props.testID === "dashboard-grid-card-line3-7"),
    ).toBeUndefined();
    expect(
      nodes.find(
        (node) => node.props.testID === "dashboard-grid-card-recency-7",
      ),
    ).toBeDefined();
  });

  it("keeps the distinct search explanation and snippet in Grid mode", () => {
    const nodes = all(
      resolve(
        GridCard({
          ...baseProps,
          searchResult: {
            contactId: 7,
            score: 1,
            totalMatchCount: 1,
            matches: [
              {
                sourceKind: "memory-or-custom-field",
                fieldLabel: "Memory",
                snippet: "Met at the climbing gym",
                highlights: [{ start: 11, length: 8 }],
                priority: 1,
              },
            ],
          },
        }),
      ),
    );

    expect(
      nodes.find(
        (node) =>
          node.props.testID === "dashboard-grid-card-match-explanation-7",
      ),
    ).toBeDefined();
    expect(
      nodes.find(
        (node) => node.props.testID === "dashboard-grid-card-search-snippet-7",
      ),
    ).toBeDefined();
  });

  it("retains the routine line three in normal List mode", () => {
    const nodes = all(
      resolve(
        ListRow({
          ...baseProps,
          line3: { text: "Routine profile excerpt" },
        }),
      ),
    );

    expect(
      nodes.find((node) => node.props.testID === "dashboard-list-row-line3-7"),
    ).toBeDefined();
  });
});

describe("row accessible context (RG-031 ui-accessibility/AUD-UIA-007)", () => {
  const searchResult = {
    contactId: 7,
    score: 1,
    totalMatchCount: 1,
    matches: [
      {
        sourceKind: "memory-or-custom-field" as const,
        fieldLabel: "Memory",
        snippet: "Met at the climbing gym",
        highlights: [{ start: 11, length: 8 }],
        priority: 1,
      },
    ],
  };
  const summary = "Alex. No category. Yesterday. Not favourite. Stable.";

  function rootLabel(nodes: readonly Node[]): unknown {
    return nodes[0]?.props.accessibilityLabel;
  }

  it("List row announces the rendered search explanation and snippet after identity", () => {
    const nodes = resolve(ListRow({ ...baseProps, searchResult }));
    expect(rootLabel(nodes)).toBe(
      `${summary} 1 match · Memory · "Met at the climbing gym".`,
    );
  });

  it("List row announces the rendered adaptive line three outside search", () => {
    const nodes = resolve(
      ListRow({ ...baseProps, line3: { text: "Birthday in 3 days" } }),
    );
    expect(rootLabel(nodes)).toBe(`${summary} Birthday in 3 days.`);
  });

  it("List row with no search result and no line three announces only identity", () => {
    expect(rootLabel(resolve(ListRow(baseProps)))).toBe(summary);
    expect(
      rootLabel(resolve(ListRow({ ...baseProps, line3: { text: "" } }))),
    ).toBe(summary);
  });

  it("List row name/fuel fallback announces the displayed fallback snippet", () => {
    const nodes = resolve(
      ListRow({
        ...baseProps,
        searchResult: null,
        searchSnippet: "Loves bouldering",
      }),
    );
    expect(rootLabel(nodes)).toBe(`${summary} 1 match · "Loves bouldering".`);
  });

  it("Grid card announces the rendered search context", () => {
    const nodes = resolve(GridCard({ ...baseProps, searchResult }));
    expect(rootLabel(nodes)).toBe(
      `${summary} 1 match · Memory · "Met at the climbing gym".`,
    );
  });

  it("Grid selection state still follows the context-bearing description", () => {
    const nodes = resolve(
      GridCard({
        ...baseProps,
        searchResult,
        selectionMode: true,
        selected: true,
      }),
    );
    expect(rootLabel(nodes)).toBe(
      `${summary} 1 match · Memory · "Met at the climbing gym". Selected.`,
    );
  });

  it("normal Grid does not announce the List-only line three (38.1)", () => {
    const nodes = resolve(
      GridCard({ ...baseProps, line3: { text: "Routine profile excerpt" } }),
    );
    expect(rootLabel(nodes)).toBe(summary);
  });
});

describe("Card-view status ring is a circle (D-73a, supersedes D-70)", () => {
  function flatten(style: unknown): Record<string, unknown> {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.map(flatten));
    }
    return (style ?? {}) as Record<string, unknown>;
  }

  it("sizes the ring's box to the avatar, square and centred, so the ring cannot stretch into a pill", () => {
    const nodes = all(resolve(GridCard(baseProps)));
    const area = nodes.find((node) =>
      node.children.some(
        (child) => child.props.testID === "dashboard-grid-card-ring-7",
      ),
    );
    expect(area).toBeDefined();
    const areaStyle = flatten(area?.props.style);
    // A box that stretches to the card width turns the full-radius ring into a
    // wide pill (D-70 / owner checklist row 10). It must hug the avatar.
    expect(areaStyle.alignSelf).toBe("center");
    expect(typeof areaStyle.width).toBe("number");
    expect(areaStyle.width).toBe(areaStyle.height);
    const avatar = area?.children.find((child) => child.type === "Avatar");
    expect(areaStyle.width).toBeGreaterThan(avatar?.props.size as number);

    const ring = nodes.find(
      (node) => node.props.testID === "dashboard-grid-card-ring-7",
    );
    const ringStyle = flatten(ring?.props.style);
    expect(ringStyle.position).toBe("absolute");
    expect(ringStyle.borderRadius).toBeGreaterThanOrEqual(
      (areaStyle.width as number) / 2,
    );
  });

  it("sizes the photo and its ring box from the card geometry (D-06)", () => {
    const geometry = gridCardGeometry(393, 2);
    const nodes = all(resolve(GridCard({ ...baseProps, geometry })));
    const area = nodes.find((node) =>
      node.children.some(
        (child) => child.props.testID === "dashboard-grid-card-ring-7",
      ),
    );
    const areaStyle = flatten(area?.props.style);
    expect(areaStyle.width).toBe(geometry.ringBox);
    expect(areaStyle.height).toBe(geometry.ringBox);
    const avatar = nodes.find((node) => node.type === "Avatar");
    expect(avatar?.props.size).toBe(geometry.avatarSize);
    expect(avatar?.props.size).toBe(96);
  });
});

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle));
  }
  return (style ?? {}) as Record<string, unknown>;
}

describe("Grid card corners, names and row height (D-07, D-08, D-09)", () => {
  const searchResult = {
    contactId: 7,
    score: 1,
    totalMatchCount: 1,
    matches: [
      {
        sourceKind: "memory-or-custom-field" as const,
        fieldLabel: "Memory",
        snippet: "Met at the climbing gym",
        highlights: [{ start: 11, length: 8 }],
        priority: 1,
      },
    ],
  };
  const cornerPadding =
    GRID_CORNER_INSET - GRID_CARD_BORDER + GRID_CORNER_OPTICAL_OFFSET;

  function byTestId(nodes: readonly Node[], testID: string): Node | undefined {
    return nodes.find((node) => node.props.testID === testID);
  }

  function surfaceChildren(nodes: readonly Node[]): readonly Node[] {
    const surface = nodes.find((node) => node.type === "GlassSurface");
    return surface?.children ?? [];
  }

  function expectCorner(node: Node | undefined, side: "left" | "right") {
    expect(node).toBeDefined();
    const style = flattenStyle(node?.props.style);
    expect(style.position).toBe("absolute");
    expect(style.top).toBe(0);
    expect(style[side]).toBe(0);
    expect(style.width).toBe(GRID_CORNER_HIT);
    expect(style.height).toBe(GRID_CORNER_HIT);
    expect(GRID_CORNER_HIT).toBeGreaterThanOrEqual(48);
    expect(style.justifyContent).toBe("flex-start");
    expect(style.alignItems).toBe(side === "right" ? "flex-end" : "flex-start");
    expect(style.paddingTop).toBe(cornerPadding);
    expect(side === "right" ? style.paddingRight : style.paddingLeft).toBe(
      cornerPadding,
    );
    expect(style.zIndex).toBeGreaterThanOrEqual(1);
  }

  it("pins the favourite star to the top-right corner with a 48x48 hit area (normal mode)", () => {
    const nodes = all(resolve(GridCard(baseProps)));
    const star = byTestId(nodes, "dashboard-grid-card-favourite-7");
    expectCorner(star, "right");
    expect(star?.type).toBe("Pressable");
    expect(star?.props.hitSlop).toBe(8);
    // A direct child of the GlassSurface content, above the photo layout.
    expect(surfaceChildren(nodes)).toContain(star);
  });

  it("pins the star and the checkbox to their corners in selection mode", () => {
    const nodes = all(
      resolve(GridCard({ ...baseProps, selectionMode: true, selected: true })),
    );
    const star = byTestId(nodes, "dashboard-grid-card-favourite-7");
    expectCorner(star, "right");
    expect(star?.type).toBe("View");
    const checkbox = byTestId(nodes, "dashboard-grid-card-select-7");
    expectCorner(checkbox, "left");
    expect(checkbox?.props.hitSlop).toBe(8);
    expect(surfaceChildren(nodes)).toContain(checkbox);
  });

  it("places the ring box geometry.avatarTop below the card's outer top edge", () => {
    for (const geometry of [
      gridCardGeometry(393, 3),
      gridCardGeometry(393, 2),
    ]) {
      const nodes = all(resolve(GridCard({ ...baseProps, geometry })));
      const area = nodes.find((node) =>
        node.children.some(
          (child) => child.props.testID === "dashboard-grid-card-ring-7",
        ),
      );
      const areaStyle = flattenStyle(area?.props.style);
      expect(areaStyle.marginTop).toBe(geometry.avatarTop - GRID_CARD_BORDER);
      expect(areaStyle.marginTop as number).toBeGreaterThanOrEqual(0);
      expect(areaStyle.alignSelf).toBe("center");
      const layout = nodes.find((node) => node.children.includes(area as Node));
      const layoutStyle = flattenStyle(layout?.props.style);
      expect(layoutStyle.paddingTop ?? 0).toBe(0);
      expect(layoutStyle.paddingHorizontal).toBe(GRID_CARD_PADDING);
      expect(layoutStyle.paddingBottom).toBe(GRID_CARD_PADDING);
      expect(layoutStyle.flexGrow).toBe(1);
      expect(layoutStyle.padding).toBeUndefined();
    }
  });

  it("wraps the name greedily to two lines; secondary lines stay one line", () => {
    const nodes = all(resolve(GridCard(baseProps)));
    const nameNode = byTestId(nodes, "dashboard-grid-card-name-7");
    expect(nameNode?.props.numberOfLines).toBe(2);
    expect(nameNode?.props.ellipsizeMode).toBe("tail");
    expect(nameNode?.props.textBreakStrategy).toBe("simple");
    expect(
      byTestId(nodes, "dashboard-grid-card-recency-7")?.props.numberOfLines,
    ).toBe(1);

    const search = all(resolve(GridCard({ ...baseProps, searchResult })));
    for (const id of [
      "dashboard-grid-card-match-explanation-7",
      "dashboard-grid-card-search-snippet-7",
    ]) {
      expect(byTestId(search, id)?.props.numberOfLines).toBe(1);
    }
  });

  it("stretches the card to the row and pins the secondary block to the bottom", () => {
    const nodes = all(resolve(GridCard(baseProps)));
    const surface = nodes.find((node) => node.type === "GlassSurface");
    const surfaceStyle = flattenStyle(surface?.props.style);
    expect(surfaceStyle.flexGrow).toBe(1);
    expect(surfaceStyle.padding).toBe(0);
    expect(flattenStyle(surface?.props.contentStyle).flexGrow).toBe(1);

    const recency = byTestId(nodes, "dashboard-grid-card-recency-7");
    const secondary = nodes.find((node) =>
      node.children.includes(recency as Node),
    );
    expect(secondary?.type).toBe("View");
    expect(flattenStyle(secondary?.props.style).marginTop).toBe("auto");

    const search = all(resolve(GridCard({ ...baseProps, searchResult })));
    const explanation = byTestId(
      search,
      "dashboard-grid-card-match-explanation-7",
    );
    const snippet = byTestId(search, "dashboard-grid-card-search-snippet-7");
    const searchSecondary = search.find(
      (node) =>
        node.children.includes(explanation as Node) &&
        node.children.includes(snippet as Node),
    );
    expect(flattenStyle(searchSecondary?.props.style).marginTop).toBe("auto");
  });
});

describe("GlassSurface contentStyle (D-09; other consumers unchanged)", () => {
  async function realGlassSurface() {
    const actual = await vi.importActual<
      typeof import("@/components/ui/GlassSurface")
    >("@/components/ui/GlassSurface");
    return actual.GlassSurface;
  }

  function contentWrapper(nodes: readonly Node[]): Node | undefined {
    const container = nodes[0];
    return container?.children.find((child) =>
      all([child]).some((node) => node.props.testID === "payload"),
    );
  }

  it("renders the default content wrapper exactly as before", async () => {
    const GlassSurface = await realGlassSurface();
    const nodes = resolve(
      GlassSurface({ children: <View testID="payload" /> }),
    );
    const wrapper = contentWrapper(nodes);
    expect(wrapper?.type).toBe("View");
    expect(flattenStyle(wrapper?.props.style)).toEqual({
      position: "relative",
    });
  });

  it("applies contentStyle after the default wrapper style", async () => {
    const GlassSurface = await realGlassSurface();
    const nodes = resolve(
      GlassSurface({
        children: <View testID="payload" />,
        contentStyle: { flexGrow: 1 },
      }),
    );
    expect(flattenStyle(contentWrapper(nodes)?.props.style)).toEqual({
      position: "relative",
      flexGrow: 1,
    });
  });
});

describe("List row photos are 72 (D-05)", () => {
  it("renders the Avatar at LIST_AVATAR_SIZE and grows the row to fit", () => {
    expect(LIST_AVATAR_SIZE).toBe(72);
    expect(LIST_ROW_PADDING).toBe(12);
    const nodes = all(resolve(ListRow(baseProps)));
    const avatar = nodes.find((node) => node.type === "Avatar");
    expect(avatar?.props.size).toBe(LIST_AVATAR_SIZE);
    const row = nodes.find(
      (node) => node.props.testID === "dashboard-list-row-7",
    );
    const rowStyle = flattenStyle(row?.props.style);
    expect(rowStyle.minHeight).toBe(LIST_AVATAR_SIZE + 2 * LIST_ROW_PADDING);
    expect(rowStyle.padding).toBe(LIST_ROW_PADDING);
  });

  it("keeps the name, meta and line three rendering", () => {
    const nodes = all(
      resolve(ListRow({ ...baseProps, line3: { text: "Birthday in 3 days" } })),
    );
    const nameNode = nodes.find(
      (node) => node.props.testID === "dashboard-list-row-name-7",
    );
    expect(nameNode?.props.numberOfLines).toBe(1);
    expect(nameNode?.props.children).toBe("Alex");
    expect(
      nodes.find((node) => node.props.testID === "dashboard-list-row-meta-7"),
    ).toBeDefined();
    expect(
      nodes.find((node) => node.props.testID === "dashboard-list-row-line3-7"),
    ).toBeDefined();
  });
});
