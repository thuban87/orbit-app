import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ discard: vi.fn() }));
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
            uri: "file:///cache/ImageManipulator/crop.jpg",
          }),
        };
      },
    }),
  },
}));
vi.mock("@/services/photos/derivative-cache", () => ({
  discardDerivative: h.discard,
}));
vi.mock("@/services/photos/photo-storage", () => ({
  relPathForTarget: () => "avatars/contact-1.jpg",
}));
vi.mock("@/services/photos/owned-master", () => ({
  persistOwnedMaster: vi.fn(),
  persistOwnedMasterLocked: vi.fn(),
}));

import { persistOwnedMaster } from "./owned-master";
import { persistCroppedMaster } from "./photo-pipeline";

const args = {
  exec: {} as Parameters<typeof persistCroppedMaster>[0]["exec"],
  rawUri: "file:///source.jpg",
  cropRect: { originX: 0, originY: 0, width: 100, height: 100 },
  target: { kind: "contact" as const, contactId: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("crop derivative cleanup", () => {
  it("returns the persisted path despite cleanup failure", async () => {
    vi.mocked(persistOwnedMaster).mockResolvedValue("avatars/contact-1.jpg");
    h.discard.mockImplementation(() => {
      throw new Error("delete");
    });
    await expect(persistCroppedMaster(args)).resolves.toBe(
      "avatars/contact-1.jpg",
    );
    expect(h.discard).toHaveBeenCalledWith(
      "file:///cache/ImageManipulator/crop.jpg",
    );
  });

  it("preserves the original persist error despite cleanup failure", async () => {
    const original = new Error("persist");
    vi.mocked(persistOwnedMaster).mockRejectedValue(original);
    h.discard.mockImplementation(() => {
      throw new Error("delete");
    });
    await expect(persistCroppedMaster(args)).rejects.toBe(original);
    expect(h.discard).toHaveBeenCalledWith(
      "file:///cache/ImageManipulator/crop.jpg",
    );
  });
});
