import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ComponentType } from "react";
import { MergeImpactSummary } from "@/components/MergeImpactSummary";
import { ComposeResearchRoute } from "@/screens/ComposeResearchScreen";
import { ComposeScreen } from "@/screens/ComposeScreen";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { CropPhotoScreen } from "@/screens/CropPhotoScreen";
import { DigestScreen } from "@/screens/DigestScreen";
import { EditContactScreen } from "@/screens/EditContactScreen";
import { EditGroupEventScreen } from "@/screens/EditGroupEventScreen";
import { EditInteractionScreen } from "@/screens/EditInteractionScreen";
import { EditParticipantScreen } from "@/screens/EditParticipantScreen";
import { GroupEventDetailScreen } from "@/screens/GroupEventDetailScreen";
import { LogInteractionScreen } from "@/screens/LogInteractionScreen";
import { MemoryHistoryScreen } from "@/screens/MemoryHistoryScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
import { RecentlyDeletedScreen } from "@/screens/RecentlyDeletedScreen";
import { SurvivorSelectScreen } from "@/screens/SurvivorSelectScreen";
import { ThingsToRememberScreen } from "@/screens/ThingsToRememberScreen";
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
  Edit: EditContactScreen,
  EditInteraction: EditInteractionScreen,
  ThingsToRemember: ThingsToRememberScreen,
  MemoryHistory: MemoryHistoryScreen,
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
