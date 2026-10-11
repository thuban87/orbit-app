/**
 * Back acts like Done on the completion screens (owner ruling 38.9 D-73;
 * review WR-07).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));
vi.mock("react-native", () => ({
  BackHandler: { addEventListener: () => ({ remove: () => {} }) },
}));

const { completionBackHandler } = await import("./back-acts-as-done");

describe("completionBackHandler (D-73)", () => {
  it("runs Done and consumes system Back", () => {
    const done = vi.fn();
    expect(completionBackHandler(done, () => false)()).toBe(true);
    expect(done).toHaveBeenCalledOnce();
  });

  it("lets an open shell transient close first (RootNavigator handles it)", () => {
    const done = vi.fn();
    expect(completionBackHandler(done, () => true)()).toBe(false);
    expect(done).not.toHaveBeenCalled();
  });
});

describe("Import complete and Check complete wire Back to Done (D-73)", () => {
  for (const [file, title] of [
    ["src/screens/ImportCompleteScreen.tsx", "Import complete"],
    ["src/screens/ReconcileCompleteScreen.tsx", "Check complete"],
  ] as const) {
    const source = readFileSync(join(__dirname, "../..", file), "utf8");

    it(`${title}: header Back, system Back and Done share one done()`, () => {
      expect(source).toMatch(
        /const done = useCallback\(\s*\(\) => navigationRef\.current\?\.reset\(resetToDashboardRoot\(\)\),/,
      );
      expect(source).toContain("useBackActsAsDone(done);");
      expect(source).toContain(
        `<ShellAppBar variant="child" title="${title}" onBack={done} />`,
      );
      expect(source).toMatch(/accessibilityLabel="Done"\s*onPress=\{done\}/);
    });
  }
});
