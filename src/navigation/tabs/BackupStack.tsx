import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BackupScreen } from "@/screens/BackupScreen";
import { BackupSettingsScreen } from "@/screens/BackupSettingsScreen";
import { RestorePreviewScreen } from "@/screens/RestorePreviewScreen";
import { RestoreResultScreen } from "@/screens/RestoreResultScreen";
import type { BackupStackParamList } from "../types";

const Stack = createNativeStackNavigator<BackupStackParamList>();

export function BackupStack() {
  return (
    <Stack.Navigator initialRouteName="Backup" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Backup" component={BackupScreen} />
      <Stack.Screen name="BackupSettings" component={BackupSettingsScreen} />
      <Stack.Screen name="RestorePreview" component={RestorePreviewScreen} />
      <Stack.Screen name="RestoreResult" component={RestoreResultScreen} />
    </Stack.Navigator>
  );
}
