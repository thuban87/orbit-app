import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ deletes: [] as string[] }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: { uri: "file:///data/cache" } },
  File: class {
    constructor(public uri: string) {}
    delete() {
      native.deletes.push(this.uri);
      throw new Error("native cleanup failure");
    }
  },
  Directory: class {},
}));

vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate: () => ({
      crop() {
        return this;
      },
      resize() {
        return this;
      },
      async renderAsync() {
        return {
          saveAsync: async () => ({
            uri: "file:///data/cache/ImageManipulator/crop.jpg",
          }),
        };
      },
    }),
  },
}));
vi.mock("@/services/photos/owned-master", () => ({
  persistOwnedMaster: vi.fn(),
  persistOwnedMasterLocked: vi.fn(),
}));

import {
  __resetDerivativeCacheSweepForTest,
  type DerivativeCacheFs,
  discardDerivative,
  sweepDerivativeCacheOncePerProcess,
} from "./derivative-cache";
import { persistOwnedMaster } from "./owned-master";
import { persistCroppedMaster } from "./photo-pipeline";

const cache = "file:///data/cache";
const crop = `${cache}/ImageManipulator/crop.jpg`;

function fakeFs(overrides: Partial<DerivativeCacheFs> = {}): DerivativeCacheFs {
  return {
    cacheUri: cache,
    delete: vi.fn(),
    list: vi.fn(() => []),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  native.deletes.length = 0;
  __resetDerivativeCacheSweepForTest();
});

describe("cache namespace retirement", () => {
  it("refuses masters, sidecars, staging, traversal, and unrelated cache files", () => {
    const fs = fakeFs();
    for (const uri of [
      "file:///data/doc/avatars/contact-1.jpg",
      "file:///data/doc/avatars/contact-1.jpg.tmp",
      "file:///data/doc/avatars/contact-1.jpg.bak",
      "file:///data/doc/import-staging/a.jpg",
      "file:///data/doc/reconcile-staging/a.jpg",
      `${cache}/ImageManipulator/../other.jpg`,
      `${cache}/other.jpg`,
    ])
      expect(discardDerivative(uri, fs)).toBe(false);
    expect(fs.delete).not.toHaveBeenCalled();
  });

  it("deletes only three owned cache namespaces and swallows delete failures", () => {
    const fs = fakeFs();
    for (const uri of [
      crop,
      `${cache}/contact-picker-123.photo`,
      `${cache}/photo-dl/a.jpg`,
    ]) {
      expect(discardDerivative(uri, fs)).toBe(true);
    }
    expect(fs.delete).toHaveBeenCalledTimes(3);
    expect(
      discardDerivative(
        crop,
        fakeFs({
          delete: () => {
            throw new Error("delete failed");
          },
        }),
      ),
    ).toBe(false);
  });

  it("sweeps only pre-process entries, once per process", () => {
    const old = Date.now() - 60_000;
    const current = Date.now() + 60_000;
    const fs = fakeFs({
      list: vi.fn((dir) =>
        dir.endsWith("/ImageManipulator")
          ? [
              { uri: crop, modificationTime: old },
              {
                uri: `${cache}/ImageManipulator/live.jpg`,
                modificationTime: current,
              },
            ]
          : dir.endsWith("/photo-dl")
            ? [{ uri: `${cache}/photo-dl/old.jpg`, modificationTime: old }]
            : [
                {
                  uri: `${cache}/contact-picker-old.photo`,
                  modificationTime: old,
                },
              ],
      ),
    });
    sweepDerivativeCacheOncePerProcess(fs);
    sweepDerivativeCacheOncePerProcess(fs);
    expect(fs.list).toHaveBeenCalledTimes(3);
    expect(fs.delete).toHaveBeenCalledTimes(3);
    expect(fs.delete).not.toHaveBeenCalledWith(
      `${cache}/ImageManipulator/live.jpg`,
    );
  });
});

describe("crop persist outcome", () => {
  const args = {
    exec: {} as Parameters<typeof persistCroppedMaster>[0]["exec"],
    rawUri: "file:///source.jpg",
    cropRect: { originX: 0, originY: 0, width: 100, height: 100 },
    target: { kind: "contact" as const, contactId: 1 },
  };

  it("returns the path despite a failed cleanup", async () => {
    vi.mocked(persistOwnedMaster).mockResolvedValue("avatars/contact-1.jpg");
    await expect(persistCroppedMaster(args)).resolves.toBe(
      "avatars/contact-1.jpg",
    );
    expect(native.deletes).toEqual([crop]);
  });

  it("keeps the original persist error despite a failed cleanup", async () => {
    const original = new Error("persist");
    vi.mocked(persistOwnedMaster).mockRejectedValue(original);
    await expect(persistCroppedMaster(args)).rejects.toBe(original);
    expect(native.deletes).toEqual([crop]);
  });
});
