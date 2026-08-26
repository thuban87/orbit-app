import { describe, expect, it } from "vitest";
import {
  BACKUP_DAYS_VALIDATION_COPY,
  buildBackupSettingsPatch,
  validateEncryptionSetup,
  validateWholeBackupDays,
} from "@/screens/backup-settings-logic";

describe("validateWholeBackupDays — one DAO-owned 1..3650 boundary", () => {
  it("accepts only whole day values that the durable DAO accepts", () => {
    expect(validateWholeBackupDays("1")).toEqual({ value: 1 });
    expect(validateWholeBackupDays("3650")).toEqual({ value: 3650 });
    for (const invalid of ["", "0", "-1", "1.5", "3660", "days"]) {
      expect(validateWholeBackupDays(invalid)).toEqual({
        error: BACKUP_DAYS_VALIDATION_COPY,
      });
    }
  });

  it("keeps invalid fields out of the persistence patch", () => {
    expect(buildBackupSettingsPatch({ intervalDays: "14", retentionDays: "90" }))
      .toEqual({ patch: { backupIntervalDays: 14, backupRetentionDays: 90 } });
    expect(buildBackupSettingsPatch({ intervalDays: "14.5", retentionDays: "90" }))
      .toEqual({
        errors: { intervalDays: BACKUP_DAYS_VALIDATION_COPY },
        patch: null,
      });
  });
});

describe("validateEncryptionSetup — no passphrase echo or unsafe setup", () => {
  it("requires a non-empty matching confirmation before enabling encryption", () => {
    expect(validateEncryptionSetup("", "")).toEqual({
      ok: false,
      error: "Enter a passphrase.",
    });
    expect(validateEncryptionSetup("first", "second")).toEqual({
      ok: false,
      error: "Passphrases don't match.",
    });
    expect(validateEncryptionSetup("a long private passphrase", "a long private passphrase"))
      .toEqual({ ok: true });
  });
});
