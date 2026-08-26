import { type AppSettingsPatch, assertBackupDays } from "@/db/app-settings-dao";

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
