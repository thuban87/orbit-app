/**
 * Render-free routing contract for the shell-level universal capture FAB.
 * Shell-level navigation always targets a tab plus its nested screen: a bare
 * screen name cannot be resolved reliably from the navigation container.
 */
export type UniversalFabActionId =
  | "AddContact"
  | "QuickLog"
  | "LogContact"
  | "GroupLog"
  | "UpdateContact"
  | "Memory";

export interface UniversalFabAction {
  id: UniversalFabActionId;
  label: string;
}

export const UNIVERSAL_FAB_ACTIONS = Object.freeze([
  { id: "AddContact", label: "Add Contact" },
  { id: "QuickLog", label: "Quick Log" },
  { id: "LogContact", label: "Log Contact" },
  { id: "GroupLog", label: "Group Log" },
  { id: "UpdateContact", label: "Update Contact" },
  { id: "Memory", label: "Memory" },
] as const satisfies readonly UniversalFabAction[]);

export type FabNavigateIntent = {
  kind: "navigate";
  tab: "DashboardTab";
  screen: "Create" | "GroupLog" | "LogContact" | "UpdateContact" | "Memory";
  params?: { contactId: number };
};

export type FabPickThenIntent = {
  kind: "pick-then";
  screen: "LogContact" | "UpdateContact" | "Memory";
};

export type FabQuickLogIntent = {
  kind: "quick-log";
  contactId: number | null;
};

export type FabTargetIntent =
  | FabNavigateIntent
  | FabPickThenIntent
  | FabQuickLogIntent;

export interface FabContext {
  originContactId: number | null;
}

/** Maps a fixed FAB action to an internal, serializable shell intent. */
export function resolveFabTarget(
  actionId: UniversalFabActionId,
  { originContactId }: FabContext,
): FabTargetIntent {
  switch (actionId) {
    case "AddContact":
      return { kind: "navigate", tab: "DashboardTab", screen: "Create" };
    case "QuickLog":
      return { kind: "quick-log", contactId: originContactId };
    case "GroupLog":
      // Group Log owns its own participant workflow; it never preselects here.
      return { kind: "navigate", tab: "DashboardTab", screen: "GroupLog" };
    case "LogContact":
    case "UpdateContact":
    case "Memory":
      return originContactId === null
        ? { kind: "pick-then", screen: actionId }
        : {
            kind: "navigate",
            tab: "DashboardTab",
            screen: actionId,
            params: { contactId: originContactId },
          };
  }
}

export interface NavigationStateNode {
  index?: number;
  routes?: ReadonlyArray<{
    name: string;
    params?: object;
    state?: unknown;
  }>;
}

export interface FocusedContactContext {
  originContactId: number | null;
}

function focusedRoute(state: unknown) {
  if (!state || typeof state !== "object") return null;
  const navigationState = state as NavigationStateNode;
  const index = navigationState.index;
  if (
    !navigationState.routes ||
    !Number.isInteger(index) ||
    index === undefined
  ) {
    return null;
  }
  return navigationState.routes[index] ?? null;
}

/**
 * Returns profile context only from a focused Dashboard/Orrery profile route.
 * Navigation state may be incomplete before the container is ready, so malformed
 * trees deliberately resolve to no context rather than throwing.
 */
export function getFocusedContactContext(
  navigationState: NavigationStateNode | undefined,
): FocusedContactContext {
  const tabRoute = focusedRoute(navigationState);
  if (
    !tabRoute ||
    (tabRoute.name !== "DashboardTab" && tabRoute.name !== "OrreryTab")
  ) {
    return { originContactId: null };
  }

  const profileRoute = focusedRoute(tabRoute.state);
  const params = profileRoute?.params;
  const contactId =
    params && "contactId" in params
      ? (params as { contactId?: unknown }).contactId
      : undefined;

  return profileRoute?.name === "Profile" && typeof contactId === "number"
    ? { originContactId: contactId }
    : { originContactId: null };
}
