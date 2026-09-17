import { describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  useEffect: vi.fn(),
  useMemo: <T,>(factory: () => T) => factory(),
  useState: <T,>(value: T) => [value, vi.fn()],
}));
vi.mock("react-native", () => ({
  FlatList: "FlatList",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/ui", () => ({ AppText: "AppText", Sheet: "Sheet" }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

const { categoryChoiceSheetModel } = await import("./CategoryChoiceSheet");

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
});
