import { beforeEach, describe, expect, it, vi } from "vitest";

const manifest = {
  backupFormatVersion: 1,
  envelopeVersion: 1,
  metadata: { exportedAt: "2026-08-25 12:00:00", sqliteUserVersion: 7 },
  appSettings: { sunContactUid: null, modifiedAt: "2026-08-25 12:00:00" },
  categories: [],
  profile: null,
  contacts: [],
  interactions: [],
  events: [],
  fuel: [],
  contactLinks: [],
  customFieldDefs: [],
  customFieldValues: [],
  tombstones: [],
};
const mocks = vi.hoisted(() => ({ buildExportManifest: vi.fn() }));
vi.mock("@/backup/export-manifest", () => ({
  buildExportManifest: mocks.buildExportManifest,
}));

import {
  createAutomaticBackupService,
  createBackupEncryptionLifecycle,
  createVerifiedPreRestoreSnapshot,
  createManualExportService,
  loadBackupForPreview,
  resolveWriteEncryptionMode,
  withBackupServiceLock,
} from "@/services/backup/backup-service";

describe("manual backup service", () => {
  beforeEach(() => {
    mocks.buildExportManifest.mockReset().mockResolvedValue(manifest);
  });

  it("writes, reads and parses before opening the share sheet", async () => {
    const steps: string[] = [];
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {
            steps.push("write");
          },
          read: async () => {
            steps.push("read");
            return JSON.stringify(manifest);
          },
        }),
      },
      share: {
        isAvailable: async () => true,
        open: async () => {
          steps.push("share");
        },
      },
    });
    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "shared",
    });
    expect(steps).toEqual(["write", "read", "share"]);
  });

  it("returns a recoverable failure without claiming protection when sharing fails", async () => {
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => JSON.stringify(manifest),
        }),
      },
      share: {
        isAvailable: async () => true,
        open: async () => {
          throw new Error("cancelled");
        },
      },
    });
    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "share-failed",
    });
  });

  it("does not open a sheet when the platform has no sharing surface", async () => {
    const open = vi.fn();
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => JSON.stringify(manifest),
        }),
      },
      share: { isAvailable: async () => false, open },
    });

    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "sharing-unavailable",
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("never opens a share sheet for a failed read-back validation", async () => {
    const open = vi.fn();
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => "{}",
        }),
      },
      share: { isAvailable: async () => true, open },
    });

    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "export-failed",
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("rejects overlapping requests before creating an ambiguous second share operation", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => JSON.stringify(manifest),
        }),
      },
      share: { isAvailable: async () => true, open: async () => pending },
    });
    const first = service.sharePlaintextExport();
    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "busy",
    });
    release();
    await expect(first).resolves.toEqual({ status: "shared" });
  });
});

describe("restore preview", () => {
  it("returns only aggregate metadata after wholly validating plaintext content", () => {
    expect(loadBackupForPreview({ contents: JSON.stringify(manifest) })).toEqual({
      status: "ready",
      preview: {
        exportedAt: manifest.metadata.exportedAt,
        backupFormatVersion: 1,
        encrypted: false,
        rowCount: 0,
        photoCount: 0,
      },
    });
  });

  it("returns a typed structural failure without exposing file content", () => {
    expect(loadBackupForPreview({ contents: "{not-json" })).toEqual({
      status: "failed",
      reason: "damaged-or-incomplete",
    });
  });

  it("maps an authenticated encrypted payload to the same aggregate preview", () => {
    const crypto = {
      decrypt: vi.fn(() => new TextEncoder().encode(JSON.stringify(manifest))),
    };
    expect(loadBackupForPreview({
      contents: JSON.stringify({ encrypted: true }),
      passphrase: "correct horse battery staple",
      crypto: crypto as never,
    })).toEqual({
      status: "ready",
      preview: {
        exportedAt: manifest.metadata.exportedAt,
        backupFormatVersion: 1,
        encrypted: true,
        rowCount: 0,
        photoCount: 0,
      },
    });
    expect(crypto.decrypt).toHaveBeenCalledWith({
      passphrase: "correct horse battery staple",
      envelope: { encrypted: true },
    });
  });
});

describe("backup encryption safety", () => {
  it("forces a verified pre-restore snapshot without consulting a due/changed policy", async () => {
    const writeVerified = vi.fn();
    const snapshot = createVerifiedPreRestoreSnapshot({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      now: new Date("2026-08-25T00:00:00.000Z"),
      readPhotoBase64: async () => "",
      directoryUri: "content://backup",
      retentionDays: 7,
      storage: { writeVerified, list: async () => [], remove: async () => {} },
    });
    await expect(snapshot()).resolves.toMatchObject({ status: "written" });
    expect(writeVerified).toHaveBeenCalledTimes(1);
  });

  it("fails closed before writing a byte when enabled encryption has no usable passphrase", async () => {
    mocks.buildExportManifest.mockClear();
    const writeVerified = vi.fn();
    const service = createAutomaticBackupService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      now: new Date("2026-08-25T00:00:00.000Z"),
      readPhotoBase64: async () => "",
      directoryUri: "content://backup",
      retentionDays: 7,
      storage: { writeVerified, list: async () => [], remove: async () => {} },
      encryption: { enabled: true, passphrase: { status: "unavailable", reason: "secure-store-read-failed" }, encrypt: () => "never" },
    });

    await expect(service.writeVerifiedSnapshot()).resolves.toEqual({ status: "blocked", reason: "passphrase-unavailable" });
    expect(writeVerified).not.toHaveBeenCalled();
    expect(mocks.buildExportManifest).not.toHaveBeenCalled();
  });

  it("keeps the flag independent from the three passphrase read states", () => {
    expect(resolveWriteEncryptionMode(false, { status: "unavailable", reason: "secure-store-read-failed" })).toEqual({ mode: "plaintext" });
    expect(resolveWriteEncryptionMode(true, { status: "absent" })).toEqual({ mode: "blocked", reason: "passphrase-absent" });
    expect(resolveWriteEncryptionMode(true, { status: "present", passphrase: "secret" })).toEqual({ mode: "encrypted", passphrase: "secret" });
  });

  it("compensates a failed enable and never clears an enabled flag before SecureStore deletion", async () => {
    const calls: string[] = [];
    const lifecycle = createBackupEncryptionLifecycle({
      getPassphrase: async () => ({ status: "absent" }),
      setPassphrase: async () => { calls.push("set-secret"); },
      deletePassphrase: async () => { calls.push("delete-secret"); },
    }, {
      getEncryptionEnabled: async () => false,
      setEncryptionEnabled: async () => { calls.push("set-flag"); throw new Error("sqlite unavailable"); },
    });
    await expect(lifecycle.enable("secret")).resolves.toEqual({ status: "failed", reason: "flag-update-failed" });
    expect(calls).toEqual(["set-secret", "set-flag", "delete-secret"]);
  });

  it("serializes queued lifecycle operations", async () => {
    const order: string[] = [];
    let release!: () => void;
    const first = withBackupServiceLock(async () => {
      order.push("first-start");
      await new Promise<void>((resolve) => { release = resolve; });
      order.push("first-end");
    });
    const second = withBackupServiceLock(async () => { order.push("second"); });
    await Promise.resolve();
    expect(order).toEqual(["first-start"]);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });
});
