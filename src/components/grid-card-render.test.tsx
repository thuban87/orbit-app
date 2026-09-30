import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { GridCard } from "./GridCard";
import { gridCardGeometry } from "./grid-card-geometry";
import { ListRow } from "./ListRow";

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
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
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
