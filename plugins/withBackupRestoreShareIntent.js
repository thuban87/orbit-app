// @ts-nocheck
/**
 * Registers Orbit as a narrowly scoped Android Sharesheet target for JSON
 * backups. Android's scoped storage requires a user-mediated SAF grant to read
 * another app's Downloads document; this is that grant boundary. Keep these
 * exact MIME types — a wildcard share target would route unrelated files into
 * the restore surface.
 */
const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const JSON_MIME_TYPES = ["application/json", "text/json"];

function hasJsonShareFilter(filters) {
  return (filters ?? []).some((filter) => {
    const action = filter.action?.some(
      (entry) => entry.$?.["android:name"] === "android.intent.action.SEND",
    );
    const category = filter.category?.some(
      (entry) => entry.$?.["android:name"] === "android.intent.category.DEFAULT",
    );
    const types = new Set(
      (filter.data ?? []).map((entry) => entry.$?.["android:mimeType"]),
    );
    return action && category && JSON_MIME_TYPES.every((type) => types.has(type));
  });
}

module.exports = (config) =>
  withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    if (!hasJsonShareFilter(activity["intent-filter"])) {
      activity["intent-filter"] = activity["intent-filter"] ?? [];
      activity["intent-filter"].push({
        action: [{ $: { "android:name": "android.intent.action.SEND" } }],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        data: JSON_MIME_TYPES.map((mimeType) => ({
          $: { "android:mimeType": mimeType },
        })),
      });
    }
    return cfg;
  });
