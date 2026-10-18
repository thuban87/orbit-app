import { Logger } from "@/utils/logger";
import {
  type ContactsProfileNavigator,
  type ContactsProfileRootState,
  navigateIntoTab,
  openBinFromProfile,
  openProfileInContactsTab,
} from "./tab-entry";
import { switchTabWithoutHistory, type TabHistoryState } from "./tab-history";

/**
 * Host-aware flow endings (38.12 D-110, D-57; Phase 39 D-61, D-86).
 *
 * Import, Check linked contacts and merges finish where they were started,
 * instead of root-resetting to the Contacts tab (which wiped every tab's
 * history — `tab-entry.ts` "Never replace this with a `reset`", ADR-146). The
 * host travels as an optional `host` route param on every flow route
 * (`types.ts`); absent means `DEFAULT_FLOW_HOST`.
 *
 * - `settings`: finish on Settings → Contacts & Relationships.
 * - `profile`: a merge started from a Profile's ⋯ ends on the surviving
 *   person's Profile in that stack. `profileKey` is the launching Profile's
 *   route KEY: Profile has no `getId`, so a name match would find the nearest
 *   Profile of any person (T-38.12-07).
 * - `digest`: Phase 39's first-run import ends on Digest (39 D-86).
 *
 * Every action is a plain object with the shape of its `StackActions` /
 * `CommonActions` builder, so this module stays importable from node tests
 * (the `tab-entry.ts` / `tab-history.ts` idiom; flow-host.test.ts pins the
 * equality).
 */
export type FlowHost =
  | { kind: "settings" }
  | { kind: "profile"; profileKey: string }
  | { kind: "digest" };

export const DEFAULT_FLOW_HOST: FlowHost = { kind: "settings" };

/** The tab a Contacts-tab Profile opened from a flow returns to on Back. */
export type ProfileReturnTab = "SettingsTab" | "DigestTab";

const LOG_SCOPE = "flow-host";

/** Where a Settings-hosted flow finishes (D-110). */
export const SETTINGS_FLOW_HOME = "SettingsContacts";

/**
 * The routes that belong to an import, check, merge or restore flow. A digest-hosted
 * ending pops every one of them off the Settings stack (the routes below the
 * first of them are what the user had before the flow started).
 */
export const FLOW_ROUTE_NAMES: ReadonlySet<string> = new Set([
  "LegacyContactPicker",
  "ImportReview",
  "BulkImportSetup",
  "ImportProgress",
  "DuplicateReview",
  "ImportComplete",
  "ReconcileGrid",
  "ReconcileDetail",
  "ReconcileComplete",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
  // 38.12 D-68: the restore routes, so a digest-hosted restore's return
  // (`returnFromRestore`) pops them off the Settings stack too.
  "RestorePreview",
  "RestoreResult",
]);

type FlowRoute = { key: string; name: string; params?: object };

/** The slice of a stack navigator's live state the helpers read. */
export type FlowStackState = {
  key: string;
  index: number;
  routeNames: readonly string[];
  routes: readonly FlowRoute[];
};

/** The tab navigator above a flow's stack (the root, ADR-146). */
export type FlowParentNavigator = {
  getState(): (TabHistoryState & ContactsProfileRootState) | undefined;
  navigate(...args: never[]): void;
  dispatch(action: never): void;
};

/**
 * Structural screen navigator: a flow screen's `navigation` prop. The parent
 * is the tab navigator, so no container ref is needed here.
 */
export type FlowNavigator = {
  getState(): FlowStackState | undefined;
  dispatch(action: never): void;
  goBack(): void;
  getParent(): FlowParentNavigator | undefined;
};

function dispatch(navigation: FlowNavigator, action: object): void {
  navigation.dispatch(action as never);
}

/** The Settings stack's root route (its `initialRouteName`). */
const SETTINGS_ROOT = "Settings";

/**
 * Settings host: pop to Contacts & Relationships on the current stack when it
 * is there. When it is not (a flow resumed from the app-root prompt is pushed
 * onto whatever the Settings stack held, e.g. Settings → AI → Preview), reset
 * this stack to `[Settings, Contacts & Relationships]`, keeping the root route
 * by reference, so Back from the ending goes to Settings rather than an
 * unrelated page (D-110; 38.12 D-IN-04). StackRouter POP_TO alone would only
 * replace the top route. The merge routes are also registered in the
 * Dashboard, Digest, Events and Orrery stacks, which have no SettingsContacts,
 * so a dropped host reaching here in one of them would dispatch an unhandled
 * POP_TO. Those stacks pop to their own root instead, with a warning
 * (convergence c1 A-1).
 */
function endOnSettings(navigation: FlowNavigator, helper: string): void {
  const state = navigation.getState();
  if (state != null && !state.routeNames.includes(SETTINGS_FLOW_HOME)) {
    Logger.warn(
      LOG_SCOPE,
      `${helper}: settings host outside the Settings stack; popping to the stack root`,
      state.routeNames[0],
    );
    dispatch(navigation, { type: "POP_TO_TOP" });
    return;
  }
  const root = state?.routes[0];
  if (
    state != null &&
    root?.name === SETTINGS_ROOT &&
    !state.routes.some((route) => route.name === SETTINGS_FLOW_HOME)
  ) {
    const routes = [root, { name: SETTINGS_FLOW_HOME }];
    dispatch(navigation, {
      type: "RESET",
      payload: { ...state, routes, index: routes.length - 1 },
      target: state.key,
    });
    return;
  }
  dispatch(navigation, {
    type: "POP_TO",
    payload: { name: SETTINGS_FLOW_HOME, params: undefined, merge: undefined },
  });
}

/**
 * Digest host: switch to Digest without a Back-history entry (D-35), then pop
 * the flow routes off the Settings stack while it is off-screen, so a later
 * visit to Settings does not reopen a finished flow.
 */
function endOnDigest(navigation: FlowNavigator): void {
  const state = navigation.getState();
  switchTabWithoutHistory(navigation.getParent(), "DigestTab");
  if (state == null) return;
  const firstFlow = state.routes.findIndex((route) =>
    FLOW_ROUTE_NAMES.has(route.name),
  );
  if (firstFlow === -1) return;
  const count = state.index - firstFlow + 1;
  if (count <= 0 || state.index <= 0) return;
  dispatch(navigation, {
    type: "POP",
    payload: { count },
    target: state.key,
  });
}

/**
 * Finish a flow that produced its result (Done, header Back and system Back
 * on a completion screen; D-08, D-110). A profile host has no survivor here,
 * so it just goes back; merges call `finishFlowOnProfile`.
 */
export function finishFlow(navigation: FlowNavigator, host: FlowHost): void {
  switch (host.kind) {
    case "settings":
      endOnSettings(navigation, "finishFlow");
      return;
    case "digest":
      endOnDigest(navigation);
      return;
    case "profile":
      navigation.goBack();
      return;
  }
}

/**
 * The routes kept beneath the survivor's Profile: everything below the route
 * whose KEY is the launching Profile's (never a name match, T-38.12-07). If
 * that key is gone, everything below the first flow route.
 */
function routesBelowLaunch<R extends FlowRoute>(
  routes: readonly R[],
  profileKey: string,
): R[] {
  const launch = routes.findIndex((route) => route.key === profileKey);
  if (launch !== -1) return routes.slice(0, launch);
  Logger.warn(
    LOG_SCOPE,
    "finishFlowOnProfile: launching Profile not in this stack",
    profileKey,
  );
  const firstFlow = routes.findIndex((route) =>
    FLOW_ROUTE_NAMES.has(route.name),
  );
  return firstFlow === -1 ? routes.slice(0, -1) : routes.slice(0, firstFlow);
}

/** The launching Profile's `returnTab`, when it carries a valid one. */
function launchReturnTab(
  routes: readonly FlowRoute[],
  profileKey: string,
): ProfileReturnTab | undefined {
  const params = routes.find((route) => route.key === profileKey)?.params as
    | { returnTab?: unknown }
    | undefined;
  const returnTab = params?.returnTab;
  return returnTab === "SettingsTab" || returnTab === "DigestTab"
    ? returnTab
    : undefined;
}

/**
 * A merge started from a Profile's ⋯ ends on the surviving person's Profile
 * in that stack (D-110, 38.9 D-08). Only the current stack is reset (the
 * `CommonActions.reset` shape over the live state, so other tabs and the
 * routes below the launching Profile are untouched): the routes below the
 * launching Profile plus `Profile { contactId: survivorId }`. The launching
 * Profile is replaced, because it may show the absorbed person. When that
 * Profile was opened from a flow with `returnTab` (Import complete → View
 * contact), the survivor's Profile keeps it, so its Back still returns to that
 * tab (D-110; 38.12 D-IN-03).
 */
export function finishFlowOnProfile(
  navigation: FlowNavigator,
  host: FlowHost,
  survivorId: number,
): void {
  if (host.kind !== "profile") {
    finishFlow(navigation, host);
    return;
  }
  const state = navigation.getState();
  if (state == null) return;
  const returnTab = launchReturnTab(state.routes, host.profileKey);
  const routes = [
    ...routesBelowLaunch(state.routes, host.profileKey),
    {
      name: "Profile",
      params:
        returnTab === undefined
          ? { contactId: survivorId }
          : { contactId: survivorId, returnTab },
    },
  ];
  dispatch(navigation, {
    type: "RESET",
    payload: { ...state, routes, index: routes.length - 1 },
    target: state.key,
  });
}

/**
 * Leave a flow before it produced anything (the legacy picker's in-screen way
 * out on denied/permanent, D-57; Phase 39 retargets it via the host, 39 D-61).
 */
export function exitFlow(navigation: FlowNavigator, host: FlowHost): void {
  switch (host.kind) {
    case "settings":
      endOnSettings(navigation, "exitFlow");
      return;
    case "digest":
      endOnDigest(navigation);
      return;
    case "profile":
      navigation.goBack();
      return;
  }
}

/** The Bin list's route (ArchivedContactsScreen), in the Settings and Contacts stacks. */
const BIN_ROUTE = "Archived";

/**
 * "Open the Bin" from a flow: the single import review's "In the Bin: <name>"
 * view (38.12 D-155). Restore and permanent deletion live only in the Bin list
 * (ADR-018), so the view opens it, with the binned Profile banner's pattern
 * (`openBinFromProfile`, D-93): a Bin already beneath the flow is popped back
 * to; otherwise the Bin opens where the flow ends.
 *
 * - `settings`: the flow ends on Contacts & Relationships (D-110) and the Bin
 *   opens above it, where Settings itself opens the Bin, so Back from the Bin
 *   lands on the flow's ending. One RESET of this stack, keeping the routes
 *   up to Contacts & Relationships by reference (or `[Settings, Contacts &
 *   Relationships]` when it is absent, as `endOnSettings` does).
 * - `digest`: the Bin opens in the Contacts tab (`navigateIntoTab`, RG-021),
 *   then the flow routes are popped off the Settings stack while it is
 *   off-screen.
 * - `profile`: `openBinFromProfile` on this stack.
 */
export function openBinFromFlow(
  navigation: FlowNavigator,
  host: FlowHost,
): void {
  const state = navigation.getState();
  if (host.kind === "profile") {
    openBinFromProfile({
      getState: () => state,
      dispatch: (action: never) => navigation.dispatch(action),
      navigate: (...args: never[]) => navigation.getParent()?.navigate(...args),
    });
    return;
  }
  if (state == null) return;
  const firstFlow = state.routes.findIndex((route) =>
    FLOW_ROUTE_NAMES.has(route.name),
  );
  const below =
    firstFlow === -1 ? state.routes : state.routes.slice(0, firstFlow);
  if (below.some((route) => route.name === BIN_ROUTE)) {
    dispatch(navigation, {
      type: "POP_TO",
      payload: { name: BIN_ROUTE, params: undefined, merge: undefined },
    });
    return;
  }
  if (
    host.kind === "settings" &&
    state.routeNames.includes(SETTINGS_FLOW_HOME) &&
    state.routeNames.includes(BIN_ROUTE)
  ) {
    const home = below.findIndex((route) => route.name === SETTINGS_FLOW_HOME);
    const base: object[] =
      home !== -1
        ? below.slice(0, home + 1)
        : [
            below[0]?.name === SETTINGS_ROOT
              ? below[0]
              : { name: SETTINGS_ROOT },
            { name: SETTINGS_FLOW_HOME },
          ];
    const routes = [...base, { name: BIN_ROUTE }];
    dispatch(navigation, {
      type: "RESET",
      payload: { ...state, routes, index: routes.length - 1 },
      target: state.key,
    });
    return;
  }
  // Digest host (or a stack without the Settings routes): open the Bin in the
  // Contacts tab, then drop the finished flow off this stack off-screen.
  navigateIntoTab(navigation.getParent(), "DashboardTab", BIN_ROUTE);
  if (firstFlow === -1 || firstFlow === 0) return;
  dispatch(navigation, {
    type: "POP",
    payload: { count: state.index - firstFlow + 1 },
    target: state.key,
  });
}

/** The container shape `openProfileInContactsTab` takes, over the tab parent. */
function contactsNavigator(
  parent: FlowParentNavigator | undefined,
): ContactsProfileNavigator {
  if (parent == null) return null;
  return {
    getRootState: () => parent.getState(),
    navigate: (...args: never[]) => parent.navigate(...args),
    dispatch: (action: never) => parent.dispatch(action),
  };
}

/**
 * "View contact" and a tapped name from a flow (D-109, D-110): a settings or
 * digest host opens the person's full Profile on the Contacts tab, carrying
 * `returnTab` so Back from it returns to the host tab rather than Contacts
 * Home. A profile host pushes the Profile in its own stack.
 */
export function openContactFromFlow(
  navigation: FlowNavigator,
  host: FlowHost,
  contactId: number,
): void {
  if (host.kind === "profile") {
    dispatch(navigation, {
      type: "PUSH",
      payload: { name: "Profile", params: { contactId } },
    });
    return;
  }
  openProfileInContactsTab(
    contactsNavigator(navigation.getParent()),
    contactId,
    { returnTab: host.kind === "digest" ? "DigestTab" : "SettingsTab" },
  );
}

/**
 * Back from a Contacts-tab Profile that a flow opened with `returnTab`: switch
 * to the host tab first (no history entry, D-35), then pop this Profile off
 * the Contacts stack while it is off-screen, so Contacts Home never flashes
 * and the Contacts tab keeps its prior state (RESEARCH §4 step 3).
 */
export function returnFromProfileToTab(
  navigation: FlowNavigator,
  returnTab: ProfileReturnTab,
): void {
  const state = navigation.getState();
  switchTabWithoutHistory(navigation.getParent(), returnTab);
  if (state == null || state.index <= 0) return;
  dispatch(navigation, {
    type: "POP",
    payload: { count: 1 },
    target: state.key,
  });
}
