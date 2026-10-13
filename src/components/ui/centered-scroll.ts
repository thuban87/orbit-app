/**
 * Keyboard centring geometry for the shared entry field (38.10 D-66).
 *
 * When an entry field is focused it rises and sits centred in the space left
 * above the keyboard. The window is edge-to-edge (`android/gradle.properties`),
 * so Android may not resize the screen for the IME; the host therefore renders
 * a bottom spacer whose height is `keyboardSpacer(...)`, and scrolls to
 * `centeredScrollY(...)`. Both are pure and render-free, so the rules are
 * proven in node (modelled on `sheetKeyboardLayout` in sheet-contract.ts).
 *
 * Coordinates: `fieldY` is the field's top in content coordinates (measured
 * against the ScrollView's inner content view); `viewportTop`,
 * `viewportBottom` and `keyboardTop` are window coordinates (the keyboard top
 * is `endCoordinates.screenY`). `contentH` excludes the spacer.
 */

/** Gap kept above a field taller than the room above the keyboard, in dp. */
export const CENTERING_MARGIN = 16;

export interface KeyboardSpacerInput {
  viewportTop: number;
  viewportBottom: number;
  /** Window y of the keyboard's top edge; at or below viewportBottom = no overlap. */
  keyboardTop: number;
  /** Height of the active entry field. */
  fieldH: number;
  /** Whether an entry field is active (focused through the centring host). */
  active: boolean;
}

/**
 * Height of the host's bottom spacer. With no active entry field it is the
 * keyboard overlap alone (plain keyboard clearance; 0 on a resized screen).
 * While a field is active it adds centring slack, half the room left above the
 * keyboard beyond the field, so the scroll range reaches the centre even for
 * the content's last field (convergence c6, Codex C-01).
 */
export function keyboardSpacer({
  viewportTop,
  viewportBottom,
  keyboardTop,
  fieldH,
  active,
}: KeyboardSpacerInput): number {
  const overlap = Math.max(0, viewportBottom - keyboardTop);
  if (!active) return overlap;
  const room = Math.max(0, Math.min(viewportBottom, keyboardTop) - viewportTop);
  const slack = Math.max(0, (room - fieldH) / 2);
  return overlap + slack;
}

export interface CenteredScrollInput {
  fieldY: number;
  fieldH: number;
  viewportTop: number;
  viewportBottom: number;
  keyboardTop: number;
  /** Current scroll offset. */
  scrollY: number;
  /** Content height without the spacer. */
  contentH: number;
  margin: number;
}

/**
 * The scroll offset that puts the field's centre at the centre of
 * `[viewportTop, min(viewportBottom, keyboardTop)]`, clamped to
 * `[0, contentH + spacer − viewportHeight]` where the spacer is the active
 * `keyboardSpacer`. A field taller than the room aligns its top to
 * `viewportTop + margin` instead. An already-centred field returns `scrollY`
 * unchanged, so the host can skip the scroll.
 */
export function centeredScrollY({
  fieldY,
  fieldH,
  viewportTop,
  viewportBottom,
  keyboardTop,
  scrollY,
  contentH,
  margin,
}: CenteredScrollInput): number {
  const room = Math.max(0, Math.min(viewportBottom, keyboardTop) - viewportTop);
  const target =
    fieldH + 2 * margin > room
      ? fieldY - margin
      : fieldY + fieldH / 2 - room / 2;
  const spacer = keyboardSpacer({
    viewportTop,
    viewportBottom,
    keyboardTop,
    fieldH,
    active: true,
  });
  const viewportHeight = Math.max(0, viewportBottom - viewportTop);
  const maxScroll = Math.max(0, contentH + spacer - viewportHeight);
  const clamped = Math.min(Math.max(0, target), maxScroll);
  return Math.abs(clamped - scrollY) < 0.5 ? scrollY : clamped;
}

/** A ref to a field that can say whether it still holds focus. */
export interface FocusableFieldRef {
  readonly current: { isFocused(): boolean } | null;
}

/**
 * The field a keyboard show should re-centre, or null (convergence c2 G-U5,
 * Claude C-04 / Cursor CU-02). A show (including a keyboard height change)
 * re-centres only while the active entry field still holds focus: moving to a
 * plain field (Name, phone) can re-fire the show with a new height, and the
 * screen must not scroll back to the stale entry field.
 */
export function fieldToCentreOnShow<T extends FocusableFieldRef>(
  active: T | null,
): T | null {
  if (active === null) return null;
  return active.current?.isFocused() === true ? active : null;
}

/**
 * The active field after `blurred` loses focus: cleared only when the blurred
 * ref is the active one, so a late blur from an earlier field never clears a
 * newer active field.
 */
export function activeAfterBlur<T>(active: T | null, blurred: T): T | null {
  return active === blurred ? null : active;
}
