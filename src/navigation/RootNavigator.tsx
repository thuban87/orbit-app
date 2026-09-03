import {
  BottomTabBar,
  createBottomTabNavigator as createBottomTabs,
  type BottomTabBarProps,
  type BottomTabNavigationOptions,
  type BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import {
  getFocusedRouteNameFromRoute,
  StackActions,
  type EventArg,
  type RouteProp,
} from "@react-navigation/native";
import { useEffect } from "react";
import { BackHandler, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DashboardStack } from "@/navigation/tabs/DashboardStack";
import { OrreryStack } from "@/navigation/tabs/OrreryStack";
import { BackupStack } from "@/navigation/tabs/BackupStack";
import { SettingsStack } from "@/navigation/tabs/SettingsStack";
import { useTheme } from "@/theme";
import { resolveBackIntent } from "./back-intent";
import { isFocusedWorkflow } from "./focused-route-classification";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { setTabBarHeight } from "@/stores/tab-bar-layout-store";
import type { TabParamList } from "./types";

/**
 * The app's permanent four-tab shell. Each tab owns a native stack, preserving
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

const TAB_GLYPHS: Record<keyof TabParamList, string> = {
  DashboardTab: "⌂",
  OrreryTab: "◎",
  BackupTab: "↥",
  SettingsTab: "⚙",
};

type TabNavigation = BottomTabNavigationProp<TabParamList>;
type TabRoute = RouteProp<TabParamList, keyof TabParamList>;

function MeasuredTabBar(props: BottomTabBarProps) {
  return (
    <View
      onLayout={(event) => setTabBarHeight(event.nativeEvent.layout.height)}
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

export function RootNavigator() {
  const { colors } = useTheme();

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
   * Existing child visible Back controls in DigestScreen, ArchivedContactsScreen,
   * NeverContactedScreen, UnboundContactsScreen, and BackupScreen still call
   * navigation.goBack() directly. ComposeScreen and CaptureScreen also own
   * native-system Back listeners. They are a deferred child-chrome pass, not a
   * claim that the FAB is hidden on child screens (it is visible on browse
   * children including Archived, NeverContacted, UnboundContacts, and Profile).
   *
   * This is safe while every shell transient keeps its StyleSheet.absoluteFill
   * scrim with pointer events set to auto while open: the scrim physically
   * intercepts a child Back tap, and without a transient goBack() is the same
   * default branch. If a later change shrinks that full-screen scrim, re-route
   * those child controls through back-intent immediately to prevent divergence.
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
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="DashboardTab"
        tabBar={(props) => <MeasuredTabBar {...props} />}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarHideOnKeyboard: true,
          animation: "fade",
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: { backgroundColor: colors.surface },
          tabBarIcon: ({ color }) => (
            <Text style={{ color }}>{TAB_GLYPHS[route.name]}</Text>
          ),
        })}
      >
        <Tab.Screen
          name="DashboardTab"
          component={DashboardStack}
          options={({ route }) => tabOptions("Dashboard", route, "Home")}
          listeners={({ navigation, route }) => ({
            tabPress: (event) => handleActiveTabPress(event, navigation, route),
          })}
        />
        <Tab.Screen
          name="OrreryTab"
          component={OrreryStack}
          options={({ route }) => tabOptions("Orrery", route, "Orrery")}
          listeners={({ navigation, route }) => ({
            tabPress: (event) => handleActiveTabPress(event, navigation, route),
          })}
        />
        <Tab.Screen
          name="BackupTab"
          component={BackupStack}
          options={({ route }) => tabOptions("Backup", route, "Backup")}
          listeners={({ navigation, route }) => ({
            tabPress: (event) => handleActiveTabPress(event, navigation, route),
          })}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsStack}
          options={({ route }) => tabOptions("Settings", route, "Settings")}
          listeners={({ navigation, route }) => ({
            tabPress: (event) => handleActiveTabPress(event, navigation, route),
          })}
        />
      </Tab.Navigator>
    </SafeAreaView>
  );
}
