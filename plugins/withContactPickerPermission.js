// @ts-nocheck
/**
 * Declares the Contacts permission in the generated app manifest, applied on ALL
 * supported API levels INCLUDING API 37+.
 *
 * ADR-003 (supersedes ADR-002's "no READ_CONTACTS on API 37" clause / the former
 * `maxSdkVersion="36"` cap) for the Phase-20 reconcile RE-READ, which reads the live
 * state of an already-linked set via ContactsContract — something the permissionless
 * system picker cannot serve. Import is unchanged (permissionless picker ≥37 / in-app
 * picker ≤36); only reconcile consumes this permission, requested in-context via
 * ensureReadContactsPermission. Play: file the Contacts declaration (CRM / Contact
 * Management) at release.
 *
 * The permission MUST live here, not only in the orbit-contact-picker library
 * manifest: at Gradle manifest-merge the app manifest wins, so a cap re-applied here
 * would override the module's uncapped declaration. This plugin therefore ensures the
 * permission is present WITHOUT an SDK cap and strips any cap left on an existing entry.
 */
const { withAndroidManifest } = require("expo/config-plugins");

const READ_CONTACTS = "android.permission.READ_CONTACTS";

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
      // ADR-003: the permission must be live on API 37+, so drop any SDK cap.
      delete existing.$["android:maxSdkVersion"];
    } else {
      permissions.push({ $: { "android:name": READ_CONTACTS } });
    }

    return cfg;
  });
