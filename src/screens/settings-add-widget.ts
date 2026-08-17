/**
 * settings-add-widget — the PURE result→copy handler for the Settings "Add Orbit
 * widget" affordance (WDG-03). Node-testable: NO react-native / react-native-android-widget
 * import, so its test never pulls in the native module.
 *
 * `requestPinWidget` resolves to `true` when the launcher ACCEPTED the pin request
 * (not that the user confirmed it) and `false` when the platform/launcher cannot
 * pin (unsupported launcher / API < 26). The Settings onPress additionally maps a
 * REJECTED promise to `false` (try/catch) so a thrown request is treated identically
 * to an unsupported one — never an unhandled rejection or a crash (Codex MED).
 *
 * This module owns ONLY the decision "given the boolean outcome, what copy (if any)
 * should the screen surface?" — null on success (nothing to show), the verbatim
 * UI-SPEC fallback string on false.
 */

/** The exact UI-SPEC "Add-widget fallback" copy (12-UI-SPEC.md:173). */
export const ADD_WIDGET_FALLBACK_COPY =
  "Your launcher can't add it automatically — add Orbit from your home screen's widget menu.";

/**
 * Map a requestPinWidget outcome to the copy the Settings row should surface:
 *   - true  → null   (launcher accepted the request; no message)
 *   - false → the verbatim fallback copy (unsupported launcher / API < 26 /
 *             a rejected request the caller mapped to false)
 */
export function pinResultCopy(result: boolean): string | null {
  return result ? null : ADD_WIDGET_FALLBACK_COPY;
}
