/**
 * Orbit switch — pure visual and accessibility-state resolution (38.9 D-25,
 * D-26, D-47). RN-free, so the logic and the per-palette contrast gate run in
 * the node vitest env.
 *
 * D-47 (owner, Q-22 = SW-C): off = an outlined `borderStrong` track with a
 * small `textSecondary` thumb; on = an `accent` track with a large `onAccent`
 * thumb carrying a check (glyph role `accentText`, ADR-084 / ADR-169).
 *
 * D-26: a disabled switch is dimmed and SHOWS Off whatever its stored value.
 * That rule is visual only: the accessibility state keeps `checked` bound to
 * the real stored value, so TalkBack announces the actual setting (review L3).
 */

// --- Tunable geometry (single-number edits; the SW-C mockup frame) ----------
/** Track outer size (dp). Mockup `.swC`: 48 × 28. */
export const SWITCH_TRACK_WIDTH = 48;
export const SWITCH_TRACK_HEIGHT = 28;
/** Track outline width (dp). Mockup: `inset 0 0 0 2px var(--borderStrong)`. */
export const SWITCH_TRACK_BORDER = 2;
/** Off thumb diameter (dp), inset 7 from the outer edge. */
export const SWITCH_THUMB_OFF = 14;
/** On thumb diameter (dp), inset 3 from the outer edge. */
export const SWITCH_THUMB_ON = 22;
/** Minimum touch target (dp) — matches Button's MIN_TOUCH_TARGET. */
export const SWITCH_TOUCH_TARGET = 44;
/** Disabled opacity — the `Button.tsx` disabled opacity (D-26 "dimmed"). */
export const SWITCH_DISABLED_OPACITY = 0.5;

/**
 * Thumb box inside the track's padding box (absolute children are laid out
 * inside the border). Off sits inset 7 from the outer edge, on inset 3, so the
 * thumb grows and slides together.
 */
export const SWITCH_THUMB_OFF_OFFSET =
  (SWITCH_TRACK_HEIGHT - SWITCH_THUMB_OFF) / 2 - SWITCH_TRACK_BORDER;
export const SWITCH_THUMB_ON_TOP =
  (SWITCH_TRACK_HEIGHT - SWITCH_THUMB_ON) / 2 - SWITCH_TRACK_BORDER;
export const SWITCH_THUMB_ON_LEFT =
  SWITCH_TRACK_WIDTH -
  2 * SWITCH_TRACK_BORDER -
  SWITCH_THUMB_ON -
  SWITCH_THUMB_ON_TOP;

export interface SwitchInput {
  /** The stored value. */
  value: boolean;
  disabled?: boolean;
  /** Busy (loading/saving) — announced, never drawn (C5-M2). */
  busy?: boolean;
}

export interface SwitchVisual {
  /** Whether the switch is DRAWN on (false whenever disabled — D-26). */
  on: boolean;
  opacity: number;
}

/** What the switch draws: a disabled switch is dimmed and shows Off (D-26). */
export function resolveSwitchVisual({
  value,
  disabled = false,
}: SwitchInput): SwitchVisual {
  if (disabled) return { on: false, opacity: SWITCH_DISABLED_OPACITY };
  return { on: value, opacity: 1 };
}

export interface SwitchA11yState {
  checked: boolean;
  disabled: boolean;
  busy?: true;
}

/**
 * What the switch announces. `checked` follows the STORED value, never the
 * visual `on`, so a disabled switch that shows Off still announces its real
 * setting (D-26 is visual; review L3). `busy` is present only when true.
 */
export function resolveSwitchA11yState({
  value,
  disabled = false,
  busy = false,
}: SwitchInput): SwitchA11yState {
  const state: SwitchA11yState = { checked: value, disabled };
  if (busy) state.busy = true;
  return state;
}
