import { describe, expect, it } from "vitest";
import {
  backupHasUnavailableBackground,
  confirmRestoreApply,
  createRestoreApplySingleFlight,
  createRestorePreviewCache,
  initialRestoreApplyState,
  isEncryptedBackupEnvelope,
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
      async () => true,
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
        async () => {
          readDestinationCalls += 1;
          return true;
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
        async () => false,
        async () => false,
      ),
    ).resolves.toEqual({ status: "cancelled" });
    expect(cache.read(route.token)).toMatchObject({
      manifest: { private: "keep-after-cancel" },
    });
  });

  /** A cached candidate whose backup holds the given background ids. */
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
    const { cache, token } = cachedWith({ galaxyBackground: "galaxy-aurora" });
    let reads = 0;
    let dialogs = 0;
    await expect(
      confirmRestoreApply(
        cache,
        token,
        "merge",
        async () => {
          reads += 1;
          return true;
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

  it("Merge with an unavailable background asks the D-47 question; Cancel writes nothing, Continue consents", async () => {
    const { cache, token } = cachedWith({ galaxyBackground: "galaxy-comet" });
    const shown: unknown[] = [];
    await expect(
      confirmRestoreApply(
        cache,
        token,
        "merge",
        async () => true,
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
        async () => true,
        async () => true,
      ),
    ).resolves.toMatchObject({
      status: "confirmed",
      useDefaultBackgrounds: true,
    });
  });

  it("Replace-all with an unavailable background shows ONE dialog carrying the notice", async () => {
    const { cache, token } = cachedWith({ standardBackground: "standard-x" });
    const shown: { message: string; confirmLabel: string }[] = [];
    await expect(
      confirmRestoreApply(
        cache,
        token,
        "replace-all",
        async () => true,
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
  });

  it("retired and active ids never prompt; a manifest without settings is safe", () => {
    for (const appSettings of [
      undefined,
      {},
      {
        galaxyBackground: "galaxy-nebula",
        standardBackground: "standard-mesh",
      },
      { galaxyBackground: null, standardBackground: "standard-paper" },
    ]) {
      expect(
        backupHasUnavailableBackground({
          manifest: {
            appSettings,
          } as unknown as import("@/backup/types").BackupManifest,
        }),
      ).toBe(false);
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
