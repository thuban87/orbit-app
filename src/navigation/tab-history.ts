import { INITIAL_TAB } from "./shell-contract";
import type { TabParamList } from "./types";

/**
 * Tab history helpers for the five-tab shell (D-35, D-54; ADR-146 root).
 *
 * The tab navigator uses `backBehavior="history"`: Back on a tab root returns
 * to the previously visited tab. React Navigation 7 de-duplicates that history
 * (Contacts → Digest → Back lands on Contacts with one entry left), so on its
 * own it would exit from Contacts. D-54: when history is exhausted on a
 * non-launch tab, Back first goes to the launch tab (Digest), so the app always
 * exits from Digest.
 *
 * That launch-tab hop must not add a history entry, or Back would loop
 * (X → Digest → Back → X). A plain `navigate` appends; the in-place switch
 * below resets the tab state with the target already as the only new entry.
 * The same helper is the Phase 39 Orient hop: programmatic tab switches that
 * should not become Back targets (D-35).
 *
 * The RESET action is built as a plain object with the same shape as
 * `CommonActions.reset(state)` so this module stays importable from node tests
 * without loading React Native (tab-history.test.ts pins the equality).
 */

type TabName = keyof TabParamList;

type TabHistoryEntry = { type: string; key: string };

type TabHistoryRoute = {
  key: string;
  name: string;
  state?: { index?: number; routes: readonly unknown[] } | undefined;
};

/** Structural tab-navigator state: the root state and a live tab state alike. */
export type TabHistoryState = {
  key: string;
  index: number;
  routes: readonly TabHistoryRoute[];
  history?: readonly unknown[];
};

function routeEntries(history: readonly unknown[] | undefined) {
  return (history ?? []) as readonly TabHistoryEntry[];
}

/**
 * The tab state switched to `target` without recording the switch in Back
 * history: the current tab's entry is dropped, and the target replaces any
 * older entry of its own at the end. Routes are the live state's routes by
 * reference, so every tab's nested stack state survives the reset.
 */
export function inPlaceTabState<S extends TabHistoryState>(
  state: S,
  target: TabName,
): S {
  const index = state.routes.findIndex((route) => route.name === target);
  if (index === -1) return state;
  const targetKey = state.routes[index].key;
  const currentKey = state.routes[state.index]?.key;
  const prior = routeEntries(state.history).filter(
    (entry) => entry.key !== targetKey && entry.key !== currentKey,
  );
  return {
    ...state,
    index,
    history: [...prior, { type: "route", key: targetKey }],
  };
}

/**
 * D-54: true when Back would exit the app from a non-launch tab — the focused
 * tab's stack is at its root (or not mounted yet), tab history has one entry,
 * and the focused tab is not the launch tab.
 */
export function shouldFallbackToLaunchTab(
  rootState: TabHistoryState | null | undefined,
  launchTab: TabName = INITIAL_TAB,
): boolean {
  if (rootState == null) return false;
  const focused = rootState.routes[rootState.index];
  if (focused == null || focused.name === launchTab) return false;
  if (routeEntries(rootState.history).length !== 1) return false;
  const stack = focused.state;
  if (stack == null) return true;
  const stackIndex = stack.index ?? stack.routes.length - 1;
  return stackIndex <= 0;
}

/**
 * Structural navigator: the container ref (its `getState` is the root, which is
 * the tab navigator — ADR-146) or a tab navigator from `getParent()`.
 */
export type TabHistoryNavigator =
  | {
      getState(): TabHistoryState | undefined;
      dispatch(action: never): void;
    }
  | null
  | undefined;

/**
 * Switch tabs without entering Back history (D-35). Used by the launch-tab
 * fallback (D-54) and by Phase 39's Orient hops. A reset, not a navigate, so
 * the RG-021 cross-tab guard (tab-entry.test.ts) is not involved.
 */
export function switchTabWithoutHistory(
  nav: TabHistoryNavigator,
  target: TabName,
): void {
  const state = nav?.getState();
  if (nav == null || state == null) return;
  const action = {
    type: "RESET",
    payload: inPlaceTabState(state, target),
    target: state.key,
  };
  nav.dispatch(action as never);
}
