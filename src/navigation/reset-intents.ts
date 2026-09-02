import type { NavigationState, PartialState } from "@react-navigation/native";
import type { DashboardStackParamList, TabParamList } from "./types";

type DashboardResetTarget = {
  [Name in keyof DashboardStackParamList]: DashboardStackParamList[Name] extends undefined
    ? { name: Name }
    : { name: Name; params: DashboardStackParamList[Name] };
}[keyof DashboardStackParamList];

type TabResetState = PartialState<NavigationState<TabParamList>>;

/**
 * The only owner of the root-level Dashboard reset shape. External entries
 * have no meaningful in-app origin, so their Back path begins at Dashboard.
 */
export function resetToDashboardRoot(): TabResetState {
  return {
    index: 0,
    routes: [
      {
        name: "DashboardTab",
        state: { index: 0, routes: [{ name: "Home" }] },
      },
    ],
  } as TabResetState;
}

/** Keep Home below an external-entry target so Back returns to Dashboard. */
export function resetToDashboardWith(
  target: DashboardResetTarget,
): TabResetState {
  return {
    index: 0,
    routes: [
      {
        name: "DashboardTab",
        state: { index: 1, routes: [{ name: "Home" }, target] },
      },
    ],
  } as TabResetState;
}
