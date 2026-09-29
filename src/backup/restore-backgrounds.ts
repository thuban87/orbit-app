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
 * The question is asked ONLY when the backup's settings will actually be
 * written (owner ruling RA-a, 2026-09-29, refining D-47 as D-49). A Merge whose
 * backup settings are not newer than this phone's never writes them, so an
 * unavailable id there is irrelevant: no question, and the restore proceeds.
 * `restoreWritesBackupSettings` is the ONE predicate for "the settings are
 * written"; `applyRestore` uses it for the write and, through
 * `backgroundsNeedingConsent`, for its consent gate, and the restore flow uses
 * `backgroundsNeedingConsent` for the notice and the dialog. So the prompt and
 * the write cannot disagree.
 *
 * PURE: no React Native import.
 */
import type { RestoreMode } from "@/backup/restore-apply";
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
 * Whether a restore writes the backup's portable settings: always for
 * Replace-all; for Merge only when the backup's settings are newer than this
 * phone's (last-writer-wins on `app_settings.modified_at`). The single source
 * for `applyRestore`'s settings write and for the D-47 consent decision (RA-a).
 */
export function restoreWritesBackupSettings(
  mode: RestoreMode,
  backupSettingsModifiedAt: unknown,
  localSettingsModifiedAt: string,
): boolean {
  return (
    mode === "replace-all" ||
    (backupSettingsModifiedAt as string) > localSettingsModifiedAt
  );
}

/**
 * The unavailable background ids the user must consent to before this restore
 * runs (D-47 as refined by RA-a / D-49): every unavailable id when the backup's
 * settings will be written (`restoreWritesBackupSettings`), none otherwise.
 * `readLocalSettingsModifiedAt` is read only when the backup holds an
 * unavailable id. Used by BOTH the restore flow's question and `applyRestore`'s
 * gate, so the two cannot disagree.
 */
export async function backgroundsNeedingConsent(
  mode: RestoreMode,
  appSettings: Readonly<Record<string, unknown>> | null | undefined,
  readLocalSettingsModifiedAt: () => Promise<string>,
): Promise<UnavailableBackupBackground[]> {
  const unavailable = unavailableBackupBackgrounds(appSettings);
  if (unavailable.length === 0) return [];
  return restoreWritesBackupSettings(
    mode,
    appSettings?.modifiedAt,
    await readLocalSettingsModifiedAt(),
  )
    ? unavailable
    : [];
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
