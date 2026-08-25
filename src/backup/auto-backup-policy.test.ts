import { describe, expect, it } from "vitest";
import { automaticBackupFilename, filesToPrune, isOwnedAutomaticBackup, shouldRunAutomaticBackup } from "@/backup/auto-backup-policy";

const now = new Date("2026-08-25T12:00:00.000Z");

describe("automatic backup policy", () => {
  it("uses revision inequality so a same-second edit is eligible", () => {
    expect(shouldRunAutomaticBackup({ lastAutomaticBackupAt: "2026-08-24T12:00:00.000Z", lastBackupDataRevision: 7, backupIntervalDays: 1, backupRetentionDays: 7 }, 8, now)).toBe(true);
  });

  it("requires both elapsed cadence and changed data", () => {
    const base = { lastAutomaticBackupAt: "2026-08-25T11:00:00.000Z", lastBackupDataRevision: 7, backupIntervalDays: 1, backupRetentionDays: 7 };
    expect(shouldRunAutomaticBackup(base, 8, now)).toBe(false);
    expect(shouldRunAutomaticBackup({ ...base, lastAutomaticBackupAt: "2026-08-24T11:00:00.000Z" }, 7, now)).toBe(false);
  });

  it("owns only strict automatic filenames and protects the newest verified write under clock rollback", () => {
    const older = automaticBackupFilename(new Date("2026-08-01T00:00:00.000Z"));
    const rollback = automaticBackupFilename(new Date("2026-07-01T00:00:00.000Z"));
    expect(isOwnedAutomaticBackup(older)).toBe(true);
    expect(isOwnedAutomaticBackup("orbit-auto-lookalike.json")).toBe(false);
    expect(filesToPrune([{ name: older, verifiedOrder: 1 }, { name: rollback, verifiedOrder: 2 }, { name: "orbit-auto-lookalike.json", verifiedOrder: 3 }], 7, now)).toEqual([older]);
  });
});
