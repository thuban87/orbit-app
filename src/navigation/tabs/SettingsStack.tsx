import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MergeImpactSummary } from "@/components/MergeImpactSummary";
import { AIConnectionScreen } from "@/screens/AIConnectionScreen";
import { AIModelPickerScreen } from "@/screens/AIModelPickerScreen";
import { AIPermissionsScreen } from "@/screens/AIPermissionsScreen";
import { AIPersonalizationScreen } from "@/screens/AIPersonalizationScreen";
import { AIPreviewScreen } from "@/screens/AIPreviewScreen";
import { ArchivedContactsScreen } from "@/screens/ArchivedContactsScreen";
import { BackupScreen } from "@/screens/BackupScreen";
import { BackupSettingsScreen } from "@/screens/BackupSettingsScreen";
import { BulkImportSetupScreen } from "@/screens/BulkImportSetupScreen";
import { BulkReviewScreen } from "@/screens/BulkReviewScreen";
import { CategoryManagementScreen } from "@/screens/CategoryManagementScreen";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { CreateContactScreen } from "@/screens/CreateContactScreen";
import { CropPhotoScreen } from "@/screens/CropPhotoScreen";
import { CustomFieldReviewScreen } from "@/screens/CustomFieldReviewScreen";
import { CustomFieldsScreen } from "@/screens/CustomFieldsScreen";
import { DuplicateReviewScreen } from "@/screens/DuplicateReviewScreen";
import { EditContactScreen } from "@/screens/EditContactScreen";
import { EditGroupEventScreen } from "@/screens/EditGroupEventScreen";
import { EditInteractionScreen } from "@/screens/EditInteractionScreen";
import { EditParticipantScreen } from "@/screens/EditParticipantScreen";
import { GroupEventDetailScreen } from "@/screens/GroupEventDetailScreen";
import { GroupLogScreen } from "@/screens/GroupLogScreen";
import { ImportCompleteScreen } from "@/screens/ImportCompleteScreen";
import { ImportProgressScreen } from "@/screens/ImportProgressScreen";
import { ImportReviewScreen } from "@/screens/ImportReviewScreen";
import { KeyPeopleEditorScreen } from "@/screens/KeyPeopleEditorScreen";
import { LegacyContactPickerScreen } from "@/screens/LegacyContactPickerScreen";
import { LogInteractionScreen } from "@/screens/LogInteractionScreen";
import { MemoryAddScreen } from "@/screens/MemoryAddScreen";
import { MemoryHistoryScreen } from "@/screens/MemoryHistoryScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
import { OffLimitsEditorScreen } from "@/screens/OffLimitsEditorScreen";
import { ProfileBackgroundsScreen } from "@/screens/ProfileBackgroundsScreen";
import { ReconcileCompleteScreen } from "@/screens/ReconcileCompleteScreen";
import { ReconcileDetailScreen } from "@/screens/ReconcileDetailScreen";
import { ReconcileGridScreen } from "@/screens/ReconcileGridScreen";
import { RestorePreviewScreen } from "@/screens/RestorePreviewScreen";
import { RestoreResultScreen } from "@/screens/RestoreResultScreen";
import { SectionEditorScreen } from "@/screens/SectionEditorScreen";
import { SettingsAboutScreen } from "@/screens/SettingsAboutScreen";
import { SettingsAIScreen } from "@/screens/SettingsAIScreen";
import { SettingsAppearanceScreen } from "@/screens/SettingsAppearanceScreen";
import { SettingsContactsScreen } from "@/screens/SettingsContactsScreen";
import { SettingsHubScreen } from "@/screens/SettingsHubScreen";
import { SettingsInteractionsScreen } from "@/screens/SettingsInteractionsScreen";
import { SettingsNotificationsScreen } from "@/screens/SettingsNotificationsScreen";
import { SettingsOrreryScreen } from "@/screens/SettingsOrreryScreen";
import { SurvivorSelectScreen } from "@/screens/SurvivorSelectScreen";
import { SystemBuilderScreen } from "@/screens/SystemBuilderScreen";
import { SystemsManagementScreen } from "@/screens/SystemsManagementScreen";
import { UnboundContactsScreen } from "@/screens/UnboundContactsScreen";
import { ValueHistoryScreen } from "@/screens/ValueHistoryScreen";
import type {
  RootStackScreenProps,
  SettingsScreenProps,
  SettingsStackParamList,
} from "../types";

// Kept behind a compile-time guard so Metro removes the device-UAT-only harness
// and its failure toggles from release bundles.
const ThemePreviewScreen = __DEV__
  ? require("@/components/ui/__dev__/ThemePreviewScreen").default
  : null;

const Stack = createNativeStackNavigator<SettingsStackParamList>();

// Custom Fields owns its single Back: the shared header (38.9 D-16).
function CustomFieldsRoute() {
  return <CustomFieldsScreen />;
}

function AIConnectionRoute({
  navigation,
}: SettingsScreenProps<"AIConnection">) {
  return (
    <AIConnectionScreen
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

function AIPersonalizationRoute() {
  return <AIPersonalizationScreen />;
}

function AIPermissionsRoute() {
  return <AIPermissionsScreen />;
}

function AIPreviewRoute() {
  return <AIPreviewScreen />;
}

// Header-chrome Settings children own a single Back: the ShellAppBar header
// Back (RG-037 ui-accessibility/AUD-UIA-016, D-15; 38.9 D-16 for the Custom
// Fields and AI wrappers above). Their wrappers pass no Back `onBack`; the
// header routes through `resolveBackIntent` (SHELL-03). AIModelPicker's
// `onBack` is its after-save return only.
function SettingsInteractionsRoute() {
  return <SettingsInteractionsScreen />;
}

function SettingsAboutRoute() {
  return <SettingsAboutScreen />;
}

function SettingsAppearanceRoute() {
  return <SettingsAppearanceScreen />;
}

function SettingsContactsRoute() {
  return <SettingsContactsScreen />;
}

function SettingsNotificationsRoute() {
  return <SettingsNotificationsScreen />;
}

function SettingsOrreryRoute() {
  return <SettingsOrreryScreen />;
}

function SettingsAIRoute() {
  return <SettingsAIScreen />;
}

// Profile is hosted here (Settings → Archived → Profile, and a participant
// Profile reached through a group event). The wrapper threads an explicit host,
// so the hero disables Message: Compose and
// ComposeResearch are deliberately never registered under Settings (D-09, D-25,
// RG-021 — archived messaging stays prohibited; no cross-tab jump to message).
function SettingsProfileHostRoute(props: RootStackScreenProps<"Profile">) {
  return <ContactProfileScreen {...props} host="settings" />;
}

// The + Add Contact form opens over Settings (D-38). D-50 (owner, 2026-10-10)
// adds the one completion jump out of this stack: on Save the form pops back to
// where the user started and the new person opens on a live Profile in the
// Contacts tab (a Settings-hosted Profile would disable Message, D-25). Compose
// and ComposeResearch stay unregistered here.
function SettingsCreateHostRoute(props: RootStackScreenProps<"Create">) {
  return <CreateContactScreen {...props} host="settings" />;
}

export function SettingsStack() {
  return (
    <Stack.Navigator
      initialRouteName="Settings"
      screenOptions={{ headerShown: false }}
    >
      {/* Phase 37 (D-09): the hub replaces the monolith at the preserved
          `Settings` route name (§M — deep-link + back-stack safe). Plan 08 retired
          the transitional `SettingsMore` monolith once every group had migrated
          into a category screen (§A order below). */}
      <Stack.Screen name="Settings" component={SettingsHubScreen} />
      <Stack.Screen
        name="SettingsInteractions"
        component={SettingsInteractionsRoute}
      />
      <Stack.Screen
        name="SettingsAppearance"
        component={SettingsAppearanceRoute}
      />
      {/* Appearance's "Default profile background" row opens it (38.11 D-84);
          also Profile-reachable (D-58.1, RG-021). */}
      <Stack.Screen
        name="ProfileBackgrounds"
        component={ProfileBackgroundsScreen}
      />
      {/* A custom field's "View history" (38.12 D-106, RG-021). */}
      <Stack.Screen name="ValueHistory" component={ValueHistoryScreen} />
      <Stack.Screen name="SettingsContacts" component={SettingsContactsRoute} />
      <Stack.Screen
        name="SettingsNotifications"
        component={SettingsNotificationsRoute}
      />
      <Stack.Screen name="SettingsOrrery" component={SettingsOrreryRoute} />
      <Stack.Screen name="SettingsAI" component={SettingsAIRoute} />
      <Stack.Screen name="SettingsAbout" component={SettingsAboutRoute} />
      {/* Backup is Settings-only after Phase 38. The Backup and restore pages
          read their host from an optional `host` route param (38.12 D-68;
          absent = settings), so no wrapper injects one. */}
      <Stack.Screen name="Backup" component={BackupScreen} />
      <Stack.Screen name="BackupSettings" component={BackupSettingsScreen} />
      <Stack.Screen name="RestorePreview" component={RestorePreviewScreen} />
      <Stack.Screen name="RestoreResult" component={RestoreResultScreen} />
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
      {/* 38.12 D-121: the "Review now" list after a type change. */}
      <Stack.Screen
        name="CustomFieldReview"
        component={CustomFieldReviewScreen}
      />
      <Stack.Screen
        name="CategoryManagement"
        component={CategoryManagementScreen}
      />
      <Stack.Screen name="Archived" component={ArchivedContactsScreen} />
      {/* 38.12 D-97: Contact Management's "Unbound contacts" row. */}
      <Stack.Screen name="UnboundContacts" component={UnboundContactsScreen} />
      <Stack.Screen name="Profile" component={SettingsProfileHostRoute} />
      {/* Detailed-log route (HIST-15): a Settings-originated (Archived -> Profile)
          empty-date "Log interaction" must resolve here. */}
      <Stack.Screen name="LogContact" component={LogInteractionScreen} />
      {/* The universal + forms open over this tab (D-38, FAB_ROUTES). */}
      <Stack.Screen name="Create" component={SettingsCreateHostRoute} />
      <Stack.Screen name="GroupLog" component={GroupLogScreen} />
      {/* The Profile's add-memory form; it left the + in 38.11 (D-66). */}
      <Stack.Screen name="Memory" component={MemoryAddScreen} />
      {/* Knowledge-change edit routes (review cycle-2 HIGH): the History
          detail-sheet's knowledge-change edit reuses ContactProfileScreen's nav
          to the section editors; register them here (parallel to
          Dashboard/Orrery) so a Settings-originated edit resolves instead of
          throwing. */}
      <Stack.Screen name="MemoryHistory" component={MemoryHistoryScreen} />
      <Stack.Screen name="SectionEditor" component={SectionEditorScreen} />
      <Stack.Screen name="OffLimitsEditor" component={OffLimitsEditorScreen} />
      <Stack.Screen name="KeyPeopleEditor" component={KeyPeopleEditorScreen} />
      <Stack.Screen name="Edit" component={EditContactScreen} />
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
