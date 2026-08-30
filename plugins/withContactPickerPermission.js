// @ts-nocheck
/**
 * Adds the legacy Contacts permission to the generated app manifest.
 *
 * The local Expo module's library manifest is merged only during Gradle's
 * manifest-merge step. Keep the permission in this config plugin as well so
 * the prebuild-generated app manifest is the auditable packaging source and
 * always retains Android's API-37 cutoff.
 */
const { withAndroidManifest } = require("expo/config-plugins");

const READ_CONTACTS = "android.permission.READ_CONTACTS";
const MAX_LEGACY_CONTACTS_SDK = "36";

module.exports = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }
    const permissions = manifest["uses-permission"];
    const existing = permissions.find(
      (permission) => permission.$?.["android:name"] === READ_CONTACTS,
    );

    if (existing) {
      existing.$["android:maxSdkVersion"] = MAX_LEGACY_CONTACTS_SDK;
    } else {
      permissions.push({
        $: {
          "android:name": READ_CONTACTS,
          "android:maxSdkVersion": MAX_LEGACY_CONTACTS_SDK,
        },
      });
    }

    return cfg;
  });
