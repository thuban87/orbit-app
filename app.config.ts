import "tsx/cjs";
import type { ConfigContext, ExpoConfig } from "expo/config";
// Relative import (not the `@/` alias): this file is evaluated by Node via the
// tsx/cjs hook at prebuild time, which does not resolve the metro/tsconfig
// `@/*` path alias. The display name lives in one place so a future rename is
// a one-line edit — DECOUPLED from the install-locked android.package below.
import { APP_NAME } from "./src/constants/app";

// Functional config form: MERGES the template's app.json (preserving its
// icon/splash/adaptive-icon references) and layers Orbit's fields on top.
// Loads via the `tsx/cjs` hook on line 1 so Expo can evaluate this TypeScript
// config at prebuild — without it, prebuild fails to load the config.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
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
