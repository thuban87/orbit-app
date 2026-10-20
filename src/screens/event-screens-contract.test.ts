import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Event screens source pins (38.14 D-25, D-71, D-28, D-30, D-84).
 *
 * The behaviour is proven in group-events-search-render.test.tsx and the pure
 * logic tests; this scan pins the wiring a refactor could silently drop.
 */
const ROOT = join(__dirname, "..", "..");
const read = (file: string) =>
  readFileSync(join(ROOT, file), "utf8").replace(/\r\n/g, "\n");

describe("Events list search wiring (38.14 D-25; ADR-162)", () => {
  const events = read("src/screens/GroupEventsScreen.tsx");

  it("gates every search publish through one latest-request authority", () => {
    expect(events).toMatch(
      /useMemo\(\(\) => createLatestRequestAuthority\(\), \[\]\)/,
    );
    expect(events).toMatch(/runEventsSearch\(\{/);
  });

  it("registers the Back listener inside a useFocusEffect, gated on searchOpen", () => {
    const start = events.indexOf('"hardwareBackPress"');
    expect(start).toBeGreaterThan(-1);
    const effect = events.lastIndexOf("useFocusEffect(", start);
    const region = events.slice(effect, start);
    expect(region).toMatch(/if \(!searchOpen\) return undefined;/);
    expect(events.slice(start)).toMatch(/\}, \[searchOpen, closeSearch\]\)/);
  });

  it("no useFocusEffect lists term; the term load keys on useIsFocused()", () => {
    expect(events).toMatch(/const isFocused = useIsFocused\(\);/);
    expect(events).toMatch(/\}, \[isFocused, term, load\]\);/);
    const focusDeps = [
      ...events.matchAll(/useFocusEffect\([\s\S]*?\]\),\n {2}\);/g),
    ];
    expect(focusDeps).toHaveLength(2);
    for (const [region] of focusDeps) expect(region).not.toMatch(/\bterm\b/);
  });

  it("adds no tab-switch clear (B-14 is fixed by clear-on-close)", () => {
    expect(events).not.toMatch(/getParent/);
  });
});
