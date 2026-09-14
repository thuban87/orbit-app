import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MergeImpactSummary } from "@/components/MergeImpactSummary";
import { AIConnectionScreen } from "@/screens/AIConnectionScreen";
import { AIModelPickerScreen } from "@/screens/AIModelPickerScreen";
import { AIPermissionsScreen } from "@/screens/AIPermissionsScreen";
import { AIPersonalizationScreen } from "@/screens/AIPersonalizationScreen";
import { AIPreviewScreen } from "@/screens/AIPreviewScreen";
import { ArchivedContactsScreen } from "@/screens/ArchivedContactsScreen";
import { BulkImportSetupScreen } from "@/screens/BulkImportSetupScreen";
import { BulkReviewScreen } from "@/screens/BulkReviewScreen";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { CropPhotoScreen } from "@/screens/CropPhotoScreen";
import { CustomFieldsScreen } from "@/screens/CustomFieldsScreen";
import { DuplicateReviewScreen } from "@/screens/DuplicateReviewScreen";
import { EditGroupEventScreen } from "@/screens/EditGroupEventScreen";
import { EditInteractionScreen } from "@/screens/EditInteractionScreen";
import { EditParticipantScreen } from "@/screens/EditParticipantScreen";
import { GroupEventDetailScreen } from "@/screens/GroupEventDetailScreen";
import { ImportCompleteScreen } from "@/screens/ImportCompleteScreen";
import { ImportProgressScreen } from "@/screens/ImportProgressScreen";
import { ImportReviewScreen } from "@/screens/ImportReviewScreen";
import { LegacyContactPickerScreen } from "@/screens/LegacyContactPickerScreen";
import { LogInteractionScreen } from "@/screens/LogInteractionScreen";
import { MemoryHistoryScreen } from "@/screens/MemoryHistoryScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
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

function AIConnectionRoute({
  navigation,
}: SettingsScreenProps<"AIConnection">) {
  return (
    <AIConnectionScreen
      onBack={() => navigation.goBack()}
      onChooseModel={(lane) => navigation.navigate("AIModelPicker", { lane })}
    />
  );
}

function AIModelPickerRoute({
  navigation,
  route,
}: SettingsScreenProps<"AIModelPicker">) {
  return (
    <AIModelPickerScreen
      lane={route.params.lane}
      onBack={() => navigation.goBack()}
    />
  );
}

function AIPersonalizationRoute({
  navigation,
  route,
}: SettingsScreenProps<"AIPersonalization">) {
  return (
    <AIPersonalizationScreen
      focus={route.params?.focus}
      onBack={() => navigation.goBack()}
    />
  );
}

function AIPermissionsRoute({
  navigation,
}: SettingsScreenProps<"AIPermissions">) {
  return <AIPermissionsScreen onBack={() => navigation.goBack()} />;
}

function AIPreviewRoute({ navigation }: SettingsScreenProps<"AIPreview">) {
  return <AIPreviewScreen onBack={() => navigation.goBack()} />;
}

export function SettingsStack() {
  return (
    <Stack.Navigator
      initialRouteName="Settings"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="AIConnection" component={AIConnectionRoute} />
      <Stack.Screen name="AIModelPicker" component={AIModelPickerRoute} />
      <Stack.Screen
        name="AIPersonalization"
        component={AIPersonalizationRoute}
      />
      <Stack.Screen name="AIPermissions" component={AIPermissionsRoute} />
      <Stack.Screen name="AIPreview" component={AIPreviewRoute} />
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
      <Stack.Screen name="LogContact" component={LogInteractionScreen} />
      {/* Knowledge-change edit routes (review cycle-2 HIGH): the History
          detail-sheet's knowledge-change edit reuses ContactProfileScreen's nav
          to ThingsToRemember; register both here (parallel to Dashboard/Orrery)
          so a Settings-originated edit resolves instead of throwing. */}
      <Stack.Screen
        name="ThingsToRemember"
        component={ThingsToRememberScreen}
      />
      <Stack.Screen name="MemoryHistory" component={MemoryHistoryScreen} />
      <Stack.Screen name="EditInteraction" component={EditInteractionScreen} />
      <Stack.Screen
        name="GroupEventDetail"
        component={GroupEventDetailScreen}
      />
      <Stack.Screen name="EditGroupEvent" component={EditGroupEventScreen} />
      <Stack.Screen name="EditParticipant" component={EditParticipantScreen} />
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
