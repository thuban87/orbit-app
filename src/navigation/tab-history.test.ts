import { CommonActions, TabRouter } from "@react-navigation/routers";
import { describe, expect, it, vi } from "vitest";
import { TAB_ORDER } from "./shell-contract";
import {
  inPlaceTabState,
  shouldFallbackToLaunchTab,
  switchTabWithoutHistory,
  type TabHistoryState,
} from "./tab-history";

/**
 * D-35 / D-54: history Back across tabs with the launch-tab exit rule. These
 * cases drive the installed TabRouter (`@react-navigation/routers`, the same
 * router the bottom-tab navigator uses) with the navigator's real options, so
 * a router upgrade that changes history semantics fails here.
 */
const router = TabRouter({
  initialRouteName: "DigestTab",
  backBehavior: "history",
});
const options = {
  routeNames: [...TAB_ORDER],
  routeParamList: {},
  routeGetIdList: {},
};

type RouterState = ReturnType<typeof router.getInitialState>;

function init(): RouterState {
  return router.getInitialState(options);
}

function act(
  state: RouterState,
  action: Parameters<typeof router.getStateForAction>[1],
): RouterState | null {
  const next = router.getStateForAction(state, action, options);
  return next as RouterState | null;
}

function navigate(state: RouterState, name: string): RouterState {
  const next = act(state, CommonActions.navigate(name));
  if (next == null) throw new Error(`navigate ${name} returned null`);
  return next;
}

function focusedName(state: RouterState): string {
  return state.routes[state.index].name;
}

function historyNames(state: RouterState): string[] {
  return state.history.map(
    (entry) => state.routes.find((route) => route.key === entry.key)?.name,
  ) as string[];
}

/** Give every tab route a nested stack state so preservation is observable. */
function withStacks(
  state: RouterState,
  stackIndex: Partial<Record<string, number>> = {},
): RouterState {
  return {
    ...state,
    routes: state.routes.map((route) => ({
      ...route,
      state: {
        key: `${route.name}-stack`,
        index: stackIndex[route.name] ?? 0,
        routes: [{ key: `${route.name}-root`, name: "Root" }],
      },
    })),
  } as RouterState;
}

describe("TabRouter history Back (D-35)", () => {
  it("at launch on Digest, Back exits", () => {
    const state = init();
    expect(focusedName(state)).toBe("DigestTab");
    expect(act(state, CommonActions.goBack())).toBeNull();
  });

  it("Digest → Contacts → Back returns to Digest", () => {
    const state = navigate(init(), "DashboardTab");
    const back = act(state, CommonActions.goBack());
    expect(back).not.toBeNull();
    expect(focusedName(back as RouterState)).toBe("DigestTab");
  });
});

describe("launch-tab fallback (D-54)", () => {
  it("Contacts → Digest → Back lands on Contacts, then the fallback goes to Digest, then Back exits", () => {
    let state = navigate(navigate(init(), "DashboardTab"), "DigestTab");
    state = act(state, CommonActions.goBack()) as RouterState;
    expect(focusedName(state)).toBe("DashboardTab");
    // The router de-duplicated Digest away: one history entry left.
    expect(state.history).toHaveLength(1);
    expect(shouldFallbackToLaunchTab(state)).toBe(true);

    const reset = act(
      state,
      CommonActions.reset(inPlaceTabState(state, "DigestTab")),
    ) as RouterState;
    expect(focusedName(reset)).toBe("DigestTab");
    expect(reset.history).toHaveLength(1);
    expect(shouldFallbackToLaunchTab(reset)).toBe(false);
    expect(act(reset, CommonActions.goBack())).toBeNull();
  });

  it("a plain navigate to Digest would append history and loop Back (why the fallback resets in place)", () => {
    let state = navigate(navigate(init(), "DashboardTab"), "DigestTab");
    state = act(state, CommonActions.goBack()) as RouterState;
    const looped = navigate(state, "DigestTab");
    expect(historyNames(looped)).toEqual(["DashboardTab", "DigestTab"]);
    // Back would return to Contacts again instead of exiting.
    expect(act(looped, CommonActions.goBack())).not.toBeNull();
  });

  it("is false on the launch tab", () => {
    expect(shouldFallbackToLaunchTab(init())).toBe(false);
  });

  it("is false while tab history has more than one entry", () => {
    const state = navigate(init(), "OrreryTab");
    expect(state.history.length).toBeGreaterThan(1);
    expect(shouldFallbackToLaunchTab(state)).toBe(false);
  });

  it("is false when the focused tab's stack is above its root", () => {
    let state = navigate(navigate(init(), "SettingsTab"), "DigestTab");
    state = act(state, CommonActions.goBack()) as RouterState;
    expect(shouldFallbackToLaunchTab(withStacks(state))).toBe(true);
    expect(
      shouldFallbackToLaunchTab(withStacks(state, { SettingsTab: 1 })),
    ).toBe(false);
  });

  it("is true for a one-entry history on a non-launch tab whose stack has not mounted", () => {
    // reset-intents.ts builds partial states; rehydration gives history
    // [focusedTab] and an unvisited stack has no state yet.
    const state = act(init(), CommonActions.navigate("EventsTab"));
    const single = {
      ...(state as RouterState),
      history: [(state as RouterState).history.at(-1)],
    } as RouterState;
    expect(shouldFallbackToLaunchTab(single)).toBe(true);
  });

  it("is false for a missing state", () => {
    expect(shouldFallbackToLaunchTab(undefined)).toBe(false);
    expect(shouldFallbackToLaunchTab(null)).toBe(false);
  });

  it("honours an explicit launch tab", () => {
    let state = navigate(navigate(init(), "DashboardTab"), "DigestTab");
    state = act(state, CommonActions.goBack()) as RouterState;
    expect(shouldFallbackToLaunchTab(state, "DashboardTab")).toBe(false);
  });
});

describe("inPlaceTabState (D-35 untracked tab switch)", () => {
  it("Digest>Contacts switched in place to Orrery gives Digest>Orrery", () => {
    const state = withStacks(navigate(init(), "DashboardTab"));
    const next = inPlaceTabState(state, "OrreryTab");
    expect(focusedName(next as RouterState)).toBe("OrreryTab");
    expect(historyNames(next as RouterState)).toEqual([
      "DigestTab",
      "OrreryTab",
    ]);
  });

  it("preserves every nested route state by reference", () => {
    const state = withStacks(navigate(init(), "DashboardTab"), {
      DashboardTab: 1,
    });
    const next = inPlaceTabState(state, "OrreryTab");
    expect(next.routes).toHaveLength(state.routes.length);
    next.routes.forEach((route, i) => {
      expect(route).toBe(state.routes[i]);
    });
  });

  it("drops an older entry for the target so history stays de-duplicated", () => {
    const state = navigate(navigate(init(), "OrreryTab"), "DashboardTab");
    expect(historyNames(state)).toEqual([
      "DigestTab",
      "OrreryTab",
      "DashboardTab",
    ]);
    const next = inPlaceTabState(state, "OrreryTab");
    expect(historyNames(next as RouterState)).toEqual([
      "DigestTab",
      "OrreryTab",
    ]);
  });

  it("the router keeps the reset state's history as given", () => {
    const state = navigate(init(), "DashboardTab");
    const reset = act(
      state,
      CommonActions.reset(inPlaceTabState(state, "OrreryTab")),
    ) as RouterState;
    expect(historyNames(reset)).toEqual(["DigestTab", "OrreryTab"]);
    const back = act(reset, CommonActions.goBack()) as RouterState;
    expect(focusedName(back)).toBe("DigestTab");
  });

  it("returns the state unchanged for an unknown tab", () => {
    const state = init();
    expect(inPlaceTabState(state, "NopeTab" as never)).toBe(state);
  });
});

describe("switchTabWithoutHistory", () => {
  it("dispatches a RESET of the in-place state targeted at the tab navigator", () => {
    const state = navigate(init(), "DashboardTab");
    const dispatch = vi.fn();
    switchTabWithoutHistory(
      { getState: () => state as TabHistoryState, dispatch },
      "OrreryTab",
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      ...CommonActions.reset(inPlaceTabState(state, "OrreryTab")),
      target: state.key,
    });
  });

  it("is a no-op without a navigator or a state", () => {
    expect(() => switchTabWithoutHistory(null, "DigestTab")).not.toThrow();
    const dispatch = vi.fn();
    switchTabWithoutHistory({ getState: () => undefined, dispatch }, "DigestTab");
    expect(dispatch).not.toHaveBeenCalled();
  });
});
