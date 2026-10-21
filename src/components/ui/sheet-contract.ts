/** Render-free Sheet variant contract, kept testable outside the RN runtime. */
import { SPACING } from "@/theme/tokens/spacing";

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
 * The Sheet's own chrome, shared with code that predicts a sheet's height
 * (38.13 D-85: the sized bulk Set Category sheet). `Sheet.tsx` lays its drag
 * handle and body out from these values, so a prediction cannot drift from
 * the render.
 */
export const SHEET_HANDLE_PADDING_TOP = SPACING.md;
export const SHEET_HANDLE_HEIGHT = 4;
export const SHEET_HANDLE_PADDING_BOTTOM = SPACING.sm;
/** Total height of the drag-handle block above the body. */
export const SHEET_HANDLE_BLOCK_HEIGHT =
  SHEET_HANDLE_PADDING_TOP + SHEET_HANDLE_HEIGHT + SHEET_HANDLE_PADDING_BOTTOM;
export const SHEET_BODY_PADDING_HORIZONTAL = SPACING.lg;
export const SHEET_BODY_PADDING_BOTTOM = SPACING.lg;

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

export interface KeyboardLiftInput {
  /** Current height of the screen's root frame. */
  frameHeight: number;
  /** Tallest frame height seen, i.e. the height while the keyboard is down. */
  restingFrameHeight: number;
  /**
   * Height the keyboard occupies above the navigation bar (0 when down): the
   * `keyboardDidShow` height, which Android reports as the IME inset minus the
   * system-bar inset (RN `ReactRootView.checkForKeyboardEvents`).
   */
  keyboardHeight: number;
  /**
   * The system-bar inset under the frame's resting bottom (the gesture or
   * navigation bar; the safe-area bottom inset). An edge-to-edge frame reaches
   * the screen bottom, so the keyboard's top sits this much higher than
   * `keyboardHeight` alone says (38.14-09 DEF-1).
   */
  bottomInset: number;
}

/**
 * The bottom padding that keeps a screen's pinned actions above the soft
 * keyboard (38.14 D-75, Compose). The keyboard covers `keyboardHeight` plus the
 * navigation-bar inset below it, measured from the resting frame bottom; the
 * lift is the part of that the system did not already absorb by resizing the
 * window, so it is right whether or not the window resized (manifest
 * `adjustResize`, edge-to-edge). It replaces the screen's keyboard-down
 * bottom inset rather than adding to it. The Sheet gets the same total from
 * `sheetKeyboardLayout`'s lift plus its own bottom safe-area edge. 0 with the
 * keyboard down or before the first layout. PURE.
 */
export function keyboardLift({
  frameHeight,
  restingFrameHeight,
  keyboardHeight,
  bottomInset,
}: KeyboardLiftInput): number {
  if (keyboardHeight <= 0 || frameHeight <= 0) return 0;
  const resting = Math.max(restingFrameHeight, frameHeight);
  const covered = keyboardHeight + Math.max(0, bottomInset);
  return Math.max(0, Math.round(covered - (resting - frameHeight)));
}

export interface RestingFrameInput {
  /** The resting frame height recorded so far (0 before the first layout). */
  previous: number;
  /** The height this layout reports. */
  height: number;
  /**
   * The keyboard is up or a text field is focused, so this layout may be a
   * window resize for the keyboard rather than a new resting size.
   */
  keyboardMayBeUp: boolean;
}

/**
 * The frame height while the keyboard is down, the baseline `keyboardLift`
 * measures a resize against (38.14-09 D-92). With the keyboard down and no
 * field focused, the latest layout IS the resting frame, so a taller transient
 * first layout cannot stick: Capture first lays out at the full window height,
 * then settles 28 dp shorter below the status bar, and keeping the tallest
 * height read that as a 28 dp resize and lifted the screen 28 dp too little.
 * While the keyboard may be up the tallest height is kept, so a resize that
 * lands before the keyboard event is still measured. PURE.
 */
export function nextRestingFrameHeight({
  previous,
  height,
  keyboardMayBeUp,
}: RestingFrameInput): number {
  return keyboardMayBeUp ? Math.max(previous, height) : height;
}
