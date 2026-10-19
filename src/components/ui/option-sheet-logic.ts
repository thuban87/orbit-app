/**
 * Option sheet model (38.9 D-28). PURE — no react-native import,
 * node-testable. `OptionSheet` renders what this returns.
 *
 * One themed single-choice sheet serves every list length. The category
 * threshold (`CATEGORY_SEARCH_THRESHOLD`) no longer chooses a native spinner
 * versus the themed sheet; it only decides whether the sheet shows a search
 * field (`shouldSearch`).
 *
 * Search matches the option label, trimmed, NFC-normalised and
 * case-insensitive — the same rule as `filterCategoryChoices`, so category
 * search behaves as it did. A selected value that is filtered out, or not
 * listed at all, is never cleared: the model only marks rows, it never
 * rewrites the selection. Out-of-list stored values (custom-field dropdowns)
 * are listed by the caller through `selectorItems` (RG-030), not here.
 */
import { CATEGORY_SEARCH_THRESHOLD } from "@/logic/category-logic";

/**
 * Sized-to-content option sheets (38.13 D-71, D-78; this plan's tunables): a
 * caller that opts in opens its sheet at the size its list needs, decided when
 * it opens. Up to this many rows open at the compact size...
 */
export const OPTION_SHEET_COMPACT_MAX_ROWS = 5;
/** ...up to this many at the detail size; longer lists open expanded. */
export const OPTION_SHEET_DETAIL_MAX_ROWS = 10;

/** The sheet size an opted-in option sheet opens at for `count` rows. */
export function optionSheetVariantFor(
  count: number,
): "compact" | "detail" | "expanded" {
  if (count <= OPTION_SHEET_COMPACT_MAX_ROWS) return "compact";
  if (count <= OPTION_SHEET_DETAIL_MAX_ROWS) return "detail";
  return "expanded";
}

/** The value types an option sheet can choose between. */
export type OptionValue = string | number | null;

export interface OptionSheetOption<T extends OptionValue> {
  value: T;
  label: string;
  /** Overrides the row's spoken name; defaults to `label`. */
  accessibilityLabel?: string;
}

export interface OptionSheetRow<T extends OptionValue>
  extends OptionSheetOption<T> {
  selected: boolean;
}

export interface OptionSheetModel<T extends OptionValue> {
  rows: OptionSheetRow<T>[];
  /** The trimmed query actually applied ("" when not searchable). */
  query: string;
}

/** Whether a list of `count` options shows the search field. */
export function shouldSearch(
  count: number,
  threshold: number = CATEGORY_SEARCH_THRESHOLD,
): boolean {
  return count > threshold;
}

function searchKey(text: string): string {
  return text.trim().normalize("NFC").toLowerCase();
}

export function optionSheetModel<T extends OptionValue>({
  options,
  selected,
  query,
  searchable,
}: {
  options: readonly OptionSheetOption<T>[];
  selected: T | OptionValue;
  query: string;
  searchable: boolean;
}): OptionSheetModel<T> {
  const applied = searchable ? query.trim() : "";
  const key = searchKey(applied);
  const visible = key
    ? options.filter((option) => searchKey(option.label).includes(key))
    : options;
  return {
    rows: visible.map((option) => ({
      ...option,
      selected: option.value === selected,
    })),
    query: applied,
  };
}

/** A stable list key that keeps null, numbers and strings apart. */
export function optionKey(value: OptionValue): string {
  return value === null ? "null:" : `${typeof value}:${value}`;
}
