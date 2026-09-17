import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText, Sheet } from "@/components/ui";
import {
  buildCategoryChoices,
  type CategoryChoice,
  type CategoryChoiceRow,
  filterCategoryChoices,
} from "@/logic/category-logic";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

interface CategoryChoiceSheetModelInput {
  categories: readonly CategoryChoice[];
  selectedId: number | null;
  query: string;
  allowUncategorized: boolean;
  excludeCategoryId?: number;
  excludeCategoryUid?: string;
}

export function categoryChoiceSheetModel({
  categories,
  selectedId,
  query,
  allowUncategorized,
  excludeCategoryId,
  excludeCategoryUid,
}: CategoryChoiceSheetModelInput) {
  const eligible = categories.filter(
    (category) =>
      category.id !== excludeCategoryId && category.uid !== excludeCategoryUid,
  );
  const choices = buildCategoryChoices(eligible, allowUncategorized);
  const effectiveQuery = choices.searchable ? query : "";
  return {
    selectedId,
    searchable: choices.searchable,
    rows: filterCategoryChoices(choices.rows, effectiveQuery),
    emptyCopy: `No categories match \u201c${effectiveQuery.trim()}\u201d.`,
  };
}

export interface CategoryChoiceSheetProps {
  visible: boolean;
  categories: readonly CategoryChoice[];
  selectedId: number | null;
  allowUncategorized?: boolean;
  excludeCategoryId?: number;
  excludeCategoryUid?: string;
  title?: string;
  getAccessibilityLabel?: (category: CategoryChoiceRow) => string;
  onSelect: (categoryId: number | null) => void;
  onRequestClose: () => void;
}

export function CategoryChoiceSheet({
  visible,
  categories,
  selectedId,
  allowUncategorized = true,
  excludeCategoryId,
  excludeCategoryUid,
  title = "Choose category",
  getAccessibilityLabel,
  onSelect,
  onRequestClose,
}: CategoryChoiceSheetProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);
  const model = useMemo(
    () =>
      categoryChoiceSheetModel({
        categories,
        selectedId,
        query,
        allowUncategorized,
        excludeCategoryId,
        excludeCategoryUid,
      }),
    [
      categories,
      selectedId,
      query,
      allowUncategorized,
      excludeCategoryId,
      excludeCategoryUid,
    ],
  );

  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} variant="expanded">
      <View style={styles.root}>
        <AppText role="heading" accessibilityRole="header">
          {title}
        </AppText>
        <TextInput
          accessibilityLabel="Search categories"
          value={query}
          onChangeText={setQuery}
          placeholder="Search categories"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.search,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        />
        <FlatList
          data={model.rows}
          keyExtractor={(row) =>
            row.id === null ? "uncategorized" : String(row.id)
          }
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <AppText style={{ color: colors.textSecondary }}>
              {model.emptyCopy}
            </AppText>
          }
          renderItem={({ item }) => {
            const selected = item.id === model.selectedId;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={getAccessibilityLabel?.(item) ?? item.name}
                accessibilityState={{ selected }}
                onPress={() => {
                  onSelect(item.id);
                  onRequestClose();
                }}
                style={[
                  styles.row,
                  {
                    backgroundColor: selected ? colors.accent : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <AppText
                  style={{
                    color: selected ? colors.background : colors.textPrimary,
                  }}
                >
                  {item.name}
                </AppText>
              </Pressable>
            );
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: SPACING.md },
  search: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
  },
  row: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
});
