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
});
