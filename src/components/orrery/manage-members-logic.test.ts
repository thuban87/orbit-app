import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  applyAdd,
  applyDeselect,
  type DerivedMemberRow,
  deriveMemberRows,
  overrideCounts,
  type SystemMemberRow,
  toPickerRow,
} from "@/components/orrery/manage-members-logic";
import { filterRows } from "@/logic/contact-picker-selection";
import { ManageMembersGrid } from "./ManageMembersGrid";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useState: (value: unknown) => [value, () => {}],
}));
vi.mock("react-native", () => ({
  FlatList: "FlatList",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: {
      accent: "accent",
      accentText: "accentText",
      background: "background",
      border: "border",
      surface: "surface",
      surfaceElevated: "surfaceElevated",
      textPrimary: "textPrimary",
      textSecondary: "textSecondary",
    },
  }),
}));

interface RenderNode {
  type: string;
  props: Record<string, unknown>;
  text: string;
  children: RenderNode[];
}

function resolve(node: ReactNode): RenderNode[] {
  if (typeof node === "string" || typeof node === "number")
    return [{ type: "literal", props: {}, text: String(node), children: [] }];
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function")
    return resolve(
      (element.type as (props: unknown) => ReactNode)(element.props),
    );
  if (typeof element.type !== "string") return resolve(element.props.children);
  return [
    {
      type: element.type,
      props: element.props,
      text: "",
      children: resolve(element.props.children),
    },
  ];
}

function all(nodes: RenderNode[]): RenderNode[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

const rows: SystemMemberRow[] = [
  {
    id: 1,
    name: "Rule match",
    photo: "photos/rule.jpg",
    searchMethods: ["rule@example.com"],
    available: true,
  },
  {
    id: 2,
    name: "Manual active",
    photo: "photos/manual.jpg",
    searchMethods: ["manual@example.com"],
    available: true,
  },
  {
    id: 3,
    name: "Archived include",
    photo: "photos/archived.jpg",
    searchMethods: ["archived@example.com"],
    available: false,
  },
  {
    id: 4,
    name: "Never contacted",
    photo: null,
    searchMethods: ["never@example.com"],
    available: true,
  },
];

describe("Manage Members override logic", () => {
  it("keeps a deselected rule match visible as an exclusion", () => {
    const member = deriveMemberRows([1], [], [], rows)[0];
    expect(member.state).toBe("member");
    expect(applyDeselect(member)).toEqual({ contactId: 1, mode: "exclude" });

    expect(deriveMemberRows([1], [], [1], rows)).toEqual([
      expect.objectContaining({ id: 1, state: "excluded" }),
    ]);
  });

  it("adapts durable local member rows for the picker search helpers", () => {
    const pickerRow = toPickerRow(rows[0]);
    expect(pickerRow).toEqual({
      lookupKey: "1",
      displayName: "Rule match",
      primaryMethod: "rule@example.com",
      searchMethods: ["rule@example.com"],
      photoThumbUri: null,
    });
    expect(filterRows([pickerRow], "RULE MATCH")).toEqual([pickerRow]);
  });

  it("counts manual additions while retaining unavailable archived inclusions", () => {
    const derived = deriveMemberRows([1], [2, 3], [], rows);
    expect(derived.map((row) => [row.id, row.state])).toEqual([
      [1, "member"],
      [2, "added"],
      [3, "archived-added"],
    ]);
    expect(overrideCounts(derived)).toEqual({
      total: 2,
      added: 1,
      excluded: 0,
    });
    expect(applyAdd(rows[1])).toEqual({ contactId: 2, mode: "include" });
    expect(applyDeselect(derived[1])).toEqual({ contactId: 2, mode: null });
  });

  it("keeps an in-union never-contacted candidate and drops stale exclusions", () => {
    const derived = deriveMemberRows([4], [], [2], rows);
    expect(derived).toEqual([
      expect.objectContaining({ id: 4, state: "member" }),
    ]);
  });

  it("renders Excluded and Added cards and emits replacement override deltas", () => {
    const onChange = vi.fn();
    const nodes = all(
      resolve(
        ManageMembersGrid({
          candidateIds: [1],
          includeIds: [2],
          excludeIds: [1],
          rows,
          onChange,
        }),
      ),
    );
    const grid = nodes.find(
      (node) =>
        node.type === "FlatList" &&
        (node.props.numColumns as number | undefined) === 2,
    );
    if (!grid) throw new Error("Missing virtualized member grid");
    const cards = (grid.props.data as DerivedMemberRow[]).flatMap((item) =>
      all(
        resolve(
          (
            grid.props.renderItem as (input: {
              item: DerivedMemberRow;
            }) => ReactNode
          )({ item }),
        ),
      ),
    );
    expect(cards.map((node) => node.text)).toContain("Excluded");
    expect(cards.map((node) => node.text)).toContain("Added");
    expect(nodes.map((node) => node.text).join("")).toContain(
      "1 members · 1 added · 1 excluded",
    );

    const excluded = cards.find(
      (node) => node.props.accessibilityLabel === "Rule match",
    );
    if (!excluded) throw new Error("Missing excluded member card");
    (excluded.props.onPress as () => void)();
    expect(onChange).toHaveBeenCalledWith({ contactId: 1, mode: null });
  });
});
