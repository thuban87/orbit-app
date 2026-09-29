/**
 * Unavailable background ids in a backup (38.5 D-47; code review IN-07; owner
 * ruling 2026-09-29, superseding T-38.5-05-03's whole-restore abort).
 *
 * A backup's `appSettings.galaxyBackground` / `standardBackground` holds a slot
 * id. The DAO (`assertBackgroundId`) accepts null, an ACTIVE id and a RETIRED
 * one (38.5 D-19 / P-4); anything else is UNAVAILABLE here, for example a slot
 * added by a later app version under the same backup format (D-34: no format
 * bump). The owner: "I would lean towards swapping to the default background in
 * this case but there should be a warning and confirmation given to the user
 * first".
 *
 * So the restore flow asks first (`RestorePreviewScreen`), and only when the
 * user continues does the restore MAPPING below replace each unavailable id
 * with its package's default slot, before the settings patch reaches the DAO.
 * The DAO stays strict for every write, restore included: an unavailable id
 * that was not mapped still throws there. Retired ids are available: they
 * restore unchanged and silently, and the resolver renders the default.
 *
 * PURE: no React Native import.
 */
import { assertBackgroundId } from "@/db/app-settings-dao";
import { PACKAGE_DEFAULT_SLOT } from "@/theme/backgrounds";
import type { BackgroundSlotId } from "@/theme/theme-option-ids";
import type { ThemePackage } from "@/theme/theme-types";

/** The two portable background keys and the package each belongs to. */
export const BACKUP_BACKGROUND_KEYS = [
  { key: "galaxyBackground", package: "galaxy" },
  { key: "standardBackground", package: "standard" },
] as const satisfies readonly { key: string; package: ThemePackage }[];

export type BackupBackgroundKey =
  (typeof BACKUP_BACKGROUND_KEYS)[number]["key"];

export interface UnavailableBackupBackground {
  key: BackupBackgroundKey;
  package: ThemePackage;
  /** The backup's value (already schema-checked to a bounded string). */
  storedId: string;
  /** What the restore writes instead when the user continues. */
  replacement: BackgroundSlotId;
}

/**
 * Whether the DAO would accept `value` for a background key. The DAO's own
 * validator is the single source, so this set and the DAO's cannot drift.
 */
function daoAccepts(key: BackupBackgroundKey, value: unknown): boolean {
  try {
    assertBackgroundId(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * The backup's background ids the DAO would reject, in key order. An absent
 * key or a null value is available (the resolver renders the default).
 */
export function unavailableBackupBackgrounds(
  appSettings: Readonly<Record<string, unknown>> | null | undefined,
): UnavailableBackupBackground[] {
  if (!appSettings) return [];
  const out: UnavailableBackupBackground[] = [];
  for (const { key, package: themePackage } of BACKUP_BACKGROUND_KEYS) {
    if (!Object.hasOwn(appSettings, key)) continue;
    const value = appSettings[key];
    if (value === undefined || daoAccepts(key, value)) continue;
    out.push({
      key,
      package: themePackage,
      storedId: String(value),
      replacement: PACKAGE_DEFAULT_SLOT[themePackage],
    });
  }
  return out;
}

/**
 * The restore mapping the user agreed to: a copy of `appSettings` with every
 * unavailable background id replaced by its package default. Every other key,
 * and every available background id (active, retired or null), is unchanged.
 */
export function withDefaultBackgrounds<T extends Record<string, unknown>>(
  appSettings: T,
): T {
  const unavailable = unavailableBackupBackgrounds(appSettings);
  if (unavailable.length === 0) return appSettings;
  const next: Record<string, unknown> = { ...appSettings };
  for (const { key, replacement } of unavailable) next[key] = replacement;
  return next as T;
}
