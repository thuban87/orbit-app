import { describe, expect, it, vi } from "vitest";

const reactMocks = vi.hoisted(() => ({
  effects: [] as Array<() => void>,
  query: "",
  setQuery: vi.fn(),
}));

vi.mock("react", () => ({
  useEffect: (effect: () => void) => reactMocks.effects.push(effect),
  useMemo: <T,>(factory: () => T) => factory(),
  useState: <T,>(_value: T) => [reactMocks.query, reactMocks.setQuery],
}));
vi.mock("react-native", () => ({
  FlatList: "FlatList",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  TextInput: "TextInput",
  View: "View",
  // A Pixel 6 Pro window at default text (38.13 D-85 sizing input).
  useWindowDimensions: () => ({ height: 891, width: 412, fontScale: 1 }),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));
// 38.9 D-28: CategoryChoiceSheet wraps the shared OptionSheet, which renders
// the Sheet, search field and list; its leaf primitives are mocked here.
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Sheet", () => ({ Sheet: "Sheet" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: {} }),
  useUnscopedTheme: () => ({ colors: {} }),
}));

const {
  CategoryChoiceSheet: renderCategoryChoiceSheet,
  categoryChoiceSheetModel,
} = await import("./CategoryChoiceSheet");

type Element = { type?: unknown; props?: Record<string, unknown> };

/** Shallow-render function components (the wrapped OptionSheet) in place. */
function expand(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const element = node as Element;
  if (typeof element.type === "function") {
    return expand(
      (element.type as (props: unknown) => unknown)(element.props ?? {}),
    );
  }
  return node;
}

function CategoryChoiceSheet(
  props: Parameters<typeof renderCategoryChoiceSheet>[0],
): unknown {
  return expand(renderCategoryChoiceSheet(props));
}

function findElements(node: unknown, type: unknown): unknown[] {
  if (!node || typeof node !== "object") return [];
  const element = node as { type?: unknown; props?: { children?: unknown } };
  const matches = element.type === type ? [node] : [];
  const children = element.props?.children;
  const nested = Array.isArray(children)
    ? children.flatMap((child) => findElements(child, type))
    : findElements(children, type);
  return [...matches, ...nested];
}

describe("CategoryChoiceSheet", () => {
  const categories = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    uid: `uid-${index + 1}`,
    name: `Category ${index + 1}`,
  }));

  it("keeps a hidden selection while search returns the complete matching set", () => {
    const model = categoryChoiceSheetModel({
      categories,
      selectedId: 1,
      query: "20",
      allowUncategorized: true,
    });
    expect(model.selectedId).toBe(1);
    expect(model.rows.map((row) => row.id)).toEqual([20]);
  });

  it("supports real-only and exclusion policies without mutating canonical order", () => {
    const model = categoryChoiceSheetModel({
      categories,
      selectedId: null,
      query: "",
      allowUncategorized: false,
      excludeCategoryId: 2,
      excludeCategoryUid: "uid-4",
    });
    expect(model.rows.map((row) => row.id)).toEqual(
      categories
        .filter((row) => row.id !== 2 && row.uid !== "uid-4")
        .map((row) => row.id),
    );
    expect(model.rows.some((row) => row.id === null)).toBe(false);
  });

  it("emits the exact no-match copy without clearing a stale selection", () => {
    const model = categoryChoiceSheetModel({
      categories,
      selectedId: 999,
      query: "xyz",
      allowUncategorized: true,
    });
    expect(model.rows).toEqual([]);
    expect(model.selectedId).toBe(999);
    expect(model.emptyCopy).toBe("No categories match \u201cxyz\u201d.");
  });

  it("enables search at thirteen eligible real categories, not twelve", () => {
    const twelve = categoryChoiceSheetModel({
      categories: categories.slice(0, 12),
      selectedId: null,
      query: "20",
      allowUncategorized: true,
    });
    const thirteen = categoryChoiceSheetModel({
      categories: categories.slice(0, 13),
      selectedId: null,
      query: "13",
      allowUncategorized: true,
    });

    expect(twelve.searchable).toBe(false);
    expect(twelve.rows.map((row) => row.id)).toEqual([
      ...categories.slice(0, 12).map((row) => row.id),
      null,
    ]);
    expect(thirteen.searchable).toBe(true);
    expect(thirteen.rows.map((row) => row.id)).toEqual([13]);
  });

  it("computes the threshold after ID or UID exclusion", () => {
    const thirteen = categories.slice(0, 13);
    const byId = categoryChoiceSheetModel({
      categories: thirteen,
      selectedId: null,
      query: "missing",
      allowUncategorized: true,
      excludeCategoryId: 1,
    });
    const byUid = categoryChoiceSheetModel({
      categories: thirteen,
      selectedId: null,
      query: "missing",
      allowUncategorized: false,
      excludeCategoryUid: "uid-2",
    });

    expect(byId.searchable).toBe(false);
    expect(byId.rows.map((row) => row.id)).toEqual([
      ...thirteen.slice(1).map((row) => row.id),
      null,
    ]);
    expect(byUid.searchable).toBe(false);
    expect(byUid.rows.map((row) => row.id)).toEqual(
      thirteen.filter((row) => row.uid !== "uid-2").map((row) => row.id),
    );
  });

  it("D-72: lists every uid-less category row (listCategories shape) when no exclusion is set", () => {
    // listCategories() selects only `id, name`: the bulk Set Category, Create,
    // Edit and Import choosers all pass rows with no uid. An unset
    // excludeCategoryUid must not exclude them (undefined !== undefined).
    const seeded = [
      { id: 1, name: "Family" },
      { id: 2, name: "Friends" },
      { id: 3, name: "Work" },
      { id: 4, name: "Community" },
      { id: 9, name: "ZZ Custom" },
    ];
    const model = categoryChoiceSheetModel({
      categories: seeded,
      selectedId: null,
      query: "",
      allowUncategorized: true,
    });
    expect(model.rows.map((row) => row.name)).toEqual([
      "Family",
      "Friends",
      "Work",
      "Community",
      "ZZ Custom",
      "Uncategorized",
    ]);
    const byId = categoryChoiceSheetModel({
      categories: seeded,
      selectedId: null,
      query: "",
      allowUncategorized: false,
      excludeCategoryId: 2,
    });
    expect(byId.rows.map((row) => row.id)).toEqual([1, 3, 4, 9]);
  });

  it("D-72: pressing a uid-less category row selects that category id", () => {
    const onSelect = vi.fn();
    const onRequestClose = vi.fn();
    const tree = CategoryChoiceSheet({
      visible: true,
      categories: [
        { id: 1, name: "Family" },
        { id: 2, name: "Friends" },
      ],
      selectedId: null,
      onSelect,
      onRequestClose,
    });
    const list = findElements(tree, "FlatList")[0] as {
      props: {
        data: { value: number | null; label: string; selected: boolean }[];
        renderItem: (info: {
          item: { value: number | null; label: string; selected: boolean };
        }) => {
          props: { onPress: () => void };
        };
      };
    };
    expect(list.props.data.map((row) => row.label)).toEqual([
      "Family",
      "Friends",
      "Uncategorized",
    ]);
    list.props.renderItem({ item: list.props.data[1] }).props.onPress();
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(onRequestClose).toHaveBeenCalled();
  });

  it("renders search only for a searchable eligible catalog", () => {
    const render = (length: number) =>
      CategoryChoiceSheet({
        visible: true,
        categories: categories.slice(0, length),
        selectedId: null,
        onSelect: vi.fn(),
        onRequestClose: vi.fn(),
      });

    expect(findElements(render(12), "TextInput")).toHaveLength(0);
    expect(findElements(render(13), "TextInput")).toHaveLength(1);
  });

  it("clears query state when the sheet closes or becomes non-searchable", () => {
    reactMocks.query = "friends";
    reactMocks.effects.length = 0;
    reactMocks.setQuery.mockClear();

    CategoryChoiceSheet({
      visible: false,
      categories: categories.slice(0, 13),
      selectedId: null,
      onSelect: vi.fn(),
      onRequestClose: vi.fn(),
    });
    for (const effect of reactMocks.effects) effect();
    expect(reactMocks.setQuery).toHaveBeenCalledWith("");

    reactMocks.effects.length = 0;
    reactMocks.setQuery.mockClear();
    CategoryChoiceSheet({
      visible: true,
      categories: categories.slice(0, 12),
      selectedId: null,
      onSelect: vi.fn(),
      onRequestClose: vi.fn(),
    });
    for (const effect of reactMocks.effects) effect();
    expect(reactMocks.setQuery).toHaveBeenCalledWith("");
  });

  // 38.13 D-71 / D-78: the bulk Set Category sheet is sized when it opens.
  describe("sizeToContent (D-71, D-78)", () => {
    const named = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        name: `Category ${index + 1}`,
      }));
    const optionSheetProps = (
      count: number,
      sizeToContent?: boolean,
    ): Record<string, unknown> =>
      (
        renderCategoryChoiceSheet({
          visible: true,
          categories: named(count),
          selectedId: null,
          allowUncategorized: true,
          sizeToContent,
          onSelect: vi.fn(),
          onRequestClose: vi.fn(),
        }) as unknown as { props: Record<string, unknown> }
      ).props;

    it("sizes from its own unfiltered rows' height, Uncategorized included (D-85)", () => {
      // 52dp rows + 117dp chrome against a 891dp window (40% 356, 60% 535):
      // 2 + Uncategorized = 3 rows (273) compact; 4 + 1 = 5 rows (377, the
      // fresh-install list) detail; 7 + 1 = 8 (533) detail; 24 + 1 expanded.
      expect(optionSheetProps(2, true).size).toBe("compact");
      expect(optionSheetProps(4, true).size).toBe("detail");
      expect(optionSheetProps(7, true).size).toBe("detail");
      expect(optionSheetProps(8, true).size).toBeUndefined();
      expect(optionSheetProps(24, true).size).toBeUndefined();
    });

    it("never passes a size without the flag (every other caller unchanged)", () => {
      expect(optionSheetProps(2).size).toBeUndefined();
      expect(optionSheetProps(7, false).size).toBeUndefined();
    });

    it("renders a content-sized compact/detail sheet whose list is the only scroll", () => {
      const render = (count: number) =>
        CategoryChoiceSheet({
          visible: true,
          categories: named(count),
          selectedId: null,
          sizeToContent: true,
          onSelect: vi.fn(),
          onRequestClose: vi.fn(),
        }) as { type: unknown; props: Record<string, unknown> };
      const compact = render(2);
      expect(compact.type).toBe("Sheet");
      expect(compact.props.variant).toBe("compact");
      expect(compact.props.scrollBody).toBe(false);
      expect(findElements(compact, "FlatList")).toHaveLength(1);
      const detail = render(7);
      expect(detail.props.variant).toBe("detail");
      expect(detail.props.scrollBody).toBe(false);
      const long = render(24);
      expect(long.props.variant).toBe("expanded");
      expect(long.props.scrollBody).toBeUndefined();
      expect(findElements(long, "FlatList")).toHaveLength(1);
    });

    it("keeps today's expanded sheet without the flag", () => {
      const tree = CategoryChoiceSheet({
        visible: true,
        categories: named(2),
        selectedId: null,
        onSelect: vi.fn(),
        onRequestClose: vi.fn(),
      }) as { props: Record<string, unknown> };
      expect(tree.props.variant).toBe("expanded");
      expect(tree.props.scrollBody).toBeUndefined();
    });
  });
});
