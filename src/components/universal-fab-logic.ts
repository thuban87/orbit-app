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
  { id: "LogContact", label: "Log Interaction" },
  { id: "GroupLog", label: "Group Log" },
  { id: "UpdateContact", label: "Update Contact" },
  { id: "Memory", label: "Memory" },
] as const satisfies readonly UniversalFabAction[]);

/**
 * The speed dial's `shellTransientStore` entry id. One source for the dial
 * (which registers it) and the navigator (which hides the background while it
 * is open, D-31). The value is unchanged from the dial's former local id.
 */
export const FAB_DIAL_TRANSIENT_ID = "fab-speed-dial";

/**
 * Whether the FAB speed dial is open, read from the shell transient registry
 * (a store selector, never mirrored state, so closing the dial always restores
 * the background). Only the dial counts: other transients such as the
 * dashboard panel keep their own scoped inertness (38.3 RG-020).
 */
export function selectFabDialOpen(state: {
  entries: readonly { id: string }[];
}): boolean {
  return state.entries.some((entry) => entry.id === FAB_DIAL_TRANSIENT_ID);
}

/**
 * Android native keyboard focus links for one dial element. Values are native
 * view tags (`findNodeHandle`); `undefined` leaves Android's default search.
 */
export interface DialFocusLinks {
  nextFocusForward: number | undefined;
  nextFocusUp: number | undefined;
  nextFocusDown: number | undefined;
}

/**
 * The open dial's keyboard focus cycle (D-31). `importantForAccessibility`
 * does not change Android keyboard focus (38.4 Plan 11 native evidence), so the
 * dial links its own elements: FAB -> row 1 -> ... -> row N -> FAB for TAB
 * (`nextFocusForward`; Shift+TAB follows it in reverse). The rows rise above
 * the FAB in dial order, so the D-pad mirrors it: Up follows the cycle and
 * Down reverses it. A link whose target tag is unresolved stays `undefined`.
 */
export function dialFocusCycle(
  fabTag: number | null,
  rowTags: readonly (number | null)[],
): { fab: DialFocusLinks; rows: DialFocusLinks[] } {
  const order = [fabTag, ...rowTags];
  const links = (index: number): DialFocusLinks => {
    if (order.length < 2) {
      return {
        nextFocusForward: undefined,
        nextFocusUp: undefined,
        nextFocusDown: undefined,
      };
    }
    const next = order[(index + 1) % order.length] ?? undefined;
    const previous =
      order[(index - 1 + order.length) % order.length] ?? undefined;
    return {
      nextFocusForward: next,
      nextFocusUp: next,
      nextFocusDown: previous,
    };
  };
  return {
    fab: links(0),
    rows: rowTags.map((_, index) => links(index + 1)),
  };
}

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

export interface QuickLogUndoRequest {
  contactId: number;
  interactionId: number;
}

/**
 * Keeps an Undo single-flight per interaction instead of across the whole
 * shell. A new Quick Log can replace the snackbar while an earlier deletion
 * is pending, and its Undo must remain actionable.
 */
export function createQuickLogUndoController(
  deleteInteraction: (request: QuickLogUndoRequest) => Promise<void>,
) {
  const pendingInteractionIds = new Set<number>();

  return {
    undo(request: QuickLogUndoRequest): Promise<void> | null {
      if (pendingInteractionIds.has(request.interactionId)) return null;
      pendingInteractionIds.add(request.interactionId);

      return deleteInteraction(request).finally(() => {
        pendingInteractionIds.delete(request.interactionId);
      });
    },
  };
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
 * Returns profile context from any focused relationship-browsing tab stack,
 * including the Settings-hosted Profile (Settings → Archived → Profile — RG-021,
 * react-native/AUD-RN-004). A tab root or a non-Profile child yields no contact.
 * Navigation state may be incomplete before the container is ready, so malformed
 * trees deliberately resolve to no context rather than throwing.
 */
export function getFocusedContactContext(
  navigationState: NavigationStateNode | undefined,
): FocusedContactContext {
  const tabRoute = focusedRoute(navigationState);
  if (
    !tabRoute ||
    ![
      "DashboardTab",
      "EventsTab",
      "DigestTab",
      "OrreryTab",
      "SettingsTab",
    ].includes(tabRoute.name)
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

/** The focused contact's lifecycle as the FAB needs it; `null` when gone. */
export type FabContactState = { archived: boolean } | null;

/**
 * Owner ruling D-29 (review A-WR-07): an archived contact is never FAB context,
 * in any tab — including the Settings-hosted Profile. The FAB then behaves as
 * if there were no contact (the normal picker flows, whose picker lists only
 * live contacts), consistent with D-09/D-25 disabling Message for archived
 * contacts. A contact that no longer exists, or whose lifecycle read fails,
 * is dropped the same way (fail safe: never preselect a contact whose state is
 * unknown). A live contact's context — including the non-archived Settings-
 * hosted Profile from 38.3-10 — is unchanged.
 */
export async function resolveFabContactContext(
  context: FabContext,
  readContactState: (contactId: number) => Promise<FabContactState>,
): Promise<FabContext> {
  if (context.originContactId === null) return context;
  try {
    const state = await readContactState(context.originContactId);
    return state !== null && !state.archived
      ? context
      : { originContactId: null };
  } catch {
    return { originContactId: null };
  }
}
