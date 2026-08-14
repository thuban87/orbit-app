import "tsx/cjs";
import type { ConfigContext, ExpoConfig } from "expo/config";

// Functional config form: MERGES the template's app.json (preserving its
// icon/splash/adaptive-icon references) and layers Orbit's fields on top.
// Loads via the `tsx/cjs` hook on line 1 so Expo can evaluate this TypeScript
// config at prebuild — without it, prebuild fails to load the config.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Orbit",
  slug: "orbit",
  // Config-layer portrait lock (CLAUDE.md — the app is portrait-locked).
  orientation: "portrait",
  android: {
    ...config.android,
    // Placeholder Android application id. The real package id is confirmed by
    // the owner at the FND-01 checkpoint (plan 01-05) before the first build.
    package: "com.placeholder.orbit",
    predictiveBackGestureEnabled: false,
  },
  // Pre-register the Phase 2 native dep so the first prebuild covers it.
  // Deduped: `expo install` already added expo-sqlite to app.json's plugins,
  // and a duplicate plugin entry is a prebuild error.
  plugins: [...new Set([...(config.plugins ?? []), "expo-sqlite"])],
});
