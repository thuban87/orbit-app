import { createBottomTabNavigator as createBottomTabs } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { DashboardStack } from "@/navigation/tabs/DashboardStack";
import { OrreryStack } from "@/navigation/tabs/OrreryStack";
import { BackupStack } from "@/navigation/tabs/BackupStack";
import { SettingsStack } from "@/navigation/tabs/SettingsStack";
import { useTheme } from "@/theme";
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

export function RootNavigator() {
  const { colors } = useTheme();

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
      <Tab.Screen name="DashboardTab" component={DashboardStack} options={{ title: "Dashboard" }} />
      <Tab.Screen name="OrreryTab" component={OrreryStack} options={{ title: "Orrery" }} />
      <Tab.Screen name="BackupTab" component={BackupStack} options={{ title: "Backup" }} />
      <Tab.Screen name="SettingsTab" component={SettingsStack} options={{ title: "Settings" }} />
    </Tab.Navigator>
  );
}
