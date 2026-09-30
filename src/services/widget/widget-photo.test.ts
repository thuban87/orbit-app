/**
 * widget-photo — node-side proof of the base64 tile-thumbnail encoder (WDG-01).
 *
 * The encoder chains `expo-image-manipulator` and resolves the master `file://`
 * via `@/services/photos/photo-storage`. BOTH are mocked here: the manipulator so
 * the chain resolves a known base64 payload (or rejects / yields an empty
 * payload), AND photo-storage so `resolvePhotoUri` does NOT pull the native
 * `expo-file-system` into the node env (mirrors photo-storage.test.ts's native
 * mock).
 *
 * Coverage:
 *   (a) null/empty path            -> null (no photo -> initials fallback)
 *   (b) a real path                -> a "data:image/jpeg;base64,<b64>" string
 *   (c) the manipulator REJECTS    -> null (Logger-logged, NOT a rejection) — a
 *       corrupt/evicted master downgrades one tile to initials, never blanks the
 *       whole grid (Codex/Claude M2)
 *   (d) saveAsync RESOLVES but base64 is undefined/empty -> null (Logger-logged),
 *       NEVER "data:image/jpeg;base64,undefined" (codex/Claude MED)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mock state: control the manipulator chain's outcome per test.
const h = vi.hoisted(() => ({
  cfg: {} as {
    renderThrows?: boolean;
    saveThrows?: boolean;
    saveBase64?: string | undefined;
  },
  releases: [] as number[],
}));

vi.mock("expo-image-manipulator", () => {
  return {
    SaveFormat: { JPEG: "jpeg" },
    ImageManipulator: {
      manipulate(_uri: string) {
        const chain = {
          resize(_opts: unknown) {
            return chain;
          },
          async renderAsync() {
            if (h.cfg.renderThrows) throw new Error("mock decode failed");
            const index = h.releases.push(0) - 1;
            return {
              release() {
                h.releases[index] += 1;
              },
              async saveAsync(_opts: unknown) {
                if (h.cfg.saveThrows) throw new Error("mock encode failed");
                return {
                  uri: "file:///cache/thumb.jpg",
                  base64: h.cfg.saveBase64,
                };
              },
            };
          },
        };
        return chain;
      },
    },
  };
});

// Mock photo-storage so resolvePhotoUri never loads native expo-file-system.
vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoUri: (relative: string) => `file:///documents/${relative}`,
}));
vi.mock("@/services/photos/derivative-cache", () => ({
  discardDerivative: vi.fn(),
}));

import { encodeTileThumbs, encodeWidgetThumb } from "./widget-photo";

describe("encodeWidgetThumb", () => {
  beforeEach(() => {
    h.cfg = { saveBase64: "QUJD" };
    h.releases.length = 0;
  });

  it("releases the rendered bitmap exactly once on success (D-11)", async () => {
    await expect(encodeWidgetThumb("avatars/contact-1.jpg")).resolves.toBe(
      "data:image/jpeg;base64,QUJD",
    );
    expect(h.releases).toEqual([1]);
  });

  it("releases the rendered bitmap exactly once when saveAsync rejects", async () => {
    h.cfg = { saveThrows: true };
    await expect(
      encodeWidgetThumb("avatars/contact-1.jpg"),
    ).resolves.toBeNull();
    expect(h.releases).toEqual([1]);
  });

  it("releases the rendered bitmap exactly once when base64 is missing", async () => {
    h.cfg = { saveBase64: undefined };
    await expect(
      encodeWidgetThumb("avatars/contact-1.jpg"),
    ).resolves.toBeNull();
    expect(h.releases).toEqual([1]);
  });

  it("returns null for a null path (no photo -> initials fallback)", async () => {
    await expect(encodeWidgetThumb(null)).resolves.toBeNull();
  });

  it("returns null for an empty path", async () => {
    await expect(encodeWidgetThumb("")).resolves.toBeNull();
  });

  it("returns a data:image/jpeg;base64 URI for a real path", async () => {
    h.cfg = { saveBase64: "QUJD" };
    const out = await encodeWidgetThumb("avatars/contact-1.jpg");
    expect(out).toBe("data:image/jpeg;base64,QUJD");
  });

  it("discards the native cache file after returning unchanged base64", async () => {
    const discard = vi.fn(() => true);
    await expect(
      encodeWidgetThumb("avatars/contact-1.jpg", discard),
    ).resolves.toBe("data:image/jpeg;base64,QUJD");
    expect(discard).toHaveBeenCalledOnce();
    expect(discard).toHaveBeenCalledWith("file:///cache/thumb.jpg");
  });

  it("keeps base64 success when headless cleanup throws", async () => {
    const discard = vi.fn(() => {
      throw new Error("delete");
    });
    await expect(
      encodeWidgetThumb("avatars/contact-1.jpg", discard),
    ).resolves.toBe("data:image/jpeg;base64,QUJD");
  });

  it("discards an output with missing base64", async () => {
    h.cfg = { saveBase64: undefined };
    const discard = vi.fn(() => true);
    await expect(
      encodeWidgetThumb("avatars/contact-1.jpg", discard),
    ).resolves.toBeNull();
    expect(discard).toHaveBeenCalledWith("file:///cache/thumb.jpg");
  });

  it("returns null (not a rejection) when the manipulator throws", async () => {
    h.cfg = { renderThrows: true };
    await expect(
      encodeWidgetThumb("avatars/contact-1.jpg"),
    ).resolves.toBeNull();
  });

  it("returns null when saveAsync resolves with an undefined base64 (never …base64,undefined)", async () => {
    h.cfg = { saveBase64: undefined };
    const out = await encodeWidgetThumb("avatars/contact-1.jpg");
    // Strict null (the initials-fallback signal): if the guard regressed and
    // emitted "data:image/jpeg;base64,undefined", this would be that string.
    expect(out).toBeNull();
  });

  it("returns null when saveAsync resolves with an empty base64 string", async () => {
    h.cfg = { saveBase64: "" };
    await expect(
      encodeWidgetThumb("avatars/contact-1.jpg"),
    ).resolves.toBeNull();
  });
});

describe("encodeTileThumbs (D-11: one master decode at a time)", () => {
  const tiles = [1, 2, 3, 4, 5, 6].map((id) => ({
    id,
    relativePhoto: `avatars/contact-${id}.jpg`,
  }));

  it("encodes tiles sequentially, in order", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const encode = vi.fn(async (path: string | null) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return `thumb:${path}`;
    });
    const out = await encodeTileThumbs(tiles, encode);
    expect(maxInFlight).toBe(1);
    expect(out.map((row) => row.tile.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(out.map((row) => row.thumb)).toEqual(
      tiles.map((tile) => `thumb:${tile.relativePhoto}`),
    );
  });

  it("a throwing tile falls back to initials while the others still encode", async () => {
    const encode = vi.fn(async (path: string | null) => {
      if (path === "avatars/contact-3.jpg") throw new Error("boom");
      return `thumb:${path}`;
    });
    const out = await encodeTileThumbs(tiles, encode);
    expect(encode).toHaveBeenCalledTimes(6);
    expect(out[2]).toEqual({ tile: tiles[2], thumb: null });
    expect(out.filter((row) => row.thumb !== null)).toHaveLength(5);
  });
});
