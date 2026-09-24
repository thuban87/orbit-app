import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  names: [] as string[],
  removed: [] as string[],
}));
vi.mock("expo-file-system", () => {
  class File {
    name: string;
    uri: string;
    exists = true;
    modificationTime = 0;
    constructor(_parent: unknown, name: string) {
      this.name = name;
      this.uri = `file:///cache/backup-exports/${name}`;
    }
    delete() {
      state.removed.push(this.name);
    }
    write() {}
    text() {
      return Promise.resolve("");
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
vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoUri: vi.fn(),
}));
vi.mock("@/services/photos/background-storage", () => ({
  resolveBackgroundUri: vi.fn(),
}));

import { createLocalExportFiles } from "./share-export";

describe("local export staging", () => {
  beforeEach(() => {
    state.names = [];
    state.removed = [];
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
});
