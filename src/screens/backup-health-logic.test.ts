import { describe, expect, it } from "vitest";
import {
  resolveBackupHealth,
  resolveBackupNudge,
} from "@/screens/backup-health-logic";

const now = new Date("2026-08-25T12:00:00.000Z");

describe("resolveBackupHealth — verified automatic protection only", () => {
  it("keeps a missing destination distinct from an inaccessible saved folder", () => {
    expect(resolveBackupHealth({
      folderUri: null,
      folderName: null,
      folderAccessible: false,
      lastAutomaticBackupAt: null,
      currentDataRevision: 4,
      lastBackupDataRevision: 0,
      intervalDays: 7,
    }, now).kind).toBe("not-configured");

    expect(resolveBackupHealth({
      folderUri: "content://provider/tree/lost",
      folderName: "Orbit backups",
      folderAccessible: false,
      lastAutomaticBackupAt: "2026-08-01T10:00:00.000Z",
      currentDataRevision: 4,
      lastBackupDataRevision: 4,
      intervalDays: 7,
    }, now).kind).toBe("lost-folder");
  });

  it("reports healthy only when a verified automatic write represents current data", () => {
    const health = resolveBackupHealth({
      folderUri: "content://provider/tree/backup",
      folderName: "Orbit backups",
      folderAccessible: true,
      lastAutomaticBackupAt: "2026-08-25T10:00:00.000Z",
      currentDataRevision: 8,
      lastBackupDataRevision: 8,
      intervalDays: 7,
      automaticFileCount: 1,
    }, now);

    expect(health).toMatchObject({
      kind: "healthy",
      headline: "Your data is protected",
      folderName: "Orbit backups",
      automaticFileCount: 1,
    });
  });

  it("never promotes a folder with no successful automatic write or changed data to healthy", () => {
    expect(resolveBackupHealth({
      folderUri: "content://provider/tree/backup",
      folderName: "Orbit backups",
      folderAccessible: true,
      lastAutomaticBackupAt: null,
      currentDataRevision: 8,
      lastBackupDataRevision: 0,
      intervalDays: 7,
    }, now)).toMatchObject({ kind: "stale", reason: "no-success" });

    expect(resolveBackupHealth({
      folderUri: "content://provider/tree/backup",
      folderName: "Orbit backups",
      folderAccessible: true,
      lastAutomaticBackupAt: "2026-08-20T10:00:00.000Z",
      currentDataRevision: 9,
      lastBackupDataRevision: 8,
      intervalDays: 7,
    }, now)).toMatchObject({ kind: "stale", reason: "changed-data" });
  });
});

describe("resolveBackupNudge — rare meaningful-data prompt", () => {
  it("never nudges an empty installation and resets dismissal after its condition clears", () => {
    expect(resolveBackupNudge({
      hasMeaningfulData: false,
      lastAutomaticBackupAt: null,
      currentDataRevision: 1,
      lastBackupDataRevision: 0,
      dismissed: false,
    }, now)).toEqual({ shouldShow: false, shouldResetDismissal: false });

    expect(resolveBackupNudge({
      hasMeaningfulData: true,
      lastAutomaticBackupAt: "2026-08-25T10:00:00.000Z",
      currentDataRevision: 8,
      lastBackupDataRevision: 8,
      dismissed: true,
    }, now)).toEqual({ shouldShow: false, shouldResetDismissal: true });
  });

  it("shows only for missing success or data stale at least fourteen days", () => {
    expect(resolveBackupNudge({
      hasMeaningfulData: true,
      lastAutomaticBackupAt: null,
      currentDataRevision: 3,
      lastBackupDataRevision: 0,
      dismissed: false,
    }, now).shouldShow).toBe(true);

    expect(resolveBackupNudge({
      hasMeaningfulData: true,
      lastAutomaticBackupAt: "2026-08-11T12:00:00.000Z",
      currentDataRevision: 4,
      lastBackupDataRevision: 3,
      dismissed: false,
    }, now).shouldShow).toBe(true);

    expect(resolveBackupNudge({
      hasMeaningfulData: true,
      lastAutomaticBackupAt: "2026-08-20T12:00:00.000Z",
      currentDataRevision: 4,
      lastBackupDataRevision: 3,
      dismissed: false,
    }, now).shouldShow).toBe(false);
  });
});
