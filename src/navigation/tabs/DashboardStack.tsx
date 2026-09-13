import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MergeImpactSummary } from "@/components/MergeImpactSummary";
import { ArchivedContactsScreen } from "@/screens/ArchivedContactsScreen";
import { CaptureScreen } from "@/screens/CaptureScreen";
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
import { GroupEventsScreen } from "@/screens/GroupEventsScreen";
import { GroupLogScreen } from "@/screens/GroupLogScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { LogInteractionScreen } from "@/screens/LogInteractionScreen";
import { MemoryHistoryScreen } from "@/screens/MemoryHistoryScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
import {
  MemoryPlaceholderScreen,
  UpdateContactPlaceholderScreen,
} from "@/screens/placeholders/FabActionPlaceholders";
import { RecentlyDeletedScreen } from "@/screens/RecentlyDeletedScreen";
import { SurvivorSelectScreen } from "@/screens/SurvivorSelectScreen";
import { ThingsToRememberScreen } from "@/screens/ThingsToRememberScreen";
import { UnboundContactsScreen } from "@/screens/UnboundContactsScreen";
import type { DashboardStackParamList } from "../types";

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export function DashboardStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="GroupEvents" component={GroupEventsScreen} />
      <Stack.Screen
        name="GroupEventDetail"
        component={GroupEventDetailScreen}
      />
      <Stack.Screen name="LogContact" component={LogInteractionScreen} />
      <Stack.Screen name="GroupLog" component={GroupLogScreen} />
      <Stack.Screen
        name="UpdateContact"
        component={UpdateContactPlaceholderScreen}
      />
      <Stack.Screen name="Memory" component={MemoryPlaceholderScreen} />
      <Stack.Screen name="Profile" component={ContactProfileScreen} />
      <Stack.Screen
        name="ThingsToRemember"
        component={ThingsToRememberScreen}
      />
      <Stack.Screen name="RecentlyDeleted" component={RecentlyDeletedScreen} />
      <Stack.Screen name="MemoryHistory" component={MemoryHistoryScreen} />
      <Stack.Screen name="Edit" component={EditContactScreen} />
      <Stack.Screen name="EditInteraction" component={EditInteractionScreen} />
      <Stack.Screen name="EditGroupEvent" component={EditGroupEventScreen} />
      <Stack.Screen name="EditParticipant" component={EditParticipantScreen} />
      <Stack.Screen name="Create" component={CreateContactScreen} />
      <Stack.Screen name="Compose" component={ComposeScreen} />
      <Stack.Screen name="Capture" component={CaptureScreen} />
      <Stack.Screen name="CropPhoto" component={CropPhotoScreen} />
      <Stack.Screen name="Archived" component={ArchivedContactsScreen} />
      <Stack.Screen name="UnboundContacts" component={UnboundContactsScreen} />
      <Stack.Screen name="Digest" component={DigestScreen} />
      <Stack.Screen name="SurvivorSelect" component={SurvivorSelectScreen} />
      <Stack.Screen name="MergeConflicts" component={MergeConflictsScreen} />
      <Stack.Screen name="MergeImpactSummary" component={MergeImpactSummary} />
    </Stack.Navigator>
  );
}
