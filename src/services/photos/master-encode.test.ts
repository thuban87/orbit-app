import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeRef {
  width: number;
  height: number;
  releases: number;
  release: () => void;
  saveAsync: (opts: unknown) => Promise<{ uri: string }>;
}

const h = vi.hoisted(() => ({
  calls: [] as Array<{ op: string; arg: unknown }>,
  refs: [] as FakeRef[],
  /** Release counts of every manipulator context, in creation order (WR-02). */
  contextReleases: [] as number[],
  /** Source dimensions for a plain (no crop) render of a URI. */
  sourceSize: { width: 100, height: 100 },
  saves: [] as unknown[],
  saveError: null as Error | null,
  renderError: null as Error | null,
}));

vi.mock("expo-image-manipulator", () => {
  function makeRef(width: number, height: number): FakeRef {
    const ref: FakeRef = {
      width,
      height,
      releases: 0,
      release() {
        ref.releases += 1;
      },
      async saveAsync(opts: unknown) {
        h.saves.push(opts);
        if (h.saveError) throw h.saveError;
        return { uri: `file:///cache/ImageManipulator/out-${width}.webp` };
      },
    };
    h.refs.push(ref);
    return ref;
  }
  return {
    SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
    ImageManipulator: {
      manipulate(source: unknown) {
        h.calls.push({ op: "manipulate", arg: source });
        let size =
          typeof source === "string"
            ? { ...h.sourceSize }
            : {
                width: (source as FakeRef).width,
                height: (source as FakeRef).height,
              };
        const ctxIndex = h.contextReleases.push(0) - 1;
        const ctx = {
          release() {
            h.contextReleases[ctxIndex] += 1;
          },
          crop(rect: { width: number; height: number }) {
            h.calls.push({ op: "crop", arg: rect });
            size = { width: rect.width, height: rect.height };
            return ctx;
          },
          resize(target: { width: number; height: number }) {
            h.calls.push({ op: "resize", arg: target });
            size = { width: target.width, height: target.height };
            return ctx;
          },
          async renderAsync() {
            h.calls.push({ op: "render", arg: null });
            if (h.renderError) throw h.renderError;
            return makeRef(size.width, size.height);
          },
        };
        return ctx;
      },
    },
  };
});

import {
  centerSquare,
  encodeMaster,
  MASTER_MAX_EDGE,
  MASTER_QUALITY,
  masterEdge,
} from "./master-encode";

beforeEach(() => {
  h.calls.length = 0;
  h.refs.length = 0;
  h.contextReleases.length = 0;
  h.saves.length = 0;
  h.saveError = null;
  h.renderError = null;
  h.sourceSize = { width: 100, height: 100 };
});

const ops = () => h.calls.map((c) => c.op);

describe("master tunables (D-10)", () => {
  it("caps the master at 1024 and saves lossy", () => {
    expect(MASTER_MAX_EDGE).toBe(1024);
    expect(MASTER_QUALITY).toBeGreaterThan(0);
    expect(MASTER_QUALITY).toBeLessThan(1);
  });
});

describe("masterEdge", () => {
  it("keeps small sources, caps large ones, uses the short side", () => {
    expect(masterEdge(96, 96)).toBe(96);
    expect(masterEdge(3000, 2000)).toBe(1024);
    expect(masterEdge(700, 1500)).toBe(700);
    expect(masterEdge(800.6, 800.6)).toBe(800);
  });

  it("rejects non-finite or non-positive sizes", () => {
    expect(() => masterEdge(0, 5)).toThrow("invalid master source size");
    expect(() => masterEdge(Number.NaN, 5)).toThrow();
    expect(() => masterEdge(-1, 5)).toThrow();
    expect(() => masterEdge(5, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("centerSquare", () => {
  it("centres the short side", () => {
    expect(centerSquare(700, 1500)).toEqual({
      originX: 0,
      originY: 400,
      width: 700,
      height: 700,
    });
    expect(centerSquare(1200, 1200)).toEqual({
      originX: 0,
      originY: 0,
      width: 1200,
      height: 1200,
    });
    expect(centerSquare(160, 120)).toEqual({
      originX: 20,
      originY: 0,
      width: 120,
      height: 120,
    });
  });
});

describe("encodeMaster with a crop", () => {
  it("crops then downsizes a large crop to 1024 WebP at MASTER_QUALITY", async () => {
    const crop = { originX: 10, originY: 20, width: 2000, height: 2000 };
    const uri = await encodeMaster("file:///src.jpg", crop);
    expect(uri).toBe("file:///cache/ImageManipulator/out-1024.webp");
    expect(h.calls).toEqual([
      { op: "manipulate", arg: "file:///src.jpg" },
      { op: "crop", arg: crop },
      { op: "resize", arg: { width: 1024, height: 1024 } },
      { op: "render", arg: null },
    ]);
    expect(h.saves).toEqual([{ format: "webp", compress: MASTER_QUALITY }]);
  });

  it("never upscales a small crop", async () => {
    const crop = { originX: 0, originY: 0, width: 600, height: 600 };
    const uri = await encodeMaster("file:///src.jpg", crop);
    expect(uri).toBe("file:///cache/ImageManipulator/out-600.webp");
    expect(ops()).toEqual(["manipulate", "crop", "render"]);
    expect(h.saves).toEqual([{ format: "webp", compress: MASTER_QUALITY }]);
  });

  it("releases the rendered ref exactly once on success", async () => {
    await encodeMaster("file:///src.jpg", {
      originX: 0,
      originY: 0,
      width: 2000,
      height: 2000,
    });
    expect(h.refs).toHaveLength(1);
    expect(h.refs[0].releases).toBe(1);
    // WR-02: the context still holds the final bitmap — it is released too.
    expect(h.contextReleases).toEqual([1]);
  });

  it("releases the context when renderAsync rejects (no ref to release)", async () => {
    h.renderError = new Error("decode");
    await expect(
      encodeMaster("file:///src.jpg", {
        originX: 0,
        originY: 0,
        width: 600,
        height: 600,
      }),
    ).rejects.toThrow("decode");
    expect(h.refs).toHaveLength(0);
    expect(h.contextReleases).toEqual([1]);
  });

  it("releases the rendered ref exactly once when saveAsync rejects", async () => {
    h.saveError = new Error("encode");
    await expect(
      encodeMaster("file:///src.jpg", {
        originX: 0,
        originY: 0,
        width: 600,
        height: 600,
      }),
    ).rejects.toThrow("encode");
    expect(h.refs).toHaveLength(1);
    expect(h.refs[0].releases).toBe(1);
    expect(h.contextReleases).toEqual([1]);
  });
});

describe("encodeMaster without a crop (import, retry, reconcile)", () => {
  it("keeps a 96×96 thumbnail at its own size (no crop, no resize)", async () => {
    h.sourceSize = { width: 96, height: 96 };
    const uri = await encodeMaster("file:///staged.jpg");
    expect(uri).toBe("file:///cache/ImageManipulator/out-96.webp");
    expect(ops()).toEqual(["manipulate", "render", "manipulate", "render"]);
    expect(h.saves).toEqual([{ format: "webp", compress: MASTER_QUALITY }]);
  });

  it("centre-squares a 120×160 thumbnail to 120 without upscaling", async () => {
    h.sourceSize = { width: 120, height: 160 };
    await encodeMaster("file:///staged.jpg");
    expect(h.calls).toContainEqual({
      op: "crop",
      arg: { originX: 0, originY: 20, width: 120, height: 120 },
    });
    expect(ops()).not.toContain("resize");
    expect(h.refs.at(-1)?.width).toBe(120);
  });

  it("centre-squares and downsizes a large photo to 1024", async () => {
    h.sourceSize = { width: 3000, height: 2000 };
    await encodeMaster("file:///staged.jpg");
    expect(h.calls).toContainEqual({
      op: "crop",
      arg: { originX: 500, originY: 0, width: 2000, height: 2000 },
    });
    expect(h.calls).toContainEqual({
      op: "resize",
      arg: { width: 1024, height: 1024 },
    });
  });

  it("releases the base and the rendered ref once each, on success and failure", async () => {
    h.sourceSize = { width: 1500, height: 1500 };
    await encodeMaster("file:///staged.jpg");
    expect(h.refs.map((r) => r.releases)).toEqual([1, 1]);
    // WR-02: both contexts (the base decode and the square/resize) are released.
    expect(h.contextReleases).toEqual([1, 1]);

    h.refs.length = 0;
    h.contextReleases.length = 0;
    h.saveError = new Error("encode");
    await expect(encodeMaster("file:///staged.jpg")).rejects.toThrow("encode");
    expect(h.refs.map((r) => r.releases)).toEqual([1, 1]);
    expect(h.contextReleases).toEqual([1, 1]);
  });
});
