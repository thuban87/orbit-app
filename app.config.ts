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
    // PII-at-rest mitigation (T-02-13, dossier cluster G — [DECIDED]). The
    // app-private SQLite file holds third-party notes; allowBackup=false keeps
    // it out of OS auto-backup / `adb backup` so it cannot be pulled off-device.
    // Zero-dependency: Expo maps this to android:allowBackup="false" in the
    // generated release manifest (asserted on droid during the prebuild in
    // Task 3). This ENFORCES a recorded decision — never "fix" it back to true.
    allowBackup: false,
  },
  // Pre-register the native deps that ship a config plugin so the first
  // prebuild covers them. Deduped: `expo install` already added expo-sqlite to
  // app.json's plugins, and a duplicate plugin entry is a prebuild error.
  // `@react-native-community/datetimepicker` ships a config plugin (Plan 04-03)
  // and `expo install` instructs registering it here; `@react-native-picker/picker`
  // ships none, so it needs no plugins entry.
  //
  // Phase-5 photo pipeline (Plan 05-01) adds two native config plugins:
  //   - `expo-image` — `expo install` explicitly instructed registering it; a
  //     bare string entry keeps this "framework init" a SINGLE prebuild.
  //   - `expo-image-picker` — a `[name, options]` TUPLE that hardens the picker
  //     to library-only. `cameraPermission:false`/`microphonePermission:false`
  //     keep CAMERA and RECORD_AUDIO out of the generated release manifest
  //     (T-05-01 information-disclosure mitigation; dossier Cluster A).
  //
  // The string-only entries dedupe via the Set exactly as before. The picker
  // TUPLE canNOT be deduped by the Set (a `["expo-image-picker", opts]` array is
  // a distinct Set member from the bare `"expo-image-picker"` string), so the
  // full plugin list is deduped BY NAME below and the tuple appended exactly once.
  plugins: (() => {
    const pluginName = (
      entry: NonNullable<ExpoConfig["plugins"]>[number],
    ): string => (Array.isArray(entry) ? (entry[0] as string) : (entry as string));

    const stringPlugins = [
      ...new Set([
        ...(config.plugins ?? []),
        "expo-sqlite",
        "@react-native-community/datetimepicker",
        "expo-image",
      ]),
    ];

    const pickerPlugin: [string, Record<string, unknown>] = [
      "expo-image-picker",
      { cameraPermission: false, microphonePermission: false },
    ];

    return [
      ...stringPlugins.filter((p) => pluginName(p) !== "expo-image-picker"),
      pickerPlugin,
    ];
  })(),
});
