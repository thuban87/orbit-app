import type {
  DashboardStackParamList,
  DigestStackParamList,
  EventsStackParamList,
  OrreryStackParamList,
  SettingsStackParamList,
  TabParamList,
} from "./types";

/**
 * The single owner of cross-tab nested entry (RG-021, react-native/AUD-RN-002;
 * ADR-146 semantic-root routing).
 *
 * Tabs are lazy, so a tab the user has not visited yet has no stack. A bare
 * nested payload — `navigate("DashboardTab", { screen: "Create" })` — makes
 * `@react-navigation/core` (`useNavigationBuilder` `getStateFromParams`) build
 * that first stack from the payload alone: `[Create]`. Create then `replace`s
 * itself with Profile, leaving `[Profile]`, and neither Back nor the reselect
 * popToTop can reach Contacts Home because it was never in the stack.
 *
 * `initial: false` tells the nested navigator to initialize with its declared
 * `initialRouteName` (the tab's semantic root) and push `screen` on top of it.
 * A tab stack that is already mounted still receives an ordinary NAVIGATE, so
 * existing push behaviour and each tab's independent history are unchanged.
 *
 * Never replace this with a `reset`: broad resets destroy the independent tab
 * histories ADR-146 and D-03 preserve. Deliberate external resets (notification
 * and widget intents, Done buttons) live in `reset-intents.ts` and are not
 * cross-tab entries. A repository guard in `tab-entry.test.ts` fails if any
 * source file navigates into a tab with a nested payload directly.
 */

/**
 * The nested stack param list each tab route carries. Spelled out rather than
 * inferred from `NavigatorScreenParams`, whose union shape loses per-screen
 * param types under `infer`. Indexing it by `keyof TabParamList` fails to
 * compile if a tab is ever added to `TabParamList` without a row here.
 */
type TabStackParamLists = {
  DashboardTab: DashboardStackParamList;
  EventsTab: EventsStackParamList;
  DigestTab: DigestStackParamList;
  OrreryTab: OrreryStackParamList;
  SettingsTab: SettingsStackParamList;
};
type TabStackParams<Tab extends keyof TabParamList> = TabStackParamLists[Tab];

/**
 * Structural navigator shape: satisfied by the container ref, a tab navigator
 * obtained from `getParent()`, and `useNavigation()` results alike.
 */
export type TabEntryNavigator =
  | { navigate(...args: never[]): void }
  | null
  | undefined;

export function navigateIntoTab<
  Tab extends keyof TabParamList,
  Screen extends Extract<keyof TabStackParams<Tab>, string>,
>(
  nav: TabEntryNavigator,
  tab: Tab,
  screen: Screen,
  params?: TabStackParams<Tab>[Screen],
): void {
  nav?.navigate(tab as never, { screen, params, initial: false } as never);
}

/**
 * Focus a tab without a nested payload. Private to this file so the RG-021
 * guard (tab-entry.test.ts) keeps every cross-tab entry here.
 */
function focusTab(nav: TabEntryNavigator, tab: keyof TabParamList): void {
  nav?.navigate(tab as never);
}

/** The slice of the root (tab) state `planContactsProfileOpen` reads. */
export type ContactsProfileRootState =
  | {
      routes: readonly {
        name: string;
        state?:
          | { key?: string; stale?: boolean; routes?: readonly unknown[] }
          | undefined;
      }[];
    }
  | null
  | undefined;

export type ContactsProfileOpenPlan =
  | { kind: "navigate-into" }
  | { kind: "push"; stackKey: string };

/**
 * How to open a Profile in the Contacts tab (D-50). A mounted Contacts stack
 * (a live state: a key and `stale: false`) gets a push onto it, because a
 * nested navigate to "Profile" would rewrite the params of a Profile already
 * on top of that stack in place (no `getId`), showing the wrong person
 * (T-38.9-18). An unmounted stack is entered with `navigateIntoTab`, so Home
 * stays under the Profile.
 */
export function planContactsProfileOpen(
  rootState: ContactsProfileRootState,
): ContactsProfileOpenPlan {
  const stack = rootState?.routes.find(
    (route) => route.name === "DashboardTab",
  )?.state;
  return stack != null && typeof stack.key === "string" && stack.stale === false
    ? { kind: "push", stackKey: stack.key }
    : { kind: "navigate-into" };
}

/** The container ref, structurally: root state, navigate and dispatch. */
export type ContactsProfileNavigator =
  | {
      getRootState(): ContactsProfileRootState;
      navigate(...args: never[]): void;
      dispatch(action: never): void;
    }
  | null
  | undefined;

/**
 * Open the person's Profile in the Contacts tab (D-50, owner 2026-10-10): the
 * one completion jump out of Settings, used when an Add Contact started from
 * the Settings tab saves. The push action is a plain object with the shape of
 * `StackActions.push` so this module stays importable from node tests.
 */
export function openProfileInContactsTab(
  nav: ContactsProfileNavigator,
  contactId: number,
): void {
  if (nav == null) return;
  const plan = planContactsProfileOpen(nav.getRootState());
  if (plan.kind === "navigate-into") {
    navigateIntoTab(nav, "DashboardTab", "Profile", { contactId });
    return;
  }
  focusTab(nav, "DashboardTab");
  const push = {
    type: "PUSH",
    payload: { name: "Profile", params: { contactId } },
    target: plan.stackKey,
  };
  nav.dispatch(push as never);
}
