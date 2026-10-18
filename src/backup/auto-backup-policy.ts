import {
  backupNameTimestampMs,
  isOwnedAutomaticBackupName,
} from "@/backup/backup-file-names";
import { parseStampMsOrNaN } from "@/utils/dates";

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
  // A local "YYYY-MM-DD HH:MM:SS" stamp (backup-now's `localDateTime`); never
  // `Date.parse`, which engines read differently (38.12 D-IN-11).
  const previous = parseStampMsOrNaN(metadata.lastAutomaticBackupAt);
  return (
    !Number.isFinite(previous) ||
    now.getTime() - previous >= metadata.backupIntervalDays * 86_400_000
  );
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
