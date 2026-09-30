import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The automatic backup records how many photos it left out (38.6 D-24), keyed
 * to the exact `lastAutomaticBackupAt` string it writes to the health row.
 */

const h = vi.hoisted(() => ({
  result: { status: "written", filename: "f", skippedPhotos: 2 } as Record<
    string,
    unknown
  >,
  health: vi.fn(),
  record: vi.fn(async (_record: { at: string; count: number }) => {}),
  hook: null as null | (() => Promise<void>),
}));

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: () => "2026-09-30 12:00:00",
}));
vi.mock("@/db/app-settings-dao", () => ({
  getAppSettings: async () => ({
    backupFolderUri: "content://backup",
    backupRetentionDays: 7,
    encryptionEnabled: 0,
  }),
  recordAutomaticBackupHealthCore: h.health,
}));
vi.mock("@/db/data-revision-dao", () => ({ readDataRevision: async () => 4 }));
vi.mock("@/db/transaction", () => ({
  inWriteTransaction: async (_exec: unknown, fn: () => Promise<unknown>) =>
    fn(),
}));
vi.mock("@/backup/auto-backup-policy", () => ({
  shouldRunAutomaticBackup: () => true,
}));
vi.mock("@/services/backup/backup-service", () => ({
  createAutomaticBackupService: () => ({
    writeVerifiedSnapshot: async () => h.result,
  }),
}));
vi.mock("@/services/backup/encryption", () => ({
  APPROVED_BACKUP_ENCRYPTION_PROFILE: "test",
  createBackupEnvelopeCrypto: vi.fn(),
}));
vi.mock("@/services/backup/passphrase-store", () => ({
  backupPassphraseStore: { getPassphrase: async () => ({ status: "absent" }) },
}));
vi.mock("@/services/backup/saf-storage", () => ({ createSafStorage: vi.fn() }));
vi.mock("@/services/backup/share-export", () => ({
  readStoredPhotoBase64: vi.fn(),
}));
vi.mock("@/services/backup/skipped-photos", () => ({
  recordAutomaticSkippedPhotos: h.record,
}));
vi.mock("@/services/launch-sweep", () => ({
  SWEEP_IDS: {
    backup: "backup",
    backgroundReconcile: "backgroundReconcile",
    restorePhotoFinalize: "restorePhotoFinalize",
  },
  registerSweepHook: (hook: () => Promise<void>) => {
    h.hook = hook;
  },
}));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn() },
}));

import { registerBackupSweep } from "./backup-sweep";

/** Runs the registered hook directly, so a rejection would surface here. */
async function runBackupHook() {
  h.hook = null;
  registerBackupSweep(() => ({}) as never);
  await h.hook!();
}

beforeEach(() => {
  h.health.mockReset();
  h.record.mockReset().mockResolvedValue(undefined);
});

describe("backup sweep skipped-photo record (38.6 D-24)", () => {
  it("records the written count under the same timestamp as the health row", async () => {
    h.result = { status: "written", filename: "f", skippedPhotos: 2 };
    await runBackupHook();
    const at = h.health.mock.calls[0]?.[1]?.lastAutomaticBackupAt;
    expect(at).toBe("2026-09-30 12:00:00");
    expect(h.record).toHaveBeenCalledExactlyOnceWith({ at, count: 2 });
  });

  it("records a written zero too, so a stale count never survives", async () => {
    h.result = { status: "written", filename: "f", skippedPhotos: 0 };
    await runBackupHook();
    expect(h.record).toHaveBeenCalledExactlyOnceWith({
      at: "2026-09-30 12:00:00",
      count: 0,
    });
  });

  it.each([
    { status: "failed" },
    { status: "blocked", reason: "passphrase-absent" },
    { status: "busy" },
  ])("records nothing on $status", async (result) => {
    h.result = result;
    await runBackupHook();
    expect(h.record).not.toHaveBeenCalled();
  });

  it("a throwing record never fails the hook", async () => {
    h.result = { status: "written", filename: "f", skippedPhotos: 1 };
    h.record.mockRejectedValue(new Error("storage down"));
    await expect(runBackupHook()).resolves.toBeUndefined();
    expect(h.record).toHaveBeenCalledOnce();
    expect(h.health).toHaveBeenCalledOnce();
  });
});
