import { describe, expect, it } from "vitest";
import {
  isExpiredAutomaticBackup,
  shouldRunAutomaticBackup,
} from "@/backup/auto-backup-policy";
import {
  automaticBackupFileName,
  isOwnedAutomaticBackupName,
} from "@/backup/backup-file-names";

const now = new Date("2026-08-25T12:00:00.000Z");

describe("automatic backup policy", () => {
  it("reads backup-now's local wall-clock stamp, not through Date.parse (D-IN-11)", () => {
    const local = new Date(2026, 7, 25, 12, 0, 0);
    const meta = (lastAutomaticBackupAt: string) => ({
      lastAutomaticBackupAt,
      lastBackupDataRevision: 7,
      backupIntervalDays: 1,
      backupRetentionDays: 7,
    });
    // 23 hours ago, local: not yet due.
    expect(
      shouldRunAutomaticBackup(meta("2026-08-24 13:00:00"), 8, local),
    ).toBe(false);
    // A full day ago, local: due.
    expect(
      shouldRunAutomaticBackup(meta("2026-08-24 12:00:00"), 8, local),
    ).toBe(true);
    // An unreadable stamp still runs the backup (fail-open, unchanged).
    expect(shouldRunAutomaticBackup(meta("garbage"), 8, local)).toBe(true);
  });

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

  // The newest-verified-write protection under clock rollback lives in the
  // live pruner (backup-service: the just-written file is protected by
  // identity); the unused `filesToPrune` helper was removed (38.12 A-IN-03).
  it("owns only strict automatic filenames", () => {
    const older = automaticBackupFileName(new Date("2026-08-01T00:00:00.000Z"));
    expect(isOwnedAutomaticBackupName(older)).toBe(true);
    expect(isOwnedAutomaticBackupName("orbit-auto-lookalike.json")).toBe(false);
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
    for (const name of [oldName, newName, suffixed])
      expect(isExpiredAutomaticBackup(name, 7, now)).toBe(true);
    for (const name of [manual, legacyManual, newest])
      expect(isExpiredAutomaticBackup(name, 7, now)).toBe(false);
  });
});
