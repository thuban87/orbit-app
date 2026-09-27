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

/** Per-side insets, the shape RN's `hitSlop` accepts. */
export interface CellInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CellHitSlopInput {
  /** The rendered square cell edge, in dp. */
  edge: number;
  /**
   * The gap to the adjacent cell on each side. For a side on the outside of
   * the grid, pass the grid's own gap on that axis (as if a neighbour sat one
   * gap away), so the zone never reaches an adjacent control either.
   */
  gaps: CellInsets;
  /** The touch-target edge to grow toward (default 44dp). */
  target?: number;
}

/**
 * Non-overlapping heatmap tap zones (owner default D-42 B).
 *
 * Each side grows toward `target` — `ceil((target − edge) / 2)` — but never
 * past the midpoint of that side's gap (`floor(gap / 2)`). Two neighbours'
 * facing insets therefore sum to at most the gap between them, so a tap can
 * never land in two cells' zones. A cell already at or above the target gets
 * no slop. This replaces a symmetric `(44 − edge) / 2` slop that overlapped
 * neighbours in every lens.
 *
 * PURE — no react-native import.
 */
export function cellHitSlop({
  edge,
  gaps,
  target = 44,
}: CellHitSlopInput): CellInsets {
  const want = Math.ceil(Math.max(0, target - edge) / 2);
  const side = (gap: number) =>
    Math.min(want, Math.floor(Math.max(0, gap) / 2));
  return {
    left: side(gaps.left),
    right: side(gaps.right),
    top: side(gaps.top),
    bottom: side(gaps.bottom),
  };
}
