/**
 * 38.7-09 (D-07/D-08, H9, C-H2): the painted sky's NEUTRAL nebula, CPU-baked
 * once per (package, mode, size bucket) into a small SkImage, and its
 * lifetime under Plan 07's generation ledger.
 *
 * WHY THE CPU: GPU fbm/hash noise in mediump renders faceted shards on the
 * Pixel's Mali GPU (DEAD-ENDS; Lab A pass 1). Doing the noise in JS doubles is
 * precision-proof on every GPU, and the nebula is soft enough that a small
 * texture, bilinearly upscaled, is indistinguishable from a full-res render.
 *
 * NEUTRAL (H9): the bake uses only the theme's `orreryNebula` tints — never a
 * System hue — so the cache key has no hue component. The per-System tint is
 * applied at DRAW time (draw-sky.ts, a colour filter whose numbers come from
 * the sky spec), so a System change, and Plan 13's switch crossfade, edit a
 * SharedValue only and never bake. The bake runs on canvas mount and on a
 * theme or size-bucket change only, deferred off the effect (no blocking
 * wait: the sky draws its plain gradient until the image lands).
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
import {
  AlphaType,
  ColorType,
  type SkImage,
  Skia,
} from "@shopify/react-native-skia";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";
import type { OrreryGenerationLedger } from "../resources/orrery-generation-ledger";
import {
  ORRERY_LAYER,
  type OrreryInk,
  type SkyImageSpec,
  skyHandle,
} from "./scene-specs";
import {
  SKY_BAKE_MAX_PX,
  SKY_BAKE_PX_PER_DP,
  SKY_MARGIN_DP,
  SKY_SIZE_BUCKET_DP,
} from "./visual-tunables";

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

/** The baked texture size for a bucket (texels; longest side capped). */
export function skyBakePixels(bucket: SkyBucket): {
  width: number;
  height: number;
} {
  let scale = SKY_BAKE_PX_PER_DP;
  const longest = Math.max(bucket.width, bucket.height) * scale;
  if (longest > SKY_BAKE_MAX_PX) scale *= SKY_BAKE_MAX_PX / longest;
  return {
    width: Math.max(2, Math.round(bucket.width * scale)),
    height: Math.max(2, Math.round(bucket.height * scale)),
  };
}

// ── The neutral nebula (pure; no Skia) ────────────────────────────────────

export interface SkyBakeInput {
  /** `skyBakeKey(...)` of this bake (logged; equal keys never re-bake). */
  key: string;
  /** The theme's neutral nebula tints (RGBA 0..1); 2–3 entries. */
  nebula: readonly OrreryInk[];
  /** Peak nebula alpha (SKY_LOOKS[...].nebulaStrength). */
  strength: number;
  /** Texture size in texels. */
  width: number;
  height: number;
  /** Noise seed (fixed per package, so the sky is the same every visit). */
  seed: number;
}

/** Integer lattice hash → 0..1 (Math.imul keeps it exact in 32-bit ints). */
function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(e0: number, e1: number, x: number): number {
  return smooth(clamp01((x - e0) / (e1 - e0)));
}

/** Value noise on an integer lattice (float64: no GPU precision limits). */
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

function fbm(x: number, y: number, octaves: number, seed: number): number {
  let v = 0;
  let amp = 0.5;
  let norm = 0;
  let px = x;
  let py = y;
  for (let i = 0; i < octaves; i++) {
    v += amp * vnoise(px, py, seed + i * 1013);
    norm += amp;
    // Rotate + scale each octave so lattice axes never line up.
    const nx = px * 1.6 - py * 1.2 + 17.3;
    const ny = px * 1.2 + py * 1.6 + 5.9;
    px = nx;
    py = ny;
    amp *= 0.5;
  }
  return v / norm;
}

/** The soft band's angle (radians) and half-width (fraction of the height). */
const BAND_ANGLE = -0.42;
const BAND_WIDTH = 0.16;
/** Where the band crosses the vertical centre line (fraction of the height). */
const BAND_CENTRE = 0.38;
/**
 * A few soft clouds along the band: [along-band t, across offset, radius,
 * weight]. Off-band sky stays almost void, so the nebula is never
 * "everywhere" (OWNER-REVIEW, Lab A).
 */
const CLOUDS: readonly (readonly [number, number, number, number])[] = [
  [-0.32, 0.02, 0.22, 0.9],
  [0.08, -0.03, 0.17, 0.7],
  [0.42, 0.03, 0.24, 0.8],
];

/**
 * The neutral nebula as premultiplied RGBA8 (transparent off the clouds; the
 * gradient under it is drawn analytically). Deterministic for an input.
 */
export function bakeSkyPixels(input: SkyBakeInput): Uint8Array {
  const { width, height, nebula, strength, seed } = input;
  const bytes = new Uint8Array(width * height * 4);
  if (nebula.length === 0 || !(strength > 0)) return bytes;
  const A = nebula[0];
  const B = nebula[1] ?? A;
  const C = nebula[2] ?? null;
  const aspect = width / height;
  const ca = Math.cos(BAND_ANGLE);
  const sa = Math.sin(BAND_ANGLE);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      // Height-normalised coordinates centred on the band's crossing point.
      const u = ((i + 0.5) / width - 0.5) * aspect;
      const v = (j + 0.5) / height - BAND_CENTRE;
      const t = u * ca + v * sa;
      const n0 = -u * sa + v * ca;
      const warpN = (fbm(u * 3 + 11, v * 3 + 3, 2, seed + 71) - 0.5) * 0.14;
      const n = n0 + 0.05 * Math.sin(t * 5 + 0.7) + warpN;
      const band = Math.exp(-(n * n) / (2 * BAND_WIDTH * BAND_WIDTH));
      if (band < 0.02) continue;
      let cloud = 0;
      for (const [ct, cn, cr, cw] of CLOUDS) {
        const dt = t - ct;
        const dn = n - cn;
        cloud += cw * Math.exp(-(dt * dt + dn * dn * 2.2) / (cr * cr));
      }
      const gas = fbm(u * 3.2 + 3.1, v * 3.2 + 8.4, 3, seed + 13);
      let density =
        band * (0.25 + 0.75 * clamp01(cloud)) * smoothstep(0.32, 0.8, gas);
      // A faint haze so the band edge is never a hard cut.
      density += 0.06 * band * gas;
      const alpha = clamp01(density) * strength;
      if (alpha <= 0.002) continue;
      const mixAB = smoothstep(
        0.35,
        0.7,
        fbm(u * 2.4 + 40, v * 2.4 + 7, 2, seed + 51),
      );
      const mixC =
        C === null
          ? 0
          : smoothstep(0.55, 0.85, fbm(u * 2 + 9, v * 2 + 21, 2, seed + 29)) *
            0.6;
      const k = (i + j * width) * 4;
      // Ordered dither (±0.5 LSB) against 8-bit banding at low alpha.
      const dither = (hash2(i, j, 991) - 0.5) / 255;
      for (let c = 0; c < 3; c++) {
        const ab = A[c] + (B[c] - A[c]) * mixAB;
        const col = C === null ? ab : ab + (C[c] - ab) * mixC;
        bytes[k + c] = Math.round(clamp01(col * alpha + dither) * 255);
      }
      bytes[k + 3] = Math.round(clamp01(alpha + dither) * 255);
    }
  }
  return bytes;
}

/** The baked SkImage for an input, or null when the runtime cannot make one. */
export function bakeSkyImage(input: SkyBakeInput): SkImage | null {
  try {
    const make = (Skia as { Image?: { MakeImage?: unknown } } | undefined)
      ?.Image?.MakeImage;
    if (typeof make !== "function") return null;
    const bytes = bakeSkyPixels(input);
    return Skia.Image.MakeImage(
      {
        width: input.width,
        height: input.height,
        alphaType: AlphaType.Premul,
        colorType: ColorType.RGBA_8888,
      },
      Skia.Data.fromBytes(bytes),
      input.width * 4,
    );
  } catch {
    return null;
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
