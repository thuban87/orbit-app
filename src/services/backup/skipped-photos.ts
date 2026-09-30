/**
 * Skipped-photo reporting for backups (38.6 D-24). A backup no longer fails on
 * one unreadable photo: it leaves that photo out and tells the user how many
 * were left out, on each writer's own surface (the manual export Alert, the
 * Backup health card for the latest automatic backup, the Restore result for
 * the Replace-all safety backup).
 *
 * The automatic count lives under a DEVICE-LOCAL AsyncStorage key (the 38.6-01
 * `legacy-image-disk-cache-sweep.ts` idiom), deliberately NOT an `app_settings`
 * column: it describes this phone's last automatic backup, so it needs no
 * migration and never travels in a backup. AsyncStorage is imported lazily so
 * node tests load this module. Content-free: only a timestamp and a count.
 */
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "skipped-photos";

/** "1 photo couldn't be included." / "N photos couldn't be included."; null below 1. */
export function skippedPhotosCopy(count: number): string | null {
  if (!Number.isInteger(count) || count < 1) return null;
  return `${count} photo${count === 1 ? "" : "s"} couldn't be included.`;
}

/**
 * The Restore result line for rows whose backup photo was skipped (D-26 marker)
 * and that this phone had no photo for either (38.6 D-30, review IN2-02). Kept
 * apart from {@link skippedPhotosCopy}, which the safety-backup line keeps, so
 * the two counts never read the same. Null below 1.
 */
export function restoredPhotosMissingCopy(count: number): string | null {
  if (!Number.isInteger(count) || count < 1) return null;
  return count === 1
    ? "1 photo was already missing on this phone and couldn't be restored."
    : `${count} photos were already missing on this phone and couldn't be restored.`;
}

/** Versioned device-local key: the skipped count of the latest automatic backup. */
export const AUTOMATIC_SKIPPED_PHOTOS_KEY = "backup_auto_skipped_photos_v1";

export interface AutomaticSkippedPhotosRecord {
  /** The exact `lastAutomaticBackupAt` string written with this backup. */
  at: string;
  count: number;
}

export interface SkippedPhotosStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const asyncStorage: SkippedPhotosStorage = {
  async getItem(key) {
    const { default: AsyncStorage } = await import(
      "@react-native-async-storage/async-storage"
    );
    return AsyncStorage.getItem(key);
  },
  async setItem(key, value) {
    const { default: AsyncStorage } = await import(
      "@react-native-async-storage/async-storage"
    );
    await AsyncStorage.setItem(key, value);
  },
};

/** Record the latest automatic backup's count. Never rejects. */
export async function recordAutomaticSkippedPhotos(
  record: AutomaticSkippedPhotosRecord,
  storage: SkippedPhotosStorage = asyncStorage,
): Promise<void> {
  try {
    await storage.setItem(
      AUTOMATIC_SKIPPED_PHOTOS_KEY,
      JSON.stringify({ at: record.at, count: record.count }),
    );
  } catch {
    Logger.error(LOG_SCOPE, "automatic skipped-photo record write failed");
  }
}

/** The validated record, or null when absent, malformed or unreadable. */
export async function readAutomaticSkippedPhotos(
  storage: SkippedPhotosStorage = asyncStorage,
): Promise<AutomaticSkippedPhotosRecord | null> {
  try {
    const raw = await storage.getItem(AUTOMATIC_SKIPPED_PHOTOS_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { at, count } = parsed as Record<string, unknown>;
    if (
      typeof at !== "string" ||
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 0
    )
      return null;
    return { at, count };
  } catch {
    return null;
  }
}

/**
 * The health-card line, only when the record belongs to the latest automatic
 * backup (same `lastAutomaticBackupAt`) and left at least one photo out.
 */
export function automaticSkippedPhotosLine(
  record: AutomaticSkippedPhotosRecord | null,
  lastAutomaticBackupAt: string | null,
): string | null {
  if (!record || lastAutomaticBackupAt === null) return null;
  if (record.at !== lastAutomaticBackupAt) return null;
  const copy = skippedPhotosCopy(record.count);
  return copy ? `Last automatic backup: ${copy}` : null;
}
