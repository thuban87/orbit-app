/**
 * use-orrery-photo — node proof of the D-11 orrery texture gate with the D-41
 * on-disk derivative: the ≤512 pass-through, a derivative HIT that never reads
 * or decodes the >512 master, a MISS that generates and installs one, a stale
 * signature and a corrupt / oversized derivative that are ignored and
 * regenerated, cancellation of queued generations (review IN-02), the
 * generation concurrency cap, and SkImage disposal (loader and the pure
 * lifecycle helper the hook drives). Every native boundary is a fake; nothing
 * loads Skia, the manipulator or the file system.
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
  saveOptions: [] as unknown[],
  saveUri: "file:///cache/ImageManipulator/small.jpg" as string | undefined,
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
            async saveAsync(opts: unknown) {
              m.saveOptions.push(opts);
              return { uri: m.saveUri };
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
vi.mock("@/services/photos/orrery-derivative-store", () => ({
  dropOrreryDerivative: vi.fn(),
  findOrreryDerivative: vi.fn(() => null),
  installOrreryDerivative: vi.fn(),
  orreryMasterSignature: vi.fn(() => null),
}));
vi.mock("@/utils/logger", () => ({
  Logger: { warn: vi.fn(), error: vi.fn() },
}));

import { Logger } from "@/utils/logger";
import {
  createOrreryImageSlot,
  defaultOrreryImageDeps,
  loadOrreryImage,
  ORRERY_DERIVATIVE_QUALITY,
  ORRERY_DOWNSAMPLE_CONCURRENCY,
  ORRERY_TEXTURE_MAX,
  type OrreryImageDeps,
  type OrreryLoadToken,
  resetOrreryPhotoQueueForTests,
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

/** A derivative file on the fake disk: `corrupt` → undecodable. */
interface FakeDerivative {
  size: number;
  corrupt?: boolean;
  unreadable?: boolean;
}

/**
 * A fake world: masters (px edge + durable signature) and the derivative
 * files on "disk". Derivative URIs are `deriv:<relative>@<signature>`, so a
 * lookup only ever matches the exact signature. `readData(uri)` yields
 * `{file: uri}`; `decode` sizes masters from `masters` and derivatives from
 * `disk` (a corrupt one decodes to null).
 */
function world(
  masters: Record<string, { size: number; sig: string | null }>,
  overrides: Partial<OrreryImageDeps> = {},
) {
  const disk = new Map<string, FakeDerivative>();
  const calls = {
    reads: [] as string[],
    downsamples: [] as string[],
    installs: [] as string[],
    drops: [] as string[],
  };
  const masterUri = (relative: string) => `file:///docs/${relative}`;
  const derivUri = (relative: string, sig: string) =>
    `deriv:${relative}@${sig}`;
  const d: OrreryImageDeps = {
    fileUri: masterUri,
    readData: async (uri) => {
      calls.reads.push(uri);
      if (disk.get(uri)?.unreadable) throw new Error("read failed");
      return { file: uri } as unknown as SkData;
    },
    decode: (data) => {
      const uri = (data as unknown as { file: string }).file;
      if (uri.startsWith("deriv:")) {
        const file = disk.get(uri);
        if (!file || file.corrupt) return null;
        return asSk(fakeImage(`small:${uri}`, file.size));
      }
      const relative = uri.slice("file:///docs/".length);
      return asSk(
        fakeImage(
          `large:${uri}`,
          masters[relative]?.size ?? ORRERY_TEXTURE_MAX,
        ),
      );
    },
    signature: (relative) => masters[relative]?.sig ?? null,
    findDerivative: (relative, sig) => {
      const uri = derivUri(relative, sig);
      return disk.has(uri) ? uri : null;
    },
    downsample: async (uri) => {
      calls.downsamples.push(uri);
      return { uri: `tmp:${uri}` };
    },
    install: async (tempUri, relative, sig) => {
      calls.installs.push(tempUri);
      const uri = derivUri(relative, sig);
      disk.set(uri, { size: ORRERY_TEXTURE_MAX });
      return uri;
    },
    dropDerivative: (uri) => {
      calls.drops.push(uri);
      disk.delete(uri);
    },
    ...overrides,
  };
  return { d, calls, disk, derivUri, masterUri };
}

const disposeCounts = () => created.map((image) => image.disposeCount);
const larges = () => created.filter((c) => c.label.startsWith("large:"));
const smalls = () => created.filter((c) => c.label.startsWith("small:"));

beforeEach(() => {
  created = [];
  resetOrreryPhotoQueueForTests();
  vi.mocked(Logger.warn).mockClear();
});

/** Let queued promise continuations (slot hand-offs, awaits) run. */
async function flush(turns = 4): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
}

const BIG = { size: 1024, sig: "36109-1000" };

describe("tunables", () => {
  it("pins the D-11 / D-41 bounds", () => {
    expect(ORRERY_TEXTURE_MAX).toBe(512);
    expect(ORRERY_DOWNSAMPLE_CONCURRENCY).toBe(1);
    expect(ORRERY_DERIVATIVE_QUALITY).toBe(0.9);
  });
});

describe("loadOrreryImage — pass-through", () => {
  it("returns null for a value that is not a stored photo path, without reading anything (38.6 D-34)", async () => {
    const signature = vi.fn(() => "1-1");
    const fileUri = vi.fn((relative: string) => `file:///docs/${relative}`);
    const { d, calls } = world({}, { fileUri, signature });
    await expect(loadOrreryImage("Rex", d)).resolves.toBeNull();
    expect(signature).not.toHaveBeenCalled();
    expect(fileUri).not.toHaveBeenCalled();
    expect(calls.reads).toEqual([]);
  });

  it("returns null for a missing master without reading anything (D-23 initials)", async () => {
    const { d, calls } = world({});
    await expect(loadOrreryImage("avatars/gone.jpg", d)).resolves.toBeNull();
    expect(calls.reads).toEqual([]);
    expect(created).toEqual([]);
    expect(Logger.warn).not.toHaveBeenCalled();
  });

  it("returns a ≤512 master as decoded and never makes a derivative", async () => {
    const { d, calls } = world({
      "avatars/contact-1.jpg": { size: 512, sig: "20607-1" },
      "avatars/contact-2.jpg": { size: 96, sig: "3000-2" },
    });
    const image = await loadOrreryImage("avatars/contact-1.jpg", d);
    expect((image as unknown as FakeImage).label).toBe(
      "large:file:///docs/avatars/contact-1.jpg",
    );
    await loadOrreryImage("avatars/contact-2.jpg", d);
    expect(calls.downsamples).toEqual([]);
    expect(calls.installs).toEqual([]);
    expect(disposeCounts()).toEqual([0, 0]);
  });
});

describe("loadOrreryImage — on-disk derivative (38.6 D-41)", () => {
  it("MISS: generates and installs a derivative, draws it, disposes the large image undrawn", async () => {
    const w = world({ "avatars/contact-1.jpg": BIG });
    const image = (await loadOrreryImage(
      "avatars/contact-1.jpg",
      w.d,
    )) as unknown as FakeImage;
    expect(w.calls.downsamples).toEqual(["file:///docs/avatars/contact-1.jpg"]);
    expect(w.calls.installs).toEqual([
      "tmp:file:///docs/avatars/contact-1.jpg",
    ]);
    expect(image.label).toBe(
      `small:${w.derivUri("avatars/contact-1.jpg", BIG.sig)}`,
    );
    expect(larges()).toHaveLength(1);
    expect(larges()[0].disposeCount).toBe(1);
    expect(image.disposeCount).toBe(0);
  });

  it("HIT: never reads or decodes a >512 master once a valid derivative exists", async () => {
    const w = world({ "avatars/contact-1.jpg": BIG });
    w.disk.set(w.derivUri("avatars/contact-1.jpg", BIG.sig), {
      size: ORRERY_TEXTURE_MAX,
    });
    const image = await loadOrreryImage("avatars/contact-1.jpg", w.d);
    expect(image).not.toBeNull();
    expect(w.calls.reads).toEqual([
      w.derivUri("avatars/contact-1.jpg", BIG.sig),
    ]);
    expect(w.calls.reads).not.toContain(w.masterUri("avatars/contact-1.jpg"));
    expect(larges()).toEqual([]);
    expect(w.calls.downsamples).toEqual([]);
  });

  it("generates once: every later load (a return visit, or a restart) is a disk hit", async () => {
    const w = world({ "avatars/contact-1.jpg": BIG });
    await loadOrreryImage("avatars/contact-1.jpg", w.d);
    // A restart clears every in-process structure; the disk survives.
    resetOrreryPhotoQueueForTests();
    created = [];
    for (let i = 0; i < 3; i++)
      expect(
        await loadOrreryImage("avatars/contact-1.jpg", w.d),
      ).not.toBeNull();
    expect(w.calls.downsamples).toHaveLength(1);
    expect(larges()).toEqual([]);
  });

  it("STALE: a derivative for an older signature is never used; the new bytes get their own", async () => {
    const masters = { "avatars/contact-1.jpg": { ...BIG } };
    const w = world(masters);
    w.disk.set(w.derivUri("avatars/contact-1.jpg", "11111-1"), {
      size: ORRERY_TEXTURE_MAX,
    });
    const image = (await loadOrreryImage(
      "avatars/contact-1.jpg",
      w.d,
    )) as unknown as FakeImage;
    expect(w.calls.reads).not.toContain(
      w.derivUri("avatars/contact-1.jpg", "11111-1"),
    );
    expect(w.calls.downsamples).toHaveLength(1);
    expect(image.label).toBe(
      `small:${w.derivUri("avatars/contact-1.jpg", BIG.sig)}`,
    );

    // The master is replaced (new signature): the next load regenerates.
    masters["avatars/contact-1.jpg"].sig = "40000-2000";
    const next = (await loadOrreryImage(
      "avatars/contact-1.jpg",
      w.d,
    )) as unknown as FakeImage;
    expect(w.calls.downsamples).toHaveLength(2);
    expect(next.label).toBe(
      `small:${w.derivUri("avatars/contact-1.jpg", "40000-2000")}`,
    );
  });

  it.each([
    ["undecodable", { size: ORRERY_TEXTURE_MAX, corrupt: true }],
    ["unreadable", { size: ORRERY_TEXTURE_MAX, unreadable: true }],
    ["oversized", { size: 1024 }],
    ["empty-edged", { size: 0 }],
  ])(
    "CORRUPT (%s): the derivative is dropped and regenerated",
    async (_, file) => {
      const w = world({ "avatars/contact-1.jpg": BIG });
      const uri = w.derivUri("avatars/contact-1.jpg", BIG.sig);
      w.disk.set(uri, file);
      const image = (await loadOrreryImage(
        "avatars/contact-1.jpg",
        w.d,
      )) as unknown as FakeImage;
      expect(w.calls.drops).toEqual([uri]);
      expect(w.calls.downsamples).toHaveLength(1);
      expect(image.label).toBe(`small:${uri}`);
      expect(image.size).toBe(ORRERY_TEXTURE_MAX);
      // Whatever the bad derivative decoded to was disposed, never returned.
      for (const bad of smalls().filter((s) => s !== image))
        expect(bad.disposeCount).toBe(1);
    },
  );

  it("a freshly installed derivative that will not decode resolves null (dropped, logged)", async () => {
    const w = world({ "avatars/contact-1.jpg": BIG });
    w.d.install = async (_temp, relative, sig) => {
      const uri = w.derivUri(relative, sig);
      w.disk.set(uri, { size: ORRERY_TEXTURE_MAX, corrupt: true });
      return uri;
    };
    await expect(
      loadOrreryImage("avatars/contact-1.jpg", w.d),
    ).resolves.toBeNull();
    expect(w.calls.drops).toHaveLength(1);
    expect(Logger.warn).toHaveBeenCalledTimes(1);
    expect(larges()[0].disposeCount).toBe(1);
  });

  it("resolves null when the master changed during generation (nothing installed)", async () => {
    const w = world(
      { "avatars/contact-1.jpg": BIG },
      {
        install: async () => null,
      },
    );
    await expect(
      loadOrreryImage("avatars/contact-1.jpg", w.d),
    ).resolves.toBeNull();
    expect(smalls()).toEqual([]);
    expect(larges()[0].disposeCount).toBe(1);
    expect(Logger.warn).not.toHaveBeenCalled();
  });

  it("feeds Skia and the manipulator the plain file URI (no ?v= query)", async () => {
    const w = world({ "avatars/contact-1.jpg": BIG });
    await loadOrreryImage("avatars/contact-1.jpg", w.d);
    for (const uri of [...w.calls.reads, ...w.calls.downsamples])
      expect(uri).not.toContain("?");
  });
});

describe("cancellation — queued generations nobody wants never run (IN-02)", () => {
  function blocking(paths: string[]) {
    const started: string[] = [];
    const releases: Array<() => void> = [];
    const w = world(Object.fromEntries(paths.map((p) => [p, { ...BIG }])), {
      downsample: (uri) => {
        started.push(uri);
        return new Promise((resolve) => {
          releases.push(() => resolve({ uri: `tmp:${uri}` }));
        });
      },
    });
    return { ...w, started, releases };
  }
  const token = (): OrreryLoadToken => ({ cancelled: false });

  it("skips a queued generation whose only requester cancelled and hands the slot on", async () => {
    const run = blocking(["avatars/a.jpg", "avatars/b.jpg", "avatars/c.jpg"]);
    const [ta, tb, tc] = [token(), token(), token()];
    const a = loadOrreryImage("avatars/a.jpg", run.d, ta);
    const b = loadOrreryImage("avatars/b.jpg", run.d, tb);
    const c = loadOrreryImage("avatars/c.jpg", run.d, tc);
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
    // Nothing was installed for b; a cancellation is not a failure (no log).
    expect(run.disk.has(run.derivUri("avatars/b.jpg", BIG.sig))).toBe(false);
    expect(Logger.warn).not.toHaveBeenCalled();
    // Every large header image, b's included, was disposed.
    for (const image of larges()) expect(image.disposeCount).toBe(1);
  });

  it("still runs a queued generation while any requester of it is live (two bodies, one generation)", async () => {
    const run = blocking(["avatars/a.jpg", "avatars/b.jpg"]);
    const a = loadOrreryImage("avatars/a.jpg", run.d, token());
    const gone = token();
    const stays = token();
    const b1 = loadOrreryImage("avatars/b.jpg", run.d, gone);
    const b2 = loadOrreryImage("avatars/b.jpg", run.d, stays);
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
    expect(run.calls.installs).toHaveLength(2);
  });

  it("a load cancelled mid-generation makes no SkImage but installs the derivative for the next mount", async () => {
    const run = blocking(["avatars/a.jpg"]);
    const t = token();
    const a = loadOrreryImage("avatars/a.jpg", run.d, t);
    await flush();
    t.cancelled = true;
    run.releases.shift()?.();
    await expect(a).resolves.toBeNull();
    expect(smalls()).toEqual([]);
    expect(run.disk.has(run.derivUri("avatars/a.jpg", BIG.sig))).toBe(true);
    const again = await loadOrreryImage("avatars/a.jpg", run.d, token());
    expect(again).not.toBeNull();
    expect(run.started).toHaveLength(1);
  });

  it("a load cancelled before its file read resolves decodes nothing", async () => {
    const t = token();
    const w = world(
      { "avatars/a.jpg": BIG },
      {
        readData: async (uri) => {
          t.cancelled = true;
          return { file: uri } as unknown as SkData;
        },
      },
    );
    await expect(loadOrreryImage("avatars/a.jpg", w.d, t)).resolves.toBeNull();
    expect(created).toEqual([]);
  });

  it("a cancelled derivative hit decodes nothing", async () => {
    const t = token();
    const w = world({ "avatars/a.jpg": BIG });
    w.disk.set(w.derivUri("avatars/a.jpg", BIG.sig), {
      size: ORRERY_TEXTURE_MAX,
    });
    const read = w.d.readData;
    w.d.readData = async (uri) => {
      t.cancelled = true;
      return read(uri);
    };
    await expect(loadOrreryImage("avatars/a.jpg", w.d, t)).resolves.toBeNull();
    expect(created).toEqual([]);
  });
});

describe("generation queue — at most ORRERY_DOWNSAMPLE_CONCURRENCY in flight", () => {
  it("runs 10 concurrent 1024 loads one generation at a time and resolves all", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const releases: Array<() => void> = [];
    const masters = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`avatars/p${i}.jpg`, { ...BIG }]),
    );
    const { d } = world(masters, {
      downsample: (uri) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise((resolve) => {
          releases.push(() => {
            inFlight -= 1;
            resolve({ uri: `tmp:${uri}` });
          });
        });
      },
    });
    const loads = Array.from({ length: 10 }, (_, i) =>
      loadOrreryImage(`avatars/p${i}.jpg`, d),
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

  it("a rejecting generation releases its slot so the next one starts", async () => {
    let calls = 0;
    const { d } = world(
      { "avatars/x.jpg": BIG, "avatars/y.jpg": BIG },
      {
        downsample: async (uri) => {
          calls += 1;
          if (uri.endsWith("x.jpg")) throw new Error("manipulator");
          return { uri: `tmp:${uri}` };
        },
      },
    );
    const [x, y] = await Promise.all([
      loadOrreryImage("avatars/x.jpg", d),
      loadOrreryImage("avatars/y.jpg", d),
    ]);
    expect(x).toBeNull();
    expect(y).not.toBeNull();
    expect(calls).toBe(2);
  });
});

describe("loadOrreryImage — every error path disposes what it created", () => {
  it("disposes the large image when the downsample throws", async () => {
    const { d } = world(
      { "avatars/a.jpg": BIG },
      {
        downsample: async () => {
          throw new Error("manipulator");
        },
      },
    );
    await expect(loadOrreryImage("avatars/a.jpg", d)).resolves.toBeNull();
    expect(disposeCounts()).toEqual([1]);
  });

  it("disposes the large image when the install throws", async () => {
    const { d } = world(
      { "avatars/a.jpg": BIG },
      {
        install: async () => {
          throw new Error("move failed");
        },
      },
    );
    await expect(loadOrreryImage("avatars/a.jpg", d)).resolves.toBeNull();
    expect(disposeCounts()).toEqual([1]);
  });

  it("resolves null when the master read fails or its header decode fails", async () => {
    const readFails = world(
      { "avatars/gone.jpg": BIG },
      {
        readData: async () => {
          throw new Error("missing");
        },
      },
    );
    await expect(
      loadOrreryImage("avatars/gone.jpg", readFails.d),
    ).resolves.toBeNull();
    const decodeNull = world(
      { "avatars/corrupt.jpg": BIG },
      { decode: () => null },
    );
    await expect(
      loadOrreryImage("avatars/corrupt.jpg", decodeNull.d),
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
    m.saveOptions.length = 0;
    m.renderThrows = false;
    m.saveUri = "file:///cache/ImageManipulator/small.jpg";
  });

  it("returns the encoded temp file (no base64 copy) and releases the rendered ref AND its context once", async () => {
    await expect(
      defaultOrreryImageDeps.downsample("file:///docs/avatars/contact-1.jpg"),
    ).resolves.toEqual({ uri: "file:///cache/ImageManipulator/small.jpg" });
    expect(m.saveOptions).toEqual([
      { format: "jpeg", compress: ORRERY_DERIVATIVE_QUALITY },
    ]);
    expect(m.refReleases).toEqual([1]);
    expect(m.contextReleases).toEqual([1]);
  });

  it("releases both when no file comes back", async () => {
    m.saveUri = undefined;
    await expect(
      defaultOrreryImageDeps.downsample("file:///docs/avatars/contact-1.jpg"),
    ).rejects.toThrow("produced no file");
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
