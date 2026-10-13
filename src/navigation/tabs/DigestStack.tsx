import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ComponentType } from "react";
import { MergeImpactSummary } from "@/components/MergeImpactSummary";
import { ComposeResearchRoute } from "@/screens/ComposeResearchScreen";
import { ComposeScreen } from "@/screens/ComposeScreen";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { CreateContactScreen } from "@/screens/CreateContactScreen";
import { CropPhotoScreen } from "@/screens/CropPhotoScreen";
import { DigestScreen } from "@/screens/DigestScreen";
import { EditContactScreen } from "@/screens/EditContactScreen";
import { EditGroupEventScreen } from "@/screens/EditGroupEventScreen";
import { EditInteractionScreen } from "@/screens/EditInteractionScreen";
import { EditParticipantScreen } from "@/screens/EditParticipantScreen";
import { GroupEventDetailScreen } from "@/screens/GroupEventDetailScreen";
import { GroupLogScreen } from "@/screens/GroupLogScreen";
import { LogInteractionScreen } from "@/screens/LogInteractionScreen";
import { MemoryHistoryScreen } from "@/screens/MemoryHistoryScreen";
import { MemoryScreen } from "@/screens/MemoryScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
import { OffLimitsEditorScreen } from "@/screens/OffLimitsEditorScreen";
import { RecentlyDeletedScreen } from "@/screens/RecentlyDeletedScreen";
import { SectionEditorScreen } from "@/screens/SectionEditorScreen";
import { SurvivorSelectScreen } from "@/screens/SurvivorSelectScreen";
import { ThingsToRememberScreen } from "@/screens/ThingsToRememberScreen";
import { UpdateContactScreen } from "@/screens/UpdateContactScreen";
import { DIGEST_STACK_ROUTES } from "../shell-contract";
import type { DigestStackParamList } from "../types";

const Stack = createNativeStackNavigator<DigestStackParamList>();
type DigestRouteName = (typeof DIGEST_STACK_ROUTES)[number];

const DIGEST_ROUTE_COMPONENTS = {
  Digest: DigestScreen,
  Profile: ContactProfileScreen,
  RecentlyDeleted: RecentlyDeletedScreen,
  GroupEventDetail: GroupEventDetailScreen,
  EditGroupEvent: EditGroupEventScreen,
  EditParticipant: EditParticipantScreen,
  Compose: ComposeScreen,
  ComposeResearch: ComposeResearchRoute,
  LogContact: LogInteractionScreen,
  // The universal + forms open over this tab (D-38, FAB_ROUTES).
  Create: CreateContactScreen,
  GroupLog: GroupLogScreen,
  UpdateContact: UpdateContactScreen,
  Memory: MemoryScreen,
  Edit: EditContactScreen,
  EditInteraction: EditInteractionScreen,
  ThingsToRemember: ThingsToRememberScreen,
  MemoryHistory: MemoryHistoryScreen,
  SectionEditor: SectionEditorScreen,
  OffLimitsEditor: OffLimitsEditorScreen,
  CropPhoto: CropPhotoScreen,
  SurvivorSelect: SurvivorSelectScreen,
  MergeConflicts: MergeConflictsScreen,
  MergeImpactSummary,
} as const satisfies Record<DigestRouteName, ComponentType<never>>;

export function DigestStack() {
  return (
    <Stack.Navigator
      initialRouteName="Digest"
      screenOptions={{ headerShown: false }}
    >
      {DIGEST_STACK_ROUTES.map((name) => {
        const component = DIGEST_ROUTE_COMPONENTS[name];
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
