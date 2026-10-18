import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isFocusedWorkflow } from "@/navigation/focused-route-classification";

/**
 * 38.12 DEF-01: a focused workflow hides the tab bar and the shell pads only
 * the top edge, so every focused route's screen must clear the system
 * navigation bar itself: its root through `useFocusedBottomInset`, or its own
 * safe-area handling (`useSafeAreaInsets`, the section FAB clearance, or the
 * Review matches list, which pads its list and bulk bar, D-WR-02).
 */
const ROOT = process.cwd();
const OWN_INSET =
  /useFocusedBottomInset|useSafeAreaInsets|useSectionFabClearance|<ReviewMatchesList\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(
    (entry) =>
      entry.isDirectory()
        ? sourceFiles(join(dir, entry.name))
        : entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
          ? [join(dir, entry.name)]
          : [],
  );
}

function focusedRouteComponents(): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const file of sourceFiles("src/navigation")) {
    const text = readFileSync(join(ROOT, file), "utf8");
    for (const match of text.matchAll(
      /name="(\w+)"[\s\S]{0,400}?component=\{(\w+)\}/g,
    ))
      if (isFocusedWorkflow(match[1])) pairs.push([match[1], match[2]]);
  }
  return pairs;
}

function definingFile(component: string): string {
  const pattern = new RegExp(
    `(?:export )?(?:default )?function ${component}\\b`,
  );
  const file = [
    ...sourceFiles("src/screens"),
    ...sourceFiles("src/components"),
    ...sourceFiles("src/navigation"),
  ].find((candidate) =>
    pattern.test(readFileSync(join(ROOT, candidate), "utf8")),
  );
  if (!file) throw new Error(`no file defines ${component}`);
  return file;
}

describe("focused workflows clear the system navigation bar (DEF-01)", () => {
  const routes = focusedRouteComponents();

  it("finds the focused routes", () => {
    expect(routes.length).toBeGreaterThanOrEqual(30);
  });

  it.each(routes)("%s (%s) applies the bottom safe-area inset", (_r, comp) => {
    let text = readFileSync(join(ROOT, definingFile(comp)), "utf8");
    // A thin route wrapper renders the screen defined beside it.
    const inner = new RegExp(
      `function ${comp}\\b[\\s\\S]*?<(\\w+Screen)\\b`,
    ).exec(text)?.[1];
    if (!OWN_INSET.test(text) && inner)
      text = readFileSync(join(ROOT, definingFile(inner)), "utf8");
    expect(OWN_INSET.test(text)).toBe(true);
  });
});
