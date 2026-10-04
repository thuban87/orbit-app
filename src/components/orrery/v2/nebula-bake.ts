/**
 * 38.7-09 (D-07/D-08, H9, C-H2; reworked 2026-10-03 to Lab B's nebula): the
 * painted sky's nebula DENSITY texture, baked once per (package, mode, size
 * bucket), and its lifetime under Plan 07's generation ledger.
 *
 * WHAT (Lab B `LabEnvironment` / `labb-effects` nebulaBake, ported): a square,
 * seamlessly tiling texture whose channels are DENSITIES, not colours —
 * r = lobe A, g = lobe B, b = dust lanes — from domain-warped periodic fbm.
 * The sky shader (shaders.ts SKY_NEBULA_SKSL, draw-sky.ts) samples it once
 * per pixel and colours it from theme tokens, so the clouds read as a distant
 * nebula behind the far stars, not a haze over the scene.
 *
 * HOW: the bake shader runs ONCE on an offscreen GPU surface (JS thread), and
 * the result is copied to a raster image so the UI thread can draw it. The
 * noise is evaluated once per bake in `float` on small coordinates — never
 * live per frame (DEAD-ENDS: live mediump fbm faceted on Mali; Lab B's
 * one-shot bake is the approved pattern). No offscreen surface or no effect →
 * no image: the sky draws its plain gradient and stars.
 *
 * NEUTRAL (H9): the texture holds no colour at all, so the cache key has no
 * hue component. The per-System tint is applied at DRAW time (draw-sky.ts:
 * the System hue leans lobe B's ink), so a System change, and Plan 13's
 * switch crossfade, edit a SharedValue only and never bake. The bake runs on
 * canvas mount and on a theme or size-bucket change only, deferred off the
 * effect (no blocking wait: the sky draws its plain gradient until it lands).
 *
 * WARM (38.7-15, D-58): the bake is a CPU raster image (`makeNonTextureImage`),
 * so it may outlive the canvas. On a tab blur the Orrery world hands its live
 * images (`handOff`) to the warm cache's sky store (`orrerySkyWarmStore`,
 * bounded by ORRERY_WARM_MAX_SKY_IMAGES, cleared on background / idle /
 * memory); a later `request` for the same key adopts the stored image at once
 * instead of baking, so the returning sky paints its nebula from the first
 * frame. Adoption publishes the image as a new `sky` generation of the new
 * epoch — the ledger contract is unchanged.
 *
 * LIFETIME (Plan 07's `<resource_lifetime_contract>`, consumed, not
 * redefined): each baked image is an object of the `sky` layer's generation,
 * handle `skyHandle(mountEpoch, id)`; the sky picture acks `(sky, generation,
 * mountEpoch)` like every other layer; a replaced image (theme or size change)
 * is disposed only once the ledger reports it retirable (the sky layer acked a
 * newer generation in the same epoch); a bake whose result carries a stale
 * epoch is disposed at once and never published; on unmount the images go at
 * the contract's teardown step (OrreryWorld routes them back through
 * `retire`), never directly from an unmount effect.
 */
import { type SkImage, Skia, type SkSurface } from "@shopify/react-native-skia";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";
import type { OrreryGenerationLedger } from "../resources/orrery-generation-ledger";
import { ORRERY_LAYER, type SkyImageSpec, skyHandle } from "./scene-specs";
import { orreryShader } from "./shaders";
import { SKY_MARGIN_DP, SKY_SIZE_BUCKET_DP } from "./visual-tunables";

// ── Keys and sizes (pure) ─────────────────────────────────────────────────

/**
 * The per-package lattice offset of the baked nebula (stable across visits;
 * Galaxy 0 = Lab B's sky). Shared by the Orrery and the System Preview.
 */
export const SKY_NEBULA_SEED = { galaxy: 0, standard: 5 } as const;

/** The sky's covered area in dp: the canvas plus margins, bucketed up. */
export interface SkyBucket {
  width: number;
  height: number;
}

/** The size bucket a canvas falls into (≥ the canvas + 2 × margin). */
export function skySizeBucket(widthDp: number, heightDp: number): SkyBucket {
  const step = SKY_SIZE_BUCKET_DP;
  const w = Math.max(1, widthDp) + 2 * SKY_MARGIN_DP;
  const h = Math.max(1, heightDp) + 2 * SKY_MARGIN_DP;
  return {
    width: Math.ceil(w / step) * step,
    height: Math.ceil(h / step) * step,
  };
}

/** The bake cache key: package, mode and size bucket — NO System hue (H9). */
export function skyBakeKey(
  themePackage: ThemePackage,
  mode: ResolvedMode,
  bucket: SkyBucket,
): string {
  return `${themePackage}/${mode}/${bucket.width}x${bucket.height}`;
}

// ── The density bake ──────────────────────────────────────────────────────

export interface SkyBakeInput {
  /** `skyBakeKey(...)` of this bake (logged; equal keys never re-bake). */
  key: string;
  /** Texture side in texels (square, seamlessly tiling: SKY_NEBULA_TEX). */
  size: number;
  /** Noise lattice period across the texture (SKY_NEBULA_PERIOD). */
  period: number;
  /** Integer lattice offset per package (the sky is the same every visit). */
  seed: number;
}

/** The bake shader's uniforms: (size, period, seed x, seed y). */
export function skyBakeUniforms(input: SkyBakeInput): number[] {
  const seed = Math.round(input.seed);
  return [input.size, input.period, seed, seed * 3];
}

/**
 * The baked density image for an input (GPU, one shot), copied to a raster
 * image; null when the runtime cannot make one (no effect, no offscreen
 * surface, or the copy failed). Everything it allocates besides the result
 * is released before it returns.
 */
export function bakeSkyImage(input: SkyBakeInput): SkImage | null {
  let surface: SkSurface | null = null;
  let snapshot: SkImage | null = null;
  try {
    const effect = orreryShader("skyNebulaBake");
    const make = Skia?.Surface?.MakeOffscreen;
    if (!effect || typeof make !== "function" || !(input.size > 0)) return null;
    surface = make(input.size, input.size);
    if (!surface) return null;
    const paint = Skia.Paint();
    paint.setShader(effect.makeShader(skyBakeUniforms(input)));
    surface.getCanvas().drawPaint(paint);
    surface.flush();
    snapshot = surface.makeImageSnapshot();
    return snapshot.makeNonTextureImage() ?? null;
  } catch {
    return null;
  } finally {
    try {
      snapshot?.dispose?.();
      surface?.dispose?.();
    } catch {
      // Already released by the runtime.
    }
  }
}

// ── JS owner: one neutral image per key, through the ledger ───────────────

/** How a sky image's pixels are held (M15: only "cpu" may be kept warm). */
export type SkyImageBacking = "cpu" | "texture" | "unknown";

/** One sky image handed to (or adopted from) the warm store. */
export interface SkyWarmImage {
  key: string;
  image: SkImage;
  backing: SkyImageBacking;
}

/**
 * 38.7-15 (D-58): the warm owner's sky images, by bake key (LRU by insertion).
 * Holds keys and images only — never a picture, never a pin: nothing records
 * an image while it sits here, so eviction disposes it at once.
 */
export interface SkyWarmStore {
  /** Keeps `image` for `key` (CPU-backed only; anything else is disposed). */
  put(entry: SkyWarmImage): boolean;
  /** Takes the image for `key` out of the store (the caller owns it), or null. */
  take(key: string): SkImage | null;
  has(key: string): boolean;
  /** Disposes the least recently stored images beyond `maxImages`. */
  trim(maxImages: number): number;
  /** Disposes every stored image. */
  clear(): number;
  size(): number;
  /** Decoded bytes held (width × height × 4 each). */
  bytes(): number;
}

function disposeSkyImage(image: SkImage): void {
  try {
    image.dispose?.();
  } catch {
    // Already released by the runtime.
  }
}

function skyImageBytes(image: SkImage): number {
  try {
    const bytes = image.width() * image.height() * 4;
    return Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  } catch {
    return 0;
  }
}

export function createSkyWarmStore(): SkyWarmStore {
  const stored = new Map<string, SkImage>();
  return {
    put({ key, image, backing }) {
      if (backing !== "cpu") {
        disposeSkyImage(image);
        return false;
      }
      const previous = stored.get(key);
      if (previous && previous !== image) disposeSkyImage(previous);
      stored.delete(key);
      stored.set(key, image);
      return true;
    },
    take(key) {
      const image = stored.get(key) ?? null;
      stored.delete(key);
      return image;
    },
    has: (key) => stored.has(key),
    trim(maxImages) {
      let disposed = 0;
      for (const [key, image] of [...stored]) {
        if (stored.size <= Math.max(0, maxImages)) break;
        stored.delete(key);
        disposeSkyImage(image);
        disposed++;
      }
      return disposed;
    },
    clear() {
      const all = [...stored.values()];
      stored.clear();
      for (const image of all) disposeSkyImage(image);
      return all.length;
    },
    size: () => stored.size,
    bytes() {
      let total = 0;
      for (const image of stored.values()) total += skyImageBytes(image);
      return total;
    },
  };
}

/** The app-wide warm sky store (the Orrery world hands off to it; Plan 15). */
export const orrerySkyWarmStore = createSkyWarmStore();

export interface SkyBakeOwnerOptions {
  /** The H3 ledger (shared with the body/label/base layers). */
  ledger: OrreryGenerationLedger<string>;
  /**
   * 38.7-14 (C-H2): the layer that draws the image (default the Orrery's
   * `sky`; the System Preview passes its own id).
   */
  layerId?: string;
  /** The current ledger epoch, begun if none is (the spec publisher's). */
  ensureEpoch: () => number;
  /** Writes the sky image SharedValue (never React state). */
  write: (spec: SkyImageSpec) => void;
  /** The bake itself (a seam for tests). */
  bake?: (input: SkyBakeInput) => SkImage | null;
  /** Defers a bake off the calling effect; returns a cancel. */
  schedule?: (run: () => void) => () => void;
  /** A millisecond clock for the bake duration. */
  now?: () => number;
  /** Development log line per bake (`orrery-sky-bake ms=<n> bucket=<key>`). */
  log?: ((line: string) => void) | null;
  /**
   * 38.7-15 (D-58): the warm store a request adopts a same-key image from
   * (the Orrery world; the System Preview passes none and always bakes).
   */
  warm?: SkyWarmStore | null;
  /** How a baked image is backed (default "cpu": `bakeSkyImage` copies to raster). */
  backing?: SkyImageBacking;
}

export interface SkyBakeOwner {
  /**
   * Canvas mount, theme or size-bucket change: bake `input` unless an image
   * for the same key is live or already pending. A System change must NOT
   * call this with a new key (the key has no hue).
   */
  request(input: SkyBakeInput): void;
  /** The ledger retired these image ids (or teardown handed them back). */
  retire(ids: readonly number[]): void;
  /** Unmount: cancels a pending bake; a later result is disposed, unpublished. */
  detach(): void;
  /**
   * 38.7-15: after the teardown round trip, hands every live image to the
   * caller (the warm cache) and forgets it; `retire` then no longer sees it.
   */
  handOff(): SkyWarmImage[];
  stats(): { bakes: number; live: number; key: string | null };
}

const defaultSchedule = (run: () => void): (() => void) => {
  const handle = setTimeout(run, 0);
  return () => clearTimeout(handle);
};

const defaultNow = (): number => {
  const perf = (globalThis as { performance?: { now?: () => number } })
    .performance;
  return typeof perf?.now === "function" ? perf.now() : Date.now();
};

const devLog =
  typeof __DEV__ !== "undefined" && __DEV__
    ? (line: string) => {
        console.log(line);
      }
    : null;

export function createSkyBakeOwner(options: SkyBakeOwnerOptions): SkyBakeOwner {
  const { ledger, ensureEpoch, write } = options;
  const layerId = options.layerId ?? ORRERY_LAYER.sky;
  const bake = options.bake ?? bakeSkyImage;
  const schedule = options.schedule ?? defaultSchedule;
  const now = options.now ?? defaultNow;
  const log = options.log === undefined ? devLog : options.log;
  const warm = options.warm ?? null;
  const backing = options.backing ?? "cpu";
  const images = new Map<number, { image: SkImage; key: string }>();
  let nextId = 0;
  let generation = 0;
  let liveKey: string | null = null;
  let pendingKey: string | null = null;
  let cancelPending: (() => void) | null = null;
  let detached = false;
  let bakes = 0;

  const dispose = disposeSkyImage;

  /** Publishes `image` for `key` as the sky layer's next generation. */
  function publish(epoch: number, key: string, image: SkImage): boolean {
    const id = ++nextId;
    generation++;
    if (!ledger.publish(generation, [layerId], [skyHandle(epoch, id)]))
      return false;
    images.set(id, { image, key });
    liveKey = key;
    write({ generation, mountEpoch: epoch, image, key });
    return true;
  }

  return {
    request(input) {
      if (detached) return;
      if (input.key === pendingKey) return;
      if (input.key === liveKey) {
        // Back to the live key before a pending bake ran: keep what is drawn.
        cancelPending?.();
        cancelPending = null;
        pendingKey = null;
        return;
      }
      cancelPending?.();
      cancelPending = null;
      pendingKey = null;
      // 38.7-15 (D-58): a warm image for this key is adopted at once — no
      // bake, and the sky paints its nebula from the first recorded frame.
      const adopted = warm?.take(input.key) ?? null;
      if (adopted) {
        if (!publish(ensureEpoch(), input.key, adopted))
          warm?.put({ key: input.key, image: adopted, backing: "cpu" });
        return;
      }
      pendingKey = input.key;
      const epoch = ensureEpoch();
      cancelPending = schedule(() => {
        cancelPending = null;
        if (detached || pendingKey !== input.key) return;
        bakes++;
        const started = now();
        const image = bake(input);
        const ms = Math.round(now() - started);
        log?.(`orrery-sky-bake ms=${ms} bucket=${input.key}`);
        pendingKey = null;
        if (!image) {
          // No image runtime: the gradient stays; do not retry this key.
          liveKey = input.key;
          return;
        }
        if (detached) {
          dispose(image);
          return;
        }
        if (!ledger.admitResult(epoch, image, dispose)) return;
        if (!publish(epoch, input.key, image)) dispose(image);
      });
    },
    retire(ids) {
      for (const id of ids) {
        const entry = images.get(id);
        if (!entry) continue;
        images.delete(id);
        dispose(entry.image);
      }
    },
    handOff() {
      const out: SkyWarmImage[] = [];
      for (const entry of images.values())
        out.push({ key: entry.key, image: entry.image, backing });
      images.clear();
      return out;
    },
    detach() {
      detached = true;
      cancelPending?.();
      cancelPending = null;
      pendingKey = null;
    },
    stats: () => ({ bakes, live: images.size, key: liveKey }),
  };
}
