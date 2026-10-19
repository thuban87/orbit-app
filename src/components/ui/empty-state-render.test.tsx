import { readFileSync } from "node:fs";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("./AppText", () => ({ AppText: "AppText" }));
vi.mock("./Button", () => ({ Button: "Button" }));

const { EmptyState } = await import("./EmptyState");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

describe("EmptyState (D-20)", () => {
  it("renders an icon, a heading, one help line and one action", () => {
    const onPress = vi.fn();
    const tree = nodes(
      EmptyState({
        testID: "x-empty",
        icon: "search",
        heading: "No matches for",
        term: "a".repeat(55),
        body: "Try a different name or word.",
        action: { label: "Clear search", onPress },
      }),
    );
    expect(tree[0]?.props.testID).toBe("x-empty");
    expect(tree.find((n) => n.type === "Icon")?.props.name).toBe("search");
    const heading = tree.find((n) => n.props.testID === "x-empty-heading");
    expect(heading?.props.children).toBe(`No matches for "${"a".repeat(40)}…"`);
    expect(heading?.props.numberOfLines).toBe(1);
    const body = tree.find((n) => n.props.testID === "x-empty-body");
    expect(body?.props.children).toBe("Try a different name or word.");
    const buttons = tree.filter((n) => n.type === "Button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.props.label).toBe("Clear search");
    (buttons[0]?.props.onPress as (() => void) | undefined)?.();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders no action when none is given and keeps a plain heading", () => {
    const tree = nodes(
      EmptyState({
        testID: "y",
        icon: "group-events",
        heading: "No events yet",
        body: "Body",
      }),
    );
    expect(tree.some((n) => n.type === "Button")).toBe(false);
    const heading = tree.find((n) => n.props.testID === "y-heading");
    expect(heading?.props.children).toBe("No events yet");
    expect(heading?.props.numberOfLines).toBeUndefined();
  });

  it("renders children (a refresh notice) above the icon", () => {
    const tree = EmptyState({
      testID: "z",
      icon: "your-week",
      heading: "No history yet",
      body: "Body",
      children: "NOTICE",
    }) as TestElement;
    const kids = tree.props.children as ReactNode[];
    expect(kids[0]).toBe("NOTICE");
  });
});

// D-20 / D-71: every converted empty state renders EmptyState with its one
// action. Source scan: the screens import react-native and cannot load here.
describe("empty-state consumers (D-20, D-71)", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("Contacts no-match offers Clear search", () => {
    const home = read("src/screens/HomeScreen.tsx");
    const start = home.indexOf('testID="dashboard-empty-search"');
    expect(start).toBeGreaterThan(-1);
    const region = home.slice(
      home.lastIndexOf("<EmptyState", start),
      home.indexOf("/>", start),
    );
    expect(region).toContain("term={term}");
    expect(region).toMatch(
      /action=\{\{ label: "Clear search", onPress: onClearSearch \}\}/,
    );
  });

  // 38.13 D-28 / D-30: the filter and population empty states render
  // EmptyState, keeping their testIDs.
  it.each([
    "dashboard-empty-filter",
    "dashboard-empty-birthdays",
    "dashboard-empty-not-contacted",
    "dashboard-empty-snoozed",
  ])("Contacts %s renders EmptyState", (testID) => {
    const home = read("src/screens/HomeScreen.tsx");
    const start = home.indexOf(`testID="${testID}"`);
    expect(start).toBeGreaterThan(-1);
    const opening = home.lastIndexOf("<", start);
    expect(home.slice(opening, start)).toMatch(/^<EmptyState\s*$/);
  });

  // 38.13 D-82 (38.9 D-20/D-71 one-action empty state): each empty
  // population offers "Show Active Contacts", which writes the Active
  // population ([]) through the store's population setter, keeping filters.
  it.each([
    ["dashboard-empty-birthdays", "birthdaysEmptyCopy"],
    ["dashboard-empty-not-contacted", "notContactedEmptyCopy"],
    ["dashboard-empty-snoozed", "snoozedEmptyCopy"],
  ])(
    "Contacts %s offers one action, Show Active Contacts (D-82)",
    (testID, copy) => {
      const home = read("src/screens/HomeScreen.tsx");
      const start = home.indexOf(`testID="${testID}"`);
      const region = home.slice(start, home.indexOf("/>", start));
      expect(region.match(/action=/g)).toHaveLength(1);
      expect(region).toMatch(new RegExp(`label:\\s*${copy}\\.actionLabel`));
      expect(region).toContain("onPress: onShowActiveContacts");
    },
  );

  it("Show Active Contacts writes [] through setPopulations and reports a failure with Retry (D-82)", () => {
    const home = read("src/screens/HomeScreen.tsx");
    expect(home).toMatch(
      /const onShowActiveContacts = useCallback\(async \(\) => \{\s*try \{\s*await useDashboardQueryStore\s*\.getState\(\)\s*\.setPopulations\(getExecutor\(\), \[\]\);/,
    );
    const start = home.indexOf("const onShowActiveContacts = useCallback(");
    const body = home.slice(start, home.indexOf("}, []);", start));
    expect(body).toContain('kind: "error"');
    expect(body).toContain('label: "Retry"');
    expect(body).toContain("void onShowActiveContacts();");
    expect(body).not.toContain("setFilters");
    expect(body).not.toContain("setPopulationsAndFilters");
  });

  it("Contacts filter-empty keeps only Clear filters (D-28, D-82)", () => {
    const home = read("src/screens/HomeScreen.tsx");
    const start = home.indexOf('testID="dashboard-empty-filter"');
    const region = home.slice(start, home.indexOf("/>", start));
    expect(region).not.toContain("onShowActiveContacts");
    expect(region.match(/onPress:/g)).toHaveLength(1);
  });

  it("Contacts filter-empty offers Clear filters that clears the filters (D-28)", () => {
    const home = read("src/screens/HomeScreen.tsx");
    const start = home.indexOf('testID="dashboard-empty-filter"');
    const region = home.slice(start, home.indexOf("/>", start));
    expect(region).toContain("onPress: onClearFilters");
    expect(home).toMatch(
      /const onClearFilters = useCallback\(async \(\) => \{\s*try \{\s*await useDashboardQueryStore\.getState\(\)\.setFilters\(getExecutor\(\), \{\}\);/,
    );
    expect(home).not.toContain("Nothing here right now");
  });

  it("Contacts tucked-away lines lead to Never Contacted and Unbound Contacts (D-65)", () => {
    const home = read("src/screens/HomeScreen.tsx");
    const start = home.indexOf('testID="dashboard-empty-hidden"');
    expect(start).toBeGreaterThan(-1);
    const region = home.slice(start, home.indexOf("</View>", start));
    expect(region).toContain("Everyone's tucked away");
    expect(region).toContain("tuckedAwayLines(");
    expect(region).toContain('"dashboard-empty-hidden-never-contacted"');
    expect(region).toContain('"dashboard-empty-hidden-unbound"');
    expect(region).toContain('role="tertiary"');
    expect(home).toMatch(
      /const onShowNeverContacted = useCallback\(async \(\) => \{\s*try \{\s*await useDashboardQueryStore\s*\.getState\(\)\s*\.setPopulationsAndFilters\(getExecutor\(\), \["not-contacted"\], \{\}\);/,
    );
    expect(home).toMatch(
      /const onOpenUnbound = useCallback\(\s*\(\) => navigation\.navigate\("UnboundContacts"\),/,
    );
  });

  it("Events: Try again, Clear search and Log an event", () => {
    const events = read("src/screens/GroupEventsScreen.tsx");
    expect(events.match(/<EmptyState/g)).toHaveLength(3);
    expect(events).toMatch(
      /label: "Try again", onPress: \(\) => void load\(term\)/,
    );
    expect(events).toMatch(
      /label: "Clear search", onPress: \(\) => setTerm\(""\)/,
    );
    expect(events).toMatch(
      /label: "Log an event",\s*onPress: \(\) => navigation\.navigate\("GroupLog"\)/,
    );
    expect(events).not.toMatch(/group event/i);
  });

  it("History keeps Log interaction, its testID and its layout signal", () => {
    const history = read("src/components/history/HistorySection.tsx");
    const start = history.indexOf("<EmptyState");
    expect(start).toBeGreaterThan(-1);
    const region = history.slice(
      start,
      history.indexOf("</EmptyState>", start),
    );
    expect(region).toMatch(/testID=\{`\$\{testID\}-empty`\}/);
    expect(region).toContain('label: "Log interaction"');
    expect(region).toContain("onLayout={onContentLayout}");
    expect(region).toContain("{refreshNotice}");
  });
});
