import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemManagementRow } from "./SystemsManagementScreen";

const state = vi.hoisted(() => ({
  prefs: {
    hydrated: true,
    committed: { lastSystem: "builtin:all-contacts" },
    hydrate: vi.fn(),
    save: vi.fn(),
  },
}));

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
  deleteSystemWithActiveFallback: vi.fn(),
  duplicateSystem: vi.fn(),
  listCustomSystems: vi.fn(),
  listSystemOverrides: vi.fn(),
  listSystemPrefs: vi.fn(),
  renameSystem: vi.fn(),
  reorderSystems: vi.fn(),
  resetSystemOverrides: vi.fn(),
  restoreDeletedSystemAndActiveSelection: vi.fn(),
  setSystemHidden: vi.fn(),
}));
vi.mock("@/stores/snackbar-store", () => ({
  showSnackbar: vi.fn(),
  snackbarStore: { getState: () => ({ dismiss: vi.fn() }) },
}));
vi.mock("@/stores/orrery-preferences-store", () => ({
  useOrreryPreferencesStore: { getState: () => state.prefs },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: {} }),
}));
vi.mock("@/components/orrery/orrery-controls-logic", () => ({
  buildSystemChoices: vi.fn(),
}));

const { deleteManagedSystem, managementActions, pinAllContacts } = await import(
  "./SystemsManagementScreen"
);
const dao = await import("@/db/systems-dao");
const snackbar = await import("@/stores/snackbar-store");

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
  beforeEach(() => {
    vi.clearAllMocks();
    state.prefs.hydrated = true;
    state.prefs.committed.lastSystem = "builtin:all-contacts";
  });
  it("pins All Contacts first and never offers destructive or immutable-base actions", () => {
    expect(
      pinAllContacts([{ ...allContacts, id: "custom:late" }, allContacts])[0],
    ).toBe(allContacts);
    expect(managementActions(allContacts)).toEqual([
      "Duplicate",
      "Manage Members",
    ]);
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

  it("offers Undo only after the DAO commits the delete/fallback composite", async () => {
    vi.mocked(dao.deleteSystemWithActiveFallback).mockResolvedValue({
      snapshot: {
        uid: "family",
        name: "Family",
        rules: [],
        overrides: [],
        prefs: null,
      },
      wasActive: true,
    });
    vi.mocked(dao.restoreDeletedSystemAndActiveSelection).mockResolvedValue({
      id: 1,
      uid: "family",
      name: "Family",
      createdAt: "now",
      modifiedAt: "now",
    });
    const onChanged = vi.fn().mockResolvedValue(undefined);

    await deleteManagedSystem({
      systemRef: "custom:family",
      onChanged,
    });

    expect(dao.deleteSystemWithActiveFallback).toHaveBeenCalledWith("exec", {
      systemRef: "custom:family",
      now: "now",
    });
    expect(state.prefs.hydrate).toHaveBeenCalledWith("exec");
    expect(state.prefs.save).not.toHaveBeenCalled();
    expect(snackbar.showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ label: "System deleted" }),
    );

    const undo = vi.mocked(snackbar.showSnackbar).mock.calls[0][0].action
      .onPress;
    undo();
    await vi.waitFor(() =>
      expect(dao.restoreDeletedSystemAndActiveSelection).toHaveBeenCalledWith(
        "exec",
        {
          snapshot: {
            uid: "family",
            name: "Family",
            rules: [],
            overrides: [],
            prefs: null,
          },
          restoreActiveSelection: true,
          now: "now",
        },
      ),
    );
  });

  it("keeps a failed Undo non-destructive and does not reselect the deleted System", async () => {
    vi.mocked(dao.deleteSystemWithActiveFallback).mockResolvedValue({
      snapshot: {
        uid: "family",
        name: "Family",
        rules: [],
        overrides: [],
        prefs: null,
      },
      wasActive: true,
    });
    vi.mocked(dao.restoreDeletedSystemAndActiveSelection).mockRejectedValue(
      new Error("name in use"),
    );

    await deleteManagedSystem({
      systemRef: "custom:family",
      onChanged: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(snackbar.showSnackbar).mock.calls[0][0].action.onPress();
    await vi.waitFor(() =>
      expect(snackbar.showSnackbar).toHaveBeenLastCalledWith(
        expect.objectContaining({
          label: "Couldn't undo — that name is in use again",
        }),
      ),
    );
    expect(state.prefs.save).not.toHaveBeenCalled();
  });
});
