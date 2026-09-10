import { describe, expect, it, vi } from "vitest";
import { prepareProfileBackground } from "./background-pipeline";
import { profileBackgroundTarget } from "./profile-background-target";

const target = profileBackgroundTarget({ width: 1080, height: 2400 });

const selection = { originX: 1325, originY: 0, width: 1350, height: 3000 };

describe("prepareProfileBackground", () => {
  it("passes the exact clamped source-pixel selection through one crop/resize/encode, persists once, and releases resources", async () => {
    const release = vi.fn();
    const cropAndResize = vi.fn().mockResolvedValue({
      uri: "file:///cache/prepared.jpg",
      release,
    });
    const persist = vi.fn().mockResolvedValue("backgrounds/bg-one.jpg");

    const prepared = await prepareProfileBackground({
      rawUri: "content://picked-image",
      selection,
      output: target.output,
      cropAndResize,
      persist,
    });
    expect(prepared.relativePath).toBe("backgrounds/bg-one.jpg");
    expect(prepared.crop).toEqual(selection);
    expect(cropAndResize).toHaveBeenCalledWith({
      rawUri: "content://picked-image",
      crop: selection,
      output: target.output,
    });
    expect(persist).toHaveBeenCalledWith("file:///cache/prepared.jpg");
    expect(release).toHaveBeenCalledOnce();
  });

  it("releases an intermediate resource when durable persistence fails", async () => {
    const release = vi.fn();
    await expect(
      prepareProfileBackground({
        rawUri: "content://picked-image",
        selection,
        output: target.output,
        cropAndResize: vi
          .fn()
          .mockResolvedValue({ uri: "file:///cache/out.jpg", release }),
        persist: vi.fn().mockRejectedValue(new Error("disk full")),
      }),
    ).rejects.toThrow("Could not prepare profile background");
    expect(release).toHaveBeenCalledOnce();
  });
});
