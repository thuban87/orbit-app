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
  createAutomaticBackupReencryptionService,
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
  it("re-encrypts a verified automatic replacement before removing its old source and only then activates the new secret", async () => {
    const events: string[] = [];
    const entries = new Map<string, string>([
      ["content://backup/orbit-auto-2026-08-24T00-00-00-000Z.json", JSON.stringify({ encrypted: true, passphrase: "old", plaintext: JSON.stringify(manifest) })],
    ]);
    const passphrases = {
      active: "old",
      pending: null as null | { oldPassphrase: string; nextPassphrase: string; replacements: Array<{ sourceUri: string; replacementUri: string }> },
    };
    const crypto = {
      decrypt: ({ passphrase, envelope }: { passphrase: string; envelope: unknown }) => {
        const input = envelope as { passphrase: string; plaintext: string };
        if (passphrase !== input.passphrase) throw new Error("wrong passphrase");
        return new TextEncoder().encode(input.plaintext);
      },
      encrypt: ({ passphrase, plaintext }: { passphrase: string; plaintext: Uint8Array }) => ({
        encrypted: true,
        passphrase,
        plaintext: new TextDecoder().decode(plaintext),
      }),
    };
    const service = createAutomaticBackupReencryptionService({
      directoryUri: "content://backup",
      now: new Date("2026-08-25T00:00:00.000Z"),
      crypto: crypto as never,
      profile: { formatVersion: 1 } as never,
      passphrases: {
        getPassphrase: async () => ({ status: "present" as const, passphrase: passphrases.active }),
        setPassphrase: async (value) => { events.push("activate-new"); passphrases.active = value; },
        deletePassphrase: async () => {},
        getPendingPassphraseChange: async () => passphrases.pending === null ? { status: "absent" as const } : { status: "present" as const, change: passphrases.pending },
        setPendingPassphraseChange: async (change) => { events.push("journal"); passphrases.pending = change; },
        clearPendingPassphraseChange: async () => { events.push("clear-journal"); passphrases.pending = null; },
      },
      storage: {
        list: async () => [...entries.keys()],
        read: async (uri) => entries.get(uri)!,
        writeVerified: async (_directory, name, contents) => {
          const uri = `content://backup/${name}`;
          events.push("write-verified");
          entries.set(uri, contents);
          return uri;
        },
        remove: async (uri) => { events.push("remove-old"); entries.delete(uri); },
      },
    });

    await expect(service.change({ currentPassphrase: "old", nextPassphrase: "new" })).resolves.toEqual({ status: "changed", reencryptedCount: 1 });
    expect(events).toEqual(["journal", "write-verified", "journal", "remove-old", "activate-new", "clear-journal"]);
    expect([...entries.values()]).toEqual([expect.stringContaining('"passphrase":"new"')]);
  });

  it("keeps the old secret and pending recovery journal when a source cannot be replaced", async () => {
    let active = "old";
    let pending: unknown = null;
    const service = createAutomaticBackupReencryptionService({
      directoryUri: "content://backup",
      now: new Date("2026-08-25T00:00:00.000Z"),
      crypto: {} as never,
      profile: {} as never,
      passphrases: {
        getPassphrase: async () => ({ status: "present" as const, passphrase: active }),
        setPassphrase: async (value) => { active = value; },
        deletePassphrase: async () => {},
        getPendingPassphraseChange: async () => pending === null ? { status: "absent" as const } : { status: "present" as const, change: pending as never },
        setPendingPassphraseChange: async (change) => { pending = change; },
        clearPendingPassphraseChange: async () => { pending = null; },
      },
      storage: {
        list: async () => ["content://backup/orbit-auto-2026-08-24T00-00-00-000Z.json"],
        read: async () => { throw new Error("SAF permission revoked"); },
        writeVerified: async () => "content://backup/new.json",
        remove: async () => {},
      },
    });

    await expect(service.change({ currentPassphrase: "old", nextPassphrase: "new" })).resolves.toEqual({ status: "needs-recovery" });
    expect(active).toBe("old");
    expect(pending).not.toBeNull();
  });

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
