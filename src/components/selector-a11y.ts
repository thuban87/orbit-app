/**
 * Shared selector accessibility helpers (38.4 RG-030,
 * ui-accessibility/AUD-UIA-005). PURE — no react-native import, node-testable.
 *
 * `selectorItems` owns the custom-field dropdown's out-of-list preservation:
 * a stored value that is not among the current options (e.g. an options edit
 * dropped it) is prepended so it stays visible, selectable and marked selected
 * — no data is ever dropped or rewritten by presentation (RG-030 constraint).
 * A value already in the options is not duplicated.
 */

/** Options to render, preserving an out-of-list stored value at the top. */
export function selectorItems(
  value: string | null | undefined,
  options: readonly string[],
): string[] {
  if (value && !options.includes(value)) {
    return [value, ...options];
  }
  return [...options];
}

/** The accessibility value a selector trigger announces for its current value. */
export function selectorAccessibilityValue(value: string | null | undefined): {
  text: string;
} {
  return { text: value ? value : "No value" };
}
