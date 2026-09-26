/**
 * Pure layout decision for ConfirmDialog's two explicit choices (RG-034 /
 * ui-accessibility/AUD-UIA-011). The dialog first lays the choices out in a
 * wrapping row to read each button's natural width, then keeps the original
 * single row when both fit, or stacks them full-width when they do not.
 */

/** Rounding slack: an exactly-full row must not flip to stacked on a sub-pixel. */
const FIT_TOLERANCE = 1;

export interface ConfirmActionWidths {
  /** Natural width of the Cancel choice. */
  cancel: number;
  /** Natural width of the confirm choice. */
  confirm: number;
  /** Width available to the actions row. */
  row: number;
  /** Gap between the two choices. */
  gap: number;
}

/**
 * `true` when both choices fit side by side, `false` when they must stack,
 * `null` until every width has been measured.
 */
export function confirmActionsFit({
  cancel,
  confirm,
  row,
  gap,
}: ConfirmActionWidths): boolean | null {
  if (cancel <= 0 || confirm <= 0 || row <= 0) return null;
  return cancel + gap + confirm <= row + FIT_TOLERANCE;
}
