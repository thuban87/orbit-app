import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { backupAppBarVariant } from "./backup-dualhome-logic";

/**
 * Single-Back chrome contract, every tab stack (38.9 D-07, D-16; carried from
 * RG-037 ui-accessibility/AUD-UIA-016, owner ruling D-15; ADR-175).
 *
 * A pushed screen renders the shared `ShellAppBar variant="child"` header and
 * owns exactly one Back: the header's (routed through `resolveBackIntent`, so a
 * shell transient is dismissed first — SHELL-03). It never also renders an
 * in-body Back.
 *
 * Exceptions, each explicit:
 *   - `KEEP_OWN_CHROME`: the Profile keeps its own top bar (ADR-109); Capture
 *     keeps its own chrome (S11, Phase 40).
 *   - `PENDING_HEADER_CONVERSION`: screens Plans 09 and 10 convert, each pinned
 *     to its CURRENT chrome so the list cannot rot: an `"in-body-back"` entry has
 *     no ShellAppBar and still has its in-body Back (removing it before the
 *     header lands would strand the user, research Pitfall 6); a `"header-less"`
 *     entry has no ShellAppBar and is not required to have a Back. The commit
 *     that converts a screen removes its entry (D-07).
 *
 * Source contract: reads the five stack files `RootNavigator` mounts, resolves
 * every `@/screens/*` and `@/components/*` module they import (the
 * `<Stack.Screen>` and the typed route-registry forms both import their
 * screens), and scans each file's source.
 */
const ROOT = process.cwd();

/** The five stacks RootNavigator mounts (pinned against the navigator below). */
const TAB_STACKS = [
  "DashboardStack",
  "EventsStack",
  "DigestStack",
  "OrreryStack",
  "SettingsStack",
] as const;

/** Tab roots: `variant="root"` headers, covered by tab-root-chrome-contract. */
const TAB_ROOT_SCREENS = [
  "src/screens/HomeScreen.tsx",
  "src/screens/GroupEventsScreen.tsx",
  "src/screens/DigestScreen.tsx",
  "src/screens/OrreryScreen.tsx",
  "src/screens/SettingsHubScreen.tsx",
] as const;

/** Pushed screens that keep their own chrome, with the reason. */
const KEEP_OWN_CHROME: Record<string, string> = {
  "src/screens/ContactProfileScreen.tsx":
    "ADR-109: the Profile keeps its own top bar",
  "src/screens/CaptureScreen.tsx":
    "S11: Capture keeps its own chrome (Phase 40)",
};

type PendingChrome = "in-body-back" | "header-less";

/**
 * Screens still waiting for the shared header (D-16), with their chrome today.
 * Plan 09 converted its 16; Plan 10 empties the rest. Each converting commit
 * removes its entry.
 */
const PENDING_HEADER_CONVERSION: Record<string, PendingChrome> = {
  // Plan 10
  "src/screens/CustomFieldsScreen.tsx": "in-body-back",
  "src/screens/ImportReviewScreen.tsx": "in-body-back",
  "src/screens/RestorePreviewScreen.tsx": "in-body-back",
  "src/screens/BulkReviewScreen.tsx": "in-body-back",
  "src/screens/DuplicateReviewScreen.tsx": "in-body-back",
  "src/screens/BulkImportSetupScreen.tsx": "in-body-back",
  "src/screens/LegacyContactPickerScreen.tsx": "in-body-back",
  "src/screens/ImportProgressScreen.tsx": "in-body-back",
  "src/screens/AIConnectionScreen.tsx": "in-body-back",
  "src/screens/AIPersonalizationScreen.tsx": "in-body-back",
  "src/screens/AIPermissionsScreen.tsx": "in-body-back",
  "src/screens/AIModelPickerScreen.tsx": "in-body-back",
  "src/screens/AIPreviewScreen.tsx": "in-body-back",
  "src/screens/ReconcileDetailScreen.tsx": "in-body-back",
  "src/screens/SystemBuilderScreen.tsx": "in-body-back",
  "src/screens/ImportCompleteScreen.tsx": "header-less",
  "src/screens/ReconcileGridScreen.tsx": "header-less",
  "src/screens/ReconcileCompleteScreen.tsx": "header-less",
  "src/screens/RestoreResultScreen.tsx": "header-less",
};

/**
 * A computed `variant={…}` that resolves to "child" for this screen's pushed
 * host, with the check that proves it.
 */
const COMPUTED_CHILD_VARIANTS: Record<
  string,
  { expr: string; resolvesChild: () => boolean }
> = {
  "src/screens/BackupScreen.tsx": {
    expr: "backupAppBarVariant(host)",
    // Backup is Settings-only after Phase 38: the Settings host is a child.
    resolvesChild: () => backupAppBarVariant("settings") === "child",
  },
};

/**
 * The header-chrome Settings children that must carry exactly one (header)
 * Back. Pinned so a regression in the detector cannot silently empty the set.
 */
const HEADER_CHROME_SETTINGS_CHILDREN = [
  "src/screens/SettingsAboutScreen.tsx",
  "src/screens/SettingsAIScreen.tsx",
  "src/screens/SettingsAppearanceScreen.tsx",
  "src/screens/SettingsContactsScreen.tsx",
  "src/screens/SettingsInteractionsScreen.tsx",
  "src/screens/SettingsNotificationsScreen.tsx",
  "src/screens/SettingsOrreryScreen.tsx",
] as const;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function stackSource(stack: string): string {
  return read(`src/navigation/tabs/${stack}.tsx`);
}

/** Every `@/screens/*` and `@/components/*` module a stack source imports. */
function importedScreenFiles(source: string): string[] {
  const files: string[] = [];
  const importPattern = /from "@\/((?:screens|components)\/[A-Za-z0-9_/]+)"/g;
  for (const match of source.matchAll(importPattern)) {
    const base = `src/${match[1]}`;
    const file = [`${base}.tsx`, `${base}.ts`].find((path) =>
      existsSync(join(ROOT, path)),
    );
    if (file) files.push(file);
  }
  return files;
}

/** The union of screen files across the five mounted stacks, sorted. */
function registeredScreenFiles(): string[] {
  const all = new Set<string>();
  for (const stack of TAB_STACKS) {
    for (const file of importedScreenFiles(stackSource(stack))) all.add(file);
  }
  return [...all].sort();
}

function collapse(source: string): string {
  return source.replace(/\s+/g, " ");
}

function rendersShellAppBar(source: string): boolean {
  return /<ShellAppBar\b/.test(source);
}

/**
 * The screen renders the child shared header: a literal `variant="child"`, or
 * a computed variant listed (and proven) in `COMPUTED_CHILD_VARIANTS`.
 */
function rendersChildHeader(path: string, source: string): boolean {
  const collapsed = collapse(source);
  if (collapsed.includes('<ShellAppBar variant="child"')) return true;
  const computed = COMPUTED_CHILD_VARIANTS[path];
  return (
    computed !== undefined &&
    collapsed.includes(`<ShellAppBar variant={${computed.expr}}`) &&
    computed.resolvesChild()
  );
}

/**
 * An in-body Back control authored in the screen's own source: an accessible
 * name of "Back" (or "Back to …", e.g. "Back to compose"), a Button labelled
 * "Back" (directly or in a ternary), or a visible "Back" text child (on one
 * line or split across lines). The header Back lives inside ShellAppBar.tsx,
 * not in the screen source, so it never matches here.
 */
function hasInBodyBack(source: string): boolean {
  const collapsed = collapse(source);
  return (
    /accessibilityLabel="Back( to [^"]+)?"/.test(collapsed) ||
    /\blabel="Back"/.test(collapsed) ||
    /\blabel=\{[^}]*"Back"/.test(collapsed) ||
    />\s*Back\s*</.test(collapsed)
  );
}

/** The pending-entry rule for one source (true = still in its category). */
function keepsPendingCategory(source: string, chrome: PendingChrome): boolean {
  if (rendersShellAppBar(source)) return false;
  return chrome === "header-less" ? true : hasInBodyBack(source);
}

describe("detector self-tests", () => {
  it("finds the in-body Back shapes", () => {
    expect(
      hasInBodyBack('<Pressable accessibilityLabel="Back" onPress={go} />'),
    ).toBe(true);
    expect(
      hasInBodyBack(
        '<Button role="tertiary" label="Back" accessibilityLabel="Back to compose" />',
      ),
    ).toBe(true);
    expect(
      hasInBodyBack('<Pressable accessibilityLabel="Back to compose" />'),
    ).toBe(true);
    expect(
      hasInBodyBack('<Button label={step ? "Back" : "Cancel"} onPress={x} />'),
    ).toBe(true);
    expect(
      hasInBodyBack(
        "<Pressable>\n  <Text\n    style={styles.back}\n  >\n    Back\n  </Text>\n</Pressable>",
      ),
    ).toBe(true);
    expect(
      hasInBodyBack('<ShellAppBar variant="child" title="Things" />'),
    ).toBe(false);
    expect(hasInBodyBack("// Back closes the draft first")).toBe(false);
  });

  it("an in-body-back pending entry holds only while it has no header and keeps its Back", () => {
    const today =
      '<View><Pressable accessibilityLabel="Back" /><Text>Title</Text></View>';
    expect(keepsPendingCategory(today, "in-body-back")).toBe(true);
    // Back removed before the header landed: the user is stranded.
    expect(
      keepsPendingCategory("<View><Text>Title</Text></View>", "in-body-back"),
    ).toBe(false);
    // Converted: the entry must be removed in the converting commit.
    expect(
      keepsPendingCategory(
        '<View><ShellAppBar variant="child" title="T" /></View>',
        "in-body-back",
      ),
    ).toBe(false);
  });

  it("a header-less pending entry holds while it has no header, Back or not", () => {
    expect(
      keepsPendingCategory(
        '<View><Button label="Cancel" /></View>',
        "header-less",
      ),
    ).toBe(true);
    expect(
      keepsPendingCategory(
        '<View><ShellAppBar variant="child" title="Crop" backKind="cancel" /></View>',
        "header-less",
      ),
    ).toBe(false);
  });

  it("recognises a literal child header and a proven computed one", () => {
    expect(
      rendersChildHeader(
        "src/screens/X.tsx",
        '<ShellAppBar\n  variant="child"\n  title="X"\n/>',
      ),
    ).toBe(true);
    expect(
      rendersChildHeader(
        "src/screens/X.tsx",
        "<ShellAppBar variant={backupAppBarVariant(host)} />",
      ),
    ).toBe(false);
    expect(
      rendersChildHeader(
        "src/screens/BackupScreen.tsx",
        '<ShellAppBar\n  variant={backupAppBarVariant(host)}\n  title="Backup"\n/>',
      ),
    ).toBe(true);
    expect(
      rendersChildHeader(
        "src/screens/X.tsx",
        '<ShellAppBar variant="root" title="X" />',
      ),
    ).toBe(false);
  });
});

describe("single header Back across every tab stack (D-07, D-16)", () => {
  const files = registeredScreenFiles();
  const roots = new Set<string>(TAB_ROOT_SCREENS);
  const pushed = files.filter((path) => !roots.has(path));

  it("walks the five stacks RootNavigator mounts", () => {
    const navigator = read("src/navigation/RootNavigator.tsx");
    const mounted = [...navigator.matchAll(/component=\{(\w+Stack)\}/g)].map(
      (match) => match[1],
    );
    expect(mounted).toEqual([...TAB_STACKS]);
  });

  it("finds more than 40 screen files (sanity)", () => {
    expect(files.length).toBeGreaterThan(40);
    for (const root of TAB_ROOT_SCREENS) expect(files).toContain(root);
  });

  it("every exception entry is a registered pushed screen", () => {
    for (const path of [
      ...Object.keys(KEEP_OWN_CHROME),
      ...Object.keys(PENDING_HEADER_CONVERSION),
      ...Object.keys(COMPUTED_CHILD_VARIANTS),
    ]) {
      expect(pushed, path).toContain(path);
    }
    for (const path of Object.keys(KEEP_OWN_CHROME)) {
      expect(PENDING_HEADER_CONVERSION[path], path).toBeUndefined();
    }
  });

  it("every pushed screen renders the child ShellAppBar and no in-body Back, outside the exceptions", () => {
    const offenders = pushed
      .filter(
        (path) =>
          !(path in KEEP_OWN_CHROME) && !(path in PENDING_HEADER_CONVERSION),
      )
      .flatMap((path) => {
        const source = read(path);
        const problems: string[] = [];
        if (!rendersChildHeader(path, source))
          problems.push(`${path}: no ShellAppBar variant="child"`);
        if (hasInBodyBack(source)) problems.push(`${path}: in-body Back`);
        return problems;
      });
    expect(offenders).toEqual([]);
  });

  it.each(Object.keys(KEEP_OWN_CHROME))(
    "%s keeps its own chrome (no ShellAppBar)",
    (path) => {
      expect(KEEP_OWN_CHROME[path].trim().length).toBeGreaterThan(0);
      expect(rendersShellAppBar(read(path))).toBe(false);
    },
  );

  it.each(Object.entries(PENDING_HEADER_CONVERSION))(
    "pending %s is still %s (remove it in the converting commit)",
    (path, chrome) => {
      expect(keepsPendingCategory(read(path), chrome)).toBe(true);
    },
  );
});

describe("Settings chrome: single header Back (RG-037 AUD-UIA-016, D-15)", () => {
  const settingsFiles = importedScreenFiles(stackSource("SettingsStack"));

  it("resolves the SettingsStack screen files", () => {
    for (const path of HEADER_CHROME_SETTINGS_CHILDREN) {
      expect(settingsFiles).toContain(path);
    }
  });

  it.each(HEADER_CHROME_SETTINGS_CHILDREN)(
    "%s renders the child ShellAppBar header",
    (path) => {
      expect(collapse(read(path))).toContain('<ShellAppBar variant="child"');
    },
  );

  it.each(HEADER_CHROME_SETTINGS_CHILDREN)(
    "%s has no in-body Back (header Back only)",
    (path) => {
      expect(hasInBodyBack(read(path))).toBe(false);
    },
  );
});
