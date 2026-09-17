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
  CATEGORY_MANAGER_COPY,
  categoryCountLabel,
  createCategoryManagementLoadGuard,
  deletionImpactRows,
  isUnusedCategoryPreview,
  reconcilePendingCategoryMutation,
  resolveCategoryManagementLoad,
  runCategoryMutation,
  runCategoryReorder,
  moveCategoryRows,
} = await import("./CategoryManagementScreen");

describe("CategoryManagementScreen tracer contracts", () => {
  it("uses the exact owner-approved manager copy", () => {
    expect(CATEGORY_MANAGER_COPY).toEqual({
      saveError: "Couldn't save this category. Your changes weren’t applied.",
      emptyHeading: "No categories yet",
      emptyBody:
        "Add a category to organize your contacts. Uncategorized is always available.",
      uncategorizedBody:
        "Contacts without a category stay here. Uncategorized is always available and can’t be renamed or deleted.",
    });
  });

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

describe("CategoryManagementScreen committed mutation coordinator", () => {
  const operations = [
    ["create", "Category added.", "editor"],
    ["rename", "Category renamed.", "editor"],
    ["delete", "Category deleted.", "delete"],
  ] as const;

  it.each(operations)(
    "keeps %s pending without success when its committed write cannot be read back",
    async (operation, successLabel, finalize) => {
      const mutation = vi.fn().mockResolvedValue(undefined);
      const readback = vi.fn().mockResolvedValue({ status: "failure" });
      const setPending = vi.fn();
      const publishSuccess = vi.fn();
      const finalizeUi = vi.fn();
      const pending = { operation, successLabel, finalize };

      await expect(
        runCategoryMutation({
          mutation,
          readback,
          pending,
          setPending,
          publishSuccess,
          finalizeUi,
        }),
      ).resolves.toEqual({ status: "failure" });

      expect(mutation).toHaveBeenCalledTimes(1);
      expect(readback).toHaveBeenCalledTimes(1);
      expect(setPending).toHaveBeenCalledTimes(1);
      expect(setPending).toHaveBeenCalledWith(pending);
      expect(finalizeUi).not.toHaveBeenCalled();
      expect(publishSuccess).not.toHaveBeenCalled();
    },
  );

  it.each(operations)(
    "retries %s through readback only and finalizes success exactly once",
    async (operation, successLabel, finalize) => {
      const mutation = vi.fn().mockResolvedValue(undefined);
      const readRows = vi
        .fn()
        .mockRejectedValueOnce(new Error("first read failed"))
        .mockRejectedValueOnce(new Error("second read failed"))
        .mockResolvedValueOnce([]);
      const readUncategorizedCount = vi.fn().mockResolvedValue(0);
      const publishSnapshot = vi.fn();
      const readback = vi.fn(() =>
        resolveCategoryManagementLoad({
          isCurrent: () => true,
          readRows,
          readUncategorizedCount,
          publish: publishSnapshot,
        }),
      );
      const setPending = vi.fn();
      const showSnackbar = vi.fn();
      const bumpShellRefresh = vi.fn();
      const publishSuccess = vi.fn((label: string) => {
        bumpShellRefresh();
        showSnackbar({ kind: "success", label });
      });
      const finalizeUi = vi.fn();
      const pending = { operation, successLabel, finalize };

      await runCategoryMutation({
        mutation,
        readback,
        pending,
        setPending,
        publishSuccess,
        finalizeUi,
      });
      await reconcilePendingCategoryMutation({
        readback,
        pending,
        setPending,
        publishSuccess,
        finalizeUi,
      });
      await reconcilePendingCategoryMutation({
        readback,
        pending,
        setPending,
        publishSuccess,
        finalizeUi,
      });

      expect(mutation).toHaveBeenCalledTimes(1);
      expect(readback).toHaveBeenCalledTimes(3);
      expect(readRows).toHaveBeenCalledTimes(3);
      expect(readUncategorizedCount).toHaveBeenCalledTimes(3);
      expect(publishSnapshot).toHaveBeenCalledTimes(1);
      expect(finalizeUi).toHaveBeenCalledTimes(1);
      expect(finalizeUi).toHaveBeenCalledWith(finalize);
      expect(publishSuccess).toHaveBeenCalledTimes(1);
      expect(publishSuccess).toHaveBeenCalledWith(successLabel);
      expect(bumpShellRefresh).toHaveBeenCalledTimes(1);
      expect(showSnackbar).toHaveBeenCalledTimes(1);
      expect(showSnackbar).toHaveBeenCalledWith({
        kind: "success",
        label: successLabel,
      });
      expect(setPending).toHaveBeenLastCalledWith(null);
    },
  );

  it("does not finalize a stale readback", async () => {
    const publishSuccess = vi.fn();
    const finalizeUi = vi.fn();
    const setPending = vi.fn();
    const pending = {
      operation: "create" as const,
      successLabel: "Category added.",
      finalize: "editor" as const,
    };

    await expect(
      reconcilePendingCategoryMutation({
        readback: async () => ({ status: "stale" }),
        pending,
        setPending,
        publishSuccess,
        finalizeUi,
      }),
    ).resolves.toEqual({ status: "stale" });
    expect(setPending).not.toHaveBeenCalled();
    expect(finalizeUi).not.toHaveBeenCalled();
    expect(publishSuccess).not.toHaveBeenCalled();
  });

  it("commits reorder without list readback and restores committed rows on rejection", async () => {
    const prior = [{ id: 1 }, { id: 2 }] as never;
    const next = [{ id: 2 }, { id: 1 }] as never;
    const readback = vi.fn();
    const publishRows = vi.fn();
    const commitRows = vi.fn();

    await runCategoryReorder({
      next,
      prior,
      mutate: vi.fn().mockResolvedValue(undefined),
      publishRows,
      commitRows,
    });
    expect(commitRows).toHaveBeenCalledWith(next);
    expect(readback).not.toHaveBeenCalled();

    publishRows.mockClear();
    commitRows.mockClear();
    await expect(
      runCategoryReorder({
        next,
        prior,
        mutate: vi.fn().mockRejectedValue(new Error("write failed")),
        publishRows,
        commitRows,
      }),
    ).rejects.toThrow("write failed");
    expect(publishRows).toHaveBeenLastCalledWith(prior);
    expect(commitRows).not.toHaveBeenCalled();
  });
});
