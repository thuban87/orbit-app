import { describe, expect, it } from "vitest";
import {
  BACK_UP_NOW_FAILED_COPY,
  backUpNowSnackbar,
  backupWarningAction,
  backupWarningActionLabel,
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

describe("warning card action (38.12 D-115)", () => {
  const base = {
    folderUri: "content://tree/primary%3AOrbit",
    folderName: "Orbit",
    folderAccessible: true,
    lastAutomaticBackupAt: "2026-10-01 09:00:00",
    currentDataRevision: 5,
    lastBackupDataRevision: 5,
    intervalDays: 7,
  };
  const now = new Date(2026, 9, 17);

  it("offers Back up now when a usable folder is set and the backup needs attention or was too large", () => {
    expect(
      backupWarningAction(
        resolveBackupHealth({ ...base, currentDataRevision: 6 }, now),
      ),
    ).toBe("back-up-now");
    expect(
      backupWarningAction(
        resolveBackupHealth({ ...base, lastAutomaticBackupAt: null }, now),
      ),
    ).toBe("back-up-now");
    expect(
      backupWarningAction(
        resolveBackupHealth(
          {
            ...base,
            folderDiagnostic: AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC,
          },
          now,
        ),
      ),
    ).toBe("back-up-now");
  });

  it("offers Choose a folder when no folder is chosen or it needs reconnecting", () => {
    expect(
      backupWarningAction(
        resolveBackupHealth({ ...base, folderUri: null }, now),
      ),
    ).toBe("choose-folder");
    expect(
      backupWarningAction(
        resolveBackupHealth({ ...base, folderAccessible: false }, now),
      ),
    ).toBe("choose-folder");
  });

  it("a healthy or unread card has no action", () => {
    expect(backupWarningAction(resolveBackupHealth(base, now))).toBeNull();
    expect(backupWarningAction(null)).toBeNull();
  });

  it("labels each action", () => {
    expect(backupWarningActionLabel("back-up-now")).toBe("Back up now");
    expect(backupWarningActionLabel("choose-folder")).toBe("Choose a folder");
  });
});

describe("Back up now snackbar (38.12 D-115)", () => {
  const skipped = (count: number) =>
    count > 0 ? `${count} photos couldn't be included.` : null;

  it("confirms a verified write, with the skipped-photos line when photos were left out", () => {
    expect(
      backUpNowSnackbar({ status: "written", skippedPhotos: 0 }, skipped),
    ).toEqual({ kind: "success", label: "Backed up" });
    expect(
      backUpNowSnackbar({ status: "written", skippedPhotos: 2 }, skipped),
    ).toEqual({
      kind: "success",
      label: "Backed up. 2 photos couldn't be included.",
    });
  });

  it("reports each failure as an error", () => {
    expect(backUpNowSnackbar({ status: "too-large" }, skipped)).toEqual({
      kind: "error",
      label: "Couldn't back up. Your backup is too large to create.",
    });
    expect(backUpNowSnackbar({ status: "failed" }, skipped)).toEqual({
      kind: "error",
      label: BACK_UP_NOW_FAILED_COPY,
    });
    expect(BACK_UP_NOW_FAILED_COPY).toBe(
      "Couldn't back up. Reconnect your backup folder.",
    );
    for (const status of ["blocked", "no-folder", "error"] as const) {
      const outcome =
        status === "blocked"
          ? { status, reason: "passphrase-unavailable" }
          : { status };
      expect(backUpNowSnackbar(outcome, skipped).kind).toBe("error");
    }
  });
});
