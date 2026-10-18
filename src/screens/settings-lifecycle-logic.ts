/** User-facing region value without exposing parser or canonical method data. */
export function phoneRegionValueLabel(
  savedOverride: string | null,
  displayName: string | null,
): string {
  if (savedOverride === null) return "Use device region";
  return `${displayName ?? savedOverride} (${savedOverride})`;
}

/**
 * The device region shown under "Use device region": the country name with
 * its code, as the saved override reads (D-79), or "Unavailable" when the
 * device reports none (38.12 D-IN-13).
 */
export function deviceRegionCaption(
  deviceRegion: string | null,
  displayName: string | null,
): string {
  if (deviceRegion === null) return "Unavailable";
  return `${displayName ?? deviceRegion} (${deviceRegion})`;
}
