/**
 * ORRERY LAB A — pass 1: the nebula baked on the CPU (JS, float64) into a small
 * RGBA image, cached at module level per theme ink.
 *
 * Why not the SkSL fbm any more: on the Pixel's Mali GPU the shader's hash/fbm
 * evaluated with too little precision and rendered faceted polygon shards with
 * a hard vertical seam (evidence/direction-1/00, 01a). Doing the noise in JS
 * doubles is precision-proof on every GPU, and the field is soft enough that a
 * 256 px texture bilinearly upscaled to the sky disc is indistinguishable from
 * a full-res render.
 *
 * Why the module cache: the Orrery canvas unmounts on blur/background by
 * design, and direction 1 re-rasterised the nebula on every remount (a 2–3 s
 * blank-then-pop on tab return). The baked SkImage is now created once per
 * (palette, mode) and reused by every later mount. At most one entry per theme
 * palette exists, so the cache is bounded (4 presets) and never disposed.
 *
 * Shape: NOT a full-screen wash. A soft diagonal band (a "galactic plane")
 * carrying a few large gas clouds, shaped by low-octave value noise and cut by
 * a darker dust lane; off-band sky is left almost void so the vignette and the
 * stars read. Colours come only from theme tokens (passed in as RGBA arrays).
 */
import {
  AlphaType,
  ColorType,
  type SkImage,
  Skia,
} from "@shopify/react-native-skia";
import {
  NEBULA_ALPHA_DARK,
  NEBULA_ALPHA_LIGHT,
  NEBULA_BAKE_SIZE,
  NEBULA_BAND_ANGLE,
  NEBULA_BAND_WIDTH,
  NEBULA_CHART_INK,
  NEBULA_DUST_STRENGTH,
  NEBULA_GAIN,
} from "./deep-field-config";
import type { DeepFieldInk, Rgba } from "./deep-field-ink";

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

/** Value noise on an integer lattice (float64 math: no GPU precision limits). */
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
    // Rotate + scale each octave so lattice axes never line up (no grid look).
    const nx = px * 1.6 - py * 1.2 + 17.3;
    const ny = px * 1.2 + py * 1.6 + 5.9;
    px = nx;
    py = ny;
    amp *= 0.5;
  }
  return v / norm;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(e0: number, e1: number, x: number): number {
  return smooth(clamp01((x - e0) / (e1 - e0)));
}

/** Large soft gas clouds placed along the band (band coord t, offset n). */
const CLOUDS: readonly (readonly [number, number, number, number])[] = [
  // [along-band t, across-band offset, radius, weight]
  [-0.3, 0.02, 0.22, 1],
  [0.05, -0.03, 0.17, 0.75],
  [0.32, 0.04, 0.24, 0.9],
  [-0.6, -0.05, 0.16, 0.5],
];

export interface NebulaPixels {
  size: number;
  /** Premultiplied RGBA8. */
  bytes: Uint8Array;
}

/** Pure bake (no Skia) — unit-testable; deterministic for a given ink. */
export function bakeNebulaPixels(
  ink: Pick<
    DeepFieldInk,
    "chart" | "nebulaA" | "nebulaB" | "starlight" | "grid"
  >,
  size: number = NEBULA_BAKE_SIZE,
): NebulaPixels {
  const bytes = new Uint8Array(size * size * 4);
  const peak = ink.chart ? NEBULA_ALPHA_LIGHT : NEBULA_ALPHA_DARK;
  const ca = Math.cos(NEBULA_BAND_ANGLE);
  const sa = Math.sin(NEBULA_BAND_ANGLE);
  const A: Rgba = ink.nebulaA;
  const B: Rgba = ink.nebulaB;
  const S: Rgba = ink.starlight;
  const G: Rgba = ink.grid;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      // Centered coords, -0.5..0.5 (the texture covers the sky DISC square).
      const u = (i + 0.5) / size - 0.5;
      const v = (j + 0.5) / size - 0.5;
      // Disc mask: the sky is a rotating disc; keep corners empty.
      const r = Math.hypot(u, v) * 2;
      const disc = 1 - smoothstep(0.82, 1, r);
      if (disc <= 0) continue;
      // Band frame: t along, n across (with a gentle S-curve).
      const t = u * ca + v * sa;
      const n0 = -u * sa + v * ca;
      const warpN = (fbm(u * 3 + 11, v * 3 + 3, 3, 71) - 0.5) * 0.16;
      const n = n0 + 0.06 * Math.sin(t * 5.5 + 0.7) + warpN;
      const band = Math.exp(-(n * n) / (2 * NEBULA_BAND_WIDTH ** 2));
      // Clouds along the band.
      let cloud = 0;
      for (const [ct, cn, cr, cw] of CLOUDS) {
        const dt = t - ct;
        const dn = n - cn;
        cloud += cw * Math.exp(-(dt * dt + dn * dn * 2.2) / (cr * cr));
      }
      // Low-octave gas structure (domain-warped once).
      const wx = fbm(u * 2.2 + 3.1, v * 2.2 + 8.4, 3, 7) - 0.5;
      const wy = fbm(u * 2.2 + 9.7, v * 2.2 + 1.3, 3, 9) - 0.5;
      const gas = fbm(u * 4 + wx * 1.6, v * 4 + wy * 1.6, 4, 13);
      const fil = fbm(u * 9 + wx * 2.5 + 4, v * 9 + wy * 2.5 + 2, 3, 29);
      let density =
        NEBULA_GAIN *
        band *
        (0.18 + 0.82 * clamp01(cloud)) *
        smoothstep(0.3, 0.78, gas);
      density *= 0.7 + 0.6 * fil;
      // Dust lane: a thin dark rift just off the band centre.
      const laneN = n + 0.025 + (fil - 0.5) * 0.04;
      const lane =
        Math.exp(-(laneN * laneN) / (2 * (NEBULA_BAND_WIDTH * 0.22) ** 2)) *
        smoothstep(0.35, 0.65, gas);
      density *= 1 - NEBULA_DUST_STRENGTH * lane;
      // Very faint off-band haze so the band edge is never a hard cut.
      density += 0.05 * band * gas;
      const alpha = clamp01(density) * peak * disc;
      if (alpha <= 0.001) continue;
      // Colour: A↔B by a second field, a touch of starlight in dense cores.
      const mixAB = smoothstep(0.35, 0.7, fbm(u * 3 + 40, v * 3 + 7, 3, 51));
      const hot = ink.chart ? 0 : clamp01((density - 0.55) * 1.4) * 0.35;
      const k = (i + j * size) * 4;
      // Ordered dither (±0.5 LSB) against 8-bit banding at low alpha.
      const dither = (hash2(i, j, 991) - 0.5) / 255;
      for (let c = 0; c < 3; c++) {
        const base = A[c] + (B[c] - A[c]) * mixAB;
        // Chart paper: pencil-shade the pale wash toward the grid ink.
        const inked = ink.chart
          ? base + (G[c] - base) * NEBULA_CHART_INK
          : base;
        const col = inked + (S[c] - inked) * hot;
        bytes[k + c] = Math.round(clamp01(col * alpha + dither) * 255);
      }
      bytes[k + 3] = Math.round(clamp01(alpha + dither) * 255);
    }
  }
  return { size, bytes };
}

const cache = new Map<string, SkImage | null>();

function inkKey(ink: DeepFieldInk): string {
  return [
    ink.chart ? 1 : 0,
    ...ink.nebulaA,
    ...ink.nebulaB,
    ...ink.starlight,
    ...ink.grid,
  ]
    .map((n) => (typeof n === "number" ? n.toFixed(3) : String(n)))
    .join(",");
}

/** True when this ink's nebula is already baked (no fade-in needed). */
export function nebulaCached(ink: DeepFieldInk): boolean {
  return cache.has(inkKey(ink));
}

/** The cached nebula image for this ink, baking it on first use. */
export function nebulaImage(ink: DeepFieldInk): SkImage | null {
  const key = inkKey(ink);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let image: SkImage | null = null;
  try {
    const make = (Skia as { Image?: { MakeImage?: unknown } } | undefined)
      ?.Image?.MakeImage;
    if (typeof make === "function") {
      const { size, bytes } = bakeNebulaPixels(ink);
      image = Skia.Image.MakeImage(
        {
          width: size,
          height: size,
          alphaType: AlphaType.Premul,
          colorType: ColorType.RGBA_8888,
        },
        Skia.Data.fromBytes(bytes),
        size * 4,
      );
    }
  } catch {
    image = null;
  }
  cache.set(key, image);
  return image;
}
