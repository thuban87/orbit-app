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

/**
 * The n-ary form of {@link confirmActionsFit} for `MeasuredActionRow`
 * (38.14 review B-WR-02 / A-IN-08; D-11, ADR-174 :38): `true` when every
 * action fits side by side in `row`, `false` when they must stack, `null`
 * until every width has been measured. One action always fits.
 */
export function actionRowFit({
  items,
  row,
  gap,
}: {
  items: readonly number[];
  row: number;
  gap: number;
}): boolean | null {
  if (row <= 0 || items.length === 0) return null;
  if (items.some((width) => !(width > 0))) return null;
  // A lone action has nothing to share the row with (its view caps at 100%).
  if (items.length === 1) return true;
  const total =
    items.reduce((sum, width) => sum + width, 0) + gap * (items.length - 1);
  return total <= row + FIT_TOLERANCE;
}
