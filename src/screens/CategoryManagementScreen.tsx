// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button roles are domain variants.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import ReorderableList, {
  type ReorderableListRenderItemInfo,
  type ReorderableListReorderEvent,
  useReorderableDrag,
} from "react-native-reorderable-list";
import { CategoryChoiceSheet } from "@/components/category/CategoryChoiceSheet";
import { Icon } from "@/components/icons/Icon";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AnchoredMenu,
  type AnchoredMenuItem,
} from "@/components/ui/AnchoredMenu";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Sheet } from "@/components/ui/Sheet";
import {
  type CategoryDeletionCounts,
  type CategoryDeletionPreview,
  type CategoryManagementRow,
  countUncategorizedContacts,
  createCategory,
  deleteCategory,
  listCategoriesForManagement,
  readCategoryDeletionPreview,
  renameCategory,
  reorderCategories,
} from "@/db/categories-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { validateCategoryName } from "@/logic/category-logic";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { useReducedMotion } from "@/theme/use-reduced-motion";
import { plural, pluralWord } from "@/utils/plural";

const LOAD_ERROR = "Couldn't load categories. Try again.";
export const CATEGORY_MANAGER_COPY = {
  saveError: "Couldn't save this category. Your changes weren’t applied.",
  emptyHeading: "No categories yet",
  emptyBody:
    "Add a category to organize your contacts. Uncategorized is always available.",
  uncategorizedBody:
    "Contacts without a category stay here. Uncategorized is always available and can’t be renamed or deleted.",
} as const;
const SAVE_ERROR = CATEGORY_MANAGER_COPY.saveError;
const REORDER_ERROR =
  "Couldn't save the new category order. The previous order was restored.";
type Editor =
  | { kind: "add"; name: string }
  | { kind: "rename"; row: CategoryManagementRow; name: string };
type RowAction = "rename" | "up" | "down" | "delete";

export type CategoryManagementLoadOutcome =
  | { status: "success" }
  | { status: "stale" }
  | { status: "failure" };

export type PendingCategoryMutation = {
  operation: "create" | "rename" | "delete";
  successLabel: string;
  finalize: "editor" | "delete";
};

type CategoryMutationCoordinatorInput = {
  readback: () => Promise<CategoryManagementLoadOutcome>;
  pending: PendingCategoryMutation;
  setPending: (pending: PendingCategoryMutation | null) => void;
  finalizeUi: (finalize: PendingCategoryMutation["finalize"]) => void;
  publishSuccess: (label: string, kind: CategoryResultKind) => void;
};

/** A committed category change reports as a notice or, for a delete, a warning. */
export type CategoryResultKind = "success" | "warning";

/** D-132: a delete reports in the warning style; add and rename are notices. */
export function categoryResultKind(
  operation: PendingCategoryMutation["operation"],
): CategoryResultKind {
  return operation === "delete" ? "warning" : "success";
}

export async function reconcilePendingCategoryMutation(
  input: CategoryMutationCoordinatorInput,
): Promise<CategoryManagementLoadOutcome> {
  const outcome = await input.readback();
  if (outcome.status === "success") {
    input.finalizeUi(input.pending.finalize);
    input.publishSuccess(
      input.pending.successLabel,
      categoryResultKind(input.pending.operation),
    );
    input.setPending(null);
  }
  return outcome;
}

export async function runCategoryMutation(
  input: CategoryMutationCoordinatorInput & { mutation: () => Promise<void> },
): Promise<CategoryManagementLoadOutcome> {
  await input.mutation();
  input.setPending(input.pending);
  return reconcilePendingCategoryMutation(input);
}

export async function runCategoryReorder<T>(input: {
  next: T[];
  prior: T[];
  mutate: () => Promise<void>;
  publishRows: (rows: T[]) => void;
  commitRows: (rows: T[]) => void;
}): Promise<void> {
  input.publishRows(input.next);
  try {
    await input.mutate();
    input.commitRows(input.next);
  } catch (cause) {
    input.publishRows(input.prior);
    throw cause;
  }
}

export async function resolveCategoryManagementLoad(input: {
  isCurrent: () => boolean;
  readRows: () => Promise<CategoryManagementRow[]>;
  readUncategorizedCount: () => Promise<number>;
  publish: (rows: CategoryManagementRow[], uncategorizedCount: number) => void;
}): Promise<CategoryManagementLoadOutcome> {
  try {
    const [rows, uncategorizedCount] = await Promise.all([
      input.readRows(),
      input.readUncategorizedCount(),
    ]);
    if (!input.isCurrent()) return { status: "stale" };
    input.publish(rows, uncategorizedCount);
    return { status: "success" };
  } catch {
    return input.isCurrent() ? { status: "failure" } : { status: "stale" };
  }
}

export function categoryCountLabel(count: number): string {
  return `${count} ${count === 1 ? "contact" : "contacts"}`;
}

export function moveCategoryRows<T>(
  rows: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

export function isUnusedCategoryPreview(
  counts: CategoryDeletionCounts,
): boolean {
  return Object.values(counts).every((count) => count === 0);
}

export function deletionImpactRows(counts: CategoryDeletionCounts): string[] {
  const rows: string[] = [];
  if (counts.contacts) rows.push(plural(counts.contacts, "contact"));
  if (counts.importPending)
    rows.push(plural(counts.importPending, "pending import session"));
  if (counts.importComplete)
    rows.push(plural(counts.importComplete, "completed import session"));
  if (counts.importDiscarded)
    rows.push(plural(counts.importDiscarded, "discarded import session"));
  if (counts.rules)
    rows.push(
      `${plural(counts.rules, "rule")} across ${plural(counts.systems, "System")}`,
    );
  const categorySettings = counts.categoryOverrides + counts.categoryPrefs;
  if (categorySettings)
    rows.push(
      plural(
        categorySettings,
        "setting or manual change on this category's System",
        "settings or manual changes on this category's System",
      ),
    );
  if (counts.profilePresentations)
    rows.push(
      plural(counts.profilePresentations, "Profile presentation assignment"),
    );
  const savedViews = counts.dashboardFilters + counts.activeSelection;
  if (savedViews)
    rows.push(
      plural(
        savedViews,
        "saved view or active selection",
        "saved views or active selections",
      ),
    );
  return rows;
}

/** The one-line body of an empty, unused category's delete confirm (D-73). */
export const EMPTY_CATEGORY_DELETE_BODY =
  "It's empty and nothing uses it. This can't be undone.";

/** Contacts plus imports: what moves to the chosen target on delete. */
export function categoryMovingCount(counts: CategoryDeletionCounts): number {
  return (
    counts.contacts +
    counts.importPending +
    counts.importComplete +
    counts.importDiscarded
  );
}

/**
 * The category delete confirm's plain-count body (38.12 D-73): "2 people move
 * to Uncategorized." (and the import sessions that move with them), then that
 * it can't be undone. The full breakdown sits behind the details toggle
 * (`deletionImpactRows`). An unused category gets the one-line body.
 */
export function categoryDeleteMessage(
  counts: CategoryDeletionCounts,
  targetName: string,
): string {
  if (isUnusedCategoryPreview(counts)) return EMPTY_CATEGORY_DELETE_BODY;
  const lines: string[] = [];
  if (counts.contacts > 0)
    lines.push(
      `${plural(counts.contacts, "person", "people")} ${pluralWord(
        counts.contacts,
        "moves",
        "move",
      )} to ${targetName}.`,
    );
  else lines.push("No one is in this category.");
  const imports = categoryMovingCount(counts) - counts.contacts;
  if (imports > 0)
    lines.push(
      `${plural(imports, "import session")} ${pluralWord(
        imports,
        "moves",
        "move",
      )} there too.`,
    );
  lines.push("This can't be undone.");
  return lines.join(" ");
}

export function createCategoryManagementLoadGuard() {
  let generation = 0;
  return () => {
    const request = ++generation;
    return () => request === generation;
  };
}

function CategoryRow({
  row,
  index,
  total,
  disabled,
  onAction,
}: {
  row: CategoryManagementRow;
  index: number;
  total: number;
  disabled: boolean;
  onAction: (action: RowAction) => void;
}) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  const anchorRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      const handle = anchorRef.current;
      const node = findNodeHandle(handle);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, []);
  const items: AnchoredMenuItem[] = [
    {
      id: "rename",
      label: "Rename",
      icon: "edit",
      onPress: () => onAction("rename"),
    },
    ...(index > 0
      ? [
          {
            id: "up",
            label: "Move up",
            icon: "sort" as const,
            onPress: () => onAction("up"),
          },
        ]
      : []),
    ...(index < total - 1
      ? [
          {
            id: "down",
            label: "Move down",
            icon: "sort" as const,
            onPress: () => onAction("down"),
          },
        ]
      : []),
    {
      id: "delete",
      label: "Delete",
      icon: "warning",
      danger: true,
      separatorBefore: true,
      onPress: () => onAction("delete"),
    },
  ];
  return (
    <View
      testID={`category-row-${row.id}`}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reorder ${row.name}`}
        accessibilityHint="Long press and drag to reorder categories"
        disabled={disabled}
        onLongPress={drag}
        style={styles.iconTarget}
      >
        <Icon name="sort" size="md" tone="textSecondary" />
      </Pressable>
      <View
        style={styles.rowContent}
        accessible
        accessibilityLabel={`${row.name}, ${categoryCountLabel(row.contactCount)}`}
      >
        <AppText role="body" numberOfLines={2}>
          {row.name}
        </AppText>
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          {categoryCountLabel(row.contactCount)}
        </AppText>
      </View>
      <Pressable
        ref={anchorRef}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`Options for ${row.name}`}
        accessibilityState={{ expanded: menuOpen, disabled }}
        disabled={disabled}
        onPress={() => setMenuOpen(true)}
        style={styles.iconTarget}
      >
        <Icon name="overflow" size="md" tone="textSecondary" />
      </Pressable>
      <AnchoredMenu
        anchorRef={anchorRef}
        visible={menuOpen}
        accessibilityLabel={`Options for ${row.name}`}
        items={items}
        onRequestClose={closeMenu}
      />
    </View>
  );
}

export function CategoryManagementScreen() {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const reducedMotion = useReducedMotion();
  const [rows, setRows] = useState<CategoryManagementRow[]>([]);
  const committedRows = useRef<CategoryManagementRow[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deletePreview, setDeletePreview] =
    useState<CategoryDeletionPreview | null>(null);
  // The one delete confirm (D-73) and its "Show details" toggle.
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteDetailsShown, setDeleteDetailsShown] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null);
  const [targetChoiceOpen, setTargetChoiceOpen] = useState(false);
  const [readbackPending, setReadbackPending] =
    useState<PendingCategoryMutation | null>(null);
  const nextLoad = useRef(createCategoryManagementLoadGuard());

  const load = useCallback(async (): Promise<CategoryManagementLoadOutcome> => {
    const current = nextLoad.current();
    const exec = getExecutor();
    const outcome = await resolveCategoryManagementLoad({
      isCurrent: current,
      readRows: () => listCategoriesForManagement(exec),
      readUncategorizedCount: () => countUncategorizedContacts(exec),
      publish: (loaded, fallbackCount) => {
        committedRows.current = loaded;
        setRows(loaded);
        setUncategorizedCount(fallbackCount);
      },
    });
    if (outcome.status === "success") {
      setLoadError(false);
    } else if (outcome.status === "failure") {
      setLoadError(true);
    }
    if (outcome.status !== "stale") setInitialLoading(false);
    return outcome;
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const publishSuccess = (label: string, kind: CategoryResultKind) => {
    bumpShellRefresh();
    showSnackbar({ kind, label });
  };

  /** One Cancel leaves the delete confirm entirely (D-73). */
  const closeDelete = () => {
    setDeleteConfirmOpen(false);
    setDeleteDetailsShown(false);
    setDeletePreview(null);
    setTargetChoiceOpen(false);
  };

  const finalizeMutationUi = (
    finalize: PendingCategoryMutation["finalize"],
  ) => {
    if (finalize === "editor") setEditor(null);
    else closeDelete();
  };

  const retryReadback = async () => {
    if (!readbackPending || saving) return;
    setSaving(true);
    try {
      const outcome = await reconcilePendingCategoryMutation({
        readback: load,
        pending: readbackPending,
        setPending: setReadbackPending,
        finalizeUi: finalizeMutationUi,
        publishSuccess,
      });
      if (outcome.status !== "success") setLoadError(true);
    } finally {
      setSaving(false);
    }
  };

  const submitEditor = async () => {
    if (!editor || saving || readbackPending) return;
    const validation = validateCategoryName(editor.name, {
      categoryNames: rows,
      systemNames: [],
      excludeCategoryId: editor.kind === "rename" ? editor.row.id : undefined,
    });
    if (!validation.ok) {
      setNameError(validation.message);
      return;
    }
    setSaving(true);
    setNameError(null);
    try {
      const pending: PendingCategoryMutation = {
        operation: editor.kind === "add" ? "create" : "rename",
        successLabel:
          editor.kind === "add" ? "Category added." : "Category renamed.",
        finalize: "editor",
      };
      const outcome = await runCategoryMutation({
        mutation: async () => {
          if (editor.kind === "add")
            await createCategory(getExecutor(), {
              name: editor.name,
              now: localDateTime(),
            });
          else
            await renameCategory(getExecutor(), {
              id: editor.row.id,
              name: editor.name,
              now: localDateTime(),
            });
        },
        readback: load,
        pending,
        setPending: setReadbackPending,
        finalizeUi: finalizeMutationUi,
        publishSuccess,
      });
      if (outcome.status !== "success") setLoadError(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : SAVE_ERROR;
      setNameError(/category name|System/.test(message) ? message : SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const persistOrder = async (
    next: CategoryManagementRow[],
    movedIndex: number,
  ) => {
    if (reordering || readbackPending) return;
    setReordering(true);
    setSaveError(null);
    try {
      await runCategoryReorder({
        next,
        prior: committedRows.current,
        mutate: () =>
          reorderCategories(getExecutor(), {
            orderedIds: next.map((row) => row.id),
            now: localDateTime(),
          }),
        publishRows: setRows,
        commitRows: (committed) => {
          committedRows.current = committed;
        },
      });
      bumpShellRefresh();
      const moved = next[movedIndex];
      if (moved)
        AccessibilityInfo.announceForAccessibility(
          `${moved.name}, position ${movedIndex + 1} of ${next.length}`,
        );
    } catch {
      setSaveError(REORDER_ERROR);
      AccessibilityInfo.announceForAccessibility(REORDER_ERROR);
    } finally {
      setReordering(false);
    }
  };

  const beginDelete = async (row: CategoryManagementRow) => {
    if (saving || readbackPending) return;
    setSaving(true);
    setSaveError(null);
    try {
      const preview = await readCategoryDeletionPreview(getExecutor(), row.id);
      if (!preview) {
        await load();
        setSaveError(SAVE_ERROR);
        return;
      }
      setDeletePreview(preview);
      setTargetCategoryId(null);
      setDeleteDetailsShown(false);
      setDeleteConfirmOpen(true);
    } catch {
      setSaveError(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const commitDelete = async () => {
    if (!deletePreview || saving || readbackPending) return;
    setSaving(true);
    setSaveError(null);
    let result: Awaited<ReturnType<typeof deleteCategory>> | undefined;
    try {
      const pending: PendingCategoryMutation = {
        operation: "delete",
        successLabel: "Category deleted.",
        finalize: "delete",
      };
      const outcome = await runCategoryMutation({
        mutation: async () => {
          result = await deleteCategory(getExecutor(), {
            categoryId: deletePreview.category.id,
            targetCategoryId,
            expectedFingerprint: deletePreview.fingerprint,
            now: localDateTime(),
          });
          if (result.status === "stale") throw new Error("stale deletion");
        },
        readback: load,
        pending,
        setPending: setReadbackPending,
        finalizeUi: finalizeMutationUi,
        publishSuccess,
      });
      // A committed delete whose readback failed keeps the confirm open with
      // its Try again (readbackPending), so nothing is half-closed.
      if (outcome.status !== "success") setLoadError(true);
    } catch (cause) {
      if (cause instanceof Error && cause.message === "stale deletion") {
        const fresh = result?.status === "stale" ? result.preview : null;
        setDeletePreview(fresh);
        const stillValid =
          targetCategoryId === null ||
          !!fresh?.targets.some((target) => target.id === targetCategoryId);
        if (!stillValid) setTargetCategoryId(null);
        // The confirm re-reads the fresh counts and stays open; with no fresh
        // preview (the category is gone) it closes.
        if (!fresh) closeDelete();
        await load();
        setSaveError(SAVE_ERROR);
        AccessibilityInfo.announceForAccessibility(SAVE_ERROR);
        return;
      }
      setSaveError(SAVE_ERROR);
      AccessibilityInfo.announceForAccessibility(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = (
    row: CategoryManagementRow,
    index: number,
    action: RowAction,
  ) => {
    if (readbackPending) return;
    if (action === "rename") {
      setNameError(null);
      setEditor({ kind: "rename", row, name: row.name });
      return;
    }
    if (action === "delete") {
      void beginDelete(row);
      return;
    }
    const to = action === "up" ? index - 1 : index + 1;
    void persistOrder(moveCategoryRows(rows, index, to), to);
  };
  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    void persistOrder(moveCategoryRows(rows, from, to), to);
  };

  const targetName =
    targetCategoryId === null
      ? "Uncategorized"
      : (deletePreview?.targets.find((target) => target.id === targetCategoryId)
          ?.name ?? "Uncategorized");

  if (initialLoading)
    return (
      <View testID="category-management-screen" style={styles.root}>
        <ShellAppBar variant="child" title="Categories" />
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator
            accessibilityLabel="Loading categories"
            accessibilityState={{ busy: true }}
            color={colors.accentText}
          />
        </View>
      </View>
    );

  return (
    <View testID="category-management-screen" style={styles.root}>
      <ShellAppBar variant="child" title="Categories" />
      {loadError ? (
        <View style={styles.loading}>
          <AppText
            accessibilityLiveRegion="polite"
            style={{ color: colors.danger }}
          >
            {LOAD_ERROR}
          </AppText>
          <Button
            role="secondary"
            label="Try again"
            onPress={() => {
              if (readbackPending) void retryReadback();
              else {
                setInitialLoading(true);
                void load();
              }
            }}
          />
        </View>
      ) : (
        <View style={styles.content}>
          {saveError ? (
            <AppText
              accessibilityLiveRegion="polite"
              style={{ color: colors.danger }}
            >
              {saveError}
            </AppText>
          ) : null}
          <Button
            role="primary"
            label="+ Add Category"
            disabled={saving || reordering || readbackPending !== null}
            onPress={() => {
              setNameError(null);
              setEditor({ kind: "add", name: "" });
            }}
          />
          <ReorderableList
            data={rows}
            keyExtractor={(row) => row.uid}
            onReorder={onReorder}
            scrollEnabled
            contentContainerStyle={[
              styles.list,
              { paddingBottom: bottomClearance },
            ]}
            renderItem={({
              item,
              index,
            }: ReorderableListRenderItemInfo<CategoryManagementRow>) => (
              <CategoryRow
                row={item}
                index={index}
                total={rows.length}
                disabled={saving || reordering || readbackPending !== null}
                onAction={(action) => handleAction(item, index, action)}
              />
            )}
            ListEmptyComponent={
              <View>
                <AppText role="heading">
                  {CATEGORY_MANAGER_COPY.emptyHeading}
                </AppText>
                <AppText style={{ color: colors.textSecondary }}>
                  {CATEGORY_MANAGER_COPY.emptyBody}
                </AppText>
              </View>
            }
            ListFooterComponent={
              <View
                style={[styles.uncategorized, { borderColor: colors.border }]}
              >
                <AppText role="heading">Uncategorized</AppText>
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  {categoryCountLabel(uncategorizedCount)}
                </AppText>
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  {CATEGORY_MANAGER_COPY.uncategorizedBody}
                </AppText>
              </View>
            }
            testID={
              reducedMotion ? "category-list-reduced-motion" : "category-list"
            }
          />
        </View>
      )}
      <Sheet
        visible={editor !== null}
        onRequestClose={() => {
          if (!saving && !readbackPending) setEditor(null);
        }}
      >
        {editor ? (
          <View style={styles.sheetBody}>
            <AppText role="heading">
              {editor.kind === "add" ? "Add category" : "Rename category"}
            </AppText>
            <TextInput
              autoFocus
              accessibilityLabel="Category name"
              value={editor.name}
              onChangeText={(name) => {
                setEditor({ ...editor, name });
                setNameError(null);
              }}
              editable={!saving && !readbackPending}
              maxLength={101}
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border },
              ]}
            />
            {nameError ? (
              <AppText
                accessibilityLiveRegion="polite"
                role="caption"
                style={{ color: colors.danger }}
              >
                {nameError}
              </AppText>
            ) : null}
            {readbackPending?.finalize === "editor" ? (
              <View style={styles.recovery}>
                <AppText
                  accessibilityLiveRegion="polite"
                  style={{ color: colors.danger }}
                >
                  {LOAD_ERROR}
                </AppText>
                <Button
                  role="secondary"
                  label="Try again"
                  disabled={saving}
                  onPress={() => void retryReadback()}
                />
              </View>
            ) : null}
            <Button
              role="secondary"
              label={
                editor.kind === "add"
                  ? "Discard new category"
                  : "Keep current name"
              }
              disabled={saving || readbackPending !== null}
              onPress={() => setEditor(null)}
            />
            <Button
              role="primary"
              label={editor.kind === "add" ? "Add category" : "Save name"}
              disabled={saving || readbackPending !== null}
              onPress={() => void submitEditor()}
            />
          </View>
        ) : null}
      </Sheet>
      <CategoryChoiceSheet
        visible={targetChoiceOpen && !readbackPending}
        categories={deletePreview?.targets ?? []}
        selectedId={targetCategoryId}
        excludeCategoryId={deletePreview?.category.id}
        title="Move contacts to"
        onSelect={setTargetCategoryId}
        onRequestClose={() => setTargetChoiceOpen(false)}
      />
      {/* The one delete confirm (D-73): plain counts, the target choice and a
          details toggle; destructive and non-dismissable, so Back and the
          scrim are inert (38.9 D-06) and one Cancel leaves it. */}
      <ConfirmDialog
        visible={deleteConfirmOpen}
        onRequestClose={() => {}}
        destructive
        title={`Delete ${deletePreview?.category.name ?? "category"}?`}
        message={
          deletePreview
            ? categoryDeleteMessage(deletePreview.counts, targetName)
            : undefined
        }
        confirmLabel="Delete category"
        cancelLabel="Cancel"
        confirmDisabled={saving || readbackPending !== null}
        onCancel={() => {
          if (!readbackPending) closeDelete();
        }}
        onConfirm={() => void commitDelete()}
      >
        {deletePreview && !isUnusedCategoryPreview(deletePreview.counts) ? (
          <View style={styles.deleteContent}>
            {categoryMovingCount(deletePreview.counts) > 0 ? (
              <>
                <AppText role="label">Move contacts to</AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Move contacts to ${targetName}. Choose another category`}
                  disabled={saving || readbackPending !== null}
                  onPress={() => setTargetChoiceOpen(true)}
                  style={[styles.choice, { borderColor: colors.border }]}
                >
                  <AppText>{targetName}</AppText>
                </Pressable>
              </>
            ) : null}
            <Pressable
              testID="category-delete-details-toggle"
              accessibilityRole="button"
              accessibilityState={{ expanded: deleteDetailsShown }}
              onPress={() => setDeleteDetailsShown((shown) => !shown)}
              style={styles.detailsToggle}
            >
              <AppText role="label" style={{ color: colors.accentText }}>
                {deleteDetailsShown ? "Hide details" : "Show details"}
              </AppText>
            </Pressable>
            {deleteDetailsShown ? (
              <View style={styles.deleteContent}>
                <AppText role="body">This deletion affects:</AppText>
                {deletionImpactRows(deletePreview.counts).map((label) => (
                  <AppText key={label} role="caption">
                    {label}
                  </AppText>
                ))}
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  Pending, completed, and discarded imports move to the same
                  target. Only this category’s rule or reference is removed from
                  each custom System; unrelated rules stay. An emptied invalid
                  System becomes Needs Attention. Profile and saved presentation
                  settings are removed, not transferred.
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
        {saveError && deleteConfirmOpen ? (
          <AppText
            accessibilityLiveRegion="polite"
            style={{ color: colors.danger }}
          >
            {saveError}
          </AppText>
        ) : null}
        {readbackPending?.finalize === "delete" ? (
          <View style={styles.recovery}>
            <AppText
              accessibilityLiveRegion="polite"
              style={{ color: colors.danger }}
            >
              {LOAD_ERROR}
            </AppText>
            <Button
              role="secondary"
              label="Try again"
              disabled={saving}
              onPress={() => void retryReadback()}
            />
          </View>
        ) : null}
      </ConfirmDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.base,
  },
  content: { flex: 1, padding: SPACING.base, gap: SPACING.lg },
  list: { gap: SPACING.md, paddingBottom: SPACING.xl },
  row: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.base,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  iconTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1, gap: SPACING.xs },
  uncategorized: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: SPACING.xs,
  },
  sheetBody: { gap: SPACING.base },
  recovery: { gap: SPACING.sm },
  deleteContent: { gap: SPACING.sm },
  detailsToggle: { minHeight: 44, justifyContent: "center" },
  choice: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    justifyContent: "center",
    paddingHorizontal: SPACING.base,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.base,
  },
});
