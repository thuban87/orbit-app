import { beforeEach, describe, expect, it, vi } from "vitest";

const { text, remove } = vi.hoisted(() => ({ text: vi.fn(), remove: vi.fn() }));
vi.mock("expo-file-system", () => ({
  File: class {
    text = text;
    delete = remove;
  },
}));

import { readRestoreDocument } from "./backup-restore-document";

describe("readRestoreDocument", () => {
  beforeEach(() => {
    text.mockReset();
    remove.mockReset();
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
});
