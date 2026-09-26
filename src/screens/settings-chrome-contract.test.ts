import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Settings chrome contract (RG-037 ui-accessibility/AUD-UIA-016, owner ruling
 * D-15). A Settings child that renders the shared `ShellAppBar` header already
 * owns the canonical Back (header Back, routed through `resolveBackIntent`, so a
 * shell transient is dismissed first — SHELL-03). Such a screen must NOT also
 * render an in-body Back: the owner wants one Back per screen.
 *
 * The reverse guard protects header-less historical screens (research Pitfall
 * 6): a screen with no `ShellAppBar` has no header Back, so removing its in-body
 * Back would strand the user. Those screens are out of RG-037 scope and keep
 * their in-body Back.
 *
 * Source contract: reads `SettingsStack.tsx` from disk, resolves every screen
 * component it imports to its file, and scans that file's source.
 */
const ROOT = process.cwd();
const STACK_SOURCE = readFileSync(
  join(ROOT, "src", "navigation", "tabs", "SettingsStack.tsx"),
  "utf8",
);

/** Every `@/screens/*` and `@/components/*` module SettingsStack imports. */
function registeredScreenFiles(): string[] {
  const files: string[] = [];
  const importPattern = /from "@\/((?:screens|components)\/[A-Za-z0-9_/]+)"/g;
  for (const match of STACK_SOURCE.matchAll(importPattern)) {
    const base = join(ROOT, "src", match[1]);
    const file = [`${base}.tsx`, `${base}.ts`].find((path) => existsSync(path));
    if (file) files.push(file);
  }
  return files;
}

function relative(file: string): string {
  return file.slice(ROOT.length + 1);
}

function collapse(source: string): string {
  return source.replace(/\s+/g, " ");
}

/** The screen renders the shared shell header (any variant but the tab root). */
function rendersHeaderChrome(source: string): boolean {
  const collapsed = collapse(source);
  if (!collapsed.includes("<ShellAppBar")) return false;
  const roots = collapsed.match(/<ShellAppBar variant="root"/g)?.length ?? 0;
  const bars = collapsed.match(/<ShellAppBar\b/g)?.length ?? 0;
  return bars > roots;
}

function rendersShellAppBar(source: string): boolean {
  return source.includes("<ShellAppBar");
}

/**
 * An in-body Back control authored in the screen's own source: an accessible
 * name of "Back", a Button labelled "Back" (directly or in a ternary), or a
 * visible "Back" text child. The header Back lives inside ShellAppBar.tsx, not
 * in the screen source, so it never matches here.
 */
function hasInBodyBack(source: string): boolean {
  const collapsed = collapse(source);
  return (
    /accessibilityLabel="Back"/.test(collapsed) ||
    /\blabel="Back"/.test(collapsed) ||
    /\blabel=\{[^}]*"Back"/.test(collapsed) ||
    />\s*Back\s*</.test(collapsed)
  );
}

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

/**
 * Header-less screens registered in SettingsStack that carry an in-body Back
 * today. With no ShellAppBar they have no header Back, so each must keep its
 * in-body Back (RG-037 out of scope; Pitfall 6).
 */
const HEADERLESS_SCREENS_KEEPING_IN_BODY_BACK = [
  "src/screens/AIConnectionScreen.tsx",
  "src/screens/AIModelPickerScreen.tsx",
  "src/screens/AIPermissionsScreen.tsx",
  "src/screens/AIPersonalizationScreen.tsx",
  "src/screens/AIPreviewScreen.tsx",
  "src/screens/BackupSettingsScreen.tsx",
  "src/screens/BulkImportSetupScreen.tsx",
  "src/screens/BulkReviewScreen.tsx",
  "src/screens/ContactProfileScreen.tsx",
  "src/screens/CustomFieldsScreen.tsx",
  "src/screens/DuplicateReviewScreen.tsx",
  "src/screens/EditContactScreen.tsx",
  "src/screens/EditGroupEventScreen.tsx",
  "src/screens/EditInteractionScreen.tsx",
  "src/screens/EditParticipantScreen.tsx",
  "src/screens/ImportProgressScreen.tsx",
  "src/screens/ImportReviewScreen.tsx",
  "src/screens/LegacyContactPickerScreen.tsx",
  "src/screens/MemoryHistoryScreen.tsx",
  "src/screens/OffLimitsEditorScreen.tsx",
  "src/screens/RecentlyDeletedScreen.tsx",
  "src/screens/ReconcileDetailScreen.tsx",
  "src/screens/RestorePreviewScreen.tsx",
  "src/screens/SystemBuilderScreen.tsx",
  "src/screens/ThingsToRememberScreen.tsx",
] as const;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("Settings chrome: single header Back (RG-037 AUD-UIA-016, D-15)", () => {
  const files = registeredScreenFiles().map(relative);

  it("resolves the SettingsStack screen files", () => {
    for (const path of HEADER_CHROME_SETTINGS_CHILDREN) {
      expect(files).toContain(path);
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

  it("every header-chrome SettingsStack screen has no in-body Back", () => {
    const offenders = files.filter((path) => {
      const source = read(path);
      return rendersHeaderChrome(source) && hasInBodyBack(source);
    });
    expect(offenders).toEqual([]);
  });

  it.each(HEADERLESS_SCREENS_KEEPING_IN_BODY_BACK)(
    "header-less %s keeps its in-body Back",
    (path) => {
      expect(files).toContain(path);
      const source = read(path);
      expect(rendersShellAppBar(source)).toBe(false);
      expect(hasInBodyBack(source)).toBe(true);
    },
  );
});
