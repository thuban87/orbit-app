/** User-facing region value without exposing parser or canonical method data. */
export function phoneRegionValueLabel(
  savedOverride: string | null,
  displayName: string | null,
): string {
  if (savedOverride === null) return "Use device region";
  return `${displayName ?? savedOverride} (${savedOverride})`;
}
