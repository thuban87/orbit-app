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

export interface SkyBakeOwnerOptions {
  /** The H3 ledger (shared with the body/label/base layers). */
  ledger: OrreryGenerationLedger<string>;
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
  const bake = options.bake ?? bakeSkyImage;
  const schedule = options.schedule ?? defaultSchedule;
  const now = options.now ?? defaultNow;
  const log = options.log === undefined ? devLog : options.log;
  const images = new Map<number, SkImage>();
  let nextId = 0;
  let generation = 0;
  let liveKey: string | null = null;
  let pendingKey: string | null = null;
  let cancelPending: (() => void) | null = null;
  let detached = false;
  let bakes = 0;

  function dispose(image: SkImage): void {
    try {
      image.dispose?.();
    } catch {
      // Already released by the runtime.
    }
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
        const id = ++nextId;
        generation++;
        if (
          !ledger.publish(
            generation,
            [ORRERY_LAYER.sky],
            [skyHandle(epoch, id)],
          )
        ) {
          dispose(image);
          return;
        }
        images.set(id, image);
        liveKey = input.key;
        write({ generation, mountEpoch: epoch, image, key: input.key });
      });
    },
    retire(ids) {
      for (const id of ids) {
        const image = images.get(id);
        if (!image) continue;
        images.delete(id);
        dispose(image);
      }
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
