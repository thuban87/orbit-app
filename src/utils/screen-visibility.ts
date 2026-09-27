/**
 * Shared screen-visibility predicates for refresh gating (38.3 review A-WR-01;
 * 38.3 VERIFICATION W2; 38.4 D-10).
 *
 * Navigation focus alone stays `true` while the app sits in the background with
 * the screen as the focused route, so a warm notification Mark/Snooze's shell
 * tick used to run a full read in the background. `appState` MUST be
 * react-native's synchronous `AppState.currentState` — never a React-state
 * mirror, which lags the post-sweep foreground tick on resume and would drop
 * the D-14 read. Only the background hides a screen: `inactive` is a transient
 * overlay with no resume sweep after it, so a tick there must still read.
 *
 * Pure: no React, no react-native, no timers. Callers pass the app state in.
 */

/** True only when the app is in the `background` state. */
export function isAppBackgrounded(
  appState: string | null | undefined,
): boolean {
  return appState === "background";
}

/** Focused route AND app not backgrounded (`inactive` counts as visible). */
export function isForegroundVisible(
  focused: boolean,
  appState: string | null | undefined,
): boolean {
  return focused && !isAppBackgrounded(appState);
}
