/** Shared, renderer-independent category naming and catalog policy. */

export const CATEGORY_NAME_MAX_LENGTH = 100;
export const CATEGORY_SEARCH_THRESHOLD = 12;

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
