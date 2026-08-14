import type { ConfigContext, ExpoConfig } from "expo/config";
// Import the display name from JSON (NOT from `src/constants/app.ts`). Expo
// evaluates this config in Node via its own TS-stripping loader, which can
// `require` a `.json` natively but NOT a `.ts` — importing a `.ts` here would
// force a global `tsx/cjs` loader hook, and that hook pollutes metro's module
// resolution and breaks the embedded release JS bundle. JSON keeps the display
// name a single source shared with the app without any hook. A rename is a
// one-line edit in app-name.json, DECOUPLED from the install-locked package id.
import appName from "./src/constants/app-name.json";

// Functional config form: MERGES the template's app.json (preserving its
// icon/splash/adaptive-icon references) and layers Orbit's fields on top.
// Expo loads this TypeScript config natively (no `tsx/cjs` hook needed).
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName.APP_NAME,
  slug: "orbit",
  // Config-layer portrait lock (CLAUDE.md — the app is portrait-locked).
  orientation: "portrait",
  android: {
    ...config.android,
    // Owner-confirmed Android application id (FND-01 checkpoint, plan 01-05).
    // Install-locked and STABLE: it does NOT track the display name (APP_NAME).
    // Changing it after the first install requires uninstall/reinstall.
    package: "com.bwales.orbit",
    predictiveBackGestureEnabled: false,
  },
  // Pre-register the Phase 2 native dep so the first prebuild covers it.
  // Deduped: `expo install` already added expo-sqlite to app.json's plugins,
  // and a duplicate plugin entry is a prebuild error.
  plugins: [...new Set([...(config.plugins ?? []), "expo-sqlite"])],
});
