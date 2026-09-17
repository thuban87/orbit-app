/** Shared, renderer-independent category naming and catalog policy. */

export const CATEGORY_NAME_MAX_LENGTH = 100;
export const CATEGORY_SEARCH_THRESHOLD = 12;

export interface CategoryChoice {
  id: number;
  uid?: string;
  name: string;
}

export interface CategoryChoiceRow {
  id: number | null;
  uid?: string;
  name: string;
}

export function buildCategoryChoices(
  categories: readonly CategoryChoice[],
  allowUncategorized: boolean,
): { rows: CategoryChoiceRow[]; searchable: boolean } {
  const rows: CategoryChoiceRow[] = [...categories];
  if (allowUncategorized) rows.push({ id: null, name: "Uncategorized" });
  return {
    rows,
    searchable: categories.length > CATEGORY_SEARCH_THRESHOLD,
  };
}

export function filterCategoryChoices(
  rows: readonly CategoryChoiceRow[],
  query: string,
): CategoryChoiceRow[] {
  const key = query.trim().normalize("NFC").toLowerCase();
  if (!key) return [...rows];
  return rows.filter((row) =>
    row.name.normalize("NFC").toLowerCase().includes(key),
  );
}

/** A persisted ID is selectable only while it exists in current DAO truth. */
export function resolveCategorySelection(
  categories: readonly CategoryChoice[],
  selectedId: number | null,
): number | null {
  if (selectedId === null) return null;
  return categories.some((category) => category.id === selectedId)
    ? selectedId
    : null;
}

export type CategoryNameCandidate = string | { id: number; name: string };

export function normalizeCategoryName(name: string): string {
  return name.trim().normalize("NFC");
}

/** Deliberately locale-independent: device locale must not change identity. */
export function categoryNameKey(name: string): string {
  return normalizeCategoryName(name).toLowerCase();
}

export type CategoryNameValidation =
  | { ok: true; name: string }
  | { ok: false; message: string };

export function validateCategoryName(
  input: string,
  options: {
    categoryNames: readonly CategoryNameCandidate[];
    systemNames: readonly string[];
    excludeCategoryId?: number;
  },
): CategoryNameValidation {
  const name = normalizeCategoryName(input);
  if (!name) return { ok: false, message: "Enter a category name." };
  if ([...name].length > CATEGORY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: "Category names can be up to 100 characters.",
    };
  }
  const key = categoryNameKey(name);
  const duplicate = options.categoryNames.some((candidate) => {
    const row = typeof candidate === "string" ? null : candidate;
    if (row && row.id === options.excludeCategoryId) return false;
    return categoryNameKey(row?.name ?? (candidate as string)) === key;
  });
  if (duplicate) {
    return {
      ok: false,
      message: "A category with this name already exists.",
    };
  }
  if (
    options.systemNames.some((candidate) => categoryNameKey(candidate) === key)
  ) {
    return { ok: false, message: "That name is already used by a System." };
  }
  return { ok: true, name };
}
