import type { ConfigContext, ExpoConfig } from "expo/config";
// Type-only import (fully erased at evaluation — no runtime `require`, so it
// does NOT trip the tsx/cjs loader hazard the display-name comment below warns
// about). Sources the widget config-plugin param shape from the INSTALLED
// react-native-android-widget@0.22.0 types (config-plugin.type.d.ts), so the
// widgetConfig below is checked against the library's real contract.
import type { WithAndroidWidgetsParams } from "react-native-android-widget";
// Import the display name from JSON (NOT from `src/constants/app.ts`). Expo
// evaluates this config in Node via its own TS-stripping loader, which can
// `require` a `.json` natively but NOT a `.ts` — importing a `.ts` here would
// force a global `tsx/cjs` loader hook, and that hook pollutes metro's module
// resolution and breaks the embedded release JS bundle. JSON keeps the display
// name a single source shared with the app without any hook. A rename is a
// one-line edit in app-name.json, DECOUPLED from the install-locked package id.
import appName from "./src/constants/app-name.json";

// Phase-12 home-screen widget (Plan 12-02, WDG-01/02/03). The single net-new
// native dependency `react-native-android-widget` ships an Expo config plugin
// (referenced by the bare package name; Expo resolves its app.plugin.js) that
// consumes this `WithAndroidWidgetsParams` object and, at PREBUILD (12-08, on
// the desktop pipeline), generates the AppWidgetProvider + widget-info XML.
// NOTHING renders yet — this plan only makes the dependency + config available
// locally so the later native-surface slices (12-05..12-08) typecheck against
// the library.
//
// TUNABLES (owner-adjustable, tuned on the Pixel in 12-08): the resize bounds
// (min/max) and target cell span. `updatePeriodMillis: 0` is EVENT-PUSH ONLY
// (WDG-03) — never raise it above 0: the library floors any positive value at
// 30 min and the OS Doze-throttles it. Orbit pushes updates via
// requestWidgetUpdate on data change, so polling is unnecessary and battery-
// hostile.
//
// `name: "OrbitFavourites"` is the CONTRACT string every later
// requestWidgetUpdate / requestPinWidget / registerWidgetTaskHandler call must
// reference verbatim. `previewImage` is intentionally OMITTED — no committed
// preview asset exists yet and a missing asset path fails prebuild; polish can
// come later. Prop names/casing verified against the installed 0.22.0
// config-plugin.type.d.ts (resizeMode / maxResizeWidth / maxResizeHeight).
const widgetConfig: WithAndroidWidgetsParams = {
  widgets: [
    {
      name: "OrbitFavourites",
      label: "Orbit — Favourites",
      description: "Your favourite people, at a glance.",
      minWidth: "250dp",
      minHeight: "110dp",
      targetCellWidth: 4,
      targetCellHeight: 2,
      // Resize contract (WDG-03 — "one resizable widget").
      resizeMode: "horizontal|vertical",
      maxResizeWidth: "360dp",
      maxResizeHeight: "220dp",
      updatePeriodMillis: 0,
    },
  ],
};

// Functional config form: MERGES the template's app.json (preserving its
// icon/splash/adaptive-icon references) and layers Orbit's fields on top.
// Expo loads this TypeScript config natively (no `tsx/cjs` hook needed).
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName.APP_NAME,
  slug: "orbit",
  // The expo-share-intent config plugin REQUIRES a scheme (Phase 10, CAP-01).
  // None was previously set; "orbit" is the app's deep-link scheme.
  scheme: "orbit",
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
    ): string =>
      Array.isArray(entry) ? (entry[0] as string) : (entry as string);

    const stringPlugins = [
      ...new Set([
        ...(config.plugins ?? []),
        "expo-sqlite",
        "@react-native-community/datetimepicker",
        "expo-image",
        // Phase-11 notifications (Plan 11-01, NOTIF-01). Bare string entry —
        // Orbit needs no plugin options (no custom notification icon/sound, no
        // FCM google-services.json: the FCM-less local-notification path is the
        // decided architecture). The Set-dedupe handles it exactly like the
        // other string plugins; no tuple append and no exact-alarm permission.
        // `expo-task-manager` (the peer module `registerTaskAsync` requires for
        // the killed-app headless task) ships NO config plugin, so it adds no
        // plugins entry — installing the dependency alone is sufficient.
        "expo-notifications",
      ]),
    ];

    const pickerPlugin: [string, Record<string, unknown>] = [
      "expo-image-picker",
      { cameraPermission: false, microphonePermission: false },
    ];

    // Phase-10 share-sheet capture (Plan 10-01, CAP-01). Registers Orbit as a
    // plain-text-ONLY Android share target — never a broader wildcard MIME type
    // (attack-surface minimization; a wildcard would hit the text/html error
    // branch). The multi-item intent-filter option is deliberately left unset so
    // ACTION_SEND_MULTIPLE stays unregistered (multi-item share is out of v1).
    // Like the picker, this is a `[name, options]` TUPLE — a distinct Set member
    // from a bare string, so it cannot be Set-deduped; it is filtered out by name
    // below and appended exactly once (the 01-01 duplicate-plugin prebuild hazard).
    const shareIntentPlugin: [string, Record<string, unknown>] = [
      "expo-share-intent",
      { androidIntentFilters: ["text/plain"] },
    ];

    // Phase-12 home-screen widget (Plan 12-02, WDG-01/02/03). TUPLE of the
    // config-plugin name (bare package name; Expo resolves app.plugin.js) + the
    // widgetConfig declared at top-of-config. Like the picker/share tuples this
    // is a distinct Set member from a bare string, so it is filtered out by name
    // below and appended exactly once (the 01-01 duplicate-plugin prebuild
    // hazard). A bare "react-native-android-widget" string would carry NO widget
    // definition and prebuild would generate no widget provider.
    const widgetPlugin: [string, WithAndroidWidgetsParams] = [
      "react-native-android-widget",
      widgetConfig,
    ];

    return [
      ...stringPlugins.filter(
        (p) =>
          pluginName(p) !== "expo-image-picker" &&
          pluginName(p) !== "expo-share-intent" &&
          pluginName(p) !== "react-native-android-widget",
      ),
      pickerPlugin,
      shareIntentPlugin,
      widgetPlugin,
    ];
  })(),
});
