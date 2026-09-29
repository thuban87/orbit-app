import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Tab-root chrome contract (38.4 Plan 12; RG-037 ui-accessibility/AUD-UIA-016,
 * owner rulings D-22 and D-23).
 *
 * Every top-level tab root renders the shared `ShellAppBar variant="root"`
 * header row and never a child header with Back: a root has nowhere to go back
 * to, and a Back there would pop out of the tab shell. Source-scan idiom (the
 * screens import react-native, which the vitest node environment cannot load).
 *
 * The root screen of each tab comes from its stack in `src/navigation/tabs/`
 * (the stack's `initialRouteName` and the screen module it imports). The map
 * below is explicit, and the first test proves it still matches those stacks
 * and the five tabs `RootNavigator` mounts.
 */
interface TabRoot {
  /** Stack module mounted by `RootNavigator` for this tab. */
  readonly stack: string;
  /** The stack's `initialRouteName`. */
  readonly initialRoute: string;
  /** The screen component registered for that initial route. */
  readonly screen: string;
}

const TAB_ROOTS: readonly TabRoot[] = [
  { stack: "DashboardStack", initialRoute: "Home", screen: "HomeScreen" },
  {
    stack: "EventsStack",
    initialRoute: "GroupEvents",
    screen: "GroupEventsScreen",
  },
  { stack: "DigestStack", initialRoute: "Digest", screen: "DigestScreen" },
  { stack: "OrreryStack", initialRoute: "Orrery", screen: "OrreryScreen" },
  {
    stack: "SettingsStack",
    initialRoute: "Settings",
    screen: "SettingsHubScreen",
  },
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function screenSource(screen: string): string {
  return read(`src/screens/${screen}.tsx`);
}

/** The `variant` value of every `<ShellAppBar …>` opener in `source`. */
function shellAppBarVariants(source: string): string[] {
  const variants: string[] = [];
  const opener = /<ShellAppBar\b[\s\S]*?\bvariant=("[^"]*"|\{[^}]*\})/g;
  for (const match of source.matchAll(opener)) {
    variants.push(match[1]);
  }
  return variants;
}

describe("tab-root chrome contract (RG-037, D-22, D-23)", () => {
  it("the root map matches the five tab stacks RootNavigator mounts", () => {
    const navigator = read("src/navigation/RootNavigator.tsx");
    const mounted = [...navigator.matchAll(/component=\{(\w+Stack)\}/g)].map(
      (match) => match[1],
    );
    expect(mounted).toEqual(TAB_ROOTS.map((root) => root.stack));

    for (const root of TAB_ROOTS) {
      const stack = read(`src/navigation/tabs/${root.stack}.tsx`);
      expect(stack).toContain(`initialRouteName="${root.initialRoute}"`);
      expect(stack).toContain(
        `import { ${root.screen} } from "@/screens/${root.screen}";`,
      );
      // The initial route is registered to that screen, either as a
      // <Stack.Screen> or in the typed route-component registry.
      expect(stack).toMatch(
        new RegExp(
          `name="${root.initialRoute}"\\s+component=\\{${root.screen}\\}|\\b${root.initialRoute}: ${root.screen},`,
        ),
      );
    }
  });

  it.each(TAB_ROOTS)(
    "$screen renders only the root ShellAppBar (no Back)",
    (root) => {
      const variants = shellAppBarVariants(screenSource(root.screen));
      expect(variants.length).toBeGreaterThanOrEqual(1);
      expect(variants.every((variant) => variant === '"root"')).toBe(true);
    },
  );

  it("Digest renders the shared header row, not its own display-role title (D-23)", () => {
    const source = screenSource("DigestScreen");
    expect(
      source.match(
        /<ShellAppBar variant="root" title=\{DIGEST\} artComponent="digestHeader" \/>/g,
      ),
    ).toHaveLength(1);
    expect(source).not.toContain('role="display"');
  });

  it("the Events root keeps its search trailing action", () => {
    const source = screenSource("GroupEventsScreen");
    expect(source).toMatch(
      /<ShellAppBar\s+variant="root"\s+title=\{EVENTS\}\s+trailing=\{/,
    );
    expect(source).toContain('accessibilityLabel="Search events"');
  });
});
