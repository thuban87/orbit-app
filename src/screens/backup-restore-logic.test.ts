import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RestoreMode } from "@/backup/restore-apply";
import {
  backupNeedsBackgroundConsent,
  type ConfirmedRestoreApply,
  confirmRestoreApply,
  createRestoreApplyRun,
  createRestoreApplySingleFlight,
  createRestorePreviewCache,
  initialRestoreApplyState,
  isEncryptedBackupEnvelope,
  type RestoreApplyConfirmation,
  replaceAllConfirmation,
  restoreApplyConfirmation,
  restoreApplyLabel,
  restoreApplyRecovery,
  restorePreviewFailure,
  toRestoreResultParams,
  UNAVAILABLE_BACKGROUND_MESSAGE,
  UNAVAILABLE_BACKGROUND_REPLACE_NOTE,
} from "@/screens/backup-restore-logic";

const preview = {
  exportedAt: "2026-08-25T12:00:00.000Z",
  backupFormatVersion: 1,
  encrypted: false,
  rowCount: 12,
  photoCount: 3,
  contactCount: 2,
  relatedRowCount: 8,
  tombstoneCount: 2,
};

describe("restore preview route safety", () => {
  it("hands navigation only an opaque token and aggregate preview", () => {
    const cache = createRestorePreviewCache();
    const route = cache.store({
      manifest: {
        private: "never routed",
      } as unknown as import("@/backup/types").BackupManifest,
      preview,
    });

    expect(route).toEqual({ token: expect.any(String), preview });
    expect(Object.values(route).flat()).not.toContain("never routed");
    expect(cache.read(route.token)).toMatchObject({
      preview,
      manifest: { private: "never routed" },
    });
  });

  it("treats an unresolvable process-death token as expired rather than stale preview data", () => {
    const cache = createRestorePreviewCache();

    expect(cache.read("missing-token")).toBeNull();
  });

  it("identifies only the encrypted envelope flag before requesting a passphrase", () => {
    expect(
      isEncryptedBackupEnvelope(
        '{"encrypted":true,"metadata":{"not":"shown"}}',
      ),
    ).toBe(true);
    expect(isEncryptedBackupEnvelope('{"encrypted":false}')).toBe(false);
    expect(isEncryptedBackupEnvelope("not json")).toBe(false);
  });

  it("maps pre-preview validation errors to the calm documented recovery point", () => {
    expect(restorePreviewFailure("wrong-passphrase")).toEqual({
      step: "passphrase",
      message:
        "That passphrase doesn't unlock this backup. Your local data hasn't changed.",
      action: "Try passphrase again",
    });
    expect(restorePreviewFailure("damaged-or-incomplete")).toEqual({
      step: "selection",
      message:
        "This backup is damaged or incomplete. Your local data hasn't changed.",
      action: "Choose another file",
    });
    expect(restorePreviewFailure("newer-app")).toEqual({
      step: "selection",
      message:
        "This backup was made by a newer version of Orbit. Update Orbit, then try again. Your local data hasn't changed.",
      action: "Choose another file",
    });
  });
});

describe("restore apply decisions", () => {
  it("defaults to Merge and makes Replace-all explicitly destructive", () => {
    expect(restoreApplyLabel("merge")).toBe("Merge backup");
    expect(restoreApplyLabel("replace-all")).toBe("Replace and restore");
    expect(replaceAllConfirmation(true).message).toContain(
      "Orbit will first create and verify a fresh automatic backup of this device.",
    );
    expect(replaceAllConfirmation(false).message).toContain(
      "Your current local data will be lost and no automatic backup destination is configured.",
    );
  });

  /** The destination reads; the local settings stamp defaults to an old one. */
  function destinationReads(
    configured: boolean,
    localSettingsModifiedAt = "2026-01-01 00:00:00",
  ) {
    return {
      destinationConfigured: async () => configured,
      localSettingsModifiedAt: async () => localSettingsModifiedAt,
    };
  }

  it("keeps a validated preview available while Replace-all awaits its confirmation", async () => {
    const cache = createRestorePreviewCache();
    const route = cache.store({
      manifest: {
        private: "validated-before-confirmation",
      } as unknown as import("@/backup/types").BackupManifest,
      preview,
    });
    let accept!: (accepted: boolean) => void;
    const waitingForConfirmation = new Promise<boolean>((resolve) => {
      accept = resolve;
    });

    const result = confirmRestoreApply(
      cache,
      route.token,
      "replace-all",
      destinationReads(true),
      async () => waitingForConfirmation,
    );
    cache.discard(route.token);
    accept(true);

    await expect(result).resolves.toMatchObject({
      status: "confirmed",
      candidate: { manifest: { private: "validated-before-confirmation" } },
    });
  });

  it("does not open confirmation for an already expired preview", async () => {
    let readDestinationCalls = 0;
    let confirmationCalls = 0;

    await expect(
      confirmRestoreApply(
        createRestorePreviewCache(),
        "missing-token",
        "replace-all",
        {
          destinationConfigured: async () => {
            readDestinationCalls += 1;
            return true;
          },
          localSettingsModifiedAt: async () => {
            readDestinationCalls += 1;
            return "2026-01-01 00:00:00";
          },
        },
        async () => {
          confirmationCalls += 1;
          return true;
        },
      ),
    ).resolves.toEqual({ status: "expired" });

    expect(readDestinationCalls).toBe(0);
    expect(confirmationCalls).toBe(0);
  });

  it("cancels Replace-all without consuming its validated candidate", async () => {
    const cache = createRestorePreviewCache();
    const route = cache.store({
      manifest: {
        private: "keep-after-cancel",
      } as unknown as import("@/backup/types").BackupManifest,
      preview,
    });

    await expect(
      confirmRestoreApply(
        cache,
        route.token,
        "replace-all",
        destinationReads(false),
        async () => false,
      ),
    ).resolves.toEqual({ status: "cancelled" });
    expect(cache.read(route.token)).toMatchObject({
      manifest: { private: "keep-after-cancel" },
    });
  });

  /** The backup's settings stamp: newer than `destinationReads`' default. */
  const NEWER = "2026-09-29 10:00:00";
  /** The backup's settings stamp: older than a phone edited after the backup. */
  const OLDER = "2026-09-01 10:00:00";
  const PHONE_EDITED_LATER = "2026-09-15 10:00:00";

  /** A cached candidate whose backup holds the given settings. */
  function cachedWith(appSettings: Record<string, unknown> | undefined) {
    const cache = createRestorePreviewCache();
    const route = cache.store({
      manifest: {
        appSettings,
      } as unknown as import("@/backup/types").BackupManifest,
      preview,
    });
    return { cache, token: route.token };
  }

  it("a plain Merge confirms with no dialog and no destination read", async () => {
    const { cache, token } = cachedWith({
      modifiedAt: NEWER,
      galaxyBackground: "galaxy-aurora",
    });
    let reads = 0;
    let dialogs = 0;
    await expect(
      confirmRestoreApply(
        cache,
        token,
        "merge",
        {
          destinationConfigured: async () => {
            reads += 1;
            return true;
          },
          localSettingsModifiedAt: async () => {
            reads += 1;
            return "2026-01-01 00:00:00";
          },
        },
        async () => {
          dialogs += 1;
          return true;
        },
      ),
    ).resolves.toMatchObject({
      status: "confirmed",
      useDefaultBackgrounds: false,
    });
    expect(reads).toBe(0);
    expect(dialogs).toBe(0);
  });

  it("Merge with NEWER backup settings and an unavailable background asks the D-47 question; Cancel writes nothing, Continue consents", async () => {
    const { cache, token } = cachedWith({
      modifiedAt: NEWER,
      galaxyBackground: "galaxy-comet",
    });
    const shown: unknown[] = [];
    await expect(
      confirmRestoreApply(
        cache,
        token,
        "merge",
        destinationReads(true),
        async (confirmation) => {
          shown.push(confirmation);
          return false;
        },
      ),
    ).resolves.toEqual({ status: "cancelled" });
    expect(shown).toEqual([
      {
        title: "Background not available",
        message:
          "A background selected in this backup is no longer available. Switch to the default background instead?",
        cancelLabel: "Cancel",
        confirmLabel: "Continue",
        destructive: false,
      },
    ]);
    await expect(
      confirmRestoreApply(
        cache,
        token,
        "merge",
        destinationReads(true),
        async () => true,
      ),
    ).resolves.toMatchObject({
      status: "confirmed",
      useDefaultBackgrounds: true,
    });
  });

  it("Merge whose backup settings are OLDER (or the same age) never asks: the settings are not written (RA-a / D-49)", async () => {
    const { cache, token } = cachedWith({
      modifiedAt: OLDER,
      galaxyBackground: "galaxy-comet",
    });
    for (const local of [PHONE_EDITED_LATER, OLDER]) {
      let dialogs = 0;
      let destinationReadsMade = 0;
      await expect(
        confirmRestoreApply(
          cache,
          token,
          "merge",
          {
            destinationConfigured: async () => {
              destinationReadsMade += 1;
              return true;
            },
            localSettingsModifiedAt: async () => local,
          },
          async () => {
            dialogs += 1;
            return false;
          },
        ),
      ).resolves.toMatchObject({
        status: "confirmed",
        useDefaultBackgrounds: false,
      });
      expect(dialogs, local).toBe(0);
      expect(destinationReadsMade, local).toBe(0);
    }
  });

  it("Replace-all with an unavailable background shows ONE dialog carrying the notice, even when the backup settings are older", async () => {
    for (const modifiedAt of [NEWER, OLDER]) {
      const { cache, token } = cachedWith({
        modifiedAt,
        standardBackground: "standard-x",
      });
      const shown: { message: string; confirmLabel: string }[] = [];
      await expect(
        confirmRestoreApply(
          cache,
          token,
          "replace-all",
          destinationReads(true, PHONE_EDITED_LATER),
          async (confirmation) => {
            shown.push(confirmation);
            return true;
          },
        ),
      ).resolves.toMatchObject({
        status: "confirmed",
        useDefaultBackgrounds: true,
      });
      expect(shown).toHaveLength(1);
      expect(shown[0].message).toContain(
        "Orbit will first create and verify a fresh automatic backup of this device.",
      );
      expect(shown[0].message).toContain(UNAVAILABLE_BACKGROUND_REPLACE_NOTE);
      expect(shown[0].confirmLabel).toBe("Replace and restore");
      // Cancel on the same dialog writes nothing.
      await expect(
        confirmRestoreApply(
          cache,
          token,
          "replace-all",
          destinationReads(true, PHONE_EDITED_LATER),
          async () => false,
        ),
      ).resolves.toEqual({ status: "cancelled" });
    }
  });

  it("the preview notice follows the same decision: per mode and settings age (RA-a / D-49)", async () => {
    const entry = (modifiedAt: string, galaxyBackground: unknown) => ({
      manifest: {
        appSettings: { modifiedAt, galaxyBackground },
      } as unknown as import("@/backup/types").BackupManifest,
    });
    const phone = async () => PHONE_EDITED_LATER;
    await expect(
      backupNeedsBackgroundConsent(
        entry(OLDER, "galaxy-comet"),
        "merge",
        phone,
      ),
    ).resolves.toBe(false);
    await expect(
      backupNeedsBackgroundConsent(
        entry(NEWER, "galaxy-comet"),
        "merge",
        phone,
      ),
    ).resolves.toBe(true);
    await expect(
      backupNeedsBackgroundConsent(
        entry(OLDER, "galaxy-comet"),
        "replace-all",
        phone,
      ),
    ).resolves.toBe(true);
    await expect(
      backupNeedsBackgroundConsent(
        entry(NEWER, "galaxy-aurora"),
        "replace-all",
        phone,
      ),
    ).resolves.toBe(false);
  });

  it("retired and active ids never prompt; a manifest without settings is safe", async () => {
    for (const appSettings of [
      undefined,
      {},
      {
        modifiedAt: NEWER,
        galaxyBackground: "galaxy-nebula",
        standardBackground: "standard-mesh",
      },
      {
        modifiedAt: NEWER,
        galaxyBackground: null,
        standardBackground: "standard-paper",
      },
    ]) {
      for (const mode of ["merge", "replace-all"] as const)
        await expect(
          backupNeedsBackgroundConsent(
            {
              manifest: {
                appSettings,
              } as unknown as import("@/backup/types").BackupManifest,
            },
            mode,
            async () => "2026-01-01 00:00:00",
          ),
        ).resolves.toBe(false);
    }
    expect(restoreApplyConfirmation("merge", false, false)).toBeNull();
    expect(restoreApplyConfirmation("merge", false, true)?.message).toBe(
      UNAVAILABLE_BACKGROUND_MESSAGE,
    );
    expect(restoreApplyConfirmation("replace-all", true, false)?.message).toBe(
      replaceAllConfirmation(true).message,
    );
  });

  it("shares one pending apply promise and never persists an applying state for a cold start", async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const apply = createRestoreApplySingleFlight(async () => {
      calls += 1;
      await pending;
    });

    const first = apply();
    const second = apply();
    expect(second).toBe(first);
    expect(calls).toBe(1);
    expect(initialRestoreApplyState()).toBe("idle");
    release?.();
    await first;
  });

  it("projects committed totals and recovery state into the result route", () => {
    expect(
      toRestoreResultParams({
        status: "applied",
        mode: "replace-all",
        inserted: 3,
        updated: 2,
        retained: 4,
        deleted: 1,
        blocked: 0,
        photosNeedingAttention: 2,
        photoCleanupPending: 1,
        scheduleResyncPending: true,
        preRestoreSnapshotCreated: true,
      }),
    ).toEqual({
      added: 3,
      updated: 2,
      newerLocalKept: 4,
      deletionsApplied: 1,
      photosNeedingAttention: 2,
      photoCleanupPending: 1,
      scheduleResyncPending: true,
      replaceSafetySnapshot: "verified",
    });
  });

  it("keeps pre-commit apply failures on the preview with no optimistic result", () => {
    expect(restoreApplyRecovery("pre-restore-snapshot-failed")).toEqual({
      step: "preview",
      message:
        "Couldn't restore this backup. Your local data hasn't changed. Please try again.",
    });
    expect(restoreApplyRecovery("incompatible-destination").step).toBe(
      "preview",
    );
  });
});

/**
 * 38.5 scoped re-check WR-1 (enforces D-47 "each path shows one dialog"): the
 * mode the user confirmed is the mode the apply runs, and the mode is locked
 * from the Apply tap until the confirmation settles and the apply completes or
 * is cancelled. The screen's radios go through `acceptsModeChange`, so the
 * harness below models the screen's mode state the same way.
 */
describe("restore apply: the confirmed mode is the executed mode (WR-1)", () => {
  const NEWER = "2026-09-29 10:00:00";
  const OLDER = "2026-09-01 10:00:00";
  const PHONE = "2026-09-15 10:00:00";

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  /**
   * The screen, reduced to its apply wiring: the selected mode, radios gated by
   * `acceptsModeChange`, the real `confirmRestoreApply`, and a recorded apply.
   * The phone's settings read is held open so a test can tap mid-preparation.
   */
  function screen(appSettings: Record<string, unknown>) {
    const cache = createRestorePreviewCache();
    const { token } = cache.store({
      manifest: {
        appSettings,
      } as unknown as import("@/backup/types").BackupManifest,
      preview,
    });
    const settingsRead = deferred<string>();
    const applyGate = deferred<void>();
    const dialogs: RestoreApplyConfirmation[] = [];
    const applied: ConfirmedRestoreApply[] = [];
    let mode: RestoreMode = "merge";
    const run = createRestoreApplyRun({
      confirm: (confirmMode) =>
        confirmRestoreApply(
          cache,
          token,
          confirmMode,
          {
            destinationConfigured: async () => false,
            localSettingsModifiedAt: () => settingsRead.promise,
          },
          async (confirmation) => {
            dialogs.push(confirmation);
            return true;
          },
        ),
      apply: async (confirmed) => {
        applied.push(confirmed);
        await applyGate.promise;
      },
    });
    return {
      run,
      dialogs,
      applied,
      settingsRead,
      applyGate,
      get mode() {
        return mode;
      },
      /** A radio tap: the screen's `selectMode`. */
      tap(next: RestoreMode) {
        if (run.acceptsModeChange()) mode = next;
      },
      /** The Apply tap: begins with the mode selected at the tap. */
      apply() {
        return run.begin(mode);
      },
    };
  }

  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("tap Merge, then Replace all mid-preparation: the switch is ignored and Merge runs Merge only", async () => {
    // Newer backup settings with an unavailable id: Merge must read the phone's
    // stamp before its dialog, which is the window the re-check found.
    const s = screen({ modifiedAt: NEWER, galaxyBackground: "galaxy-comet" });
    s.tap("merge");
    const outcome = s.apply();
    await flush();
    s.tap("replace-all");
    expect(s.mode).toBe("merge");
    expect(s.run.acceptsModeChange()).toBe(false);
    s.settingsRead.resolve(PHONE);
    await flush();
    // The dialog is Merge's, and the apply runs Merge.
    expect(s.dialogs.map((d) => d.title)).toEqual(["Background not available"]);
    expect(s.applied.map((c) => c.mode)).toEqual(["merge"]);
    // Still locked while the apply runs: a tap is ignored, Apply is busy.
    s.tap("replace-all");
    expect(s.mode).toBe("merge");
    await expect(s.run.begin("replace-all")).resolves.toEqual({
      status: "busy",
    });
    s.applyGate.resolve();
    await expect(outcome).resolves.toMatchObject({
      status: "confirmed",
      mode: "merge",
      useDefaultBackgrounds: true,
    });
    expect(s.applied.map((c) => c.mode)).toEqual(["merge"]);
    expect(s.dialogs.some((d) => d.title === "Replace all local data?")).toBe(
      false,
    );
    // Unlocked once the apply completes.
    s.tap("replace-all");
    expect(s.mode).toBe("replace-all");
  });

  it("Replace-all always shows its 'Replace all local data?' confirmation exactly once", async () => {
    for (const appSettings of [
      { modifiedAt: NEWER, galaxyBackground: "galaxy-comet" },
      { modifiedAt: OLDER, galaxyBackground: "galaxy-comet" },
      { modifiedAt: NEWER, galaxyBackground: "galaxy-aurora" },
    ]) {
      const s = screen(appSettings);
      s.tap("replace-all");
      const outcome = s.apply();
      await flush();
      // A mode tap and a second Apply tap mid-preparation change nothing.
      s.tap("merge");
      expect(s.mode).toBe("replace-all");
      await expect(s.apply()).resolves.toEqual({ status: "busy" });
      s.settingsRead.resolve(PHONE);
      s.applyGate.resolve();
      await expect(outcome).resolves.toMatchObject({
        status: "confirmed",
        mode: "replace-all",
      });
      expect(
        s.dialogs.filter((d) => d.title === "Replace all local data?"),
        JSON.stringify(appSettings),
      ).toHaveLength(1);
      expect(s.dialogs).toHaveLength(1);
      expect(s.applied.map((c) => c.mode)).toEqual(["replace-all"]);
    }
  });

  it("the mode passed to apply equals the confirmed mode, and a cancel or failure releases the lock", async () => {
    for (const mode of ["merge", "replace-all"] as const) {
      const s = screen({ modifiedAt: NEWER, standardBackground: "standard-x" });
      s.tap(mode);
      const outcome = s.apply();
      s.settingsRead.resolve(PHONE);
      s.applyGate.resolve();
      const result = await outcome;
      expect(result).toMatchObject({ status: "confirmed", mode });
      expect(s.applied).toHaveLength(1);
      expect(s.applied[0].mode).toBe(mode);
      expect(s.applied[0]).toBe(result);
    }

    // Cancel: nothing applied, the lock is released.
    let applies = 0;
    const cancelled = createRestoreApplyRun({
      confirm: async () => ({ status: "cancelled" }),
      apply: async () => {
        applies += 1;
      },
    });
    await expect(cancelled.begin("replace-all")).resolves.toEqual({
      status: "cancelled",
    });
    expect(applies).toBe(0);
    expect(cancelled.acceptsModeChange()).toBe(true);

    // A failed confirmation read: rethrown to the screen, the lock released.
    const failing = createRestoreApplyRun({
      confirm: async () => {
        throw new Error("settings read failed");
      },
      apply: async () => {
        applies += 1;
      },
    });
    await expect(failing.begin("merge")).rejects.toThrow(
      "settings read failed",
    );
    expect(applies).toBe(0);
    expect(failing.acceptsModeChange()).toBe(true);
  });

  it("the screen routes its radios through the lock and applies the confirmed mode, never its live mode", () => {
    const source = readFileSync("src/screens/RestorePreviewScreen.tsx", "utf8");
    // Both radios: disabled while locked, and the tap goes through the lock.
    expect(source.match(/disabled=\{applying \|\| modeLocked\}/g)).toHaveLength(
      3,
    );
    expect(source).toContain('onPress={() => selectMode("merge")}');
    expect(source).toContain('onPress={() => selectMode("replace-all")}');
    expect(source).toMatch(
      /if \(applyRun\.acceptsModeChange\(\)\) setMode\(next\)/,
    );
    expect(source.match(/setMode\(/g)).toHaveLength(1);
    // The apply's mode and D-47 answer come from the confirmation.
    const calls = [...source.matchAll(/applyRestore\(([\s\S]*?)\{/g)].map((m) =>
      m[1].replace(/\s+/g, " ").trim(),
    );
    expect(calls).toEqual([
      "getExecutor(), confirmed.candidate.manifest, confirmed.mode,",
    ]);
    expect(source).toContain("confirmed.useDefaultBackgrounds");
    expect(source).toContain("await applyRun.begin(mode)");
  });
});
