import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CommonActions,
  StackActions,
  StackRouter,
} from "@react-navigation/routers";
import { describe, expect, it, vi } from "vitest";
import { Logger } from "@/utils/logger";
import {
  DEFAULT_FLOW_HOST,
  exitFlow,
  type FlowHost,
  type FlowNavigator,
  type FlowParentNavigator,
  finishFlow,
  finishFlowOnProfile,
  openContactFromFlow,
  returnFromProfileToTab,
} from "./flow-host";
import { inPlaceTabState, type TabHistoryState } from "./tab-history";

/**
 * 38.12 D-110 / D-57: host-aware flow endings. The dispatched plain-object
 * actions are pinned against the real builders, and the stack-level ones are
 * run through the installed StackRouter so the resulting stack is observable.
 */

const SETTINGS_ROUTE_NAMES = [
  "Settings",
  "SettingsContacts",
  "ImportReview",
  "ImportComplete",
  "ReconcileGrid",
  "ReconcileDetail",
  "ReconcileComplete",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
  "Profile",
];

/** The Digest stack has the merge routes but no SettingsContacts (A-1). */
const DIGEST_ROUTE_NAMES = [
  "Digest",
  "Profile",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
];

const DASHBOARD_ROUTE_NAMES = [
  "Home",
  "Profile",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
];

type StackRoute = { key: string; name: string; params?: object };
type StackState = {
  stale: false;
  type: "stack";
  key: string;
  index: number;
  routeNames: string[];
  preloadedRoutes: [];
  routes: StackRoute[];
};

function stack(
  key: string,
  routeNames: string[],
  routes: StackRoute[],
): StackState {
  return {
    stale: false,
    type: "stack",
    key,
    index: routes.length - 1,
    routeNames,
    preloadedRoutes: [],
    routes,
  };
}

function r(name: string, key = `${name}-k`, params?: object): StackRoute {
  return params === undefined ? { key, name } : { key, name, params };
}

function tabState(): TabHistoryState {
  return {
    key: "tabs",
    index: 4,
    routes: [
      { key: "DigestTab-k", name: "DigestTab" },
      { key: "DashboardTab-k", name: "DashboardTab" },
      { key: "EventsTab-k", name: "EventsTab" },
      { key: "OrreryTab-k", name: "OrreryTab" },
      { key: "SettingsTab-k", name: "SettingsTab" },
    ],
    history: [
      { type: "route", key: "DigestTab-k" },
      { type: "route", key: "SettingsTab-k" },
    ],
  };
}

function parentSpy(state: unknown = tabState()) {
  return {
    getState: vi.fn(() => state),
    navigate: vi.fn(),
    dispatch: vi.fn(),
  };
}

function navigatorSpy(
  state: StackState | undefined,
  parent: ReturnType<typeof parentSpy> | undefined = parentSpy(),
) {
  const nav = {
    getState: vi.fn(() => state),
    dispatch: vi.fn(),
    goBack: vi.fn(),
    getParent: vi.fn(() => parent as FlowParentNavigator | undefined),
  };
  return nav;
}

function asFlow(nav: ReturnType<typeof navigatorSpy>): FlowNavigator {
  return nav as unknown as FlowNavigator;
}

/** Run an action through the installed StackRouter. */
function applyToStack(state: StackState, action: unknown): StackState | null {
  const router = StackRouter({});
  return router.getStateForAction(state as never, action as never, {
    routeNames: state.routeNames,
    routeParamList: {},
    routeGetIdList: {},
  }) as StackState | null;
}

function settingsImportStack(): StackState {
  return stack("settings-stack", SETTINGS_ROUTE_NAMES, [
    r("Settings"),
    r("SettingsContacts"),
    r("ImportReview"),
    r("ImportComplete"),
  ]);
}

describe("DEFAULT_FLOW_HOST", () => {
  it("is the Settings host", () => {
    expect(DEFAULT_FLOW_HOST).toEqual({ kind: "settings" });
  });
});

describe("finishFlow — settings host (D-110)", () => {
  it("pops to Contacts & Relationships on the Settings stack", () => {
    const state = settingsImportStack();
    const parent = parentSpy();
    const nav = navigatorSpy(state, parent);
    finishFlow(asFlow(nav), { kind: "settings" });
    expect(nav.dispatch).toHaveBeenCalledTimes(1);
    const action = nav.dispatch.mock.calls[0][0];
    expect(action).toEqual(StackActions.popTo("SettingsContacts"));
    expect(applyToStack(state, action)?.routes.map((x) => x.name)).toEqual([
      "Settings",
      "SettingsContacts",
    ]);
    expect(parent.dispatch).not.toHaveBeenCalled();
  });

  it("replaces the flow with Contacts & Relationships when it was not beneath (resume prompt entry)", () => {
    const state = stack("settings-stack", SETTINGS_ROUTE_NAMES, [
      r("Settings"),
      r("ImportComplete"),
    ]);
    const nav = navigatorSpy(state);
    finishFlow(asFlow(nav), { kind: "settings" });
    const next = applyToStack(state, nav.dispatch.mock.calls[0][0]);
    expect(next?.routes.map((x) => x.name)).toEqual([
      "Settings",
      "SettingsContacts",
    ]);
  });

  it("missing-SettingsContacts fallback: a Digest stack pops to its root, never dispatching POP_TO (A-1)", () => {
    const warn = vi.spyOn(Logger, "warn").mockImplementation(() => {});
    for (const end of [finishFlow, exitFlow]) {
      const state = stack("digest-stack", DIGEST_ROUTE_NAMES, [
        r("Digest"),
        r("Profile", "Profile-a", { contactId: 1 }),
        r("SurvivorSelect"),
        r("MergeImpactSummary"),
      ]);
      const nav = navigatorSpy(state);
      end(asFlow(nav), { kind: "settings" });
      expect(nav.dispatch).toHaveBeenCalledTimes(1);
      const action = nav.dispatch.mock.calls[0][0];
      expect(action).toEqual(StackActions.popToTop());
      expect(action.type).not.toBe("POP_TO");
      expect(applyToStack(state, action)?.routes.map((x) => x.name)).toEqual([
        "Digest",
      ]);
    }
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("the same fallback applies to the Dashboard stack", () => {
    const warn = vi.spyOn(Logger, "warn").mockImplementation(() => {});
    const state = stack("dash-stack", DASHBOARD_ROUTE_NAMES, [
      r("Home"),
      r("Profile", "Profile-a", { contactId: 1 }),
      r("MergeImpactSummary"),
    ]);
    const nav = navigatorSpy(state);
    finishFlow(asFlow(nav), DEFAULT_FLOW_HOST);
    expect(nav.dispatch).toHaveBeenCalledWith(StackActions.popToTop());
    warn.mockRestore();
  });
});

describe("finishFlow / exitFlow — digest host (Phase 39 D-86)", () => {
  it("switches to Digest without history, then pops the flow off the Settings stack", () => {
    for (const end of [finishFlow, exitFlow]) {
      const state = stack("settings-stack", SETTINGS_ROUTE_NAMES, [
        r("Settings"),
        r("ImportReview"),
        r("ImportComplete"),
      ]);
      const parent = parentSpy();
      const nav = navigatorSpy(state, parent);
      end(asFlow(nav), { kind: "digest" });
      expect(parent.dispatch).toHaveBeenCalledWith({
        ...CommonActions.reset(
          inPlaceTabState(tabState(), "DigestTab") as never,
        ),
        target: "tabs",
      });
      expect(nav.dispatch).toHaveBeenCalledTimes(1);
      const pop = nav.dispatch.mock.calls[0][0];
      expect(pop).toEqual({ ...StackActions.pop(2), target: "settings-stack" });
      expect(parent.dispatch.mock.invocationCallOrder[0]).toBeLessThan(
        nav.dispatch.mock.invocationCallOrder[0],
      );
      expect(applyToStack(state, pop)?.routes.map((x) => x.name)).toEqual([
        "Settings",
      ]);
    }
  });
});

describe("finishFlowOnProfile — profile host (D-110, 38.9 D-08; T-38.12-07)", () => {
  it("keeps the routes below the launching Profile key and appends the survivor's Profile", () => {
    const state = stack("dash-stack", DASHBOARD_ROUTE_NAMES, [
      r("Home"),
      r("Profile", "Profile-other", { contactId: 5 }),
      r("Profile", "Profile-launch", { contactId: 9 }),
      r("SurvivorSelect"),
      r("MergeConflicts"),
      r("MergeImpactSummary"),
    ]);
    const nav = navigatorSpy(state);
    finishFlowOnProfile(
      asFlow(nav),
      { kind: "profile", profileKey: "Profile-launch" },
      12,
    );
    expect(nav.dispatch).toHaveBeenCalledTimes(1);
    const action = nav.dispatch.mock.calls[0][0];
    expect(action.type).toBe("RESET");
    expect(action.target).toBe("dash-stack");
    const next = applyToStack(state, action);
    expect(next?.routes.map((x) => [x.name, x.params])).toEqual([
      ["Home", undefined],
      ["Profile", { contactId: 5 }],
      ["Profile", { contactId: 12 }],
    ]);
    // The other person's Profile is kept by reference, never matched by name.
    expect(next?.routes[1].key).toBe("Profile-other");
    expect(next?.index).toBe(2);
  });

  it("never matches a Profile of a different person that sits above the launching key", () => {
    const state = stack("dash-stack", DASHBOARD_ROUTE_NAMES, [
      r("Home"),
      r("Profile", "Profile-launch", { contactId: 9 }),
      r("Profile", "Profile-later", { contactId: 3 }),
      r("SurvivorSelect"),
      r("MergeImpactSummary"),
    ]);
    const nav = navigatorSpy(state);
    finishFlowOnProfile(
      asFlow(nav),
      { kind: "profile", profileKey: "Profile-launch" },
      9,
    );
    const next = applyToStack(state, nav.dispatch.mock.calls[0][0]);
    expect(next?.routes.map((x) => x.name)).toEqual(["Home", "Profile"]);
    expect(next?.routes[1].params).toEqual({ contactId: 9 });
  });

  it("carries the launching Profile's returnTab onto the survivor (D-110; D-IN-03)", () => {
    const state = stack("dash-stack", DASHBOARD_ROUTE_NAMES, [
      r("Home"),
      r("Profile", "Profile-launch", {
        contactId: 9,
        returnTab: "SettingsTab",
      }),
      r("SurvivorSelect"),
      r("MergeConflicts"),
      r("MergeImpactSummary"),
    ]);
    const nav = navigatorSpy(state);
    finishFlowOnProfile(
      asFlow(nav),
      { kind: "profile", profileKey: "Profile-launch" },
      12,
    );
    const next = applyToStack(state, nav.dispatch.mock.calls[0][0]);
    expect(next?.routes.map((x) => [x.name, x.params])).toEqual([
      ["Home", undefined],
      ["Profile", { contactId: 12, returnTab: "SettingsTab" }],
    ]);
  });

  it("falls back to the routes below the first flow route when the key is gone", () => {
    const warn = vi.spyOn(Logger, "warn").mockImplementation(() => {});
    const state = stack("dash-stack", DASHBOARD_ROUTE_NAMES, [
      r("Home"),
      r("Profile", "Profile-x", { contactId: 2 }),
      r("SurvivorSelect"),
      r("MergeImpactSummary"),
    ]);
    const nav = navigatorSpy(state);
    finishFlowOnProfile(
      asFlow(nav),
      { kind: "profile", profileKey: "Profile-missing" },
      4,
    );
    const next = applyToStack(state, nav.dispatch.mock.calls[0][0]);
    expect(next?.routes.map((x) => [x.name, x.params])).toEqual([
      ["Home", undefined],
      ["Profile", { contactId: 2 }],
      ["Profile", { contactId: 4 }],
    ]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("delegates a non-profile host to finishFlow", () => {
    const state = settingsImportStack();
    const nav = navigatorSpy(state);
    finishFlowOnProfile(asFlow(nav), { kind: "settings" }, 12);
    expect(nav.dispatch).toHaveBeenCalledWith(
      StackActions.popTo("SettingsContacts"),
    );
  });
});

describe("merge summary endings (D-110)", () => {
  it("settings host: a merge run from Settings → Check linked contacts pops to Contacts & Relationships", () => {
    const state = stack("settings-stack", SETTINGS_ROUTE_NAMES, [
      r("Settings"),
      r("SettingsContacts"),
      r("ReconcileGrid"),
      r("ReconcileDetail"),
      r("SurvivorSelect"),
      r("MergeConflicts"),
      r("MergeImpactSummary"),
    ]);
    const nav = navigatorSpy(state);
    finishFlowOnProfile(asFlow(nav), DEFAULT_FLOW_HOST, 7);
    const next = applyToStack(state, nav.dispatch.mock.calls[0][0]);
    expect(next?.routes.map((x) => x.name)).toEqual([
      "Settings",
      "SettingsContacts",
    ]);
  });

  it("profile host: a merge run from a Settings-hosted Profile ends on the survivor there", () => {
    const state = stack("settings-stack", SETTINGS_ROUTE_NAMES, [
      r("Settings"),
      r("Profile", "Profile-launch", { contactId: 3 }),
      r("SurvivorSelect"),
      r("MergeConflicts"),
      r("MergeImpactSummary"),
    ]);
    const nav = navigatorSpy(state);
    finishFlowOnProfile(
      asFlow(nav),
      { kind: "profile", profileKey: "Profile-launch" },
      8,
    );
    const next = applyToStack(state, nav.dispatch.mock.calls[0][0]);
    expect(next?.routes.map((x) => [x.name, x.params])).toEqual([
      ["Settings", undefined],
      ["Profile", { contactId: 8 }],
    ]);
  });
});

describe("profile host without a survivor", () => {
  it("finishFlow and exitFlow go back", () => {
    for (const end of [finishFlow, exitFlow]) {
      const nav = navigatorSpy(settingsImportStack());
      end(asFlow(nav), { kind: "profile", profileKey: "Profile-a" });
      expect(nav.goBack).toHaveBeenCalledOnce();
      expect(nav.dispatch).not.toHaveBeenCalled();
    }
  });
});

describe("exitFlow — settings host (D-57)", () => {
  it("pops to Contacts & Relationships", () => {
    const state = stack("settings-stack", SETTINGS_ROUTE_NAMES, [
      r("Settings"),
      r("SettingsContacts"),
      r("ImportReview"),
    ]);
    const nav = navigatorSpy(state);
    exitFlow(asFlow(nav), DEFAULT_FLOW_HOST);
    expect(nav.dispatch).toHaveBeenCalledWith(
      StackActions.popTo("SettingsContacts"),
    );
  });
});

describe("openContactFromFlow (D-109, D-110)", () => {
  function rootWithContacts(mounted: boolean) {
    return {
      ...tabState(),
      routes: tabState().routes.map((route) =>
        route.name === "DashboardTab" && mounted
          ? {
              ...route,
              state: {
                key: "dash-stack",
                stale: false,
                index: 0,
                routes: [{ key: "Home-k", name: "Home" }],
              },
            }
          : route,
      ),
    };
  }

  it.each([
    [{ kind: "settings" } as FlowHost, "SettingsTab"],
    [{ kind: "digest" } as FlowHost, "DigestTab"],
  ])(
    "host %o opens a Contacts-tab Profile carrying returnTab %s (unmounted Contacts)",
    (host, returnTab) => {
      const parent = parentSpy(rootWithContacts(false));
      const nav = navigatorSpy(settingsImportStack(), parent);
      openContactFromFlow(asFlow(nav), host, 41);
      expect(parent.navigate).toHaveBeenCalledWith("DashboardTab", {
        screen: "Profile",
        params: { contactId: 41, returnTab },
        initial: false,
      });
      expect(nav.dispatch).not.toHaveBeenCalled();
    },
  );

  it("pushes onto a mounted Contacts stack with returnTab", () => {
    const parent = parentSpy(rootWithContacts(true));
    const nav = navigatorSpy(settingsImportStack(), parent);
    openContactFromFlow(asFlow(nav), DEFAULT_FLOW_HOST, 41);
    expect(parent.navigate).toHaveBeenCalledWith("DashboardTab");
    expect(parent.dispatch).toHaveBeenCalledWith({
      ...StackActions.push("Profile", {
        contactId: 41,
        returnTab: "SettingsTab",
      }),
      target: "dash-stack",
    });
  });

  it("a profile host pushes the Profile in its own stack", () => {
    const parent = parentSpy();
    const nav = navigatorSpy(settingsImportStack(), parent);
    openContactFromFlow(asFlow(nav), { kind: "profile", profileKey: "P" }, 41);
    expect(nav.dispatch).toHaveBeenCalledWith(
      StackActions.push("Profile", { contactId: 41 }),
    );
    expect(parent.navigate).not.toHaveBeenCalled();
  });

  it("is a no-op without a parent navigator", () => {
    const nav = navigatorSpy(settingsImportStack(), undefined);
    expect(() =>
      openContactFromFlow(asFlow(nav), DEFAULT_FLOW_HOST, 41),
    ).not.toThrow();
  });
});

describe("returnFromProfileToTab (D-110 Profile Back)", () => {
  it("switches to the return tab first, then pops the Profile off the Contacts stack", () => {
    const contacts = stack("dash-stack", DASHBOARD_ROUTE_NAMES, [
      r("Home"),
      r("Profile", "Profile-41", { contactId: 41, returnTab: "SettingsTab" }),
    ]);
    const tabs = { ...tabState(), index: 1 };
    const parent = parentSpy(tabs);
    const nav = navigatorSpy(contacts, parent);
    returnFromProfileToTab(asFlow(nav), "SettingsTab");
    expect(parent.dispatch).toHaveBeenCalledWith({
      ...CommonActions.reset(inPlaceTabState(tabs, "SettingsTab") as never),
      target: "tabs",
    });
    const pop = nav.dispatch.mock.calls[0][0];
    expect(pop).toEqual({ ...StackActions.pop(), target: "dash-stack" });
    expect(parent.dispatch.mock.invocationCallOrder[0]).toBeLessThan(
      nav.dispatch.mock.invocationCallOrder[0],
    );
    expect(applyToStack(contacts, pop)?.routes.map((x) => x.name)).toEqual([
      "Home",
    ]);
  });

  it("does not pop a Profile at the stack root", () => {
    const contacts = stack("dash-stack", DASHBOARD_ROUTE_NAMES, [
      r("Profile", "Profile-41", { contactId: 41 }),
    ]);
    const nav = navigatorSpy(contacts);
    returnFromProfileToTab(asFlow(nav), "DigestTab");
    expect(nav.dispatch).not.toHaveBeenCalled();
  });
});

/**
 * The four flow endings D-110 converts (38.12-03): none root-resets (that
 * wiped every tab's history, `tab-entry.ts`), each goes through the host.
 */
describe("flow screens end through the flow host (D-110)", () => {
  const read = (file: string) =>
    readFileSync(join(__dirname, "../..", file), "utf8");
  const files = [
    "src/screens/ImportCompleteScreen.tsx",
    "src/screens/ImportReviewScreen.tsx",
    "src/screens/ReconcileCompleteScreen.tsx",
    "src/components/MergeImpactSummary.tsx",
  ];

  it.each(files)("%s never root-resets", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/resetToDashboardRoot|resetToDashboardWith/);
    expect(source).not.toContain("@/navigation/reset-intents");
    expect(source).toContain("route.params.host ?? DEFAULT_FLOW_HOST");
  });

  it("Import review: single import and link finish on the host with a View snackbar", () => {
    const source = read("src/screens/ImportReviewScreen.tsx");
    // One helper finishes on the host, then offers View (D-04 copy).
    expect(source).toContain("finishFlow(navigation, host);");
    expect(source).toContain(
      "onPress: () => openContactFromFlow(navigation, host, contactId)",
    );
    expect(source.match(/finishWithView\(/g)).toHaveLength(2);
    expect(source).toMatch(/`Imported \$\{input\.name\}`/);
    expect(source).toMatch(/`Linked \$\{phoneName\} to \$\{choice\.name\}`/);
  });

  it("Check complete: Done, header Back and system Back share finishFlow", () => {
    const source = read("src/screens/ReconcileCompleteScreen.tsx");
    expect(source).toMatch(
      /const done = useCallback\(\s*\(\) => finishFlow\(navigation, host\),/,
    );
  });

  it("Merge summary: a profile host ends on the survivor, otherwise finishFlow", () => {
    const source = read("src/components/MergeImpactSummary.tsx");
    expect(source).toContain(
      "finishFlowOnProfile(navigation, host, survivorId)",
    );
  });

  it("the inert Profile origin contract is retired with its only consumer", () => {
    // Built from parts so a repository grep for the retired name stays empty.
    const retired = new RegExp(
      ["Profile" + "Origin", "profile" + "OriginIntent"].join("|"),
    );
    expect(read("src/screens/contact-profile-logic.ts")).not.toMatch(retired);
    expect(
      existsSync(join(__dirname, "profile-origin-integration.test.ts")),
    ).toBe(false);
  });
});
