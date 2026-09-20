import type { FuelDraft, FuelEditPatch } from "@/components/FuelEditor";
import type { FuelItem } from "@/db/fuel-read";

export type OffLimitsDraftRow = FuelDraft & { id: number };

/**
 * The Off Limits screen is a narrow view over the general Fuel editor. Keep its
 * filter, forced kind, and defensive re-filter together so no other fuel kind
 * can enter this collection's write path.
 */
export function seedOffLimitsDraft(
  rows: readonly FuelItem[],
): OffLimitsDraftRow[] {
  return rows
    .filter((row) => row.kind === "off_limits")
    .map((row) => ({
      id: row.id,
      kind: "off_limits",
      label: row.label,
      text: row.text,
      url: row.url,
    }));
}

export function forceOffLimitsKind<T extends FuelDraft | FuelEditPatch>(
  draft: T,
): T & { kind: "off_limits" } {
  return { ...draft, kind: "off_limits" };
}

export function filterOffLimitsWrite(
  rows: readonly OffLimitsDraftRow[],
): OffLimitsDraftRow[] {
  return rows.filter((row) => row.kind === "off_limits");
}
