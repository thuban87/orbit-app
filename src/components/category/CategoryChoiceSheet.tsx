/**
 * CategoryChoiceSheet — the category chooser. Since 38.9 D-28 it is a thin
 * wrapper over the shared `OptionSheet`: it owns only the category policy
 * (eligible rows, the optional Uncategorized row, exclusions, search above
 * `CATEGORY_SEARCH_THRESHOLD` real categories, the category copy) and hands
 * the rows to the one themed option sheet. `categoryChoiceSheetModel` stays
 * the tested policy seam.
 *
 * `sizeToContent` (38.13 D-71, D-78; the bulk Set Category sheet only): the
 * sheet opens at the size its own unfiltered rows need, Uncategorized
 * included: compact for a short list, detail for a medium one, and today's
 * expanded sheet for a long one. Without it, nothing changes.
 */
import { useMemo } from "react";
import { OptionSheet } from "@/components/ui/OptionSheet";
import { optionSheetVariantFor } from "@/components/ui/option-sheet-logic";
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
  /** Open at the size the list needs (D-71, D-78). Default false. */
  sizeToContent?: boolean;
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
  sizeToContent = false,
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

  // Decided from the unfiltered rows, so typing a search never resizes it.
  const variant = sizeToContent
    ? optionSheetVariantFor(model.rows.length)
    : "expanded";
  const size = variant === "expanded" ? undefined : variant;

  return (
    <OptionSheet
      visible={visible}
      title={title}
      options={options}
      selected={selectedId}
      searchable={model.searchable}
      searchLabel="Search categories"
      emptyText={categoryNoMatchCopy}
      size={size}
      onSelect={onSelect}
      onRequestClose={onRequestClose}
    />
  );
}
