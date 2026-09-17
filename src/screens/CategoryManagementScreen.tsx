// biome-ignore-all lint/a11y/useValidAriaRole: Button's role is a visual domain variant.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import {
  type CategoryManagementRow,
  createCategory,
  listCategoriesForManagement,
} from "@/db/categories-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { validateCategoryName } from "@/logic/category-logic";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

const LOAD_ERROR = "Couldn't load categories. Please try again.";
const SAVE_ERROR = "Couldn't save this category. Please try again.";

export function createCategoryManagementLoadGuard() {
  let generation = 0;
  return () => {
    const request = ++generation;
    return () => request === generation;
  };
}

export function CategoryManagementScreen() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<CategoryManagementRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nextLoad = useRef(createCategoryManagementLoadGuard());

  const load = useCallback(async () => {
    const current = nextLoad.current();
    try {
      const loaded = await listCategoriesForManagement(getExecutor());
      if (!current()) return;
      setRows(loaded);
      setError(null);
    } catch {
      if (current()) setError(LOAD_ERROR);
    } finally {
      if (current()) setInitialLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submit = async () => {
    if (saving) return;
    const validation = validateCategoryName(name, {
      categoryNames: rows,
      systemNames: [],
    });
    if (!validation.ok) {
      setNameError(validation.message);
      return;
    }
    setSaving(true);
    setNameError(null);
    try {
      await createCategory(getExecutor(), { name, now: localDateTime() });
      await load();
      setAddOpen(false);
      setName("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : SAVE_ERROR;
      setNameError(/category name|System/.test(message) ? message : SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID="category-management-screen" style={styles.root}>
      <ShellAppBar variant="child" title="Categories" />
      {initialLoading ? (
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator
            accessibilityLabel="Loading categories"
            accessibilityState={{ busy: true }}
            color={colors.accent}
          />
        </View>
      ) : (
        <View style={styles.content}>
          {error ? (
            <AppText
              accessibilityLiveRegion="polite"
              style={{ color: colors.danger }}
            >
              {error}
            </AppText>
          ) : null}
          <Button
            role="primary"
            label="+ Add Category"
            onPress={() => setAddOpen(true)}
          />
          <ScrollView contentContainerStyle={styles.list}>
            {rows.length === 0 ? (
              <AppText style={{ color: colors.textSecondary }}>
                No categories yet. Add one when you’re ready.
              </AppText>
            ) : null}
            {rows.map((row) => (
              <View
                key={row.uid}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.rowContent}>
                  <AppText role="heading" numberOfLines={2}>
                    {row.name}
                  </AppText>
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    {row.contactCount}{" "}
                    {row.contactCount === 1 ? "contact" : "contacts"}
                  </AppText>
                </View>
              </View>
            ))}
            <View
              style={[styles.uncategorized, { borderColor: colors.border }]}
            >
              <AppText role="heading">Uncategorized</AppText>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Contacts without a category stay here.
              </AppText>
            </View>
          </ScrollView>
        </View>
      )}
      <Sheet
        visible={addOpen}
        onRequestClose={() => !saving && setAddOpen(false)}
      >
        <View style={styles.sheetBody}>
          <AppText role="heading">Add category</AppText>
          <TextInput
            autoFocus
            accessibilityLabel="Category name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setNameError(null);
            }}
            editable={!saving}
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
            label="Discard new category"
            disabled={saving}
            onPress={() => setAddOpen(false)}
          />
          <Button
            role="primary"
            label="Add category"
            disabled={saving}
            onPress={() => void submit()}
          />
        </View>
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
  },
  content: { flex: 1, padding: SPACING.base, gap: SPACING.lg },
  list: { gap: SPACING.md, paddingBottom: SPACING.xl },
  row: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: RADII.md,
    padding: SPACING.md,
    flexDirection: "row",
  },
  rowContent: { flex: 1, gap: SPACING.xs },
  uncategorized: {
    marginTop: SPACING.md,
    paddingTop: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: SPACING.xs,
  },
  sheetBody: { gap: SPACING.md },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
  },
});
