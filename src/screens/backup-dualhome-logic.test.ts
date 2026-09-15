import { describe, expect, it } from "vitest";
import {
  type BackupHost,
  backupAppBarVariant,
  DEFAULT_BACKUP_HOST,
  restoreReturnRouteName,
  shouldConsumeSharedBackup,
} from "./backup-dualhome-logic";

const ALL_HOSTS: readonly BackupHost[] = ["backup-tab", "settings"];

describe("backup dual-home host helpers (D-08 / §I)", () => {
  describe("DEFAULT_BACKUP_HOST", () => {
    it("is fail-closed to the shipped Backup-tab behaviour", () => {
      // An un-anticipated host-less mount must preserve the shipped
      // single-consumer / reset-to-Backup behaviour (review cycle-1 CONTESTED).
      expect(DEFAULT_BACKUP_HOST).toBe("backup-tab");
    });
  });

  describe("restoreReturnRouteName", () => {
    it("resets to Backup for the tab host (UNCHANGED shipped behaviour)", () => {
      expect(restoreReturnRouteName("backup-tab")).toBe("Backup");
    });

    it("returns to the Settings hub for the settings host", () => {
      expect(restoreReturnRouteName("settings")).toBe("Settings");
    });

    it("defaults (via DEFAULT_BACKUP_HOST) to resetting to Backup", () => {
      expect(restoreReturnRouteName(DEFAULT_BACKUP_HOST)).toBe("Backup");
    });
  });

  describe("shouldConsumeSharedBackup", () => {
    it("drains the native shared-backup singleton only for the tab host", () => {
      expect(shouldConsumeSharedBackup("backup-tab")).toBe(true);
    });

    it("never drains it for the settings host (no double-drain)", () => {
      expect(shouldConsumeSharedBackup("settings")).toBe(false);
    });

    it("consumes the singleton exactly once across the two mounts (single-drain-per-host)", () => {
      const consumers = ALL_HOSTS.filter((host) =>
        shouldConsumeSharedBackup(host),
      );
      expect(consumers).toEqual(["backup-tab"]);
      expect(consumers).toHaveLength(1);
    });
  });

  describe("backupAppBarVariant", () => {
    it("gives the Settings-hosted copy a Back affordance (variant=child)", () => {
      expect(backupAppBarVariant("settings")).toBe("child");
    });

    it("keeps the Backup-tab root title-only (variant=root, UNCHANGED)", () => {
      expect(backupAppBarVariant("backup-tab")).toBe("root");
    });
  });
});
