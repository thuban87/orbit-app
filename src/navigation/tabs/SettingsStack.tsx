import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MergeImpactSummary } from "@/components/MergeImpactSummary";
import { ArchivedContactsScreen } from "@/screens/ArchivedContactsScreen";
import { BulkImportSetupScreen } from "@/screens/BulkImportSetupScreen";
import { BulkReviewScreen } from "@/screens/BulkReviewScreen";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { CropPhotoScreen } from "@/screens/CropPhotoScreen";
import { CustomFieldsScreen } from "@/screens/CustomFieldsScreen";
import { DuplicateReviewScreen } from "@/screens/DuplicateReviewScreen";
import { ImportCompleteScreen } from "@/screens/ImportCompleteScreen";
import { ImportProgressScreen } from "@/screens/ImportProgressScreen";
import { ImportReviewScreen } from "@/screens/ImportReviewScreen";
import { LegacyContactPickerScreen } from "@/screens/LegacyContactPickerScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
import { ReconcileCompleteScreen } from "@/screens/ReconcileCompleteScreen";
import { ReconcileDetailScreen } from "@/screens/ReconcileDetailScreen";
import { ReconcileGridScreen } from "@/screens/ReconcileGridScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { SurvivorSelectScreen } from "@/screens/SurvivorSelectScreen";
import { SystemBuilderScreen } from "@/screens/SystemBuilderScreen";
import { SystemsManagementScreen } from "@/screens/SystemsManagementScreen";
import type { SettingsScreenProps, SettingsStackParamList } from "../types";

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
      <Stack.Screen name="SystemBuilder" component={SystemBuilderScreen} />
      <Stack.Screen
        name="SystemsManagement"
        component={SystemsManagementScreen}
      />
      <Stack.Screen name="CustomFields" component={CustomFieldsRoute} />
      <Stack.Screen name="Archived" component={ArchivedContactsScreen} />
      <Stack.Screen name="Profile" component={ContactProfileScreen} />
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
