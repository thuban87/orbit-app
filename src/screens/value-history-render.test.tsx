import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Value history (38.12 D-106): a custom field's "View history" opens a
 * read-only list of that field's past values for this person, newest first,
 * with dates (38.9 D-48), under the shared child header.
 *
 * A function-call render with a mocked React: `useState` slots are seeded by
 * call order and every setter is a spy; `useFocusEffect` runs its callback
 * when asked, so the read can be observed.
 */

/** ValueHistoryScreen's `useState` call order. */
const SLOT = { history: 0, loading: 1, failed: 2 } as const;

const hooks = vi.hoisted(() => ({
  index: 0,
  runFocus: false,
  seed: new Map<number, unknown>(),
  setters: [] as ReturnType<typeof vi.fn>[],
}));
const reads = vi.hoisted(() => ({ readValueHistory: vi.fn() }));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useState: (value: unknown) => {
    const slot = hooks.index++;
    const initial =
      typeof value === "function" ? (value as () => unknown)() : value;
    if (!hooks.setters[slot]) hooks.setters[slot] = vi.fn();
    return [
      hooks.seed.has(slot) ? hooks.seed.get(slot) : initial,
      hooks.setters[slot],
    ];
  },
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => unknown) => {
    if (hooks.runFocus) effect();
  },
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  FlatList: "FlatList",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  View: "View",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  EmptyState: "EmptyState",
}));
vi.mock("@/components/ui/ChromeScrim", () => ({ ChromeScrim: "ChromeScrim" }));
vi.mock("@/db/database", () => ({ getExecutor: () => "exec" }));
vi.mock("@/db/value-history-dao", () => ({
  readValueHistory: reads.readValueHistory,
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 120,
}));

const { ValueHistoryScreen } = await import("./ValueHistoryScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [
    element,
    ...nodes(element.props.children as ReactNode),
    ...nodes(element.props.ListEmptyComponent as ReactNode),
  ];
}
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("expected node not rendered");
  return value;
}
function texts(node: ReactNode): string[] {
  return nodes(node)
    .filter((element) => element.type === "AppText")
    .map((element) => {
      const children = element.props.children;
      const parts = Array.isArray(children) ? children : [children];
      return parts.map((part) => String(part ?? "")).join("");
    });
}

const CONTACT = 7;
const FIELD = 22;
const entry = (id: number, value: string | null, created_at: string) => ({
  id,
  uid: `h-${id}`,
  contact_id: CONTACT,
  field_def_id: FIELD,
  value,
  created_at,
});
const THREE = {
  field: { label: "Nickname", type: "text" as const },
  entries: [
    entry(3, "Sandy", "2026-09-04 12:04:00"),
    entry(2, "Lex", "2026-09-03 09:30:00"),
    entry(1, "Al", "2026-08-01 18:05:00"),
  ],
};

function render(seed: Partial<Record<keyof typeof SLOT, unknown>> = {}) {
  hooks.index = 0;
  hooks.seed = new Map(
    Object.entries(seed).map(([key, value]) => [
      SLOT[key as keyof typeof SLOT],
      value,
    ]),
  );
  const navigation = { goBack: vi.fn(), navigate: vi.fn() };
  const tree = ValueHistoryScreen({
    navigation,
    route: {
      key: "ValueHistory-1",
      name: "ValueHistory",
      params: { contactId: CONTACT, fieldDefId: FIELD },
    },
  } as never);
  return { tree, navigation };
}

beforeEach(() => {
  hooks.runFocus = false;
  hooks.setters = [];
  reads.readValueHistory.mockReset();
});

describe("ValueHistoryScreen (38.12 D-106)", () => {
  it("reads this person's history for the field on focus and publishes it", async () => {
    reads.readValueHistory.mockResolvedValue(THREE);
    hooks.runFocus = true;
    render();
    await vi.waitFor(() =>
      expect(hooks.setters[SLOT.history]).toHaveBeenCalledWith(THREE),
    );
    expect(reads.readValueHistory).toHaveBeenCalledWith("exec", CONTACT, FIELD);
    expect(hooks.setters[SLOT.failed]).toHaveBeenCalledWith(false);
    expect(hooks.setters[SLOT.loading]).toHaveBeenLastCalledWith(false);
  });

  it("lists three past values newest first, each with its date, read-only", () => {
    const { tree } = render({ history: THREE, loading: false });
    const list = must(nodes(tree).find((node) => node.type === "FlatList"));
    const data = list.props.data as typeof THREE.entries;
    expect(data.map((row) => row.value)).toEqual(["Sandy", "Lex", "Al"]);
    const renderItem = list.props.renderItem as (input: {
      item: (typeof THREE.entries)[number];
    }) => ReactNode;
    const rows = data.map((item) => texts(renderItem({ item })));
    expect(rows[0][0]).toBe("Sandy");
    expect(rows[0][1]).toMatch(/^Replaced Sep 4/);
    expect(rows[1][1]).toMatch(/^Replaced Sep 3/);
    expect(rows[2][1]).toMatch(/^Replaced Aug 1/);
    // Read-only: no row is pressable, there is no edit or delete action.
    const all = data.flatMap((item) => nodes(renderItem({ item })));
    expect(all.some((node) => node.props.onPress !== undefined)).toBe(false);
    expect(list.props.contentContainerStyle).toEqual(
      expect.arrayContaining([{ paddingBottom: 120 }]),
    );
  });

  it("shows an empty past value as Not set", () => {
    const { tree } = render({
      history: {
        field: { label: "Nickname", type: "text" },
        entries: [entry(1, null, "2026-09-04 12:04:00")],
      },
      loading: false,
    });
    const list = must(nodes(tree).find((node) => node.type === "FlatList"));
    const renderItem = list.props.renderItem as (input: {
      item: unknown;
    }) => ReactNode;
    expect(
      texts(renderItem({ item: (list.props.data as unknown[])[0] }))[0],
    ).toBe("Not set");
  });

  it("titles the shared child header with the field's name", () => {
    const { tree } = render({ history: THREE, loading: false });
    const header = must(
      nodes(tree).find((node) => node.type === "ShellAppBar"),
    );
    expect(header.props.variant).toBe("child");
    expect(header.props.title).toBe("Nickname");
  });

  it("shows No earlier values when the field has no history", () => {
    const { tree } = render({
      history: { field: THREE.field, entries: [] },
      loading: false,
    });
    const empty = must(
      nodes(tree).find(
        (node) =>
          node.type === "EmptyState" &&
          node.props.testID === "value-history-empty",
      ),
    );
    expect(empty.props.heading).toBe("No earlier values");
    expect(empty.props.action).toBeUndefined();
  });

  it("shows a failed read with Retry, which reads again", async () => {
    reads.readValueHistory.mockResolvedValue(THREE);
    const { tree } = render({ history: null, loading: false, failed: true });
    const failed = must(
      nodes(tree).find(
        (node) =>
          node.type === "EmptyState" &&
          node.props.testID === "value-history-failed",
      ),
    );
    const action = failed.props.action as { label: string; onPress(): void };
    expect(action.label).toBe("Retry");
    action.onPress();
    await vi.waitFor(() =>
      expect(reads.readValueHistory).toHaveBeenCalledWith(
        "exec",
        CONTACT,
        FIELD,
      ),
    );
  });

  it("shows a spinner while the first read runs", () => {
    const { tree } = render({ history: null, loading: true });
    expect(nodes(tree).some((node) => node.type === "ActivityIndicator")).toBe(
      true,
    );
  });
});
