import appName from "./app-name.json";

/**
 * Centralized app identity constants.
 *
 * `APP_NAME` is the app's DISPLAY name — the visible UI title and the Expo
 * `name` in `app.config.ts`. It is DECOUPLED from the Android package id
 * (`android.package`, install-locked to `com.bwales.orbit`): renaming the app
 * is a one-line edit in `app-name.json` and must NOT change the package id,
 * which is painful to change after the first install (uninstall/reinstall).
 *
 * The single source of the string is `app-name.json`, NOT a TS literal, on
 * purpose: `app.config.ts` is evaluated by Node (Expo's config loader) which
 * cannot `require` a `.ts` module without a global TS loader hook (`tsx/cjs`),
 * and that hook pollutes metro's own module resolution and breaks the embedded
 * release JS bundle (`Cannot find module 'babel-preset-expo'`). A JSON file is
 * loadable natively by all three consumers — Node/Expo, metro, and tsc — so the
 * one string is shared without any global hook. See
 * `docs/runbooks/desktop-build-pipeline.md`.
 *
 * "Orbit" is the internal working name and is expected to change.
 */
export const APP_NAME: string = appName.APP_NAME;
