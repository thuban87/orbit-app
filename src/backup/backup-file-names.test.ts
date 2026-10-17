import { afterEach, describe, expect, it } from "vitest";
import {
  AUTOMATIC_BACKUP_PREFIX,
  automaticBackupFileName,
  backupNameTimestampMs,
  isOwnedAutomaticBackupName,
  isStagedManualExportName,
  MANUAL_BACKUP_PREFIX,
  manualBackupFileName,
  uniqueBackupFileName,
} from "@/backup/backup-file-names";

// 38.12 D-116 / D-136: readable local names, old names still recognised, and
// the automatic prefix never matches a manual export.
describe("backup file names", () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  it("keeps automatic and manual exports on distinct prefixes", () => {
    expect(AUTOMATIC_BACKUP_PREFIX).toBe("orbit-auto-");
    expect(MANUAL_BACKUP_PREFIX).toBe("orbit-backup-");
  });

  it("builds names from the local clock, zero-padded", () => {
    const now = new Date(2026, 9, 7, 9, 5, 42, 123);
    expect(manualBackupFileName(now)).toBe("orbit-backup-2026-10-07-0905.json");
    expect(automaticBackupFileName(now)).toBe(
      "orbit-auto-2026-10-07-0905.json",
    );
  });

  it("uses local time, not UTC, in the evening of a non-UTC zone", () => {
    process.env.TZ = "America/New_York";
    // 02:30 UTC on the 17th is 22:30 on the 16th in New York (EDT).
    const now = new Date("2026-10-17T02:30:00.000Z");
    expect(manualBackupFileName(now)).toBe("orbit-backup-2026-10-16-2230.json");
    expect(automaticBackupFileName(now)).toBe(
      "orbit-auto-2026-10-16-2230.json",
    );
    expect(backupNameTimestampMs(automaticBackupFileName(now))).toBe(
      now.getTime(),
    );
  });

  it("suffixes names that collide within one run", () => {
    const base = "orbit-auto-2026-10-17-0930.json";
    expect(uniqueBackupFileName(base, new Set())).toBe(base);
    const taken = new Set([base]);
    const second = uniqueBackupFileName(base, taken);
    expect(second).toBe("orbit-auto-2026-10-17-0930-2.json");
    taken.add(second);
    const third = uniqueBackupFileName(base, taken);
    expect(third).toBe("orbit-auto-2026-10-17-0930-3.json");
    for (const name of [second, third])
      expect(isOwnedAutomaticBackupName(name)).toBe(true);
    expect(
      isStagedManualExportName(
        uniqueBackupFileName(
          "orbit-backup-2026-10-17-0930.json",
          new Set(["orbit-backup-2026-10-17-0930.json"]),
        ),
      ),
    ).toBe(true);
  });

  it("owns old UTC and new local automatic names, never a manual export", () => {
    for (const name of [
      "orbit-auto-2026-08-24T00-00-00-000Z.json",
      "orbit-auto-2026-10-17-0930.json",
      "orbit-auto-2026-10-17-0930-12.json",
    ])
      expect(isOwnedAutomaticBackupName(name)).toBe(true);
    for (const name of [
      "orbit-backup-2026-10-17-0930.json",
      "orbit-backup-1760000000000.json",
      "orbit-auto-lookalike.json",
      "orbit-auto-2026-10-17-0930 (1).json",
      "orbit-auto-2026-10-17-093.json",
      "orbit-auto-2026-10-17-0930.json.bak",
      "notes.json",
    ])
      expect(isOwnedAutomaticBackupName(name)).toBe(false);
  });

  it("recognises old epoch and new local staged exports, never an automatic name", () => {
    for (const name of [
      "orbit-backup-1760000000000.json",
      "orbit-backup-2026-10-17-0930.json",
      "orbit-backup-2026-10-17-0930-2.json",
    ])
      expect(isStagedManualExportName(name)).toBe(true);
    for (const name of [
      "orbit-auto-2026-10-17-0930.json",
      "orbit-auto-2026-08-24T00-00-00-000Z.json",
      "orbit-backup-invalid.json",
      "orbit-backup-.json",
      "other-file.json",
    ])
      expect(isStagedManualExportName(name)).toBe(false);
  });

  it("reads the write time from all four name shapes", () => {
    expect(
      backupNameTimestampMs("orbit-auto-2026-08-24T01-02-03-004Z.json"),
    ).toBe(Date.parse("2026-08-24T01:02:03.004Z"));
    expect(backupNameTimestampMs("orbit-backup-1760000000000.json")).toBe(
      1760000000000,
    );
    expect(backupNameTimestampMs("orbit-auto-2026-10-17-0930-2.json")).toBe(
      new Date(2026, 9, 17, 9, 30).getTime(),
    );
    expect(backupNameTimestampMs("orbit-backup-2026-10-17-2359.json")).toBe(
      new Date(2026, 9, 17, 23, 59).getTime(),
    );
  });

  it("returns null for unknown or impossible names", () => {
    for (const name of [
      "orbit-auto-lookalike.json",
      "orbit-auto-2026-13-01-0930.json",
      "orbit-backup-2026-10-17-2460.json",
      "orbit-auto-2026-02-01Txx-00-00-000Z.json",
      "unrelated.json",
    ])
      expect(backupNameTimestampMs(name)).toBeNull();
  });
});
