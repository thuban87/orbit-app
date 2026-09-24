import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: () => "2026-09-23 12:00:00",
}));
vi.mock("@/db/app-settings-dao", () => ({
  getAppSettings: vi.fn(
    async (exec: { getAllAsync: (sql: string) => Promise<unknown> }) => {
      await exec.getAllAsync("BACKUP_SETTINGS");
      return { backupFolderUri: null };
    },
  ),
  recordAutomaticBackupHealthCore: vi.fn(),
}));
vi.mock("@/db/data-revision-dao", () => ({ readDataRevision: vi.fn() }));
vi.mock("@/db/transaction", () => ({
  inWriteTransaction: async (_exec: unknown, fn: () => Promise<unknown>) =>
    fn(),
}));
vi.mock("@/db/field-ddl", () => ({ expireFieldIfStale: vi.fn() }));
vi.mock("@/services/backup/backup-service", () => ({
  createAutomaticBackupService: vi.fn(),
}));
vi.mock("@/services/backup/encryption", () => ({
  APPROVED_BACKUP_ENCRYPTION_PROFILE: "test",
  createBackupEnvelopeCrypto: vi.fn(),
}));
vi.mock("@/services/backup/passphrase-store", () => ({
  backupPassphraseStore: { getPassphrase: vi.fn() },
}));
vi.mock("@/services/backup/saf-storage", () => ({ createSafStorage: vi.fn() }));
vi.mock("@/services/backup/share-export", () => ({
  readStoredPhotoBase64: vi.fn(),
}));

import { registerBackupSweep } from "./backup-sweep";
import { registerFieldSweep } from "./field-sweep";
import { interactionAssistSweep } from "./interaction-assist-sweep";
import {
  __resetSweepForTest,
  registerSweepHook,
  runLaunchSweep,
} from "./launch-sweep";

beforeEach(() => __resetSweepForTest());

describe("real launch hook registrations", () => {
  it.each([
    "field candidate read",
    "field prune",
    "backup settings read",
    "assist prune",
  ])("runs later hooks after %s fails", async (failure) => {
    const calls: string[] = [];
    const exec = {
      getAllAsync: async (sql: string) => {
        const backup = sql === "BACKUP_SETTINGS";
        calls.push(backup ? "backup settings read" : "field read");
        if (
          (failure === "field candidate read" && !backup) ||
          (failure === "backup settings read" && backup)
        )
          throw new Error("read failed");
        return [];
      },
      runAsync: async (sql: string) => {
        calls.push(
          sql.includes("field_history") ? "field prune" : "assist prune",
        );
        if (
          (failure === "field prune" && sql.includes("field_history")) ||
          (failure === "assist prune" &&
            sql.includes("DELETE FROM interaction_assists"))
        ) {
          throw new Error("prune failed");
        }
        return { changes: 0 };
      },
    } as never;
    registerFieldSweep(() => exec);
    registerSweepHook(async () => {
      calls.push("after field");
    });
    registerBackupSweep(() => exec);
    registerSweepHook(async () => {
      calls.push("after backup");
    });
    registerSweepHook(interactionAssistSweep(() => exec));
    registerSweepHook(async () => {
      calls.push("after assist");
    });
    await runLaunchSweep();
    expect(calls).toContain(
      failure === "field candidate read" ? "field read" : failure,
    );
    expect(calls).toContain("after field");
    expect(calls).toContain("after backup");
    expect(calls.at(-1)).toBe("after assist");
  });
});
