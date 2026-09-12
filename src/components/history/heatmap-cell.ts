/**
 * Pure heatmap cell CLASSIFICATION (HIST-02, review Plan-05 MEDIUM).
 *
 * The single load-bearing correctness decision the Activity Heatmap makes at
 * RENDER is: does a grid position paint the STRUCTURAL out-of-window blank
 * (`heatmapCellEmpty`) or a real count-saturation LEVEL from `heatmapScale`?
 * Conflating the two would let a Month leading/trailing placeholder read as a
 * "logged nothing that day" zero-count cell — the exact bug the review MEDIUM
 * flagged. This module owns that classification as a pure, node-testable
 * function so it is verified OUTSIDE the un-loadable `.tsx` (the repo's
 * pure-logic-in-`.ts` convention, mirroring services/history/*).
 *
 * `classifyHeatmapCell` returns a `blank` for any placeholder / null-date cell
 * (regardless of any count) and a `scale` level for every REAL date — where a
 * real zero-count day is `{ kind: "scale", level: 0 }` (→ `heatmapScale[0]`, the
 * real zero-count plate), DISTINCT from `{ kind: "blank" }` (→ `heatmapCellEmpty`,
 * the structural blank). The level is derived by the Plan-03 `heatmapLevel`
 * bucket helper — the count→level thresholds live there, tested there.
 *
 * Pure: no DB/store/component/theme import. It maps flags+count to a token ROLE;
 * the `.tsx` resolves that role to a `useTheme().colors.*` token (no literal).
 */
import { heatmapLevel } from "@/services/history/buckets";
import type { HeatmapLens, WindowCell } from "@/services/history/window";

/** The resolved fill role for one heatmap cell — a structural blank or a scale level. */
export type HeatmapCellFill =
  | { readonly kind: "blank" }
  | { readonly kind: "scale"; readonly level: number };

/**
 * Classify a day-lens window cell to its fill role.
 *
 * A placeholder (or null-date) cell is ALWAYS a structural `blank` — its count
 * is meaningless (there is no real date). A real date resolves to a `scale`
 * level from `heatmapLevel(count, lens)`; a real zero-count day is level 0 (the
 * real zero-count plate), never conflated with the structural blank.
 */
export function classifyHeatmapCell(
  cell: Pick<WindowCell, "date" | "isPlaceholder">,
  count: number,
  lens: HeatmapLens,
): HeatmapCellFill {
  if (cell.isPlaceholder || cell.date === null) {
    return { kind: "blank" };
  }
  return { kind: "scale", level: heatmapLevel(count, lens) };
}

/**
 * Classify a Cycles-lens block to its fill role. A cycle block is always a real
 * countable span (no structural placeholders in the cycle grid), so it is always
 * a `scale` level under the `cycles` threshold table (levels 0..4).
 */
export function classifyCycleBlock(
  count: number,
): Extract<HeatmapCellFill, { kind: "scale" }> {
  return { kind: "scale", level: heatmapLevel(count, "cycles") };
}
