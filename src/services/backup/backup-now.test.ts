import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 38.12 D-115: "Back up now" and the launch sweep share one write-verify-record
 * function. Each result writes the same device-local health rows the sweep
 * wrote inline before the extraction (38.6 D-24/D-39); blocked, busy and a
 * missing folder write nothing.
 */

const h = vi.hoisted(() => ({
  result: { status: "written", filename: "f", skippedPhotos: 2 } as Record<
    string,
    unknown
  >,
  serviceDeps: null as null | Record<string, unknown>,
  health: vi.fn(async (_exec: unknown, _patch: Record<string, unknown>) => {}),
  record: vi.fn(async (_record: { at: string; count: number }) => {}),
  settings: {
    backupFolderUri: "content://backup" as string | null,
    backupRetentionDays: 7,
    encryptionEnabled: 0,
  },
  getSettings: vi.fn(),
  readRevision: vi.fn(async () => 9),
  storePassphrase: vi.fn(async () => ({ status: "absent" })),
}));

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/db/database", () => ({
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/db/app-settings-dao", () => ({
  getAppSettings: h.getSettings,
  recordAutomaticBackupHealthCore: h.health,
}));
vi.mock("@/db/data-revision-dao", () => ({ readDataRevision: h.readRevision }));
vi.mock("@/db/transaction", () => ({
  inWriteTransaction: async (_exec: unknown, fn: () => Promise<unknown>) =>
    fn(),
}));
vi.mock("@/services/backup/backup-service", () => ({
  AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC: "too-large-diagnostic",
  createAutomaticBackupService: (deps: Record<string, unknown>) => {
    h.serviceDeps = deps;
    return { writeVerifiedSnapshot: async () => h.result };
  },
}));
vi.mock("@/services/backup/encryption", () => ({
  APPROVED_BACKUP_ENCRYPTION_PROFILE: "test",
  createBackupEnvelopeCrypto: vi.fn(),
}));
vi.mock("@/services/backup/passphrase-store", () => ({
  backupPassphraseStore: { getPassphrase: h.storePassphrase },
}));
vi.mock("@/services/backup/saf-storage", () => ({
  createSafStorage: () => ({ id: "real-saf" }),
}));
vi.mock("@/services/backup/share-export", () => ({
  readStoredPhotoBase64: vi.fn(),
}));
vi.mock("@/services/backup/skipped-photos", () => ({
  recordAutomaticSkippedPhotos: h.record,
}));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn() },
}));

import {
  AUTOMATIC_BACKUP_FAILED_DIAGNOSTIC,
  chooseAutomaticBackupFolder,
  runAutomaticBackupNow,
} from "./backup-now";

const exec = { id: "exec" } as never;

beforeEach(() => {
  h.health.mockReset().mockResolvedValue(undefined);
  h.record.mockReset().mockResolvedValue(undefined);
  h.getSettings.mockReset().mockImplementation(async () => h.settings);
  h.readRevision.mockReset().mockResolvedValue(9);
  h.storePassphrase.mockReset().mockResolvedValue({ status: "absent" });
  h.settings.backupFolderUri = "content://backup";
  h.serviceDeps = null;
});

describe("runAutomaticBackupNow — the automatic backup's own health writes (D-115)", () => {
  it("written: folder accessible, diagnostic cleared, timestamp and revision recorded", async () => {
    h.result = { status: "written", filename: "f", skippedPhotos: 2 };
    await expect(runAutomaticBackupNow({ exec })).resolves.toEqual({
      status: "written",
      skippedPhotos: 2,
    });
    expect(h.health).toHaveBeenCalledOnce();
    expect(h.health.mock.calls[0]?.[1]).toEqual({
      backupFolderAccessible: 1,
      backupFolderDiagnostic: null,
      lastAutomaticBackupAt: "2026-10-17 12:00:00",
      lastBackupDataRevision: 9,
    });
    // The skipped-photo record shares the health row's timestamp (38.6 D-24).
    expect(h.record).toHaveBeenCalledExactlyOnceWith({
      at: "2026-10-17 12:00:00",
      count: 2,
    });
  });

  it("written: a zero skipped count is still recorded, so a stale count never survives", async () => {
    h.result = { status: "written", filename: "f", skippedPhotos: 0 };
    await runAutomaticBackupNow({ exec });
    expect(h.record).toHaveBeenCalledExactlyOnceWith({
      at: "2026-10-17 12:00:00",
      count: 0,
    });
  });

  it("too-large: only the too-large diagnostic; the folder stays accessible (38.6 D-39)", async () => {
    h.result = { status: "too-large" };
    await expect(runAutomaticBackupNow({ exec })).resolves.toEqual({
      status: "too-large",
    });
    expect(h.health).toHaveBeenCalledOnce();
    expect(h.health.mock.calls[0]?.[1]).toEqual({
      backupFolderDiagnostic: "too-large-diagnostic",
    });
    expect(h.record).not.toHaveBeenCalled();
  });

  it("failed: the folder is marked as needing reconnection", async () => {
    h.result = { status: "failed" };
    await expect(runAutomaticBackupNow({ exec })).resolves.toEqual({
      status: "failed",
    });
    expect(h.health.mock.calls[0]?.[1]).toEqual({
      backupFolderAccessible: 0,
      backupFolderDiagnostic: AUTOMATIC_BACKUP_FAILED_DIAGNOSTIC,
    });
    expect(AUTOMATIC_BACKUP_FAILED_DIAGNOSTIC).toBe(
      "Unable to access the backup folder.",
    );
    expect(h.record).not.toHaveBeenCalled();
  });

  it.each([
    { status: "blocked", reason: "passphrase-absent" },
    { status: "blocked", reason: "passphrase-unavailable" },
    { status: "busy" },
  ])("$status writes no health and no skipped-photo record", async (result) => {
    h.result = result;
    await expect(runAutomaticBackupNow({ exec })).resolves.toEqual(result);
    expect(h.health).not.toHaveBeenCalled();
    expect(h.record).not.toHaveBeenCalled();
  });

  it("no folder chosen: nothing is written, nothing is recorded", async () => {
    h.settings.backupFolderUri = null;
    await expect(runAutomaticBackupNow({ exec })).resolves.toEqual({
      status: "no-folder",
    });
    expect(h.serviceDeps).toBeNull();
    expect(h.health).not.toHaveBeenCalled();
  });

  it("a throwing health write or record never fails the call", async () => {
    h.result = { status: "written", filename: "f", skippedPhotos: 1 };
    h.health.mockRejectedValue(new Error("db down"));
    h.record.mockRejectedValue(new Error("storage down"));
    await expect(runAutomaticBackupNow({ exec })).resolves.toEqual({
      status: "written",
      skippedPhotos: 1,
    });
  });
});

describe("runAutomaticBackupNow — inputs", () => {
  it("reads settings and the revision itself when the caller has none (Back up now)", async () => {
    h.result = { status: "written", filename: "f", skippedPhotos: 0 };
    await runAutomaticBackupNow({ exec });
    expect(h.getSettings).toHaveBeenCalledOnce();
    expect(h.readRevision).toHaveBeenCalledOnce();
    expect(h.serviceDeps).toMatchObject({
      directoryUri: "content://backup",
      retentionDays: 7,
      storage: { id: "real-saf" },
    });
  });

  it("uses the caller's settings, revision, clock, storage and passphrase reader (the sweep)", async () => {
    h.result = { status: "written", filename: "f", skippedPhotos: 0 };
    const now = new Date(2026, 9, 17, 8, 30);
    const storage = { id: "fake-saf" } as never;
    const readPassphrase = vi.fn(async () => ({
      status: "present" as const,
      passphrase: "secret",
    }));
    await runAutomaticBackupNow({
      exec,
      settings: {
        ...h.settings,
        backupFolderUri: "content://other",
        encryptionEnabled: 1,
      } as never,
      revision: 42,
      now,
      storage,
      readPassphrase,
    });
    expect(h.getSettings).not.toHaveBeenCalled();
    expect(h.readRevision).not.toHaveBeenCalled();
    expect(h.storePassphrase).not.toHaveBeenCalled();
    expect(h.serviceDeps).toMatchObject({
      directoryUri: "content://other",
      now,
      storage,
      encryption: {
        enabled: true,
        passphrase: { status: "present", passphrase: "secret" },
      },
    });
    expect(h.health.mock.calls[0]?.[1]).toMatchObject({
      lastBackupDataRevision: 42,
    });
  });

  it("hands the durable encryption flag and the unreadable secret to the service, which blocks before any plaintext (T-38.12-38)", async () => {
    h.settings.encryptionEnabled = 1;
    h.storePassphrase.mockResolvedValue({
      status: "unavailable",
      reason: "secure-store-read-failed",
    } as never);
    h.result = { status: "blocked", reason: "passphrase-unavailable" };
    await expect(runAutomaticBackupNow({ exec })).resolves.toEqual({
      status: "blocked",
      reason: "passphrase-unavailable",
    });
    expect(h.serviceDeps).toMatchObject({
      encryption: {
        enabled: true,
        passphrase: { status: "unavailable" },
      },
    });
    expect(h.health).not.toHaveBeenCalled();
    h.settings.encryptionEnabled = 0;
  });
});

describe("chooseAutomaticBackupFolder — the one folder chooser", () => {
  it("records the chosen folder as accessible with its display name", async () => {
    const requestDirectory = vi.fn(async () => ({
      granted: true,
      directoryUri: "content://tree/primary%3AOrbit",
    }));
    await expect(
      chooseAutomaticBackupFolder({
        exec,
        folders: { requestDirectory },
        folderName: () => "Orbit",
      }),
    ).resolves.toBe(true);
    // Never seeded with the old URI (a stale seed can blank the Drive picker).
    expect(requestDirectory).toHaveBeenCalledWith();
    expect(h.health.mock.calls[0]?.[1]).toEqual({
      backupFolderUri: "content://tree/primary%3AOrbit",
      backupFolderName: "Orbit",
      backupFolderAccessible: 1,
      backupFolderDiagnostic: null,
    });
  });

  it("a cancelled picker writes nothing", async () => {
    await expect(
      chooseAutomaticBackupFolder({
        exec,
        folders: { requestDirectory: async () => ({ granted: false }) },
        folderName: () => "x",
      }),
    ).resolves.toBe(false);
    expect(h.health).not.toHaveBeenCalled();
  });
});
