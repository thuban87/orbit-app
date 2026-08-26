import { describe, expect, it } from "vitest";
import {
  confirmReplaceAllRestore,
  createRestoreApplySingleFlight,
  createRestorePreviewCache,
  initialRestoreApplyState,
  isEncryptedBackupEnvelope,
  replaceAllConfirmation,
  restoreApplyLabel,
  restoreApplyRecovery,
  restorePreviewFailure,
  toRestoreResultParams,
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
      manifest: { private: "never routed" } as unknown as import("@/backup/types").BackupManifest,
      preview,
    });

    expect(route).toEqual({ token: expect.any(String), preview });
    expect(Object.values(route).flat()).not.toContain("never routed");
    expect(cache.read(route.token)).toMatchObject({ preview, manifest: { private: "never routed" } });
  });

  it("treats an unresolvable process-death token as expired rather than stale preview data", () => {
    const cache = createRestorePreviewCache();

    expect(cache.read("missing-token")).toBeNull();
  });

  it("identifies only the encrypted envelope flag before requesting a passphrase", () => {
    expect(isEncryptedBackupEnvelope('{"encrypted":true,"metadata":{"not":"shown"}}')).toBe(true);
    expect(isEncryptedBackupEnvelope('{"encrypted":false}')).toBe(false);
    expect(isEncryptedBackupEnvelope("not json")).toBe(false);
  });

  it("maps pre-preview validation errors to the calm documented recovery point", () => {
    expect(restorePreviewFailure("wrong-passphrase")).toEqual({
      step: "passphrase",
      message: "That passphrase doesn't unlock this backup. Your local data hasn't changed.",
      action: "Try passphrase again",
    });
    expect(restorePreviewFailure("damaged-or-incomplete")).toEqual({
      step: "selection",
      message: "This backup is damaged or incomplete. Your local data hasn't changed.",
      action: "Choose another file",
    });
    expect(restorePreviewFailure("newer-app")).toEqual({
      step: "selection",
      message: "This backup was made by a newer version of Orbit. Update Orbit, then try again. Your local data hasn't changed.",
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
      manifest: { private: "validated-before-confirmation" } as unknown as import("@/backup/types").BackupManifest,
      preview,
    });
    let accept!: (accepted: boolean) => void;
    const waitingForConfirmation = new Promise<boolean>((resolve) => { accept = resolve; });

    const result = confirmReplaceAllRestore(
      cache,
      route.token,
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

    await expect(confirmReplaceAllRestore(
      createRestorePreviewCache(),
      "missing-token",
      async () => { readDestinationCalls += 1; return true; },
      async () => { confirmationCalls += 1; return true; },
    )).resolves.toEqual({ status: "expired" });

    expect(readDestinationCalls).toBe(0);
    expect(confirmationCalls).toBe(0);
  });

  it("cancels Replace-all without consuming its validated candidate", async () => {
    const cache = createRestorePreviewCache();
    const route = cache.store({
      manifest: { private: "keep-after-cancel" } as unknown as import("@/backup/types").BackupManifest,
      preview,
    });

    await expect(confirmReplaceAllRestore(
      cache,
      route.token,
      async () => false,
      async () => false,
    )).resolves.toEqual({ status: "cancelled" });
    expect(cache.read(route.token)).toMatchObject({ manifest: { private: "keep-after-cancel" } });
  });

  it("shares one pending apply promise and never persists an applying state for a cold start", async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { release = resolve; });
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

  it("projects only committed aggregate totals into the result route", () => {
    expect(toRestoreResultParams({
      status: "applied",
      mode: "replace-all",
      inserted: 3,
      updated: 2,
      retained: 4,
      deleted: 1,
      blocked: 0,
      photosNeedingAttention: 0,
      photoCleanupPending: 0,
      scheduleResyncPending: false,
      preRestoreSnapshotCreated: true,
    })).toEqual({
      added: 3,
      updated: 2,
      newerLocalKept: 4,
      deletionsApplied: 1,
      replaceSafetySnapshot: "verified",
    });
  });

  it("keeps pre-commit apply failures on the preview with no optimistic result", () => {
    expect(restoreApplyRecovery("pre-restore-snapshot-failed")).toEqual({
      step: "preview",
      message: "Couldn't restore this backup. Your local data hasn't changed. Please try again.",
    });
    expect(restoreApplyRecovery("incompatible-destination").step).toBe("preview");
  });
});
