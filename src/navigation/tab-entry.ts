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
