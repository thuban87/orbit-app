import { describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  useCallback: <T,>(value: T) => value,
  useRef: <T,>(value: T) => ({ current: value }),
  useState: <T,>(value: T) => [value, vi.fn()],
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  AccessibilityInfo: {
    setAccessibilityFocus: vi.fn(),
    announceForAccessibility: vi.fn(),
  },
  findNodeHandle: vi.fn(),
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: vi.fn() }));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/Sheet", () => ({ Sheet: "Sheet" }));
vi.mock("@/components/ui/ConfirmDialog", () => ({
  ConfirmDialog: "ConfirmDialog",
}));
vi.mock("@/components/category/CategoryChoiceSheet", () => ({
  CategoryChoiceSheet: "CategoryChoiceSheet",
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AnchoredMenu", () => ({
  AnchoredMenu: "AnchoredMenu",
}));
vi.mock("react-native-reorderable-list", () => ({
  default: "ReorderableList",
  useReorderableDrag: () => vi.fn(),
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: () => "now",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("@/theme/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

const {
  categoryCountLabel,
  createCategoryManagementLoadGuard,
  deletionImpactRows,
  isUnusedCategoryPreview,
  resolveCategoryManagementLoad,
  moveCategoryRows,
} = await import("./CategoryManagementScreen");

describe("CategoryManagementScreen tracer contracts", () => {
  it("prevents stale loads from publishing", () => {
    const next = createCategoryManagementLoadGuard();
    const first = next();
    const second = next();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it("returns explicit current-success, stale, and failure load outcomes", async () => {
    const publish = vi.fn();
    const rows = [{ id: 1 }] as never;

    await expect(
      resolveCategoryManagementLoad({
        isCurrent: () => true,
        readRows: async () => rows,
        readUncategorizedCount: async () => 2,
        publish,
      }),
    ).resolves.toEqual({ status: "success" });
    expect(publish).toHaveBeenCalledWith(rows, 2);

    publish.mockClear();
    await expect(
      resolveCategoryManagementLoad({
        isCurrent: () => false,
        readRows: async () => rows,
        readUncategorizedCount: async () => 2,
        publish,
      }),
    ).resolves.toEqual({ status: "stale" });
    expect(publish).not.toHaveBeenCalled();

    await expect(
      resolveCategoryManagementLoad({
        isCurrent: () => true,
        readRows: async () => Promise.reject(new Error("read failed")),
        readUncategorizedCount: async () => 2,
        publish,
      }),
    ).resolves.toEqual({ status: "failure" });
    expect(publish).not.toHaveBeenCalled();
  });

  it("formats exact singular and plural all-contact counts", () => {
    expect(categoryCountLabel(0)).toBe("0 contacts");
    expect(categoryCountLabel(1)).toBe("1 contact");
    expect(categoryCountLabel(12)).toBe("12 contacts");
  });

  it("moves canonical rows without mutating committed state", () => {
    const rows = [
      { id: 1, name: "Family" },
      { id: 2, name: "Friends" },
      { id: 3, name: "Work" },
    ];
    expect(moveCategoryRows(rows, 2, 0).map((row) => row.id)).toEqual([
      3, 1, 2,
    ]);
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it("admits direct confirmation only when every fallout class is zero", () => {
    const zero = {
      contacts: 0,
      importPending: 0,
      importComplete: 0,
      importDiscarded: 0,
      rules: 0,
      systems: 0,
      categoryOverrides: 0,
      categoryPrefs: 0,
      profilePresentations: 0,
      dashboardFilters: 0,
      activeSelection: 0,
    };
    expect(isUnusedCategoryPreview(zero)).toBe(true);
    expect(isUnusedCategoryPreview({ ...zero, importComplete: 1 })).toBe(false);
    expect(isUnusedCategoryPreview({ ...zero, activeSelection: 1 })).toBe(
      false,
    );
  });

  it("renders count-only conditional fallout rows with separate import statuses", () => {
    expect(
      deletionImpactRows({
        contacts: 2,
        importPending: 1,
        importComplete: 3,
        importDiscarded: 4,
        rules: 5,
        systems: 2,
        categoryOverrides: 1,
        categoryPrefs: 1,
        profilePresentations: 6,
        dashboardFilters: 1,
        activeSelection: 1,
      }),
    ).toEqual([
      "2 contacts",
      "1 pending import session",
      "3 completed import sessions",
      "4 discarded import sessions",
      "5 rules across 2 Systems",
      "2 category-System settings or overrides",
      "6 Profile presentation assignments",
      "2 saved views or active selections",
    ]);
  });
});
