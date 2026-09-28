/** Render-free Sheet variant contract, kept testable outside the RN runtime. */
export const SHEET_VARIANTS = ["compact", "detail", "expanded"] as const;

export type SheetVariant = (typeof SHEET_VARIANTS)[number];

export const SHEET_HEIGHT_PERCENT: Readonly<Record<SheetVariant, string>> =
  Object.freeze({
    compact: "40%",
    detail: "60%",
    // Focused workflows need room for a scrollable editor plus reachable actions.
    expanded: "92%",
  });

/**
 * Compact and detail sheets size to their content; expanded workflows reserve
 * the remaining shell height for a scrollable workspace and fixed actions.
 */
export const SHEET_BODY_FLEX: Readonly<Record<SheetVariant, number>> =
  Object.freeze({ compact: 0, detail: 0, expanded: 1 });

/**
 * Whether a variant's body scrolls inside the sheet (38.4 D-32, the Plan 11
 * device finding next to RG-034 `ui-accessibility/AUD-UIA-011`). Compact and
 * detail sheets cap their height with a percent `maxHeight`; at large system
 * text (font_scale 2.0 on a ≈320dp phone) InteractionDetail's Edit/Delete row
 * was clipped below that cap and unreachable. Their body is therefore a bounded
 * ScrollView that stays content-sized until it hits the cap. Expanded sheets
 * keep a fixed height and a `flex: 1` workspace whose scroll the consumer owns.
 */
export const SHEET_BODY_SCROLLS: Readonly<Record<SheetVariant, boolean>> =
  Object.freeze({ compact: true, detail: true, expanded: false });

export interface SheetKeyboardInput {
  variant: SheetVariant;
  /** Current height of the sheet's overlay frame (the modal window). */
  frameHeight: number;
  /** Tallest frame height seen, i.e. the height while the keyboard is down. */
  restingFrameHeight: number;
  /** Height the keyboard occupies above the navigation bar (0 when down). */
  keyboardHeight: number;
  /** Space kept clear at the top (status bar inset plus a margin). */
  topClearance: number;
}

export interface SheetKeyboardLayout {
  /** Bottom padding that lifts the sheet above the keyboard. */
  lift: number;
  /** Height cap (compact/detail) or fixed height (expanded); null = unchanged. */
  size: number | null;
}

/**
 * Keeps a sheet above the soft keyboard (38.4 D-72, Plan 17 G1-f). The RN
 * Modal window is edge-to-edge, so Android does not resize it for the IME and
 * a bottom sheet with a focused field sat entirely behind the keyboard at
 * large text. While the keyboard is up the sheet is lifted by the part of the
 * keyboard the system did not already absorb by resizing the window, and its
 * height is bounded by the room left above the keyboard (the body scrolls,
 * D-32). The percent heights still apply against the resting window height.
 */
export function sheetKeyboardLayout({
  variant,
  frameHeight,
  restingFrameHeight,
  keyboardHeight,
  topClearance,
}: SheetKeyboardInput): SheetKeyboardLayout {
  if (keyboardHeight <= 0 || frameHeight <= 0) return { lift: 0, size: null };
  const resting = Math.max(restingFrameHeight, frameHeight);
  const resized = resting - frameHeight;
  const lift = Math.max(0, Math.round(keyboardHeight - resized));
  const room = Math.max(0, frameHeight - lift - topClearance);
  const percent = Number.parseFloat(SHEET_HEIGHT_PERCENT[variant]) / 100;
  return { lift, size: Math.min(Math.round(percent * resting), room) };
}
