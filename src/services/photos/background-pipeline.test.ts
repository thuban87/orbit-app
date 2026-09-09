import { describe, expect, it, vi } from "vitest";
import { prepareProfileBackground } from "./background-pipeline";

const crop = {
  destinationWidth: 360,
  destinationHeight: 240,
  srcWidth: 4000,
  srcHeight: 3000,
  scale: 1,
  translateX: 0,
  translateY: 0,
};

describe("prepareProfileBackground", () => {
  it("crops source pixels to the measured Profile aspect, encodes once, persists once, and releases resources", async () => {
    const release = vi.fn();
    const cropAndResize = vi.fn().mockResolvedValue({
      uri: "file:///cache/prepared.jpg",
      release,
    });
    const persist = vi.fn().mockResolvedValue("backgrounds/bg-one.jpg");

    const prepared = await prepareProfileBackground({
      rawUri: "content://picked-image",
      transform: crop,
      output: { width: 1080, height: 720 },
      cropAndResize,
      persist,
    });
    expect(prepared.relativePath).toBe("backgrounds/bg-one.jpg");
    expect(prepared.crop.width).toBe(4000);
    expect(prepared.crop.height).toBeCloseTo(2666.6666666666665, 8);
    expect(cropAndResize).toHaveBeenCalledWith(
      expect.objectContaining({
        rawUri: "content://picked-image",
        output: { width: 1080, height: 720 },
      }),
    );
    expect(persist).toHaveBeenCalledWith("file:///cache/prepared.jpg");
    expect(release).toHaveBeenCalledOnce();
  });

  it("releases an intermediate resource when durable persistence fails", async () => {
    const release = vi.fn();
    await expect(
      prepareProfileBackground({
        rawUri: "content://picked-image",
        transform: crop,
        output: { width: 1080, height: 720 },
        cropAndResize: vi
          .fn()
          .mockResolvedValue({ uri: "file:///cache/out.jpg", release }),
        persist: vi.fn().mockRejectedValue(new Error("disk full")),
      }),
    ).rejects.toThrow("Could not prepare profile background");
    expect(release).toHaveBeenCalledOnce();
  });
});
