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
uniform float4 uWarpS;
float3 lbFarStars(float2 xy, float3 col) {
  float c = cos(uRot);
  float s = sin(uRot);
  float2 d = xy - uVC - uFarOff;
  float2 p = float2(c * d.x + s * d.y, -s * d.x + c * d.y) / uFarScale;
  if (uWarpS.x < 0.05) {
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
  // WP-2.1 hyperspace: every far star becomes a segment from its position back
  // toward the vanishing point (uWarpS.yz), length uWarpS.x dp at the screen
  // edge. The pixel checks the cells along the ray toward the centre.
  float2 toC = xy - uWarpS.yz;
  float rl = max(length(toC), 1.0);
  float2 dirS = toC / rl;
  float2 dirP = float2(c * dirS.x + s * dirS.y, -s * dirS.x + c * dirS.y);
  float len = uWarpS.x * clamp(rl / 420.0, 0.08, 1.6);
  float best = 0.0;
  float3 bestC = uStarA;
  for (int k = 0; k < 5; k++) {
    float back = float(k) * 15.0;
    if (back > len / uFarScale + 22.0) break;
    float2 cell = floor((p - dirP * back) / 22.0);
    if (lbHash(cell + 17.0) > uStarDensity) continue;
    float2 sp = (cell + 0.2 + 0.6 * float2(lbHash(cell + 41.3), lbHash(cell + 7.9))) * 22.0;
    float2 q = sp * uFarScale;
    float2 ss = float2(c * q.x - s * q.y, s * q.x + c * q.y) + uVC + uFarOff;
    float2 sd = ss - uWarpS.yz;
    float sl = max(length(sd), 1.0);
    float2 sdir = sd / sl;
    float ang = uWarpS.w;
    sdir = float2(cos(ang) * sdir.x - sin(ang) * sdir.y, sin(ang) * sdir.x + cos(ang) * sdir.y);
    float slen = uWarpS.x * clamp(sl / 420.0, 0.08, 1.6);
    float2 pa = xy - ss;
    float tt = clamp(dot(pa, -sdir) / max(slen, 0.001), 0.0, 1.0);
    float dist = length(pa + sdir * slen * tt);
    float rad = 0.5 + 0.75 * pow(lbHash(cell + 3.1), 3.0);
    float a = exp(-(dist * dist) / (rad * rad)) * (0.45 + 0.85 * lbHash(cell + 9.7)) * pow(1.0 - tt, 1.4);
    if (a > best) {
      best = a;
      float t = lbHash(cell + 5.5);
      bestC = t < 0.72 ? uStarA : (t < 0.86 ? uStarB : uStarC);
    }
  }
  float a = min(1.0, best * uStarAlpha);
  return mix(mix(col, bestC, a), col + bestC * a, uStarAdd);
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

// Uniforms are PACKED into float4s: RN Skia resolves every uniform by name
// (one JSI call each) and rebuilds every runtime shader on every canvas replay,
// so 25 scalar uniforms × ~190 bodies was measurable (PERF-LOG WP-1.2).
//   uA = (r, px, lightX, lightY)      uB = (lightZ, lit, floor, wrap)
//   uC = (status.rgb, atmo)           uD = (sky.rgb, haze)
//   uE = (shadow.rgb, shadowStr)      uF = (hi.rgb, spec)
//   uG = (atmoAdd, atmoReach, rimPx, rimStr)
//   uH = (fresnel, desat, pattern, seed)
const BODY_LIT = `
uniform float4 uA;
uniform float4 uB;
uniform float4 uC;
uniform float4 uD;
uniform float4 uE;
uniform float4 uF;
uniform float4 uG;
uniform float4 uH;
uniform float4 uK;
half4 lbBody(float2 xy, float3 surf) {
  float uR = uA.x;
  float uPx = uA.y;
  float2 uLight = uA.zw;
  float uLightZ = uB.x;
  float uLit = uB.y;
  float uFloor = uB.z;
  float uWrap = uB.w;
  float3 uStatus = uC.rgb;
  float uAtmo = uC.a;
  float3 uSky = uD.rgb;
  float uHaze = uD.a;
  float3 uShadow = uE.rgb;
  float uShadowStr = uE.a;
  float3 uHi = uF.rgb;
  float uSpec = uF.a;
  float uAtmoAdd = uG.x;
  float uAtmoReach = uG.y;
  float uRimPx = uG.z;
  float uRimStr = uG.w;
  float uFresnel = uH.x;
  float uDesat = uH.y;
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
    // WP-2.1 capture flare: a brief bright limb as an arriving world locks on.
    c = mix(c, mix(uStatus, uHi, 0.55), uK.y * (0.2 + 0.8 * l * l * l) * 0.75);
    // WP-2.2 defocus (uK.w < 0): other worlds desaturate, dim and sink a
    // little toward the sky (depth emphasis); the face stays legible.
    float dfc = max(-uK.w, 0.0);
    if (dfc > 0.0) {
      float dl = dot(c, float3(0.299, 0.587, 0.114));
      c = mix(mix(c, float3(dl), 0.3 * dfc), uSky, 0.22 * dfc) * (1.0 - 0.32 * dfc);
    }
    // WP-2.2 focus (uK.w > 0): a slightly brighter status limb on the locked world.
    c = mix(c, uStatus, max(uK.w, 0.0) * 0.18 * smoothstep(0.82, 1.0, l));
  }
  // WP-2.1 dissolve (departing worlds): a noise threshold eats the disc with a
  // glowing status-hue edge; the atmosphere thins with it.
  if (uK.x > 0.0) {
    float n = lbNoise(d * 3.3 + uK.z * 37.0, 64.0) * 0.62 + lbNoise(d * 8.5 + uK.z * 11.0, 64.0) * 0.38;
    float th = uK.x * 1.12 - 0.06;
    float keep = smoothstep(th - 0.015, th + 0.015, n);
    float edge = (1.0 - smoothstep(0.0, 0.07, abs(n - th))) * min(1.0, uK.x * 6.0);
    c = mix(c, uStatus * 1.5 + uHi * 0.35, edge * 0.9);
    inside *= clamp(keep + edge, 0.0, 1.0);
  }
  float t = clamp((l - 1.0) / (uAtmoReach - 1.0), 0.0, 1.0);
  float g = 1.0 - t;
  g = g * g * g * uAtmo * mix(1.0, 0.4 + 0.6 * max(0.0, facing), uLit) * (1.0 - uHaze);
  g = g * (1.0 - uK.x) + (1.0 - t) * (1.0 - t) * uK.y * 0.9;
  // WP-2.2: the focused world's atmosphere intensifies (and appears, softly,
  // on worlds that have none); defocused worlds' atmospheres recede.
  float fo = max(uK.w, 0.0);
  g = g * (1.0 + 0.8 * fo) + (1.0 - t) * (1.0 - t) * (1.0 - t) * 0.28 * fo;
  g *= 1.0 - 0.55 * max(-uK.w, 0.0);
  float sh = (1.0 - smoothstep(0.9, 1.26, length(d + uLight * 0.14))) * uShadowStr;
  float ga = g * (1.0 - 0.75 * uAtmoAdd);
  float oa = ga + sh * (1.0 - ga);
  float3 oc = uStatus * g + uShadow * sh * (1.0 - ga);
  return half4(half3(c * inside + oc * (1.0 - inside)), half(inside + oa * (1.0 - inside)));
}
`;

const SUN_CORONA = `
uniform float4 uS0;
uniform float4 uS1;
uniform float4 uS2;
uniform float4 uS3;
uniform float4 uS4;
half4 lbSun(float2 xy, float3 surf) {
  float2 d = xy / uS0.x;
  float l = length(d);
  float aa = uS0.y / uS0.x;
  float inside = clamp((1.0 - l) / aa + 0.5, 0.0, 1.0);
  float a01 = atan(d.y, d.x) / 6.2831853 + 0.5;
  float rot = uS0.z * 0.004;
  float o = max(0.0, l - 1.0);
  // Rays: two angular noise bands (periodic in angle) that also drift outward
  // with radius, so streamers look like they flow off the limb.
  float r1 = lbNoise(float2((a01 + rot) * 18.0, o * 1.6 - uS0.z * 0.06), 18.0);
  float r2 = lbNoise(float2((a01 - rot * 0.7) * 41.0, o * 3.0 - uS0.z * 0.1 + 7.0), 41.0);
  float rays = pow(0.62 * r1 + 0.38 * r2, 2.2) * 2.1;
  float edge = 1.0 - smoothstep(uS0.w * 0.62, uS0.w, l);
  float inner = exp(-o * 7.5);
  float halo = exp(-o * 2.4) * 0.55;
  float streamers = exp(-o * 2.0) * rays * 0.75;
  float limb = exp(-(o * o) / 0.0016) * 0.7;
  float g = (inner * 0.9 + halo + streamers + limb) * edge * uS2.a;
  float3 gc = mix(uS1.rgb, uS2.rgb, clamp(inner * 0.55 + limb * 0.6, 0.0, 1.0) * (0.25 + 0.75 * uS3.a));
  float ga = clamp(g, 0.0, 1.0) * (1.0 - 0.7 * uS3.a);
  float3 oc = gc * clamp(g, 0.0, 1.4);
  float3 outc = surf * inside + oc * (1.0 - inside);
  float aout = inside + ga * (1.0 - inside);
  // R1 glow cap (uS4.a > 0): the COMPOSITE stays under the cap. The output is
  // premultiplied-style (srcOver adds dst × (1 − a)), so the bright limb /
  // corona leave room for up to 0.2 of sky behind them (labb-bodies-logic.ts).
  if (uS4.a > 0.0) { outc = min(outc, float3(uS4.a - 0.2 * (1.0 - aout))); }
  return half4(half3(outc), half(aout));
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
  bodyPhoto: `${NEBULA_NOISE}${BODY_LIT}
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
uniform float4 uI;
uniform float4 uJ;
half4 main(float2 xy) {
  float3 uBase = uI.rgb;
  float3 uBand = uJ.rgb;
  float3 uHi = uF.rgb;
  float uPattern = uH.z;
  float uSeed = uH.w;
  float2 d = xy / uA.x;
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
  float2 d = xy / uS0.x;
  float nz = sqrt(max(0.0, 1.0 - dot(d, d)));
  // Granulation: domain-warped value noise on a rotated lattice (an
  // axis-aligned lattice reads as blocky squares at sun size).
  float2 q = float2(0.8 * d.x - 0.6 * d.y, 0.6 * d.x + 0.8 * d.y) * 8.0;
  float2 w = float2(lbNoise(q * 0.7 + float2(uS0.z * 0.03, 1.7), 64.0),
                    lbNoise(q * 0.7 + float2(4.1, -uS0.z * 0.025), 64.0));
  float g1 = lbNoise(q + 2.2 * w + float2(uS0.z * 0.05, 0.0), 64.0);
  float g2 = lbNoise(q * 2.3 - 1.5 * w + float2(0.0, uS0.z * 0.07), 64.0);
  float gran = smoothstep(0.15, 0.85, 0.65 * g1 + 0.35 * g2);
  float limb = pow(nz, 0.75);
  float3 star = mix(uS3.rgb, uS1.rgb, 0.25 + 0.75 * limb);
  star *= 0.9 + 0.15 * gran;
  star = mix(star, uS2.rgb, pow(nz, 2.5) * 0.5);
  float3 sw = uS4.rgb * (0.85 + 0.15 * limb);
  return lbSun(xy, mix(sw, star, uS1.a));
}
`,
  /**
   * WP-1.2 sun with a photo: the face is EMISSIVE (never darkened beyond a
   * whisper of limb darkening) inside r; the same corona outside.
   */
  sunPhoto: `${NEBULA_NOISE}${SUN_CORONA}
uniform shader uImage;
half4 main(float2 xy) {
  float2 d = xy / uS0.x;
  float nz = sqrt(max(0.0, 1.0 - dot(d, d)));
  float3 s = float3(uImage.eval(xy).rgb) * (0.9 + 0.1 * pow(nz, 0.5));
  return lbSun(xy, s);
}
`,
  /** WP-1.2 moon: a tiny lit sphere (token tone) with a specular glint. */
  moon: `
uniform float4 uM0;
uniform float4 uM1;
uniform float4 uM2;
uniform float4 uM3;
half4 main(float2 xy) {
  float2 d = xy / uM0.x;
  float l = length(d);
  float inside = clamp((1.0 - l) / (uM0.y / uM0.x) + 0.5, 0.0, 1.0);
  float nz = sqrt(max(0.0, 1.0 - l * l));
  float3 N = float3(d, nz);
  float3 L = normalize(float3(uM0.zw, 0.45));
  float lam = clamp(dot(N, L), 0.0, 1.0);
  float3 c = uM1.rgb * (uM1.a + (1.0 - uM1.a) * lam);
  float3 H = normalize(L + float3(0.0, 0.0, 1.0));
  c += uM2.rgb * pow(max(dot(N, H), 0.0), 20.0) * 0.6;
  c = mix(c, uM3.rgb, uM2.a);
  return half4(half3(c * inside), half(inside));
}
`,
  /**
   * WP-1.3 instrument stroke shader for orbits, wakes, tethers and ticks. It
   * paints a STROKE drawn in WORLD coordinates under the plane homography, so
   * `xy` is the world point on the plane (sun = origin, north = −y).
   *   uColor = status rgb, base alpha
   *   uHi    = flow highlight rgb, flow strength
   *   uCam   = cos yaw, sin yaw, tilt depth 0..1, zoom
   *   uStyle = mode (0 arc-dashed ring, 1 plain, 2 radial-dashed),
   *            dash period dp (0 = solid), dash duty, far-side alpha
   *   uFlow  = time s, flow on, comet length (world), comet speed (world/s)
   * Depth fade: the side of the plane away from the camera fades toward
   * `uStyle.w` in proportion to tilt. Dashes are integer per circumference so
   * there is no seam at north. Flow = 3 comets per ring, same LINEAR speed for
   * every status (never encodes status, C-04), clockwise.
   */
  ringInstrument: `
uniform float4 uColor;
uniform float4 uHi;
uniform float4 uCam;
uniform float4 uStyle;
uniform float4 uFlow;
uniform float4 uSpin;
half4 main(float2 p) {
  float tau = 6.2831853;
  float r = max(length(p), 0.0001);
  float v = (uCam.y * p.x + uCam.x * p.y) / r;
  float depth = mix(1.0, uStyle.w, uCam.z * (0.5 - 0.5 * v));
  float a = uColor.a * depth;
  float3 col = uColor.rgb;
  float ang = atan(p.x, -p.y);
  if (ang < 0.0) { ang += tau; }
  float zoom = max(uCam.w, 0.0001);
  float mask = 1.0;
  if (uStyle.y > 0.0) {
    float d = 0.0;
    float per = uStyle.y;
    if (uStyle.x < 0.5) {
      float circ = tau * r * zoom;
      float n = max(4.0, floor(circ / uStyle.y));
      per = circ / n;
      d = mod(ang * r * zoom, per);
    } else {
      d = mod(r * zoom, per);
    }
    float on = per * uStyle.z;
    mask = smoothstep(0.0, 0.7, d) * (1.0 - smoothstep(on - 0.7, on, d));
    a *= mask;
  }
  if (uStyle.x < 0.5 && uFlow.y > 0.5) {
    float seg = tau * r / 3.0;
    float u = fract((ang * r - uFlow.x * uFlow.w - uSpin.x * r) / seg + fract(r * 0.618034));
    float k = seg / max(uFlow.z, 1.0);
    float head = 1.0 - smoothstep(1.0 - 1.2 / (zoom * seg), 1.0, u);
    float comet = exp(-(1.0 - u) * k) * head * uHi.a * depth * mask * (1.0 + uSpin.y);
    col = mix(col, uHi.rgb, clamp(comet * 1.4, 0.0, 1.0));
    a = clamp(a + comet, 0.0, 1.0);
  }
  return half4(half3(col * a), half(a));
}
`,
  /**
   * WP-1.3 progress WAKE for one ring, painted on a stroked world circle (the
   * stroke is wider than the visible wake; the cross profile is soft).
   *   uColor = status rgb, peak alpha
   *   uWake  = body angle (0 = north, clockwise), ring radius, half width
   *            (world), far-side alpha
   *   uCam   = cos yaw, sin yaw, tilt depth, unused
   * Alpha rises from north to the body (a comet tail drawn backward along the
   * rail), ends crisply at the body, zero past it.
   */
  ringWake: `
uniform float4 uColor;
uniform float4 uWake;
uniform float4 uCam;
half4 main(float2 p) {
  float tau = 6.2831853;
  float r = max(length(p), 0.0001);
  float ang = atan(p.x, -p.y);
  if (ang < 0.0) { ang += tau; }
  float th = max(uWake.x, 0.0001);
  float t = clamp(ang / th, 0.0, 1.0);
  float inside = 1.0 - smoothstep(th - 0.004, th, ang);
  float across = 1.0 - smoothstep(0.0, max(uWake.z, 0.0001), abs(r - uWake.y));
  float v = (uCam.y * p.x + uCam.x * p.y) / r;
  float depth = mix(1.0, uWake.w, uCam.z * (0.5 - 0.5 * v));
  float a = uColor.a * (0.12 + 0.88 * t * t) * inside * across * depth;
  return half4(half3(uColor.rgb * a), half(a));
}
`,
  /**
   * WP-2.1 system-lock SHOCKWAVE on the world plane: painted on a world-space
   * circle under the plane homography (a projected ellipse in tilt). A crisp
   * instrument front line plus a soft glow trailing INSIDE the front.
   *   uShk  = front radius (world), glow band (world), strength, line width (world)
   *   uShkC = hue rgb, additive (1 dark) / ink (0 light)
   *   uShkH = highlight rgb, unused
   */
  switchShock: `
uniform float4 uShk;
uniform float4 uShkC;
uniform float4 uShkH;
half4 main(float2 p) {
  float r = length(p);
  float inside = (uShk.x - r) / max(uShk.y, 0.001);
  float glow = inside >= 0.0 ? exp(-inside * 2.4) * (1.0 - smoothstep(0.6, 1.0, inside)) : 0.0;
  float dl = (uShk.x - r) / max(uShk.w, 0.0001);
  float line = exp(-dl * dl);
  float3 col = uShkC.rgb * glow * 0.45 + mix(uShkC.rgb, uShkH.rgb, 0.55 * uShkC.a) * line;
  float a = clamp((glow * 0.3 + line) * uShk.z, 0.0, 1.0);
  return half4(half3(col * uShk.z), half(a));
}
`,
  /**
   * WP-2.1 EXPERIMENT (flag `fxShockFilter`, default off): a displacement
   * shockwave as a runtime IMAGE FILTER over the world layer (rings, Polaris,
   * bodies; labels stay outside). A radial lens ring pushes pixels outward ahead
   * of the front and pulls them behind it, with an optional chroma split and a
   * brightening band. Coordinates are LAYER pixels (the caller scales dp → px).
   *   uShock  = centre x, centre y, front radius, amplitude (px; 0 = identity)
   *   uShock2 = band half-width (px), chroma split, band brightening, unused
   */
  shockFilter: `
uniform shader image;
uniform float4 uShock;
uniform float4 uShock2;
half4 main(float2 xy) {
  if (uShock.w <= 0.0) {
    return image.eval(xy);
  }
  float2 d = xy - uShock.xy;
  float dist = length(d);
  float x = (dist - uShock.z) / max(uShock2.x, 1.0);
  float prof = x * exp(-x * x);
  float2 dir = d / max(dist, 0.001);
  float2 off = dir * prof * uShock.w;
  half4 c = image.eval(xy - off);
  if (uShock2.y > 0.0) {
    half4 r = image.eval(xy - off * (1.0 + uShock2.y));
    half4 b = image.eval(xy - off * (1.0 - uShock2.y));
    c = half4(r.r, c.g, b.b, c.a);
  }
  float ring = exp(-x * x * 2.0) * uShock2.z;
  return half4(c.rgb * half(1.0 + ring), c.a);
}
`,
} as const;

export type LabEffectName = keyof typeof LAB_EFFECT_SOURCES;

/** Effects drawn invisibly at mount so the GL program compile happens early.
 * Shader effects (drawn as a Fill paint shader) here; image-filter effects in
 * `WARMUP_FILTERS`. Uniforms come from `zeroUniforms` (every declared uniform,
 * zero-filled — a missing uniform throws on device). */
export const WARMUP_EFFECTS: readonly LabEffectName[] = ["probe"];
/** Transition-only IMAGE FILTER effects, warmed inside a tiny saveLayer. */
export const WARMUP_FILTERS: readonly LabEffectName[] = ["shockFilter"];

const UNIFORM_SIZES: Record<string, number> = {
  float: 1,
  half: 1,
  float2: 2,
  half2: 2,
  float3: 3,
  half3: 3,
  float4: 4,
  half4: 4,
};

/** Every declared (non-shader) uniform of an SkSL source, zero-filled. */
export function zeroUniforms(
  source: string,
): Record<string, number | number[]> {
  const out: Record<string, number | number[]> = {};
  for (const m of source.matchAll(
    /uniform\s+(float4|float3|float2|float|half4|half3|half2|half)\s+(\w+)\s*;/g,
  )) {
    const n = UNIFORM_SIZES[m[1]] ?? 1;
    out[m[2]] = n === 1 ? 0 : new Array(n).fill(0);
  }
  return out;
}

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
