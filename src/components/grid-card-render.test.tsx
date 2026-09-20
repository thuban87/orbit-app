import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { GridCard } from "./GridCard";
import { ListRow } from "./ListRow";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
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

const baseProps = {
  contactId: 7,
  name: "Alex",
  photo: null,
  modifiedAt: "2026-09-20 12:00:00",
  categoryLabel: null,
  lastContact: "2026-09-19 12:00:00",
  snoozeUntil: null,
  status: "stable" as const,
  now: "2026-09-20 12:00:00",
  onPress: vi.fn(),
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
