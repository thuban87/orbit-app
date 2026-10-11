/**
 * CategoryChoiceSheet — the category chooser. Since 38.9 D-28 it is a thin
 * wrapper over the shared `OptionSheet`: it owns only the category policy
 * (eligible rows, the optional Uncategorized row, exclusions, search above
 * `CATEGORY_SEARCH_THRESHOLD` real categories, the category copy) and hands
 * the rows to the one themed option sheet. `categoryChoiceSheetModel` stays
 * the tested policy seam.
 */
import { useMemo } from "react";
import { OptionSheet } from "@/components/ui/OptionSheet";
import {
  buildCategoryChoices,
  type CategoryChoice,
  type CategoryChoiceRow,
  filterCategoryChoices,
} from "@/logic/category-logic";

/** The no-match copy for a category search (one definition). */
export function categoryNoMatchCopy(query: string): string {
  return `No categories match \u201c${query.trim()}\u201d.`;
}

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
  // An exclusion applies only when it is set: rows from listCategories() carry
  // no uid, so comparing undefined uids would drop every category (D-72).
  const eligible = categories.filter(
    (category) =>
      (excludeCategoryId === undefined || category.id !== excludeCategoryId) &&
      (excludeCategoryUid === undefined || category.uid !== excludeCategoryUid),
  );
  const choices = buildCategoryChoices(eligible, allowUncategorized);
  const effectiveQuery = choices.searchable ? query : "";
  return {
    selectedId,
    searchable: choices.searchable,
    rows: filterCategoryChoices(choices.rows, effectiveQuery),
    emptyCopy: categoryNoMatchCopy(effectiveQuery),
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
  // The unfiltered policy rows; OptionSheet applies the search query with the
  // same trimmed, NFC, case-insensitive rule as filterCategoryChoices.
  const model = useMemo(
    () =>
      categoryChoiceSheetModel({
        categories,
        selectedId,
        query: "",
        allowUncategorized,
        excludeCategoryId,
        excludeCategoryUid,
      }),
    [
      categories,
      selectedId,
      allowUncategorized,
      excludeCategoryId,
      excludeCategoryUid,
    ],
  );
  const options = useMemo(
    () =>
      model.rows.map((row) => ({
        value: row.id,
        label: row.name,
        accessibilityLabel: getAccessibilityLabel?.(row),
      })),
    [model.rows, getAccessibilityLabel],
  );

  return (
    <OptionSheet
      visible={visible}
      title={title}
      options={options}
      selected={selectedId}
      searchable={model.searchable}
      searchLabel="Search categories"
      emptyText={categoryNoMatchCopy}
      onSelect={onSelect}
      onRequestClose={onRequestClose}
    />
  );
}
