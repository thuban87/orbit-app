import { describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@/db/app-settings-dao";
import {
  type ReadPhase,
  readFailed,
  readLoaded,
  readLoading,
  runGatedRead,
} from "@/logic/read-phase";
import {
  BACKUP_DAYS_VALIDATION_COPY,
  backupSettingsPresentation,
  buildBackupSettingsPatch,
  commitThenRefresh,
  validateEncryptionSetup,
  validateWholeBackupDays,
} from "@/screens/backup-settings-logic";
import { createLatestRequestAuthority } from "@/utils/latest-request";

function settings(patch: Partial<AppSettings>): AppSettings {
  return {
    encryptionEnabled: 0,
    backupFolderUri: null,
    backupFolderName: null,
    backupFolderAccessible: 0,
    ...patch,
  } as AppSettings;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("validateWholeBackupDays — one DAO-owned 1..3650 boundary", () => {
  it("accepts only whole day values that the durable DAO accepts", () => {
    expect(validateWholeBackupDays("1")).toEqual({ value: 1 });
    expect(validateWholeBackupDays("3650")).toEqual({ value: 3650 });
    for (const invalid of ["", "0", "-1", "1.5", "3660", "days"]) {
      expect(validateWholeBackupDays(invalid)).toEqual({
        error: BACKUP_DAYS_VALIDATION_COPY,
      });
    }
  });

  it("keeps invalid fields out of the persistence patch", () => {
    expect(
      buildBackupSettingsPatch({ intervalDays: "14", retentionDays: "90" }),
    ).toEqual({ patch: { backupIntervalDays: 14, backupRetentionDays: 90 } });
    expect(
      buildBackupSettingsPatch({ intervalDays: "14.5", retentionDays: "90" }),
    ).toEqual({
      errors: { intervalDays: BACKUP_DAYS_VALIDATION_COPY },
      patch: null,
    });
  });
});

describe("validateEncryptionSetup — no passphrase echo or unsafe setup", () => {
  it("requires a non-empty matching confirmation before enabling encryption", () => {
    expect(validateEncryptionSetup("", "")).toEqual({
      ok: false,
      error: "Enter a passphrase.",
    });
    expect(validateEncryptionSetup("first", "second")).toEqual({
      ok: false,
      error: "Passphrases don't match.",
    });
    expect(
      validateEncryptionSetup(
        "a long private passphrase",
        "a long private passphrase",
      ),
    ).toEqual({ ok: true });
  });
});

describe("backupSettingsPresentation — unknown settings are never a known state (D-24)", () => {
  it("loading ⇒ no groups, no encryption summary, no folder state", () => {
    expect(backupSettingsPresentation(readLoading())).toEqual({
      showGroups: false,
      encryptionSummary: null,
      folderConfigured: false,
      folderAccessible: false,
    });
  });

  it("error ⇒ encryptionSummary null and no groups (never 'Off')", () => {
    expect(backupSettingsPresentation(readFailed())).toEqual({
      showGroups: false,
      encryptionSummary: null,
      folderConfigured: false,
      folderAccessible: false,
    });
  });

  it("loaded ⇒ the real encryption summary", () => {
    expect(
      backupSettingsPresentation(readLoaded(settings({ encryptionEnabled: 0 })))
        .encryptionSummary,
    ).toBe("off");
    expect(
      backupSettingsPresentation(readLoaded(settings({ encryptionEnabled: 1 })))
        .encryptionSummary,
    ).toBe("on");
  });

  it("loaded ⇒ folder flags derive only from loaded data", () => {
    expect(backupSettingsPresentation(readLoaded(settings({})))).toMatchObject({
      showGroups: true,
      folderConfigured: false,
      folderAccessible: false,
    });
    expect(
      backupSettingsPresentation(
        readLoaded(
          settings({
            backupFolderUri: "content://tree/x",
            backupFolderAccessible: 0,
          }),
        ),
      ),
    ).toMatchObject({ folderConfigured: true, folderAccessible: false });
    expect(
      backupSettingsPresentation(
        readLoaded(
          settings({
            backupFolderUri: "content://tree/x",
            backupFolderAccessible: 1,
          }),
        ),
      ),
    ).toMatchObject({ folderConfigured: true, folderAccessible: true });
  });
});

describe("commitThenRefresh — a committed write is never reported as failed (D-04)", () => {
  it("awaits a delayed re-read before the handler returns", async () => {
    const reread = deferred<void>();
    const onCommitFailed = vi.fn();
    let settled = false;
    const handler = commitThenRefresh({
      commit: async () => true,
      refresh: () => reread.promise,
      onCommitFailed,
    }).then((outcome) => {
      settled = true;
      return outcome;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    reread.resolve();
    expect(await handler).toBe("committed");
    expect(onCommitFailed).not.toHaveBeenCalled();
  });

  it("commit → failed re-read → error phase, with no write-failure Alert", async () => {
    const gate = createLatestRequestAuthority();
    let phase: ReadPhase<AppSettings> = readLoaded(
      settings({ encryptionEnabled: 0 }),
    );
    const commit = vi.fn(async () => true);
    const onCommitFailed = vi.fn();
    const outcome = await commitThenRefresh({
      commit,
      refresh: async () => {
        await runGatedRead({
          gate,
          read: async (): Promise<AppSettings> => {
            throw new Error("settings unreadable");
          },
          publish: (update) => {
            phase = update(phase);
          },
        });
      },
      onCommitFailed,
    });
    expect(outcome).toBe("committed");
    expect(commit).toHaveBeenCalledTimes(1); // never replayed
    expect(onCommitFailed).not.toHaveBeenCalled();
    expect(phase).toEqual({ phase: "error" });
    expect(backupSettingsPresentation(phase).encryptionSummary).toBeNull();
  });

  it("a failed commit reports once and never re-reads", async () => {
    const refresh = vi.fn(async () => {});
    const onCommitFailed = vi.fn();
    const outcome = await commitThenRefresh({
      commit: async () => {
        throw new Error("write failed");
      },
      refresh,
      onCommitFailed,
    });
    expect(outcome).toBe("commit-failed");
    expect(onCommitFailed).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a commit that wrote nothing (e.g. cancelled picker) does not re-read", async () => {
    const refresh = vi.fn(async () => {});
    const outcome = await commitThenRefresh({
      commit: async () => false,
      refresh,
      onCommitFailed: vi.fn(),
    });
    expect(outcome).toBe("nothing-committed");
    expect(refresh).not.toHaveBeenCalled();
  });
});
