import { describe, expect, it, vi } from "vitest";
import {
  clearLegacyImageDiskCacheOnce,
  type LegacyImageDiskCacheDeps,
} from "./legacy-image-disk-cache-sweep";

function fakeDeps(
  overrides: Partial<LegacyImageDiskCacheDeps> = {},
  initialFlag = false,
) {
  const state = { flag: initialFlag };
  const deps = {
    readFlag: vi.fn(async () => state.flag),
    writeFlag: vi.fn(async () => {
      state.flag = true;
    }),
    clearDiskCache: vi.fn(async () => true),
    ...overrides,
  };
  return { deps, state };
}

describe("clearLegacyImageDiskCacheOnce", () => {
  it("clears once, then writes the flag; a second call does not clear", async () => {
    const { deps, state } = fakeDeps();
    await clearLegacyImageDiskCacheOnce(deps);
    expect(deps.clearDiskCache).toHaveBeenCalledTimes(1);
    expect(deps.writeFlag).toHaveBeenCalledTimes(1);
    expect(state.flag).toBe(true);
    await clearLegacyImageDiskCacheOnce(deps);
    expect(deps.clearDiskCache).toHaveBeenCalledTimes(1);
  });

  it("does not write the flag when the clear rejects, and still resolves", async () => {
    const { deps, state } = fakeDeps({
      clearDiskCache: vi.fn(async () => {
        throw new Error("native failure");
      }),
    });
    await expect(clearLegacyImageDiskCacheOnce(deps)).resolves.toBeUndefined();
    expect(deps.writeFlag).not.toHaveBeenCalled();
    expect(state.flag).toBe(false);
  });

  it("does not write the flag when the clear resolves false", async () => {
    const { deps, state } = fakeDeps({
      clearDiskCache: vi.fn(async () => false),
    });
    await expect(clearLegacyImageDiskCacheOnce(deps)).resolves.toBeUndefined();
    expect(deps.writeFlag).not.toHaveBeenCalled();
    expect(state.flag).toBe(false);
  });

  it("treats a flag-read failure as unset and clears", async () => {
    const { deps } = fakeDeps({
      readFlag: vi.fn(async () => {
        throw new Error("storage down");
      }),
    });
    await expect(clearLegacyImageDiskCacheOnce(deps)).resolves.toBeUndefined();
    expect(deps.clearDiskCache).toHaveBeenCalledTimes(1);
  });

  it("never rejects when the flag write fails", async () => {
    const { deps } = fakeDeps({
      writeFlag: vi.fn(async () => {
        throw new Error("storage full");
      }),
    });
    await expect(clearLegacyImageDiskCacheOnce(deps)).resolves.toBeUndefined();
    expect(deps.clearDiskCache).toHaveBeenCalledTimes(1);
  });
});
