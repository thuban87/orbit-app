/**
 * Phase 17's recovery regression reaches across the real restore writer,
 * SQLite journal, production photo-storage boundary, and launch-sweep registry.
 * The File/Directory implementation is the only native seam replaced here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  bytes: new Map<string, Uint8Array>(),
  operations: [] as string[],
}));

vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-file-system", () => {
  const joinUri = (parts: unknown[]) => parts
    .map((part) => typeof part === "string" ? part : (part as { uri: string }).uri)
    .map((part, index) => index === 0 ? part.replace(/\/+$/, "") : part.replace(/^\/+/, "").replace(/\/+$/, ""))
    .join("/");

  class File {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = joinUri(parts); }
    get name(): string { return this.uri.split("/").at(-1)!; }
    get exists(): boolean { return fs.bytes.has(this.uri); }
    async copy(destination: File): Promise<void> {
      fs.operations.push(`copy ${this.uri} -> ${destination.uri}`);
      const value = fs.bytes.get(this.uri);
      if (!value) throw new Error(`missing source ${this.uri}`);
      fs.bytes.set(destination.uri, value.slice());
    }
    async move(destination: File): Promise<void> {
      fs.operations.push(`move ${this.uri} -> ${destination.uri}`);
      const value = fs.bytes.get(this.uri);
      if (!value) throw new Error(`missing source ${this.uri}`);
      fs.bytes.delete(this.uri);
      fs.bytes.set(destination.uri, value);
      this.uri = destination.uri;
    }
    write(bytes: Uint8Array): void {
      fs.operations.push(`write ${this.uri}`);
      fs.bytes.set(this.uri, bytes.slice());
    }
    delete(): void {
      fs.operations.push(`delete ${this.uri}`);
      fs.bytes.delete(this.uri);
    }
  }

  class Directory {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = joinUri(parts); }
    create(): void {}
    get exists(): boolean { return [...fs.bytes.keys()].some((uri) => uri.startsWith(`${this.uri}/`)); }
    list(): File[] {
      const prefix = `${this.uri}/`;
      return [...fs.bytes.keys()]
        .filter((uri) => uri.startsWith(prefix) && !uri.slice(prefix.length).includes("/"))
        .map((uri) => new File(uri));
    }
  }

  return { Directory, File, Paths: { document: { uri: "file:///doc" } } };
});
vi.mock("@/services/notifications/notification-schedule", () => ({ reconcileSchedule: async () => {} }));
vi.mock("@/services/notifications/digest-schedule", () => ({ reconcileDigestSchedule: async () => {} }));

import { buildExportManifest } from "@/backup/export-manifest";
import { applyRestore } from "@/backup/restore-apply";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { __resetSweepForTest, runLaunchSweep } from "@/services/launch-sweep";
import { createAutomaticBackupService } from "@/services/backup/backup-service";
import { createBackupEnvelopeCrypto, type BackupEncryptionBackend } from "@/services/backup/encryption";
import { createBackupPassphraseStore } from "@/services/backup/passphrase-store";
import * as photoStorage from "@/services/photos/photo-storage";
import { registerRestorePhotoFinalizeSweep } from "@/services/photos/restore-photo-finalize-sweep";

const NOW = "2026-08-25 12:00:00";
const NEWER = "2026-08-25 12:01:00";
const OLDER = "2026-08-25 11:59:00";
const text = new TextEncoder();

function uidFactory() {
  let index = 0;
  return () => `runtime-${++index}`;
}

async function db(): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: uidFactory() });
  return exec;
}

async function insertContact(exec: SqlExecutor, uid: string, photo: string | null, modifiedAt: string): Promise<number> {
  await exec.runAsync(
    "INSERT INTO contacts (uid,name,photo,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?)",
    [uid, uid, photo, 7, 0, 0, NOW, modifiedAt],
  );
  return (await exec.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid=?", [uid]))!.id;
}

function file(relative: string): string { return `file:///doc/${relative}`; }
function bytes(relative: string): Uint8Array | undefined { return fs.bytes.get(file(relative)); }

beforeEach(() => {
  fs.bytes.clear();
  fs.operations = [];
  __resetSweepForTest();
  vi.restoreAllMocks();
});

describe("Phase 17 restore recovery through the production module boundaries", () => {
  it("recovers committed finalize and delete journal rows on the next launch after a post-commit process kill", async () => {
    const source = await db();
    await insertContact(source, "incoming-photo", "avatars/source.jpg", NEWER);
    await insertContact(source, "clear-photo", null, NEWER);
    const manifest = await buildExportManifest(source, {
      exportedAt: NOW,
      readPhotoBase64: async (relative) => relative === "avatars/source.jpg" ? "bmV3LWJ5dGVz" : "",
    });

    const destination = await db();
    await insertContact(destination, "clear-photo", "avatars/contact-old.jpg", OLDER);
    const legacyClearPath = "avatars/contact-old.jpg";
    fs.bytes.set(file(legacyClearPath), text.encode("old-clear-bytes"));

    const result = await applyRestore(destination, manifest, "merge", {
      sessionToken: "processkill",
      persistPhoto: async () => { throw new Error("process killed after commit"); },
      deleteCanonicalPhoto: () => {},
      canonicalPhotoExists: () => true,
    });
    expect(result).toMatchObject({ status: "applied", photosNeedingAttention: 1, photoCleanupPending: 1 });
    await expect(destination.getAllAsync("SELECT relative_path,action FROM restore_photo_journal ORDER BY id")).resolves.toEqual([
      { relative_path: "avatars/_restore_pending/contact-incoming-photo-processkill.jpg", action: "finalize" },
      { relative_path: `delete:${legacyClearPath}`, action: "delete" },
    ]);

    registerRestorePhotoFinalizeSweep(() => destination);
    await runLaunchSweep();

    const incomingId = (await destination.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid=?", ["incoming-photo"]))!.id;
    expect(bytes(photoStorage.contactPhotoRelPath(incomingId))).toEqual(text.encode("new-bytes"));
    expect(bytes(legacyClearPath)).toBeUndefined();
    await expect(destination.getAllAsync("SELECT * FROM restore_photo_journal")).resolves.toEqual([]);
    expect(photoStorage.listRestorePendingPhotos()).toEqual([]);
  });

  it("retains newer local canonical bytes when an older incoming photo loses reconciliation", async () => {
    const source = await db();
    await insertContact(source, "same-contact", "avatars/stale-source.jpg", OLDER);
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "c3RhbGUtYnl0ZXM=" });

    const destination = await db();
    const id = await insertContact(destination, "same-contact", "avatars/local.jpg", NEWER);
    const canonical = photoStorage.contactPhotoRelPath(id);
    await destination.runAsync("UPDATE contacts SET photo=? WHERE id=?", [canonical, id]);
    const original = text.encode("newer-local-bytes");
    fs.bytes.set(file(canonical), original);

    await expect(applyRestore(destination, manifest, "merge", { sessionToken: "stale" })).resolves.toMatchObject({ status: "applied" });
    expect(bytes(canonical)).toEqual(original);
    await expect(destination.getAllAsync("SELECT * FROM restore_photo_journal")).resolves.toEqual([]);
    expect(photoStorage.listRestorePendingPhotos()).toEqual([]);
  });

  it("garbage-collects an unjournaled staged file on launch without calling persistMaster", async () => {
    const exec = await db();
    const orphan = photoStorage.restorePendingRelPath({ kind: "contact", uid: "rolled-back" }, "orphan");
    await photoStorage.stageRestorePendingBase64("b3JwaGFuLWJ5dGVz", orphan);
    const persist = vi.spyOn(photoStorage, "persistMaster");

    registerRestorePhotoFinalizeSweep(() => exec);
    await runLaunchSweep();

    expect(bytes(orphan)).toBeUndefined();
    expect(persist).not.toHaveBeenCalled();
  });
});

describe("Phase 17 crypto failure boundaries", () => {
  it("fails an automatic encrypted write closed when the real SecureStore adapter becomes unavailable", async () => {
    const exec = await db();
    await exec.runAsync("UPDATE app_settings SET encryption_enabled=1 WHERE id=1");
    const cached = new Map([["orbit.backup.passphrase", "cached-passphrase"]]);
    const passphrases = createBackupPassphraseStore({
      getItemAsync: async () => {
        expect(cached.get("orbit.backup.passphrase")).toBe("cached-passphrase");
        throw new Error("keystore reset");
      },
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    });
    const writes = vi.fn();
    const service = createAutomaticBackupService({
      exec,
      exportedAt: NOW,
      now: new Date("2026-08-25T12:00:00.000Z"),
      readPhotoBase64: async () => "",
      directoryUri: "content://disposable-backup",
      retentionDays: 7,
      storage: { writeVerified: writes, list: async () => [], remove: async () => {} },
      encryption: { enabled: true, passphrase: await passphrases.getPassphrase(), encrypt: () => "must-not-run" },
    });

    await expect(service.writeVerifiedSnapshot()).resolves.toEqual({ status: "blocked", reason: "passphrase-unavailable" });
    expect(writes).not.toHaveBeenCalled();
    await expect(exec.getFirstAsync<{ encryption_enabled: number }>("SELECT encryption_enabled FROM app_settings WHERE id=1")).resolves.toEqual({ encryption_enabled: 1 });
  });

  it("rejects hostile KDF parameters and unknown envelope keys before the native PBKDF2 boundary", () => {
    const profile = { formatVersion: 77, cipher: "AES-256-GCM" as const, kdf: { id: "PBKDF2-HMAC-SHA256" as const, iterations: 1_000, derivedKeyLength: 32 }, saltLength: 16, ivLength: 12, maxCiphertextBytes: 1_024 };
    const backend: BackupEncryptionBackend = {
      randomBytes: (size) => new Uint8Array(size),
      deriveKey: vi.fn(() => new Uint8Array(32)),
      encryptGcm: () => ({ ciphertext: new Uint8Array([1]), tag: new Uint8Array(16) }),
      decryptGcm: () => new Uint8Array([1]),
    };
    const crypto = createBackupEnvelopeCrypto({ profiles: [profile], backend });
    const envelope = crypto.encrypt({ passphrase: "cached-passphrase", plaintext: new Uint8Array([1]), profile });
    const derive = backend.deriveKey as ReturnType<typeof vi.fn>;
    derive.mockClear();

    expect(() => crypto.decrypt({ passphrase: "cached-passphrase", envelope: { ...envelope, kdf: { ...envelope.kdf, iterations: 2 ** 31 } } })).toThrow();
    expect(derive).not.toHaveBeenCalled();
    expect(() => crypto.decrypt({ passphrase: "cached-passphrase", envelope: { ...envelope, unexpected: true } })).toThrow();
    expect(derive).not.toHaveBeenCalled();
  });
});
