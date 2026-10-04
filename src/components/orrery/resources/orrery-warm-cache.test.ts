/**
 * The Orrery warm cache (38.7-15, D-58/H3/H4/M5/M15/C-M1) — node proof that
 * reusable resources survive an ordinary tab blur inside hard caps and are
 * released on background, idle and memory, driven the way OrreryWorld drives
 * the shared caches: the real generation ledger, photo cache, text service
 * and sky warm store; a world publishes photo + text handles to two layers,
 * acks arrive per layer, and the unmount follows the contract's order (pins
 * retire → one round trip → hand-off to the warm owner → ledger teardown).
 * Every native object is a fake whose `dispose()` throws if a mounted world's
 * layer may still re-record a generation that references it.
 */
import type { SkImage } from "@shopify/react-native-skia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({
  check: null as null | ((object: object) => void),
  builds: 0,
}));
vi.mock("@shopify/react-native-skia", () => ({
  TextAlign: { Center: 2 },
  Skia: {
    Color: (color: string) => color,
    ParagraphBuilder: {
      Make: () => {
        let text = "";
        const builder = {
          reset: () => {
            text = "";
          },
          pushStyle: () => builder,
          addText: (value: string) => {
            text += value;
            return builder;
          },
          pop: () => builder,
          build: () => {
            guard.builds++;
            const paragraph = {
              text,
              disposed: 0,
              layout: () => {},
              getLongestLine: () => 50,
              getHeight: () => 20,
              dispose: () => {
                paragraph.disposed++;
                if (paragraph.disposed > 1)
                  throw new Error(`paragraph ${text} disposed twice`);
                guard.check?.(paragraph);
              },
            };
            return paragraph;
          },
        };
        return builder;
      },
    },
  },
}));
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
import { createSkyBakeOwner, createSkyWarmStore } from "../v2/nebula-bake";
import {
  parseLedgerHandle,
  photoHandle,
  type SkyImageSpec,
  textHandle,
} from "../v2/scene-specs";
import {
  createOrreryGenerationLedger,
  type OrreryGenerationLedger,
} from "./orrery-generation-ledger";
import {
  createOrreryPhotoCache,
  ORRERY_PHOTO_ESTIMATE_BYTES,
  type OrreryImageBacking,
} from "./orrery-photo-cache";
import {
  createOrreryTextService,
  type OrreryTextRequest,
} from "./orrery-text-service";
import {
  createOrreryWarmCache,
  DEFAULT_ORRERY_WARM_LIMITS,
  ORRERY_WARM_IDLE_TIMEOUT_MS,
  ORRERY_WARM_MAX_BYTES,
  ORRERY_WARM_MAX_PARAGRAPHS,
  ORRERY_WARM_MAX_SKY_IMAGES,
  type OrreryWarmAppState,
  type OrreryWarmCache,
  type OrreryWarmLimits,
} from "./orrery-warm-cache";

const MIB = ORRERY_PHOTO_ESTIMATE_BYTES;
const LAYERS = ["bodies", "labels"] as const;
const PROVIDER = {} as never;
let pathSerial = 0;
/** Unique paths per test: the revision store is process-wide. */
const unique = (name: string) => `avatars/warm-${name}-${++pathSerial}.jpg`;

interface FakeImage {
  label: string;
  disposed: number;
  backing: OrreryImageBacking;
  width(): number;
  height(): number;
  dispose(): void;
}
interface Load {
  path: string;
  token: { cancelled: boolean };
  resolve: (image: SkImage | null) => void;
}

/** One environment: the shared caches, the warm owner and its timers. */
function environment(
  options: {
    maxImages?: number;
    maxBytes?: number;
    reserveImages?: number;
    maxEntries?: number;
    priorityReserve?: number;
    limits?: Partial<OrreryWarmLimits>;
  } = {},
) {
  const loads: Load[] = [];
  const images: FakeImage[] = [];
  const timers = new Map<number, () => void>();
  let timerSerial = 0;
  let nextBacking: OrreryImageBacking = "cpu";
  const maxImages = options.maxImages ?? 120;
  const maxBytes = options.maxBytes ?? 96 * MIB;
  const photos = createOrreryPhotoCache({
    maxImages,
    maxBytes,
    reserveImages: options.reserveImages ?? 4,
    concurrency: 1000,
    deps: {
      load: (path, token) =>
        new Promise<SkImage | null>((resolve) => {
          loads.push({ path, token, resolve });
        }),
      revision: (path) => getPhotoCacheBust(path),
      subscribe: subscribePhotoCacheBust,
      backing: (image) => (image as unknown as FakeImage).backing,
    },
  });
  const text = createOrreryTextService({
    maxEntries: options.maxEntries ?? 400,
    priorityReserve: options.priorityReserve ?? 32,
  });
  const sky = createSkyWarmStore();
  const warm = createOrreryWarmCache({
    photos,
    text,
    sky,
    setTimeout: (run) => {
      const id = ++timerSerial;
      timers.set(id, run);
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id as number);
    },
    limits: options.limits,
  });
  const image = (label: string): FakeImage => {
    const fake: FakeImage = {
      label,
      disposed: 0,
      backing: nextBacking,
      width: () => 512,
      height: () => 512,
      dispose() {
        fake.disposed++;
        if (fake.disposed > 1) throw new Error(`${label} disposed twice`);
        guard.check?.(fake);
      },
    };
    images.push(fake);
    return fake;
  };
  /** Resolves every pending load (or those for `path`) with a fresh image / null. */
  async function resolveLoads(
    filter?: (path: string) => boolean,
    result: "image" | "null" = "image",
  ): Promise<number> {
    let done = 0;
    for (let round = 0; round < 50; round++) {
      const ready = loads.filter((load) => !filter || filter(load.path));
      if (ready.length === 0) break;
      for (const load of ready) {
        loads.splice(loads.indexOf(load), 1);
        load.resolve(
          result === "null" ? null : (image(load.path) as unknown as SkImage),
        );
        done++;
      }
      for (let i = 0; i < 4; i++) await Promise.resolve();
    }
    return done;
  }
  return {
    photos,
    text,
    sky,
    warm,
    loads,
    images,
    timers,
    maxImages,
    maxBytes,
    setBacking: (backing: OrreryImageBacking) => {
      nextBacking = backing;
    },
    resolveLoads,
    fireTimers: () => {
      const due = [...timers.values()];
      timers.clear();
      for (const run of due) run();
    },
  };
}
type Env = ReturnType<typeof environment>;

/** Mounted worlds whose layers may still re-record (the use-after-free guard). */
const recorders = new Set<{
  ledger: OrreryGenerationLedger<string>;
  history: Map<number, Set<object>>;
  acked: Map<string, number>;
}>();

let worldSerial = 0;
function labelRequest(label: string, ink = "#ffffff"): OrreryTextRequest {
  return {
    text: label,
    role: "label",
    fontScale: 1,
    maxWidth: 200,
    ink,
    family: "Inter",
    weight: 600,
    fontProvider: PROVIDER,
  };
}

/**
 * One OrreryWorld-shaped consumer: mounts its photo and text owners, publishes
 * the FULL handle set per generation to both layers, and acks per layer.
 */
function mountWorld(env: Env) {
  const owner = `orrery-world:${++worldSerial}`;
  const ledger = createOrreryGenerationLedger<string>();
  const epoch = ledger.beginEpoch();
  const history = new Map<number, Set<object>>();
  const acked = new Map<string, number>();
  const recorder = { ledger, history, acked };
  recorders.add(recorder);
  let generation = 0;
  let textKeys: string[] = [];
  let ink = "#ffffff";
  const photoEpoch = env.photos.mount(owner, () => publish());
  const textEpoch = env.text.mount(owner);
  env.warm.resumeOnFocus();
  function publish(): void {
    generation++;
    const drawn = env.photos.drawn(owner);
    const objects = new Set<object>();
    const handles: string[] = [];
    for (const photo of drawn.values()) {
      handles.push(photoHandle(photoEpoch, photo.id));
      objects.add(photo.image as unknown as object);
    }
    for (const key of textKeys) {
      handles.push(textHandle(textEpoch, key));
      const prepared = env.text.peek(key);
      if (prepared) objects.add(prepared.paragraph as unknown as object);
    }
    env.text.acquire(owner, textKeys, generation, textEpoch);
    ledger.publish(generation, LAYERS, handles);
    history.set(generation, objects);
  }
  function route(handles: Iterable<string>, dispose: boolean): void {
    for (const handle of handles) {
      const parsed = parseLedgerHandle(handle);
      if (parsed?.kind === "photo")
        env.photos.confirmRetired(owner, [parsed.id], parsed.epoch, {
          dispose,
        });
      else if (parsed?.kind === "text") {
        env.text.confirmRetired(owner, [parsed.key], parsed.epoch, {
          dispose,
        });
        env.text.trim();
      }
    }
  }
  return {
    owner,
    ledger,
    epoch,
    generation: () => generation,
    drawn: () => env.photos.drawn(owner),
    /** The canvas detached (no layer can record any more). */
    stopRecording: () => {
      recorders.delete(recorder);
    },
    setInk(next: string) {
      ink = next;
    },
    show(paths: readonly string[], labels: readonly string[]) {
      const keys: string[] = [];
      for (const label of labels) {
        const request = labelRequest(label, ink);
        if (env.text.prepare(request, { protect: new Set(keys) }))
          keys.push(env.text.keyOf(request) as string);
      }
      textKeys = keys;
      env.photos.request(
        owner,
        paths.map((path, index) => ({
          key: path,
          relativePath: path,
          priority: index,
          visible: true,
        })),
      );
      publish();
    },
    /** Delivers acks for the newest generation, `layers` in the given order. */
    ack(layers: readonly string[] = LAYERS) {
      for (const layer of layers) {
        if (ledger.ack(layer, generation, epoch))
          acked.set(layer, Math.max(acked.get(layer) ?? 0, generation));
        route(ledger.retirable(), false);
      }
    },
    /** A late, stale ack (any epoch): what the UI may still deliver. */
    staleAck(layer: string, gen: number, ackEpoch: number) {
      return ledger.ack(layer, gen, ackEpoch);
    },
    /**
     * OrreryWorld's unmount: pins retire now; the returned `finish` is the
     * step after the clock stopped, the pictures detached and one UI round
     * trip — the hand-off to the warm owner, then the ledger teardown.
     */
    unmount(skies: Parameters<OrreryWarmCache["retainOnBlur"]>[0]["skies"]) {
      const releasedText = env.text.release(owner);
      const releasedPhotos = env.photos.release(owner);
      return () => {
        recorders.delete(recorder);
        const result = env.warm.retainOnBlur({
          photos:
            releasedPhotos === null ? null : { owner, epoch: releasedPhotos },
          text: { owner, epoch: releasedText },
          skies,
        });
        ledger.teardown((handle) => route([handle], true), epoch);
        return result;
      };
    },
  };
}

/** Throws if a disposed object may still be re-recorded by a mounted world. */
function installGuard(): void {
  guard.check = (object) => {
    for (const { ledger, history, acked } of recorders) {
      if (ledger.epoch() === null) continue;
      for (const [generation, set] of history) {
        if (!set.has(object)) continue;
        for (const layer of LAYERS)
          if (!((acked.get(layer) ?? 0) > generation))
            throw new Error(
              `disposed while ${layer} may still record generation ${generation}`,
            );
      }
    }
  };
}

const alive = (env: Env) =>
  env.images.filter((image) => image.disposed === 0).length;

function expectWithinWarmCaps(env: Env, limits = DEFAULT_ORRERY_WARM_LIMITS) {
  const stats = env.warm.stats();
  expect(stats.paragraphs).toBeLessThanOrEqual(limits.maxParagraphs);
  expect(stats.skies).toBeLessThanOrEqual(limits.maxSkyImages);
  expect(stats.bytes).toBeLessThanOrEqual(limits.maxBytes);
  // Physical truth: every image still alive is a warm one while blurred.
  expect(alive(env) * MIB).toBeLessThanOrEqual(limits.maxBytes);
}

beforeEach(() => {
  recorders.clear();
  guard.builds = 0;
  installGuard();
});

describe("blur → return reuses (D-58)", () => {
  it("a warm return decodes, shapes and bakes nothing new for the same scene", async () => {
    const env = environment();
    const paths = [unique("a"), unique("b"), unique("c")];
    const labels = ["Ada", "Ben", "Cy"];
    const world = mountWorld(env);
    world.show(paths, labels);
    await env.resolveLoads();
    world.ack();
    expect(world.drawn().size).toBe(3);
    const decodes = env.photos.stats().decodes;
    const builds = guard.builds;
    expect(world.unmount([])()).toBe("retained");
    expect(env.warm.stats()).toMatchObject({
      state: "warm",
      photos: 3,
      paragraphs: 3,
      idleTimer: true,
    });
    // The return: same scene, nothing to load, shape or bake.
    const back = mountWorld(env);
    expect(env.warm.stats().idleTimer).toBe(false);
    back.show(paths, labels);
    expect(env.loads).toHaveLength(0);
    expect(env.photos.stats().decodes).toBe(decodes);
    expect(guard.builds).toBe(builds);
    expect(back.drawn().size).toBe(3);
    expect(alive(env)).toBe(3);
  });

  it("the baked sky is handed to the warm store and adopted on return (no bake)", () => {
    const env = environment();
    const baked = {
      width: () => 768,
      height: () => 768,
      dispose: vi.fn(),
    } as unknown as SkImage;
    const bake = vi.fn(() => baked);
    const runs: (() => void)[] = [];
    const key = "galaxy/light/600x1000";
    const make = () => {
      const ledger = createOrreryGenerationLedger<string>();
      let epoch: number | null = null;
      const writes: SkyImageSpec[] = [];
      const owner = createSkyBakeOwner({
        ledger,
        ensureEpoch: () => {
          epoch ??= ledger.beginEpoch();
          return epoch;
        },
        write: (spec) => writes.push(spec),
        bake,
        schedule: (run) => {
          runs.push(run);
          return () => {};
        },
        log: null,
        warm: env.sky,
      });
      return { owner, writes };
    };
    const first = make();
    first.owner.request({ key, size: 768, period: 6, seed: 0 });
    for (const run of runs.splice(0)) run();
    expect(bake).toHaveBeenCalledTimes(1);
    first.owner.detach();
    env.warm.retainOnBlur({ skies: first.owner.handOff() });
    expect(env.sky.size()).toBe(1);
    // The ledger teardown routes the old handle back: the owner no longer has it.
    first.owner.retire([1]);
    expect(
      (baked as unknown as { dispose: () => void }).dispose,
    ).not.toHaveBeenCalled();
    const second = make();
    second.owner.request({ key, size: 768, period: 6, seed: 0 });
    // Adopted synchronously, in the requesting effect: painted from frame one.
    expect(runs).toHaveLength(0);
    expect(bake).toHaveBeenCalledTimes(1);
    expect(second.writes).toHaveLength(1);
    expect(second.writes[0].image).toBe(baked);
    expect(env.sky.size()).toBe(0);
  });
});

describe("hard caps, LRU and disposal (H4)", () => {
  it("an All-Contacts-scale world blurred and returned 10 times never holds more than any warm cap", async () => {
    const env = environment();
    const paths = Array.from({ length: 1000 }, (_, i) => unique(`all-${i}`));
    const labels = Array.from({ length: 1000 }, (_, i) => `Person ${i}`);
    for (let round = 0; round < 10; round++) {
      const world = mountWorld(env);
      world.show(paths, labels);
      await env.resolveLoads();
      world.ack();
      // The live caches never exceed their own hard caps.
      expect(env.photos.stats().images).toBeLessThanOrEqual(env.maxImages);
      const skies = Array.from({ length: 6 }, (_, i) => ({
        key: `galaxy/dark/${round}-${i}`,
        image: {
          width: () => 768,
          height: () => 768,
          dispose: vi.fn(),
        } as unknown as SkImage,
        backing: "cpu" as const,
      }));
      expect(world.unmount(skies)()).toBe("retained");
      expectWithinWarmCaps(env);
      expect(env.warm.stats().paragraphs).toBe(ORRERY_WARM_MAX_PARAGRAPHS);
      expect(env.warm.stats().skies).toBe(ORRERY_WARM_MAX_SKY_IMAGES);
    }
    expect(env.warm.stats().bytes).toBeLessThanOrEqual(ORRERY_WARM_MAX_BYTES);
  });

  it("20 switches with blurs in between leave the warm set at or below its caps", async () => {
    const limits = { maxBytes: 6 * MIB, maxParagraphs: 5 };
    const env = environment({ limits });
    let world = mountWorld(env);
    for (let step = 0; step < 20; step++) {
      const set = Array.from({ length: 8 }, (_, i) =>
        unique(`sw-${step}-${i}`),
      );
      world.show(
        set,
        set.map((_, i) => `S${step}-${i}`),
      );
      await env.resolveLoads();
      world.ack();
      if (step % 3 === 2) {
        world.unmount([])();
        expectWithinWarmCaps(env, { ...DEFAULT_ORRERY_WARM_LIMITS, ...limits });
        world = mountWorld(env);
      }
    }
  });

  it("trims least-recently-used first and disposes what does not fit", async () => {
    const env = environment({
      limits: { maxBytes: 2 * MIB, paragraphBytes: 0 },
    });
    const paths = [unique("old"), unique("mid"), unique("new")];
    const world = mountWorld(env);
    world.show([paths[0]], []);
    await env.resolveLoads();
    world.show([paths[0], paths[1]], []);
    await env.resolveLoads();
    world.show(paths, []);
    await env.resolveLoads();
    // Touch the newer two again (LRU order: old < mid < new).
    world.show([paths[1], paths[2]], []);
    world.ack();
    world.unmount([])();
    const kept = env.images.filter((image) => image.disposed === 0);
    expect(kept.map((image) => image.label).sort()).toEqual(
      [paths[1], paths[2]].sort(),
    );
  });
});

describe("pins, retirements and other owners are never touched", () => {
  it("retain, trim and release never dispose an object another owner pins or still awaits", async () => {
    const env = environment({ limits: { maxBytes: 0, maxParagraphs: 0 } });
    const shared = unique("shared");
    const world = mountWorld(env);
    world.show([shared], ["Shared"]);
    await env.resolveLoads();
    world.ack();
    // The System Preview pins the same photo and Paragraph.
    const preview = mountWorld(env);
    preview.show([shared], ["Shared"]);
    preview.ack();
    world.unmount([])();
    env.warm.release("background");
    const image = env.images.find((fake) => fake.label === shared);
    expect(image?.disposed).toBe(0);
    expect(preview.drawn().get(shared)?.image).toBe(image);
    expect(env.text.stats().pinned).toBe(1);
  });
});

describe("release: background, idle and memory", () => {
  async function warmEnv() {
    const env = environment();
    const world = mountWorld(env);
    world.show([unique("r1"), unique("r2")], ["R1", "R2"]);
    await env.resolveLoads();
    world.ack();
    world.unmount([
      {
        key: "standard/light/a",
        image: {
          width: () => 768,
          height: () => 768,
          dispose: vi.fn(),
        } as unknown as SkImage,
        backing: "cpu",
      },
    ])();
    expect(env.warm.stats()).toMatchObject({
      photos: 2,
      paragraphs: 2,
      skies: 1,
    });
    return env;
  }
  const empty = { photos: 0, paragraphs: 0, skies: 0, bytes: 0, state: "cold" };

  it("the idle timeout releases everything; a return before it cancels the timer", async () => {
    const env = await warmEnv();
    expect(env.timers.size).toBe(1);
    env.warm.resumeOnFocus();
    expect(env.timers.size).toBe(0);
    expect(env.warm.stats().photos).toBe(2);
    env.warm.retainOnBlur({});
    env.fireTimers();
    expect(env.warm.stats()).toMatchObject(empty);
    expect(env.warm.stats().releases.idle).toBe(1);
    expect(alive(env)).toBe(0);
    expect(ORRERY_WARM_IDLE_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });

  it("app background releases everything (AppState change), and so does a memory warning", async () => {
    const listeners = new Map<string, (state?: string) => void>();
    const appState: OrreryWarmAppState = {
      currentState: "active",
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
        return { remove: () => listeners.delete(type) };
      },
    };
    const env = await warmEnv();
    const detach = env.warm.attach(appState);
    listeners.get("change")?.("background");
    expect(env.warm.stats()).toMatchObject(empty);
    expect(alive(env)).toBe(0);
    expect(env.timers.size).toBe(0);
    listeners.get("change")?.("active");
    const again = await warmEnv();
    again.warm.attach(appState);
    listeners.get("memoryWarning")?.();
    expect(again.warm.stats()).toMatchObject(empty);
    expect(again.warm.stats().releases.memory).toBe(1);
    detach();
  });

  it("background wins in either order: before the unmount's hand-off nothing is retained", async () => {
    const env = environment();
    const world = mountWorld(env);
    world.show([unique("bg")], ["Bg"]);
    await env.resolveLoads();
    world.ack();
    const finish = world.unmount([]);
    env.warm.noteAppState("background"); // AppState first …
    expect(finish()).toBe("released"); // … then the round trip's hand-off
    expect(alive(env)).toBe(0);
    expect(env.text.stats().warm).toBe(0);
  });

  it("background wins in either order: after the hand-off everything is released", async () => {
    const env = environment();
    const world = mountWorld(env);
    world.show([unique("bg2")], ["Bg2"]);
    await env.resolveLoads();
    world.ack();
    expect(world.unmount([])()).toBe("retained");
    env.warm.noteAppState("background");
    expect(alive(env)).toBe(0);
    expect(env.text.stats().warm).toBe(0);
  });
});

describe("the ledger contract around a blur (H3)", () => {
  it("acks arriving after retainOnBlur change nothing; a remount reuses while old-epoch acks still arrive", async () => {
    const env = environment();
    const a = unique("h3a");
    const b = unique("h3b");
    const world = mountWorld(env);
    world.show([a], ["A"]);
    await env.resolveLoads();
    world.ack();
    world.show([b], ["B"]); // a replacement: A retires, awaiting both layers
    await env.resolveLoads();
    world.ack(["labels"]); // out of order: bodies has not acked yet
    const oldEpoch = world.epoch;
    const generation = world.generation();
    world.unmount([])();
    const before = env.warm.stats();
    // The held-back bodies ack lands after the hand-off: stale, discarded.
    expect(world.staleAck("bodies", generation, oldEpoch)).toBe(false);
    expect(env.warm.stats()).toEqual(before);
    const back = mountWorld(env);
    back.show([b], ["B"]);
    expect(env.loads).toHaveLength(0);
    expect(world.staleAck("labels", generation, oldEpoch)).toBe(false);
    expect(back.drawn().size).toBe(1);
  });

  it("a photo decode completing after the unmount is disposed, never retained", async () => {
    const env = environment();
    const path = unique("late");
    const world = mountWorld(env);
    world.show([path], []);
    expect(env.loads).toHaveLength(1);
    world.unmount([])();
    await env.resolveLoads();
    expect(env.images).toHaveLength(1);
    expect(env.images[0].disposed).toBe(1);
    expect(env.warm.stats().photos).toBe(0);
  });
});

describe("only CPU-backed images are retained (M15)", () => {
  it("a texture-backed photo and a texture-backed sky are disposed at the hand-off", async () => {
    const env = environment();
    env.setBacking("texture");
    const world = mountWorld(env);
    world.show([unique("gpu")], []);
    await env.resolveLoads();
    world.ack();
    const skyDispose = vi.fn();
    world.unmount([
      {
        key: "galaxy/dark/x",
        image: { dispose: skyDispose } as unknown as SkImage,
        backing: "texture",
      },
    ])();
    expect(alive(env)).toBe(0);
    expect(skyDispose).toHaveBeenCalledTimes(1);
    expect(env.warm.stats()).toMatchObject({ photos: 0, skies: 0 });
  });
});

describe("a photo changed while warm (M5)", () => {
  it("a same-path replacement drops the warm entry at once; the return loads the current revision", async () => {
    const env = environment();
    const path = unique("m5");
    const world = mountWorld(env);
    world.show([path], []);
    await env.resolveLoads();
    world.ack();
    world.unmount([])();
    expect(env.warm.stats().photos).toBe(1);
    bumpPhotoCacheBust(path);
    expect(env.warm.stats().photos).toBe(0);
    expect(env.images[0].disposed).toBe(1);
    const back = mountWorld(env);
    back.show([path], []);
    expect(env.loads).toHaveLength(1);
    await env.resolveLoads();
    expect(back.drawn().get(path)?.image).toBe(env.images[1]);
  });

  it("a deletion while warm drops the entry; the return draws the fallback", async () => {
    const env = environment();
    const path = unique("m5-del");
    const world = mountWorld(env);
    world.show([path], []);
    await env.resolveLoads();
    world.ack();
    world.unmount([])();
    bumpPhotoCacheBust(path);
    const back = mountWorld(env);
    back.show([path], []);
    await env.resolveLoads(undefined, "null");
    expect(back.drawn().has(path)).toBe(false);
    expect(alive(env)).toBe(0);
  });
});

describe("full caps still make progress (C-M1)", () => {
  it("a return needing keys that are not warm evicts warm entries before any refusal", async () => {
    const env = environment({
      maxImages: 6,
      reserveImages: 1,
      maxEntries: 8,
      priorityReserve: 1,
      limits: { maxBytes: 64 * MIB, maxParagraphs: 8 },
    });
    const first = Array.from({ length: 5 }, (_, i) => unique(`f${i}`));
    const world = mountWorld(env);
    world.show(first, ["a", "b", "c", "d", "e", "f", "g"]);
    await env.resolveLoads();
    world.ack();
    world.unmount([])();
    expect(env.warm.stats().photos).toBe(5);
    const next = Array.from({ length: 5 }, (_, i) => unique(`n${i}`));
    const back = mountWorld(env);
    back.setInk("#000000"); // a theme change: every text key differs
    back.show(next, ["a", "b", "c", "d", "e", "f", "g"]);
    await env.resolveLoads();
    back.ack();
    expect(back.drawn().size).toBe(5);
    expect(env.text.stats().refused).toBe(0);
    expect(env.text.stats().pinned).toBe(7);
    expect(env.photos.stats().images).toBeLessThanOrEqual(6);
  });

  it("with the returned world's pins saturating the photo cap, a replacement still publishes", async () => {
    const env = environment({ maxImages: 4, reserveImages: 1 });
    const paths = Array.from({ length: 3 }, (_, i) => unique(`sat${i}`));
    const world = mountWorld(env);
    world.show(paths, []);
    await env.resolveLoads();
    world.ack();
    world.unmount([])();
    const back = mountWorld(env);
    back.show(paths, []);
    back.ack();
    expect(env.loads).toHaveLength(0);
    bumpPhotoCacheBust(paths[1]);
    for (let round = 0; round < 6; round++) {
      await env.resolveLoads();
      back.show(paths, []);
      back.ack(["labels", "bodies"]);
      expect(env.photos.stats().images).toBeLessThanOrEqual(4);
    }
    const drawn = back.drawn().get(paths[1])?.image as unknown as FakeImage;
    expect(drawn.disposed).toBe(0);
    expect(env.images.filter((image) => image.label === paths[1])).toHaveLength(
      2,
    );
    expect(drawn).toBe(env.images[env.images.length - 1]);
  });
});

describe("the warm-owner mark protects against other owners' teardown only", () => {
  it("another owner drawing a warm entry and tearing down with dispose leaves it warm; clearUnheld still frees it", async () => {
    const env = environment();
    const path = unique("mark");
    const world = mountWorld(env);
    world.show([path], ["Mark"]);
    await env.resolveLoads();
    world.ack();
    world.unmount([])();
    // Another owner (the System Preview's shape) draws the same entries, then
    // tears down disposing what it held.
    const other = mountWorld(env);
    other.show([path], ["Mark"]);
    other.ack();
    const finishOther = (() => {
      const text = env.text.release(other.owner);
      const photos = env.photos.release(other.owner) as number;
      return () => {
        other.stopRecording();
        env.photos.confirmReleased(other.owner, photos, { dispose: true });
        env.text.confirmReleased(other.owner, text, { dispose: true });
      };
    })();
    finishOther();
    expect(alive(env)).toBe(1);
    expect(env.text.stats().warm).toBe(1);
    env.warm.release("memory");
    expect(alive(env)).toBe(0);
    expect(env.text.stats().warm).toBe(0);
  });
});
