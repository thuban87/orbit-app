/**
 * 38.7-06 (D-44): the V2 SkSL sources and their lazy RuntimeEffect cache.
 *
 * Sources are STATIC module strings; only numeric uniforms vary (T-38.7-06-01).
 * They carry no colour literal: every ink arrives as a `half4` uniform built
 * from a theme token on the JS side (`scene-specs.ts`, check:colors).
 */
import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

/**
 * One orbit ring, drawn in WORLD space under the camera homography.
 *
 * The geometry is a cached UNIT annulus strip (`SkVertices`) drawn under
 * H·S(uR), so the local coordinate `u` is a unit-ring coordinate and
 * p = u · uR is the world point. Nothing is stroked (no stroke under a
 * perspective matrix — the Mali cliff); the line is analytic:
 * - the screen-dp distance to the ring is |r − uR| times the radial derivative
 *   of the projection at p (the Jacobian of H), so the line keeps a constant
 *   screen width at any tilt and zoom, with a one-device-pixel AA feather
 *   (uAA = dp per device pixel);
 * - fragments at or beyond the camera's near plane (homogeneous depth
 *   w ≤ uEps, the projection's HORIZON_EPSILON) are never drawn;
 * - uN > 0 dashes the ring into uN equal world-angle periods, `uDuty` of each
 *   on, clockwise from north (38.7-09: Lab B's dash and trace duties, D-11).
 *
 * 38.7-09 (D-11) Lab B's thin SUN-LIT line:
 * - sun light (uLit.x gain, uLit.y radius in world units, uLit.z ink mix):
 *   rings near the sun brighten (alpha × (1 + gain·e^(−r/radius))) and lean
 *   toward the ring-light ink `uLight` (`orreryRingLight`), as if lit by the
 *   star; gain 0 = off;
 * - depth: the side of the plane away from the camera fades toward uLit.w in
 *   proportion to the perspective across the ring (none when flat).
 * The status colour and the solid / dashed / faded / faint-trace ladder stay
 * the non-colour cue (alpha and dashes come from the status).
 *
 * 38.7-09 (D-10) pulse arc: uArc.y > 0 limits the ring to a soft window of
 * half-length uArc.y radians centred on uArc.x (clockwise from north), so the
 * same shader draws the subtle orbit pulses (never baked).
 *
 * The output is premultiplied: ink × (ink alpha · alpha · coverage).
 * Uniform order is mirrored by `ringPlaneUniforms` (draw-plane.ts).
 */
export const RING_PLANE_SKSL = `
uniform float3 uH0;
uniform float3 uH1;
uniform float3 uH2;
uniform float uR;
uniform float uHalfW;
uniform float uAA;
uniform float uN;
uniform float uEps;
uniform float uAlpha;
uniform half4 uInk;
uniform float uDuty;
uniform float4 uLit;
uniform half4 uLight;
uniform float4 uArc;

half4 main(float2 u) {
  const float TAU = 6.2831853;
  const float PI = 3.14159265;
  float2 p = u * uR;
  float r = length(p);
  if (r < 0.0001) return half4(0.0);
  float3 q = float3(p, 1.0);
  float w = dot(uH2, q);
  if (w <= uEps) return half4(0.0);
  float sx = dot(uH0, q) / w;
  float sy = dot(uH1, q) / w;
  float2 d = p / r;
  float2 j = float2(dot(uH0.xy, d) - sx * dot(uH2.xy, d),
                    dot(uH1.xy, d) - sy * dot(uH2.xy, d)) / w;
  float dist = abs(r - uR) * length(j);
  float cover = clamp((uHalfW - dist) / uAA + 0.5, 0.0, 1.0);
  if (cover <= 0.0) return half4(0.0);
  float an = mod(atan(p.x, -p.y) + TAU, TAU);
  if (uN > 0.5) {
    if (fract(an / TAU * uN) >= uDuty) return half4(0.0);
  }
  float a = uAlpha * cover;
  if (uArc.y > 0.0) {
    float da = abs(mod(an - uArc.x + PI, TAU) - PI);
    float m = 1.0 - smoothstep(0.0, uArc.y, da);
    a *= m * m;
    if (a <= 0.0) return half4(0.0);
  }
  float g = length(uH2.xy);
  if (uLit.w < 1.0 && g > 0.0) {
    float farSide = 0.5 + 0.5 * dot(uH2.xy / g, d);
    float amount = clamp(2.0 * r * g / max(uH2.z, 0.0001), 0.0, 1.0);
    a *= mix(1.0, uLit.w, farSide * amount);
  }
  float3 col = float3(uInk.rgb);
  if (uLit.x > 0.0) {
    float lit = uLit.x * exp(-r / max(uLit.y, 1.0));
    col = mix(col, float3(uLight.rgb), clamp(lit * uLit.z, 0.0, 0.5));
    a *= 1.0 + lit;
  }
  float ia = clamp(float(uInk.a) * a, 0.0, 1.0);
  return half4(half3(col * ia), half(ia));
}
`;

/**
 * 38.7-09 (D-09): the optional orbital-plane grid in Lab C's style — polar
 * guide circles and radial spokes (spokes fainter, fading in away from the
 * sun), edge-faded toward the grid's reach — as ONE analytic draw in WORLD
 * space under the camera homography. The geometry is a cached UNIT disc fan
 * drawn under H·S(uReach), so p = u · uReach is the world point. Lines keep a
 * constant screen width through the same Jacobian as the rings; fragments at
 * or beyond the near plane are discarded (horizon-safe); the far side fades
 * like the rings (uFar). uAlpha 0 is never drawn (the caller skips it).
 * Uniform order is mirrored by `gridPlaneUniforms` (draw-plane.ts).
 */
export const GRID_PLANE_SKSL = `
uniform float3 uH0;
uniform float3 uH1;
uniform float3 uH2;
uniform float uReach;
uniform float uHalfW;
uniform float uAA;
uniform float uEps;
uniform float uRings;
uniform float uSpokes;
uniform float uAlpha;
uniform float uFar;
uniform half4 uInk;

half4 main(float2 u) {
  const float TAU = 6.2831853;
  float2 p = u * uReach;
  float r = length(p);
  if (r < 0.0001) return half4(0.0);
  float3 q = float3(p, 1.0);
  float w = dot(uH2, q);
  if (w <= uEps) return half4(0.0);
  float sx = dot(uH0, q) / w;
  float sy = dot(uH1, q) / w;
  float2 jx = (uH0.xy - sx * uH2.xy) / w;
  float2 jy = (uH1.xy - sy * uH2.xy) / w;
  float2 rd = p / r;
  float2 td = float2(-rd.y, rd.x);
  float sr = length(float2(dot(jx, rd), dot(jy, rd)));
  float st = length(float2(dot(jx, td), dot(jy, td)));
  float t = r / uReach;
  float edge = 1.0 - smoothstep(0.75, 1.0, t);
  if (edge <= 0.0) return half4(0.0);
  float gap = uReach / max(uRings, 1.0);
  float k = floor(r / gap + 0.5);
  float ring = 0.0;
  if (k >= 1.0) {
    ring = clamp((uHalfW - abs(r - k * gap) * sr) / uAA + 0.5, 0.0, 1.0);
  }
  float spoke = 0.0;
  if (uSpokes > 0.5) {
    float an = mod(atan(p.x, -p.y) + TAU, TAU);
    float sp = TAU / uSpokes;
    float m = floor(an / sp + 0.5) * sp;
    spoke = clamp((uHalfW - r * abs(sin(an - m)) * st) / uAA + 0.5, 0.0, 1.0)
        * smoothstep(0.12, 0.3, t) * 0.6;
  }
  float a = max(ring, spoke) * edge * uAlpha;
  float g = length(uH2.xy);
  if (uFar < 1.0 && g > 0.0) {
    float farSide = 0.5 + 0.5 * dot(uH2.xy / g, rd);
    float amount = clamp(2.0 * r * g / max(uH2.z, 0.0001), 0.0, 1.0);
    a *= mix(1.0, uFar, farSide * amount);
  }
  float ia = clamp(float(uInk.a) * a, 0.0, 1.0);
  if (ia <= 0.0) return half4(0.0);
  return half4(uInk.rgb * half(ia), half(ia));
}
`;

export type OrreryShaderId = "ringPlane" | "gridPlane";

const SOURCES: Record<OrreryShaderId, string> = {
  ringPlane: RING_PLANE_SKSL,
  gridPlane: GRID_PLANE_SKSL,
};

const cache: Partial<Record<OrreryShaderId, SkRuntimeEffect | null>> = {};
const reported = new Set<OrreryShaderId>();

/**
 * The compiled effect for `id`, compiled once (JS thread) and cached; null
 * when the runtime cannot compile it (the renderer then skips that layer).
 * A failure is logged once, in development only.
 */
export function orreryShader(id: OrreryShaderId): SkRuntimeEffect | null {
  if (id in cache) return cache[id] ?? null;
  let effect: SkRuntimeEffect | null = null;
  try {
    effect = Skia?.RuntimeEffect?.Make?.(SOURCES[id]) ?? null;
  } catch {
    effect = null;
  }
  cache[id] = effect;
  const dev = typeof __DEV__ !== "undefined" && __DEV__;
  if (!effect && dev && !reported.has(id)) {
    reported.add(id);
    console.warn(`[orrery] ${id} shader failed to compile; layer skipped`);
  }
  return effect;
}

/** Test seam: forget compiled effects (a fresh Skia mock per test). */
export function resetOrreryShaderCache(): void {
  for (const id of Object.keys(cache) as OrreryShaderId[]) delete cache[id];
  reported.clear();
}
