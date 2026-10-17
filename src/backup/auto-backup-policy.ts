import {
  backupNameTimestampMs,
  isOwnedAutomaticBackupName,
} from "@/backup/backup-file-names";

/** Names are built and recognised in `backup-file-names.ts` (38.12 D-116, D-136). */
export { AUTOMATIC_BACKUP_PREFIX } from "@/backup/backup-file-names";

export interface AutomaticBackupMetadata {
  lastAutomaticBackupAt: string | null;
  lastBackupDataRevision: number;
  backupIntervalDays: number;
  backupRetentionDays: number;
}

export function shouldRunAutomaticBackup(
  metadata: AutomaticBackupMetadata,
  currentRevision: number,
  now: Date,
): boolean {
  if (currentRevision === metadata.lastBackupDataRevision) return false;
  if (!metadata.lastAutomaticBackupAt) return true;
  const previous = Date.parse(metadata.lastAutomaticBackupAt);
  return (
    !Number.isFinite(previous) ||
    now.getTime() - previous >= metadata.backupIntervalDays * 86_400_000
  );
}

/** Keep the newest verified snapshot even when the clock moves backwards. */
export function filesToPrune(
  files: Array<{ name: string; verifiedOrder: number }>,
  keepDays: number,
  now: Date,
): string[] {
  const owned = files.filter((file) => isOwnedAutomaticBackupName(file.name));
  if (owned.length <= 1) return [];
  const newest = owned.reduce((a, b) =>
    a.verifiedOrder >= b.verifiedOrder ? a : b,
  );
  const cutoff = now.getTime() - keepDays * 86_400_000;
  return owned
    .filter((file) => file.name !== newest.name)
    .filter((file) => (backupNameTimestampMs(file.name) ?? Number.NaN) < cutoff)
    .map((file) => file.name);
}

/** Filename-only retention for files older than the configured window. */
export function isExpiredAutomaticBackup(
  name: string,
  keepDays: number,
  now: Date,
): boolean {
  if (!isOwnedAutomaticBackupName(name)) return false;
  const timestamp = backupNameTimestampMs(name);
  return (
    timestamp !== null && timestamp < now.getTime() - keepDays * 86_400_000
  );
}
