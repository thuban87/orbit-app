/**
 * ORRERY LAB A — SkSL runtime shaders for the deep-field renderer.
 *
 * Colour policy: NO hue constant appears in any shader. Every colour is a
 * `half4` uniform fed from a ThemePalette token (premultiplied on output).
 * Numeric constants here are noise math, falloff shapes and intensities only.
 * (Helper names avoid the colour-function call shapes the colour gate greps for.)
 *
 * Compilation is LAZY and memoised (`labEffect`): never at module scope, because
 * `orrery-scene.test.ts` imports this tree with Skia mocked as `{}`. A failed
 * compile returns null and every consumer falls back to its plain rendering.
 */
import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

/**
 * Procedural nebula/dust (rendered ONCE into a cached texture, never per frame).
 * Domain-warped value-noise fbm, a soft diagonal galactic band, dark dust lanes.
 * Chart mode: a pale wash plus contour isolines of the same density field.
 */
export const NEBULA_SKSL = `
uniform float2 uSize;
uniform float uFreq;
uniform float uSeed;
uniform half4 uA;
uniform half4 uB;
uniform half4 uGlow;
uniform float uChart;
uniform float uAlpha;

float hash21(float2 p) {
  p = fract(p * float2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + float2(1.0, 0.0));
  float c = hash21(i + float2(0.0, 1.0));
  float d = hash21(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * vnoise(p);
    p = float2(p.x * 1.6 - p.y * 1.2, p.x * 1.2 + p.y * 1.6) + float2(11.7, 4.3);
    amp *= 0.5;
  }
  return v;
}

half4 main(float2 xy) {
  float2 uv = xy / uSize.y * uFreq + float2(uSeed, uSeed * 0.37);
  float2 warp = float2(fbm(uv), fbm(uv + float2(5.2, 1.3)));
  float n = fbm(uv + warp * 1.9);
  float m = fbm(uv * 2.3 - warp * 1.1 + float2(3.1, 7.7));
  float wisp = fbm(uv * 4.6 + warp * 2.4 + float2(1.9, 8.3));
  float2 c = xy / uSize - 0.5;
  float bandCoord = c.x * 0.8 - c.y * 0.6;
  float band = exp(-bandCoord * bandCoord * 6.0);
  float gas = smoothstep(0.34, 0.8, n) * (0.25 + 0.75 * band) * (0.45 + 0.9 * wisp);
  float core = smoothstep(0.58, 0.9, n * 0.6 + m * 0.45 + wisp * 0.12) * band;
  float lanes = smoothstep(0.48, 0.7, m) * smoothstep(0.35, 0.65, wisp) * band;
  if (uChart > 0.5) {
    float iso = abs(fract(n * 7.0) - 0.5);
    float line = (1.0 - smoothstep(0.0, 0.035, iso)) * smoothstep(0.36, 0.6, n);
    half3 wash = mix(uA.rgb, uB.rgb, half(smoothstep(0.3, 0.9, m)));
    float wa = clamp(gas * 0.9, 0.0, 1.0);
    float la = line * 0.3;
    float a = clamp(wa + la * (1.0 - wa), 0.0, 1.0);
    half3 col = (wash * half(wa) + uGlow.rgb * half(la * (1.0 - wa))) / half(max(a, 0.0001));
    float outA = a * uAlpha;
    return half4(col * half(outA), half(outA));
  }
  half3 col = mix(uA.rgb, uB.rgb, half(smoothstep(0.3, 0.85, m)));
  col = mix(col, uGlow.rgb, half(core * 0.42));
  float a = clamp(gas * 1.05 + core * 0.55, 0.0, 1.0) * (1.0 - lanes * 0.7);
  float outA = a * uAlpha;
  return half4(col * half(outA), half(outA));
}
`;

/**
 * The sun as a star: white-hot core → occupant glow hue corona whose edge is
 * shaped by cheap animated angular harmonics (no loops), plus a soft bloom.
 * Local coordinates (origin = sun centre, units = sun world radius space).
 * `uTime` is 0 under reduced motion (static corona); `uFlare` is the switch
 * capture flare (0 under reduced motion). Chart mode: engraved rays + rings.
 */
export const CORONA_SKSL = `
uniform float uR;
uniform float uTime;
uniform float uFlare;
uniform float uReach;
uniform float uChart;
uniform float uAlpha;
uniform half4 uCore;
uniform half4 uGlow;

half4 main(float2 p) {
  float d = length(p) / uR;
  float ang = atan(p.y, p.x);
  float t = uTime;
  float n = 0.5 + 0.22 * sin(ang * 7.0 + t * 1.3)
      + 0.16 * sin(ang * 13.0 - t * 1.9 + 1.7)
      + 0.12 * sin(ang * 29.0 + t * 2.6 + 4.1);
  float reach = 1.0 + (0.38 + 0.5 * n) * (1.0 + uFlare);
  float x = max(d - 1.0, 0.0);
  float fade = 1.0 - smoothstep(uReach * 0.72, uReach, d);
  if (uChart > 0.5) {
    float rays = pow(abs(cos(ang * 12.0 + t * 0.15)), 60.0);
    float rayLen = 1.0 - smoothstep(1.0, reach + 0.55, d);
    float rings = 1.0 - smoothstep(0.0, 0.05, abs(fract(d * 3.0) - 0.5));
    float ringMask = (1.0 - smoothstep(1.2, uReach * 0.85, d)) * step(1.0, d);
    float wash = (1.0 - smoothstep(1.0, reach, d)) * 0.28;
    float a = clamp(rays * rayLen * 0.75 + rings * ringMask * 0.35 + wash, 0.0, 1.0);
    a *= fade * uAlpha;
    half3 col = mix(uGlow.rgb, uCore.rgb, half(0.65));
    return half4(col * half(a), half(a));
  }
  float corona = clamp(1.0 - x / (reach - 1.0), 0.0, 1.0);
  corona = corona * corona * corona;
  float bloom = exp(-x * 1.25) * (0.5 + 0.5 * uFlare);
  float hot = clamp(corona * 1.1 - 0.15, 0.0, 1.0);
  half3 col = mix(uGlow.rgb, uCore.rgb, half(hot));
  float a = clamp(corona * 0.9 + bloom * 0.55, 0.0, 1.0) * fade * uAlpha;
  return half4(col * half(a), half(a));
}
`;

/**
 * One draw per body, over the photo/initials disc, on a circle of radius
 * `uR × uHaloReach`:
 *   inside r  → sun-facing lighting (terminator shadow, limb darkening, rim
 *               light in the status hue, far-depth tint) — an OVERLAY, so the
 *               photo itself is never resampled and stays recognisable;
 *   outside r → a thin atmosphere halo in the status hue (dark) or a crisp ink
 *               hairline (chart), stronger on the sun-facing side.
 */
export const BODY_SKSL = `
uniform float uR;
uniform float2 uL;
uniform float uFar;
uniform float uAA;
uniform float uShadowMax;
uniform float uRimGain;
uniform float uHaloAlpha;
uniform float uHaloReach;
uniform float uChart;
uniform half4 uShade;
uniform half4 uRim;
uniform half4 uFarTint;

half4 main(float2 p) {
  float2 q = p / uR;
  float d = length(q);
  float aa = max(uAA / uR, 0.002);
  float facing = dot(q / max(d, 0.0001), uL);
  if (d <= 1.0) {
    float z = sqrt(max(0.0, 1.0 - d * d));
    float3 l = normalize(float3(uL * 0.9, 0.42));
    float ndl = dot(float3(q, z), l);
    float night = 1.0 - smoothstep(-0.32, 0.3, ndl);
    float limb = smoothstep(0.72, 1.0, d) * 0.45;
    float shadeA = clamp((night + limb * 0.6) * uShadowMax, 0.0, 1.0);
    float farA = uFar * (1.0 - shadeA);
    float rim = pow(clamp(1.0 - z, 0.0, 1.0), 1.7)
      * smoothstep(-0.05, 0.75, facing) * uRimGain;
    float edge = 1.0 - smoothstep(1.0 - aa, 1.0, d);
    rim = clamp(rim, 0.0, 1.0) * edge;
    float baseA = (shadeA + farA) * edge;
    half3 baseC = uShade.rgb * half(shadeA * edge) + uFarTint.rgb * half(farA * edge);
    half3 col = uRim.rgb * half(rim) + baseC * half(1.0 - rim);
    float a = rim + baseA * (1.0 - rim);
    return half4(col, half(a));
  }
  float x = (d - 1.0) / (uHaloReach - 1.0);
  if (x >= 1.0) return half4(0.0);
  float side = 0.5 + 0.5 * smoothstep(-0.6, 0.8, facing);
  float halo;
  if (uChart > 0.5) {
    float ringD = abs(d - 1.0 - aa * 1.8);
    float ring = 1.0 - smoothstep(aa * 0.5, aa * 1.5, ringD);
    halo = ring * 0.85 + (1.0 - x) * (1.0 - x) * 0.1 * side;
  } else {
    float k = 1.0 - x;
    halo = k * k * k * side;
  }
  float a = clamp(halo * uHaloAlpha * (1.0 - uFar * 0.7), 0.0, 1.0);
  return half4(uRim.rgb * half(a), half(a));
}
`;

const SOURCES = {
  nebula: NEBULA_SKSL,
  corona: CORONA_SKSL,
  body: BODY_SKSL,
} as const;
export type LabEffectName = keyof typeof SOURCES;

const cache: Partial<Record<LabEffectName, SkRuntimeEffect | null>> = {};

/** Lazily compiled, memoised effect; null when unavailable or compile fails. */
export function labEffect(name: LabEffectName): SkRuntimeEffect | null {
  if (name in cache) return cache[name] ?? null;
  const factory = (
    Skia as
      | {
          RuntimeEffect?: { Make?: (s: string) => SkRuntimeEffect | null };
        }
      | undefined
  )?.RuntimeEffect;
  if (!factory || typeof factory.Make !== "function") return null;
  let effect: SkRuntimeEffect | null = null;
  try {
    effect = factory.Make(SOURCES[name]);
  } catch {
    effect = null;
  }
  cache[name] = effect;
  return effect;
}
