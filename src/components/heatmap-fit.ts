/**
 * Fit-to-width sizing for heatmap grids (RG-033 `ui-accessibility/AUD-UIA-010`,
 * owner ruling D-13).
 *
 * A heatmap row of `columns` square cells separated by `gap` gets the largest
 * whole-dp cell edge that keeps `columns·cell + (columns − 1)·gap` inside the
 * measured `availableWidth`, capped at `maxCell` so cells do not balloon on
 * wide screens. The floor makes every result a whole dp, so the row can never
 * exceed the measured width.
 *
 * D-13: visibility wins over the design minimum. A caller's `MIN_CELL` is a
 * documented floor for SUPPORTED widths (≥320dp), not a clamp — on an
 * unsupported narrower width the cells shrink below it rather than overflow
 * and hide a day. The only lower bound here is 1dp.
 *
 * Returns `null` for a width that is not yet measured (0, negative or
 * non-finite) so the caller renders nothing instead of jumping.
 *
 * PURE — no react-native import.
 */
export interface FitHeatmapCellInput {
  availableWidth: number;
  columns: number;
  gap: number;
  maxCell: number;
}

export function fitHeatmapCell({
  availableWidth,
  columns,
  gap,
  maxCell,
}: FitHeatmapCellInput): number | null {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return null;
  const fitted = Math.floor((availableWidth - (columns - 1) * gap) / columns);
  return Math.max(1, Math.min(maxCell, fitted));
}
