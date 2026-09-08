import { describe, expect, it, vi } from "vitest";
import type { SystemManagementRow } from "./SystemsManagementScreen";

vi.mock("react", () => ({
  useCallback: <T,>(callback: T) => callback,
  useRef: <T,>(value: T) => ({ current: value }),
  useState: <T,>(value: T) => [value, () => {}],
}));
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: vi.fn() }),
}));
vi.mock("react-native-reorderable-list", () => ({
  default: "ReorderableList",
  reorderItems: <T,>(rows: T[]) => rows,
  useReorderableDrag: () => vi.fn(),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "now",
}));
vi.mock("@/db/orrery-system-read", () => ({
  readOrrerySystemMembersCore: vi.fn(),
  readOrrerySystemSnapshot: vi.fn(),
}));
vi.mock("@/db/systems-dao", () => ({
  deleteSystem: vi.fn(),
  duplicateSystem: vi.fn(),
  listCustomSystems: vi.fn(),
  listSystemOverrides: vi.fn(),
  listSystemPrefs: vi.fn(),
  renameSystem: vi.fn(),
  reorderSystems: vi.fn(),
  resetSystemOverrides: vi.fn(),
  restoreDeletedSystem: vi.fn(),
  setSystemHidden: vi.fn(),
}));
vi.mock("@/stores/snackbar-store", () => ({
  showSnackbar: vi.fn(),
  snackbarStore: { getState: () => ({ dismiss: vi.fn() }) },
}));
vi.mock("@/stores/orrery-preferences-store", () => ({
  useOrreryPreferencesStore: { getState: () => ({ hydrated: true }) },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: {} }),
}));
vi.mock("@/components/orrery/orrery-controls-logic", () => ({
  buildSystemChoices: vi.fn(),
}));

const { managementActions, pinAllContacts } = await import(
  "./SystemsManagementScreen"
);

const allContacts: SystemManagementRow = {
  id: "builtin:all-contacts",
  name: "All Contacts",
  ref: { kind: "builtin" as const, id: "all-contacts" as const },
  memberCount: 3,
  hidden: false,
  hasOverrides: false,
  broken: false,
};

describe("SystemsManagementScreen contracts", () => {
  it("pins All Contacts first and never offers destructive or immutable-base actions", () => {
    expect(pinAllContacts([{ ...allContacts, id: "custom:late" }, allContacts])[0]).toBe(
      allContacts,
    );
    expect(managementActions(allContacts)).toEqual(["Duplicate", "Manage Members"]);
  });

  it("gives built-ins override authoring without Rename/Delete and custom Systems their lifecycle actions", () => {
    const builtin: SystemManagementRow = {
      ...allContacts,
      id: "builtin:favorites",
      name: "Favorites",
      ref: { kind: "builtin" as const, id: "favorites" as const },
      hasOverrides: true,
    };
    expect(managementActions(builtin)).toEqual([
      "Duplicate",
      "Manage Members",
      "Hide",
      "Reset Overrides",
    ]);
    expect(
      managementActions({
        ...allContacts,
        id: "custom:family" as const,
        name: "Family",
        ref: { kind: "custom" as const, uid: "family" },
      }),
    ).toEqual(["Edit", "Rename", "Duplicate", "Delete"]);
  });
});
