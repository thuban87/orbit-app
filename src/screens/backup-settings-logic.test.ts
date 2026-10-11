import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  type BackupDayController,
  type BackupDaysFieldPatch,
  backupSettingsPresentation,
  buildBackupDaysFieldPatch,
  commitThenRefresh,
  createBackupDayController,
  encryptionErrorCopy,
  REENCRYPTION_TOO_LARGE_COPY,
  shouldFlushOnLeave,
  shouldReseedDayField,
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
});

describe("buildBackupDaysFieldPatch — one field, one key (D-34, Pitfall 8)", () => {
  it("builds a single-key patch for a valid interval", () => {
    expect(buildBackupDaysFieldPatch("interval", "7")).toEqual({
      ok: true,
      patch: { backupIntervalDays: 7 },
    });
  });

  it("builds a single-key patch for a valid retention", () => {
    expect(buildBackupDaysFieldPatch("retention", "90")).toEqual({
      ok: true,
      patch: { backupRetentionDays: 90 },
    });
  });

  it("rejects invalid text with the shared copy and no patch", () => {
    expect(buildBackupDaysFieldPatch("retention", "0")).toEqual({
      ok: false,
      error: BACKUP_DAYS_VALIDATION_COPY,
    });
    for (const invalid of ["abc", "", "14.5", "3651", "-3"]) {
      expect(buildBackupDaysFieldPatch("interval", invalid)).toEqual({
        ok: false,
        error: BACKUP_DAYS_VALIDATION_COPY,
      });
    }
  });

  it("never carries the other field's key", () => {
    const interval = buildBackupDaysFieldPatch("interval", "14");
    const retention = buildBackupDaysFieldPatch("retention", "14");
    expect(interval.ok && Object.keys(interval.patch)).toEqual([
      "backupIntervalDays",
    ]);
    expect(retention.ok && Object.keys(retention.patch)).toEqual([
      "backupRetentionDays",
    ]);
  });
});

describe("shouldFlushOnLeave — the one gate for blur, submit and leave (D-34)", () => {
  const base = {
    savedValue: 7,
    pendingValue: null,
    text: "14",
    typedVersion: 3,
    committedVersion: 2,
    pendingVersion: null,
  };

  it("passes for a valid, changed, unwritten edit", () => {
    expect(shouldFlushOnLeave(base)).toBe(true);
  });

  it("fails when the value equals the saved value", () => {
    expect(shouldFlushOnLeave({ ...base, text: "7" })).toBe(false);
    expect(shouldFlushOnLeave({ ...base, text: "07" })).toBe(false);
  });

  it("fails for invalid text", () => {
    for (const text of ["0", "abc", ""]) {
      expect(shouldFlushOnLeave({ ...base, text })).toBe(false);
    }
  });

  it("fails when this version is already written", () => {
    expect(shouldFlushOnLeave({ ...base, committedVersion: 3 })).toBe(false);
  });

  it("fails when this version's write is in flight", () => {
    expect(
      shouldFlushOnLeave({ ...base, pendingVersion: 3, pendingValue: 14 }),
    ).toBe(false);
  });

  it("compares with the pending value while a write is in flight (review C3-M1)", () => {
    const pending = {
      savedValue: 7,
      pendingValue: 14,
      pendingVersion: 1,
      typedVersion: 2,
      committedVersion: 0,
    };
    expect(shouldFlushOnLeave({ ...pending, text: "7" })).toBe(true);
    expect(shouldFlushOnLeave({ ...pending, text: "14" })).toBe(false);
  });

  it("passes for any valid value before anything was loaded", () => {
    expect(shouldFlushOnLeave({ ...base, savedValue: null })).toBe(true);
  });
});

describe("shouldReseedDayField — a refresh never overwrites newer or pending typing", () => {
  const idle = {
    typedVersion: 2,
    committedVersion: 2,
    pendingVersion: null,
    readStartedSeq: 5,
    lastCommitSeq: 4,
  };

  it("reseeds an idle field from a read that began after its last commit", () => {
    expect(shouldReseedDayField(idle)).toBe(true);
  });

  it("keeps a field with a keystroke since it was seeded or written", () => {
    expect(shouldReseedDayField({ ...idle, typedVersion: 3 })).toBe(false);
  });

  it("keeps a field whose write is pending", () => {
    expect(shouldReseedDayField({ ...idle, pendingVersion: 2 })).toBe(false);
  });

  it("keeps a field whose last commit came after the read began", () => {
    expect(shouldReseedDayField({ ...idle, lastCommitSeq: 5 })).toBe(false);
    expect(shouldReseedDayField({ ...idle, lastCommitSeq: 6 })).toBe(false);
  });
});

/**
 * The per-field save controller (D-34; review H3, C2-M2, C3-M1, C3-L1, C4-M1,
 * C4-L1, C5-M3, C7-L1). Driven with deferred writes and no screen render:
 * `leave()` stands for each leave site (focus-effect cleanup, `beforeRemove`,
 * unmount), `focus()` for the screen gaining focus, `attach()` for a mount.
 */
describe("createBackupDayController — deferred-write sequences (D-34)", () => {
  type WriteCall = {
    patch: BackupDaysFieldPatch;
    settle: { resolve: () => void; reject: (err: Error) => void };
  };
  let calls: WriteCall[];
  let onWriteFailed: ReturnType<typeof vi.fn<(error: unknown) => void>>;
  let controller: BackupDayController;

  const flush = () => new Promise<void>((settle) => setTimeout(settle, 0));
  const writtenValues = () =>
    calls.map(
      (call) =>
        call.patch.backupIntervalDays ?? call.patch.backupRetentionDays ?? null,
    );
  const text = (field: "interval" | "retention") =>
    controller.getSnapshot()[field].text;
  const error = (field: "interval" | "retention") =>
    controller.getSnapshot()[field].error;
  const load = (interval: number, retention = 30) => {
    const started = controller.beginRead();
    return () =>
      controller.loaded(started, {
        backupIntervalDays: interval,
        backupRetentionDays: retention,
      });
  };

  beforeEach(() => {
    calls = [];
    onWriteFailed = vi.fn<(error: unknown) => void>();
    controller = createBackupDayController({
      write: (patch) => {
        const settle = deferred<void>();
        calls.push({ patch, settle });
        return settle.promise;
      },
      onWriteFailed,
    });
    controller.attach(() => {});
    controller.focus();
    load(7)();
  });

  it("seeds both fields from the first read", () => {
    expect(text("interval")).toBe("7");
    expect(text("retention")).toBe("30");
    expect(calls).toHaveLength(0);
  });

  it("blur saves one field and never touches the other's typed text or error", async () => {
    controller.changeText("retention", "0");
    controller.commitField("retention");
    expect(error("retention")).toBe(BACKUP_DAYS_VALIDATION_COPY);
    controller.changeText("interval", "14");
    controller.commitField("interval");
    expect(calls.map((call) => call.patch)).toEqual([
      { backupIntervalDays: 14 },
    ]);
    calls[0].settle.resolve();
    await flush();
    load(14, 30)();
    expect(text("retention")).toBe("0");
    expect(error("retention")).toBe(BACKUP_DAYS_VALIDATION_COPY);
    expect(text("interval")).toBe("14");
  });

  it("invalid text shows its error and is never saved, even on leave", async () => {
    controller.changeText("interval", "abc");
    controller.commitField("interval");
    expect(error("interval")).toBe(BACKUP_DAYS_VALIDATION_COPY);
    controller.leave();
    controller.leave();
    await flush();
    expect(calls).toHaveLength(0);
    controller.changeText("interval", "ab");
    expect(error("interval")).toBeNull();
  });

  it("an unchanged valid value writes nothing", async () => {
    controller.changeText("interval", "07");
    controller.commitField("interval");
    controller.leave();
    await flush();
    expect(calls).toHaveLength(0);
  });

  it("(1) a failed blur write is retried by the leave-flush", async () => {
    controller.changeText("interval", "14");
    controller.commitField("interval");
    calls[0].settle.reject(new Error("disk full"));
    await flush();
    expect(controller.fieldState("interval").pendingVersion).toBeNull();
    expect(controller.fieldState("interval").committedVersion).toBe(0);
    expect(onWriteFailed).toHaveBeenCalledTimes(1);
    controller.leave();
    expect(writtenValues()).toEqual([14, 14]);
  });

  it("(2) a read started before a pending write never reverts the field", async () => {
    controller.changeText("interval", "14");
    const staleRead = load(7);
    controller.commitField("interval");
    const before = { ...controller.fieldState("interval") };
    staleRead();
    expect(text("interval")).toBe("14");
    expect(controller.fieldState("interval")).toEqual(before);

    const staleRead2 = load(7);
    calls[0].settle.resolve();
    await flush();
    staleRead2();
    expect(text("interval")).toBe("14");
    expect(controller.fieldState("interval").savedValue).toBe(14);
  });

  it("(3) Submit then Blur on one edit writes once", async () => {
    controller.changeText("interval", "14");
    controller.commitField("interval");
    controller.commitField("interval");
    calls[0].settle.resolve();
    await flush();
    controller.commitField("interval");
    controller.leave();
    await flush();
    expect(writtenValues()).toEqual([14]);
  });

  it("(4) editing back to the old value while a write is pending, then leaving, stores the latest", async () => {
    controller.changeText("interval", "14");
    controller.commitField("interval");
    controller.changeText("interval", "7");
    controller.leave(); // focus-effect cleanup
    controller.leave(); // beforeRemove
    controller.leave(); // unmount
    expect(writtenValues()).toEqual([14]);
    calls[0].settle.resolve();
    await flush();
    expect(writtenValues()).toEqual([14, 7]);
    calls[1].settle.resolve();
    await flush();
    expect(writtenValues()).toEqual([14, 7]);
    expect(controller.fieldState("interval").savedValue).toBe(7);
    expect(text("interval")).toBe("7");
  });

  it("(5) a failed leave write is attempted once across all leave events", async () => {
    controller.changeText("interval", "14");
    controller.leave(); // focus-effect cleanup starts the write
    controller.leave(); // beforeRemove while it is pending
    calls[0].settle.reject(new Error("locked"));
    await flush();
    controller.leave(); // unmount
    await flush();
    expect(writtenValues()).toEqual([14]);
    expect(onWriteFailed).toHaveBeenCalledTimes(1);
  });

  it("(6) a failed blur-origin drain is retried once by a later leave", async () => {
    controller.changeText("interval", "14");
    controller.commitField("interval");
    controller.changeText("interval", "21");
    controller.commitField("interval"); // drain request, origin blur
    calls[0].settle.resolve();
    await flush();
    expect(writtenValues()).toEqual([14, 21]);
    calls[1].settle.reject(new Error("locked"));
    await flush();
    controller.leave(); // beforeRemove
    await flush();
    expect(writtenValues()).toEqual([14, 21, 21]);
    controller.leave();
    await flush();
    expect(writtenValues()).toEqual([14, 21, 21]);
  });

  it("(7) a remount while a drain is pending loses and duplicates nothing", async () => {
    const detachA = controller.attach(() => {});
    controller.changeText("interval", "14");
    controller.commitField("interval");
    controller.changeText("interval", "7");
    controller.leave(); // A focus-effect cleanup
    controller.leave(); // A beforeRemove
    controller.leave(); // A unmount
    detachA();

    controller.attach(() => {}); // mount B
    controller.focus();
    load(7)(); // B's read lands while 14 is pending
    expect(text("interval")).toBe("7");
    controller.changeText("interval", "21");
    controller.commitField("interval");

    expect(writtenValues()).toEqual([14]);
    calls[0].settle.resolve(); // 14 lands; the drain now writes B's newer 21
    await flush();
    expect(writtenValues()).toEqual([14, 21]);
    calls[1].settle.resolve();
    await flush();
    controller.leave(); // B leaves: nothing left to write
    await flush();
    expect(writtenValues()).toEqual([14, 21]);
    expect(controller.fieldState("interval").savedValue).toBe(21);
    expect(text("interval")).toBe("21");
  });

  it("(8) a remount after an invalid edit reseeds from storage and writes nothing", async () => {
    const detachA = controller.attach(() => {});
    controller.changeText("interval", "0");
    controller.commitField("interval");
    expect(error("interval")).toBe(BACKUP_DAYS_VALIDATION_COPY);
    controller.leave();
    detachA();
    controller.attach(() => {}); // mount B, no focus yet
    load(7)();
    expect(text("interval")).toBe("7");
    expect(error("interval")).toBeNull();
    controller.leave();
    await flush();
    expect(calls).toHaveLength(0);
  });

  it("(8b) a remount after a failed edit shows newer storage and never writes the old text", async () => {
    const detachA = controller.attach(() => {});
    controller.changeText("interval", "21");
    controller.commitField("interval");
    calls[0].settle.reject(new Error("locked"));
    await flush();
    controller.leave();
    calls[1].settle.reject(new Error("locked"));
    await flush();
    detachA();
    // The stored value becomes 30 elsewhere (e.g. a backup restore).
    controller.attach(() => {}); // mount B
    load(30)();
    expect(text("interval")).toBe("30");
    controller.leave();
    await flush();
    expect(writtenValues()).toEqual([21, 21]);
  });

  it("(9) refocus on the same mount after an invalid edit reseeds and writes nothing", async () => {
    controller.changeText("interval", "0");
    controller.commitField("interval");
    controller.leave(); // focus-effect cleanup (tab switch away)
    controller.focus(); // back again: no detach, no attach
    load(7)();
    expect(text("interval")).toBe("7");
    expect(error("interval")).toBeNull();
    controller.leave();
    await flush();
    expect(calls).toHaveLength(0);
  });

  it("(9b) refocus after a failed edit shows newer storage and the next leave writes nothing", async () => {
    controller.changeText("interval", "21");
    controller.commitField("interval");
    calls[0].settle.reject(new Error("locked"));
    await flush();
    controller.leave(); // focus-effect cleanup
    calls[1].settle.reject(new Error("locked"));
    await flush();
    // The stored value becomes 30 while the screen is unfocused.
    controller.focus();
    load(30)();
    expect(text("interval")).toBe("30");
    controller.leave(); // focus-effect cleanup
    controller.leave(); // beforeRemove
    controller.leave(); // unmount
    await flush();
    expect(writtenValues()).toEqual([21, 21]);
  });

  it("within one focused visit, another refresh never overwrites newer typing", async () => {
    controller.changeText("interval", "21");
    load(7, 30)(); // e.g. the folder or encryption write's refresh
    expect(text("interval")).toBe("21");
    controller.changeText("retention", "60");
    controller.commitField("retention");
    calls[0].settle.resolve();
    await flush();
    load(7, 60)();
    expect(text("interval")).toBe("21");
    expect(text("retention")).toBe("60");
  });

  it("notifies attached listeners and stops after detach", () => {
    const listener = vi.fn();
    const detach = controller.attach(listener);
    controller.changeText("interval", "1");
    expect(listener).toHaveBeenCalled();
    listener.mockClear();
    detach();
    controller.changeText("interval", "12");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("BackupSettingsScreen saves the schedule on leave (D-34 source contract)", () => {
  const screen = readFileSync(
    fileURLToPath(new URL("./BackupSettingsScreen.tsx", import.meta.url)),
    "utf8",
  );
  const inputFor = (testID: string) => {
    const start = screen.indexOf(`testID="${testID}"`);
    expect(start).toBeGreaterThan(-1);
    return screen.slice(start, screen.indexOf("/>", start));
  };

  it("has no Save schedule button", () => {
    expect(screen).not.toContain("Save schedule");
    expect(screen).not.toContain("backup-settings-save-days");
    expect(screen).not.toMatch(/\bsaveDays\b/);
  });

  it("forwards blur and submit on both day inputs", () => {
    for (const testID of [
      "backup-settings-interval",
      "backup-settings-retention",
    ]) {
      const input = inputFor(testID);
      expect(input).toMatch(/onBlur=/);
      expect(input).toMatch(/onSubmitEditing=/);
    }
  });

  it("flushes from the focus-effect cleanup and a beforeRemove listener that never prevents removal", () => {
    expect(screen).toMatch(/addListener\(\s*"beforeRemove"/);
    expect(screen).not.toMatch(/\.preventDefault\(/);
    const start = screen.indexOf("useFocusEffect(");
    const focusEffect = screen.slice(start, screen.indexOf("\n  );\n", start));
    expect(focusEffect).toMatch(/\.leave\(\)/);
    expect(focusEffect).toMatch(/\.focus\(\)/);
  });

  it("uses one module-scoped controller", () => {
    expect(screen.match(/createBackupDayController\(/g)).toHaveLength(1);
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

describe("passphrase-change error copy (38.6 D-39, WR5-03)", () => {
  it("says too large, not reconnect, for an over-cap re-encryption", () => {
    expect(encryptionErrorCopy("too-large")).toBe(REENCRYPTION_TOO_LARGE_COPY);
    expect(REENCRYPTION_TOO_LARGE_COPY).toBe(
      "An automatic backup in your folder is too large to re-encrypt, so your passphrase wasn't changed. You can still use the new passphrase for future backups only.",
    );
    expect(encryptionErrorCopy("too-large")).not.toMatch(/reconnect/i);
  });

  it("keeps the existing copy for the other outcomes", () => {
    expect(encryptionErrorCopy("wrong-current-passphrase")).toBe(
      "That passphrase doesn't match your current backup protection.",
    );
    expect(encryptionErrorCopy("needs-recovery")).toBe(
      "Orbit couldn't safely re-encrypt every accessible automatic backup. Reconnect the folder and try again.",
    );
  });
});
