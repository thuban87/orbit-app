/**
 * HomeScreen's search toggle never writes a store from inside a state
 * updater (38.10 fix pass). React runs `setState` updaters while rendering
 * the component, so `setSearchText("")` inside the `setSearchExpanded`
 * updater wrote the dashboard session store that HomeScreen subscribes to
 * during HomeScreen's own render: Metro's "Cannot update a component
 * (HomeScreen) while rendering a different component (HomeScreen)".
 *
 * Textual, as the other screen contracts are.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/screens/HomeScreen.tsx"),
  "utf8",
);

function handler(name: string): string {
  const start = source.indexOf(`const ${name} = useCallback(`);
  expect(start, `${name} not found`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("\n  }, [", start);
  return source.slice(start, end);
}

describe("HomeScreen search toggle (no store write during render)", () => {
  it("never passes an updater function to setSearchExpanded", () => {
    expect(source).not.toMatch(/setSearchExpanded\(\s*\(/);
    expect(source).not.toMatch(/setSearchExpanded\(\s*function/);
  });

  it("clears the search in the tap handler, then sets the next state", () => {
    const toggle = handler("onToggleSearch");
    expect(toggle).toContain("const expanded = searchExpandedRef.current;");
    expect(toggle).toContain("searchExpandedRef.current = !expanded;");
    expect(toggle).toContain('if (expanded) setSearchText("");');
    expect(toggle).toContain("setSearchExpanded(!expanded);");
    expect(toggle.indexOf('setSearchText("")')).toBeLessThan(
      toggle.indexOf("setSearchExpanded(!expanded)"),
    );
  });

  it("the ref is the only other owner of the expanded state", () => {
    expect(source.match(/setSearchExpanded\(/g)).toHaveLength(1);
    expect(source).toContain(
      "const searchExpandedRef = useRef(searchExpanded);",
    );
  });
});
