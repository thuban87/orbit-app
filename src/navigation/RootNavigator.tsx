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
import { useEffect, useState } from "react";
import { BackHandler, Keyboard, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/icons/Icon";
import { TAB_ICON } from "@/components/icons/icon-registry";
import { BackupStack } from "@/navigation/tabs/BackupStack";
import { DashboardStack } from "@/navigation/tabs/DashboardStack";
import { OrreryStack } from "@/navigation/tabs/OrreryStack";
import { SettingsStack } from "@/navigation/tabs/SettingsStack";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { setTabBarHeight } from "@/stores/tab-bar-layout-store";
import { useTheme } from "@/theme";
import { resolveBackIntent } from "./back-intent";
import { isFocusedWorkflow } from "./focused-route-classification";
import type { TabParamList } from "./types";
import { useWindowObstacle } from "./use-window-measurement";

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

type TabNavigation = BottomTabNavigationProp<TabParamList>;
type TabRoute = RouteProp<TabParamList, keyof TabParamList>;

function MeasuredTabBar(props: BottomTabBarProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const focused = props.state.routes[props.state.index];
  const options = props.descriptors[focused.key].options;
  const hidden =
    StyleSheet.flatten(options.tabBarStyle)?.display === "none" ||
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
   * UnboundContactsScreen, and BackupScreen still call
   * navigation.goBack() directly. ComposeScreen and CaptureScreen also own
   * native-system Back listeners. They are a deferred child-chrome pass, not a
   * claim that the FAB is hidden on child screens (it is visible on browse
   * children including Archived, UnboundContacts, and Profile).
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
