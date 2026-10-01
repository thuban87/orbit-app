/**
 * ORRERY LAB B — SkSL sources and the lazy runtime-effect loader.
 *
 * Rules (research 03 §0.2 / §2.5, AGENT-RULES):
 * - NO `Skia.RuntimeEffect.Make` at import time. `orrery-scene.test.ts` mocks
 *   Skia as `{}` and imports this module through `OrreryWorld`; every compile
 *   happens lazily inside `getLabEffect`, wrapped in `try`, memoised in a
 *   module-level Map after the first attempt (success OR null).
 * - `Make` returns null on an SkSL/driver failure: every consumer renders its
 *   plain fallback when `getLabEffect` returns null.
 * - SkSL contains NO colour constants and no `#define`: colours arrive only as
 *   uniforms fed from theme tokens (`labb-uniforms.ts`). Time is wrapped
 *   (`% 1000 s`) by the caller; coordinates/hashes stay `float`.
 * - `forceFallback` (panel toggle) makes every getter return null so the
 *   fallback path can be compared on device.
 *
 * Adding an effect (WP-1.1+): add its source to `LAB_EFFECT_SOURCES`; if it is
 * transition-only, also list it in `WARMUP_EFFECTS` so `LabCanvas` compiles it
 * at Orrery entry instead of at the first System switch.
 */
import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

// --- L0 nebula (WP-1.1) -------------------------------------------------------
// Shared SkSL fragments, concatenated into the three nebula effects so the
// baked and the live variants compute IDENTICAL densities (a fair A/B).
//
// Noise is PERIODIC (lattice wrapped with `mod(i, per)`, every octave doubles
// both frequency and period), so the baked density texture tiles seamlessly
// with `repeat` and the sky never shows an edge however far the user pans.

const NEBULA_NOISE = `
float lbHash(float2 p) {
  float3 p3 = fract(float3(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float lbNoise(float2 p, float per) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = lbHash(mod(i, per));
  float b = lbHash(mod(i + float2(1.0, 0.0), per));
  float c = lbHash(mod(i + float2(0.0, 1.0), per));
  float d = lbHash(mod(i + float2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float lbFbm(float2 p, float per) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 5; k++) {
    v += a * lbNoise(p, per);
    p = p * 2.0;
    per = per * 2.0;
    a *= 0.5;
  }
  return v / 0.96875;
}
float3 lbNebula(float2 p, float per, float t) {
  float2 q = float2(lbFbm(p + float2(0.0, t), per),
                    lbFbm(p + float2(5.2, 1.3 - t), per));
  float2 r = float2(lbFbm(p + 3.0 * q + float2(1.7, 9.2), per),
                    lbFbm(p + 3.0 * q + float2(8.3, 2.8), per));
  float n = lbFbm(p + 3.2 * r, per);
  float nb = lbFbm(p + 3.2 * r.yx + float2(4.1, 7.7), per);
  float region = lbNoise(p * 0.5 + float2(0.37, 0.71), per * 0.5);
  float lobeA = smoothstep(0.42, 0.86, n) * smoothstep(0.28, 0.7, region);
  float lobeB = smoothstep(0.42, 0.86, nb) * (1.0 - smoothstep(0.3, 0.72, region));
  float d = lbFbm(p * 2.0 + 4.0 * q, per * 2.0);
  float dust = smoothstep(0.52, 0.78, d);
  return float3(lobeA, lobeB, dust);
}
`;

const NEBULA_SHADE = `
uniform float2 uRes;
uniform float3 uSky;
uniform float3 uLobeA;
uniform float3 uLobeB;
uniform float3 uEmber;
uniform float3 uVigTone;
uniform float uStrA;
uniform float uStrB;
uniform float uGlow;
uniform float uEmberStr;
uniform float uDust;
uniform float uVig;
half4 lbShade(float3 n, float2 xy) {
  float a = n.x;
  float b = n.y;
  float3 col = uSky;
  col = mix(col, uLobeA, clamp(a * uStrA, 0.0, 1.0));
  col = mix(col, uLobeB, clamp(b * uStrB, 0.0, 1.0));
  col = mix(col, uEmber, clamp(a * b * 4.0 * uEmberStr, 0.0, 1.0));
  col += uLobeA * (a * a * uGlow) + uLobeB * (b * b * uGlow);
  col *= 1.0 - n.z * clamp(0.25 + a + b, 0.0, 1.0) * uDust;
  float2 v = (xy - 0.5 * uRes) / (0.5 * uRes);
  float vig = smoothstep(0.45, 1.4, length(v * float2(1.0, 0.85)));
  col = mix(col, uVigTone, vig * uVig);
  col += (lbHash(xy) - 0.5) / 255.0;
  return half4(half3(clamp(col, 0.0, 1.0)), 1.0);
}
`;

const NEBULA_SKY = `
uniform float2 uVC;
uniform float2 uOff;
uniform float uRot;
uniform float uScale;
uniform float uTexPerDp;
uniform float2 uDrift;
uniform float uWarp;
uniform float uTime;
float2 lbSky(float2 xy) {
  float2 d = xy - uVC - uOff;
  float c = cos(uRot);
  float s = sin(uRot);
  float2 p = float2(c * d.x + s * d.y, -s * d.x + c * d.y) / uScale;
  p += uDrift;
  p += uWarp * float2(sin(p.y * 0.011 + uTime * 0.21),
                      cos(p.x * 0.013 - uTime * 0.17));
  return p;
}
`;

export const LAB_EFFECT_SOURCES = {
  /**
   * Pipeline probe: a flat uniform colour. Proves the compile / uniform /
   * warm-up path on device before real effects land (WP-1.1+).
   */
  probe: `
uniform half4 uColor;
half4 main(float2 xy) {
  return uColor;
}
`,
  /**
   * One-shot BAKE (Orrery entry): nebula DENSITIES, not colours —
   * r = lobe A, g = lobe B, b = dust. Theme/hue changes therefore never rebake;
   * they only change the sample shader's uniforms (and M2's sky-hue crossfade
   * is free). Coordinates are texels of a square, seamlessly tiling texture.
   */
  nebulaBake: `${NEBULA_NOISE}
uniform float uTexSize;
uniform float uPer;
half4 main(float2 xy) {
  float3 n = lbNebula(xy / uTexSize * uPer, uPer, 0.0);
  return half4(half3(clamp(n, 0.0, 1.0)), 1.0);
}
`,
  /**
   * Per-frame SAMPLE of the baked densities: parallax (offset / yaw / zoom
   * scale from `frame.value.pose`), ambient drift + breathing warp, token
   * colouring, dust, vignette and a 1/255 dither. One texture fetch per pixel.
   */
  nebulaSample: `${NEBULA_NOISE}${NEBULA_SHADE}${NEBULA_SKY}
uniform shader uNeb;
half4 main(float2 xy) {
  float2 p = lbSky(xy);
  half4 t = uNeb.eval(p * uTexPerDp);
  return lbShade(float3(t.rgb), xy);
}
`,
  /**
   * A/B only: the same nebula computed LIVE at full resolution every frame
   * (≈17 noise evaluations × 5 octaves per pixel) with slowly evolving warp.
   */
  nebulaLive: `${NEBULA_NOISE}${NEBULA_SHADE}${NEBULA_SKY}
uniform float uTexSize;
uniform float uPer;
half4 main(float2 xy) {
  float2 p = lbSky(xy);
  float3 n = lbNebula(p * uTexPerDp / uTexSize * uPer, uPer, uTime * 0.01);
  return lbShade(n, xy);
}
`,
} as const;

export type LabEffectName = keyof typeof LAB_EFFECT_SOURCES;

/** Effects drawn invisibly at mount so the GL program compile happens early. */
export const WARMUP_EFFECTS: readonly LabEffectName[] = ["probe"];

export type LabEffectStatus = "ok" | "null" | "error" | "pending";

const cache = new Map<LabEffectName, SkRuntimeEffect | null>();
const status = new Map<LabEffectName, LabEffectStatus>();
let forceFallback = false;
const warned = new Set<LabEffectName>();

/** Panel toggle: when true every getter returns null (fallback A/B). */
export function setLabEffectForceFallback(value: boolean): void {
  forceFallback = value;
}

/**
 * Lazily compile (once) and return the effect, or null on failure / forced
 * fallback. Never throws. Safe to call during React render (JS thread).
 */
export function getLabEffect(name: LabEffectName): SkRuntimeEffect | null {
  if (forceFallback) return null;
  if (cache.has(name)) return cache.get(name) ?? null;
  let effect: SkRuntimeEffect | null = null;
  try {
    effect = Skia?.RuntimeEffect?.Make?.(LAB_EFFECT_SOURCES[name]) ?? null;
    status.set(name, effect ? "ok" : "null");
  } catch {
    effect = null;
    status.set(name, "error");
  }
  cache.set(name, effect);
  if (
    !effect &&
    !warned.has(name) &&
    typeof __DEV__ !== "undefined" &&
    __DEV__
  ) {
    warned.add(name);
    console.warn(
      `[lab-b] runtime effect "${name}" unavailable; using fallback`,
    );
  }
  return effect;
}

/** Per-effect compile status for the debug panel ("pending" = never asked). */
export function labEffectStatuses(): Record<LabEffectName, LabEffectStatus> {
  return Object.fromEntries(
    (Object.keys(LAB_EFFECT_SOURCES) as LabEffectName[]).map((name) => [
      name,
      status.get(name) ?? "pending",
    ]),
  ) as Record<LabEffectName, LabEffectStatus>;
}

/** Test hook: forget every cached compile. */
export function resetLabEffectsForTest(): void {
  cache.clear();
  status.clear();
  warned.clear();
  forceFallback = false;
}
