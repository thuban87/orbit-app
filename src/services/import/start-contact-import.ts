import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SqlExecutor } from "@/db/types";
import type { RootStackParamList } from "@/navigation/types";
import type { ContactImportMode } from "@/screens/use-contact-import-mode";
import { routePickedImport } from "@/services/import/import-acquire";
import type { PickedContact } from "../../../modules/orbit-contact-picker";

type AppNavigate = NativeStackNavigationProp<RootStackParamList>["navigate"];

export interface StartContactImportOptions {
  mode: ContactImportMode;
  exec: SqlExecutor;
  effectivePhoneRegion: string | null;
  now: string;
  pick: () => Promise<PickedContact[]>;
  /** Wider than PickedImportNavigator so it can open LegacyContactPicker too. */
  navigate: AppNavigate;
}

/**
 * Dispatch contact acquisition at the sole SDK-routing seam. System results
 * enter the existing shared import sink; the legacy screen calls that same sink
 * after its user chooses contacts.
 */
export async function startContactImport({
  mode,
  exec,
  effectivePhoneRegion,
  now,
  pick,
  navigate,
}: StartContactImportOptions): Promise<void> {
  if (mode === "legacy") {
    navigate("LegacyContactPicker");
    return;
  }

  const picked = await pick();
  await routePickedImport(
    exec,
    picked,
    { effectivePhoneRegion, now },
    { navigate: (route, params) => navigate(route, params) },
  );
}
