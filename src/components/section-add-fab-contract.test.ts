/**
 * Section Add FAB contract (Phase 38.10 D-131, gaps G2 and G3).
 *
 * D-131 puts the solid Add at the TOP of four page types, uniformly: the
 * memory-type section editors, the Off Limits editor, the Key People editor
 * and the Last Talked About / Current Location history page. When the Add
 * scrolls out of view it morphs into a bottom-left FAB with the page's icon
 * and a small +; a tap scrolls to the top and opens the add form. Every page
 * reuses plan 21's `useSectionAddMorph` and `<SectionAddFab>` (never a fork).
 *
 * Per page this pins: the `Animated.ScrollView` with the morph's scroll
 * handler, the measured root / viewport / bar, the primary top Add placed
 * before the entries, an EmptyState with no `action` (D-68: the top Add is
 * the one action), the FAB with its icon, label and hint, rendered after the
 * scroll view, and the end-of-scroll clearance: the focused pages use the
 * section-FAB clearance, the history page (a tab page) keeps the tab-page
 * `useBottomClearance` (38.4 D-52, `fab-clearance-contract.test.ts`).
 *
 * It also pins `SectionAddFab.tsx` itself: the pause convention (blur,
 * background, reduced motion; CLAUDE.md), the D-132 presence signal and no
 * Android `elevation` (memory android-elevation-opaque-on-translucent; it
 * animates opacity). check:colors covers colour literals.
 *
 * Textual, as `fab-clearance-contract.test.ts` is: comments are stripped and
 * a JSX element's opening tag is read up to its closing `>` at brace depth 0.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** Source with line and block comments removed (string literals kept). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function read(file: string): string {
  return stripComments(readFileSync(join(ROOT, file), "utf8"));
}

/** Every opening tag of `<tag …>` / `<tag … />`, props included. */
function openingTags(source: string, tag: string): string[] {
  const tags: string[] = [];
  const pattern = new RegExp(`<${tag.replace(".", "\\.")}(?=[\\s/>])`, "g");
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    let depth = 0;
    for (let index = start + 1; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0 && source[index - 1] !== "=") {
        tags.push(source.slice(start, index + 1));
        break;
      }
    }
  }
  return tags;
}

interface SectionFabPage {
  /** The screen component name (also the test title, for `-t` filters). */
  name: string;
  file: string;
  /** The FAB's icon expression. */
  icon: string;
  /** The top Add Button's testID. */
  addTestId: string;
  /** Where the entries start: the top Add must come before it. */
  entriesMarker: RegExp;
  /** A tab page keeps the shell FAB's clearance (D-52). */
  tabPage: boolean;
}

const PAGES: readonly SectionFabPage[] = [
  {
    name: "SectionEditorScreen",
    file: "src/screens/SectionEditorScreen.tsx",
    icon: "sectionFabIcon(type)",
    addTestId: "section-editor-add",
    entriesMarker: /<MemoryEditor\s/,
    tabPage: false,
  },
  {
    name: "OffLimitsEditorScreen",
    file: "src/screens/OffLimitsEditorScreen.tsx",
    icon: 'sectionFabIcon("off_limits")',
    addTestId: "off-limits-editor-add",
    entriesMarker: /\{rows\.map\(/,
    tabPage: false,
  },
  {
    name: "KeyPeopleEditorScreen",
    file: "src/screens/KeyPeopleEditorScreen.tsx",
    icon: 'sectionFabIcon("key_people")',
    addTestId: "key-people-editor-add",
    entriesMarker: /<RelationshipEditor\s/,
    tabPage: false,
  },
  {
    name: "MemoryHistoryScreen",
    file: "src/screens/MemoryHistoryScreen.tsx",
    icon: "sectionFabIcon(historyFabSection(fieldKey))",
    addTestId: "memory-history-add",
    entriesMarker: /\{HISTORY_MOST_RECENT\}/,
    tabPage: true,
  },
];

describe.each(PAGES)("section Add FAB on $name (D-131)", (page) => {
  const source = read(page.file);

  it(`${page.name}: an Animated.ScrollView carries the morph's scroll handler and viewport`, () => {
    const scrolls = openingTags(source, "Animated.ScrollView");
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0]).toContain("onScroll={morph.scrollHandler}");
    expect(scrolls[0]).toContain("scrollEventThrottle={16}");
    expect(scrolls[0]).toContain("onLayout={morph.onViewportLayout}");
    expect(source).not.toMatch(/<ScrollView\b/);
  });

  it(`${page.name}: reuses plan 21's morph hook and measures the root`, () => {
    expect(source).toMatch(/\buseSectionAddMorph\(/);
    expect(source).toMatch(
      /import\s*\{[^}]*\buseSectionAddMorph\b[^}]*\}\s*from\s*"@\/components\/SectionAddFab"/,
    );
    expect(source).toContain("onLayout={morph.onRootLayout}");
  });

  it(`${page.name}: the primary top Add sits in the measured bar, before the entries`, () => {
    const add = openingTags(source, "Button").find((tag) =>
      tag.includes(`testID="${page.addTestId}"`),
    );
    expect(add, "top Add").toBeDefined();
    expect(add).toContain('role="primary"');
    const addAt = source.indexOf(`testID="${page.addTestId}"`);
    const barAt = source.indexOf("onLayout={morph.onBarLayout}");
    expect(barAt).toBeGreaterThanOrEqual(0);
    expect(barAt).toBeLessThan(addAt);
    const entriesAt = source.search(page.entriesMarker);
    expect(entriesAt, "entries marker").toBeGreaterThanOrEqual(0);
    expect(addAt).toBeLessThan(entriesAt);
  });

  it(`${page.name}: the empty state is text only (D-68: the top Add is the one action)`, () => {
    const empties = openingTags(source, "EmptyState");
    expect(empties.length).toBeGreaterThan(0);
    for (const tag of empties) expect(tag).not.toMatch(/\baction=/);
  });

  it(`${page.name}: the section FAB has the page's icon, a label and a hint, and floats last`, () => {
    const fabs = openingTags(source, "SectionAddFab");
    expect(fabs).toHaveLength(1);
    const [fab] = fabs;
    expect(fab).toContain("morph={morph}");
    expect(fab).toContain(`icon={${page.icon}}`);
    expect(fab).toMatch(/\blabel=\{/);
    expect(fab).toMatch(/\bhint="[^"]+"/);
    expect(fab).toMatch(/\bonPress=\{/);
    expect(source.indexOf("<SectionAddFab")).toBeGreaterThan(
      source.indexOf("</Animated.ScrollView>"),
    );
  });

  it(`${page.name}: clears the FAB at the end of its scroll content`, () => {
    const [scroll] = openingTags(source, "Animated.ScrollView");
    if (page.tabPage) {
      // A tab page: the shell FAB's clearance already clears a FAB row.
      expect(source).toMatch(/const bottomClearance = useBottomClearance\(\)/);
      expect(scroll).toContain("paddingBottom: bottomClearance");
      expect(source).not.toMatch(/\buseSectionFabClearance\b/);
    } else {
      expect(source).toMatch(/\buseSectionFabClearance\(/);
      expect(scroll).toContain("paddingBottom: fabClearance");
      expect(source).not.toMatch(/\buseBottomClearance\b/);
    }
  });
});

describe("section Add FAB component (D-131 pause convention, D-132 presence)", () => {
  const fab = read("src/components/SectionAddFab.tsx");

  it("pauses on blur and background, and honours reduced motion", () => {
    for (const token of [
      "useIsFocused",
      "AppState",
      "cancelAnimation",
      "useReducedMotionShared",
    ]) {
      expect(fab, token).toContain(token);
    }
  });

  it("never starts a timing while paused: duration 0 when blurred or backgrounded (review WR-02)", () => {
    expect(fab).toContain(
      "duration: reducedMotion.value || paused.value ? 0 : MORPH_DURATION_MS",
    );
    // Mirrored on the UI thread from focus and the foreground, never per frame.
    expect(fab).toMatch(
      /paused\.value = next;[\s\S]*?\}\)\(!\(isFocused && appActive\)\);/,
    );
    // Declared before applyTarget (its worklet closure captures it) and the
    // pause effect runs before the suppression effect.
    expect(fab.indexOf("const paused = useSharedValue(false)")).toBeLessThan(
      fab.indexOf("const applyTarget"),
    );
    expect(fab.indexOf("paused.value = next;")).toBeLessThan(
      fab.indexOf("suppressedShared.value = next;"),
    );
  });

  it("registers and unregisters its presence for the snackbar", () => {
    expect(fab).toMatch(/\bregister\(/);
    expect(fab).toMatch(/\bunregister\(/);
  });

  it("sets no Android elevation (it animates opacity)", () => {
    expect(fab).not.toMatch(/\belevation\s*:/);
  });
});

describe("a section with no Add reports no section FAB (D-151)", () => {
  it("SectionEditorScreen gates the morph's loaded input on canAdd", () => {
    const source = stripComments(
      readFileSync(join(ROOT, "src/screens/SectionEditorScreen.tsx"), "utf8"),
    );
    expect(source).toMatch(
      /useSectionAddMorph\(\{\s*loaded:\s*phase\.phase === "loaded" && addable,/,
    );
  });
});
