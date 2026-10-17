import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { StackActions } from "@react-navigation/routers";
import { describe, expect, it, vi } from "vitest";
import { TAB_ORDER } from "./shell-contract";
import {
  navigateIntoTab,
  openBinFromProfile,
  openProfileInContactsTab,
  planContactsProfileOpen,
} from "./tab-entry";

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
 * D-50: an Add Contact started from the Settings tab finishes on the new
 * person's Profile in the Contacts tab. When the Contacts stack is mounted the
 * Profile is pushed onto it, because a nested navigate to "Profile" would
 * rewrite an existing top Profile's params in place (wrong person shown,
 * T-38.9-18).
 */
describe("planContactsProfileOpen (D-50)", () => {
  it("navigates into the tab when the Contacts stack has not mounted", () => {
    expect(
      planContactsProfileOpen({
        routes: [{ name: "DigestTab" }, { name: "DashboardTab" }],
      }),
    ).toEqual({ kind: "navigate-into" });
  });

  it("pushes onto a mounted Contacts stack", () => {
    expect(
      planContactsProfileOpen({
        routes: [
          { name: "SettingsTab" },
          {
            name: "DashboardTab",
            state: { key: "k", stale: false, routes: [{ name: "Home" }] },
          },
        ],
      }),
    ).toEqual({ kind: "push", stackKey: "k" });
  });

  it("treats a partial (not yet mounted) Contacts state as unmounted", () => {
    expect(
      planContactsProfileOpen({
        routes: [
          {
            name: "DashboardTab",
            state: { routes: [{ name: "Home" }, { name: "Profile" }] },
          },
        ],
      }),
    ).toEqual({ kind: "navigate-into" });
    expect(
      planContactsProfileOpen({
        routes: [{ name: "DashboardTab", state: { key: "k", routes: [] } }],
      }),
    ).toEqual({ kind: "navigate-into" });
  });

  it("navigates into the tab without a root state", () => {
    expect(planContactsProfileOpen(undefined)).toEqual({
      kind: "navigate-into",
    });
  });
});

describe("openProfileInContactsTab (D-50)", () => {
  function containerSpy(rootState: unknown) {
    return {
      getRootState: vi.fn(() => rootState),
      navigate: vi.fn(),
      dispatch: vi.fn(),
    };
  }

  it("enters an unmounted Contacts tab with its root under the Profile", () => {
    const nav = containerSpy({ routes: [{ name: "SettingsTab" }] });
    openProfileInContactsTab(nav as never, 41);
    expect(nav.navigate).toHaveBeenCalledWith("DashboardTab", {
      screen: "Profile",
      params: { contactId: 41 },
      initial: false,
    });
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("focuses a mounted Contacts tab, then pushes the Profile onto its stack", () => {
    const nav = containerSpy({
      routes: [
        { name: "SettingsTab" },
        {
          name: "DashboardTab",
          state: {
            key: "dash-stack",
            stale: false,
            index: 1,
            routes: [
              { name: "Home" },
              { name: "Profile", params: { contactId: 3 } },
            ],
          },
        },
      ],
    });
    openProfileInContactsTab(nav as never, 41);
    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith("DashboardTab");
    expect(nav.dispatch).toHaveBeenCalledTimes(1);
    expect(nav.dispatch).toHaveBeenCalledWith({
      ...StackActions.push("Profile", { contactId: 41 }),
      target: "dash-stack",
    });
    expect(nav.navigate.mock.invocationCallOrder[0]).toBeLessThan(
      nav.dispatch.mock.invocationCallOrder[0],
    );
  });

  it("is a no-op without a navigator", () => {
    expect(() => openProfileInContactsTab(null, 41)).not.toThrow();
  });

  // 38.12 D-110: a flow's "View contact" carries the host tab so the
  // Profile's Back returns there instead of Contacts Home.
  it("carries returnTab onto the Profile params when entering an unmounted tab", () => {
    const nav = containerSpy({ routes: [{ name: "SettingsTab" }] });
    openProfileInContactsTab(nav as never, 41, { returnTab: "SettingsTab" });
    expect(nav.navigate).toHaveBeenCalledWith("DashboardTab", {
      screen: "Profile",
      params: { contactId: 41, returnTab: "SettingsTab" },
      initial: false,
    });
  });

  it("carries returnTab onto the pushed Profile on a mounted stack", () => {
    const nav = containerSpy({
      routes: [
        {
          name: "DashboardTab",
          state: {
            key: "dash-stack",
            stale: false,
            routes: [{ name: "Home" }],
          },
        },
      ],
    });
    openProfileInContactsTab(nav as never, 41, { returnTab: "DigestTab" });
    expect(nav.dispatch).toHaveBeenCalledWith({
      ...StackActions.push("Profile", {
        contactId: 41,
        returnTab: "DigestTab",
      }),
      target: "dash-stack",
    });
  });

  it("omits returnTab when none is given", () => {
    const nav = containerSpy({ routes: [{ name: "SettingsTab" }] });
    openProfileInContactsTab(nav as never, 41, {});
    expect(nav.navigate.mock.calls[0][1].params).toEqual({ contactId: 41 });
    expect("returnTab" in nav.navigate.mock.calls[0][1].params).toBe(false);
  });
});

describe("openBinFromProfile (38.12 D-93)", () => {
  function stackSpy(routes: { name: string }[] | undefined) {
    return {
      getState: vi.fn(() => (routes === undefined ? undefined : { routes })),
      dispatch: vi.fn(),
      navigate: vi.fn(),
    };
  }

  it("pops back to the Bin when it is already under the Profile", () => {
    const nav = stackSpy([
      { name: "SettingsHome" },
      { name: "Archived" },
      { name: "Profile" },
    ]);
    openBinFromProfile(nav);
    expect(nav.dispatch).toHaveBeenCalledTimes(1);
    const action = nav.dispatch.mock.calls[0][0];
    expect(action).toEqual(StackActions.popTo("Archived"));
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it("opens the Bin in the Contacts tab when the stack has no Bin", () => {
    const nav = stackSpy([{ name: "Orrery" }, { name: "Profile" }]);
    openBinFromProfile(nav);
    expect(nav.dispatch).not.toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith("DashboardTab", {
      screen: "Archived",
      params: undefined,
      initial: false,
    });
  });

  it("opens the Bin in the Contacts tab when the stack state is not available", () => {
    const nav = stackSpy(undefined);
    openBinFromProfile(nav);
    expect(nav.navigate).toHaveBeenCalledWith("DashboardTab", {
      screen: "Archived",
      params: undefined,
      initial: false,
    });
  });

  it("is a no-op without a navigator", () => {
    expect(() => openBinFromProfile(null)).not.toThrow();
    expect(() => openBinFromProfile(undefined)).not.toThrow();
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
