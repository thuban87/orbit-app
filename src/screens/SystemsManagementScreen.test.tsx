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
vi.mock("@/stores/confirm-store", () => ({
  confirm: vi.fn(async () => false),
  notice: vi.fn(async () => undefined),
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

const {
  createManagementLoadGuard,
  deleteManagedSystem,
  managementActions,
  pinAllContacts,
  RESET_MANUAL_CHANGES_ACTION,
  runResetManualChangesAction,
} = await import("./SystemsManagementScreen");
const confirmStore = await import("@/stores/confirm-store");
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
      RESET_MANUAL_CHANGES_ACTION,
    ]);
    expect(RESET_MANUAL_CHANGES_ACTION).toBe("Reset Manual Changes");
    expect(
      managementActions({
        ...allContacts,
        id: "custom:family" as const,
        name: "Family",
        ref: { kind: "custom" as const, uid: "family" },
      }),
    ).toEqual(["Edit", "Rename", "Duplicate", "Delete"]);
  });

  it("pressing the renamed reset action reaches the reset confirm and resets the System's manual changes (D-63, C5-M5)", async () => {
    const builtin: SystemManagementRow = {
      ...allContacts,
      id: "builtin:favorites",
      name: "Favorites",
      ref: { kind: "builtin" as const, id: "favorites" as const },
      hasOverrides: true,
    };
    // The label the row shows is the label the dispatch accepts.
    const shown = managementActions(builtin).at(-1) as string;
    vi.mocked(confirmStore.confirm).mockResolvedValueOnce(true);
    vi.mocked(dao.resetSystemOverrides).mockResolvedValueOnce(undefined);
    const onChanged = vi.fn(async () => {});
    const onError = vi.fn();

    expect(
      runResetManualChangesAction(shown, {
        systemRef: builtin.id as never,
        onChanged,
        onError,
      }),
    ).toBe(true);

    expect(confirmStore.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Reset manual changes?",
        confirmLabel: "Reset",
        destructive: true,
      }),
    );
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(dao.resetSystemOverrides).toHaveBeenCalledWith("exec", {
      systemRef: "builtin:favorites",
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("the screen's row dispatch routes through the shared reset handler", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("./SystemsManagementScreen.tsx", import.meta.url),
      "utf8",
    );
    const onAction = source.slice(source.indexOf("const onAction = ("));
    expect(onAction).toContain("runResetManualChangesAction(action, {");
    expect(source).not.toContain('"Reset Overrides"');
  });

  it("the reset dispatch ignores other actions and a declined confirm resets nothing", async () => {
    const input = {
      systemRef: "builtin:favorites" as never,
      onChanged: vi.fn(),
      onError: vi.fn(),
    };
    expect(runResetManualChangesAction("Hide", input)).toBe(false);
    expect(runResetManualChangesAction("Reset Overrides", input)).toBe(false);
    expect(confirmStore.confirm).not.toHaveBeenCalled();

    vi.mocked(confirmStore.confirm).mockResolvedValueOnce(false);
    expect(
      runResetManualChangesAction(RESET_MANUAL_CHANGES_ACTION, input),
    ).toBe(true);
    await vi.waitFor(() => expect(confirmStore.confirm).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(dao.resetSystemOverrides).not.toHaveBeenCalled();
  });

  it("only lets the latest deferred management load publish or report an error", async () => {
    const nextGuard = createManagementLoadGuard();
    let releaseOlder!: () => void;
    const olderDone = new Promise<void>((resolve) => {
      releaseOlder = resolve;
    });
    const published: string[] = [];
    const older = nextGuard();
    const olderLoad = olderDone.then(() => {
      if (older()) published.push("older");
    });
    const newer = nextGuard();
    if (newer()) published.push("newer");
    releaseOlder();
    await olderLoad;
    expect(published).toEqual(["newer"]);

    const staleFailure = nextGuard();
    const currentFailure = nextGuard();
    expect(staleFailure()).toBe(false);
    expect(currentFailure()).toBe(true);
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
      fallbackSelectionRevision: 1,
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
      ?.onPress;
    expect(undo).toBeDefined();
    undo?.();
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
          fallbackSelectionRevision: 1,
          now: "now",
        },
      ),
    );
  });

  it("keeps Undo available when the post-commit list refresh fails", async () => {
    vi.mocked(dao.deleteSystemWithActiveFallback).mockResolvedValue({
      snapshot: {
        uid: "family",
        name: "Family",
        rules: [],
        overrides: [],
        prefs: null,
      },
      wasActive: false,
      fallbackSelectionRevision: null,
    });
    const onChanged = vi.fn().mockRejectedValue(new Error("read failed"));

    await expect(
      deleteManagedSystem({
        systemRef: "custom:family",
        onChanged,
      }),
    ).resolves.toBeUndefined();

    expect(onChanged).toHaveBeenCalledOnce();
    expect(snackbar.showSnackbar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: "System deleted, but the list couldn't refresh.",
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );
  });

  it("does not let a deferred pre-Undo refresh publish stale state or a second Undo", async () => {
    vi.mocked(dao.deleteSystemWithActiveFallback).mockResolvedValue({
      snapshot: {
        uid: "family",
        name: "Family",
        rules: [],
        overrides: [],
        prefs: null,
      },
      wasActive: true,
      fallbackSelectionRevision: 1,
    });
    vi.mocked(dao.restoreDeletedSystemAndActiveSelection).mockResolvedValue({
      id: 1,
      uid: "family",
      name: "Family",
      createdAt: "now",
      modifiedAt: "now",
    });
    let resolveInitialRefresh: (() => void) | undefined;
    const initialRefresh = new Promise<void>((resolve) => {
      resolveInitialRefresh = resolve;
    });
    const published: string[] = [];
    const onChanged = vi
      .fn()
      .mockImplementationOnce(async (isCurrent: () => boolean) => {
        await initialRefresh;
        if (isCurrent()) published.push("deleted");
      })
      .mockImplementationOnce(async (isCurrent: () => boolean) => {
        if (isCurrent()) published.push("restored");
      });

    const deleting = deleteManagedSystem({
      systemRef: "custom:family",
      onChanged,
    });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledOnce());

    vi.mocked(snackbar.showSnackbar).mock.calls[0][0].action?.onPress();
    await vi.waitFor(() =>
      expect(dao.restoreDeletedSystemAndActiveSelection).toHaveBeenCalledOnce(),
    );
    resolveInitialRefresh?.();

    await deleting;
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
    expect(published).toEqual(["restored"]);
    expect(vi.mocked(snackbar.showSnackbar)).toHaveBeenCalledOnce();
  });

  it("does not replace a restored System with a late failed delete refresh", async () => {
    vi.mocked(dao.deleteSystemWithActiveFallback).mockResolvedValue({
      snapshot: {
        uid: "family",
        name: "Family",
        rules: [],
        overrides: [],
        prefs: null,
      },
      wasActive: false,
      fallbackSelectionRevision: null,
    });
    vi.mocked(dao.restoreDeletedSystemAndActiveSelection).mockResolvedValue({
      id: 1,
      uid: "family",
      name: "Family",
      createdAt: "now",
      modifiedAt: "now",
    });
    let rejectInitialRefresh: ((reason?: unknown) => void) | undefined;
    const initialRefresh = new Promise<void>((_resolve, reject) => {
      rejectInitialRefresh = reject;
    });
    const onChanged = vi
      .fn()
      .mockImplementationOnce(() => initialRefresh)
      .mockResolvedValueOnce(undefined);

    const deleting = deleteManagedSystem({
      systemRef: "custom:family",
      onChanged,
    });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledOnce());

    vi.mocked(snackbar.showSnackbar).mock.calls[0][0].action?.onPress();
    await vi.waitFor(() =>
      expect(dao.restoreDeletedSystemAndActiveSelection).toHaveBeenCalledOnce(),
    );
    rejectInitialRefresh?.(new Error("stale read failed"));

    await deleting;
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
    expect(
      vi
        .mocked(snackbar.showSnackbar)
        .mock.calls.map(([message]) => message.label),
    ).toEqual(["System deleted"]);
  });

  it("refreshes the durable deletion after a failed Undo suppresses a deferred delete refresh", async () => {
    vi.mocked(dao.deleteSystemWithActiveFallback).mockResolvedValue({
      snapshot: {
        uid: "family",
        name: "Family",
        rules: [],
        overrides: [],
        prefs: null,
      },
      wasActive: true,
      fallbackSelectionRevision: 1,
    });
    vi.mocked(dao.restoreDeletedSystemAndActiveSelection).mockRejectedValue(
      new Error("name in use"),
    );
    let resolveInitialRefresh: (() => void) | undefined;
    const initialRefresh = new Promise<void>((resolve) => {
      resolveInitialRefresh = resolve;
    });
    const published: string[] = [];
    const onChanged = vi
      .fn()
      .mockImplementationOnce(async (isCurrent: () => boolean) => {
        await initialRefresh;
        if (isCurrent()) published.push("stale deletion");
      })
      .mockImplementationOnce(async (isCurrent: () => boolean) => {
        if (isCurrent()) published.push("deleted");
      });

    const deleting = deleteManagedSystem({
      systemRef: "custom:family",
      onChanged,
    });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    vi.mocked(snackbar.showSnackbar).mock.calls[0][0].action?.onPress();
    await vi.waitFor(() =>
      expect(dao.restoreDeletedSystemAndActiveSelection).toHaveBeenCalledOnce(),
    );
    resolveInitialRefresh?.();

    await deleting;
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
    expect(published).toEqual(["deleted"]);
    expect(state.prefs.hydrate).toHaveBeenCalledTimes(2);
    expect(snackbar.showSnackbar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: "Couldn't undo — that name is in use again",
        action: expect.objectContaining({ label: "Dismiss" }),
      }),
    );
    expect(state.prefs.save).not.toHaveBeenCalled();
  });
});
