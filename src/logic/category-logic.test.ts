import { describe, expect, it } from "vitest";
import {
  CATEGORY_NAME_MAX_LENGTH,
  categoryNameKey,
  normalizeCategoryName,
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
