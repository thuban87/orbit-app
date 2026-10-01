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

// Pass 1: the direction-1 NEBULA_SKSL (value-noise fbm) was removed — it
// faceted on the Pixel's Mali GPU. The nebula is now CPU-baked
// (nebula-bake.ts). See DEAD-ENDS / _notes/PASS-1.md.

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
 * PASS 1 — the sun's DISC as a star (drawn over the occupant disc, local
 * coords centred on the sun, radius uR). All coordinates are O(1) (q = p/uR)
 * so the trig granulation is precision-safe on mediump GPUs too.
 *   uPhoto = 0 → opaque stellar surface: white-hot core (uCore) grading to the
 *               occupant glow hue (uGlow) at the limb, limb darkening, slow
 *               granulation (uTime is fixed under reduced motion).
 *   uPhoto = 1 → the occupant photo stays the identity: only a glowing limb
 *               band frames it (transparent centre).
 * Chart mode passes a paper core so the star reads as an engraved disc.
 */
export const SUN_DISC_SKSL = `
uniform float uR;
uniform float uTime;
uniform float uPhoto;
uniform float uAA;
uniform half4 uCore;
uniform half4 uGlow;

half4 main(float2 p) {
  float2 q = p / uR;
  float d = length(q);
  float aa = max(uAA / uR, 0.002);
  float edge = 1.0 - smoothstep(1.0 - aa, 1.0, d);
  if (edge <= 0.0) return half4(0.0);
  float t = uTime;
  float ang = atan(q.y, q.x);
  // Granulation: incommensurate low-amplitude cells (no single stripe axis).
  float g = sin(q.x * 11.3 + sin(q.y * 7.1 + t * 0.4) * 1.7 + t * 0.5)
      * sin(q.y * 12.7 + sin(q.x * 6.3 - t * 0.3) * 1.9 - t * 0.37)
      + 0.45 * sin(ang * 5.0 + d * 9.0 - t * 0.3);
  g = g / 1.45;
  float mu = sqrt(max(0.0, 1.0 - d * d));
  // White-hot centre → occupant hue toward the limb, limb-darkened.
  float heat = pow(mu, 1.6);
  half3 col = mix(uGlow.rgb, uCore.rgb, half(heat));
  col = col * half(0.55 + 0.45 * pow(mu, 0.5));
  col = col + uCore.rgb * half(0.35 * pow(mu, 6.0));
  col = col * half(1.0 + 0.045 * g * mu);
  if (uPhoto > 0.5) {
    float band = smoothstep(0.74, 0.97, d);
    half3 bandCol = mix(uGlow.rgb, uCore.rgb, half(0.35 * (1.0 - band)));
    float a = band * 0.92 * edge;
    return half4(bandCol * half(a), half(a));
  }
  return half4(col * half(edge), half(edge));
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
uniform float uEdgeLit;
uniform float uEdgeNight;
uniform float uSpec;
uniform half4 uShade;
uniform half4 uRim;
uniform half4 uFarTint;
uniform half4 uSpecInk;

half4 main(float2 p) {
  float2 q = p / uR;
  float d = length(q);
  float aa = max(uAA / uR, 0.002);
  float facing = dot(q / max(d, 0.0001), uL);
  float lit = smoothstep(-0.35, 0.65, facing);
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
    // Crisp edge line in the status hue: the body's status ring, brighter on
    // the lit side (pass 1 — replaces the 1.5 px rim as the status cue).
    float edgeW = max(aa * 2.2, 0.085);
    float edgeLine = smoothstep(1.0 - edgeW - aa, 1.0 - edgeW, d);
    float edgeK = edgeLine * mix(uEdgeNight, uEdgeLit, lit);
    float edge = 1.0 - smoothstep(1.0 - aa, 1.0, d);
    rim = clamp(max(rim, edgeK), 0.0, 1.0) * edge;
    // Soft specular: a sphere cue on the sun-facing hemisphere.
    float2 hp = uL * 0.42;
    float spec = exp(-dot(q - hp, q - hp) * 9.0) * uSpec * (1.0 - night);
    float baseA = (shadeA + farA) * edge;
    half3 baseC = uShade.rgb * half(shadeA * edge) + uFarTint.rgb * half(farA * edge);
    half3 col = uRim.rgb * half(rim) + baseC * half(1.0 - rim);
    float a = rim + baseA * (1.0 - rim);
    float sa = spec * edge * (1.0 - rim);
    col = col * half(1.0 - sa) + uSpecInk.rgb * half(sa);
    a = a + sa * (1.0 - a);
    return half4(col, half(a));
  }
  float x = (d - 1.0) / (uHaloReach - 1.0);
  if (x >= 1.0) return half4(0.0);
  float side = 0.45 + 0.55 * lit;
  float halo;
  if (uChart > 0.5) {
    float ringD = abs(d - 1.0 - aa * 1.8);
    float ring = 1.0 - smoothstep(aa * 0.5, aa * 1.5, ringD);
    halo = ring * 0.85 + (1.0 - x) * (1.0 - x) * 0.12 * side;
  } else {
    // Atmosphere: a bright thin inner band + a long soft falloff.
    float k = 1.0 - x;
    halo = (k * k * k * 0.75 + exp(-x * 9.0) * 0.45) * side;
  }
  float a = clamp(halo * uHaloAlpha * (1.0 - uFar * 0.7), 0.0, 1.0);
  return half4(uRim.rgb * half(a), half(a));
}
`;

const SOURCES = {
  corona: CORONA_SKSL,
  sunDisc: SUN_DISC_SKSL,
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
