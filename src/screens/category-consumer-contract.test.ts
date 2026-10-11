import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(join(process.cwd(), "src", "screens", name), "utf8");

describe("category consumer integration contract", () => {
  const consumers = [
    "CreateContactScreen.tsx",
    "EditContactScreen.tsx",
    "BulkImportSetupScreen.tsx",
    "ImportReviewScreen.tsx",
  ];

  it.each(consumers)(
    "%s uses the themed category sheet at every length, canonical copy, and focus refresh",
    (name) => {
      const source = read(name);
      // 38.9 D-28: the category sheet opens from a themed trigger at every list
      // length; CATEGORY_SEARCH_THRESHOLD now only decides the sheet's search
      // field (inside CategoryChoiceSheet), so screens no longer branch on it.
      expect(source).not.toContain("CATEGORY_SEARCH_THRESHOLD");
      expect(source).not.toContain("@react-native-picker/picker");
      expect(source).not.toMatch(/<Picker\b/);
      expect(source).toContain("<OptionSelectRow");
      expect(source).toContain("onPress={() => setCategorySheetOpen(true)}");
      expect(source).toContain("CategoryChoiceSheet");
      expect(source).toContain("Uncategorized");
      expect(source).not.toContain('label="No category"');
      expect(source).toMatch(/useFocusEffect|useCategoryCatalogRefresh/);
    },
  );

  it.each(consumers)(
    "%s revalidates the selected ID from current DAO truth before writing",
    (name) => {
      const source = read(name);
      expect(source).toContain("resolveCategorySelection");
      expect(source).toMatch(/await listCategories\(exec\)/);
    },
  );

  it("does not expose category management affordances from ordinary consumers", () => {
    for (const name of consumers) {
      const source = read(name);
      expect(source).not.toMatch(
        /Add Category|Rename category|Delete category/,
      );
    }
  });

  it.each([
    "CreateContactScreen.tsx",
    "EditContactScreen.tsx",
    "ImportReviewScreen.tsx",
  ])(
    "%s routes initial and focus publication through the shared authority",
    (name) => {
      const source = read(name);
      expect(source).toContain("useCategoryCatalogRefresh");
      expect(source).toContain("requestInitialCategories");
      expect(source).not.toMatch(/useFocusEffect[\s\S]{0,500}listCategories/);
    },
  );
});
