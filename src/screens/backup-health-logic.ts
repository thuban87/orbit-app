/** Pure, aggregate-only view state for the Backup & Restore landing. */

export interface BackupHealthInput {
  readonly folderUri: string | null;
  readonly folderName: string | null;
  readonly folderAccessible: boolean;
  /** Set only after a verified automatic SAF write. */
  readonly lastAutomaticBackupAt: string | null;
  readonly currentDataRevision: number;
  readonly lastBackupDataRevision: number;
  readonly intervalDays: number;
  readonly automaticFileCount?: number;
}

export type BackupHealth =
  | {
      readonly kind: "not-configured";
      readonly headline: "Backups aren't set up";
      readonly body: "Choose a folder to start protecting your data.";
    }
  | {
      readonly kind: "lost-folder";
      readonly headline: "Backup folder needs reconnecting";
      readonly body: "Orbit can't access your chosen folder. Pick it again to resume automatic backups.";
    }
  | {
      readonly kind: "healthy";
      readonly headline: "Your data is protected";
      readonly folderName: string;
      readonly lastAutomaticBackupAt: string;
      readonly automaticFileCount: number;
    }
  | {
      readonly kind: "stale";
      readonly headline: "Your backup needs attention";
      readonly reason: "no-success" | "changed-data";
      readonly body: string;
      readonly lastAutomaticBackupAt: string | null;
    };

/**
 * A manual share must never satisfy this resolver: only the persisted verified
 * automatic-write timestamp plus an equal current revision can yield healthy.
 */
export function resolveBackupHealth(
  input: BackupHealthInput,
  _now: Date,
): BackupHealth {
  if (!input.folderUri) {
    return {
      kind: "not-configured",
      headline: "Backups aren't set up",
      body: "Choose a folder to start protecting your data.",
    };
  }

  if (!input.folderAccessible) {
    return {
      kind: "lost-folder",
      headline: "Backup folder needs reconnecting",
      body: "Orbit can't access your chosen folder. Pick it again to resume automatic backups.",
    };
  }

  if (!input.lastAutomaticBackupAt) {
    return {
      kind: "stale",
      headline: "Your backup needs attention",
      reason: "no-success",
      body: "No automatic backup has finished yet. Open Orbit again after choosing a folder.",
      lastAutomaticBackupAt: null,
    };
  }

  if (input.currentDataRevision !== input.lastBackupDataRevision) {
    return {
      kind: "stale",
      headline: "Your backup needs attention",
      reason: "changed-data",
      body: "Your data has changed since the last automatic backup.",
      lastAutomaticBackupAt: input.lastAutomaticBackupAt,
    };
  }

  return {
    kind: "healthy",
    headline: "Your data is protected",
    folderName: input.folderName ?? "your backup folder",
    lastAutomaticBackupAt: input.lastAutomaticBackupAt,
    automaticFileCount: input.automaticFileCount ?? 1,
  };
}

export interface BackupNudgeInput {
  readonly hasMeaningfulData: boolean;
  readonly lastAutomaticBackupAt: string | null;
  readonly currentDataRevision: number;
  readonly lastBackupDataRevision: number;
  readonly dismissed: boolean;
}

export interface BackupNudgeState {
  readonly shouldShow: boolean;
  /** Clear a prior dismissal only after the old condition has resolved. */
  readonly shouldResetDismissal: boolean;
}

const NUDGE_STALE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The persisted dismissal is intentionally just a boolean. Reset it when no
 * nudge condition applies, so the next qualifying protection condition can be
 * shown once without turning the row into a permanent dashboard card.
 */
export function resolveBackupNudge(
  input: BackupNudgeInput,
  now: Date,
): BackupNudgeState {
  const changedSinceSuccess =
    input.currentDataRevision !== input.lastBackupDataRevision;
  const lastSuccessMs = input.lastAutomaticBackupAt
    ? Date.parse(input.lastAutomaticBackupAt)
    : Number.NaN;
  const staleLongEnough =
    changedSinceSuccess &&
    Number.isFinite(lastSuccessMs) &&
    now.getTime() - lastSuccessMs >= NUDGE_STALE_MS;
  const condition =
    input.hasMeaningfulData && (!input.lastAutomaticBackupAt || staleLongEnough);

  return {
    shouldShow: condition && !input.dismissed,
    shouldResetDismissal: !condition && input.dismissed,
  };
}
