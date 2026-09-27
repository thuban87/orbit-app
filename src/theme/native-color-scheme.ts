import { useEffect } from "react";
import { Appearance } from "react-native";
import type { ThemeMode } from "./theme-types";

/**
 * Native dialogs follow Orbit's mode (D-50, OA-D4).
 *
 * Orbit's light/dark/system mode is its OWN store (per package, ADR-087), not the
 * app.json `userInterfaceStyle` flag, which is inert on Android here. Native
 * surfaces that Orbit does not paint (RN `Alert`, the date/time picker dialogs)
 * take their look from the activity's night configuration, which by default is
 * the device's. Driving that configuration from Orbit's mode SETTING makes them
 * match the app.
 *
 * On Android, RN core maps `Appearance.setColorScheme` to
 * `AppCompatDelegate.setDefaultNightMode` (light → MODE_NIGHT_NO, dark →
 * MODE_NIGHT_YES, unspecified → MODE_NIGHT_FOLLOW_SYSTEM). The Expo AppTheme is
 * DayNight and MainActivity handles `uiMode`, so no activity is recreated and
 * no native package is needed.
 *
 * Feedback-loop guard: once the native mode is forced, `useColorScheme()`
 * reports the override. "system" therefore maps to "unspecified", NEVER to the
 * resolved value, so `useColorScheme()` keeps reporting the device scheme that
 * `ThemeProvider` needs for its own System resolution.
 */
export type NativeColorScheme = "light" | "dark" | "unspecified";

/** Pure, total mapping from Orbit's mode setting to the native night mode. */
export function nativeColorSchemeFor(mode: ThemeMode): NativeColorScheme {
  switch (mode) {
    case "light":
      return "light";
    case "dark":
      return "dark";
    case "system":
      return "unspecified";
  }
}

/**
 * Apply the native night mode for the active package's mode SETTING (not the
 * resolved mode). Runs in an effect keyed on `mode`: once per change, never
 * during render. Re-applying an unchanged mode is a native no-op.
 */
export function useNativeColorSchemeSync(mode: ThemeMode): void {
  useEffect(() => {
    Appearance.setColorScheme(nativeColorSchemeFor(mode));
  }, [mode]);
}
