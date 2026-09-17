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
    "%s uses shared threshold, sheet, canonical copy, and focus refresh",
    (name) => {
      const source = read(name);
      expect(source).toContain("CATEGORY_SEARCH_THRESHOLD");
      expect(source).toContain("CategoryChoiceSheet");
      expect(source).toContain("Uncategorized");
      expect(source).not.toContain('label="No category"');
      expect(source).toContain("useFocusEffect");
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
});
