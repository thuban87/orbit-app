import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { HomeScreen } from "@/screens/HomeScreen";
import { useTheme } from "@/theme";
import type { RootStackParamList } from "./types";

/**
 * The app's real navigation shell (Phase 4) — a native-stack navigator that
 * every Phase-4 screen (Home, Settings, Custom Fields, Create, Profile, Edit,
 * Archived) hangs off. It replaces the Phase-1→3 dependency-free `HomeScreen`
 * `useState<Route>` toggle, which was an explicitly temporary state.
 *
 * `headerShown: false` (screenOptions): every screen renders its OWN back
 * chrome (the `CustomFieldsScreen` header/back/title pattern the whole phase
 * reuses), so a native-stack header on top would double up. With no header
 * there is also no colour literal needed on `screenOptions` — each screen's
 * themed root supplies its background via `useTheme().colors.*` (check:colors).
 * Predictive-back is disabled in app.config.ts:26, so back navigation is the
 * Android system Back button walking the stack, not a swipe gesture.
 *
 * `enableScreens` is NOT called manually — native-stack enables it.
 *
 * Routes whose screens land in later plans (`Create`, `Profile`, `Edit`,
 * `Archived`) register themed placeholder components defined here so the
 * navigator type-checks and every route is reachable now; each later plan
 * swaps its placeholder for the real screen. `Settings` and `CustomFields`
 * are wired to their real screens in Plan 04-01 Task 3.
 */
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * A themed "Coming soon" placeholder for a route whose real screen ships in a
 * later plan. Resolves its colours through the theme so it satisfies
 * `check:colors` and restyles with the active preset.
 */
function makePlaceholder(label: string) {
  return function Placeholder() {
    const { colors } = useTheme();
    return (
      <View
        testID={`placeholder-${label}`}
        style={[styles.placeholder, { backgroundColor: colors.background }]}
      >
        <Text style={[styles.placeholderTitle, { color: colors.textPrimary }]}>
          {label}
        </Text>
        <Text style={[styles.placeholderBody, { color: colors.textSecondary }]}>
          Coming soon
        </Text>
      </View>
    );
  };
}

const SettingsPlaceholder = makePlaceholder("Settings");
const CustomFieldsPlaceholder = makePlaceholder("Custom Fields");
const CreatePlaceholder = makePlaceholder("New contact");
const ProfilePlaceholder = makePlaceholder("Profile");
const EditPlaceholder = makePlaceholder("Edit contact");
const ArchivedPlaceholder = makePlaceholder("Archived contacts");

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Settings" component={SettingsPlaceholder} />
      <Stack.Screen name="CustomFields" component={CustomFieldsPlaceholder} />
      <Stack.Screen name="Create" component={CreatePlaceholder} />
      <Stack.Screen name="Profile" component={ProfilePlaceholder} />
      <Stack.Screen name="Edit" component={EditPlaceholder} />
      <Stack.Screen name="Archived" component={ArchivedPlaceholder} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  placeholderBody: {
    fontSize: 15,
    textAlign: "center",
  },
});
