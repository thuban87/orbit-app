import { describe, expect, it } from "vitest";
import {
  backupNeedsBackgroundConsent,
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
