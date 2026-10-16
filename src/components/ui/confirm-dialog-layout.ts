/**
 * Pure layout decision for ConfirmDialog's explicit choices (RG-034 /
 * ui-accessibility/AUD-UIA-011). The dialog first lays the choices out in a
 * wrapping row to read each button's natural width, then keeps the original
 * single row when they all fit, or stacks them full-width when they do not.
 * A three-way choice (38.11 D-73) adds the `secondary` width.
 */

/** Rounding slack: an exactly-full row must not flip to stacked on a sub-pixel. */
const FIT_TOLERANCE = 1;

export interface ConfirmActionWidths {
  /** Natural width of the Cancel choice. */
  cancel: number;
  /** Natural width of the confirm choice. */
  confirm: number;
  /** Natural width of the third, secondary choice; omitted for two choices. */
  secondary?: number;
  /** Width available to the actions row. */
  row: number;
  /** Gap between the two choices. */
  gap: number;
}

/**
 * `true` when every choice fits side by side, `false` when they must stack,
 * `null` until every width has been measured.
 */
export function confirmActionsFit({
  cancel,
  confirm,
  secondary,
  row,
  gap,
}: ConfirmActionWidths): boolean | null {
  if (cancel <= 0 || confirm <= 0 || row <= 0) return null;
  if (secondary === undefined) {
    return cancel + gap + confirm <= row + FIT_TOLERANCE;
  }
  if (secondary <= 0) return null;
  return cancel + gap + secondary + gap + confirm <= row + FIT_TOLERANCE;
}
