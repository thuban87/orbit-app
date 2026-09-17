import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Dashboard category integration contract", () => {
  const home = readFileSync("src/screens/HomeScreen.tsx", "utf8");
  const controls = readFileSync(
    "src/components/control-surface/DashboardControlRow.tsx",
    "utf8",
  );

  it("uses the complete searchable shared chooser and revalidates before bulk writes", () => {
    expect(home).toContain("<CategoryChoiceSheet");
    expect(home).toMatch(/listCategories\(getExecutor\(\)\)\s*\.then/);
    expect(home).toContain('throw new Error("Category no longer exists")');
    expect(home).toMatch(
      /bulkSetCategory\(\s*getExecutor\(\),\s*ids,\s*categoryId/,
    );
  });

  it("reconciles filters after shell category mutations", () => {
    expect(controls).toContain("useShellRefresh");
    expect(controls).toContain("delete filters.category");
    expect(controls).toContain("setFilters(getExecutor(), filters)");
  });
});
