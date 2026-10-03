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
 * - uN > 0 dashes the ring into uN equal world-angle periods (half on, half
 *   off), clockwise from north, like today's 6-on-6-off dash.
 * The output is premultiplied: ink × (ink alpha · uAlpha · coverage).
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

half4 main(float2 u) {
  const float TAU = 6.2831853;
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
  if (uN > 0.5) {
    float an = mod(atan(p.x, -p.y) + TAU, TAU);
    if (fract(an / TAU * uN) >= 0.5) return half4(0.0);
  }
  half a = uInk.a * half(uAlpha * cover);
  return half4(uInk.rgb * a, a);
}
`;

export type OrreryShaderId = "ringPlane";

const SOURCES: Record<OrreryShaderId, string> = {
  ringPlane: RING_PLANE_SKSL,
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
