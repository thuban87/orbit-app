import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The "Review now" list (38.12 D-121; D-70): the people whose value for one
 * custom field is flagged, each opening Edit Contact at that field; it reloads
 * on focus so fixed people drop off; empty reads "Nothing left to fix".
 *
 * Shallow render: `useState` is a one-slot harness (the screen's review
 * state), `useFocusEffect` captures its callback so the focus reload can be
 * run by hand.
 */

const hooks = vi.hoisted(() => ({
  state: undefined as unknown,
  seeded: false,
  setState: (next: unknown) => {
    hooks.state = next;
  },
  focus: [] as (() => unknown)[],
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: (fn: unknown) => fn,
  useState: (value: unknown) => {
    if (!hooks.seeded) {
      hooks.state = value;
      hooks.seeded = true;
    }
    return [hooks.state, hooks.setState];
  },
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => unknown) => {
    hooks.focus.push(effect);
  },
}));
vi.mock("react-native", () => ({
  FlatList: "FlatList",
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  View: "View",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: {
      surface: "surface",
      border: "border",
      textPrimary: "textPrimary",
      textSecondary: "textSecondary",
    },
  }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  EmptyState: "EmptyState",
}));
vi.mock("@/components/ui/ChromeScrim", () => ({ ChromeScrim: "ChromeScrim" }));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 96,
}));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));
const db = vi.hoisted(() => ({
  listContactsWithUnreadableValues: vi.fn(),
  listDefs: vi.fn(),
}));
vi.mock("@/db/database", () => ({ getExecutor: () => "exec" }));
vi.mock("@/db/field-values-dao", () => ({
  listContactsWithUnreadableValues: db.listContactsWithUnreadableValues,
}));
vi.mock("@/db/field-defs-dao", () => ({ listDefs: db.listDefs }));

const { CustomFieldReviewScreen } = await import("./CustomFieldReviewScreen");

interface Node {
  type: string;
  props: Record<string, unknown>;
  text: string;
  children: Node[];
}

function resolve(node: ReactNode): Node[] {
  if (typeof node === "string" || typeof node === "number") {
    return [{ type: "literal", props: {}, text: String(node), children: [] }];
  }
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function") {
    return resolve(
      (element.type as (props: unknown) => ReactNode)(element.props),
    );
  }
  if (typeof element.type !== "string") return resolve(element.props.children);
  const props = element.props as Record<string, unknown>;
  const extra: Node[] = [];
  // Render a FlatList's rows the way the native list would.
  if (element.type === "FlatList") {
    const data = (props.data as unknown[]) ?? [];
    const renderItem = props.renderItem as (info: {
      item: unknown;
    }) => ReactNode;
    for (const item of data) extra.push(...resolve(renderItem({ item })));
    if (data.length === 0) {
      extra.push(...resolve(props.ListEmptyComponent as ReactNode));
    }
  }
  return [
    {
      type: element.type,
      props,
      text: "",
      children: [...resolve(element.props.children), ...extra],
    },
  ];
}

function all(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

function textOf(node: Node): string {
  return node.type === "literal"
    ? node.text
    : node.children.map(textOf).join("");
}

const navigate = vi.fn();

function render() {
  hooks.focus = [];
  return all(
    resolve(
      CustomFieldReviewScreen({
        navigation: { navigate },
        route: { params: { fieldDefId: 12 } },
      } as never),
    ),
  );
}

const ROWS = [
  { contactId: 3, name: "Amy", photo: null, value: "Gold" },
  { contactId: 5, name: "Zoe", photo: "p.jpg", value: "Brass" },
];

async function focusAndLoad() {
  render();
  for (const effect of hooks.focus) effect();
  await vi.waitFor(() => {
    expect((hooks.state as { status: string }).status).not.toBe("loading");
  });
  return render();
}

beforeEach(() => {
  hooks.seeded = false;
  hooks.state = undefined;
  navigate.mockReset();
  db.listContactsWithUnreadableValues.mockReset();
  db.listDefs.mockReset();
  db.listDefs.mockResolvedValue([{ id: 12, label: "Tier" }]);
});

describe("Review now list (38.12 D-121, D-70)", () => {
  it("lists each flagged person with avatar, name and the stored value, under the field's title", async () => {
    db.listContactsWithUnreadableValues.mockResolvedValue(ROWS);
    const tree = await focusAndLoad();
    expect(db.listContactsWithUnreadableValues).toHaveBeenCalledWith(
      "exec",
      12,
    );
    const header = tree.find((node) => node.type === "ShellAppBar");
    expect(header?.props.variant).toBe("child");
    expect(header?.props.title).toBe("Tier — needs fixing");
    const rows = tree.filter(
      (node) =>
        typeof node.props.testID === "string" &&
        (node.props.testID as string).startsWith("custom-field-review-row-"),
    );
    expect(rows).toHaveLength(2);
    expect(all([rows[0] as Node]).some((n) => n.type === "Avatar")).toBe(true);
    expect(textOf(rows[0] as Node)).toContain("Amy");
    expect(textOf(rows[0] as Node)).toContain("Gold");
    expect(textOf(rows[1] as Node)).toContain("Brass");
  });

  it("a row opens Edit Contact at that field", async () => {
    db.listContactsWithUnreadableValues.mockResolvedValue(ROWS);
    const tree = await focusAndLoad();
    const row = tree.find(
      (node) => node.props.testID === "custom-field-review-row-5",
    );
    (row?.props.onPress as () => void)();
    expect(navigate).toHaveBeenCalledWith("Edit", {
      contactId: 5,
      focusFieldDefId: 12,
    });
  });

  it("reloads on focus, so a fixed person drops off, and an empty list says so", async () => {
    db.listContactsWithUnreadableValues.mockResolvedValueOnce(ROWS);
    await focusAndLoad();
    db.listContactsWithUnreadableValues.mockResolvedValueOnce([]);
    for (const effect of hooks.focus) effect();
    await vi.waitFor(() => {
      expect((hooks.state as { rows?: unknown[] }).rows).toEqual([]);
    });
    const tree = render();
    const empty = tree.find((node) => node.type === "EmptyState");
    expect(empty?.props.heading).toBe("Nothing left to fix");
    expect(
      tree.some(
        (node) =>
          typeof node.props.testID === "string" &&
          (node.props.testID as string).startsWith("custom-field-review-row-"),
      ),
    ).toBe(false);
  });

  it("is registered in the Settings stack and its param list", () => {
    const read = (path: string) =>
      readFileSync(join(__dirname, "..", path), "utf8");
    expect(read("navigation/tabs/SettingsStack.tsx")).toContain(
      'name="CustomFieldReview"',
    );
    expect(read("navigation/types.ts")).toContain(
      "CustomFieldReview: { fieldDefId: number };",
    );
  });
});
