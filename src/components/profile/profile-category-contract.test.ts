import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Profile category presentation manager contract", () => {
  // 38.11 D-58: the Category background chooser moved from the Profile's
  // background sheet to the Settings Profile Backgrounds page.
  for (const file of [
    "src/components/profile/ProfileTemplateManager.tsx",
    "src/screens/ProfileBackgroundsScreen.tsx",
  ]) {
    it(`${file} uses a bounded real-category chooser with a zero state`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("<CategoryChoiceSheet");
      expect(source).toContain("allowUncategorized={false}");
      expect(source).toContain("No categories available");
      expect(source).not.toMatch(/categories\.map\(\(category\)/);
    });
  }
});
