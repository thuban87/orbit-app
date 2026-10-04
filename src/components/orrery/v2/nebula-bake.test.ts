/**
 * 38.7-09 (H9, C-H2): the neutral sky bake — its key has no hue, one image
 * per (package, mode, size bucket), no bake on a System change — and the
 * baked image's lifetime under Plan 07's generation ledger (delayed ack,
 * replacement, unmount teardown, late and stale results).
 */
import { Skia } from "@shopify/react-native-skia";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({
  AlphaType: { Premul: 2 },
  ColorType: { RGBA_8888: 4 },
  Skia: {},
}));

import { SKY_UNTINTED, systemSkyHueIndex } from "@/logic/orrery-sky-logic";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { createOrreryGenerationLedger } from "../resources/orrery-generation-ledger";
import {
  bakeSkyImage,
  createSkyBakeOwner,
  type SkyBakeInput,
  skyBakeKey,
  skyBakeUniforms,
  skySizeBucket,
} from "./nebula-bake";
import {
  ORRERY_LAYER,
  parseLedgerHandle,
  type SkyImageSpec,
} from "./scene-specs";
import { resetOrreryShaderCache } from "./shaders";
import {
  SKY_MARGIN_DP,
  SKY_NEBULA_PERIOD,
  SKY_NEBULA_TEX,
  SKY_SIZE_BUCKET_DP,
} from "./visual-tunables";

function input(
  key: string,
  overrides: Partial<SkyBakeInput> = {},
): SkyBakeInput {
  return {
    key,
    size: SKY_NEBULA_TEX,
    period: SKY_NEBULA_PERIOD,
    seed: 0,
    ...overrides,
  };
}

describe("bake keys and sizes", () => {
  it("the key is (package, mode, size bucket) — no System hue component (H9)", () => {
    const bucket = skySizeBucket(412, 800);
    const key = skyBakeKey("galaxy", "dark", bucket);
    expect(key).toBe(`galaxy/dark/${bucket.width}x${bucket.height}`);
    // Two Systems with different hues: their keys are identical by
    // construction (skyBakeKey takes no System or hue at all).
    const hues = THEME_PRESETS.galaxy.dark.orrerySystemHues.length;
    const a = systemSkyHueIndex("custom:alpha", hues);
    const b = systemSkyHueIndex("category:beta", hues);
    expect(a).not.toBe(b);
    expect(skyBakeKey("galaxy", "dark", skySizeBucket(412, 800))).toBe(key);
    expect(skyBakeKey("standard", "dark", bucket)).not.toBe(key);
    expect(skyBakeKey("galaxy", "light", bucket)).not.toBe(key);
  });

  it("the bucket covers the canvas plus both margins, in bucket steps", () => {
    const bucket = skySizeBucket(412, 800);
    expect(bucket.width % SKY_SIZE_BUCKET_DP).toBe(0);
    expect(bucket.height % SKY_SIZE_BUCKET_DP).toBe(0);
    expect(bucket.width).toBeGreaterThanOrEqual(412 + 2 * SKY_MARGIN_DP);
    expect(bucket.height).toBeGreaterThanOrEqual(800 + 2 * SKY_MARGIN_DP);
    // Nearby sizes share a bucket (no re-bake for a few dp of layout change).
    expect(skySizeBucket(410, 798)).toEqual(bucket);
  });
});

describe("bakeSkyImage (one-shot GPU density bake)", () => {
  const skia = Skia as unknown as Record<string, unknown>;
  afterEach(() => {
    for (const k of ["RuntimeEffect", "Surface", "Paint"]) delete skia[k];
    resetOrreryShaderCache();
  });

  it("returns the raster copy and releases the snapshot and the surface", () => {
    const log: string[] = [];
    const raster = { name: "raster" };
    skia.RuntimeEffect = {
      Make: () => ({
        makeShader: (u: number[]) => {
          log.push(`uniforms ${u.join(",")}`);
          return {};
        },
      }),
    };
    skia.Paint = () => ({ setShader: () => {} });
    skia.Surface = {
      MakeOffscreen: (w: number, h: number) => {
        log.push(`surface ${w}x${h}`);
        return {
          getCanvas: () => ({ drawPaint: () => log.push("draw") }),
          flush: () => log.push("flush"),
          makeImageSnapshot: () => ({
            makeNonTextureImage: () => raster,
            dispose: () => log.push("snapshot disposed"),
          }),
          dispose: () => log.push("surface disposed"),
        };
      },
    };
    expect(bakeSkyImage(input("k", { seed: 5 }))).toBe(raster);
    expect(log).toEqual([
      `surface ${SKY_NEBULA_TEX}x${SKY_NEBULA_TEX}`,
      `uniforms ${skyBakeUniforms(input("k", { seed: 5 })).join(",")}`,
      "draw",
      "flush",
      "snapshot disposed",
      "surface disposed",
    ]);
  });

  it("no runtime (no effect or no offscreen surface) → null, nothing thrown", () => {
    expect(bakeSkyImage(input("k"))).toBeNull();
    skia.RuntimeEffect = { Make: () => ({ makeShader: () => ({}) }) };
    expect(bakeSkyImage(input("k"))).toBeNull();
    skia.Surface = { MakeOffscreen: () => null };
    expect(bakeSkyImage(input("k"))).toBeNull();
  });

  it("the seed is an integer lattice offset (the tile stays periodic)", () => {
    const u = skyBakeUniforms(input("k", { seed: 2.4 }));
    expect(u).toEqual([SKY_NEBULA_TEX, SKY_NEBULA_PERIOD, 2, 6]);
  });
});

interface FakeImage {
  id: string;
  disposed: boolean;
  dispose(): void;
}

function harness(options: { asyncBake?: boolean } = {}) {
  const ledger = createOrreryGenerationLedger<string>();
  let epoch: number | null = null;
  const ensureEpoch = () => {
    if (epoch === null) epoch = ledger.beginEpoch();
    return epoch;
  };
  const writes: SkyImageSpec[] = [];
  const baked: FakeImage[] = [];
  const queue: (() => void)[] = [];
  const bake = vi.fn((input: SkyBakeInput) => {
    const image: FakeImage = {
      id: input.key,
      disposed: false,
      dispose() {
        if (this.disposed) throw new Error(`double dispose ${this.id}`);
        this.disposed = true;
      },
    };
    baked.push(image);
    return image as never;
  });
  const logs: string[] = [];
  let clock = 0;
  const owner = createSkyBakeOwner({
    ledger,
    ensureEpoch,
    write: (spec) => writes.push(spec),
    bake,
    schedule: (run) => {
      if (!options.asyncBake) {
        run();
        return () => {};
      }
      let cancelled = false;
      queue.push(() => {
        if (!cancelled) run();
      });
      return () => {
        cancelled = true;
      };
    },
    now: () => (clock += 12),
    log: (line) => logs.push(line),
  });
  /** The sky picture recorded the latest written generation (one frame later). */
  const ack = () => {
    const last = writes.at(-1);
    if (!last) return;
    ledger.ack(ORRERY_LAYER.sky, last.generation, last.mountEpoch);
    owner.retire(
      ledger
        .retirable()
        .map((h) => parseLedgerHandle(h))
        .filter((h) => h?.kind === "sky")
        .map((h) => (h as { id: number }).id),
    );
  };
  const runQueued = () => {
    for (const run of queue.splice(0)) run();
  };
  return {
    ledger,
    owner,
    bake,
    baked,
    writes,
    logs,
    ack,
    runQueued,
    epoch: () => epoch,
    endEpoch: () => {
      epoch = null;
    },
  };
}

describe("createSkyBakeOwner (H9)", () => {
  it("bakes once per key; a System change (same key) never bakes; the bake logs its duration", () => {
    const h = harness();
    const key = skyBakeKey("galaxy", "dark", skySizeBucket(412, 800));
    h.owner.request(input(key));
    expect(h.bake).toHaveBeenCalledTimes(1);
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0]).toMatchObject({ generation: 1, key });
    expect(h.logs).toEqual([`orrery-sky-bake ms=12 bucket=${key}`]);
    // Ten System switches: the sky spec's hue changes, the bake key does not.
    for (let i = 0; i < 10; i++) h.owner.request(input(key));
    expect(h.bake).toHaveBeenCalledTimes(1);
    expect(h.owner.stats()).toEqual({ bakes: 1, live: 1, key });
  });

  it("two Systems with different hues share ONE baked image", () => {
    const h = harness();
    const colors = THEME_PRESETS.standard.dark;
    const bucket = skySizeBucket(412, 800);
    for (const system of ["custom:a", "custom:b", "builtin:all-contacts"]) {
      const hue = systemSkyHueIndex(system, colors.orrerySystemHues.length);
      expect(hue === SKY_UNTINTED || hue >= 0).toBe(true);
      h.owner.request(input(skyBakeKey("standard", "dark", bucket)));
    }
    expect(h.bake).toHaveBeenCalledTimes(1);
    expect(h.owner.stats().live).toBe(1);
  });
});

describe("the sky image under the generation ledger (C-H2)", () => {
  it("delayed ack: the replaced image is NOT disposed until the sky layer acked the newer generation", () => {
    const h = harness();
    h.owner.request(input("galaxy/dark/512x896"));
    h.ack();
    const first = h.baked[0];
    // Theme change → a new key → a new bake, published as generation 2.
    h.owner.request(input("standard/dark/512x896"));
    expect(h.writes.at(-1)?.generation).toBe(2);
    // The sky layer has not recorded generation 2 yet: nothing retires.
    h.owner.retire(
      h.ledger
        .retirable()
        .map((x) => parseLedgerHandle(x))
        .map((x) => (x as { id: number }).id),
    );
    expect(first.disposed).toBe(false);
    // An ack for the OLD generation retires nothing either.
    h.ledger.ack(ORRERY_LAYER.sky, 1, h.epoch() as number);
    expect(h.ledger.retirable()).toEqual([]);
    expect(first.disposed).toBe(false);
    // The newer generation is recorded: now the old image goes, exactly once.
    h.ack();
    expect(first.disposed).toBe(true);
    expect(h.baked[1].disposed).toBe(false);
  });

  it("replacement on theme changes leaves exactly one live image per bucket", () => {
    const h = harness();
    for (const key of [
      "galaxy/dark/512x896",
      "galaxy/light/512x896",
      "standard/light/512x896",
      "standard/dark/512x896",
    ]) {
      h.owner.request(input(key));
      h.ack();
    }
    expect(h.bake).toHaveBeenCalledTimes(4);
    expect(h.owner.stats().live).toBe(1);
    expect(h.baked.filter((i) => !i.disposed).map((i) => i.id)).toEqual([
      "standard/dark/512x896",
    ]);
  });

  it("unmount: a pending bake never runs; teardown hands the live image back in reverse creation order", () => {
    const h = harness({ asyncBake: true });
    h.owner.request(input("galaxy/dark/512x896"));
    h.runQueued();
    h.ack();
    h.owner.request(input("galaxy/light/512x896")); // pending at unmount
    // Unmount (OrreryWorld's cleanup order): detach, then — after the clock
    // stopped and a UI round trip — the ledger teardown.
    h.owner.detach();
    h.runQueued();
    expect(h.bake).toHaveBeenCalledTimes(1);
    const order: string[] = [];
    h.ledger.teardown((handle) => {
      const parsed = parseLedgerHandle(handle);
      if (parsed?.kind === "sky") {
        order.push(handle);
        h.owner.retire([parsed.id]);
      }
    }, h.epoch() as number);
    expect(order).toHaveLength(1);
    expect(h.baked[0].disposed).toBe(true);
    expect(h.owner.stats().live).toBe(0);
  });

  it("a bake that finishes after unmount is disposed and never published", () => {
    const h = harness();
    // The bake itself spans the unmount (detach runs while it bakes).
    h.bake.mockImplementationOnce((i: SkyBakeInput) => {
      h.owner.detach();
      const image = {
        id: i.key,
        disposed: false,
        dispose() {
          this.disposed = true;
        },
      };
      h.baked.push(image);
      return image as never;
    });
    h.owner.request(input("galaxy/dark/512x896"));
    expect(h.baked[0].disposed).toBe(true);
    expect(h.writes).toHaveLength(0);
    expect(h.ledger.stats().tracked).toBe(0);
  });

  it("a bake whose epoch went stale (remount) is disposed and never published", () => {
    const h = harness({ asyncBake: true });
    h.owner.request(input("galaxy/dark/512x896"));
    // A remount began a newer epoch before the deferred bake ran.
    h.ledger.beginEpoch();
    h.runQueued();
    expect(h.baked[0].disposed).toBe(true);
    expect(h.writes).toHaveLength(0);
  });

  it("returning to the live key before a pending bake ran cancels it", () => {
    const h = harness({ asyncBake: true });
    h.owner.request(input("galaxy/dark/512x896"));
    h.runQueued();
    h.owner.request(input("galaxy/light/512x896"));
    h.owner.request(input("galaxy/dark/512x896"));
    h.runQueued();
    expect(h.bake).toHaveBeenCalledTimes(1);
    expect(h.writes).toHaveLength(1);
  });
});
