import { describe, expect, it, vi } from "vitest";

vi.mock("expo-file-system", () => ({
  Directory: class {},
  File: class {},
  Paths: {},
}));
vi.mock("./share-export", () => ({ createLocalExportFiles: vi.fn() }));

import {
  createBackupCacheSweep,
  EXPORT_STAGING_GRACE_MS,
} from "./backup-cache-sweep";

describe("backup cache sweep", () => {
  it("passes the 24-hour boundary to export retirement and deletes only prior-process restore copies", async () => {
    const now = 200_000_000;
    const removed: string[] = [];
    const retireStaleExports = vi.fn(async (at: number, grace: number) => {
      expect(at).toBe(now);
      expect(grace).toBe(24 * 60 * 60 * 1000);
    });
    const entries = [
      {
        name: "restore-share-old.json",
        createdAtMs: 100,
        delete: () => removed.push("old"),
      },
      {
        name: "restore-share-current.json",
        createdAtMs: 1000,
        delete: () => removed.push("current"),
      },
      {
        name: "someone-else.json",
        createdAtMs: 100,
        delete: () => removed.push("other"),
      },
    ];
    await createBackupCacheSweep(
      { retireStaleExports, listRestoreCandidates: () => entries },
      () => now,
      1000,
    )();
    expect(retireStaleExports).toHaveBeenCalledOnce();
    expect(removed).toEqual(["old"]);
    expect(EXPORT_STAGING_GRACE_MS).toBe(86_400_000);
  });
});
