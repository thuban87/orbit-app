import {
  createBottomTabNavigator as createBottomTabs,
  type BottomTabNavigationOptions,
  type BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import {
  getFocusedRouteNameFromRoute,
  StackActions,
  type EventArg,
  type RouteProp,
} from "@react-navigation/native";
import { Text } from "react-native";
import { DashboardStack } from "@/navigation/tabs/DashboardStack";
import { OrreryStack } from "@/navigation/tabs/OrreryStack";
import { BackupStack } from "@/navigation/tabs/BackupStack";
import { SettingsStack } from "@/navigation/tabs/SettingsStack";
import { useTheme } from "@/theme";
import { isFocusedWorkflow } from "./focused-route-classification";
import { shellTransientStore } from "@/stores/shell-transient-store";
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
    <Tab.Navigator
      initialRouteName="DashboardTab"
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
  );
}
