import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  discard: vi.fn(),
  saves: [] as unknown[],
  renderError: null as Error | null,
}));
vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
  ImageManipulator: {
    manipulate: () => ({
      crop() {
        return this;
      },
      resize() {
        return this;
      },
      async renderAsync() {
        if (h.renderError) throw h.renderError;
        return {
          width: 100,
          height: 100,
          release() {},
          saveAsync: async (opts: unknown) => {
            h.saves.push(opts);
            return { uri: "file:///cache/ImageManipulator/crop.jpg" };
          },
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

import { MASTER_QUALITY } from "./master-encode";
import { persistOwnedMaster } from "./owned-master";
import { PhotoPipelineError, persistCroppedMaster } from "./photo-pipeline";

const args = {
  exec: {} as Parameters<typeof persistCroppedMaster>[0]["exec"],
  rawUri: "file:///source.jpg",
  cropRect: { originX: 0, originY: 0, width: 100, height: 100 },
  target: { kind: "contact" as const, contactId: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.saves.length = 0;
  h.renderError = null;
});

describe("master encode (D-10/D-21)", () => {
  it("saves one lossy WebP master under the unchanged identity-derived path", async () => {
    vi.mocked(persistOwnedMaster).mockResolvedValue("avatars/contact-1.jpg");
    await expect(persistCroppedMaster(args)).resolves.toBe(
      "avatars/contact-1.jpg",
    );
    expect(h.saves).toEqual([{ format: "webp", compress: MASTER_QUALITY }]);
    expect(persistOwnedMaster).toHaveBeenCalledWith(
      args.exec,
      "file:///cache/ImageManipulator/crop.jpg",
      "avatars/contact-1.jpg",
      { authorize: undefined },
    );
  });

  it("maps an encode failure to PhotoPipelineError without persisting", async () => {
    h.renderError = new Error("decode");
    await expect(persistCroppedMaster(args)).rejects.toBeInstanceOf(
      PhotoPipelineError,
    );
    expect(persistOwnedMaster).not.toHaveBeenCalled();
  });
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
