/**
 * Render-free routing contract for the shell-level universal capture FAB.
 * Shell-level navigation always targets a tab plus its nested screen: a bare
 * screen name cannot be resolved reliably from the navigation container.
 */
import type { TabParamList } from "@/navigation/types";
import type { ThemePalette } from "@/theme/theme-types";

/**
 * Permanent FAB border (38.4 D-56, owner 2026-09-27; OA-C2). The FAB carries
 * one ring on every screen that shows it, drawn by the one FAB component. This
 * replaces D-45's Backup-settings-only border: no route keying.
 *
 * The colour is the `onAccent` palette role, because ADR-084 validates
 * `onAccent` against every curated accent fill (`accents.test.ts`), so the ring
 * stays distinct over any accent-filled button beneath the FAB. The width is a
 * single-number tuning point; RN draws the border inside the 56dp box, so the
 * FAB's size and centre do not change.
 */
export const FAB_BORDER_WIDTH = 2;
export const FAB_BORDER_COLOR_KEY = "onAccent" satisfies keyof ThemePalette;

/**
 * The + actions (38.11 D-62, D-66): Update Contact retired (Edit Contact is the
 * single contact form) and Memory left the + (memories are added from the
 * Profile sections, Add/Edit Contact, the post-Quick-Log step and sharing).
 * Group Log stays until 38.15 (D-72).
 */
export type UniversalFabActionId =
  | "AddContact"
  | "QuickLog"
  | "LogContact"
  | "GroupLog";

export interface UniversalFabAction {
  id: UniversalFabActionId;
  label: string;
}

export const UNIVERSAL_FAB_ACTIONS = Object.freeze([
  { id: "AddContact", label: "Add Contact" },
  { id: "QuickLog", label: "Quick Log" },
  { id: "LogContact", label: "Log Interaction" },
  { id: "GroupLog", label: "Group Log" },
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
 * Accessibility props for a same-window shell overlay that sits OUTSIDE the
 * tab navigator (App.tsx: the Quick Log undo `Snackbar`). The `AssistBanner`
 * keeps them too, although since 38.6 D-38 it renders in flow inside the
 * navigator's container, which already hides it while the dial is open.
 * While the dial is open they are hidden from TalkBack and Switch Access like
 * the navigator itself (D-31; owner default D-42 A). Only these two props:
 * `accessible` would merge the overlay into one node, and touch is unchanged
 * (the dial's scrim already takes it). RN `Modal`s are separate native windows
 * this cannot reach and are exempt (`fab-dial-shell-overlays-contract.test.ts`).
 */
export function fabDialBackgroundA11y(open: boolean): {
  importantForAccessibility: "no-hide-descendants" | "auto";
  accessibilityElementsHidden: boolean;
} {
  return {
    importantForAccessibility: open ? "no-hide-descendants" : "auto",
    accessibilityElementsHidden: open,
  };
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

/** The tab a + form opens over (D-38): the tab the user is on. */
export type FabTab = keyof TabParamList;

export type FabNavigateIntent = {
  kind: "navigate";
  tab: FabTab;
  screen: "Create" | "GroupLog" | "LogContact";
  params?: { contactId: number };
};

export type FabPickThenIntent = {
  kind: "pick-then";
  screen: "LogContact";
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
  /** The focused tab; + forms open over it (D-38). */
  tab: FabTab;
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
  { originContactId, tab }: FabContext,
): FabTargetIntent {
  // D-38: every navigate intent opens over the current tab; completion
  // destinations stay with the screens (D-08).
  switch (actionId) {
    case "AddContact":
      return { kind: "navigate", tab, screen: "Create" };
    case "QuickLog":
      return { kind: "quick-log", contactId: originContactId };
    case "GroupLog":
      // Group Log owns its own participant workflow; it never preselects here.
      return { kind: "navigate", tab, screen: "GroupLog" };
    case "LogContact":
      return originContactId === null
        ? { kind: "pick-then", screen: actionId }
        : {
            kind: "navigate",
            tab,
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

export type FocusedContactContext = FabContext;

/**
 * Where the + opens when no known tab is focused (state not ready or
 * malformed): the Contacts tab, today's destination (this plan only).
 */
const NO_KNOWN_TAB: FabTab = "DashboardTab";

const KNOWN_TABS: readonly FabTab[] = [
  "DashboardTab",
  "EventsTab",
  "DigestTab",
  "OrreryTab",
  "SettingsTab",
];

function isKnownTab(name: string): name is FabTab {
  return (KNOWN_TABS as readonly string[]).includes(name);
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
 * Returns the focused tab (D-38: the + opens its forms over it) and the
 * profile context from any focused relationship-browsing tab stack,
 * including the Settings-hosted Profile (Settings → Archived → Profile — RG-021,
 * react-native/AUD-RN-004). A tab root or a non-Profile child yields no contact.
 * Navigation state may be incomplete before the container is ready, so malformed
 * trees deliberately resolve to no context rather than throwing.
 */
export function getFocusedContactContext(
  navigationState: NavigationStateNode | undefined,
): FocusedContactContext {
  const tabRoute = focusedRoute(navigationState);
  if (!tabRoute || !isKnownTab(tabRoute.name)) {
    return { originContactId: null, tab: NO_KNOWN_TAB };
  }
  const tab = tabRoute.name;

  const profileRoute = focusedRoute(tabRoute.state);
  const params = profileRoute?.params;
  const contactId =
    params && "contactId" in params
      ? (params as { contactId?: unknown }).contactId
      : undefined;

  return profileRoute?.name === "Profile" && typeof contactId === "number"
    ? { originContactId: contactId, tab }
    : { originContactId: null, tab };
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
 * hosted Profile from 38.3-10 — is unchanged. Both fallbacks keep the focused
 * `tab`, so + from an archived Settings-hosted Profile still opens over
 * Settings (D-38; review C10-L2).
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
      : { ...context, originContactId: null };
  } catch {
    return { ...context, originContactId: null };
  }
}
