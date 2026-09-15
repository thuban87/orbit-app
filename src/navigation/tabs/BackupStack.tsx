import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BackupScreen } from "@/screens/BackupScreen";
import { BackupSettingsScreen } from "@/screens/BackupSettingsScreen";
import { RestorePreviewScreen } from "@/screens/RestorePreviewScreen";
import { RestoreResultScreen } from "@/screens/RestoreResultScreen";
import type { BackupStackParamList, RootStackScreenProps } from "../types";

const Stack = createNativeStackNavigator<BackupStackParamList>();

// Per-stack host wrappers (D-08 / Plan 37-07): the Backup tree is dual-homed
// (Backup tab + Settings). The hosting stack threads an EXPLICIT `host` prop —
// NOT nav-state inference (review cycle-1 HIGH) — so the shared screens stay
// origin-aware. `host="backup-tab"` equals `DEFAULT_BACKUP_HOST`, keeping the
// shipped tab flow (reset-to-Backup, drains the shared-backup singleton,
// title-only app bar) unchanged.
function BackupTabRoute(props: RootStackScreenProps<"Backup">) {
  return <BackupScreen {...props} host="backup-tab" />;
}

function RestorePreviewTabRoute(props: RootStackScreenProps<"RestorePreview">) {
  return <RestorePreviewScreen {...props} host="backup-tab" />;
}

function RestoreResultTabRoute(props: RootStackScreenProps<"RestoreResult">) {
  return <RestoreResultScreen {...props} host="backup-tab" />;
}

export function BackupStack() {
  return (
    <Stack.Navigator initialRouteName="Backup" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Backup" component={BackupTabRoute} />
      <Stack.Screen name="BackupSettings" component={BackupSettingsScreen} />
      <Stack.Screen name="RestorePreview" component={RestorePreviewTabRoute} />
      <Stack.Screen name="RestoreResult" component={RestoreResultTabRoute} />
    </Stack.Navigator>
  );
}
