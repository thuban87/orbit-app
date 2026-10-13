/**
 * Blank-text helpers shared by the legacy knowledge-row mapping (backup v7
 * conversion) and the knowledge move DAO (38.10).
 *
 * Moved here from the legacy mapping module in 38.10-18 so a live DAO does not
 * import the retired-table mapping module; behaviour is unchanged and the
 * mapping module re-exports both names.
 *
 * Pure: no executor, no clock.
 */

/** True when the value is null/undefined or only whitespace. */
export function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

/**
 * The first candidate that is non-blank after trimming, returned as stored
 * (untrimmed, matching the memories DAO's `normalizeOptional`), or null.
 */
export function firstNonBlank(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    if (!isBlank(candidate)) return candidate as string;
  }
  return null;
}
