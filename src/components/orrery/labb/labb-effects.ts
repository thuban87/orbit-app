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

// FAR star layer, analytic (hash grid, one candidate star per 22-dp sky cell).
// Lives in the nebula pass so the 700+ far stars cost no CPU and no extra
// full-screen pass. Needs NEBULA_SKY's uVC / uRot (concatenated before).
const NEBULA_FAR_STARS = `
uniform float2 uFarOff;
uniform float uFarScale;
uniform float uStarAlpha;
uniform float uStarAdd;
uniform float uStarDensity;
uniform float3 uStarA;
uniform float3 uStarB;
uniform float3 uStarC;
float3 lbFarStars(float2 xy, float3 col) {
  float2 d = xy - uVC - uFarOff;
  float c = cos(uRot);
  float s = sin(uRot);
  float2 p = float2(c * d.x + s * d.y, -s * d.x + c * d.y) / uFarScale;
  float2 cell = floor(p / 22.0);
  if (lbHash(cell + 17.0) > uStarDensity) return col;
  float2 sp = (cell + 0.2 + 0.6 * float2(lbHash(cell + 41.3), lbHash(cell + 7.9))) * 22.0;
  float dist = length(p - sp) * uFarScale;
  float rad = 0.42 + 0.75 * pow(lbHash(cell + 3.1), 3.0);
  float a = min(1.0, exp(-(dist * dist) / (rad * rad)) * (0.45 + 0.85 * lbHash(cell + 9.7)) * uStarAlpha);
  float t = lbHash(cell + 5.5);
  float3 sc = t < 0.72 ? uStarA : (t < 0.86 ? uStarB : uStarC);
  return mix(mix(col, sc, a), col + sc * a, uStarAdd);
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
  col = lbFarStars(xy, col);
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

// --- L2–L4 worlds (WP-1.2) ----------------------------------------------------
// Bodies are drawn in LOCAL coordinates (translate + uniform scale only), so
// `xy` is in world-radius units centred on the body and the screen-space light
// direction is also the local one. `uPx` = local units per dp (for 1-dp AA and
// the dp-wide crisp rim at any zoom). ONE draw per body: a circle of radius
// r·reach whose shader paints the lit disc INSIDE r (exactly the frame radius —
// hit/label/focus contracts unchanged) and the atmosphere / contact shadow
// OUTSIDE it.

const BODY_LIT = `
uniform float uR;
uniform float uPx;
uniform float2 uLight;
uniform float uLightZ;
uniform float uLit;
uniform float uFloor;
uniform float uWrap;
uniform float3 uStatus;
uniform float3 uSky;
uniform float3 uShadow;
uniform float3 uHi;
uniform float uAtmo;
uniform float uAtmoAdd;
uniform float uAtmoReach;
uniform float uShadowStr;
uniform float uRimPx;
uniform float uRimStr;
uniform float uFresnel;
uniform float uDesat;
uniform float uSpec;
uniform float uHaze;
half4 lbBody(float2 xy, float3 surf) {
  float2 d = xy / uR;
  float l = length(d);
  float aa = uPx / uR;
  float inside = clamp((1.0 - l) / aa + 0.5, 0.0, 1.0);
  float2 dir = d / max(l, 0.0001);
  float facing = dot(dir, uLight);
  float3 c = float3(0.0);
  if (inside > 0.0) {
    float nz = sqrt(max(0.0, 1.0 - l * l));
    float3 N = float3(d, nz);
    float3 L = normalize(float3(uLight, uLightZ));
    float lam = clamp((dot(N, L) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
    float light = mix(1.0, uFloor + (1.0 - uFloor) * lam, uLit);
    float lum = dot(surf, float3(0.299, 0.587, 0.114));
    c = mix(surf, float3(lum), uDesat) * light;
    float3 H = normalize(L + float3(0.0, 0.0, 1.0));
    c += uHi * pow(max(dot(N, H), 0.0), 28.0) * uSpec * uLit;
    float fres = pow(1.0 - nz, 2.5) * uFresnel * (0.3 + 0.7 * max(0.0, facing));
    c = mix(c, uStatus, clamp(fres, 0.0, 1.0));
    float rimW = uRimPx * uPx / uR;
    float rim = smoothstep(1.0 - rimW - aa, 1.0 - rimW, l) * uRimStr;
    c = mix(c, uStatus, rim);
    c = mix(c, uSky, uHaze);
  }
  float t = clamp((l - 1.0) / (uAtmoReach - 1.0), 0.0, 1.0);
  float g = 1.0 - t;
  g = g * g * g * uAtmo * mix(1.0, 0.4 + 0.6 * max(0.0, facing), uLit) * (1.0 - uHaze);
  float sh = (1.0 - smoothstep(0.9, 1.26, length(d + uLight * 0.14))) * uShadowStr;
  float ga = g * (1.0 - 0.75 * uAtmoAdd);
  float oa = ga + sh * (1.0 - ga);
  float3 oc = uStatus * g + uShadow * sh * (1.0 - ga);
  return half4(half3(c * inside + oc * (1.0 - inside)), half(inside + oa * (1.0 - inside)));
}
`;

const SUN_CORONA = `
uniform float uR;
uniform float uPx;
uniform float uTime;
uniform float uReach;
uniform float3 uGlow;
uniform float3 uHi;
uniform float3 uDeep;
uniform float3 uBase;
uniform float uPlasma;
uniform float uCorona;
uniform float uCoronaAdd;
half4 lbSun(float2 xy, float3 surf) {
  float2 d = xy / uR;
  float l = length(d);
  float aa = uPx / uR;
  float inside = clamp((1.0 - l) / aa + 0.5, 0.0, 1.0);
  float a01 = atan(d.y, d.x) / 6.2831853 + 0.5;
  float rot = uTime * 0.004;
  float o = max(0.0, l - 1.0);
  // Rays: two angular noise bands (periodic in angle) that also drift outward
  // with radius, so streamers look like they flow off the limb.
  float r1 = lbNoise(float2((a01 + rot) * 18.0, o * 1.6 - uTime * 0.06), 18.0);
  float r2 = lbNoise(float2((a01 - rot * 0.7) * 41.0, o * 3.0 - uTime * 0.1 + 7.0), 41.0);
  float rays = pow(0.62 * r1 + 0.38 * r2, 2.2) * 2.1;
  float edge = 1.0 - smoothstep(uReach * 0.62, uReach, l);
  float inner = exp(-o * 7.5);
  float halo = exp(-o * 2.4) * 0.55;
  float streamers = exp(-o * 2.0) * rays * 0.75;
  float limb = exp(-(o * o) / 0.0016) * 0.7;
  float g = (inner * 0.9 + halo + streamers + limb) * edge * uCorona;
  float3 gc = mix(uGlow, uHi, clamp(inner * 0.55 + limb * 0.6, 0.0, 1.0));
  float ga = clamp(g, 0.0, 1.0) * (1.0 - 0.7 * uCoronaAdd);
  float3 oc = gc * clamp(g, 0.0, 1.4);
  return half4(half3(surf * inside + oc * (1.0 - inside)), half(inside + ga * (1.0 - inside)));
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
   * colouring, dust, the analytic FAR star layer, vignette and a 1/255
   * dither. One texture fetch per pixel.
   */
  nebulaSample: `${NEBULA_NOISE}${NEBULA_SKY}${NEBULA_FAR_STARS}${NEBULA_SHADE}
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
  nebulaLive: `${NEBULA_NOISE}${NEBULA_SKY}${NEBULA_FAR_STARS}${NEBULA_SHADE}
uniform float uTexSize;
uniform float uPer;
half4 main(float2 xy) {
  float2 p = lbSky(xy);
  float3 n = lbNebula(p * uTexPerDp / uTexSize * uPer, uPer, uTime * 0.01);
  return lbShade(n, xy);
}
`,
  /**
   * WP-1.2 photo body: the photo (child `uImage`, an ImageShader in local
   * coords) lit from the sun with a readability floor, status Fresnel rim +
   * crisp inner rim, desaturation per status, far-side haze, atmosphere or
   * light-theme contact shadow outside the disc.
   */
  bodyPhoto: `${BODY_LIT}
uniform shader uImage;
half4 main(float2 xy) {
  float3 s = float3(uImage.eval(xy).rgb);
  return lbBody(xy, s);
}
`,
  /**
   * WP-1.2 initials body: a procedural banded "world" in the contact's swatch
   * (bands follow the sphere's latitude, warped by noise, seeded per body),
   * lit exactly like a photo body. Initials glyphs are drawn on top.
   */
  bodyProcedural: `${NEBULA_NOISE}${BODY_LIT}
uniform float3 uBase;
uniform float3 uBand;
uniform float uSeed;
uniform float uPattern;
half4 main(float2 xy) {
  float2 d = xy / uR;
  float nz = sqrt(max(0.0, 1.0 - dot(d, d)));
  float lon = d.x / max(nz, 0.25);
  float lat = d.y;
  float s = uSeed * 61.0;
  float w = lbNoise(float2(lon * 1.7 + s, lat * 2.3), 64.0);
  float w2 = lbNoise(float2(lon * 4.1 - s, lat * 6.0 + 3.0), 64.0);
  float bands = sin(lat * (5.0 + 3.0 * uSeed) + w * 3.2 + w2 * 0.9 + s);
  float k = 0.5 + 0.5 * bands;
  float3 surf = mix(uBase, uBand, k * k * uPattern);
  surf = mix(surf, uHi, max(0.0, w2 - 0.45) * 0.35 * uPattern);
  return lbBody(xy, surf);
}
`,
  /**
   * WP-1.2 sun without a photo: a limb-darkened stellar surface with slow
   * 2-octave granulation (`uPlasma` 1) — or the occupant swatch (`uPlasma` 0)
   * — inside r; ray-structured corona + bright limb out to r·reach.
   */
  sunStar: `${NEBULA_NOISE}${SUN_CORONA}
half4 main(float2 xy) {
  float2 d = xy / uR;
  float nz = sqrt(max(0.0, 1.0 - dot(d, d)));
  // Granulation: domain-warped value noise on a rotated lattice (an
  // axis-aligned lattice reads as blocky squares at sun size).
  float2 q = float2(0.8 * d.x - 0.6 * d.y, 0.6 * d.x + 0.8 * d.y) * 6.0;
  float2 w = float2(lbNoise(q * 0.7 + float2(uTime * 0.03, 1.7), 64.0),
                    lbNoise(q * 0.7 + float2(4.1, -uTime * 0.025), 64.0));
  float g1 = lbNoise(q + 2.2 * w + float2(uTime * 0.05, 0.0), 64.0);
  float g2 = lbNoise(q * 2.3 - 1.5 * w + float2(0.0, uTime * 0.07), 64.0);
  float gran = smoothstep(0.15, 0.85, 0.65 * g1 + 0.35 * g2);
  float limb = pow(nz, 0.75);
  float3 star = mix(uDeep, uGlow, 0.25 + 0.75 * limb);
  star *= 0.88 + 0.22 * gran;
  star = mix(star, uHi, pow(nz, 2.5) * 0.5);
  float3 sw = uBase * (0.85 + 0.15 * limb);
  return lbSun(xy, mix(sw, star, uPlasma));
}
`,
  /**
   * WP-1.2 sun with a photo: the face is EMISSIVE (never darkened beyond a
   * whisper of limb darkening) inside r; the same corona outside.
   */
  sunPhoto: `${NEBULA_NOISE}${SUN_CORONA}
uniform shader uImage;
half4 main(float2 xy) {
  float2 d = xy / uR;
  float nz = sqrt(max(0.0, 1.0 - dot(d, d)));
  float3 s = float3(uImage.eval(xy).rgb) * (0.9 + 0.1 * pow(nz, 0.5));
  return lbSun(xy, s);
}
`,
  /** WP-1.2 moon: a tiny lit sphere (token tone) with a specular glint. */
  moon: `
uniform float uR;
uniform float uPx;
uniform float2 uLight;
uniform float3 uTone;
uniform float3 uHi;
uniform float3 uSky;
uniform float uFloor;
uniform float uHaze;
half4 main(float2 xy) {
  float2 d = xy / uR;
  float l = length(d);
  float inside = clamp((1.0 - l) / (uPx / uR) + 0.5, 0.0, 1.0);
  float nz = sqrt(max(0.0, 1.0 - l * l));
  float3 N = float3(d, nz);
  float3 L = normalize(float3(uLight, 0.45));
  float lam = clamp(dot(N, L), 0.0, 1.0);
  float3 c = uTone * (uFloor + (1.0 - uFloor) * lam);
  float3 H = normalize(L + float3(0.0, 0.0, 1.0));
  c += uHi * pow(max(dot(N, H), 0.0), 20.0) * 0.6;
  c = mix(c, uSky, uHaze);
  return half4(half3(c * inside), half(inside));
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
