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
  offLimits: [],
  contactLinks: [],
  customFieldDefs: [],
  customFieldValues: [],
  tombstones: [],
};
const mocks = vi.hoisted(() => ({ buildExportReport: vi.fn() }));
vi.mock("@/backup/export-manifest", () => ({
  buildExportReport: mocks.buildExportReport,
}));
vi.mock("expo-sqlite", () => ({}));

import {
  automaticBackupFileName,
  isOwnedAutomaticBackupName,
} from "@/backup/backup-file-names";
import {
  MAX_SUPPORTED_BACKUP_FORMAT_VERSION,
  parseBackupManifest,
} from "@/backup/backup-schema";
import type * as ExportManifestModule from "@/backup/export-manifest";
import { BackupPhotoUnreadableError } from "@/backup/types";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC,
  createAutomaticBackupReencryptionService,
  createAutomaticBackupService,
  createBackupEncryptionLifecycle,
  createManualExportService,
  createVerifiedPreRestoreSnapshot,
  loadBackupForPreview,
  loadBackupForRestore,
  loadBackupForRestorePreview,
  resolveWriteEncryptionMode,
  withBackupServiceLock,
} from "@/services/backup/backup-service";
import { BackupEnvelopeError } from "@/services/backup/encryption";

describe("manual backup service", () => {
  beforeEach(() => {
    mocks.buildExportReport
      .mockReset()
      .mockResolvedValue({ manifest, skippedPhotos: 0 });
  });

  it("writes, reads and parses before opening the share sheet", async () => {
    const steps: string[] = [];
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        retireAll: async () => {},
        retireStale: async () => {},
        create: async () => ({
          uri: "file:///export.json",
          delete: async () => {},
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
      skippedPhotos: 0,
    });
    expect(steps).toEqual(["write", "read", "share"]);
  });

  it("returns a recoverable failure without claiming protection when sharing fails", async () => {
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        retireAll: async () => {},
        retireStale: async () => {},
        create: async () => ({
          uri: "file:///export.json",
          delete: async () => {},
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
        retireAll: async () => {},
        retireStale: async () => {},
        create: async () => ({
          uri: "file:///export.json",
          delete: async () => {},
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
        retireAll: async () => {},
        retireStale: async () => {},
        create: async () => ({
          uri: "file:///export.json",
          delete: async () => {},
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
        retireAll: async () => {},
        retireStale: async () => {},
        create: async () => ({
          uri: "file:///export.json",
          delete: async () => {},
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
    await expect(first).resolves.toEqual({
      status: "shared",
      skippedPhotos: 0,
    });
  });

  for (const encrypted of [false, true]) {
    for (const outcome of [
      "shared",
      "sharing-unavailable",
      "share-failed",
      "export-failed",
    ] as const) {
      it(`${encrypted ? "encrypted" : "readable"} ${outcome} ${outcome === "shared" ? "retains" : "deletes"} staging`, async () => {
        const remove = vi.fn(async () => {});
        const retireAll = vi.fn(async () => {});
        const crypto = {
          encrypt: () => ({ encrypted: true }),
          decrypt: () => new TextEncoder().encode(JSON.stringify(manifest)),
        };
        const service = createManualExportService({
          exec: {} as never,
          exportedAt: manifest.metadata.exportedAt,
          readPhotoBase64: async () => "",
          files: {
            retireAll,
            retireStale: async () => {},
            create: async () => ({
              uri: "file:///export.json",
              write: async () => {
                if (outcome === "export-failed")
                  throw new Error("write failed");
              },
              read: async () =>
                encrypted
                  ? JSON.stringify({ encrypted: true })
                  : JSON.stringify(manifest),
              delete: remove,
            }),
          },
          share: {
            isAvailable: async () => outcome !== "sharing-unavailable",
            open: async () => {
              if (outcome === "share-failed") throw new Error("share failed");
            },
          },
          encryption: encrypted
            ? {
                enabled: true,
                passphrase: { status: "present", passphrase: "secret" },
                crypto: crypto as never,
                profile: {} as never,
              }
            : undefined,
        });
        await expect(service.shareExport()).resolves.toEqual(
          outcome === "shared"
            ? { status: outcome, skippedPhotos: 0 }
            : { status: outcome },
        );
        expect(retireAll).toHaveBeenCalledOnce();
        expect(remove).toHaveBeenCalledTimes(outcome === "shared" ? 0 : 1);
      });
    }
  }

  it("retires prior staging at the start of each manual export", async () => {
    const retireAll = vi.fn(async () => {});
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        retireAll,
        retireStale: async () => {},
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => JSON.stringify(manifest),
          delete: async () => {},
        }),
      },
      share: { isAvailable: async () => true, open: async () => {} },
    });
    await service.shareExport();
    await service.shareExport();
    expect(retireAll).toHaveBeenCalledTimes(2);
  });

  it("deletes a staged export when read-back validation rejects it", async () => {
    const remove = vi.fn(async () => {});
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        retireAll: async () => {},
        retireStale: async () => {},
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => "{}",
          delete: remove,
        }),
      },
      share: { isAvailable: async () => true, open: async () => {} },
    });
    await expect(service.shareExport()).resolves.toEqual({
      status: "export-failed",
    });
    expect(remove).toHaveBeenCalledOnce();
  });
});

describe("restore preview", () => {
  // 38.10 D-136 O14: the preview shows the version the file was written in;
  // what restore receives is still the converted (current) manifest.
  const v7File = {
    backupFormatVersion: 7,
    envelopeVersion: 1,
    metadata: { exportedAt: "2026-08-25 12:00:00", sqliteUserVersion: 32 },
    appSettings: { sunContactUid: null, modifiedAt: "2026-08-25 12:00:00" },
    categories: [],
    profile: null,
    contacts: [],
    contactMethods: [],
    externalContactLinks: [],
    contactMethodProvenance: [],
    interactions: [],
    events: [],
    // The retired legacy array is omitted: the v7 converter reads a missing
    // one as empty, and the retirement gate (D-01) keeps the name out of src/.
    contactLinks: [],
    customFieldDefs: [],
    customFieldValues: [],
    memories: [],
    relationships: [],
    currentStateEntries: [],
    tombstones: [],
    systems: [],
    systemRules: [],
    systemOverrides: [],
    systemPrefs: [],
    profileLayoutTemplates: [],
    profileBackgroundTemplates: [],
    aiConnections: [],
    personalizationSections: [],
    groupEvents: [],
    profileContactPresentation: [],
    profileCategoryPresentation: [],
  };

  it("reports a v7 file's own version 7, and restore still gets the converted manifest", () => {
    const candidate = loadBackupForRestore({
      contents: JSON.stringify(v7File),
    });
    expect(candidate.status).toBe("ready");
    if (candidate.status !== "ready") return;
    expect(candidate.preview.backupFormatVersion).toBe(7);
    expect(candidate.manifest).toEqual(parseBackupManifest(v7File));
    expect(candidate.manifest.backupFormatVersion).toBe(
      MAX_SUPPORTED_BACKUP_FORMAT_VERSION,
    );
    const preview = loadBackupForPreview({ contents: JSON.stringify(v7File) });
    expect(
      preview.status === "ready" && preview.preview.backupFormatVersion,
    ).toBe(7);
  });

  it("reports a current-format file as its own version", () => {
    const current = parseBackupManifest(manifest);
    const preview = loadBackupForPreview({ contents: JSON.stringify(current) });
    expect(
      preview.status === "ready" && preview.preview.backupFormatVersion,
    ).toBe(MAX_SUPPORTED_BACKUP_FORMAT_VERSION);
    expect(MAX_SUPPORTED_BACKUP_FORMAT_VERSION).toBe(9);
  });

  describe("people and linked-items counts (38.12 D-60)", () => {
    const contact = (uid: string, archivedAt: string | null) => ({
      uid,
      name: uid,
      categoryUid: null,
      trackingEnabled: 1,
      intervalDays: 30,
      archivedAt,
      snoozeUntil: null,
      rarelyResponds: 0,
      remindersOff: 0,
      favourite: 0,
      createdAt: "2026-08-25 12:00:00",
      modifiedAt: "2026-08-25 12:00:00",
    });
    const file = {
      ...v7File,
      backupFormatVersion: MAX_SUPPORTED_BACKUP_FORMAT_VERSION,
      offLimits: [],
      contacts: [
        contact("live-a", null),
        contact("live-b", null),
        contact("binned", "2026-08-20 12:00:00"),
      ],
      categories: [
        {
          uid: "cat",
          name: "Friends",
          displayOrder: 0,
          createdAt: "2026-08-25 12:00:00",
          modifiedAt: "2026-08-25 12:00:00",
        },
      ],
      events: [
        {
          uid: "ev",
          contactUid: "live-a",
          type: "snooze",
          occurredAt: "2026-08-25 12:00:00",
          detail: null,
          recordedAt: "2026-08-25 12:00:00",
          modifiedAt: "2026-08-25 12:00:00",
        },
      ],
      systems: [
        {
          uid: "sys",
          name: "Close",
          createdAt: "2026-08-25 12:00:00",
          modifiedAt: "2026-08-25 12:00:00",
        },
      ],
      tombstones: [
        {
          entityType: "contact",
          entityUid: "gone",
          deletedAt: "2026-08-25 12:00:00",
        },
      ],
    };

    it("compares this phone's people with the backup's, both excluding the Bin", async () => {
      const exec = nodeSqliteExecutor(openTestDb());
      await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
        now: "2026-08-25 12:00:00",
        newUid: (() => {
          let n = 0;
          return () => `uid-${++n}`;
        })(),
      });
      for (const [uid, tracking, archived] of [
        ["phone-bound", 1, null],
        ["phone-unbound", 0, null],
        ["phone-binned", 1, "2026-08-20 12:00:00"],
      ] as const)
        await exec.runAsync(
          "INSERT INTO contacts (uid,name,tracking_enabled,interval_days,archived_at,created_at,modified_at) VALUES (?,?,?,30,?,?,?)",
          [
            uid,
            uid,
            tracking,
            archived,
            "2026-08-25 12:00:00",
            "2026-08-25 12:00:00",
          ],
        );
      const candidate = await loadBackupForRestorePreview(exec, {
        contents: JSON.stringify(file),
      });
      expect(candidate.status).toBe("ready");
      if (candidate.status !== "ready") return;
      expect(candidate.preview).toMatchObject({
        phoneContacts: 2,
        backupContacts: 2,
        // Every contact row the file carries, Bin included, stays as before.
        contactCount: 3,
      });
    });

    it("counts every linked entity the manifest carries, not a hand list", () => {
      const candidate = loadBackupForRestore({
        contents: JSON.stringify(file),
      });
      expect(candidate.status).toBe("ready");
      if (candidate.status !== "ready") return;
      expect(candidate.preview.backupContacts).toBe(2);
      // categories (1) + events (1) + systems (1); contacts and tombstones
      // are counted on their own lines.
      expect(candidate.preview.relatedRowCount).toBe(3);
      expect(candidate.preview.tombstoneCount).toBe(1);
    });
  });

  it("returns only aggregate metadata after wholly validating plaintext content", () => {
    expect(
      loadBackupForPreview({ contents: JSON.stringify(manifest) }),
    ).toEqual({
      status: "ready",
      preview: {
        exportedAt: manifest.metadata.exportedAt,
        // The file's own version (38.10 D-136 O14), not the converted one.
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
    expect(
      loadBackupForPreview({
        contents: JSON.stringify({ encrypted: true }),
        passphrase: "correct horse battery staple",
        crypto: crypto as never,
      }),
    ).toEqual({
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
      [
        "content://backup/orbit-auto-2026-08-24T00-00-00-000Z.json",
        JSON.stringify({
          encrypted: true,
          passphrase: "old",
          plaintext: JSON.stringify(manifest),
        }),
      ],
    ]);
    const passphrases = {
      active: "old",
      pending: null as null | {
        oldPassphrase: string;
        nextPassphrase: string;
        replacements: ReadonlyArray<{
          sourceUri: string;
          replacementUri: string;
        }>;
      },
    };
    const crypto = {
      decrypt: ({
        passphrase,
        envelope,
      }: {
        passphrase: string;
        envelope: unknown;
      }) => {
        const input = envelope as { passphrase: string; plaintext: string };
        if (passphrase !== input.passphrase)
          throw new Error("wrong passphrase");
        return new TextEncoder().encode(input.plaintext);
      },
      encrypt: ({
        passphrase,
        plaintext,
      }: {
        passphrase: string;
        plaintext: Uint8Array;
      }) => ({
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
        getPassphrase: async () => ({
          status: "present" as const,
          passphrase: passphrases.active,
        }),
        setPassphrase: async (value) => {
          events.push("activate-new");
          passphrases.active = value;
        },
        deletePassphrase: async () => {},
        getPendingPassphraseChange: async () =>
          passphrases.pending === null
            ? { status: "absent" as const }
            : { status: "present" as const, change: passphrases.pending },
        setPendingPassphraseChange: async (change) => {
          events.push("journal");
          passphrases.pending = change;
        },
        clearPendingPassphraseChange: async () => {
          events.push("clear-journal");
          passphrases.pending = null;
        },
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
        remove: async (uri) => {
          events.push("remove-old");
          entries.delete(uri);
        },
      },
    });

    await expect(
      service.change({ currentPassphrase: "old", nextPassphrase: "new" }),
    ).resolves.toEqual({ status: "changed", reencryptedCount: 1 });
    expect(events).toEqual([
      "journal",
      "write-verified",
      "journal",
      "remove-old",
      "activate-new",
      "clear-journal",
    ]);
    expect([...entries.values()]).toEqual([
      expect.stringContaining('"passphrase":"new"'),
    ]);
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
        getPassphrase: async () => ({
          status: "present" as const,
          passphrase: active,
        }),
        setPassphrase: async (value) => {
          active = value;
        },
        deletePassphrase: async () => {},
        getPendingPassphraseChange: async () =>
          pending === null
            ? { status: "absent" as const }
            : { status: "present" as const, change: pending as never },
        setPendingPassphraseChange: async (change) => {
          pending = change;
        },
        clearPendingPassphraseChange: async () => {
          pending = null;
        },
      },
      storage: {
        list: async () => [
          "content://backup/orbit-auto-2026-08-24T00-00-00-000Z.json",
        ],
        read: async () => {
          throw new Error("SAF permission revoked");
        },
        writeVerified: async () => "content://backup/new.json",
        remove: async () => {},
      },
    });

    await expect(
      service.change({ currentPassphrase: "old", nextPassphrase: "new" }),
    ).resolves.toEqual({ status: "needs-recovery" });
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
    mocks.buildExportReport.mockClear();
    const writeVerified = vi.fn();
    const service = createAutomaticBackupService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      now: new Date("2026-08-25T00:00:00.000Z"),
      readPhotoBase64: async () => "",
      directoryUri: "content://backup",
      retentionDays: 7,
      storage: { writeVerified, list: async () => [], remove: async () => {} },
      encryption: {
        enabled: true,
        passphrase: {
          status: "unavailable",
          reason: "secure-store-read-failed",
        },
        encrypt: () => "never",
      },
    });

    await expect(service.writeVerifiedSnapshot()).resolves.toEqual({
      status: "blocked",
      reason: "passphrase-unavailable",
    });
    expect(writeVerified).not.toHaveBeenCalled();
    expect(mocks.buildExportReport).not.toHaveBeenCalled();
  });

  it("keeps the flag independent from the three passphrase read states", () => {
    expect(
      resolveWriteEncryptionMode(false, {
        status: "unavailable",
        reason: "secure-store-read-failed",
      }),
    ).toEqual({ mode: "plaintext" });
    expect(resolveWriteEncryptionMode(true, { status: "absent" })).toEqual({
      mode: "blocked",
      reason: "passphrase-absent",
    });
    expect(
      resolveWriteEncryptionMode(true, {
        status: "present",
        passphrase: "secret",
      }),
    ).toEqual({ mode: "encrypted", passphrase: "secret" });
  });

  it("compensates a failed enable and never clears an enabled flag before SecureStore deletion", async () => {
    const calls: string[] = [];
    const lifecycle = createBackupEncryptionLifecycle(
      {
        getPassphrase: async () => ({ status: "absent" }),
        setPassphrase: async () => {
          calls.push("set-secret");
        },
        deletePassphrase: async () => {
          calls.push("delete-secret");
        },
      },
      {
        getEncryptionEnabled: async () => false,
        setEncryptionEnabled: async () => {
          calls.push("set-flag");
          throw new Error("sqlite unavailable");
        },
      },
    );
    await expect(lifecycle.enable("secret")).resolves.toEqual({
      status: "failed",
      reason: "flag-update-failed",
    });
    expect(calls).toEqual(["set-secret", "set-flag", "delete-secret"]);
  });

  it("serializes queued lifecycle operations", async () => {
    const order: string[] = [];
    let release!: () => void;
    const first = withBackupServiceLock(async () => {
      order.push("first-start");
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      order.push("first-end");
    });
    const second = withBackupServiceLock(async () => {
      order.push("second");
    });
    await Promise.resolve();
    expect(order).toEqual(["first-start"]);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });
});

describe("skipped photos reach every writer's result (38.6 D-24)", () => {
  beforeEach(() => {
    mocks.buildExportReport
      .mockReset()
      .mockResolvedValue({ manifest, skippedPhotos: 2 });
  });

  it("manual share carries the report's count", async () => {
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        retireAll: async () => {},
        retireStale: async () => {},
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => JSON.stringify(manifest),
          delete: async () => {},
        }),
      },
      share: { isAvailable: async () => true, open: async () => {} },
    });
    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "shared",
      skippedPhotos: 2,
    });
  });

  it("the automatic snapshot and the pre-restore snapshot carry the count", async () => {
    const deps = {
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      now: new Date("2026-08-25T00:00:00.000Z"),
      readPhotoBase64: async () => "",
      directoryUri: "content://backup",
      retentionDays: 7,
      storage: {
        writeVerified: vi.fn(async () => "content://backup/f"),
        list: async () => [],
        remove: async () => {},
      },
    };
    await expect(
      createAutomaticBackupService(deps).writeVerifiedSnapshot(),
    ).resolves.toMatchObject({ status: "written", skippedPhotos: 2 });
    await expect(
      createVerifiedPreRestoreSnapshot(deps)(),
    ).resolves.toMatchObject({ status: "written", skippedPhotos: 2 });
  });
});

// 38.6 D-29 through the real export: only a missing or empty photo (the reader
// resolves "") is skipped and counted. An existing photo whose read fails
// fails every writer, so retention never prunes against a photo-less backup.
describe("only missing photos are skipped, in every writer (38.6 D-29)", () => {
  const NOW = manifest.metadata.exportedAt;
  let exec: ReturnType<typeof nodeSqliteExecutor>;
  beforeEach(async () => {
    const actual = await vi.importActual<typeof ExportManifestModule>(
      "@/backup/export-manifest",
    );
    mocks.buildExportReport
      .mockReset()
      .mockImplementation(actual.buildExportReport);
    exec = nodeSqliteExecutor(openTestDb());
    let count = 0;
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: () => `uid-${++count}`,
    });
    for (const uid of ["kept", "lost"])
      await exec.runAsync(
        "INSERT INTO contacts (uid, name, interval_days, photo, created_at, modified_at) VALUES (?, ?, 7, ?, ?, ?)",
        [uid, uid, `avatars/${uid}.jpg`, NOW, NOW],
      );
  });

  // "lost" is missing; "kept" reads, unless `broken` makes it fail.
  const reader =
    (broken: boolean) =>
    async (relative: string): Promise<string> => {
      if (relative === "avatars/lost.jpg") return "";
      if (broken) throw new Error("EIO");
      return "AQID";
    };
  const manualDeps = (broken: boolean) => {
    const written: string[] = [];
    const open = vi.fn(async () => {});
    const service = createManualExportService({
      exec,
      exportedAt: NOW,
      readPhotoBase64: reader(broken),
      files: {
        retireAll: async () => {},
        retireStale: async () => {},
        create: async () => ({
          uri: "file:///export.json",
          write: async (contents: string) => {
            written.push(contents);
          },
          read: async () => written[0] ?? "",
          delete: async () => {},
        }),
      },
      share: { isAvailable: async () => true, open },
    });
    return { service, written, open };
  };
  const automaticDeps = (broken: boolean) => ({
    exec,
    exportedAt: NOW,
    now: new Date("2026-08-25T00:00:00.000Z"),
    readPhotoBase64: reader(broken),
    directoryUri: "content://backup",
    retentionDays: 7,
    storage: {
      writeVerified: vi.fn(async () => "content://backup/f"),
      list: vi.fn(async () => [
        "content://backup/orbit-auto-2020-01-01T00-00-00-000Z.json",
      ]),
      remove: vi.fn(async () => {}),
    },
  });

  it("manual export skips and counts a missing photo", async () => {
    const { service, written } = manualDeps(false);
    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "shared",
      skippedPhotos: 1,
    });
    const shared = JSON.parse(written[0]!);
    const byUid = Object.fromEntries(
      shared.contacts.map((row: { uid: string }) => [row.uid, row]),
    );
    expect(byUid.lost).toMatchObject({ photoBase64: null, photoSkipped: true });
    expect(byUid.kept.photoBase64).toBe("AQID");
  });

  it("manual export fails and shares nothing when an existing photo cannot be read", async () => {
    const { service, written, open } = manualDeps(true);
    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "export-failed",
    });
    expect(written).toEqual([]);
    expect(open).not.toHaveBeenCalled();
    await expect(
      mocks.buildExportReport.mock.results[0]!.value,
    ).rejects.toBeInstanceOf(BackupPhotoUnreadableError);
  });

  it.each([
    [
      "automatic backup",
      (deps: ReturnType<typeof automaticDeps>) =>
        createAutomaticBackupService(deps).writeVerifiedSnapshot(),
    ],
    [
      "pre-restore safety snapshot",
      (deps: ReturnType<typeof automaticDeps>) =>
        createVerifiedPreRestoreSnapshot(deps)(),
    ],
  ])("%s skips and counts a missing photo", async (_name, write) => {
    const deps = automaticDeps(false);
    await expect(write(deps)).resolves.toMatchObject({
      status: "written",
      skippedPhotos: 1,
    });
    expect(deps.storage.writeVerified).toHaveBeenCalledTimes(1);
    // Retention runs after a good write, which is why a bad one must fail.
    expect(deps.storage.remove).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "automatic backup",
      (deps: ReturnType<typeof automaticDeps>) =>
        createAutomaticBackupService(deps).writeVerifiedSnapshot(),
    ],
    [
      "pre-restore safety snapshot",
      (deps: ReturnType<typeof automaticDeps>) =>
        createVerifiedPreRestoreSnapshot(deps)(),
    ],
  ])(
    "%s fails, writes nothing and prunes nothing when an existing photo cannot be read",
    async (_name, write) => {
      const deps = automaticDeps(true);
      await expect(write(deps)).resolves.toEqual({ status: "failed" });
      expect(deps.storage.writeVerified).not.toHaveBeenCalled();
      expect(deps.storage.remove).not.toHaveBeenCalled();
      await expect(
        mocks.buildExportReport.mock.results[0]!.value,
      ).rejects.toBeInstanceOf(BackupPhotoUnreadableError);
    },
  );
});

describe("over-cap encrypted backups report too-large (38.6 D-39)", () => {
  beforeEach(() => {
    mocks.buildExportReport
      .mockReset()
      .mockResolvedValue({ manifest, skippedPhotos: 0 });
  });
  const overCap = () => {
    throw new BackupEnvelopeError("too-large");
  };

  it("manual encrypted export returns too-large and creates no staged file", async () => {
    const create = vi.fn();
    const open = vi.fn();
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: { retireAll: async () => {}, retireStale: async () => {}, create },
      share: { isAvailable: async () => true, open },
      encryption: {
        enabled: true,
        passphrase: { status: "present", passphrase: "secret" },
        crypto: {
          encrypt: overCap,
          decrypt: vi.fn(),
          measurePbkdf2: vi.fn(),
        } as never,
        profile: {} as never,
      },
    });
    await expect(service.shareExport()).resolves.toEqual({
      status: "too-large",
    });
    expect(create).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("any other encryption failure is still export-failed", async () => {
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        retireAll: async () => {},
        retireStale: async () => {},
        create: vi.fn(),
      },
      share: { isAvailable: async () => true, open: vi.fn() },
      encryption: {
        enabled: true,
        passphrase: { status: "present", passphrase: "secret" },
        crypto: {
          encrypt: () => {
            throw new BackupEnvelopeError("encryption-failed");
          },
          decrypt: vi.fn(),
          measurePbkdf2: vi.fn(),
        } as never,
        profile: {} as never,
      },
    });
    await expect(service.shareExport()).resolves.toEqual({
      status: "export-failed",
    });
  });

  it("the automatic and pre-restore snapshots return too-large and write nothing", async () => {
    const writeVerified = vi.fn();
    const deps = {
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      now: new Date("2026-08-25T00:00:00.000Z"),
      readPhotoBase64: async () => "",
      directoryUri: "content://backup",
      retentionDays: 7,
      storage: { writeVerified, list: async () => [], remove: async () => {} },
      encryption: {
        enabled: true,
        passphrase: { status: "present" as const, passphrase: "secret" },
        encrypt: overCap,
      },
    };
    await expect(
      createAutomaticBackupService(deps).writeVerifiedSnapshot(),
    ).resolves.toEqual({ status: "too-large" });
    await expect(createVerifiedPreRestoreSnapshot(deps)()).resolves.toEqual({
      status: "too-large",
    });
    expect(writeVerified).not.toHaveBeenCalled();
  });

  function reencryptionHarness(sources: ReadonlyArray<[string, string]>) {
    const entries = new Map<string, string>(sources);
    const state = {
      active: "old",
      pending: null as null | {
        oldPassphrase: string;
        nextPassphrase: string;
        replacements: ReadonlyArray<{
          sourceUri: string;
          replacementUri: string;
        }>;
      },
    };
    const service = createAutomaticBackupReencryptionService({
      directoryUri: "content://backup",
      now: new Date("2026-08-25T00:00:00.000Z"),
      crypto: {
        decrypt: ({ envelope }: { envelope: unknown }) =>
          new TextEncoder().encode(
            (envelope as { plaintext: string }).plaintext,
          ),
        // The real cap check, keyed on a marker so one source is over the cap.
        encrypt: ({
          passphrase,
          plaintext,
        }: {
          passphrase: string;
          plaintext: Uint8Array;
        }) => {
          const text = new TextDecoder().decode(plaintext);
          if (text.includes('"oversized":true'))
            throw new BackupEnvelopeError("too-large");
          return { encrypted: true, passphrase, plaintext: text };
        },
      } as never,
      profile: { formatVersion: 1 } as never,
      passphrases: {
        getPassphrase: async () => ({
          status: "present" as const,
          passphrase: state.active,
        }),
        setPassphrase: async (value) => {
          state.active = value;
        },
        deletePassphrase: async () => {},
        getPendingPassphraseChange: async () =>
          state.pending === null
            ? { status: "absent" as const }
            : { status: "present" as const, change: state.pending },
        setPendingPassphraseChange: async (change) => {
          state.pending = change;
        },
        clearPendingPassphraseChange: async () => {
          state.pending = null;
        },
      },
      storage: {
        list: async () => [...entries.keys()],
        read: async (uri) => entries.get(uri)!,
        writeVerified: async (_directory, name, contents) => {
          const uri = `content://backup/${name}`;
          entries.set(uri, contents);
          return uri;
        },
        remove: async (uri) => {
          entries.delete(uri);
        },
      },
    });
    return { entries, state, service };
  }
  // A plaintext automatic backup written while encryption was off.
  const oversizedPlaintext = JSON.stringify({ ...manifest, oversized: true });

  it("a passphrase change over an over-cap plaintext source returns too-large, keeps the passphrase and drops the unused journal (WR5-03)", async () => {
    const source = "content://backup/orbit-auto-2026-08-24T00-00-00-000Z.json";
    const { entries, state, service } = reencryptionHarness([
      [source, oversizedPlaintext],
    ]);
    await expect(
      service.change({ currentPassphrase: "old", nextPassphrase: "new" }),
    ).resolves.toEqual({ status: "too-large" });
    expect(state.active).toBe("old");
    expect(state.pending).toBeNull();
    expect([...entries.entries()]).toEqual([[source, oversizedPlaintext]]);
    // A different new passphrase is not blocked by a stale journal.
    await expect(
      service.change({ currentPassphrase: "old", nextPassphrase: "other" }),
    ).resolves.toEqual({ status: "too-large" });
  });

  it("keeps the journal when a replacement was already written before the over-cap source (WR5-03)", async () => {
    const small = "content://backup/orbit-auto-2026-08-23T00-00-00-000Z.json";
    const big = "content://backup/orbit-auto-2026-08-24T00-00-00-000Z.json";
    const { entries, state, service } = reencryptionHarness([
      [small, JSON.stringify(manifest)],
      [big, oversizedPlaintext],
    ]);
    await expect(
      service.change({ currentPassphrase: "old", nextPassphrase: "new" }),
    ).resolves.toEqual({ status: "too-large" });
    expect(state.active).toBe("old");
    expect(state.pending?.replacements).toHaveLength(1);
    expect(state.pending?.replacements[0]?.sourceUri).toBe(small);
    expect(entries.has(small)).toBe(false);
    expect(entries.get(big)).toBe(oversizedPlaintext);
  });

  // 38.12 D-116 / D-136: re-encryption finds old and new automatic names,
  // gives every same-run replacement its own owned name, and never touches a
  // manual export saved in the backup folder.
  it("re-encrypts old and new automatic names into distinct owned replacements and leaves a manual export alone", async () => {
    const manual = "content://backup/orbit-backup-2026-08-24-0930.json";
    const legacyManual = "content://backup/orbit-backup-1756000000000.json";
    const sources = [
      "content://backup/orbit-auto-2026-08-22T00-00-00-000Z.json",
      "content://backup/orbit-auto-2026-08-23-0930.json",
      "content://backup/orbit-auto-2026-08-23-0930-2.json",
    ];
    const { entries, state, service } = reencryptionHarness([
      ...sources.map((uri): [string, string] => [
        uri,
        JSON.stringify(manifest),
      ]),
      [manual, "manual export"],
      [legacyManual, "older manual export"],
    ]);
    await expect(
      service.change({ currentPassphrase: "old", nextPassphrase: "new" }),
    ).resolves.toEqual({ status: "changed", reencryptedCount: 3 });
    expect(state.active).toBe("new");
    const base = automaticBackupFileName(new Date("2026-08-25T00:00:00.000Z"));
    const stem = base.replace(/\.json$/, "");
    const replacements = [...entries.keys()]
      .filter((uri) => uri !== manual && uri !== legacyManual)
      .map((uri) => uri.split("/").pop()!);
    expect(replacements.sort()).toEqual(
      [base, `${stem}-2.json`, `${stem}-3.json`].sort(),
    );
    for (const name of replacements)
      expect(isOwnedAutomaticBackupName(name)).toBe(true);
    for (const uri of sources) expect(entries.has(uri)).toBe(false);
    expect(entries.get(manual)).toBe("manual export");
    expect(entries.get(legacyManual)).toBe("older manual export");
  });

  it("writes a readable local automatic name, suffixes a same-minute collision, and prunes only expired automatic names", async () => {
    const now = new Date("2026-08-25T00:00:00.000Z");
    const base = automaticBackupFileName(now);
    const folder = [
      `content://backup/${base}`,
      "content://backup/orbit-auto-2020-01-01T00-00-00-000Z.json",
      "content://backup/orbit-auto-2020-01-02-0930.json",
      "content://backup/orbit-backup-2020-01-01-0930.json",
      "content://backup/orbit-backup-1577836800000.json",
    ];
    const removed: string[] = [];
    const writeVerified = vi.fn(
      async (_directory: string, name: string) => `content://backup/${name}`,
    );
    const service = createAutomaticBackupService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      now,
      readPhotoBase64: async () => "",
      directoryUri: "content://backup",
      retentionDays: 7,
      storage: {
        writeVerified,
        list: async () => folder,
        remove: async (uri) => {
          removed.push(uri);
        },
      },
    });
    const suffixed = base.replace(/\.json$/, "-2.json");
    await expect(service.writeVerifiedSnapshot()).resolves.toMatchObject({
      status: "written",
      filename: suffixed,
    });
    expect(base).toMatch(/^orbit-auto-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    expect(writeVerified).toHaveBeenCalledWith(
      "content://backup",
      suffixed,
      expect.any(String),
    );
    expect(removed.sort()).toEqual(
      [
        "content://backup/orbit-auto-2020-01-01T00-00-00-000Z.json",
        "content://backup/orbit-auto-2020-01-02-0930.json",
      ].sort(),
    );
  });

  it("pins the device-local health diagnostic the Backup card reads", () => {
    expect(AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC).toBe(
      "The latest automatic backup was too large to create.",
    );
  });
});
