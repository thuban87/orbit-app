export const AUTOMATIC_BACKUP_PREFIX = "orbit-auto-";

export interface AutomaticBackupMetadata {
  lastAutomaticBackupAt: string | null;
  lastBackupDataRevision: number;
  backupIntervalDays: number;
  backupRetentionDays: number;
}

export function automaticBackupFilename(now: Date): string {
  return `${AUTOMATIC_BACKUP_PREFIX}${now.toISOString().replace(/[:.]/g, "-")}.json`;
}

export function isOwnedAutomaticBackup(name: string): boolean {
  return new RegExp(`^${AUTOMATIC_BACKUP_PREFIX}\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z\\.json$`).test(name);
}

export function shouldRunAutomaticBackup(
  metadata: AutomaticBackupMetadata,
  currentRevision: number,
  now: Date,
): boolean {
  if (currentRevision === metadata.lastBackupDataRevision) return false;
  if (!metadata.lastAutomaticBackupAt) return true;
  const previous = Date.parse(metadata.lastAutomaticBackupAt);
  return !Number.isFinite(previous) || now.getTime() - previous >= metadata.backupIntervalDays * 86_400_000;
}

/** Keep the newest verified snapshot even when the clock moves backwards. */
export function filesToPrune(
  files: Array<{ name: string; verifiedOrder: number }>,
  keepDays: number,
  now: Date,
): string[] {
  const owned = files.filter((file) => isOwnedAutomaticBackup(file.name));
  if (owned.length <= 1) return [];
  const newest = owned.reduce((a, b) => a.verifiedOrder >= b.verifiedOrder ? a : b);
  const cutoff = now.getTime() - keepDays * 86_400_000;
  const timestamp = (name: string): number => {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/.exec(name.slice(AUTOMATIC_BACKUP_PREFIX.length));
    return match ? Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`) : Number.NaN;
  };
  return owned
    .filter((file) => file.name !== newest.name)
    .filter((file) => timestamp(file.name) < cutoff)
    .map((file) => file.name);
}

/** Filename-only retention for files older than the configured window. */
export function isExpiredAutomaticBackup(name: string, keepDays: number, now: Date): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/.exec(name.slice(AUTOMATIC_BACKUP_PREFIX.length));
  if (!match) return false;
  const timestamp = Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`);
  return Number.isFinite(timestamp) && timestamp < now.getTime() - keepDays * 86_400_000;
}
