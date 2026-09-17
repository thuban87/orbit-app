import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Profile category presentation manager contract", () => {
  for (const file of [
    "ProfileTemplateManager.tsx",
    "ProfileBackgroundManager.tsx",
  ]) {
    it(`${file} uses a bounded real-category chooser with a zero state`, () => {
      const source = readFileSync(`src/components/profile/${file}`, "utf8");
      expect(source).toContain("<CategoryChoiceSheet");
      expect(source).toContain("allowUncategorized={false}");
      expect(source).toContain("No categories available");
      expect(source).not.toMatch(/categories\.map\(\(category\)/);
    });
  }
});
