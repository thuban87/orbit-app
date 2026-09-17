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
import { Icon } from "@/components/icons/Icon";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AnchoredMenu,
  type AnchoredMenuItem,
} from "@/components/ui/AnchoredMenu";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import {
  type CategoryManagementRow,
  countUncategorizedContacts,
  createCategory,
  listCategoriesForManagement,
  renameCategory,
  reorderCategories,
} from "@/db/categories-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { validateCategoryName } from "@/logic/category-logic";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { useReducedMotion } from "@/theme/use-reduced-motion";

const LOAD_ERROR = "Couldn't load categories. Please try again.";
const SAVE_ERROR = "Couldn't save this category. Please try again.";
const REORDER_ERROR =
  "Couldn't save the new category order. The previous order was restored.";
type Editor =
  | { kind: "add"; name: string }
  | { kind: "rename"; row: CategoryManagementRow; name: string };
type RowAction = "rename" | "earlier" | "later" | "delete";

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
            id: "earlier",
            label: "Move earlier",
            icon: "sort" as const,
            onPress: () => onAction("earlier"),
          },
        ]
      : []),
    ...(index < total - 1
      ? [
          {
            id: "later",
            label: "Move later",
            icon: "sort" as const,
            onPress: () => onAction("later"),
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
  const nextLoad = useRef(createCategoryManagementLoadGuard());

  const load = useCallback(async () => {
    const current = nextLoad.current();
    try {
      const exec = getExecutor();
      const [loaded, fallbackCount] = await Promise.all([
        listCategoriesForManagement(exec),
        countUncategorizedContacts(exec),
      ]);
      if (!current()) return;
      committedRows.current = loaded;
      setRows(loaded);
      setUncategorizedCount(fallbackCount);
      setLoadError(false);
    } catch {
      if (current()) setLoadError(true);
    } finally {
      if (current()) setInitialLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const publishSuccess = (label: string) => {
    bumpShellRefresh();
    showSnackbar({ kind: "success", label });
  };

  const submitEditor = async () => {
    if (!editor || saving) return;
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
      await load();
      publishSuccess(
        editor.kind === "add" ? "Category added." : "Category renamed.",
      );
      setEditor(null);
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
    if (reordering) return;
    setReordering(true);
    setRows(next);
    setSaveError(null);
    try {
      await reorderCategories(getExecutor(), {
        orderedIds: next.map((row) => row.id),
        now: localDateTime(),
      });
      committedRows.current = next;
      bumpShellRefresh();
      const moved = next[movedIndex];
      if (moved)
        AccessibilityInfo.announceForAccessibility(
          `${moved.name}, position ${movedIndex + 1} of ${next.length}`,
        );
    } catch {
      setRows(committedRows.current);
      setSaveError(REORDER_ERROR);
      AccessibilityInfo.announceForAccessibility(REORDER_ERROR);
    } finally {
      setReordering(false);
    }
  };

  const handleAction = (
    row: CategoryManagementRow,
    index: number,
    action: RowAction,
  ) => {
    if (action === "rename") {
      setNameError(null);
      setEditor({ kind: "rename", row, name: row.name });
      return;
    }
    if (action === "delete") return;
    const to = action === "earlier" ? index - 1 : index + 1;
    void persistOrder(moveCategoryRows(rows, index, to), to);
  };
  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    void persistOrder(moveCategoryRows(rows, from, to), to);
  };

  if (initialLoading)
    return (
      <View testID="category-management-screen" style={styles.root}>
        <ShellAppBar variant="child" title="Categories" />
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator
            accessibilityLabel="Loading categories"
            accessibilityState={{ busy: true }}
            color={colors.accent}
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
              setInitialLoading(true);
              void load();
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
            disabled={saving || reordering}
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
            contentContainerStyle={styles.list}
            renderItem={({
              item,
              index,
            }: ReorderableListRenderItemInfo<CategoryManagementRow>) => (
              <CategoryRow
                row={item}
                index={index}
                total={rows.length}
                disabled={saving || reordering}
                onAction={(action) => handleAction(item, index, action)}
              />
            )}
            ListEmptyComponent={
              <AppText style={{ color: colors.textSecondary }}>
                No categories yet. Add one when you’re ready.
              </AppText>
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
                  Contacts without a category stay here.
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
          if (!saving) setEditor(null);
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
              editable={!saving}
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
            <Button
              role="secondary"
              label={
                editor.kind === "add"
                  ? "Discard new category"
                  : "Keep current name"
              }
              disabled={saving}
              onPress={() => setEditor(null)}
            />
            <Button
              role="primary"
              label={editor.kind === "add" ? "Add category" : "Save name"}
              disabled={saving}
              onPress={() => void submitEditor()}
            />
          </View>
        ) : null}
      </Sheet>
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
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.base,
  },
});
