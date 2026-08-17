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
  cfg: {} as { renderThrows?: boolean; saveBase64?: string | undefined },
}));

vi.mock("expo-image-manipulator", () => {
  class SaveFormat {}
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
            return {
              async saveAsync(_opts: unknown) {
                return { uri: "file:///cache/thumb.jpg", base64: h.cfg.saveBase64 };
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

import { encodeWidgetThumb } from "./widget-photo";

describe("encodeWidgetThumb", () => {
  beforeEach(() => {
    h.cfg = { saveBase64: "QUJD" };
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

  it("returns null (not a rejection) when the manipulator throws", async () => {
    h.cfg = { renderThrows: true };
    await expect(
      encodeWidgetThumb("avatars/contact-1.jpg"),
    ).resolves.toBeNull();
  });

  it("returns null when saveAsync resolves with an undefined base64 (never …base64,undefined)", async () => {
    h.cfg = { saveBase64: undefined };
    const out = await encodeWidgetThumb("avatars/contact-1.jpg");
    expect(out).toBeNull();
    expect(out).not.toContain("undefined");
  });

  it("returns null when saveAsync resolves with an empty base64 string", async () => {
    h.cfg = { saveBase64: "" };
    await expect(
      encodeWidgetThumb("avatars/contact-1.jpg"),
    ).resolves.toBeNull();
  });
});
