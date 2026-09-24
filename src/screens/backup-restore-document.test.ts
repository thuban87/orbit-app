import { beforeEach, describe, expect, it, vi } from "vitest";

const { text, remove, fileSize } = vi.hoisted(() => ({
  text: vi.fn(),
  remove: vi.fn(),
  fileSize: { value: 0 },
}));
vi.mock("expo-file-system", () => ({
  File: class {
    get size() {
      return fileSize.value;
    }
    text = text;
    delete = remove;
  },
}));

import { readRestoreDocument } from "./backup-restore-document";

describe("readRestoreDocument", () => {
  beforeEach(() => {
    text.mockReset();
    remove.mockReset();
    fileSize.value = 0;
  });

  it("deletes a successfully consumed restore copy", async () => {
    text.mockResolvedValue("backup");
    await expect(
      readRestoreDocument("file:///cache/restore-share-1.json"),
    ).resolves.toBe("backup");
    expect(remove).toHaveBeenCalledOnce();
  });

  it("deletes the copy after a read failure", async () => {
    text.mockRejectedValue(new Error("read failed"));
    await expect(
      readRestoreDocument("file:///cache/restore-share-1.json"),
    ).rejects.toThrow("read failed");
    expect(remove).toHaveBeenCalledOnce();
  });

  it("rejects an oversized copy before reading and deletes it", async () => {
    fileSize.value = 104_857_601;
    await expect(
      readRestoreDocument("file:///cache/restore-share-1.json"),
    ).rejects.toThrow("Backup ingress too large");
    expect(text).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledOnce();
  });
});
