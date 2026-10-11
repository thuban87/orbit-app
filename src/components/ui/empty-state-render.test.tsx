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
    (buttons[0]?.props.onPress as () => void)();
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
    expect(region).toContain("testID={`${testID}-empty`}");
    expect(region).toContain('label: "Log interaction"');
    expect(region).toContain("onLayout={onContentLayout}");
    expect(region).toContain("{refreshNotice}");
  });
});
