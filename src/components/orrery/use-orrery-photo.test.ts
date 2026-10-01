/**
 * use-orrery-photo — node proof of the D-11 orrery texture gate: the ≤512
 * pass-through, the 1024→512 downsample, the byte-budgeted LRU of encoded
 * derivatives sized to the Orrery's live photos (38.6 D-37), cancellation of
 * queued downsamples and the late-older-revision guard (review IN-02), the
 * downsample concurrency cap, and SkImage disposal (loader and the pure
 * lifecycle helper the hook drives). Every native boundary is a fake;
 * nothing loads Skia or the manipulator.
 */
import type { SkData, SkImage } from "@shopify/react-native-skia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));
// The real manipulator path (`defaultOrreryImageDeps.downsample`) is exercised
// only by the WR-02 release test below; everything else injects fakes.
const m = vi.hoisted(() => ({
  refReleases: [] as number[],
  contextReleases: [] as number[],
  renderThrows: false,
  saveBase64: "QUJD" as string | undefined,
}));
vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate(_uri: string) {
      const ctxIndex = m.contextReleases.push(0) - 1;
      const ctx = {
        release() {
          m.contextReleases[ctxIndex] += 1;
        },
        resize(_size: unknown) {
          return ctx;
        },
        async renderAsync() {
          if (m.renderThrows) throw new Error("mock decode failed");
          const refIndex = m.refReleases.push(0) - 1;
          return {
            release() {
              m.refReleases[refIndex] += 1;
            },
            async saveAsync(_opts: unknown) {
              return { uri: "file:///cache/small.jpg", base64: m.saveBase64 };
            },
          };
        },
      };
      return ctx;
    },
  },
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoUri: (relative: string) => `file:///docs/${relative}`,
}));
vi.mock("@/services/photos/derivative-cache", () => ({
  discardDerivative: vi.fn(),
}));
vi.mock("@/utils/logger", () => ({
  Logger: { warn: vi.fn(), error: vi.fn() },
}));

import { Logger } from "@/utils/logger";
import {
  createOrreryImageSlot,
  defaultOrreryImageDeps,
  loadOrreryImage,
  ORRERY_DERIVATIVE_CACHE_MAX_BYTES,
  ORRERY_DERIVATIVE_CACHE_SPARE_BYTES,
  ORRERY_DOWNSAMPLE_CONCURRENCY,
  ORRERY_TEXTURE_MAX,
  type OrreryImageDeps,
  type OrreryLoadToken,
  orreryDerivativeCacheBudget,
  orreryDerivativeCacheState,
  resetOrreryPhotoCacheForTests,
  retainOrreryPhoto,
} from "./use-orrery-photo";

interface FakeImage {
  label: string;
  size: number;
  disposeCount: number;
  width(): number;
  height(): number;
  dispose(): void;
}

let created: FakeImage[] = [];

function fakeImage(label: string, size: number): FakeImage {
  const image: FakeImage = {
    label,
    size,
    disposeCount: 0,
    width: () => size,
    height: () => size,
    dispose() {
      image.disposeCount += 1;
    },
  };
  created.push(image);
  return image;
}

const asSk = (image: FakeImage) => image as unknown as SkImage;

/**
 * Fake native boundary. `readData(uri)` yields `{file: uri}`; `fromBase64(b64)`
 * yields `{b64}`; `decode` makes a fake image sized by `sizes[uri]` (files) or
 * `ORRERY_TEXTURE_MAX` (derivatives).
 */
function deps(
  sizes: Record<string, number>,
  overrides: Partial<OrreryImageDeps> = {},
) {
  const calls = {
    fileUris: [] as string[],
    downsamples: [] as string[],
    discards: [] as string[],
  };
  const d: OrreryImageDeps = {
    fileUri: (relative) => `file:///docs/${relative}`,
    readData: async (uri) => {
      calls.fileUris.push(uri);
      return { file: uri } as unknown as SkData;
    },
    decode: (data) => {
      const raw = data as unknown as { file?: string; b64?: string };
      if (raw.file !== undefined)
        return asSk(fakeImage(`large:${raw.file}`, sizes[raw.file] ?? 512));
      return asSk(fakeImage(`small:${raw.b64}`, ORRERY_TEXTURE_MAX));
    },
    fromBase64: (b64) => ({ b64 }) as unknown as SkData,
    downsample: async (uri) => {
      calls.downsamples.push(uri);
      return { base64: `small-of-${uri}`, uri: `file:///cache/${uri.length}` };
    },
    discard: (uri) => {
      calls.discards.push(uri);
    },
    ...overrides,
  };
  return { d, calls };
}

const disposeCounts = () => created.map((image) => image.disposeCount);

beforeEach(() => {
  created = [];
  resetOrreryPhotoCacheForTests();
  vi.mocked(Logger.warn).mockClear();
});

/** Let queued promise continuations (slot hand-offs, awaits) run. */
async function flush(turns = 4): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
}

describe("tunables", () => {
  it("pins the D-11 bounds", () => {
    expect(ORRERY_TEXTURE_MAX).toBe(512);
    expect(ORRERY_DOWNSAMPLE_CONCURRENCY).toBe(1);
    expect(ORRERY_DERIVATIVE_CACHE_SPARE_BYTES).toBe(4 * 1024 * 1024);
    expect(ORRERY_DERIVATIVE_CACHE_MAX_BYTES).toBe(24 * 1024 * 1024);
    // Before any body mounts, the budget is the spare allowance alone.
    expect(orreryDerivativeCacheBudget()).toBe(
      ORRERY_DERIVATIVE_CACHE_SPARE_BYTES,
    );
  });
});

describe("loadOrreryImage — pass-through and downsample", () => {
  it("returns null for a value that is not a stored photo path, without reading anything (38.6 D-34)", async () => {
    const fileUri = vi.fn((relative: string) => `file:///docs/${relative}`);
    const { d, calls } = deps({}, { fileUri });
    await expect(loadOrreryImage("Rex", 1, d)).resolves.toBeNull();
    expect(fileUri).not.toHaveBeenCalled();
    expect(calls.fileUris).toEqual([]);
  });

  it("returns a ≤512 image as decoded and never calls the manipulator", async () => {
    const { d, calls } = deps({ "file:///docs/avatars/contact-1.jpg": 512 });
    const image = await loadOrreryImage("avatars/contact-1.jpg", undefined, d);
    expect((image as unknown as FakeImage).label).toBe(
      "large:file:///docs/avatars/contact-1.jpg",
    );
    expect(calls.downsamples).toEqual([]);
    expect(disposeCounts()).toEqual([0]);

    const thumb = deps({ "file:///docs/avatars/contact-2.jpg": 96 });
    await loadOrreryImage("avatars/contact-2.jpg", 3, thumb.d);
    expect(thumb.calls.downsamples).toEqual([]);
  });

  it("downsamples a 1024 master, discards the derivative, disposes the large image undrawn", async () => {
    const { d, calls } = deps({ "file:///docs/avatars/contact-1.jpg": 1024 });
    const image = (await loadOrreryImage(
      "avatars/contact-1.jpg",
      2,
      d,
    )) as unknown as FakeImage;
    expect(calls.downsamples).toEqual(["file:///docs/avatars/contact-1.jpg"]);
    expect(calls.discards).toHaveLength(1);
    expect(image.label).toBe(
      "small:small-of-file:///docs/avatars/contact-1.jpg",
    );
    const large = created.find((c) => c.label.startsWith("large:"))!;
    expect(large.disposeCount).toBe(1);
    expect(image.disposeCount).toBe(0);
  });

  it("feeds Skia and the manipulator the plain file URI (no ?v= query)", async () => {
    const { d, calls } = deps({ "file:///docs/avatars/contact-1.jpg": 1024 });
    await loadOrreryImage("avatars/contact-1.jpg", 9, d);
    for (const uri of [...calls.fileUris, ...calls.downsamples])
      expect(uri).not.toContain("?");
  });

  it("reuses the cached base64 for the same path + revision; a new revision re-derives", async () => {
    const { d, calls } = deps({ "file:///docs/avatars/contact-1.jpg": 1024 });
    await loadOrreryImage("avatars/contact-1.jpg", 1, d);
    await loadOrreryImage("avatars/contact-1.jpg", 1, d);
    expect(calls.downsamples).toHaveLength(1);
    expect(calls.fileUris).toHaveLength(1);
    await loadOrreryImage("avatars/contact-1.jpg", 2, d);
    expect(calls.downsamples).toHaveLength(2);
    expect(orreryDerivativeCacheState().keys).toEqual([
      "avatars/contact-1.jpg#2",
    ]);
  });
});

describe("derivative cache — bounded by bytes, LRU, strings only", () => {
  const len = Math.floor(ORRERY_DERIVATIVE_CACHE_SPARE_BYTES / 3);
  function sized(label: string) {
    return {
      downsample: async () => ({
        base64: label.padEnd(len, "x"),
        uri: "file:///cache/d",
      }),
    };
  }

  it("evicts least-recently-used entries so the total never exceeds the budget", async () => {
    const sizes = Object.fromEntries(
      ["a", "b", "c", "d"].map((p) => [`file:///docs/avatars/${p}.jpg`, 1024]),
    );
    for (const p of ["a", "b", "c"]) {
      await loadOrreryImage(`avatars/${p}.jpg`, 1, deps(sizes, sized(p)).d);
    }
    expect(orreryDerivativeCacheState().keys).toHaveLength(3);
    // A hit refreshes recency: "a" becomes most recent, so "b" is evicted next.
    const hit = deps(sizes, sized("a"));
    await loadOrreryImage("avatars/a.jpg", 1, hit.d);
    expect(hit.calls.downsamples).toEqual([]);
    await loadOrreryImage("avatars/d.jpg", 1, deps(sizes, sized("d")).d);
    const state = orreryDerivativeCacheState();
    expect(state.keys).toEqual([
      "avatars/c.jpg#1",
      "avatars/a.jpg#1",
      "avatars/d.jpg#1",
    ]);
    expect(state.bytes).toBeLessThanOrEqual(
      ORRERY_DERIVATIVE_CACHE_SPARE_BYTES,
    );
    expect(state.bytes).toBe(3 * len);
    for (const key of state.keys) expect(typeof key).toBe("string");
  });

  it("returns but does not cache an entry larger than the whole budget", async () => {
    const huge = "z".repeat(ORRERY_DERIVATIVE_CACHE_SPARE_BYTES + 1);
    const { d } = deps(
      { "file:///docs/avatars/h.jpg": 1024 },
      { downsample: async () => ({ base64: huge, uri: "file:///cache/h" }) },
    );
    const image = await loadOrreryImage("avatars/h.jpg", 1, d);
    expect(image).not.toBeNull();
    expect(orreryDerivativeCacheState()).toEqual({
      keys: [],
      bytes: 0,
      live: [],
    });
  });
});

describe("derivative cache — sized to the Orrery's photos (38.6 D-37)", () => {
  /** ~100 KB of base64, the size of a real 512 JPEG q0.9 derivative. */
  const PHOTO_BYTES = 100_000;
  const PHOTOS = 60; // 6 MB, well over the old fixed 4 MiB budget
  const paths = Array.from({ length: PHOTOS }, (_, i) => `avatars/p${i}.jpg`);
  const sizes = Object.fromEntries(
    paths.map((p) => [`file:///docs/${p}`, 1024]),
  );
  function counting() {
    const made = deps(sizes, {
      downsample: async (uri) => {
        made.calls.downsamples.push(uri);
        return { base64: uri.padEnd(PHOTO_BYTES, "x"), uri: "file:///cache/d" };
      },
    });
    return made;
  }

  it("keeps all 60 mounted photos, so a return to the Orrery re-derives none", async () => {
    // First visit: every body mounts (retains its path) and loads.
    let releases = paths.map((p) => retainOrreryPhoto(p));
    const first = counting();
    await Promise.all(paths.map((p) => loadOrreryImage(p, 1, first.d)));
    expect(first.calls.downsamples).toHaveLength(PHOTOS);
    expect(orreryDerivativeCacheState().keys).toHaveLength(PHOTOS);
    expect(orreryDerivativeCacheState().bytes).toBe(PHOTOS * PHOTO_BYTES);
    expect(orreryDerivativeCacheState().bytes).toBeGreaterThan(
      ORRERY_DERIVATIVE_CACHE_SPARE_BYTES,
    );

    // Leave the tab: every body unmounts.
    for (const release of releases) release();
    expect(orreryDerivativeCacheState().live).toEqual([]);

    // Return: every body remounts; every photo is a cache hit.
    releases = paths.map((p) => retainOrreryPhoto(p));
    const back = counting();
    const images = await Promise.all(
      paths.map((p) => loadOrreryImage(p, 1, back.d)),
    );
    expect(back.calls.downsamples).toEqual([]);
    expect(back.calls.fileUris).toEqual([]);
    expect(images.every((image) => image !== null)).toBe(true);
    for (const release of releases) release();
  });

  it("a derivation finishing while the Orrery is away does not evict the photos it will show on return", async () => {
    const releases = paths.map((p) => retainOrreryPhoto(p));
    await Promise.all(paths.map((p) => loadOrreryImage(p, 1, counting().d)));
    for (const release of releases) release();
    // A late put with nothing mounted (e.g. the in-flight downsample at blur).
    const late = deps(
      { "file:///docs/avatars/late.jpg": 1024 },
      {
        downsample: async () => ({
          base64: "l".repeat(PHOTO_BYTES),
          uri: "file:///cache/l",
        }),
      },
    );
    await loadOrreryImage("avatars/late.jpg", 1, late.d);
    const keys = orreryDerivativeCacheState().keys;
    for (const p of paths) expect(keys).toContain(`${p}#1`);
  });

  it("evicts photos no mounted body shows before any live one", async () => {
    // Two photos from a System viewed earlier, now unmounted (idle).
    const idleLen = Math.floor(ORRERY_DERIVATIVE_CACHE_SPARE_BYTES / 2);
    for (const p of ["avatars/old-a.jpg", "avatars/old-b.jpg"]) {
      await loadOrreryImage(
        p,
        1,
        deps(
          { [`file:///docs/${p}`]: 1024 },
          {
            downsample: async () => ({
              base64: "o".repeat(idleLen),
              uri: "file:///cache/o",
            }),
          },
        ).d,
      );
    }
    // The current System's 60 photos mount and load.
    const releases = paths.map((p) => retainOrreryPhoto(p));
    await Promise.all(paths.map((p) => loadOrreryImage(p, 1, counting().d)));
    const state = orreryDerivativeCacheState();
    for (const p of paths) expect(state.keys).toContain(`${p}#1`);
    expect(state.bytes).toBeLessThanOrEqual(orreryDerivativeCacheBudget());
    expect(orreryDerivativeCacheBudget()).toBe(
      PHOTOS * PHOTO_BYTES + ORRERY_DERIVATIVE_CACHE_SPARE_BYTES,
    );
    for (const release of releases) release();
  });

  it("never exceeds the hard cap, even when every photo is live", async () => {
    const big = Math.floor(ORRERY_DERIVATIVE_CACHE_MAX_BYTES / 4) + 1;
    const many = ["a", "b", "c", "d", "e"].map((p) => `avatars/${p}.jpg`);
    const releases = many.map((p) => retainOrreryPhoto(p));
    for (const p of many) {
      await loadOrreryImage(
        p,
        1,
        deps(
          { [`file:///docs/${p}`]: 1024 },
          {
            downsample: async () => ({
              base64: p.padEnd(big, "x"),
              uri: "file:///cache/b",
            }),
          },
        ).d,
      );
    }
    const state = orreryDerivativeCacheState();
    expect(state.bytes).toBeLessThanOrEqual(ORRERY_DERIVATIVE_CACHE_MAX_BYTES);
    expect(orreryDerivativeCacheBudget()).toBe(
      ORRERY_DERIVATIVE_CACHE_MAX_BYTES,
    );
    // Oldest live entries went first; the newest stays.
    expect(state.keys[state.keys.length - 1]).toBe("avatars/e.jpg#1");
    expect(state.keys).not.toContain("avatars/a.jpg#1");
    for (const release of releases) release();
  });

  it("retain/release is reference-counted and release is idempotent", () => {
    const one = retainOrreryPhoto("avatars/a.jpg");
    const two = retainOrreryPhoto("avatars/a.jpg");
    one();
    one();
    expect(orreryDerivativeCacheState().live).toEqual(["avatars/a.jpg"]);
    two();
    expect(orreryDerivativeCacheState().live).toEqual([]);
  });
});

describe("derivative cache — a late older revision never evicts a newer one (IN-02)", () => {
  it("keeps revision 2 when a revision-1 result lands afterwards, and does not cache revision 1", async () => {
    const { d, calls } = deps({ "file:///docs/avatars/contact-1.jpg": 1024 });
    await loadOrreryImage("avatars/contact-1.jpg", 2, d);
    const late = await loadOrreryImage("avatars/contact-1.jpg", 1, d);
    // The late caller still gets its image.
    expect(late).not.toBeNull();
    expect(calls.downsamples).toHaveLength(2);
    expect(orreryDerivativeCacheState().keys).toEqual([
      "avatars/contact-1.jpg#2",
    ]);
    // Revision 2 is still a hit.
    await loadOrreryImage("avatars/contact-1.jpg", 2, d);
    expect(calls.downsamples).toHaveLength(2);
  });

  it("a newer revision still replaces an older one", async () => {
    const { d } = deps({ "file:///docs/avatars/contact-1.jpg": 1024 });
    await loadOrreryImage("avatars/contact-1.jpg", 1, d);
    await loadOrreryImage("avatars/contact-1.jpg", 3, d);
    expect(orreryDerivativeCacheState().keys).toEqual([
      "avatars/contact-1.jpg#3",
    ]);
  });
});

describe("cancellation — queued downsamples nobody wants never run (IN-02)", () => {
  function blocking(paths: string[]) {
    const started: string[] = [];
    const releases: Array<() => void> = [];
    const sizes = Object.fromEntries(
      paths.map((p) => [`file:///docs/${p}`, 1024]),
    );
    const { d, calls } = deps(sizes, {
      downsample: (uri) => {
        started.push(uri);
        return new Promise((resolve) => {
          releases.push(() =>
            resolve({ base64: `s-${uri}`, uri: "file:///cache/x" }),
          );
        });
      },
    });
    return { d, calls, started, releases };
  }
  const token = (): OrreryLoadToken => ({ cancelled: false });

  it("skips a queued downsample whose only requester cancelled and hands the slot on", async () => {
    const run = blocking(["avatars/a.jpg", "avatars/b.jpg", "avatars/c.jpg"]);
    const [ta, tb, tc] = [token(), token(), token()];
    const a = loadOrreryImage("avatars/a.jpg", 1, run.d, ta);
    const b = loadOrreryImage("avatars/b.jpg", 1, run.d, tb);
    const c = loadOrreryImage("avatars/c.jpg", 1, run.d, tc);
    await flush();
    expect(run.started).toEqual(["file:///docs/avatars/a.jpg"]);

    tb.cancelled = true; // b's body unmounted while queued
    run.releases.shift()?.();
    await flush();
    expect(run.started).toEqual([
      "file:///docs/avatars/a.jpg",
      "file:///docs/avatars/c.jpg",
    ]);
    run.releases.shift()?.();

    await expect(b).resolves.toBeNull();
    expect(await a).not.toBeNull();
    expect(await c).not.toBeNull();
    // Nothing was cached for b; a cancellation is not a failure (no log).
    expect(orreryDerivativeCacheState().keys).not.toContain("avatars/b.jpg#1");
    expect(Logger.warn).not.toHaveBeenCalled();
    // Every large header image, b's included, was disposed.
    for (const image of created.filter((i) => i.label.startsWith("large:")))
      expect(image.disposeCount).toBe(1);
  });

  it("still runs a queued downsample while any requester of it is live", async () => {
    const run = blocking(["avatars/a.jpg", "avatars/b.jpg"]);
    const a = loadOrreryImage("avatars/a.jpg", 1, run.d, token());
    const gone = token();
    const stays = token();
    const b1 = loadOrreryImage("avatars/b.jpg", 1, run.d, gone);
    const b2 = loadOrreryImage("avatars/b.jpg", 1, run.d, stays);
    await flush();
    gone.cancelled = true;
    run.releases.shift()?.();
    await flush();
    expect(run.started).toEqual([
      "file:///docs/avatars/a.jpg",
      "file:///docs/avatars/b.jpg",
    ]);
    run.releases.shift()?.();
    await a;
    await expect(b1).resolves.toBeNull();
    expect(await b2).not.toBeNull();
    expect(orreryDerivativeCacheState().keys).toContain("avatars/b.jpg#1");
  });

  it("a load cancelled mid-derivation makes no SkImage but keeps the derivative for the next mount", async () => {
    const run = blocking(["avatars/a.jpg"]);
    const t = token();
    const a = loadOrreryImage("avatars/a.jpg", 1, run.d, t);
    await flush();
    t.cancelled = true;
    run.releases.shift()?.();
    await expect(a).resolves.toBeNull();
    expect(created.filter((i) => i.label.startsWith("small:"))).toEqual([]);
    expect(orreryDerivativeCacheState().keys).toEqual(["avatars/a.jpg#1"]);
    const again = await loadOrreryImage("avatars/a.jpg", 1, run.d, token());
    expect(again).not.toBeNull();
    expect(run.started).toHaveLength(1);
  });

  it("a load cancelled before its file read resolves decodes nothing", async () => {
    const t = token();
    const { d } = deps(
      { "file:///docs/avatars/a.jpg": 1024 },
      {
        readData: async (uri) => {
          t.cancelled = true;
          return { file: uri } as unknown as SkData;
        },
      },
    );
    await expect(loadOrreryImage("avatars/a.jpg", 1, d, t)).resolves.toBeNull();
    expect(created).toEqual([]);
  });
});

describe("downsample queue — at most ORRERY_DOWNSAMPLE_CONCURRENCY in flight", () => {
  it("runs 10 concurrent 1024 loads one downsample at a time and resolves all", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const releases: Array<() => void> = [];
    const sizes = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        `file:///docs/avatars/p${i}.jpg`,
        1024,
      ]),
    );
    const { d } = deps(sizes, {
      downsample: (uri) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise((resolve) => {
          releases.push(() => {
            inFlight -= 1;
            resolve({ base64: `s-${uri}`, uri: "file:///cache/x" });
          });
        });
      },
    });
    const loads = Array.from({ length: 10 }, (_, i) =>
      loadOrreryImage(`avatars/p${i}.jpg`, 1, d),
    );
    let resolvedCount = 0;
    while (resolvedCount < 10) {
      await new Promise((r) => setTimeout(r, 0));
      const next = releases.shift();
      if (next) {
        next();
        resolvedCount += 1;
      }
    }
    const images = await Promise.all(loads);
    expect(maxInFlight).toBe(1);
    expect(images.every((image) => image !== null)).toBe(true);
  });

  it("a rejecting downsample releases its slot so the next one starts", async () => {
    let calls = 0;
    const { d } = deps(
      {
        "file:///docs/avatars/x.jpg": 1024,
        "file:///docs/avatars/y.jpg": 1024,
      },
      {
        downsample: async (uri) => {
          calls += 1;
          if (uri.endsWith("x.jpg")) throw new Error("manipulator");
          return { base64: "ok", uri: "file:///cache/y" };
        },
      },
    );
    const [x, y] = await Promise.all([
      loadOrreryImage("avatars/x.jpg", 1, d),
      loadOrreryImage("avatars/y.jpg", 1, d),
    ]);
    expect(x).toBeNull();
    expect(y).not.toBeNull();
    expect(calls).toBe(2);
  });
});

describe("loadOrreryImage — every error path disposes what it created", () => {
  it("disposes the large image when the downsample throws", async () => {
    const { d } = deps(
      { "file:///docs/avatars/a.jpg": 1024 },
      {
        downsample: async () => {
          throw new Error("manipulator");
        },
      },
    );
    await expect(loadOrreryImage("avatars/a.jpg", 1, d)).resolves.toBeNull();
    expect(disposeCounts()).toEqual([1]);
  });

  it("disposes the large image when fromBase64 or the small decode throws", async () => {
    const base = deps({ "file:///docs/avatars/a.jpg": 1024 });
    const throwingFromBase64 = {
      ...base.d,
      fromBase64: () => {
        throw new Error("bad base64");
      },
    };
    await expect(
      loadOrreryImage("avatars/a.jpg", 1, throwingFromBase64),
    ).resolves.toBeNull();
    expect(disposeCounts()).toEqual([1]);

    created = [];
    resetOrreryPhotoCacheForTests();
    const throwingDecode = {
      ...base.d,
      decode: (data: SkData) => {
        const raw = data as unknown as { file?: string };
        if (raw.file === undefined) throw new Error("bad derivative");
        return base.d.decode(data);
      },
    };
    await expect(
      loadOrreryImage("avatars/a.jpg", 1, throwingDecode),
    ).resolves.toBeNull();
    expect(disposeCounts()).toEqual([1]);
  });

  it("resolves null when the read fails or the header decode fails", async () => {
    const readFails = deps(
      {},
      {
        readData: async () => {
          throw new Error("missing");
        },
      },
    );
    await expect(
      loadOrreryImage("avatars/gone.jpg", 1, readFails.d),
    ).resolves.toBeNull();
    const decodeNull = deps({}, { decode: () => null });
    await expect(
      loadOrreryImage("avatars/corrupt.jpg", 1, decodeNull.d),
    ).resolves.toBeNull();
    expect(created).toEqual([]);
  });
});

describe("createOrreryImageSlot — the hook's SkImage lifecycle", () => {
  it("disposes image N only after N+1 is published AND N's post-commit retire runs", () => {
    const slot = createOrreryImageSlot();
    const one = fakeImage("1", 512);
    const two = fakeImage("2", 512);
    expect(slot.settle(asSk(one), false)).toBe(true);
    expect(slot.published).toBe(asSk(one));
    expect(slot.settle(asSk(two), false)).toBe(true);
    // Published N+1, commit not yet retired N: N is untouched.
    expect(one.disposeCount).toBe(0);
    slot.retire(asSk(one));
    expect(one.disposeCount).toBe(1);
    expect(two.disposeCount).toBe(0);
    // Unmount retires the published image.
    slot.retire(asSk(two));
    expect(two.disposeCount).toBe(1);
    expect(slot.published).toBeNull();
  });

  it("never disposes the published image except through its own retire", () => {
    const slot = createOrreryImageSlot();
    const one = fakeImage("1", 512);
    slot.publish(asSk(one));
    slot.discard(null);
    slot.retire(null);
    expect(one.disposeCount).toBe(0);
  });

  it("a load resolving after cancellation is disposed and never published", () => {
    const slot = createOrreryImageSlot();
    const live = fakeImage("live", 512);
    const late = fakeImage("late", 512);
    slot.publish(asSk(live));
    expect(slot.settle(asSk(late), true)).toBe(false);
    expect(late.disposeCount).toBe(1);
    expect(slot.published).toBe(asSk(live));
    expect(live.disposeCount).toBe(0);
  });

  it("an error-path result is disposed and never published", () => {
    const slot = createOrreryImageSlot();
    const bad = fakeImage("bad", 512);
    slot.discard(asSk(bad));
    expect(bad.disposeCount).toBe(1);
    expect(slot.published).toBeNull();
  });

  it("disposes nothing twice", () => {
    const slot = createOrreryImageSlot();
    const one = fakeImage("1", 512);
    slot.settle(asSk(one), false);
    slot.retire(asSk(one));
    slot.retire(asSk(one));
    slot.discard(asSk(one));
    expect(one.disposeCount).toBe(1);
  });

  it("20 revision changes leave only the published image undisposed", () => {
    const slot = createOrreryImageSlot();
    let committed: FakeImage | null = null;
    for (let i = 0; i < 20; i++) {
      const next = fakeImage(`rev-${i}`, 512);
      // Every other revision's load is overtaken (cancelled) before it lands.
      if (i % 3 === 1) {
        slot.settle(asSk(next), true);
        continue;
      }
      slot.settle(asSk(next), false);
      // The post-commit retire of the image this commit replaced.
      if (committed) slot.retire(asSk(committed));
      committed = next;
    }
    const undisposed = created.filter((image) => image.disposeCount === 0);
    expect(undisposed).toEqual([committed]);
    expect(created.every((image) => image.disposeCount <= 1)).toBe(true);
    expect(slot.published).toBe(asSk(committed!));
  });
});

describe("defaultOrreryImageDeps.downsample — native release (WR-02)", () => {
  beforeEach(() => {
    m.refReleases.length = 0;
    m.contextReleases.length = 0;
    m.renderThrows = false;
    m.saveBase64 = "QUJD";
  });

  it("releases the rendered ref AND its context once on success", async () => {
    await expect(
      defaultOrreryImageDeps.downsample("file:///docs/avatars/contact-1.jpg"),
    ).resolves.toEqual({ base64: "QUJD", uri: "file:///cache/small.jpg" });
    expect(m.refReleases).toEqual([1]);
    expect(m.contextReleases).toEqual([1]);
  });

  it("releases both when the payload is missing", async () => {
    m.saveBase64 = undefined;
    await expect(
      defaultOrreryImageDeps.downsample("file:///docs/avatars/contact-1.jpg"),
    ).rejects.toThrow("no base64 payload");
    expect(m.refReleases).toEqual([1]);
    expect(m.contextReleases).toEqual([1]);
  });

  it("releases the context when the render itself rejects", async () => {
    m.renderThrows = true;
    await expect(
      defaultOrreryImageDeps.downsample("file:///docs/avatars/contact-1.jpg"),
    ).rejects.toThrow("mock decode failed");
    expect(m.refReleases).toEqual([]);
    expect(m.contextReleases).toEqual([1]);
  });
});
