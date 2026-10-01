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
uniform float uFlare;
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
  float mu = sqrt(max(0.0, 1.0 - d * d));
  // PASS 2 granulation: three incommensurate octaves of warped sine cells on
  // the sphere (q / (0.35 + mu) "wraps" cells toward the limb), all O(1)
  // coordinates — no hashing, mediump-safe. Low amplitude: texture, not noise.
  float2 s = q / (0.35 + mu);
  float g1 = sin(s.x * 9.1 + sin(s.y * 6.3 + t * 0.41) * 1.8 + t * 0.53)
      * sin(s.y * 10.7 + sin(s.x * 5.9 - t * 0.33) * 1.7 - t * 0.37);
  float g2 = sin(s.x * 23.0 + s.y * 7.0 + sin(s.y * 17.0 - t * 0.7) * 1.3)
      * sin(s.y * 21.0 - s.x * 6.0 + sin(s.x * 15.0 + t * 0.6) * 1.2);
  float g3 = sin(ang * 5.0 + d * 9.0 - t * 0.3);
  float g = (g1 * 0.6 + g2 * 0.28 + g3 * 0.25) / 1.13;
  // Bright intergranular network: emphasise cell edges a little.
  float cells = 1.0 - abs(g1);
  // White-hot centre → occupant hue toward the limb, limb-darkened.
  float heat = pow(mu, 1.6 - 0.6 * uFlare);
  half3 col = mix(uGlow.rgb, uCore.rgb, half(heat));
  col = col * half(0.5 + 0.5 * pow(mu, 0.55));
  col = col + uCore.rgb * half((0.35 + 0.4 * uFlare) * pow(mu, 6.0));
  col = col * half(1.0 + (0.07 * g + 0.05 * cells - 0.025) * mu);
  // Limb: a thin brighter chromosphere band in the occupant hue.
  float limb = smoothstep(0.86, 0.99, d) * (1.0 - smoothstep(0.99, 1.0, d));
  col = col + uGlow.rgb * half(0.22 * limb);
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
uniform half4 uKey;
uniform float uGap;
uniform float uKeyAlpha;

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
  // PASS 2 separation keyline: a thin background-ink cut just outside the
  // disc. Bodies draw near-over-far (zIndex = depth), so where a nearer body
  // overlaps a farther one this line cuts the farther disc → two discs read
  // as two (co-angular stacks), without moving anything.
  float key = (1.0 - smoothstep(1.0 + uGap, 1.0 + uGap + aa, d))
      * smoothstep(1.0, 1.0 + aa * 0.5, d) * uKeyAlpha;
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
  half4 haloC = half4(uRim.rgb * half(a), half(a));
  return mix(haloC, half4(uKey.rgb, 1.0), half(key));
}
`;

/**
 * PASS 2 — every orbit ring stroke as ONE analytic shader on a tight,
 * GPU-friendly geometry (the ring's closed convex projected polygon, stroked
 * without a path effect). On the Pixel, ellipse ops (bounding-quad geometry)
 * and per-ring 4-stop sweep gradients made the plane fragment-bound
 * (~150 ms/frame); dashes as path effects forced CPU path masks.
 * Coordinates are SCREEN space. Angles are screen angles about the
 * projected ring centre `uC` (0 = up, clockwise).
 *   uMode 0 → hairline: far→near ink ramp between screen points uFar/uNear
 *             (alpha uFarA at the far side; tint uInkFar → uInkNear);
 *   uMode 1 → status segment: 0 before uStart, ramp to 1 at uBody (soft
 *             first half when uDir = 1), back to 0 at uSpan, in uInk.
 *   uN > 0  → dashes: uN on/off pairs around the ring (the canonical dash
 *             channel for wobble + rogue).
 *   uReveal < TAU → ink-in: only [uNorth, uNorth + uReveal] is drawn.
 * Only differences of screen coordinates are used (O(100–1000) px, float):
 * precision-safe on mediump-heavy GPUs; no hashing anywhere.
 */
export const RING_SKSL = `
uniform float2 uC;
uniform float uMode;
uniform float uN;
uniform float uNorth;
uniform float uReveal;
uniform float2 uFar;
uniform float2 uNear;
uniform float uFarA;
uniform float uStart;
uniform float uBody;
uniform float uSpan;
uniform float uDir;
uniform half4 uInkFar;
uniform half4 uInkNear;

half4 main(float2 p) {
  const float TAU = 6.2831853;
  float2 d = p - uC;
  float an = mod(atan(d.x, -d.y) + TAU, TAU);
  if (uN > 0.5 && fract(an / TAU * uN) >= 0.5) return half4(0.0);
  if (uReveal < TAU && mod(an - uNorth + TAU, TAU) > uReveal) return half4(0.0);
  if (uMode < 0.5) {
    float2 fn = uNear - uFar;
    float t = clamp(dot(p - uFar, fn) / max(dot(fn, fn), 0.0001), 0.0, 1.0);
    float a = mix(uFarA, 1.0, t);
    return mix(uInkFar, uInkNear, half(t)) * half(a);
  }
  float rel = mod(an - uStart + TAU, TAU);
  if (rel > uSpan) return half4(0.0);
  float lo = uDir > 0.5 ? 0.18 : 0.5;
  float k;
  if (rel < uBody) {
    float t = rel / max(uBody, 0.0001);
    k = t < 0.5 ? lo * t * 2.0 : mix(lo, 1.0, (t - 0.5) * 2.0);
  } else {
    k = 1.0 - (rel - uBody) / max(uSpan - uBody, 0.0001);
  }
  return uInkNear * half(clamp(k, 0.0, 1.0));
}
`;

/**
 * CAMERA PERF PASS — one orbit ring (hairline + status segment) drawn in
 * WORLD space under the camera homography: the geometry is a cached UNIT
 * annulus strip (`SkVertices`, built once) drawn under H·S(uR), so local
 * coordinates are unit-ring coordinates and p = u·uR is the world point.
 * Nothing is tessellated on the CPU (no stroke → no Ganesh path renderer);
 * the stroke is analytic:
 *   - the screen-dp distance to the ring is |r − uR| × the radial derivative
 *     of the projection at p (the Jacobian of H, exact per pixel), so widths
 *     stay CONSTANT SCREEN dp (the 2/3/4 width channel) with a 1-device-px
 *     AA feather (uAA = dp per device pixel), at any tilt/zoom;
 *   - angles are WORLD angles about the sun (0 = north, clockwise), so the
 *     status segment, dashes and ink-in reveal are exact on the plane;
 *   - far→near ink/alpha ramp along the world near direction (uNearDir).
 * Hairline + segment are one draw: segment composited over hairline (the
 * previous two src-over draws, in the same order).
 * Uniform block order is mirrored by `ringWorldUniforms` (world-plane.ts).
 */
export const RING_WORLD_SKSL = `
uniform float3 uH0;
uniform float3 uH1;
uniform float3 uH2;
uniform float uR;
uniform float uAA;
uniform float uN;
uniform float uReveal;
uniform float2 uNearDir;
uniform float uFarA;
uniform float uHairW;
uniform float uHairA;
uniform half4 uInkFar;
uniform half4 uInkNear;
uniform float uSegW;
uniform float uSegA;
uniform float uStart;
uniform float uBody;
uniform float uSpan;
uniform float uDir;
uniform half4 uSegInk;

half4 main(float2 u) {
  const float TAU = 6.2831853;
  float2 p = u * uR;
  float r = length(p);
  if (r < 0.0001) return half4(0.0);
  float an = mod(atan(p.x, -p.y) + TAU, TAU);
  if (uN > 0.5 && fract(an / TAU * uN) >= 0.5) return half4(0.0);
  if (uReveal < TAU && an > uReveal) return half4(0.0);
  float3 q = float3(p, 1.0);
  float w = dot(uH2, q);
  float sx = dot(uH0, q) / w;
  float sy = dot(uH1, q) / w;
  float2 d = p / r;
  float2 j = float2(dot(uH0.xy, d) - sx * dot(uH2.xy, d),
                    dot(uH1.xy, d) - sy * dot(uH2.xy, d)) / w;
  float dist = abs(r - uR) * length(j);
  float hc = clamp((uHairW - dist) / uAA + 0.5, 0.0, 1.0);
  float t = clamp((dot(p, uNearDir) / uR + 1.0) * 0.5, 0.0, 1.0);
  half4 hair = mix(uInkFar, uInkNear, half(t)) * half(mix(uFarA, 1.0, t) * uHairA * hc);
  if (uSegW <= 0.0) return hair;
  float rel = mod(an - uStart + TAU, TAU);
  if (rel > uSpan) return hair;
  float lo = uDir > 0.5 ? 0.18 : 0.5;
  float k;
  if (rel < uBody) {
    float tt = rel / max(uBody, 0.0001);
    k = tt < 0.5 ? lo * tt * 2.0 : mix(lo, 1.0, (tt - 0.5) * 2.0);
  } else {
    k = 1.0 - (rel - uBody) / max(uSpan - uBody, 0.0001);
  }
  float sc = clamp((uSegW - dist) / uAA + 0.5, 0.0, 1.0);
  half4 seg = uSegInk * half(clamp(k, 0.0, 1.0) * uSegA * sc);
  return seg + hair * (1.0 - seg.a);
}
`;

/**
 * CAMERA PERF PASS — the whole reference grid (fading reference circles,
 * spokes, double bezel, graduated tick dial) as ONE analytic draw in WORLD
 * space under the camera homography (a cached unit disc fan under
 * H·S(uS); p = u·uS is the world point). Same Jacobian-based screen-dp
 * strokes + 1-device-px AA as RING_WORLD_SKSL, so line widths stay constant
 * screen dp at any tilt/zoom; elements are composited src-over in the
 * previous draw order (circles → spokes → bezel → ticks). Ink: uInk (token).
 * Uniform order is mirrored by `gridUniforms` (world-plane.ts).
 */
export const GRID_SKSL = `
uniform float3 uH0;
uniform float3 uH1;
uniform float3 uH2;
uniform float uS;
uniform float uAA;
uniform float uHalf;
uniform float uReach;
uniform float uStep;
uniform float uInner;
uniform float uOuter;
uniform float uBezelA;
uniform float uSpokeStep;
uniform float uTickStep;
uniform float uSpin;
uniform float uMinor;
uniform float uMajor;
uniform half4 uInk;

half4 over(half4 dst, float a) {
  half4 src = uInk * half(a);
  return src + dst * (1.0 - src.a);
}

half4 main(float2 u) {
  const float TAU = 6.2831853;
  float2 p = u * uS;
  float r = length(p);
  if (r < 0.0001) return half4(0.0);
  float3 q = float3(p, 1.0);
  float w = dot(uH2, q);
  float sx = dot(uH0, q) / w;
  float sy = dot(uH1, q) / w;
  float2 jx = (uH0.xy - sx * uH2.xy) / w;
  float2 jy = (uH1.xy - sy * uH2.xy) / w;
  float2 rd = p / r;
  float2 td = float2(-rd.y, rd.x);
  float sr = length(float2(dot(jx, rd), dot(jy, rd)));
  float st = length(float2(dot(jx, td), dot(jy, td)));
  float an = mod(atan(p.x, -p.y) + TAU, TAU);
  half4 o = half4(0.0);
  // Reference circles (alpha fades outward per circle).
  float k = floor(r / uStep + 0.5);
  float cr = k * uStep;
  if (k >= 1.0 && cr < uReach) {
    float c = clamp((uHalf - abs(r - cr) * sr) / uAA + 0.5, 0.0, 1.0);
    float f = clamp((cr / uReach - 0.1) / 0.9, 0.0, 1.0);
    o = over(o, min(1.0, uInner + (uOuter - uInner) * f) * c);
  }
  // Spokes: inner → outer ramp, butt ends.
  float r0 = uStep * 0.6;
  if (r > r0 - uStep && r < uReach + uStep) {
    float m = floor(an / uSpokeStep + 0.5) * uSpokeStep;
    float c = clamp((uHalf - r * abs(sin(an - m)) * st) / uAA + 0.5, 0.0, 1.0);
    float ends = clamp((r - r0) * sr / uAA + 0.5, 0.0, 1.0)
        * clamp((uReach - r) * sr / uAA + 0.5, 0.0, 1.0);
    float t = clamp((r - r0) / (uReach - r0), 0.0, 1.0);
    o = over(o, min(1.0, mix(uInner, uOuter, t)) * c * ends);
  }
  // Bezel: double ring.
  float b2 = uReach + uMajor * 1.1;
  float cb = max(clamp((uHalf - abs(r - uReach) * sr) / uAA + 0.5, 0.0, 1.0),
                 clamp((uHalf - abs(r - b2) * sr) / uAA + 0.5, 0.0, 1.0));
  o = over(o, uBezelA * cb);
  // Graduated ticks (every 5th major), swinging with the switch spin.
  if (r > uReach - uStep && r < uReach + uMajor + uStep) {
    float idx = floor((an - uSpin) / uTickStep + 0.5);
    float m = idx * uTickStep + uSpin;
    float len = mod(mod(idx, 120.0) + 120.0, 5.0) < 0.5 ? uMajor : uMinor;
    float c = clamp((uHalf - r * abs(sin(an - m)) * st) / uAA + 0.5, 0.0, 1.0);
    float ends = clamp((r - uReach) * sr / uAA + 0.5, 0.0, 1.0)
        * clamp((uReach + len - r) * sr / uAA + 0.5, 0.0, 1.0);
    o = over(o, uBezelA * c * ends);
  }
  return o;
}
`;

const SOURCES = {
  corona: CORONA_SKSL,
  sunDisc: SUN_DISC_SKSL,
  body: BODY_SKSL,
  ring: RING_SKSL,
  ringWorld: RING_WORLD_SKSL,
  grid: GRID_SKSL,
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
