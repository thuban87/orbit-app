import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Source contract for the universal FAB (RG-039 ui-accessibility/AUD-UIA-023
 * and the D-20 glyph rider under RG-029). Reads the component source from disk
 * and asserts its structural shape; the native accessibility-tree evidence
 * lives in 38.4-INVESTIGATIONS.md.
 */
const fab = readFileSync("src/components/UniversalFab.tsx", "utf8");

/** The `<Animated.Text …>` opener that draws the "+" glyph. */
function glyphRegion(): string {
  const start = fab.indexOf("<Animated.Text");
  expect(start).toBeGreaterThan(-1);
  const end = fab.indexOf(">", fab.indexOf("style=", start));
  return fab.slice(start, end + 1);
}

describe("UniversalFab glyph foreground (D-20)", () => {
  it("draws the glyph in the accent's role foreground", () => {
    expect(glyphRegion()).toContain("color: colors.onAccent");
  });

  it("does not paint the glyph with the background token", () => {
    expect(glyphRegion()).not.toContain("colors.background");
  });
});

/** The JSX opener region that starts at `anchor` and ends at the opener's first `>` after `until`. */
function openerAfter(anchor: string, until: string): string {
  const start = fab.indexOf(anchor);
  expect(start).toBeGreaterThan(-1);
  const end = fab.indexOf(">", fab.indexOf(until, start));
  return fab.slice(start, end + 1);
}

describe("UniversalFab closed-dial semantics (RG-039 ui-accessibility/AUD-UIA-023, CONFIRMED on device)", () => {
  const scrim = openerAfter(
    'accessibilityLabel="Dismiss capture actions"',
    "style=",
  );
  // The action-rows container: from its `<View` opener up to its dial style.
  const dialOpener = fab.slice(
    fab.lastIndexOf("<View", fab.indexOf("style={styles.dial}")),
    fab.indexOf("style={styles.dial}"),
  );
  const row = openerAfter(
    '<AnimatedPressable\n      accessibilityRole="button"',
    "style=",
  );
  const fabButton = openerAfter('testID="dashboard-create-fab"', "onPress=");

  it("hides the scrim from accessibility while the dial is closed", () => {
    expect(scrim).toContain(
      'importantForAccessibility={open ? "auto" : "no-hide-descendants"}',
    );
    expect(scrim).toContain("accessibilityElementsHidden={!open}");
  });

  it("hides the action-rows container from accessibility while the dial is closed", () => {
    expect(dialOpener).toContain(
      'importantForAccessibility={open ? "auto" : "no-hide-descendants"}',
    );
    expect(dialOpener).toContain("accessibilityElementsHidden={!open}");
  });

  it("takes the scrim and every action row out of keyboard focus while closed", () => {
    // RN 0.86 Android: `focusable={false}` only drops the click listener;
    // native keyboard focusability follows `accessible` (ReactViewManager).
    expect(scrim).toContain("focusable={open}");
    expect(row).toContain("focusable={open}");
    expect(scrim).toContain("accessible={open}");
    expect(row).toContain("accessible={open}");
  });

  it("keeps the existing touch gating (opacity + pointerEvents) on scrim and rows", () => {
    expect(scrim).toContain("pointerEvents={scrimPointerEvents}");
    expect(row).toContain("pointerEvents={pointerEvents}");
    expect(fab).toContain("opacity: expanded.value");
  });

  it("announces the dial's expanded state on the FAB", () => {
    expect(fabButton).toContain("accessibilityState={{ expanded: open }}");
  });
});

describe("open dial keeps focus in the dial (D-31)", () => {
  const navigator = readFileSync("src/navigation/RootNavigator.tsx", "utf8");

  /** The opener of the container that wraps `<Tab.Navigator`. */
  function navigatorContainerOpener(): string {
    const tab = navigator.indexOf("<Tab.Navigator");
    expect(tab).toBeGreaterThan(-1);
    const start = navigator.lastIndexOf("<SafeAreaView", tab);
    expect(start).toBeGreaterThan(-1);
    return navigator.slice(start, navigator.indexOf(">", start) + 1);
  }

  it("uses the shared transient id instead of a local constant", () => {
    expect(fab).not.toMatch(/const\s+DIAL_ID\b/);
    expect(fab).not.toContain('"fab-speed-dial"');
    expect(fab).toContain("openTransient(FAB_DIAL_TRANSIENT_ID, closeDial)");
    expect(fab).toContain("closeTransient(FAB_DIAL_TRANSIENT_ID)");
  });

  it("hides the tab navigator subtree from accessibility while the dial is open", () => {
    expect(navigator).toContain(
      "const fabDialOpen = shellTransientStore(selectFabDialOpen);",
    );
    const opener = navigatorContainerOpener();
    expect(opener).toContain(
      'importantForAccessibility={fabDialOpen ? "no-hide-descendants" : "auto"}',
    );
    expect(opener).toContain("accessibilityElementsHidden={fabDialOpen}");
  });

  it("never collapses the app into one node or blocks touch on that container", () => {
    const opener = navigatorContainerOpener();
    // accessible={true} on Android would merge the whole navigator into one
    // node; the dial's own full-screen scrim already intercepts touch.
    expect(opener).not.toMatch(/\baccessible=/);
    expect(opener).not.toContain("pointerEvents");
  });

  const cycleProps = [
    "nextFocusForward={open ? ",
    "nextFocusUp={open ? ",
    "nextFocusDown={open ? ",
  ];

  it("gives every action row a keyboard focus link defined only while open", () => {
    const row = openerAfter(
      '<AnimatedPressable\n      accessibilityRole="button"',
      "style=",
    );
    for (const prop of cycleProps) {
      expect(row).toContain(prop);
    }
    expect(row.match(/: undefined\}/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("gives the FAB a keyboard focus link defined only while open", () => {
    const start = fab.indexOf('testID="dashboard-create-fab"');
    const fabOpener = fab.slice(start, fab.indexOf("style=", start));
    for (const prop of cycleProps) {
      expect(fabOpener).toContain(prop);
    }
    expect(fabOpener.match(/: undefined\}/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("resolves the native tags once, after the dial opens, not per frame", () => {
    const openDial = fab.slice(
      fab.indexOf("const openDial = useCallback"),
      fab.indexOf("useEffect(", fab.indexOf("const openDial = useCallback")),
    );
    expect(openDial).toContain("requestAnimationFrame(");
    expect(openDial).toContain("resolveDialFocusTags");
  });
});
