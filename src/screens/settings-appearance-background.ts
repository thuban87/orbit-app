import type { AppSettingsPatch } from "@/db/app-settings-dao";
import { BACKGROUND_ORDER } from "@/theme/backgrounds";
import type { BackgroundSlotId } from "@/theme/theme-option-ids";
import type { ThemePackage } from "@/theme/theme-types";

/**
 * The background choices offered for the ACTIVE theme package (D-07). Returns
 * exactly that package's ordered slot list — `BACKGROUND_ORDER[pkg]`, which
 * already ends with the shared `none` (None/Solid) slot. The Galaxy-only slots
 * are therefore never offered while Standard is active, and vice-versa.
 *
 * This is the D-07 active-package guard as a pure, node-testable selector: the
 * monolith rendered BOTH packages' subgroups in one grid (SettingsScreen.tsx
 * pre-Plan-02); the migrated Appearance screen renders only the reactive active
 * package's choices. No theme-store change, no schema change, no theme rewrite —
 * a rendering guard over the existing per-package background model.
 */
export function backgroundChoicesForPackage(
  pkg: ThemePackage,
): readonly BackgroundSlotId[] {
  return BACKGROUND_ORDER[pkg];
}

/**
 * The package-SENSITIVE `app_settings` patch for a background selection (D-07,
 * review cycle-2 finding #5). Mirrors the monolith's `onSelectBackground`
 * (SettingsScreen.tsx:520-531 pre-Plan-02): a selection under Galaxy writes
 * `galaxyBackground`, under Standard writes `standardBackground` — so the durable
 * value lands on the ACTIVE package's column, never the other's. Factored out as
 * a pure helper so the correct-key behaviour is unit-provable (the choices list
 * alone did not prove the right durable key is written).
 */
export function backgroundPatchForPackage(
  pkg: ThemePackage,
  slot: BackgroundSlotId,
): AppSettingsPatch {
  return pkg === "galaxy"
    ? { galaxyBackground: slot }
    : { standardBackground: slot };
}
