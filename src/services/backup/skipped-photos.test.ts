import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

import {
  AUTOMATIC_SKIPPED_PHOTOS_KEY,
  automaticSkippedPhotosLine,
  readAutomaticSkippedPhotos,
  recordAutomaticSkippedPhotos,
  type SkippedPhotosStorage,
  skippedPhotosCopy,
} from "./skipped-photos";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const storage: SkippedPhotosStorage = {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
  };
  return { items, storage };
}

describe("skipped-photo copy (38.6 D-24)", () => {
  it("is singular for one, plural otherwise, and absent below one", () => {
    expect(skippedPhotosCopy(1)).toBe("1 photo couldn't be included.");
    expect(skippedPhotosCopy(3)).toBe("3 photos couldn't be included.");
    expect(skippedPhotosCopy(0)).toBeNull();
    expect(skippedPhotosCopy(-1)).toBeNull();
  });
});

describe("automatic skipped-photo record", () => {
  it("round-trips through storage under the versioned device-local key", async () => {
    const { items, storage } = memoryStorage();
    await recordAutomaticSkippedPhotos(
      { at: "2026-09-30 10:00:00", count: 2 },
      storage,
    );
    expect(items.has(AUTOMATIC_SKIPPED_PHOTOS_KEY)).toBe(true);
    await expect(readAutomaticSkippedPhotos(storage)).resolves.toEqual({
      at: "2026-09-30 10:00:00",
      count: 2,
    });
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["a wrong shape", JSON.stringify({ at: 5, count: "2" })],
    ["a negative count", JSON.stringify({ at: "x", count: -1 })],
    ["a non-object", JSON.stringify(7)],
  ])("reads %s as null", async (_label, raw) => {
    const { storage } = memoryStorage({ [AUTOMATIC_SKIPPED_PHOTOS_KEY]: raw });
    await expect(readAutomaticSkippedPhotos(storage)).resolves.toBeNull();
  });

  it("reads an absent key or a throwing read as null", async () => {
    await expect(
      readAutomaticSkippedPhotos(memoryStorage().storage),
    ).resolves.toBeNull();
    await expect(
      readAutomaticSkippedPhotos({
        getItem: async () => {
          throw new Error("storage down");
        },
        setItem: async () => {},
      }),
    ).resolves.toBeNull();
  });

  it("a throwing write resolves (never rejects)", async () => {
    await expect(
      recordAutomaticSkippedPhotos(
        { at: "x", count: 1 },
        {
          getItem: async () => null,
          setItem: async () => {
            throw new Error("storage down");
          },
        },
      ),
    ).resolves.toBeUndefined();
  });
});

describe("health-card line", () => {
  const at = "2026-09-30 10:00:00";
  it("names the count only for the latest automatic backup", () => {
    expect(automaticSkippedPhotosLine({ at, count: 2 }, at)).toBe(
      "Last automatic backup: 2 photos couldn't be included.",
    );
    expect(automaticSkippedPhotosLine({ at, count: 1 }, at)).toBe(
      "Last automatic backup: 1 photo couldn't be included.",
    );
  });

  it("is null for another backup, a zero count, or missing inputs", () => {
    expect(
      automaticSkippedPhotosLine({ at, count: 2 }, "2026-09-29 10:00:00"),
    ).toBeNull();
    expect(automaticSkippedPhotosLine({ at, count: 0 }, at)).toBeNull();
    expect(automaticSkippedPhotosLine(null, at)).toBeNull();
    expect(automaticSkippedPhotosLine({ at, count: 2 }, null)).toBeNull();
  });
});
