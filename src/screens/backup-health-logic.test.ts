import { describe, expect, it } from "vitest";
import {
  MANUAL_EXPORT_TOO_LARGE_COPY,
  manualExportFailureCopy,
  resolveBackupHealth,
  resolveBackupNudge,
} from "@/screens/backup-health-logic";
import { AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC } from "@/services/backup/backup-service";

const now = new Date("2026-08-25T12:00:00.000Z");

describe("resolveBackupHealth — verified automatic protection only", () => {
  it("keeps a missing destination distinct from an inaccessible saved folder", () => {
    expect(
      resolveBackupHealth(
        {
          folderUri: null,
          folderName: null,
          folderAccessible: false,
          lastAutomaticBackupAt: null,
          currentDataRevision: 4,
          lastBackupDataRevision: 0,
          intervalDays: 7,
        },
        now,
      ).kind,
    ).toBe("not-configured");

    expect(
      resolveBackupHealth(
        {
          folderUri: "content://provider/tree/lost",
          folderName: "Orbit backups",
          folderAccessible: false,
          lastAutomaticBackupAt: "2026-08-01T10:00:00.000Z",
          currentDataRevision: 4,
          lastBackupDataRevision: 4,
          intervalDays: 7,
        },
        now,
      ).kind,
    ).toBe("lost-folder");
  });

  it("reports healthy only when a verified automatic write represents current data", () => {
    const health = resolveBackupHealth(
      {
        folderUri: "content://provider/tree/backup",
        folderName: "Orbit backups",
        folderAccessible: true,
        lastAutomaticBackupAt: "2026-08-25T10:00:00.000Z",
        currentDataRevision: 8,
        lastBackupDataRevision: 8,
        intervalDays: 7,
        automaticFileCount: 1,
      },
      now,
    );

    expect(health).toMatchObject({
      kind: "healthy",
      headline: "Your data is protected",
      folderName: "Orbit backups",
      automaticFileCount: 1,
    });
  });

  it("never promotes a folder with no successful automatic write or changed data to healthy", () => {
    expect(
      resolveBackupHealth(
        {
          folderUri: "content://provider/tree/backup",
          folderName: "Orbit backups",
          folderAccessible: true,
          lastAutomaticBackupAt: null,
          currentDataRevision: 8,
          lastBackupDataRevision: 0,
          intervalDays: 7,
        },
        now,
      ),
    ).toMatchObject({ kind: "stale", reason: "no-success" });

    expect(
      resolveBackupHealth(
        {
          folderUri: "content://provider/tree/backup",
          folderName: "Orbit backups",
          folderAccessible: true,
          lastAutomaticBackupAt: "2026-08-20T10:00:00.000Z",
          currentDataRevision: 9,
          lastBackupDataRevision: 8,
          intervalDays: 7,
        },
        now,
      ),
    ).toMatchObject({ kind: "stale", reason: "changed-data" });
  });
});

describe("resolveBackupNudge — rare meaningful-data prompt", () => {
  it("never nudges an empty installation and resets dismissal after its condition clears", () => {
    expect(
      resolveBackupNudge(
        {
          hasMeaningfulData: false,
          lastAutomaticBackupAt: null,
          currentDataRevision: 1,
          lastBackupDataRevision: 0,
          dismissed: false,
        },
        now,
      ),
    ).toEqual({ shouldShow: false, shouldResetDismissal: false });

    expect(
      resolveBackupNudge(
        {
          hasMeaningfulData: true,
          lastAutomaticBackupAt: "2026-08-25T10:00:00.000Z",
          currentDataRevision: 8,
          lastBackupDataRevision: 8,
          dismissed: true,
        },
        now,
      ),
    ).toEqual({ shouldShow: false, shouldResetDismissal: true });
  });

  it("shows only for missing success or data stale at least fourteen days", () => {
    expect(
      resolveBackupNudge(
        {
          hasMeaningfulData: true,
          lastAutomaticBackupAt: null,
          currentDataRevision: 3,
          lastBackupDataRevision: 0,
          dismissed: false,
        },
        now,
      ).shouldShow,
    ).toBe(true);

    expect(
      resolveBackupNudge(
        {
          hasMeaningfulData: true,
          lastAutomaticBackupAt: "2026-08-11T12:00:00.000Z",
          currentDataRevision: 4,
          lastBackupDataRevision: 3,
          dismissed: false,
        },
        now,
      ).shouldShow,
    ).toBe(true);

    expect(
      resolveBackupNudge(
        {
          hasMeaningfulData: true,
          lastAutomaticBackupAt: "2026-08-20T12:00:00.000Z",
          currentDataRevision: 4,
          lastBackupDataRevision: 3,
          dismissed: false,
        },
        now,
      ).shouldShow,
    ).toBe(false);
  });
});

describe("over-cap backups say too large (38.6 D-39)", () => {
  const base = {
    folderUri: "content://provider/tree/orbit",
    folderName: "Orbit backups",
    folderAccessible: true,
    lastAutomaticBackupAt: "2026-08-20 12:00:00",
    currentDataRevision: 5,
    lastBackupDataRevision: 4,
    intervalDays: 7,
  };

  it("the health card says the backup is too large, not that the folder needs reconnecting", () => {
    expect(
      resolveBackupHealth(
        { ...base, folderDiagnostic: AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC },
        now,
      ),
    ).toEqual({
      kind: "too-large",
      headline: "Your backup is too large",
      body: "Orbit couldn't create an automatic backup because it's too large. Earlier backups in your folder haven't changed.",
      lastAutomaticBackupAt: "2026-08-20 12:00:00",
    });
  });

  it("a lost folder still wins: it must be reconnected first", () => {
    expect(
      resolveBackupHealth(
        {
          ...base,
          folderAccessible: false,
          folderDiagnostic: AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC,
        },
        now,
      ).kind,
    ).toBe("lost-folder");
  });

  it("any other diagnostic falls through to the ordinary states", () => {
    expect(
      resolveBackupHealth(
        { ...base, folderDiagnostic: "Unable to access the backup folder." },
        now,
      ).kind,
    ).toBe("stale");
    expect(
      resolveBackupHealth({ ...base, folderDiagnostic: null }, now).kind,
    ).toBe("stale");
  });

  it("the manual export Alert body says the backup is too large to create", () => {
    expect(MANUAL_EXPORT_TOO_LARGE_COPY).toBe(
      "Your backup is too large to create. Nothing was shared.",
    );
    expect(manualExportFailureCopy({ status: "too-large" })).toBe(
      MANUAL_EXPORT_TOO_LARGE_COPY,
    );
    expect(manualExportFailureCopy({ status: "export-failed" })).toBe(
      "Nothing was shared. Please try again.",
    );
    expect(
      manualExportFailureCopy({ status: "shared", skippedPhotos: 0 }),
    ).toBeNull();
  });
});
