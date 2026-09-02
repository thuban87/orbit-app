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
import { GroupEventsScreen } from "@/screens/GroupEventsScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { ManageFavouritesScreen } from "@/screens/ManageFavouritesScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
import { NeverContactedScreen } from "@/screens/NeverContactedScreen";
import {
  GroupLogPlaceholderScreen,
  LogContactPlaceholderScreen,
  MemoryPlaceholderScreen,
  UpdateContactPlaceholderScreen,
} from "@/screens/placeholders/FabActionPlaceholders";
import { SurvivorSelectScreen } from "@/screens/SurvivorSelectScreen";
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
      <Stack.Screen name="LogContact" component={LogContactPlaceholderScreen} />
      <Stack.Screen name="GroupLog" component={GroupLogPlaceholderScreen} />
      <Stack.Screen
        name="UpdateContact"
        component={UpdateContactPlaceholderScreen}
      />
      <Stack.Screen name="Memory" component={MemoryPlaceholderScreen} />
      <Stack.Screen name="Profile" component={ContactProfileScreen} />
      <Stack.Screen name="Edit" component={EditContactScreen} />
      <Stack.Screen name="Create" component={CreateContactScreen} />
      <Stack.Screen name="Compose" component={ComposeScreen} />
      <Stack.Screen name="Capture" component={CaptureScreen} />
      <Stack.Screen name="CropPhoto" component={CropPhotoScreen} />
      <Stack.Screen name="Archived" component={ArchivedContactsScreen} />
      <Stack.Screen name="NeverContacted" component={NeverContactedScreen} />
      <Stack.Screen name="UnboundContacts" component={UnboundContactsScreen} />
      <Stack.Screen
        name="ManageFavourites"
        component={ManageFavouritesScreen}
      />
      <Stack.Screen name="Digest" component={DigestScreen} />
      <Stack.Screen name="SurvivorSelect" component={SurvivorSelectScreen} />
      <Stack.Screen name="MergeConflicts" component={MergeConflictsScreen} />
      <Stack.Screen name="MergeImpactSummary" component={MergeImpactSummary} />
    </Stack.Navigator>
  );
}
