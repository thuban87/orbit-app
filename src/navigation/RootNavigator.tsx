import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ArchivedContactsScreen } from "@/screens/ArchivedContactsScreen";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { CreateContactScreen } from "@/screens/CreateContactScreen";
import { CustomFieldsScreen } from "@/screens/CustomFieldsScreen";
import { EditContactScreen } from "@/screens/EditContactScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import type { RootStackParamList, RootStackScreenProps } from "./types";

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
 * Every Phase-4 route now points at its real screen: `Settings`/`CustomFields`
 * (Plan 04-01), `Create`/`Profile` (Plans 04-04/04-05), `Edit` (Plan 04-06),
 * and `Archived` — the real ArchivedContactsScreen replacing the Plan 04-01
 * placeholder (Plan 08).
 */
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Thin route wrapper: `CustomFieldsScreen` stays prop-driven (its `onBack`
 * contract is unchanged and testable) — the navigator supplies the back action
 * via `navigation.goBack()`. We deliberately do NOT refactor `onBack` to call
 * `useNavigation` inside the screen; the wrapper keeps that concern here.
 */
function CustomFieldsRoute({
  navigation,
}: RootStackScreenProps<"CustomFields">) {
  return <CustomFieldsScreen onBack={() => navigation.goBack()} />;
}

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="CustomFields" component={CustomFieldsRoute} />
      <Stack.Screen name="Create" component={CreateContactScreen} />
      <Stack.Screen name="Profile" component={ContactProfileScreen} />
      <Stack.Screen name="Edit" component={EditContactScreen} />
      <Stack.Screen name="Archived" component={ArchivedContactsScreen} />
    </Stack.Navigator>
  );
}
