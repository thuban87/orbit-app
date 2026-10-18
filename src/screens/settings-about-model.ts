import Constants from "expo-constants";

/**
 * settings-about-model — the display data for Settings → About Orbit (§K).
 *
 * §K's rule is "omit unavailable rows": About surfaces ONLY fields that have a
 * genuine runtime source. Verified on disk (Plan 08):
 *   - the product name is NOT read from config — it is the module constant below
 *     (`ABOUT_APP_NAME`). (`app.json` once carried the scaffold `"orbit-scaffold"`
 *     here, OWNER FLAG F-1; 38.4 D-42 C set it to the values `app.config.ts`
 *     already resolved — "Orbit"/"orbit" — with no change to the resolved
 *     config or the Android package.)
 *   - the semantic version DOES have a real source (`expo-constants`
 *     `Constants.expoConfig?.version` → `"1.0.0"`), read with a module-constant
 *     fallback so a missing config value still renders.
 *   - there is NO `android.versionCode` on disk → no build number to show (omitted).
 *   - there is NO license generator/asset and no package installed for it this
 *     phase → dependency licenses/acknowledgements are omitted (OWNER FLAG F-2).
 *
 * This module owns ONLY the pure "what string does About display?" decision; the
 * screen renders it. No react-native import here so the resolver stays testable.
 */

/**
 * The product name shown in About — a real product name, kept as a module
 * constant rather than read from app config (OWNER FLAG F-1). The Android
 * package id is install-locked and separate (`app.config.ts`).
 */
export const ABOUT_APP_NAME = "Orbit";

/**
 * The fallback semantic version, used only when `expo-constants` has no
 * `expoConfig.version` at runtime. Mirrors `app.json`'s `version` ("1.0.0") so a
 * missing config value degrades to the shipped version rather than an empty row.
 */
export const ABOUT_VERSION_FALLBACK = "1.0.0";

/**
 * Resolve the semantic version to display: the real `expo-constants` config
 * value when present, else the module-constant fallback. The build number is
 * intentionally NOT resolved — no `android.versionCode` exists on disk (§K
 * omit-unavailable).
 */
export function resolveAboutVersion(): string {
  return Constants.expoConfig?.version ?? ABOUT_VERSION_FALLBACK;
}

/**
 * The privacy line (38.12 D-125; copy at planning, the owner reviews it at the
 * device check). It stays literally true to CLAUDE.md "Local-first":
 *   - it speaks about CONTACT data, because Orbit makes non-AI requests that
 *     carry none (a pasted image URL download, OpenRouter sign-in, the AI model
 *     list — convergence c1 L-4), so "nothing is sent anywhere" would be false;
 *   - it names the backup folder, because automatic backups write the full
 *     contact data (unencrypted when backup encryption is off) to a folder the
 *     user chooses, which may be cloud-synced (`backup-service.ts`
 *     resolveWriteEncryptionMode / writeVerified — convergence c4 E-6);
 *   - the only other egress is the user's own AI provider, on explicit use;
 *   - Backup → Export hands the full data to whichever app the user picks in
 *     the share sheet. 38.12 D-151 (owner) adds that clause and highlights it
 *     ("it goes against our ethos kind of"); the D-125 wording is otherwise
 *     kept.
 */
export const ABOUT_PRIVACY_LINE =
  "Your contact data stays on this phone, and in the backup folder you choose. Orbit never sends it anywhere else, except to your own AI provider when you choose to use AI,";
/** The highlighted Export clause that finishes the privacy line (D-151). */
export const ABOUT_PRIVACY_EXPORT_CLAUSE =
  "and when you use Export, which hands your full data to an app you pick.";
