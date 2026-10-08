/**
 * History stream render harness (38.8 D-15, D-16, D-32, D-35, D-38..D-46).
 *
 * Function-call render (the activity-heatmap-render idiom): React Native is
 * mocked as string hosts and each function component is called directly, so
 * the tree can be walked in the node environment. It pins what the stream's
 * rows and year controls render and which callbacks they wire.
 */
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  HistoryInteractionRecord,
  HistoryKnowledgeRecord,
  HistoryLifecycleRecord,
} from "@/db/history-read";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { HistoryStream } from "./HistoryStream";
import { HistoryRecordRow } from "./HistoryStreamRows";
import {
  buildStreamModel,
  initialStreamState,
  orderStreamRecords,
  type StreamRecord,
  type StreamSource,
  streamStateOnExpandYear,
} from "./history-stream-logic";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: <T,>(factory: () => T) => factory(),
}));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  FlatList: "FlatList",
  SectionList: "SectionList",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));

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

function all(nodes: Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

/** Every string rendered anywhere under a node. */
function textOf(node: Node): string {
  const own = node.props.children;
  const parts: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string" || typeof value === "number") {
      parts.push(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    }
  };
  collect(own);
  return [...parts, ...node.children.map(textOf)].join(" ");
}

const TODAY = "2026-10-07";

function interaction(
  id: number,
  occurredAt: string,
  extra: Partial<HistoryInteractionRecord> = {},
): HistoryInteractionRecord {
  return {
    id,
    occurredAt,
    date: occurredAt.slice(0, 10),
    channel: "Call",
    direction: "outbound",
    connected: 1,
    quality: "Great",
    note: "A long note that should wrap onto at most two lines in the row.",
    duration: 30,
    allowAi: 1,
    groupEventId: null,
    groupTitle: null,
    groupNote: null,
    groupLinked: false,
    ...extra,
  };
}

const LIFECYCLE: HistoryLifecycleRecord = {
  id: 3,
  occurredAt: "2026-10-05 08:00:00",
  date: "2026-10-05",
  type: "snooze",
  detail: "until Oct 20",
};

const KNOWLEDGE: HistoryKnowledgeRecord = {
  id: 4,
  fieldKey: "current_location",
  date: "2026-10-04",
  createdAt: "2026-10-04 08:00:00",
  value: "Lisbon",
  isCurrent: 1,
};

function source(parts: Partial<StreamSource>): StreamSource {
  return {
    interactions: [],
    lifecycleEvents: [],
    knowledgeChanges: [],
    ...parts,
  };
}

function recordOf(parts: Partial<StreamSource>): StreamRecord {
  const [record] = orderStreamRecords(source(parts));
  return record;
}

function renderRow(item: StreamRecord) {
  const onOpenInteraction = vi.fn();
  const onOpenKnowledgeChange = vi.fn();
  const tree = resolve(
    HistoryRecordRow({ item, onOpenInteraction, onOpenKnowledgeChange }),
  );
  return { tree, onOpenInteraction, onOpenKnowledgeChange };
}

describe("HistoryRecordRow", () => {
  it("renders an interaction as one Pressable opening InteractionDetail", () => {
    const { tree, onOpenInteraction } = renderRow(
      recordOf({ interactions: [interaction(7, "2026-10-06 14:05:00")] }),
    );
    expect(tree).toHaveLength(1);
    const [root] = tree;
    expect(root.type).toBe("Pressable");
    expect(root.props.onLongPress).toBeUndefined();
    (root.props.onPress as () => void)();
    expect(onOpenInteraction).toHaveBeenCalledWith(7);
    expect(all(tree).filter((n) => n.type === "Pressable")).toHaveLength(1);
    expect(root.props.accessibilityLabel).toBe("Interaction, Call, 2:05 PM");
  });

  it("shows the note on at most two lines, the title-cased direction and no duration or sparkle", () => {
    const { tree } = renderRow(
      recordOf({ interactions: [interaction(7, "2026-10-06 14:05:00")] }),
    );
    const nodes = all(tree);
    const note = nodes.find(
      (n) => n.type === "AppText" && textOf(n).startsWith("A long note"),
    );
    expect(note?.props.numberOfLines).toBe(2);
    const text = textOf(tree[0]);
    expect(text).toContain("Outbound · Great");
    expect(text).not.toContain("outbound");
    expect(text).not.toMatch(/\b30\b|min/);
    expect(
      nodes.some((n) => n.type === "Icon" && n.props.name === "sparkle"),
    ).toBe(false);
  });

  it("shows No reply for an unconnected interaction", () => {
    const { tree } = renderRow(
      recordOf({
        interactions: [
          interaction(7, "2026-10-06 14:05:00", {
            connected: 0,
            quality: null,
          }),
        ],
      }),
    );
    expect(textOf(tree[0])).toContain("Outbound · No reply");
  });

  it("shows the group-event label inside the same Pressable for a group-linked child", () => {
    const { tree, onOpenInteraction } = renderRow(
      recordOf({
        interactions: [
          interaction(8, "2026-10-06 19:30:00", {
            groupEventId: 2,
            groupTitle: "Synthetic group dinner",
            groupLinked: true,
          }),
        ],
      }),
    );
    const [root] = tree;
    expect(root.type).toBe("Pressable");
    expect(all(tree).filter((n) => n.type === "Pressable")).toHaveLength(1);
    expect(textOf(root)).toContain("Synthetic group dinner");
    expect(root.props.accessibilityLabel).toBe(
      "Interaction, Call, 7:30 PM, group event Synthetic group dinner",
    );
    (root.props.onPress as () => void)();
    expect(onOpenInteraction).toHaveBeenCalledWith(8);
  });

  it("renders no group label for a standalone interaction", () => {
    const { tree } = renderRow(
      recordOf({ interactions: [interaction(9, "2026-10-06 19:30:00")] }),
    );
    expect(
      all(tree).some((n) => String(n.props.testID ?? "").endsWith("-group")),
    ).toBe(false);
  });

  it("renders a lifecycle event as a muted, non-pressable View", () => {
    const { tree } = renderRow(recordOf({ lifecycleEvents: [LIFECYCLE] }));
    const [root] = tree;
    expect(root.type).toBe("View");
    expect(root.props.onPress).toBeUndefined();
    expect(all(tree).some((n) => n.type === "Pressable")).toBe(false);
    expect(textOf(root)).toContain("Snoozed");
    expect(textOf(root)).toContain("until Oct 20");
    const icon = all(tree).find((n) => n.type === "Icon");
    expect(icon?.props.tone).toBe("textSecondary");
    expect(root.props.accessibilityLabel).toBe("Snoozed, 8:00 AM");
  });

  it("opens the knowledge field's history from a knowledge row", () => {
    const { tree, onOpenKnowledgeChange } = renderRow(
      recordOf({ knowledgeChanges: [KNOWLEDGE] }),
    );
    const [root] = tree;
    expect(root.type).toBe("Pressable");
    (root.props.onPress as () => void)();
    expect(onOpenKnowledgeChange).toHaveBeenCalledWith("current_location");
    const icon = all(tree).find((n) => n.type === "Icon");
    expect(icon?.props.name).toBe("edit");
    const value = all(tree).find(
      (n) => n.type === "AppText" && textOf(n) === "Lisbon",
    );
    expect(value?.props.numberOfLines).toBe(1);
  });
});

function renderStream(
  parts: Partial<StreamSource>,
  state = initialStreamState(),
) {
  const model = buildStreamModel(source(parts), TODAY);
  const handlers = {
    onExpandYear: vi.fn(),
    onShowOlder: vi.fn(),
    onOpenInteraction: vi.fn(),
    onOpenKnowledgeChange: vi.fn(),
    registerNode: vi.fn(),
    onNodeLayout: vi.fn(),
  };
  const tree = resolve(HistoryStream({ model, state, ...handlers }));
  return { tree, nodes: all(tree), handlers, model };
}

function byTestID(nodes: Node[], testID: string): Node | undefined {
  return nodes.find((n) => n.props.testID === testID);
}

/** `count` interactions, one per day back from Oct 7 2026. */
function manyInteractions(count: number): HistoryInteractionRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(2026, 9, 7 - i);
    const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    return interaction(i + 1, `${ymd} 10:00:00`);
  });
}

describe("HistoryStream", () => {
  it("renders the current year with month and day groups", () => {
    const { nodes } = renderStream({
      interactions: [
        interaction(1, "2026-10-07 09:00:00"),
        interaction(2, "2026-10-02 09:00:00"),
      ],
      lifecycleEvents: [LIFECYCLE],
    });
    expect(byTestID(nodes, "history-stream-year-2026")).toBeDefined();
    expect(byTestID(nodes, "history-stream-month-2026-10")).toBeDefined();
    const today = byTestID(nodes, "history-stream-day-2026-10-07");
    expect(today).toBeDefined();
    const label = all([today as Node]).find(
      (n) => n.type === "AppText" && textOf(n) === "Today",
    );
    expect(label?.props.accessibilityLabel).toBe(
      "Today, Wednesday, October 7, 2026",
    );
    expect(byTestID(nodes, "history-stream-day-2026-10-02")).toBeDefined();
  });

  it("renders a collapsed older year as one pressable row that expands it", () => {
    const { nodes, handlers } = renderStream({
      interactions: [
        interaction(1, "2026-10-01 09:00:00"),
        interaction(2, "2025-06-01 09:00:00"),
        interaction(3, "2025-05-01 09:00:00"),
      ],
    });
    const row = byTestID(nodes, "history-stream-year-row-2025");
    expect(row?.type).toBe("Pressable");
    expect(row?.props.accessibilityRole).toBe("button");
    expect(row?.props.accessibilityState).toEqual({ expanded: false });
    expect(row?.props.accessibilityLabel).toBe("2025 · 2 interactions");
    expect(textOf(row as Node)).toContain("2025");
    expect(textOf(row as Node)).toContain("2 interactions");
    ((row as Node).props.onPress as () => void)();
    expect(handlers.onExpandYear).toHaveBeenCalledWith(2025);
    // Its records are not rendered while collapsed.
    expect(byTestID(nodes, "history-stream-day-2025-06-01")).toBeUndefined();
  });

  it("gives a lifecycle/knowledge-only older year a row with 0 interactions", () => {
    const { nodes } = renderStream({
      interactions: [interaction(1, "2026-10-01 09:00:00")],
      knowledgeChanges: [
        { ...KNOWLEDGE, date: "2023-04-04", createdAt: "2023-04-04 08:00:00" },
      ],
    });
    const row = byTestID(nodes, "history-stream-year-row-2023");
    expect(row?.props.accessibilityLabel).toBe("2023 · 0 interactions");
  });

  it("renders an expanded older year's records", () => {
    const state = streamStateOnExpandYear(initialStreamState(), 2025);
    const { nodes } = renderStream(
      { interactions: [interaction(2, "2025-06-01 09:00:00")] },
      state,
    );
    expect(byTestID(nodes, "history-stream-year-row-2025")).toBeUndefined();
    expect(byTestID(nodes, "history-stream-day-2025-06-01")).toBeDefined();
  });

  it("shows the empty current year above the collapsed older years (D-36)", () => {
    const { nodes } = renderStream({
      interactions: [interaction(2, "2025-06-01 09:00:00")],
    });
    const year = byTestID(nodes, "history-stream-year-2026");
    expect(textOf(year as Node)).toContain("Nothing logged in 2026 yet");
    const ids = nodes.map((n) => n.props.testID).filter(Boolean);
    expect(ids.indexOf("history-stream-year-2026")).toBeLessThan(
      ids.indexOf("history-stream-year-row-2025"),
    );
  });

  it("renders Show older only while the open year has older records", () => {
    const long = renderStream({ interactions: manyInteractions(25) });
    const more = byTestID(long.nodes, "history-stream-show-older-2026");
    expect(more?.type).toBe("Button");
    expect(more?.props.label).toBe("Show older");
    expect(more?.props.accessibilityLabel).toBe("Show older records from 2026");
    ((more as Node).props.onPress as () => void)();
    expect(long.handlers.onShowOlder).toHaveBeenCalledWith(2026);

    const short = renderStream({ interactions: manyInteractions(12) });
    expect(
      byTestID(short.nodes, "history-stream-show-older-2026"),
    ).toBeUndefined();
  });

  it("registers each day group as a measurable jump target and reports its layout (D-19)", () => {
    const { nodes, handlers } = renderStream({
      interactions: [interaction(1, "2026-10-02 09:00:00")],
    });
    const day = byTestID(nodes, "history-stream-day-2026-10-02") as Node;
    expect(day.props.collapsable).toBe(false);
    const node = { native: true };
    (day.props.ref as (n: unknown) => void)(node);
    expect(handlers.registerNode).toHaveBeenCalledWith("day:2026-10-02", node);
    (day.props.ref as (n: unknown) => void)(null);
    expect(handlers.registerNode).toHaveBeenLastCalledWith(
      "day:2026-10-02",
      null,
    );
    (day.props.onLayout as () => void)();
    expect(handlers.onNodeLayout).toHaveBeenCalledWith("day:2026-10-02");
  });

  it("renders no nested scroll container anywhere", () => {
    const { nodes } = renderStream({
      interactions: manyInteractions(25),
      lifecycleEvents: [LIFECYCLE],
      knowledgeChanges: [KNOWLEDGE],
    });
    expect(
      nodes.some((n) =>
        ["ScrollView", "FlatList", "SectionList"].includes(n.type),
      ),
    ).toBe(false);
  });
});
