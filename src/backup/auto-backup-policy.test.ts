import { describe, expect, it } from "vitest";
import {
  filesToPrune,
  isExpiredAutomaticBackup,
  shouldRunAutomaticBackup,
} from "@/backup/auto-backup-policy";
import {
  automaticBackupFileName,
  isOwnedAutomaticBackupName,
} from "@/backup/backup-file-names";

const now = new Date("2026-08-25T12:00:00.000Z");

describe("automatic backup policy", () => {
  it("uses revision inequality so a same-second edit is eligible", () => {
    expect(
      shouldRunAutomaticBackup(
        {
          lastAutomaticBackupAt: "2026-08-24T12:00:00.000Z",
          lastBackupDataRevision: 7,
          backupIntervalDays: 1,
          backupRetentionDays: 7,
        },
        8,
        now,
      ),
    ).toBe(true);
  });

  it("requires both elapsed cadence and changed data", () => {
    const base = {
      lastAutomaticBackupAt: "2026-08-25T11:00:00.000Z",
      lastBackupDataRevision: 7,
      backupIntervalDays: 1,
      backupRetentionDays: 7,
    };
    expect(shouldRunAutomaticBackup(base, 8, now)).toBe(false);
    expect(
      shouldRunAutomaticBackup(
        { ...base, lastAutomaticBackupAt: "2026-08-24T11:00:00.000Z" },
        7,
        now,
      ),
    ).toBe(false);
  });

  it("owns only strict automatic filenames and protects the newest verified write under clock rollback", () => {
    const older = automaticBackupFileName(new Date("2026-08-01T00:00:00.000Z"));
    const rollback = automaticBackupFileName(
      new Date("2026-07-01T00:00:00.000Z"),
    );
    expect(isOwnedAutomaticBackupName(older)).toBe(true);
    expect(isOwnedAutomaticBackupName("orbit-auto-lookalike.json")).toBe(false);
    expect(
      filesToPrune(
        [
          { name: older, verifiedOrder: 1 },
          { name: rollback, verifiedOrder: 2 },
          { name: "orbit-auto-lookalike.json", verifiedOrder: 3 },
        ],
        7,
        now,
      ),
    ).toEqual([older]);
  });

  // 38.12 D-116 / D-136: old UTC names keep pruning and expiring; a manual
  // export saved in the backup folder never does.
  it("prunes and expires old and new automatic names, never a manual export", () => {
    const oldName = "orbit-auto-2026-08-01T00-00-00-000Z.json";
    const newName = "orbit-auto-2026-08-02-0930.json";
    const suffixed = "orbit-auto-2026-08-02-0930-2.json";
    const manual = "orbit-backup-2026-08-01-0930.json";
    const legacyManual = `orbit-backup-${Date.parse("2026-08-01T00:00:00.000Z")}.json`;
    const newest = "orbit-auto-2026-08-25-1100.json";
    expect(
      filesToPrune(
        [
          { name: oldName, verifiedOrder: 1 },
          { name: newName, verifiedOrder: 2 },
          { name: suffixed, verifiedOrder: 3 },
          { name: manual, verifiedOrder: 4 },
          { name: legacyManual, verifiedOrder: 5 },
          { name: newest, verifiedOrder: 6 },
        ],
        7,
        now,
      ),
    ).toEqual([oldName, newName, suffixed]);
    for (const name of [oldName, newName, suffixed])
      expect(isExpiredAutomaticBackup(name, 7, now)).toBe(true);
    for (const name of [manual, legacyManual, newest])
      expect(isExpiredAutomaticBackup(name, 7, now)).toBe(false);
  });
});
