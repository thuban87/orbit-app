import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { TAB_ORDER } from "./shell-contract";
import { navigateIntoTab } from "./tab-entry";

function spyNavigator() {
  const navigate = vi.fn();
  return { navigate };
}

describe("navigateIntoTab (RG-021, react-native/AUD-RN-002)", () => {
  it("always passes initial: false so an unmounted tab keeps its semantic root", () => {
    const nav = spyNavigator();
    navigateIntoTab(nav, "DashboardTab", "Create");
    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith("DashboardTab", {
      screen: "Create",
      params: undefined,
      initial: false,
    });
  });

  it("passes params through unchanged", () => {
    const nav = spyNavigator();
    const params = { contactId: 7 };
    navigateIntoTab(nav, "DashboardTab", "LogContact", params);
    const payload = nav.navigate.mock.calls[0][1];
    expect(payload).toEqual({
      screen: "LogContact",
      params: { contactId: 7 },
      initial: false,
    });
    expect(payload.params).toBe(params);
  });

  it("is a no-op when the navigator is not available yet", () => {
    expect(() => navigateIntoTab(null, "SettingsTab", "Backup")).not.toThrow();
    expect(() =>
      navigateIntoTab(undefined, "DashboardTab", "Capture"),
    ).not.toThrow();
  });

  it.each(TAB_ORDER)("works for %s", (tab) => {
    const nav = spyNavigator();
    navigateIntoTab(nav, tab, "Anything" as never);
    expect(nav.navigate).toHaveBeenCalledWith(tab, {
      screen: "Anything",
      params: undefined,
      initial: false,
    });
  });
});

/**
 * Repository guard (RG-021): no source file outside `tab-entry.ts` may navigate
 * into a tab directly. A bare nested payload silently drops the tab's semantic
 * root on first entry; every cross-tab entry must go through navigateIntoTab.
 */
const TAB_NAME = "(?:DashboardTab|EventsTab|DigestTab|OrreryTab|SettingsTab)";
const QUOTED_TAB = `(?:"${TAB_NAME}"|'${TAB_NAME}'|\`${TAB_NAME}\`)`;
const DIRECT_TAB_NAVIGATION = new RegExp(
  [
    // navigate / push / replace whose first argument is a tab name or intent.tab
    `\\.(?:navigate|push|replace)\\(\\s*(?:${QUOTED_TAB}|intent\\.tab\\b)`,
    // object form: navigate({ name: "<Tab>", ... })
    `\\.navigate\\(\\s*\\{\\s*name\\s*:\\s*${QUOTED_TAB}`,
  ].join("|"),
  "g",
);

const SRC_ROOT = fileURLToPath(new URL("..", import.meta.url));
const HELPER_PATH = fileURLToPath(new URL("./tab-entry.ts", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    if (path === HELPER_PATH) return [];
    return [path];
  });
}

function findDirectTabNavigations(source: string): number[] {
  const lines: number[] = [];
  for (const match of source.matchAll(DIRECT_TAB_NAVIGATION)) {
    lines.push(source.slice(0, match.index).split("\n").length);
  }
  return lines;
}

describe("cross-tab entry guard (RG-021)", () => {
  it.each([
    ['nav.navigate("DashboardTab", { screen: "Create" })'],
    ["navigationRef.current?.navigate('SettingsTab', { screen: 'Backup' })"],
    ['parent.navigate(\n  "EventsTab",\n  { screen: "GroupEvents" },\n)'],
    ['navigation.push("OrreryTab", { screen: "Orrery" })'],
    ['navigation.replace("DigestTab")'],
    ["navigationRef.current?.navigate(intent.tab, { screen: intent.screen })"],
    ['navigation.navigate({ name: "SettingsTab", params: { screen: "X" } })'],
    ["navigation.navigate(`DashboardTab`)"],
  ])("self-test: flags %s", (source) => {
    expect(findDirectTabNavigations(source)).toHaveLength(1);
  });

  it.each([
    ['navigation.navigate("Profile", { contactId })'],
    ['navigateIntoTab(nav, "DashboardTab", "Create")'],
    ['navigationRef.current?.reset({ routes: [{ name: "DashboardTab" }] })'],
    ["navigation.navigate(intent.screen)"],
  ])("self-test: allows %s", (source) => {
    expect(findDirectTabNavigations(source)).toHaveLength(0);
  });

  it("no source file navigates into a tab except through navigateIntoTab", () => {
    const files = sourceFiles(SRC_ROOT);
    // Sanity: the walk really covers the tree (catches a broken SRC_ROOT).
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.flatMap((file) =>
      findDirectTabNavigations(readFileSync(file, "utf8")).map(
        (line) => `src/${relative(SRC_ROOT, file)}:${line}`,
      ),
    );
    expect(
      offenders,
      `Direct cross-tab navigation found — use navigateIntoTab (src/navigation/tab-entry.ts):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
