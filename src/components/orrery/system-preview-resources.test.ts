/**
 * 38.7-14 (D-57, C-H2): the System Preview's native objects follow Plan 07's
 * `<resource_lifetime_contract>` with the Preview's own ledger epoch and
 * layer ids. Node proof with the REAL ledger, spec publisher, photo cache,
 * text service and sky-bake owner; only the native boundaries are fakes
 * (decoded photos, Paragraphs and baked sky images are plain objects whose
 * dispose is logged and guarded against double disposal).
 */
import type { SkImage } from "@shopify/react-native-skia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  disposed: [] as string[],
  paragraphs: 0,
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
            const label = `text:${text}#${++fake.paragraphs}`;
            let disposed = false;
            return {
              text,
              label,
              layout: () => {},
              getLongestLine: () => 20,
              getHeight: () => 20,
              dispose: () => {
                if (disposed) throw new Error(`${label} disposed twice`);
                disposed = true;
                fake.disposed.push(label);
              },
            };
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
vi.mock("react-native-reanimated", () => ({
  cancelAnimation: vi.fn(),
  ReduceMotion: { Never: "never" },
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
  useAnimatedReaction: vi.fn(),
  useSharedValue: (value: unknown) => ({ value }),
  withTiming: (value: unknown) => value,
}));

import {
  getPhotoCacheBust,
  subscribePhotoCacheBust,
} from "@/stores/photo-cache-bust-store";
import {
  createOrreryGenerationLedger,
  type OrreryGenerationLedger,
} from "./resources/orrery-generation-ledger";
import {
  createOrreryPhotoCache,
  type OrreryPhotoCache,
} from "./resources/orrery-photo-cache";
import {
  createOrreryTextService,
  type OrreryTextScene,
} from "./resources/orrery-text-service";
import { PREVIEW_LAYER } from "./system-preview-logic";
import { createPreviewResources } from "./system-preview-resources";
import type { SkyBakeInput } from "./v2/nebula-bake";
import type {
  OrreryBodyLook,
  OrreryBodySpecs,
  SkyImageSpec,
} from "./v2/scene-specs";

const INK = [0.5, 0.5, 0.5, 1] as const;
let pathSerial = 0;
const unique = (name: string) => `avatars/preview-${name}-${++pathSerial}.jpg`;

function look(key: string, photoKey: string | null): OrreryBodyLook {
  return {
    key,
    kind: "contact",
    worldRadius: 16,
    outlineInk: INK,
    swatchInk: INK,
    photoKey,
    initialsFontSize: 16,
    moonInk: INK,
  };
}

function textScene(
  names: readonly { key: string; text: string; hasPhoto?: boolean }[],
): OrreryTextScene {
  return {
    labels: [],
    initials: names.map(({ key, text, hasPhoto }) => ({
      key,
      text,
      fontSize: 16,
      maxWidth: 28,
      hasPhoto: hasPhoto ?? false,
    })),
    labelWidth: 400,
    fontScale: 1,
    fontProvider: {} as never,
    labelInk: "ink",
    captionInk: "ink",
    initialsInk: "ink",
  };
}

const visibleAll = (keys: readonly string[]) => ({
  visible: null,
  eligible: keys.map((key) => ({ key, radius: 12 })),
});

interface Load {
  path: string;
  resolve: (image: SkImage | null) => void;
}

/** One Preview mount over a shared cache, with its acks delivered by the test. */
function harness(shared?: { photos: OrreryPhotoCache; loads: Load[] }) {
  const loads = shared?.loads ?? [];
  const photos =
    shared?.photos ??
    createOrreryPhotoCache({
      maxImages: 8,
      maxBytes: 8 * 512 * 512 * 4,
      reserveImages: 2,
      concurrency: 4,
      deps: {
        load: (path) =>
          new Promise<SkImage | null>((resolve) => {
            loads.push({ path, resolve });
          }),
        revision: (path) => getPhotoCacheBust(path),
        subscribe: subscribePhotoCacheBust,
      },
    });
  const textService = createOrreryTextService();
  const ledger: OrreryGenerationLedger<string> =
    createOrreryGenerationLedger<string>();
  const published: string[] = [];
  const publish = ledger.publish.bind(ledger);
  ledger.publish = (generation, layers, objects) => {
    const set = [...objects];
    for (const handle of set)
      if (!published.includes(handle)) published.push(handle);
    return publish(generation, layers, set);
  };
  let bodies: OrreryBodySpecs | null = null;
  let sky: SkyImageSpec | null = null;
  const scheduled: (() => void)[] = [];
  const preview = createPreviewResources({
    owner: `system-preview:test-${++pathSerial}`,
    photoCache: photos,
    textService,
    ledger,
    writeBodies: (specs) => {
      bodies = specs;
    },
    writeSky: (spec) => {
      sky = spec;
    },
    bake: (input) => image(`sky:${input.key}`) as unknown as SkImage,
    schedule: (run) => {
      scheduled.push(run);
      return () => {};
    },
    log: null,
  });
  return {
    preview,
    photos,
    loads,
    ledger,
    published,
    textService,
    bodies: () => bodies as OrreryBodySpecs | null,
    sky: () => sky as SkyImageSpec | null,
    runScheduled: () => {
      for (const run of scheduled.splice(0)) run();
    },
    /** The bodies layer recorded the latest body generation. */
    ackBodies: () => {
      const b = bodies as OrreryBodySpecs | null;
      if (b) preview.ack(PREVIEW_LAYER.bodies, b.generation, b.mountEpoch);
    },
    ackSky: () => {
      const s = sky as SkyImageSpec | null;
      if (s) preview.ack(PREVIEW_LAYER.sky, s.generation, s.mountEpoch);
    },
  };
}

function image(label: string) {
  let disposed = false;
  return {
    label,
    width: () => 512,
    height: () => 512,
    dispose: () => {
      if (disposed) throw new Error(`${label} disposed twice`);
      disposed = true;
      fake.disposed.push(label);
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const skyInput = (key: string): SkyBakeInput => ({
  key,
  size: 768,
  period: 8,
  seed: 0,
});

beforeEach(() => {
  fake.disposed = [];
});

describe("38.7-14 (C-H2): the Preview's own ledger epoch and layer ids", () => {
  it("publishes the body specs to preview-bodies and the sky image to preview-sky, never to the Orrery's layers", async () => {
    const h = harness();
    const path = unique("ada");
    h.preview.setLooks([look("contact:1", path), look("contact:2", null)]);
    h.preview.setText(
      textScene([
        { key: "contact:1", text: "AL", hasPhoto: true },
        { key: "contact:2", text: "BO" },
      ]),
      visibleAll(["contact:1", "contact:2"]),
    );
    h.preview.requestSky(skyInput("galaxy/dark/a"));
    h.runScheduled();
    h.loads[0].resolve(image("photo:ada") as unknown as SkImage);
    await settle();
    const bodies = h.bodies();
    expect(bodies?.mountEpoch).toBe(h.preview.epoch());
    expect(bodies?.bodies.find((b) => b.key === "contact:1")?.photo).toEqual(
      expect.objectContaining({ label: "photo:ada" }),
    );
    expect(
      bodies?.bodies.find((b) => b.key === "contact:2")?.initials?.text,
    ).toBe("BO");
    expect(h.sky()?.mountEpoch).toBe(h.preview.epoch());
    // Only the Preview's layers can acknowledge: the Orrery's ids are unknown here.
    h.preview.ack("bodiesFront", bodies?.generation ?? 0, h.preview.epoch()!);
    expect(h.ledger.stats().acked).toEqual({});
    h.ackBodies();
    h.ackSky();
    expect(Object.keys(h.ledger.stats().acked).sort()).toEqual([
      PREVIEW_LAYER.bodies,
      PREVIEW_LAYER.sky,
    ]);
  });

  it("delayed ack: a replaced photo, Paragraph and sky image stay until the layer that recorded them acks a newer generation", async () => {
    const h = harness();
    const first = unique("first");
    const second = unique("second");
    h.preview.setLooks([look("contact:1", first)]);
    h.preview.setText(
      textScene([{ key: "contact:2", text: "OL" }]),
      visibleAll(["contact:2"]),
    );
    h.preview.requestSky(skyInput("standard/light/a"));
    h.runScheduled();
    h.loads[0].resolve(image("photo:first") as unknown as SkImage);
    await settle();
    h.ackBodies();
    h.ackSky();
    // Membership edit / theme change: a new photo, new initials, a new sky.
    h.preview.setLooks([look("contact:1", second)]);
    h.preview.setText(
      textScene([{ key: "contact:2", text: "NU" }]),
      visibleAll(["contact:2"]),
    );
    h.preview.requestSky(skyInput("standard/light/b"));
    h.runScheduled();
    h.loads[1].resolve(image("photo:second") as unknown as SkImage);
    await settle();
    // The layers have not recorded the new generations yet (held back).
    expect(fake.disposed).toEqual([]);
    expect(h.photos.stats().retired).toBe(1);
    h.ackSky();
    expect(fake.disposed).toEqual(["sky:standard/light/a"]);
    expect(h.photos.stats().retired).toBe(1);
    h.ackBodies();
    // The old photo is no longer awaited (warm, reusable); the old Paragraph
    // is unpinned too. Nothing was disposed early, nothing twice.
    expect(h.photos.stats().retired).toBe(0);
    expect(h.textService.clearUnheld()).toBe(1);
    expect(fake.disposed.filter((l) => l.startsWith("text:OL"))).toHaveLength(
      1,
    );
  });

  it("unmount: nothing is disposed at release; after the round trip everything goes back in reverse creation order and the epoch ends", async () => {
    const h = harness();
    const path = unique("cy");
    h.preview.requestSky(skyInput("galaxy/light/a"));
    h.runScheduled();
    h.preview.setLooks([look("contact:1", path)]);
    h.preview.setText(
      textScene([{ key: "contact:2", text: "DE" }]),
      visibleAll(["contact:2"]),
    );
    h.loads[0].resolve(image("photo:cy") as unknown as SkImage);
    await settle();
    h.ackBodies();
    h.ackSky();
    const epoch = h.preview.epoch();
    expect(epoch).not.toBeNull();
    const finish = h.preview.release();
    expect(h.preview.epoch()).toBeNull();
    expect(fake.disposed).toEqual([]);
    // A late ack from the detached pictures is stale.
    h.ackBodies();
    finish();
    expect(fake.disposed).toHaveLength(3);
    // The ledger handed them back newest first: the sky image was published
    // first, so it is disposed last.
    expect(fake.disposed.at(-1)).toBe("sky:galaxy/light/a");
    expect(h.published[0]).toMatch(/^s/);
    expect(h.ledger.stats().epochs).toBe(0);
    expect(h.photos.stats().images).toBe(0);
    // Calling finish again (or releasing twice) is harmless.
    finish();
    h.preview.release()();
    expect(fake.disposed).toHaveLength(3);
  });

  it("a decode or a sky bake that completes after unmount is disposed (or never runs) and never published", async () => {
    const h = harness();
    const path = unique("late");
    h.preview.setLooks([look("contact:1", path)]);
    h.preview.requestSky(skyInput("galaxy/dark/late"));
    const before = h.bodies();
    const finish = h.preview.release();
    finish();
    h.runScheduled();
    h.loads[0].resolve(image("photo:late") as unknown as SkImage);
    await settle();
    expect(fake.disposed).toEqual(["photo:late"]);
    expect(h.bodies()).toBe(before);
    expect(h.sky()).toBeNull();
    expect(h.photos.stats().images).toBe(0);
  });

  it("isolation: the Preview's teardown never disposes a photo the Orrery world pins", async () => {
    const world = harness();
    const shared = { photos: world.photos, loads: world.loads };
    const path = unique("shared");
    // The world (another owner on the same cache) draws the photo.
    const worldOwner = "orrery-world:isolation";
    world.photos.mount(worldOwner, () => {});
    world.photos.request(worldOwner, [
      { key: path, relativePath: path, priority: 0 },
    ]);
    const preview = harness(shared);
    preview.preview.setLooks([look("contact:1", path)]);
    expect(world.loads).toHaveLength(1); // one decode, shared by both owners
    world.loads[0].resolve(image("photo:shared") as unknown as SkImage);
    await settle();
    preview.ackBodies();
    preview.preview.release()();
    expect(fake.disposed).toEqual([]);
    expect(world.photos.drawn(worldOwner).get(path)?.image).toEqual(
      expect.objectContaining({ label: "photo:shared" }),
    );
  });

  it("remount: a new Preview mount starts its own epoch; the old mount's late acks change nothing", async () => {
    const old = harness();
    old.preview.setLooks([look("contact:1", null)]);
    const stale = old.bodies();
    old.preview.release()();
    const next = harness({ photos: old.photos, loads: old.loads });
    next.preview.setLooks([look("contact:1", null)]);
    expect(next.preview.epoch()).not.toBeNull();
    // The old pictures' ack arrives late, on the old controller: stale.
    if (stale)
      old.preview.ack(PREVIEW_LAYER.bodies, stale.generation, stale.mountEpoch);
    expect(old.ledger.stats().acked).toEqual({});
    expect(next.ledger.stats().acked).toEqual({});
  });
});
