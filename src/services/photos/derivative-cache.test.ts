import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetDerivativeCacheSweepForTest,
  type DerivativeCacheFs,
  discardDerivative,
  sweepDerivativeCacheOncePerProcess,
} from "./derivative-cache";

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
