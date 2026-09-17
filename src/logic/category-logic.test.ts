import { describe, expect, it } from "vitest";
import {
  CATEGORY_NAME_MAX_LENGTH,
  CATEGORY_SEARCH_THRESHOLD,
  buildCategoryChoices,
  categoryNameKey,
  filterCategoryChoices,
  normalizeCategoryName,
  resolveCategorySelection,
  validateCategoryName,
} from "./category-logic";

describe("category name contract", () => {
  it("trims and NFC-normalizes display names", () => {
    expect(normalizeCategoryName("  Cafe\u0301  ")).toBe("Café");
  });

  it("uses locale-independent Unicode case folding", () => {
    expect(categoryNameKey("İSTANBUL")).toBe("i̇stanbul");
    expect(categoryNameKey("İSTANBUL")).toBe(
      normalizeCategoryName("İstanbul").toLowerCase(),
    );
  });

  it("returns the locked validation errors for blank, long, duplicate, and System names", () => {
    expect(
      validateCategoryName("   ", { categoryNames: [], systemNames: [] }),
    ).toEqual({
      ok: false,
      message: "Enter a category name.",
    });
    expect(
      validateCategoryName("x".repeat(CATEGORY_NAME_MAX_LENGTH + 1), {
        categoryNames: [],
        systemNames: [],
      }),
    ).toEqual({
      ok: false,
      message: "Category names can be up to 100 characters.",
    });
    expect(
      validateCategoryName(" friends ", {
        categoryNames: ["Friends"],
        systemNames: [],
      }),
    ).toEqual({
      ok: false,
      message: "A category with this name already exists.",
    });
    expect(
      validateCategoryName(" favorites ", {
        categoryNames: [],
        systemNames: ["Favorites"],
      }),
    ).toEqual({
      ok: false,
      message: "That name is already used by a System.",
    });
  });

  it("permits exactly 100 characters and capitalization-only rename", () => {
    expect(
      validateCategoryName("x".repeat(100), {
        categoryNames: [],
        systemNames: [],
      }).ok,
    ).toBe(true);
    expect(
      validateCategoryName("FRIENDS", {
        categoryNames: [{ id: 1, name: "Friends" }],
        systemNames: [],
        excludeCategoryId: 1,
      }),
    ).toEqual({ ok: true, name: "FRIENDS" });
  });
});

describe("category choice contract", () => {
  const categories = Array.from({ length: 13 }, (_, index) => ({
    id: index + 1,
    uid: `category-${index + 1}`,
    name: index === 12 ? "Caf\u00e9 Friends" : `Category ${index + 1}`,
  }));

  it("uses the expanded searchable surface only above twelve real categories", () => {
    expect(CATEGORY_SEARCH_THRESHOLD).toBe(12);
    expect(buildCategoryChoices(categories.slice(0, 12), true).searchable).toBe(
      false,
    );
    expect(buildCategoryChoices(categories, true).searchable).toBe(true);
  });

  it("preserves canonical order and pins the optional Uncategorized row last", () => {
    const withNull = buildCategoryChoices(categories, true);
    expect(withNull.rows.map((row) => row.id)).toEqual([
      ...categories.map((row) => row.id),
      null,
    ]);
    expect(withNull.rows.at(-1)?.name).toBe("Uncategorized");
    expect(buildCategoryChoices(categories, false).rows).toEqual(categories);
  });

  it("filters locally without truncation and clearing restores every row", () => {
    const rows = buildCategoryChoices(categories, true).rows;
    expect(filterCategoryChoices(rows, "CAF\u00c9")).toEqual([categories[12]]);
    expect(filterCategoryChoices(rows, "")).toEqual(rows);
    expect(filterCategoryChoices(rows, "missing")).toEqual([]);
  });

  it("resolves stale selections to null while retaining hidden valid selections", () => {
    expect(resolveCategorySelection(categories, 8)).toBe(8);
    expect(resolveCategorySelection(categories, 999)).toBeNull();
    expect(resolveCategorySelection(categories, null)).toBeNull();
  });
});
