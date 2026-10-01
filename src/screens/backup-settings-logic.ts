import {
  type AppSettings,
  type AppSettingsPatch,
  assertBackupDays,
} from "@/db/app-settings-dao";
import type { ReadPhase } from "@/logic/read-phase";

export const BACKUP_DAYS_VALIDATION_COPY =
  "Enter a whole number from 1 to 3650 days.";

export type WholeBackupDaysResult =
  | { readonly value: number }
  | { readonly error: typeof BACKUP_DAYS_VALIDATION_COPY };

/** Parse without coercion, then defer the authoritative range check to the DAO. */
export function validateWholeBackupDays(raw: string): WholeBackupDaysResult {
  if (!/^[0-9]+$/.test(raw)) {
    return { error: BACKUP_DAYS_VALIDATION_COPY };
  }
  const value = Number(raw);
  try {
    assertBackupDays("backup days", value);
    return { value };
  } catch {
    return { error: BACKUP_DAYS_VALIDATION_COPY };
  }
}

export interface BackupSettingsFormInput {
  readonly intervalDays: string;
  readonly retentionDays: string;
}

export type BackupSettingsPatchResult =
  | {
      readonly patch: Pick<
        AppSettingsPatch,
        "backupIntervalDays" | "backupRetentionDays"
      >;
    }
  | {
      readonly patch: null;
      readonly errors: Partial<
        Record<
          keyof BackupSettingsFormInput,
          typeof BACKUP_DAYS_VALIDATION_COPY
        >
      >;
    };

/** Invalid raw text remains in the controlled input and never reaches SQLite. */
export function buildBackupSettingsPatch(
  input: BackupSettingsFormInput,
): BackupSettingsPatchResult {
  const interval = validateWholeBackupDays(input.intervalDays);
  const retention = validateWholeBackupDays(input.retentionDays);
  if ("error" in interval || "error" in retention) {
    return {
      patch: null,
      errors: {
        ...("error" in interval ? { intervalDays: interval.error } : {}),
        ...("error" in retention ? { retentionDays: retention.error } : {}),
      },
    };
  }
  return {
    patch: {
      backupIntervalDays: interval.value,
      backupRetentionDays: retention.value,
    },
  };
}

export type EncryptionSetupResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: "Enter a passphrase." | "Passphrases don't match.";
    };

/** Never return a passphrase; this is validation-only view state. */
export function validateEncryptionSetup(
  passphrase: string,
  confirmation: string,
): EncryptionSetupResult {
  if (!passphrase) return { ok: false, error: "Enter a passphrase." };
  if (passphrase !== confirmation) {
    return { ok: false, error: "Passphrases don't match." };
  }
  return { ok: true };
}

/**
 * 38.6 D-39 (review WR5-03): the copy for an over-cap source during a
 * re-encrypting passphrase change. Same tone as the other "too large" copy.
 */
export const REENCRYPTION_TOO_LARGE_COPY =
  "An automatic backup in your folder is too large to re-encrypt, so your passphrase wasn't changed. You can still use the new passphrase for future backups only.";

/** The inline error for a passphrase change that didn't finish. */
export function encryptionErrorCopy(status: string): string {
  if (status === "wrong-current-passphrase")
    return "That passphrase doesn't match your current backup protection.";
  if (status === "too-large") return REENCRYPTION_TOO_LARGE_COPY;
  return "Orbit couldn't safely re-encrypt every accessible automatic backup. Reconnect the folder and try again.";
}

export interface BackupSettingsPresentation {
  /** Render the folder and encryption groups at all. */
  readonly showGroups: boolean;
  /** Null while settings are unknown — never a default "off" (D-24). */
  readonly encryptionSummary: "on" | "off" | null;
  readonly folderConfigured: boolean;
  readonly folderAccessible: boolean;
}

/**
 * Which backup-settings state the screen may present (38.3 RG-035, D-24).
 * Everything is hidden/false/null unless the settings read has succeeded: an
 * unread or unreadable settings row must never render as "Off — backups are
 * readable JSON", a folder state, or the passphrase-setup flow, because the
 * user decides whether backups need protection from what this screen claims.
 * Presentation only — encryption itself is untouched.
 */
export function backupSettingsPresentation(
  phase: ReadPhase<AppSettings>,
): BackupSettingsPresentation {
  if (phase.phase !== "loaded") {
    return {
      showGroups: false,
      encryptionSummary: null,
      folderConfigured: false,
      folderAccessible: false,
    };
  }
  const settings = phase.data;
  return {
    showGroups: true,
    encryptionSummary: settings.encryptionEnabled === 1 ? "on" : "off",
    folderConfigured:
      settings.backupFolderUri !== null &&
      settings.backupFolderUri !== undefined,
    folderAccessible: settings.backupFolderAccessible === 1,
  };
}

export type CommitThenRefreshOutcome =
  | "committed"
  | "nothing-committed"
  | "commit-failed";

export interface CommitThenRefreshSteps {
  /** The write. Resolve `false` when nothing was written (e.g. picker cancelled). */
  readonly commit: () => Promise<boolean>;
  /** The post-write re-read; MUST never reject (use `runGatedRead`). */
  readonly refresh: () => Promise<void>;
  /** Report a failed WRITE (Alert / inline error). Never sees a re-read failure. */
  readonly onCommitFailed: (error: unknown) => void;
}

/**
 * Commit, then await the re-read (38.3 D-04). The re-read sits OUTSIDE the
 * write's catch, so a failed re-read after a committed write can only surface
 * as the read-error state — it is never reported as a failed write and the
 * write is never retried. The handler resolves only after the re-read settles.
 */
export async function commitThenRefresh(
  steps: CommitThenRefreshSteps,
): Promise<CommitThenRefreshOutcome> {
  let wrote: boolean;
  try {
    wrote = await steps.commit();
  } catch (error) {
    steps.onCommitFailed(error);
    return "commit-failed";
  }
  if (!wrote) return "nothing-committed";
  await steps.refresh();
  return "committed";
}
