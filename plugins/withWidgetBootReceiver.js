// @ts-nocheck
/**
 * Expo config plugin: withWidgetBootReceiver (WDG-03, Phase 12-08).
 *
 * WHY A CONFIG PLUGIN CANNOT *BE* A RECEIVER (Codex HIGH):
 * A JavaScript Expo config plugin runs at PREBUILD, on the build host — it can
 * only GENERATE and REGISTER native code, it can never itself be an Android
 * `BroadcastReceiver` (those are Kotlin/Java classes instantiated by the OS at
 * runtime). So this plugin does two concrete things at prebuild:
 *
 *   (1) via `withDangerousMod` — writes a REAL Kotlin `BroadcastReceiver`
 *       (`OrbitWidgetBootReceiver.kt`) into the app package directory, next to
 *       the Expo-generated `MainApplication.kt`, so the manifest's relative
 *       `.OrbitWidgetBootReceiver` name resolves to `<appPackage>.OrbitWidgetBootReceiver`.
 *
 *   (2) via `withAndroidManifest` — adds the `RECEIVE_BOOT_COMPLETED`
 *       permission and a `<receiver android:exported="false" android:enabled="true">`
 *       carrying a single `BOOT_COMPLETED` intent-filter.
 *
 * WHY A SEPARATE BOOT PATH (WDG-03 / Pattern 5 / Open Q2/A4):
 * Android 15 distinguishes a cold BOOT from a force-stop. On cold boot no
 * foreground launch has happened, so the app's foreground refresh sweep never
 * runs — a placed widget would render stale until the user opens the app. This
 * receiver is that missing cold-boot path: on `BOOT_COMPLETED` it re-arms every
 * placed OrbitFavourites instance by calling the library's native
 * `RNWidgetJsCommunication.requestWidgetUpdate`.
 *
 * WHY exported="false" (Codex MED):
 * `BOOT_COMPLETED` is a PROTECTED system broadcast — only the OS can send it,
 * and it still reaches a non-exported receiver. The library's own widget
 * receiver was verified non-exported for the same reason. A boot receiver needs
 * no third-party access, so `exported="true"` would only widen the attack
 * surface for zero benefit. The `onReceive` exact-action guard is
 * defence-in-depth on top of that.
 *
 * NON-DUPLICATION ASSERTION (Codex MED):
 * react-native-android-widget@0.22.0's app.plugin.js was inspected — it
 * registers NO BOOT_COMPLETED / update-on-boot receiver (its widget receiver
 * carries only APPWIDGET_UPDATE + `<pkg>.WIDGET_CLICK`, and it registers
 * RNWidgetCollectionService). There is therefore no library boot receiver to
 * duplicate, so this plugin adds the concrete receiver (it does NOT reduce to
 * the manifest-assertion-only path). The manifest is re-asserted post-prebuild
 * in Task 2 to confirm EXACTLY ONE non-exported BOOT_COMPLETED receiver.
 *
 * LIBRARY CONTRACT VERIFIED AGAINST node_modules (Claude L2):
 *   node_modules/react-native-android-widget/android/src/main/java/com/
 *     reactnativeandroidwidget/RNWidgetJsCommunication.java:15
 *     -> `public static void requestWidgetUpdate(Context context, String widgetName)`
 *   It iterates getWidgetIds(context, name); an empty array (no placed widget)
 *   no-ops, so the call is safe on every boot.
 */

const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const { getMainApplicationOrThrow } = AndroidConfig.Manifest;

// The widget `name` contract string — must match app.config.ts widgetConfig and
// every requestWidgetUpdate/requestPinWidget/registerWidgetTaskHandler call.
const WIDGET_NAME = "OrbitFavourites";
const RECEIVER_CLASS = "OrbitWidgetBootReceiver";
const RECEIVER_MANIFEST_NAME = `.${RECEIVER_CLASS}`; // relative to android.package
const BOOT_PERMISSION = "android.permission.RECEIVE_BOOT_COMPLETED";
const BOOT_ACTION = "android.intent.action.BOOT_COMPLETED";

/** The concrete native Kotlin BroadcastReceiver source. */
function receiverKotlinSource(appPackage) {
  return `package ${appPackage}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

import com.reactnativeandroidwidget.RNWidgetJsCommunication

/**
 * Re-pushes the ${WIDGET_NAME} home-screen widget on device boot (WDG-03).
 *
 * GENERATED at prebuild by plugins/withWidgetBootReceiver.js — do NOT edit the
 * generated android/ copy; edit the plugin and re-prebuild.
 *
 * On a cold BOOT_COMPLETED the app's foreground refresh sweep has not run, so a
 * placed widget would show stale data. This SEPARATE native path re-arms every
 * placed widget instance. It is defence-in-depth guarded on the exact boot
 * action, and no-ops when no widget is placed (getWidgetIds() returns empty).
 */
class ${RECEIVER_CLASS} : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        // Guard FIRST on the exact action — never act on any other delivery.
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) {
            return
        }
        // Re-arm every placed widget from cold. Safe/no-op with no widget placed.
        RNWidgetJsCommunication.requestWidgetUpdate(context, "${WIDGET_NAME}")
    }
}
`;
}

/** (1) Emit the concrete native receiver class into the app package dir. */
function withBootReceiverClass(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const appPackage = cfg.android && cfg.android.package;
      if (!appPackage) {
        throw new Error(
          "withWidgetBootReceiver: android.package is required to place the receiver class.",
        );
      }
      // projectRoot is the repo root (documented). MainApplication.kt lives at
      // android/app/src/main/java/<pkg>/ — co-locate the receiver there so the
      // manifest's relative ".OrbitWidgetBootReceiver" resolves.
      const pkgDir = path.join(
        cfg.modRequest.projectRoot,
        "android/app/src/main/java",
        ...appPackage.split("."),
      );
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(
        path.join(pkgDir, `${RECEIVER_CLASS}.kt`),
        receiverKotlinSource(appPackage),
      );
      return cfg;
    },
  ]);
}

/** (2a) Add the RECEIVE_BOOT_COMPLETED permission (idempotent). */
function addBootPermission(androidManifest) {
  const manifest = androidManifest.manifest;
  if (!Array.isArray(manifest["uses-permission"])) {
    manifest["uses-permission"] = [];
  }
  const already = manifest["uses-permission"].some(
    (p) => p.$ && p.$["android:name"] === BOOT_PERMISSION,
  );
  if (!already) {
    manifest["uses-permission"].push({ $: { "android:name": BOOT_PERMISSION } });
  }
}

/** (2b) Add the non-exported BOOT_COMPLETED receiver (idempotent, exactly one). */
function addBootReceiver(androidManifest) {
  const mainApplication = getMainApplicationOrThrow(androidManifest);
  if (!Array.isArray(mainApplication.receiver)) {
    mainApplication.receiver = [];
  }
  const already = mainApplication.receiver.some(
    (r) => r.$ && r.$["android:name"] === RECEIVER_MANIFEST_NAME,
  );
  if (already) return;
  mainApplication.receiver.push({
    $: {
      "android:name": RECEIVER_MANIFEST_NAME,
      "android:exported": "false",
      "android:enabled": "true",
    },
    "intent-filter": [
      {
        action: [{ $: { "android:name": BOOT_ACTION } }],
      },
    ],
  });
}

function withBootReceiverManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    addBootPermission(cfg.modResults);
    addBootReceiver(cfg.modResults);
    return cfg;
  });
}

/** @param {import('expo/config-plugins').ExpoConfig} config */
const withWidgetBootReceiver = (config) => {
  config = withBootReceiverClass(config);
  config = withBootReceiverManifest(config);
  return config;
};

module.exports = withWidgetBootReceiver;
