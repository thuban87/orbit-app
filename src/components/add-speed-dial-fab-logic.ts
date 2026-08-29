/**
 * Pure interactivity logic for the dashboard Add-contact speed dial
 * (`AddSpeedDialFab`). Extracted so the collapsed→inert invariant is unit-testable
 * in the render-free node vitest env (the ContactCard `ringVisual` idiom).
 *
 * Why this exists (GAP D / 19-18): the speed dial's full-screen scrim is an
 * `absoluteFill` Pressable that is always mounted and only animates *opacity*.
 * In React Native an opacity-0 view still captures touches, so a hardcoded
 * `pointerEvents="auto"` scrim blankets the whole dashboard and swallows every
 * touch while collapsed. The scrim (and the collapsed option buttons) must be
 * `"none"` when the dial is closed so dashboard touches pass through, and
 * `"auto"` when open so the outside-tap-to-collapse works.
 */

/** React Native `pointerEvents` values this helper emits. */
export type ScrimPointerEvents = "auto" | "none";

/**
 * Pointer-events for the speed-dial scrim and collapsed option buttons.
 * `open` → "auto" (intercept the outside tap); collapsed → "none" (inert, so
 * the dashboard beneath receives touches).
 */
export function speedDialScrimPointerEvents(open: boolean): ScrimPointerEvents {
  return open ? "auto" : "none";
}
