import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 38.6 D-11 / review WR-02 fold-in: the crop screen's decode-fallback
 * downscale and the Profile background crop release the rendered image and its
 * manipulator context exactly once each, on success and on failure.
 */

interface FakeRef {
  releases: number;
  release: () => void;
  saveAsync: (opts: unknown) => Promise<{ uri: string }>;
}

const h = vi.hoisted(() => ({
  calls: [] as Array<{ op: string; arg: unknown }>,
  refs: [] as FakeRef[],
  contextReleases: [] as number[],
  saves: [] as unknown[],
  saveError: null as Error | null,
  renderError: null as Error | null,
  releaseThrows: false,
  discarded: [] as string[],
}));

vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
  ImageManipulator: {
    manipulate(source: unknown) {
      h.calls.push({ op: "manipulate", arg: source });
      const index = h.contextReleases.push(0) - 1;
      const ctx = {
        release() {
          h.contextReleases[index] += 1;
          if (h.releaseThrows) throw new Error("release boom");
        },
        crop(rect: unknown) {
          h.calls.push({ op: "crop", arg: rect });
          return ctx;
        },
        resize(target: unknown) {
          h.calls.push({ op: "resize", arg: target });
          return ctx;
        },
        async renderAsync() {
          h.calls.push({ op: "render", arg: null });
          if (h.renderError) throw h.renderError;
          const ref: FakeRef = {
            releases: 0,
            release() {
              ref.releases += 1;
              if (h.releaseThrows) throw new Error("release boom");
            },
            async saveAsync(opts: unknown) {
              h.saves.push(opts);
              if (h.saveError) throw h.saveError;
              return { uri: "file:///cache/ImageManipulator/out.jpg" };
            },
          };
          h.refs.push(ref);
          return ref;
        },
      };
      return ctx;
    },
  },
}));
vi.mock("./derivative-cache", () => ({
  discardDerivative: (uri: string) => {
    h.discarded.push(uri);
    return true;
  },
}));

import {
  BACKGROUND_DERIVATIVE_QUALITY,
  PREVIEW_DOWNSCALE_QUALITY,
  renderBackgroundDerivative,
  renderPreviewDownscale,
} from "./manipulator-derivatives";

beforeEach(() => {
  h.calls.length = 0;
  h.refs.length = 0;
  h.contextReleases.length = 0;
  h.saves.length = 0;
  h.saveError = null;
  h.renderError = null;
  h.releaseThrows = false;
  h.discarded.length = 0;
});

const refReleases = () => h.refs.map((ref) => ref.releases);
const crop = { originX: 1, originY: 2, width: 300, height: 600 };
const output = { width: 150, height: 300 };

describe("renderPreviewDownscale", () => {
  it("resizes, saves a JPEG at the preview quality and releases ref and context once", async () => {
    await expect(
      renderPreviewDownscale("file:///raw.heic", 2048),
    ).resolves.toBe("file:///cache/ImageManipulator/out.jpg");
    expect(h.calls).toEqual([
      { op: "manipulate", arg: "file:///raw.heic" },
      { op: "resize", arg: { width: 2048 } },
      { op: "render", arg: null },
    ]);
    expect(PREVIEW_DOWNSCALE_QUALITY).toBe(0.9);
    expect(h.saves).toEqual([{ format: "jpeg", compress: 0.9 }]);
    expect(refReleases()).toEqual([1]);
    expect(h.contextReleases).toEqual([1]);
  });

  it("a failing save rejects with that error and still releases both once", async () => {
    h.saveError = new Error("disk full");
    await expect(renderPreviewDownscale("file:///raw", 2048)).rejects.toBe(
      h.saveError,
    );
    expect(refReleases()).toEqual([1]);
    expect(h.contextReleases).toEqual([1]);
  });

  it("a failing render rejects with that error and still releases the context once", async () => {
    h.renderError = new Error("decode failed");
    await expect(renderPreviewDownscale("file:///raw", 2048)).rejects.toBe(
      h.renderError,
    );
    expect(h.refs).toEqual([]);
    expect(h.contextReleases).toEqual([1]);
  });

  it("a throwing release never masks the result or the original error", async () => {
    h.releaseThrows = true;
    await expect(renderPreviewDownscale("file:///raw", 2048)).resolves.toBe(
      "file:///cache/ImageManipulator/out.jpg",
    );
    h.saveError = new Error("disk full");
    await expect(renderPreviewDownscale("file:///raw", 2048)).rejects.toBe(
      h.saveError,
    );
  });
});

describe("renderBackgroundDerivative", () => {
  it("crops, resizes, saves at the background quality and frees the native image before resolving", async () => {
    const resource = await renderBackgroundDerivative({
      rawUri: "file:///raw.jpg",
      crop,
      output,
    });
    expect(h.calls).toEqual([
      { op: "manipulate", arg: "file:///raw.jpg" },
      { op: "crop", arg: crop },
      { op: "resize", arg: output },
      { op: "render", arg: null },
    ]);
    expect(BACKGROUND_DERIVATIVE_QUALITY).toBe(0.82);
    expect(h.saves).toEqual([{ format: "jpeg", compress: 0.82 }]);
    expect(refReleases()).toEqual([1]);
    expect(h.contextReleases).toEqual([1]);
    expect(resource.uri).toBe("file:///cache/ImageManipulator/out.jpg");
    // release() only discards the cache file; nothing native is released twice.
    resource.release?.();
    expect(h.discarded).toEqual(["file:///cache/ImageManipulator/out.jpg"]);
    expect(refReleases()).toEqual([1]);
    expect(h.contextReleases).toEqual([1]);
  });

  it("a failing save rejects and still releases ref and context once", async () => {
    h.saveError = new Error("disk full");
    await expect(
      renderBackgroundDerivative({ rawUri: "file:///raw", crop, output }),
    ).rejects.toBe(h.saveError);
    expect(refReleases()).toEqual([1]);
    expect(h.contextReleases).toEqual([1]);
    expect(h.discarded).toEqual([]);
  });

  it("a throwing release never masks the result or the original error", async () => {
    h.releaseThrows = true;
    await expect(
      renderBackgroundDerivative({ rawUri: "file:///raw", crop, output }),
    ).resolves.toMatchObject({ uri: "file:///cache/ImageManipulator/out.jpg" });
    h.renderError = new Error("decode failed");
    await expect(
      renderBackgroundDerivative({ rawUri: "file:///raw", crop, output }),
    ).rejects.toBe(h.renderError);
  });
});
