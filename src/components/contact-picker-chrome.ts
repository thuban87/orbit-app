/**
 * The contact picker modal's chrome (38.13). PURE: no react-native import, so
 * it is node-testable; `ContactPicker` renders what these return.
 *
 * - Title (D-70, audit A-24): the picker names the action that opened it, e.g.
 *   "Quick Log: choose contact". A caller that passes no title keeps today's
 *   "Choose contact" / "Choose contacts".
 * - Keyboard (D-43, audit A-25): the picker's Modal window is edge-to-edge, so
 *   Android does not resize it for the soft keyboard and its search field and
 *   results sat behind the keyboard. It reuses the 38.9 sheet keyboard layout
 *   (`sheetKeyboardLayout`, as CaptureScreen does outside `Sheet`). 82% is not
 *   a Sheet variant, so the layout is computed as `expanded`; the picker keeps
 *   its 82% cap at rest and, while the keyboard is up, is lifted above it and
 *   capped to the room left (never taller than at rest).
 */
import { sheetKeyboardLayout } from "@/components/ui/sheet-contract";

/** The picker sheet's height cap while the keyboard is down (today's value). */
export const CONTACT_PICKER_RESTING_MAX_HEIGHT = "82%";
const RESTING_FRACTION = 0.82;
/** The picker sheet's floor (today's value); it shrinks to a smaller cap. */
export const CONTACT_PICKER_MIN_HEIGHT = 260;

/** The picker heading: the caller's action title, else today's default. */
export function contactPickerTitle(
  title: string | undefined,
  isMultiSelect: boolean,
): string {
  if (title?.trim()) return title;
  return isMultiSelect ? "Choose contacts" : "Choose contact";
}

export interface ContactPickerKeyboardInput {
  /** Current height of the picker's modal root. */
  frameHeight: number;
  /** Tallest root height seen, i.e. the height while the keyboard is down. */
  restingFrameHeight: number;
  /** Height the keyboard occupies (0 when down). */
  keyboardHeight: number;
  /** Space kept clear at the top (status bar inset plus a margin). */
  topClearance: number;
}

export interface ContactPickerKeyboardFrame {
  /** Bottom padding on the modal root that lifts the sheet above the keyboard. */
  lift: number;
  /** The sheet's maxHeight: the resting percent, or a measured cap. */
  maxHeight: number | typeof CONTACT_PICKER_RESTING_MAX_HEIGHT;
  /** The sheet's minHeight, never above `maxHeight`. */
  minHeight: number;
}

export function contactPickerKeyboardFrame(
  input: ContactPickerKeyboardInput,
): ContactPickerKeyboardFrame {
  const layout = sheetKeyboardLayout({ variant: "expanded", ...input });
  if (layout.size === null) {
    return {
      lift: 0,
      maxHeight: CONTACT_PICKER_RESTING_MAX_HEIGHT,
      minHeight: CONTACT_PICKER_MIN_HEIGHT,
    };
  }
  const resting = Math.max(input.restingFrameHeight, input.frameHeight);
  const maxHeight = Math.min(
    layout.size,
    Math.round(RESTING_FRACTION * resting),
  );
  return {
    lift: layout.lift,
    maxHeight,
    minHeight: Math.min(CONTACT_PICKER_MIN_HEIGHT, maxHeight),
  };
}

/**
 * The picker's resting (keyboard-down) frame height, tracked against the
 * window height it was measured in (38.13 review B-IN-05). The FAB's picker
 * lives for the whole session, so a max-only resting height kept the tallest
 * window ever seen: after the window shrank (the Razr's cover display, split
 * screen) the keyboard lift was under-computed and the sheet sat behind the
 * keyboard.
 */
export interface RestingFrame {
  height: number;
  windowHeight: number;
}

/** A window-height change starts the resting height again (0 = unmeasured). */
export function rebaseRestingFrame(
  resting: RestingFrame,
  windowHeight: number,
): RestingFrame {
  if (resting.windowHeight === windowHeight) return resting;
  return { height: 0, windowHeight };
}

/**
 * A root layout. Within one window size the resting height only grows: the
 * keyboard resizing the window shrinks the frame, never the window size.
 */
export function growRestingFrame(
  resting: RestingFrame,
  frameHeight: number,
): RestingFrame {
  return {
    height: Math.max(resting.height, frameHeight),
    windowHeight: resting.windowHeight,
  };
}

/**
 * The modal picker's search reset key (38.14 D-40). The FAB's picker stays
 * mounted, so its list kept the last search across opens. A new key on every
 * hidden -> visible transition lets `ContactPickerList`'s `searchResetKey`
 * effect clear the term each time the picker opens; otherwise the key holds.
 */
export function nextPickerResetKey(
  prevKey: number,
  wasVisible: boolean,
  visible: boolean,
): number {
  return visible && !wasVisible ? prevKey + 1 : prevKey;
}
