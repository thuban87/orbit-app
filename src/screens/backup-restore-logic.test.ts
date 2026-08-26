import { describe, expect, it } from "vitest";
import {
  createRestorePreviewCache,
  isEncryptedBackupEnvelope,
  restorePreviewFailure,
} from "@/screens/backup-restore-logic";

const preview = {
  exportedAt: "2026-08-25T12:00:00.000Z",
  backupFormatVersion: 1,
  encrypted: false,
  rowCount: 12,
  photoCount: 3,
};

describe("restore preview route safety", () => {
  it("hands navigation only an opaque token and aggregate preview", () => {
    const cache = createRestorePreviewCache();
    const route = cache.store({ manifest: { private: "never routed" }, preview });

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
