/**
 * OrreryPhotoCache (38.7-07, D-53/H4/C-M1/M5/H3) — node proof of the shared,
 * bounded photo cache driven the way OrreryWorld drives it: the real spec
 * publisher composes the body specs from `drawn(owner)`, the real generation
 * ledger tracks every published image for the three body layers, and acks are
 * delivered per layer (out of order, some held back) before retired images go
 * back to the cache. Every native boundary is a fake: the loader is a queue of
 * promises, images are plain objects whose `dispose()` asserts no published
 * generation a layer may still re-record references them (use-after-free).
 */
import type { SkImage } from "@shopify/react-native-skia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));
vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoUri: (relative: string) => `file:///docs/${relative}`,
  photoFileStat: () => null,
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

import {
  bumpPhotoCacheBust,
  getPhotoCacheBust,
  subscribePhotoCacheBust,
} from "@/stores/photo-cache-bust-store";
import {
  createOrrerySpecPublisher,
  ORRERY_BODY_LAYERS,
  type OrreryBodyLook,
  type OrreryBodySpecs,
  parseLedgerHandle,
} from "../v2/scene-specs";
import { createOrreryGenerationLedger } from "./orrery-generation-ledger";
import {
  createOrreryPhotoCache,
  ORRERY_PHOTO_CACHE_MAX_BYTES,
  ORRERY_PHOTO_CACHE_MAX_IMAGES,
  ORRERY_PHOTO_CACHE_REPLACEMENT_RESERVE_IMAGES,
  ORRERY_PHOTO_ESTIMATE_BYTES,
  type OrreryPhotoRequest,
} from "./orrery-photo-cache";

const MIB = ORRERY_PHOTO_ESTIMATE_BYTES;
let pathSerial = 0;
/** Unique paths per test: the revision store is process-wide. */
const unique = (name: string) => `avatars/${name}-${++pathSerial}.jpg`;

interface FakeImage {
  label: string;
  disposed: number;
  width(): number;
  height(): number;
  dispose(): void;
}
interface Load {
  path: string;
  token: { cancelled: boolean };
  resolve: (image: SkImage | null) => void;
}

/** A tiny seeded PRNG so "random" ack orders are reproducible. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * One OrreryWorld-shaped owner: looks → spec publisher → ledger; acks queued
 * per layer and delivered by the test; the bound and the use-after-free guard
 * are checked after every step.
 */
function harness(
  options: {
    maxImages?: number;
    maxBytes?: number;
    reserveImages?: number;
    concurrency?: number;
    /** Edge (px) of every decoded image (512 = the 1 MiB estimate). */
    edge?: number;
    seed?: number;
  } = {},
) {
  const maxImages = options.maxImages ?? 6;
  const maxBytes = options.maxBytes ?? maxImages * MIB;
  const edge = options.edge ?? 512;
  const random = rng(options.seed ?? 7);
  const loads: Load[] = [];
  const created: FakeImage[] = [];
  const owner = "orrery-world:test";
  const ledger = createOrreryGenerationLedger<string>();
  /** generation → the images its body specs reference. */
  const history = new Map<number, Set<FakeImage>>();
  /** layer → highest generation delivered to the ledger. */
  const delivered = new Map<string, number>();
  let mountEpoch = 0;
  const specsLog: OrreryBodySpecs[] = [];
  let latest: OrreryBodySpecs | null = null;
  const queue: { layer: string; generation: number; epoch: number }[] = [];
  const held = new Set<string>();
  /** After the H3 teardown no layer can record anything any more. */
  let detached = false;
  const fakeImage = (label: string): FakeImage => {
    const image: FakeImage = {
      label,
      disposed: 0,
      width: () => edge,
      height: () => edge,
      dispose() {
        image.disposed++;
        if (image.disposed > 1) throw new Error(`${label} disposed twice`);
        // Use-after-free guard: no layer may still re-record a generation
        // that references this image.
        if (detached) return;
        for (const [generation, set] of history) {
          if (!set.has(image)) continue;
          for (const layer of ORRERY_BODY_LAYERS)
            if (!((delivered.get(layer) ?? 0) > generation))
              throw new Error(
                `${label} disposed while ${layer} may still record generation ${generation}`,
              );
        }
      },
    };
    created.push(image);
    return image;
  };
  const cache = createOrreryPhotoCache({
    maxImages,
    maxBytes,
    reserveImages: options.reserveImages ?? 2,
    concurrency: options.concurrency ?? 2,
    deps: {
      load: (path, token) =>
        new Promise<SkImage | null>((resolve) => {
          loads.push({ path, token, resolve });
        }),
      revision: (path) => getPhotoCacheBust(path),
      subscribe: subscribePhotoCacheBust,
    },
  });
  function checkBound(): void {
    const stats = cache.stats();
    expect(stats.images + stats.inflight).toBeLessThanOrEqual(maxImages);
    expect(stats.bytes).toBeLessThanOrEqual(maxBytes);
    // Physical truth, independent of the cache's own counters: every image
    // not yet disposed plus every load not yet settled.
    const alive = created.filter((image) => image.disposed === 0).length;
    const unsettled = loads.length;
    expect(alive + unsettled).toBeLessThanOrEqual(maxImages);
    expect(alive * edge * edge * 4 + unsettled * MIB).toBeLessThanOrEqual(
      maxBytes,
    );
  }
  const publisher = createOrrerySpecPublisher({
    ledger,
    writeBodies: (specs) => {
      latest = specs;
      specsLog.push(specs);
      mountEpoch = specs.mountEpoch;
      history.set(
        specs.generation,
        new Set(
          specs.bodies
            .map((body) => body.photo as unknown as FakeImage | null)
            .filter((image): image is FakeImage => image !== null),
        ),
      );
      // Each body layer records it, acks arriving in any order.
      const acks = ORRERY_BODY_LAYERS.map((layer) => ({
        layer,
        generation: specs.generation,
        epoch: specs.mountEpoch,
      }));
      for (let i = acks.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [acks[i], acks[j]] = [acks[j], acks[i]];
      }
      queue.push(...acks);
    },
  });
  let photoEpoch = 0;
  photoEpoch = cache.mount(owner, () => {
    publisher.setPhotos(cache.drawn(owner), photoEpoch);
    checkBound();
  });
  function route(): void {
    for (const handle of ledger.retirable()) {
      const parsed = parseLedgerHandle(handle);
      if (parsed?.kind === "photo")
        cache.confirmRetired(owner, [parsed.id], parsed.epoch);
      checkBound();
    }
  }
  function deliverAck(ack: {
    layer: string;
    generation: number;
    epoch: number;
  }) {
    if (ledger.ack(ack.layer, ack.generation, ack.epoch))
      delivered.set(
        ack.layer,
        Math.max(delivered.get(ack.layer) ?? 0, ack.generation),
      );
    route();
  }
  /** Delivers up to `count` queued acks (held layers stay queued, in order). */
  function ack(count = Number.POSITIVE_INFINITY): number {
    let done = 0;
    for (let i = 0; i < queue.length && done < count; ) {
      if (held.has(queue[i].layer)) {
        i++;
        continue;
      }
      const [next] = queue.splice(i, 1);
      deliverAck(next);
      done++;
    }
    return done;
  }
  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) await Promise.resolve();
    checkBound();
  }
  /** Resolves the load for `path` (or the oldest) with a new image / null. */
  async function finish(
    path?: string,
    result: "image" | "null" = "image",
  ): Promise<FakeImage | null> {
    const index = path ? loads.findIndex((l) => l.path === path) : 0;
    if (index < 0) throw new Error(`no load for ${path}`);
    const [load] = loads.splice(index, 1);
    const image =
      result === "image" ? fakeImage(`${load.path}#${created.length}`) : null;
    load.resolve(image as unknown as SkImage | null);
    await settle();
    return image;
  }
  /** Runs loads and acks until nothing is pending (bounded). */
  async function drain(limit = 200): Promise<void> {
    for (let step = 0; step < limit; step++) {
      if (loads.length > 0) await finish();
      else if (ack(1) === 0) return;
    }
    throw new Error("drain did not converge");
  }
  function looks(paths: readonly (string | null)[]): OrreryBodyLook[] {
    return paths.map((photoKey, i) => ({
      key: `contact:${i + 1}`,
      kind: "contact" as const,
      worldRadius: 16,
      outlineInk: [1, 1, 1, 1] as const,
      swatchInk: [0.5, 0.5, 0.5, 1] as const,
      photoKey,
      initialsFontSize: 16,
      moonInk: [0.5, 0.5, 0.5, 1],
    }));
  }
  /** The canvas unmounted (clock stopped, pictures detached, one round trip). */
  function teardown(): void {
    detached = true;
    queue.length = 0;
    ledger.teardown((handle) => {
      const parsed = parseLedgerHandle(handle);
      if (parsed?.kind === "photo")
        cache.confirmRetired(owner, [parsed.id], parsed.epoch, {
          dispose: true,
        });
    });
  }
  return {
    cache,
    owner,
    teardown,
    loads,
    created,
    publisher,
    ledger,
    held,
    queue,
    get latest() {
      return latest;
    },
    get specsLog() {
      return specsLog;
    },
    get photoEpoch() {
      return photoEpoch;
    },
    get mountEpoch() {
      return mountEpoch;
    },
    looks,
    request(entries: OrreryPhotoRequest[]) {
      cache.request(owner, entries);
      checkBound();
    },
    ack,
    finish,
    settle,
    drain,
    checkBound,
    drawnKeys: () => [...cache.drawn(owner).keys()].sort(),
    imageOf: (key: string) =>
      cache.drawn(owner).get(key)?.image as unknown as FakeImage | undefined,
  };
}

const want = (
  path: string,
  priority: number,
  extra: Partial<OrreryPhotoRequest> = {},
): OrreryPhotoRequest => ({
  key: path,
  relativePath: path,
  priority,
  visible: true,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("tunables", () => {
  it("start at 120 images / 96 MiB with a 4-image replacement reserve", () => {
    expect(ORRERY_PHOTO_CACHE_MAX_IMAGES).toBe(120);
    expect(ORRERY_PHOTO_CACHE_MAX_BYTES).toBe(96 * 1024 * 1024);
    expect(ORRERY_PHOTO_CACHE_REPLACEMENT_RESERVE_IMAGES).toBe(4);
    expect(ORRERY_PHOTO_ESTIMATE_BYTES).toBe(512 * 512 * 4);
  });
});

describe("D-53: one decode per key, priority order, published without React state", () => {
  it("bodies (and owners) that share a photo share one decode and one image", async () => {
    const h = harness();
    const path = unique("shared");
    h.publisher.setLooks(h.looks([path, path, null]));
    h.request([want(path, 0), want(path, 3)]);
    expect(h.loads.map((l) => l.path)).toEqual([path]);
    // A second owner wanting the same photo joins the same decode.
    h.cache.mount("second", () => {});
    h.cache.request("second", [want(path, 0)]);
    expect(h.loads).toHaveLength(1);
    const image = await h.finish(path);
    const bodies = h.latest?.bodies ?? [];
    expect(bodies[0].photo).toBe(image);
    expect(bodies[1].photo).toBe(image);
    expect(bodies[2].photo).toBeNull();
    expect(h.cache.drawn("second").get(path)?.image).toBe(image);
  });

  it("decodes in rank order (focused, then by priority) at most `concurrency` at once", async () => {
    const h = harness({ maxImages: 10, concurrency: 2 });
    const [a, b, c, d] = ["a", "b", "c", "d"].map(unique);
    h.request([
      want(a, 3),
      want(b, 1),
      want(c, 2),
      want(d, 9, { focused: true }),
    ]);
    expect(h.loads.map((l) => l.path)).toEqual([d, b]);
    await h.finish(d);
    expect(h.loads.map((l) => l.path)).toEqual([b, c]);
    await h.finish(b);
    expect(h.loads.map((l) => l.path)).toEqual([c, a]);
  });

  it("an arrival republishes the body specs with a new generation", async () => {
    const h = harness();
    const path = unique("arrive");
    h.publisher.setLooks(h.looks([path]));
    const before = h.publisher.generation();
    h.request([want(path, 0)]);
    expect(h.publisher.generation()).toBe(before);
    const image = await h.finish(path);
    expect(h.publisher.generation()).toBe(before + 1);
    expect(h.latest?.bodies[0].photo).toBe(image);
  });
});

describe("H3: images are disposed only through the ledger", () => {
  it("a photo the owner stops drawing is disposed only after every body layer acked, out of order", async () => {
    const h = harness({ maxImages: 4, reserveImages: 0 });
    const [a, b] = [unique("a"), unique("b")];
    h.publisher.setLooks(h.looks([a, b]));
    h.request([want(a, 0), want(b, 1)]);
    const imageA = (await h.finish(a)) as FakeImage;
    await h.finish(b);
    h.ack();
    // The body showing `a` leaves; its image retires, then waits for acks.
    h.publisher.setLooks(h.looks([b]));
    h.request([want(b, 0)]);
    h.cache.clearUnheld();
    expect(imageA.disposed).toBe(0);
    h.held.add("sun");
    h.ack();
    h.cache.clearUnheld();
    expect(imageA.disposed).toBe(0);
    expect(h.cache.stats().retired).toBe(1);
    h.held.clear();
    h.ack();
    // Now warm: kept for reuse until evicted or cleared.
    expect(imageA.disposed).toBe(0);
    expect(h.cache.stats()).toMatchObject({ warm: 1, retired: 0 });
    h.cache.clearUnheld();
    expect(imageA.disposed).toBe(1);
  });

  it("LRU: warm images are evicted least-recently-used first to admit a decode; pinned ones never", async () => {
    const h = harness({ maxImages: 3, reserveImages: 0 });
    const [a, b, c, d, e] = ["a", "b", "c", "d", "e"].map(unique);
    h.publisher.setLooks(h.looks([a, b, c, d, e]));
    h.request([want(a, 0), want(b, 1), want(c, 2)]);
    await h.drain();
    const [imageA, imageB, imageC] = [a, b, c].map(
      (p) => h.imageOf(p) as FakeImage,
    );
    // `c` stays wanted (pinned), `a` and `b` turn warm once acked.
    h.request([want(c, 0)]);
    h.ack();
    h.request([want(c, 0), want(d, 1)]);
    // The decode for `d` evicted the least recently used warm image first.
    expect(h.loads.map((l) => l.path)).toEqual([d]);
    expect([imageA.disposed, imageB.disposed, imageC.disposed]).toEqual([
      1, 0, 0,
    ]);
    await h.finish(d);
    h.request([want(c, 0), want(d, 1), want(e, 2)]);
    expect([imageA.disposed, imageB.disposed, imageC.disposed]).toEqual([
      1, 1, 0,
    ]);
    await h.finish(e);
    expect(h.drawnKeys()).toEqual([c, d, e].sort());
  });

  it("release and clearUnheld: nothing is disposed before the post-release confirm; a decode landing after release is disposed unpublished", async () => {
    const h = harness({ maxImages: 4 });
    const [a, b] = [unique("a"), unique("b")];
    h.publisher.setLooks(h.looks([a, b]));
    h.request([want(a, 0), want(b, 1)]);
    const imageA = (await h.finish(a)) as FakeImage;
    const published = h.publisher.generation();
    const epoch = h.cache.release(h.owner) as number;
    expect(h.loads[0].token.cancelled).toBe(true);
    h.cache.clearUnheld();
    expect(imageA.disposed).toBe(0);
    // The late decode: disposed at once, never published.
    const late = (await h.finish(b)) as FakeImage;
    expect(late.disposed).toBe(1);
    expect(h.publisher.generation()).toBe(published);
    // The H3 teardown (every layer is gone) hands the drawn image back.
    h.teardown();
    expect(imageA.disposed).toBe(1);
    expect(h.cache.confirmReleased(h.owner, epoch)).toBe(0);
    expect(h.cache.clearUnheld()).toBe(0);
    expect(h.cache.stats()).toMatchObject({ images: 0, inflight: 0 });
  });
});

describe("H4: hard caps — admission before decode", () => {
  it("a 1,000-body request with small caps: the bound holds at every step, refused keys never decode and their specs carry photo: null", async () => {
    const h = harness({
      maxImages: 6,
      maxBytes: 5 * MIB,
      reserveImages: 2,
      concurrency: 2,
    });
    const paths = Array.from({ length: 1000 }, (_, i) => unique(`many-${i}`));
    h.publisher.setLooks(h.looks(paths));
    h.request(paths.map((path, i) => want(path, i, { visible: i < 40 })));
    const decoded = new Set<string>();
    for (let step = 0; step < 100; step++) {
      for (const load of h.loads) decoded.add(load.path);
      if (h.loads.length > 0) await h.finish();
      else if (h.ack(1) === 0) break;
    }
    // Ordinary photos are admitted up to cap − reserve by images (4) and
    // bytes (5 MiB − 2 MiB reserve = 3 MiB): the 3 best-ranked.
    expect([...decoded].sort()).toEqual(paths.slice(0, 3).sort());
    expect(h.drawnKeys()).toEqual(paths.slice(0, 3).sort());
    const bodies = h.latest?.bodies ?? [];
    expect(bodies.slice(0, 3).every((body) => body.photo !== null)).toBe(true);
    expect(bodies.slice(3).every((body) => body.photo === null)).toBe(true);
    expect(h.cache.stats().refused).toBe(997);
  });

  it("real decoded sizes are counted: small photos admit more under the byte cap", async () => {
    const h = harness({
      maxImages: 20,
      maxBytes: 4 * MIB,
      reserveImages: 0,
      edge: 256,
    });
    const paths = Array.from({ length: 30 }, (_, i) => unique(`small-${i}`));
    h.publisher.setLooks(h.looks(paths));
    h.request(paths.map((path, i) => want(path, i)));
    await h.drain();
    // Each decode is admitted at the worst-case 1 MiB, but once decoded a
    // 256² photo counts its real 256 KiB, so more fit than 4.
    expect(h.drawnKeys().length).toBeGreaterThan(4);
    expect(h.cache.stats().bytes).toBeLessThanOrEqual(4 * MIB);
  });
});

describe("M5: photo invalidation through the real revision store", () => {
  it("a same-path replacement while mounted cancels the in-flight old-revision load, publishes the new image and retires the old one through the ledger", async () => {
    const h = harness({ maxImages: 6 });
    const path = unique("replace");
    h.publisher.setLooks(h.looks([path]));
    h.request([want(path, 0)]);
    const first = (await h.finish(path)) as FakeImage;
    h.ack();
    // Replaced: a new revision; the drawn image stays until the new one lands.
    bumpPhotoCacheBust(path);
    expect(h.loads).toHaveLength(1);
    expect(h.imageOf(path)).toBe(first);
    // Replaced again before that load lands: it is cancelled and superseded.
    const stale = h.loads[0];
    bumpPhotoCacheBust(path);
    expect(stale.token.cancelled).toBe(true);
    expect(h.loads.map((l) => l.path)).toEqual([path, path]);
    const newest = h.loads[1];
    h.loads.splice(1, 1);
    // The newest revision lands first…
    const replacement = {
      label: "newest",
      disposed: 0,
      width: () => 512,
      height: () => 512,
      dispose() {
        replacement.disposed++;
      },
    };
    newest.resolve(replacement as unknown as SkImage);
    await h.settle();
    expect(h.imageOf(path)).toBe(replacement);
    expect(h.latest?.bodies[0].photo).toBe(replacement);
    // …the superseded decode resolves late: disposed, never published.
    const late = (await h.finish(path)) as FakeImage;
    expect(late.disposed).toBe(1);
    expect(h.imageOf(path)).toBe(replacement);
    // The old image waits for every body layer, then goes (exactly once).
    expect(first.disposed).toBe(0);
    h.held.add("bodiesFront");
    h.ack();
    expect(first.disposed).toBe(0);
    h.held.clear();
    h.ack();
    expect(first.disposed).toBe(1);
    expect(replacement.disposed).toBe(0);
  });

  it("a deletion publishes null (the fallback) and retires the image", async () => {
    const h = harness({ maxImages: 6 });
    const path = unique("delete");
    h.publisher.setLooks(h.looks([path]));
    h.request([want(path, 0)]);
    const image = (await h.finish(path)) as FakeImage;
    h.ack();
    bumpPhotoCacheBust(path);
    await h.finish(path, "null");
    expect(h.drawnKeys()).toEqual([]);
    expect(h.latest?.bodies[0].photo).toBeNull();
    expect(image.disposed).toBe(0);
    h.ack();
    expect(image.disposed).toBe(1);
    // A failed revision is not retried until the next bump.
    h.request([want(path, 0)]);
    expect(h.loads).toHaveLength(0);
  });

  it("a bump for a path nobody uses does nothing", () => {
    const h = harness();
    const path = unique("other");
    h.request([want(path, 0)]);
    expect(h.loads).toHaveLength(1);
    bumpPhotoCacheBust(unique("unrelated"));
    expect(h.loads).toHaveLength(1);
    expect(h.loads[0].token.cancelled).toBe(false);
  });
});

describe("C-M1: progress at a saturated cap", () => {
  /** Fills both caps with drawn pins: 3 ordinary + 1 focused at 4 images / 4 MiB. */
  async function saturated(seed: number) {
    const h = harness({
      maxImages: 4,
      maxBytes: 4 * MIB,
      reserveImages: 1,
      seed,
    });
    const paths = ["v1", "v2", "v3", "f", "x", "y", "z"].map(unique);
    h.publisher.setLooks(h.looks(paths));
    const [v1, v2, v3, f] = paths;
    h.request([
      want(v1, 1),
      want(v2, 2),
      want(v3, 3, { visible: false }),
      want(f, 0, { focused: true }),
    ]);
    await h.drain();
    expect(h.drawnKeys()).toEqual([v1, v2, v3, f].sort());
    expect(h.cache.stats()).toMatchObject({ pinned: 4, images: 4 });
    expect(h.cache.stats().bytes).toBe(4 * MIB);
    return { h, paths };
  }

  /** Delivers loads and acks (one layer held back for a while) until settled. */
  async function converge(h: ReturnType<typeof harness>, layer = "sun") {
    h.held.add(layer);
    for (let i = 0; i < 6; i++) {
      if (h.loads.length > 0) await h.finish();
      h.ack(1);
    }
    h.held.clear();
    await h.drain();
  }

  it("the fallback generation drops off-screen photos before visible ones", async () => {
    const { h, paths } = await saturated(11);
    const [v1, v2, v3] = paths;
    const offscreen = h.imageOf(v3) as FakeImage;
    const visible = h.imageOf(v1) as FakeImage;
    // A replacement of v2 needs one more image than the full cap allows.
    bumpPhotoCacheBust(v2);
    // v3 (off-screen) is dropped to the fallback first; v1 keeps its photo.
    expect(h.drawnKeys()).toEqual([v1, v2, paths[3]].sort());
    expect(h.loads).toHaveLength(0);
    await converge(h);
    expect(offscreen.disposed).toBe(1);
    expect(visible.disposed).toBe(0);
    expect(h.imageOf(v2)?.label).toContain("#");
    expect(h.cache.stats().images).toBeLessThanOrEqual(4);
  });

  it("a same-path replacement eventually publishes, with out-of-order and late acks", async () => {
    const { h, paths } = await saturated(3);
    const v1 = paths[0];
    const old = h.imageOf(v1) as FakeImage;
    bumpPhotoCacheBust(v1);
    await converge(h, "bodiesBehind");
    const fresh = h.imageOf(v1) as FakeImage;
    expect(fresh).not.toBe(old);
    expect(old.disposed).toBe(1);
    expect(h.latest?.bodies[0].photo).toBe(fresh);
  });

  it("a deletion at the saturated cap eventually publishes null", async () => {
    const { h, paths } = await saturated(5);
    const v2 = paths[1];
    const old = h.imageOf(v2) as FakeImage;
    bumpPhotoCacheBust(v2);
    h.held.add("bodiesFront");
    for (let i = 0; i < 4; i++) h.ack(1);
    h.held.clear();
    // Acks (late ones included) free the room; the reload finds no file.
    for (let i = 0; i < 40 && !h.loads.some((l) => l.path === v2); i++)
      if (h.ack(1) === 0) break;
    await h.finish(v2, "null");
    await h.drain();
    expect(h.cache.drawn(h.owner).has(v2)).toBe(false);
    expect(h.latest?.bodies[1].photo).toBeNull();
    expect(old.disposed).toBe(1);
  });

  it("a focus change to a body whose photo is not loaded eventually publishes it", async () => {
    const { h, paths } = await saturated(9);
    const [v1, v2, v3, f, x] = paths;
    h.request([
      want(v1, 1),
      want(v2, 2),
      want(v3, 3, { visible: false }),
      want(f, 4),
      want(x, 0, { focused: true }),
    ]);
    await converge(h, "bodiesFront");
    expect(h.cache.drawn(h.owner).has(x)).toBe(true);
    expect(h.latest?.bodies[4].photo).not.toBeNull();
    // The lowest-ranked photo (the formerly focused f) made room.
    expect(h.cache.drawn(h.owner).has(f)).toBe(false);
    expect(h.cache.drawn(h.owner).has(v3)).toBe(true);
  });

  it("repeated tier/visibility churn: each new visible set eventually publishes, the bound held throughout", async () => {
    const { h, paths } = await saturated(13);
    const rounds: string[][] = [
      [paths[4], paths[5], paths[6]],
      [paths[0], paths[5], paths[2]],
      [paths[6], paths[1], paths[4]],
      [paths[3], paths[4], paths[5]],
    ];
    for (const visible of rounds) {
      h.request(
        paths.map((path) => {
          const rank = visible.indexOf(path);
          return want(path, rank >= 0 ? rank : 10 + paths.indexOf(path), {
            visible: rank >= 0,
          });
        }),
      );
      await converge(h, "sun");
      for (const path of visible)
        expect(h.cache.drawn(h.owner).has(path)).toBe(true);
    }
  });

  it("a queued request superseded before capacity frees is discarded without a decode", async () => {
    const { h, paths } = await saturated(17);
    const [v1, v2, v3, f, x] = paths;
    // x outranks everything visible: v3 is dropped, x waits for the acks.
    h.request([
      want(x, 0),
      want(v1, 1),
      want(v2, 2),
      want(v3, 3, { visible: false }),
      want(f, 0, { focused: true }),
    ]);
    expect(h.loads).toHaveLength(0);
    // Superseded before capacity frees: x is no longer wanted.
    h.request([
      want(v1, 1),
      want(v2, 2),
      want(v3, 3, { visible: false }),
      want(f, 0, { focused: true }),
    ]);
    await h.drain();
    expect(h.created.some((image) => image.label.startsWith(x))).toBe(false);
    expect(h.drawnKeys()).toEqual([v1, v2, v3, f].sort());
  });
});
