import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MergeImpactSummary } from "@/components/MergeImpactSummary";
import { ArchivedContactsScreen } from "@/screens/ArchivedContactsScreen";
import { BulkImportSetupScreen } from "@/screens/BulkImportSetupScreen";
import { BulkReviewScreen } from "@/screens/BulkReviewScreen";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { CropPhotoScreen } from "@/screens/CropPhotoScreen";
import { CustomFieldsScreen } from "@/screens/CustomFieldsScreen";
import { DuplicateReviewScreen } from "@/screens/DuplicateReviewScreen";
import { EditInteractionScreen } from "@/screens/EditInteractionScreen";
import { ImportCompleteScreen } from "@/screens/ImportCompleteScreen";
import { ImportProgressScreen } from "@/screens/ImportProgressScreen";
import { ImportReviewScreen } from "@/screens/ImportReviewScreen";
import { LegacyContactPickerScreen } from "@/screens/LegacyContactPickerScreen";
import { MemoryHistoryScreen } from "@/screens/MemoryHistoryScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
import { LogContactPlaceholderScreen } from "@/screens/placeholders/FabActionPlaceholders";
import { ReconcileCompleteScreen } from "@/screens/ReconcileCompleteScreen";
import { ReconcileDetailScreen } from "@/screens/ReconcileDetailScreen";
import { ReconcileGridScreen } from "@/screens/ReconcileGridScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { SurvivorSelectScreen } from "@/screens/SurvivorSelectScreen";
import { SystemBuilderScreen } from "@/screens/SystemBuilderScreen";
import { SystemsManagementScreen } from "@/screens/SystemsManagementScreen";
import { ThingsToRememberScreen } from "@/screens/ThingsToRememberScreen";
import type { SettingsScreenProps, SettingsStackParamList } from "../types";

// Kept behind a compile-time guard so Metro removes the device-UAT-only harness
// and its failure toggles from release bundles.
const ThemePreviewScreen = __DEV__
  ? require("@/components/ui/__dev__/ThemePreviewScreen").default
  : null;

const Stack = createNativeStackNavigator<SettingsStackParamList>();

function CustomFieldsRoute({
  navigation,
}: SettingsScreenProps<"CustomFields">) {
  return <CustomFieldsScreen onBack={() => navigation.goBack()} />;
}

export function SettingsStack() {
  return (
    <Stack.Navigator
      initialRouteName="Settings"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Settings" component={SettingsScreen} />
      {__DEV__ && ThemePreviewScreen ? (
        <Stack.Screen name="__ThemePreview" component={ThemePreviewScreen} />
      ) : null}
      <Stack.Screen name="SystemBuilder" component={SystemBuilderScreen} />
      <Stack.Screen
        name="SystemsManagement"
        component={SystemsManagementScreen}
      />
      <Stack.Screen name="CustomFields" component={CustomFieldsRoute} />
      <Stack.Screen name="Archived" component={ArchivedContactsScreen} />
      <Stack.Screen name="Profile" component={ContactProfileScreen} />
      {/* Detailed-log route (HIST-15): a Settings-originated (Archived -> Profile)
          empty-date "Log interaction" must resolve here. */}
      <Stack.Screen name="LogContact" component={LogContactPlaceholderScreen} />
      {/* Knowledge-change edit routes (review cycle-2 HIGH): the History
          detail-sheet's knowledge-change edit reuses ContactProfileScreen's nav
          to ThingsToRemember; register both here (parallel to Dashboard/Orrery)
          so a Settings-originated edit resolves instead of throwing. */}
      <Stack.Screen
        name="ThingsToRemember"
        component={ThingsToRememberScreen}
      />
      <Stack.Screen name="MemoryHistory" component={MemoryHistoryScreen} />
      <Stack.Screen
        name="EditInteraction"
        component={EditInteractionScreen}
      />
      <Stack.Screen name="CropPhoto" component={CropPhotoScreen} />
      <Stack.Screen
        name="LegacyContactPicker"
        component={LegacyContactPickerScreen}
      />
      <Stack.Screen name="ImportReview" component={ImportReviewScreen} />
      <Stack.Screen name="BulkImportSetup" component={BulkImportSetupScreen} />
      <Stack.Screen name="ImportProgress" component={ImportProgressScreen} />
      <Stack.Screen name="DuplicateReview" component={DuplicateReviewScreen} />
      <Stack.Screen name="ImportComplete" component={ImportCompleteScreen} />
      <Stack.Screen name="BulkReview" component={BulkReviewScreen} />
      <Stack.Screen name="SurvivorSelect" component={SurvivorSelectScreen} />
      <Stack.Screen name="MergeConflicts" component={MergeConflictsScreen} />
      <Stack.Screen name="MergeImpactSummary" component={MergeImpactSummary} />
      <Stack.Screen name="ReconcileDetail" component={ReconcileDetailScreen} />
      <Stack.Screen name="ReconcileGrid" component={ReconcileGridScreen} />
      <Stack.Screen
        name="ReconcileComplete"
        component={ReconcileCompleteScreen}
      />
    </Stack.Navigator>
  );
}
