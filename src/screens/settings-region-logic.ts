import {
  type AppSettingsPatch,
  resolveEffectivePhoneRegion,
} from "@/db/app-settings-dao";

/** Persisted override wins; null deliberately leaves the platform as authority. */
export function resolveSettingsPhoneRegion(
  persistedOverride: string | null,
  deviceRegion: string | null,
): string | null {
  return resolveEffectivePhoneRegion(persistedOverride, deviceRegion);
}

/** Blank means the explicit "use this device" setting rather than an invalid region. */
export function phoneRegionOverridePatch(input: string): AppSettingsPatch {
  const normalized = input.trim().toUpperCase();
  return { phoneRegionOverride: normalized === "" ? null : normalized };
}
