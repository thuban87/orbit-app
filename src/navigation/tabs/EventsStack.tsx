import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ComponentType } from "react";
import { MergeImpactSummary } from "@/components/MergeImpactSummary";
import { ComposeResearchRoute } from "@/screens/ComposeResearchScreen";
import { ComposeScreen } from "@/screens/ComposeScreen";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { CreateContactScreen } from "@/screens/CreateContactScreen";
import { CropPhotoScreen } from "@/screens/CropPhotoScreen";
import { EditContactScreen } from "@/screens/EditContactScreen";
import { EditGroupEventScreen } from "@/screens/EditGroupEventScreen";
import { EditInteractionScreen } from "@/screens/EditInteractionScreen";
import { EditParticipantScreen } from "@/screens/EditParticipantScreen";
import { GroupEventDetailScreen } from "@/screens/GroupEventDetailScreen";
import { GroupEventsScreen } from "@/screens/GroupEventsScreen";
import { GroupLogScreen } from "@/screens/GroupLogScreen";
import { KeyPeopleEditorScreen } from "@/screens/KeyPeopleEditorScreen";
import { LogInteractionScreen } from "@/screens/LogInteractionScreen";
import { MemoryAddScreen } from "@/screens/MemoryAddScreen";
import { MemoryHistoryScreen } from "@/screens/MemoryHistoryScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
import { OffLimitsEditorScreen } from "@/screens/OffLimitsEditorScreen";
import { ProfileBackgroundsScreen } from "@/screens/ProfileBackgroundsScreen";
import { SectionEditorScreen } from "@/screens/SectionEditorScreen";
import { SurvivorSelectScreen } from "@/screens/SurvivorSelectScreen";
import { EVENTS_STACK_ROUTES } from "../shell-contract";
import type { EventsStackParamList } from "../types";

const Stack = createNativeStackNavigator<EventsStackParamList>();
type EventsRouteName = (typeof EVENTS_STACK_ROUTES)[number];

const EVENTS_ROUTE_COMPONENTS = {
  GroupEvents: GroupEventsScreen,
  GroupEventDetail: GroupEventDetailScreen,
  Profile: ContactProfileScreen,
  EditGroupEvent: EditGroupEventScreen,
  EditParticipant: EditParticipantScreen,
  Compose: ComposeScreen,
  ComposeResearch: ComposeResearchRoute,
  LogContact: LogInteractionScreen,
  // The universal + forms open over this tab (D-38, FAB_ROUTES).
  Create: CreateContactScreen,
  GroupLog: GroupLogScreen,
  // The Profile's add-memory form; it left the + in 38.11 (D-66).
  Memory: MemoryAddScreen,
  Edit: EditContactScreen,
  EditInteraction: EditInteractionScreen,
  MemoryHistory: MemoryHistoryScreen,
  SectionEditor: SectionEditorScreen,
  OffLimitsEditor: OffLimitsEditorScreen,
  KeyPeopleEditor: KeyPeopleEditorScreen,
  CropPhoto: CropPhotoScreen,
  SurvivorSelect: SurvivorSelectScreen,
  MergeConflicts: MergeConflictsScreen,
  MergeImpactSummary,
  // 38.11 D-58.1: Profile-reachable Settings page (RG-021).
  ProfileBackgrounds: ProfileBackgroundsScreen,
} as const satisfies Record<EventsRouteName, ComponentType<never>>;

export function EventsStack() {
  return (
    <Stack.Navigator
      initialRouteName="GroupEvents"
      screenOptions={{ headerShown: false }}
    >
      {EVENTS_STACK_ROUTES.map((name) => {
        const component = EVENTS_ROUTE_COMPONENTS[name];
        // React Navigation cannot correlate a union route name with its matching
        // component inside a map; the typed registry above proves that pairing.
        return (
          <Stack.Screen
            key={name}
            name={name as never}
            component={component as never}
          />
        );
      })}
    </Stack.Navigator>
  );
}
