import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MergeImpactSummary } from "@/components/MergeImpactSummary";
import { ComposeScreen } from "@/screens/ComposeScreen";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { CropPhotoScreen } from "@/screens/CropPhotoScreen";
import { EditContactScreen } from "@/screens/EditContactScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
import { OrreryScreen } from "@/screens/OrreryScreen";
import { SurvivorSelectScreen } from "@/screens/SurvivorSelectScreen";
import type { OrreryStackParamList } from "../types";

const Stack = createNativeStackNavigator<OrreryStackParamList>();

export function OrreryStack() {
  return (
    <Stack.Navigator initialRouteName="Orrery" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Orrery" component={OrreryScreen} />
      <Stack.Screen name="Profile" component={ContactProfileScreen} />
      <Stack.Screen name="Edit" component={EditContactScreen} />
      <Stack.Screen name="Compose" component={ComposeScreen} />
      <Stack.Screen name="CropPhoto" component={CropPhotoScreen} />
      <Stack.Screen name="SurvivorSelect" component={SurvivorSelectScreen} />
      <Stack.Screen name="MergeConflicts" component={MergeConflictsScreen} />
      <Stack.Screen name="MergeImpactSummary" component={MergeImpactSummary} />
    </Stack.Navigator>
  );
}
