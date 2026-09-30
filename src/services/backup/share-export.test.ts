import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  names: [] as string[],
  removed: [] as string[],
  events: [] as string[],
  /** Photo reads by URI: bytes, or an Error the native read rejects with. */
  reads: new Map<string, string | Error>(),
  /** Relative paths `photoFileExists` reports as present. */
  present: new Set<string>(),
}));
vi.mock("expo-file-system", () => {
  class File {
    name: string;
    uri: string;
    exists = true;
    modificationTime = 0;
    parent: unknown;
    constructor(parent: unknown, name: string) {
      this.parent = parent;
      this.name = name;
      this.uri = `file:///cache/backup-exports/${name}`;
    }
    delete() {
      state.removed.push(this.name);
      state.events.push(`delete:${this.name}`);
    }
    write() {}
    text() {
      return Promise.resolve("");
    }
    base64() {
      const read = state.reads.get(String(this.parent));
      if (read === undefined)
        return Promise.reject(new Error("FileNotFound (native)"));
      return read instanceof Error
        ? Promise.reject(read)
        : Promise.resolve(read);
    }
  }
  class Directory {
    exists = true;
    create() {}
    list() {
      return state.names.map((name) => new File(this, name));
    }
  }
  return { File, Directory, Paths: { cache: "file:///cache" } };
});
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("../../../modules/orbit-backup-share", () => ({
  shareBackupExport: vi.fn(),
  revokeBackupExportShare: (uri: string) => {
    state.events.push(`revoke:${uri.split("/").pop()}`);
  },
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoUri: (relative: string) => `file:///doc/${relative}`,
  photoFileExists: (relative: string) => state.present.has(relative),
}));
vi.mock("@/services/photos/background-storage", () => ({
  resolveBackgroundUri: (relative: string) => `file:///doc/${relative}`,
}));

import { createLocalExportFiles, readStoredPhotoBase64 } from "./share-export";

describe("local export staging", () => {
  beforeEach(() => {
    state.names = [];
    state.removed = [];
    state.events = [];
  });

  it("retires only owned files at the 24-hour grace boundary", async () => {
    const now = 200_000_000;
    const grace = 86_400_000;
    state.names = [
      `orbit-backup-${now - grace}.json`,
      `orbit-backup-${now - grace + 1}.json`,
      "other-file.json",
      "orbit-backup-invalid.json",
    ];
    await createLocalExportFiles().retireStale(now, grace);
    expect(state.removed).toEqual([`orbit-backup-${now - grace}.json`]);
  });

  it("next export retires only prior app-owned staging", async () => {
    state.names = ["orbit-backup-123.json", "unrelated.json"];
    await createLocalExportFiles().retireAll();
    expect(state.removed).toEqual(["orbit-backup-123.json"]);
  });

  it("revokes the chosen share target's grant before deleting (ADR-155)", async () => {
    state.names = ["orbit-backup-123.json"];
    await createLocalExportFiles().retireAll();
    expect(state.events).toEqual([
      "revoke:orbit-backup-123.json",
      "delete:orbit-backup-123.json",
    ]);
  });
});

// 38.6 D-29: the production photo reader tells a genuinely missing or empty
// file ("", skipped and counted by the export) from any other read failure
// (rejects, so the backup fails with BackupPhotoUnreadableError).
describe("readStoredPhotoBase64", () => {
  const photo = "avatars/contact-7.jpg";
  const uri = `file:///doc/${photo}`;
  beforeEach(() => {
    state.reads.clear();
    state.present.clear();
  });

  it("returns the stored bytes", async () => {
    state.present.add(photo);
    state.reads.set(uri, "AQID");
    await expect(readStoredPhotoBase64(photo)).resolves.toBe("AQID");
  });

  it('resolves "" for a missing file', async () => {
    await expect(readStoredPhotoBase64(photo)).resolves.toBe("");
  });

  it('resolves "" for an empty file', async () => {
    state.present.add(photo);
    state.reads.set(uri, "");
    await expect(readStoredPhotoBase64(photo)).resolves.toBe("");
  });

  it("rejects when a file that exists cannot be read", async () => {
    state.present.add(photo);
    const failure = new Error("EACCES");
    state.reads.set(uri, failure);
    await expect(readStoredPhotoBase64(photo)).rejects.toBe(failure);
  });

  it("treats a file deleted during the read as missing (checked after the failure)", async () => {
    state.reads.set(uri, new Error("vanished mid-read"));
    await expect(readStoredPhotoBase64(photo)).resolves.toBe("");
  });

  it("still rejects for a missing profile background (D-27)", async () => {
    await expect(
      readStoredPhotoBase64("profile-backgrounds/bg-1.jpg"),
    ).rejects.toThrow("FileNotFound");
  });
});
