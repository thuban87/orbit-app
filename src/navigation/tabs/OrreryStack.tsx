import { useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { MergeImpactSummary } from "@/components/MergeImpactSummary";
import { ComposeScreen } from "@/screens/ComposeScreen";
import { ContactProfileScreen } from "@/screens/ContactProfileScreen";
import { CropPhotoScreen } from "@/screens/CropPhotoScreen";
import { EditContactScreen } from "@/screens/EditContactScreen";
import { MemoryHistoryScreen } from "@/screens/MemoryHistoryScreen";
import { MergeConflictsScreen } from "@/screens/MergeConflictsScreen";
import { OrreryScreen } from "@/screens/OrreryScreen";
import { RecentlyDeletedScreen } from "@/screens/RecentlyDeletedScreen";
import { SurvivorSelectScreen } from "@/screens/SurvivorSelectScreen";
import { ThingsToRememberScreen } from "@/screens/ThingsToRememberScreen";
import { useOrrerySessionStore } from "@/stores/orrery-session-store";
import type { OrreryStackParamList } from "../types";

const Stack = createNativeStackNavigator<OrreryStackParamList>();

export function OrreryStack() {
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener("blur", () =>
        useOrrerySessionStore.getState().leaveTab(),
      ),
    [navigation],
  );
  return (
    <Stack.Navigator
      screenListeners={{
        state: (event) => {
          const state = event.data.state;
          useOrrerySessionStore
            .getState()
            .routeChanged(state.routes.slice(0, state.index + 1));
        },
      }}
      initialRouteName="Orrery"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Orrery" component={OrreryScreen} />
      <Stack.Screen name="Profile" component={ContactProfileScreen} />
      <Stack.Screen
        name="ThingsToRemember"
        component={ThingsToRememberScreen}
      />
      <Stack.Screen name="RecentlyDeleted" component={RecentlyDeletedScreen} />
      <Stack.Screen name="MemoryHistory" component={MemoryHistoryScreen} />
      <Stack.Screen name="Edit" component={EditContactScreen} />
      <Stack.Screen name="Compose" component={ComposeScreen} />
      <Stack.Screen name="CropPhoto" component={CropPhotoScreen} />
      <Stack.Screen name="SurvivorSelect" component={SurvivorSelectScreen} />
      <Stack.Screen name="MergeConflicts" component={MergeConflictsScreen} />
      <Stack.Screen name="MergeImpactSummary" component={MergeImpactSummary} />
    </Stack.Navigator>
  );
}
