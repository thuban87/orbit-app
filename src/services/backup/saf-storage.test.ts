import { beforeEach, describe, expect, it, vi } from "vitest";

const legacy = vi.hoisted(() => ({
  createFileAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  readDirectoryAsync: vi.fn(),
  deleteAsync: vi.fn(),
  requestDirectoryPermissionsAsync: vi.fn(),
}));

vi.mock("expo-file-system/legacy", () => ({
  StorageAccessFramework: legacy,
}));
vi.mock("react-native", () => ({
  Linking: { canOpenURL: vi.fn(), openURL: vi.fn() },
}));
vi.mock("../../../modules/orbit-backup-document-picker", () => ({
  createBackupFolderDocument: vi.fn(),
  writeBackupFolderDocument: vi.fn(),
  readBackupFolderDocument: vi.fn(),
  deleteBackupFolderDocument: vi.fn(),
  listBackupFolderEntries: vi.fn(),
}));

import { type BackupFolderNative, createSafStorage } from "./saf-storage";

const DRIVE_TREE =
  "content://com.google.android.apps.docs.storage/tree/acc%3D1%3Bdoc%3Dencoded%3Dfolder";
const DRIVE_DOC =
  "content://com.google.android.apps.docs.storage/tree/acc%3D1%3Bdoc%3Dencoded%3Dfolder/document/acc%3D1%3Bdoc%3Dencoded%3Dfile";

function fakeNative(overrides: Partial<BackupFolderNative> = {}) {
  const files = new Map<string, string>();
  const native: BackupFolderNative = {
    createDocument: vi.fn(async () => {
      files.set(DRIVE_DOC, "");
      return DRIVE_DOC;
    }),
    write: vi.fn(async (uri: string, contents: string) => {
      files.set(uri, contents);
    }),
    read: vi.fn(async (uri: string) => files.get(uri) ?? ""),
    remove: vi.fn(async (uri: string) => {
      files.delete(uri);
    }),
    list: vi.fn(async () => [
      {
        uri: DRIVE_DOC,
        name: "orbit-auto-2026-10-18-0509.json",
        mimeType: "application/json",
      },
    ]),
    ...overrides,
  };
  return { native, files };
}

describe("createSafStorage — 38.12 D-158 backup folder I/O on any provider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates, writes and reads back through the native module, never expo's SAF", async () => {
    const { native } = fakeNative();
    const storage = createSafStorage(native);
    const uri = await storage.writeVerified(
      DRIVE_TREE,
      "orbit-auto-2026-10-18-0609.json",
      '{"ok":true}',
    );
    expect(uri).toBe(DRIVE_DOC);
    // The full name with ".json": Drive keeps names exactly as given.
    expect(native.createDocument).toHaveBeenCalledWith(
      DRIVE_TREE,
      "orbit-auto-2026-10-18-0609.json",
      "application/json",
    );
    expect(native.write).toHaveBeenCalledWith(DRIVE_DOC, '{"ok":true}');
    expect(native.read).toHaveBeenCalledWith(DRIVE_DOC);
    expect(legacy.createFileAsync).not.toHaveBeenCalled();
    expect(legacy.writeAsStringAsync).not.toHaveBeenCalled();
    expect(legacy.readAsStringAsync).not.toHaveBeenCalled();
  });

  it("removes the new file when the write or read-back fails, then rethrows", async () => {
    const { native, files } = fakeNative({
      write: vi.fn(async () => {
        throw new Error("refused");
      }),
    });
    const storage = createSafStorage(native);
    await expect(
      storage.writeVerified(DRIVE_TREE, "orbit-auto-x.json", "{}"),
    ).rejects.toThrow("refused");
    expect(native.remove).toHaveBeenCalledWith(DRIVE_DOC);
    expect(files.has(DRIVE_DOC)).toBe(false);
  });

  it("fails verification on unparseable read-back and keeps no partial file", async () => {
    const { native } = fakeNative({ read: vi.fn(async () => "{trunc") });
    await expect(
      createSafStorage(native).writeVerified(DRIVE_TREE, "a.json", "{}"),
    ).rejects.toThrow();
    expect(native.remove).toHaveBeenCalledWith(DRIVE_DOC);
  });

  it("lists by provider display name and treats a failed listing as a failure", async () => {
    const { native } = fakeNative();
    expect(await createSafStorage(native).list(DRIVE_TREE)).toEqual([
      { uri: DRIVE_DOC, name: "orbit-auto-2026-10-18-0509.json" },
    ]);
    const failing = fakeNative({ list: vi.fn(async () => null) }).native;
    await expect(createSafStorage(failing).list(DRIVE_TREE)).rejects.toThrow();
    expect(legacy.readDirectoryAsync).not.toHaveBeenCalled();
  });

  it("reads and deletes through the native module", async () => {
    const { native, files } = fakeNative();
    files.set(DRIVE_DOC, "{}");
    const storage = createSafStorage(native);
    expect(await storage.read(DRIVE_DOC)).toBe("{}");
    await storage.remove(DRIVE_DOC);
    expect(native.remove).toHaveBeenCalledWith(DRIVE_DOC);
    expect(legacy.deleteAsync).not.toHaveBeenCalled();
  });
});
