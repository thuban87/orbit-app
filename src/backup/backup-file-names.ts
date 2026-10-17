/**
 * Every backup file name Orbit writes or recognises (38.12 D-116, D-136).
 *
 * New names are readable local wall-clock stamps built with the
 * `formatLocalDate` family (CLAUDE.md Conventions), never a UTC ISO string:
 *   manual export     orbit-backup-2026-10-17-0930.json
 *   automatic backup  orbit-auto-2026-10-17-0930.json
 * A name that collides within one run takes a numeric suffix (`-2`, `-3` …).
 *
 * Old names stay recognised forever, because they persist in users' backup
 * folders and staging directory:
 *   manual export     orbit-backup-<epoch ms>.json
 *   automatic backup  orbit-auto-<UTC ISO, ":" and "." as "-">.json
 *
 * Automatic backups keep their own prefix (D-136): pruning and re-encryption
 * match only `orbit-auto-`, so a manual export the user saved into the backup
 * folder is never deleted or rewritten.
 *
 * The native share guard (`OrbitBackupShareModule.kt` STAGED_NAME) mirrors
 * `isStagedManualExportName` exactly; change both together.
 */
import { formatLocalDate, parseLocalMs } from "@/utils/dates";

export const AUTOMATIC_BACKUP_PREFIX = "orbit-auto-";
export const MANUAL_BACKUP_PREFIX = "orbit-backup-";

/** orbit-auto-YYYY-MM-DD-HHMM[-N].json (local time). */
const NEW_AUTOMATIC =
  /^orbit-auto-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})(?:-\d+)?\.json$/;
/** orbit-auto-YYYY-MM-DDTHH-MM-SS-mmmZ.json (UTC, pre-38.12). */
const OLD_AUTOMATIC =
  /^orbit-auto-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/;
/** orbit-backup-YYYY-MM-DD-HHMM[-N].json (local time). */
const NEW_MANUAL =
  /^orbit-backup-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})(?:-\d+)?\.json$/;
/** orbit-backup-<epoch ms>.json (pre-38.12). */
const OLD_MANUAL = /^orbit-backup-(\d+)\.json$/;

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** Local `YYYY-MM-DD-HHMM` for a backup name. */
export function localStamp(now: Date): string {
  return `${formatLocalDate(now)}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
}

export function manualBackupFileName(now: Date): string {
  return `${MANUAL_BACKUP_PREFIX}${localStamp(now)}.json`;
}

export function automaticBackupFileName(now: Date): string {
  return `${AUTOMATIC_BACKUP_PREFIX}${localStamp(now)}.json`;
}

/**
 * `base` when no existing or already-written name takes it, else the first
 * free `-2`, `-3` … inserted before ".json" (D-136). Callers add the returned
 * name to `taken` when they write more than one file in a run.
 */
export function uniqueBackupFileName(
  base: string,
  taken: ReadonlySet<string>,
): string {
  if (!taken.has(base)) return base;
  const stem = base.endsWith(".json") ? base.slice(0, -".json".length) : base;
  const extension = base.endsWith(".json") ? ".json" : "";
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${stem}-${suffix}${extension}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Old UTC and new local automatic names; never a manual `orbit-backup-` name. */
export function isOwnedAutomaticBackupName(name: string): boolean {
  return NEW_AUTOMATIC.test(name) || OLD_AUTOMATIC.test(name);
}

/** Old epoch-ms and new local manual export names in the staging directory. */
export function isStagedManualExportName(name: string): boolean {
  return NEW_MANUAL.test(name) || OLD_MANUAL.test(name);
}

function localNameMs(stamp: string): number {
  try {
    return parseLocalMs(stamp);
  } catch {
    return Number.NaN;
  }
}

/**
 * When the file was written, from its name: new names as LOCAL time, old
 * automatic names as their UTC stamp, old manual names as their epoch ms.
 * `null` for an unknown or impossible name. A local name repeats an hour on
 * DST fall-back day; retention compares ages in days, so that skew is harmless.
 */
export function backupNameTimestampMs(name: string): number | null {
  let ms = Number.NaN;
  const newMatch = NEW_AUTOMATIC.exec(name) ?? NEW_MANUAL.exec(name);
  const oldAutomatic = OLD_AUTOMATIC.exec(name);
  const oldManual = OLD_MANUAL.exec(name);
  if (newMatch) {
    const [, date, hours, minutes] = newMatch;
    ms = localNameMs(`${date} ${hours}:${minutes}`);
  } else if (oldAutomatic) {
    const [, date, hours, minutes, seconds, millis] = oldAutomatic;
    ms = Date.parse(`${date}T${hours}:${minutes}:${seconds}.${millis}Z`);
  } else if (oldManual) {
    ms = Number(oldManual[1]);
  }
  return Number.isFinite(ms) ? ms : null;
}
