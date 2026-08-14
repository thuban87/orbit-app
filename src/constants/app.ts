/**
 * Centralized app identity constants.
 *
 * `APP_NAME` is the app's DISPLAY name — the visible title in the UI and the
 * Expo `name` in `app.config.ts`. It is DECOUPLED from the Android package id
 * (`android.package`, install-locked to `com.bwales.orbit`): renaming the app
 * is a one-line edit here and must NOT change the package id, which is painful
 * to change after the first install (requires uninstall/reinstall).
 *
 * "Orbit" is the internal working name and is expected to change.
 */
export const APP_NAME = "Orbit";
