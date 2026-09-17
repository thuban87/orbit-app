import { describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  useCallback: <T,>(value: T) => value,
  useRef: <T,>(value: T) => ({ current: value }),
  useState: <T,>(value: T) => [value, vi.fn()],
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
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
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: () => "now",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

const { createCategoryManagementLoadGuard } = await import(
  "./CategoryManagementScreen"
);

describe("CategoryManagementScreen tracer contracts", () => {
  it("prevents stale loads from publishing", () => {
    const next = createCategoryManagementLoadGuard();
    const first = next();
    const second = next();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });
});
