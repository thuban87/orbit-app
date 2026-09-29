/**
 * ArtSheetComboSync (DEV-ONLY; 38.5-06 Task 3; D-27; T-38.5-06-01).
 *
 * The re-sign-off capture (38.5-07) renders the owner's v2 choices over the new
 * art on a DEBUG build. When `src/theme/__dev__/art-treatment-dev-overrides.json`
 * is enabled with a `combo`, this applies that package / mode / background on
 * mount through the theme store's IN-MEMORY setters (`setPackage`, then
 * `setModeForActivePackage`, then `setBackgroundForActivePackage`). It never
 * writes the database: a relaunch without the override restores the saved
 * selection. A change to the JSON triggers a Metro reload, which re-applies it.
 *
 * Renders nothing. Mounted by `RootNavigator` only through a
 * `__DEV__ ? require(...) : null` guard, so a release bundle never contains it
 * (`dev-override-release-guard.test.ts`).
 */
import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme-store";
import { artDevCombo } from "@/theme/art-treatments";

const overrides: unknown = require("@/theme/__dev__/art-treatment-dev-overrides.json");

export function ArtSheetComboSync(): null {
  useEffect(() => {
    const combo = artDevCombo(overrides);
    if (combo === null) return;
    const store = useThemeStore.getState();
    store.setPackage(combo.package);
    // The package switch above makes it the ACTIVE package for these setters.
    useThemeStore.getState().setModeForActivePackage(combo.mode);
    useThemeStore.getState().setBackgroundForActivePackage(combo.background);
  }, []);
  return null;
}
