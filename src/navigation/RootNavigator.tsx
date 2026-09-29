import {
  BottomTabBar,
  type BottomTabBarProps,
  type BottomTabNavigationOptions,
  type BottomTabNavigationProp,
  createBottomTabNavigator as createBottomTabs,
} from "@react-navigation/bottom-tabs";
import {
  type EventArg,
  getFocusedRouteNameFromRoute,
  type RouteProp,
  StackActions,
} from "@react-navigation/native";
import { type ReactNode, useEffect, useState } from "react";
import { BackHandler, Keyboard, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/icons/Icon";
import { TAB_ICON } from "@/components/icons/icon-registry";
import { BackgroundHost } from "@/components/ui/BackgroundHost";
import { selectFabDialOpen } from "@/components/universal-fab-logic";
import { CONTACTS, DIGEST, EVENTS } from "@/constants/product-labels";
import { DashboardStack } from "@/navigation/tabs/DashboardStack";
import { DigestStack } from "@/navigation/tabs/DigestStack";
import { EventsStack } from "@/navigation/tabs/EventsStack";
import { OrreryStack } from "@/navigation/tabs/OrreryStack";
import { SettingsStack } from "@/navigation/tabs/SettingsStack";
import { useFocusedRouteStore } from "@/stores/focused-route-store";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { setTabBarHeight } from "@/stores/tab-bar-layout-store";
import { useTheme } from "@/theme";
import { resolveBackIntent } from "./back-intent";
import {
  densityForRoute,
  isFocusedWorkflow,
  systemBackgroundSlotOverride,
} from "./focused-route-classification";
import { INITIAL_TAB } from "./shell-contract";
import type { TabParamList } from "./types";
import { useWindowObstacle } from "./use-window-measurement";

/**
 * The app's permanent five-tab shell. Each tab owns a native stack, preserving
 * in-tab history when the user switches sections.
 *
 * `headerShown: false` (screenOptions): every screen renders its OWN back
 * chrome (the `CustomFieldsScreen` header/back/title pattern the whole phase
 * reuses), so a native-stack header on top would double up. With no header
 * there is also no colour literal needed on `screenOptions` — each screen's
 * themed root supplies its background via `useTheme().colors.*` (check:colors).
 * Predictive back remains disabled in app.config.ts. Android system Back walks
 * the current tab stack rather than a swipe gesture.
 */
const Tab = createBottomTabs<TabParamList>();

// DEV-only (38.5-06): applies the art-treatment override's combination in memory
// for the re-sign-off capture. Kept behind a compile-time guard so Metro removes
// it from release bundles (the SettingsStack ThemePreview precedent).
const ArtSheetComboSync: (() => null) | null = __DEV__
  ? require("@/components/ui/__dev__/ArtSheetComboSync").ArtSheetComboSync
  : null;

type TabNavigation = BottomTabNavigationProp<TabParamList>;
type TabRoute = RouteProp<TabParamList, keyof TabParamList>;

function MeasuredTabBar(props: BottomTabBarProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const focused = props.state.routes[props.state.index];
  const options = props.descriptors[focused.key].options;
  const tabStyle = StyleSheet.flatten(options.tabBarStyle);
  const hidden =
    (tabStyle != null &&
      "display" in tabStyle &&
      tabStyle.display === "none") ||
    (options.tabBarHideOnKeyboard === true && keyboardOpen);
  const measurement = useWindowObstacle("shell-tabs", !hidden, focused.key);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return (
    <View
      ref={measurement.ref}
      collapsable={false}
      onLayout={(event) => {
        setTabBarHeight(event.nativeEvent.layout.height);
        measurement.onLayout(event);
      }}
    >
      <BottomTabBar {...props} />
    </View>
  );
}

function handleActiveTabPress(
  event: EventArg<string, true, undefined>,
  navigation: TabNavigation,
  route: TabRoute,
) {
  if (!navigation.isFocused()) return;

  if (shellTransientStore.getState().dismissTop()) {
    event.preventDefault();
    return;
  }

  const focusedTab = navigation
    .getState()
    .routes.find((candidate) => candidate.key === route.key);
  const focusedStack = focusedTab?.state;
  const canGoBack =
    focusedStack?.type === "stack" &&
    (focusedStack.index ?? focusedStack.routes.length - 1) > 0;

  if (canGoBack && focusedStack.key) {
    event.preventDefault();
    navigation.dispatch({
      ...StackActions.popToTop(),
      target: focusedStack.key,
    });
  }
}

/**
 * The safe-area container around the tab navigator. While the FAB speed dial
 * is open, the whole navigator (every tab's screens and the tab bar) is hidden
 * from accessibility, so TalkBack and Switch Access reach only the dial (38.4
 * D-31, the 38.3 RG-020 pattern). It reads a store selector, never mirrored
 * state, so closing the dial restores the tree. Subscribing here rather than in
 * RootNavigator keeps a dial toggle from re-rendering the navigator: the
 * `children` element is unchanged, so React skips it.
 *
 * No `accessible` prop: on Android it would merge the navigator into one node.
 * No `pointerEvents` either: the dial's full-screen scrim already intercepts
 * touch while open. `importantForAccessibility` does not move Android keyboard
 * focus, so the dial holds keyboard focus with its own cycle (UniversalFab).
 */
function TabNavigatorContainer({ children }: { children: ReactNode }) {
  const fabDialOpen = shellTransientStore(selectFabDialOpen);
  return (
    <SafeAreaView
      edges={["top"]}
      importantForAccessibility={fabDialOpen ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={fabDialOpen}
      style={styles.fill}
    >
      {children}
    </SafeAreaView>
  );
}

export function RootNavigator() {
  const { colors } = useTheme();
  const focusedRoute = useFocusedRouteStore((state) => state.routeName);

  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    // BackHandler invokes the most recently registered listener first. Register
    // after NavigationContainer's default nested-back listener so an open shell
    // overlay gets first refusal; the default remains untouched otherwise.
    const registrationTimer = setTimeout(() => {
      subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        const intent = resolveBackIntent({
          anyTransientOpen: shellTransientStore.getState().isAnyOpen(),
        });

        if (intent === "dismiss-transient") {
          shellTransientStore.getState().dismissTop();
          return true;
        }

        return false;
      });
    }, 0);

    return () => {
      clearTimeout(registrationTimer);
      subscription?.remove();
    };
  }, []);

  /**
   * This is intentionally limited to shell-owned transients (the speed dial and
   * picker). Plan 04's app-bar Back must call the same resolveBackIntent /
   * dismissTop path, so system and shell-visible Back make the same decision.
   *
   * Screens on the shared ShellAppBar (every tab root, plus child screens such
   * as Archived, UnboundContacts and Backup) already take this path: the child
   * header Back calls resolveBackIntent, and tab roots show no Back at all
   * (38.4 D-22/D-23). Screens that still own their own Back, for example
   * ComposeScreen's in-body Back plus its native-system Back listener and
   * CaptureScreen's native-system Back listener, do not consult back-intent.
   * That is a deferred child-chrome pass, not a claim that the FAB is hidden
   * on child screens (it is visible on browse children including Archived,
   * UnboundContacts, and Profile).
   *
   * This is safe while every shell transient keeps its StyleSheet.absoluteFill
   * scrim with pointer events set to auto while open: the scrim physically
   * intercepts a screen-owned Back tap, and without a transient goBack() is the
   * same default branch. If a later change shrinks that full-screen scrim,
   * re-route those screen-owned controls through back-intent immediately to
   * prevent divergence.
   */
  const tabOptions = (
    title: string,
    route: TabRoute,
    rootRouteName: string,
  ): BottomTabNavigationOptions => ({
    title,
    tabBarStyle: {
      backgroundColor: colors.surface,
      display: isFocusedWorkflow(
        getFocusedRouteNameFromRoute(route) ?? rootRouteName,
      )
        ? "none"
        : "flex",
    },
  });

  return (
    <BackgroundHost
      density={densityForRoute(focusedRoute)}
      slotId={systemBackgroundSlotOverride(focusedRoute)}
    >
      {ArtSheetComboSync ? <ArtSheetComboSync /> : null}
      <TabNavigatorContainer>
        <Tab.Navigator
          initialRouteName={INITIAL_TAB}
          tabBar={(props) => <MeasuredTabBar {...props} />}
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarHideOnKeyboard: true,
            animation: "fade",
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: { backgroundColor: colors.surface },
            // Route each tab through the semantic icon registry (the ad-hoc
            // per-route glyph map is retired). Icon resolves colour via its own
            // theme tone — accent when
            // focused, textSecondary otherwise — mirroring the tab bar's former
            // active/inactive tint, and size via the ICON_SIZE `lg` token.
            tabBarIcon: ({ focused }) => (
              <Icon
                name={TAB_ICON[route.name]}
                state={focused ? "active" : "default"}
                tone={focused ? "accent" : "textSecondary"}
                size="lg"
              />
            ),
          })}
        >
          <Tab.Screen
            name="DashboardTab"
            component={DashboardStack}
            options={({ route }) => tabOptions(CONTACTS, route, "Home")}
            listeners={({ navigation, route }) => ({
              tabPress: (event) =>
                handleActiveTabPress(event, navigation, route),
            })}
          />
          <Tab.Screen
            name="EventsTab"
            component={EventsStack}
            options={({ route }) => tabOptions(EVENTS, route, "GroupEvents")}
            listeners={({ navigation, route }) => ({
              tabPress: (event) =>
                handleActiveTabPress(event, navigation, route),
            })}
          />
          <Tab.Screen
            name="DigestTab"
            component={DigestStack}
            options={({ route }) => tabOptions(DIGEST, route, "Digest")}
            listeners={({ navigation, route }) => ({
              tabPress: (event) =>
                handleActiveTabPress(event, navigation, route),
            })}
          />
          <Tab.Screen
            name="OrreryTab"
            component={OrreryStack}
            options={({ route }) => tabOptions("Orrery", route, "Orrery")}
            listeners={({ navigation, route }) => ({
              tabPress: (event) =>
                handleActiveTabPress(event, navigation, route),
            })}
          />
          <Tab.Screen
            name="SettingsTab"
            component={SettingsStack}
            options={({ route }) => tabOptions("Settings", route, "Settings")}
            listeners={({ navigation, route }) => ({
              tabPress: (event) =>
                handleActiveTabPress(event, navigation, route),
            })}
          />
        </Tab.Navigator>
      </TabNavigatorContainer>
    </BackgroundHost>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
