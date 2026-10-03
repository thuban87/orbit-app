/**
 * 38.7-06 (D-44): the world plane — tilted orbit rings drawn under the exact
 * camera homography, never stroked under perspective.
 *
 * Each ring is ONE `drawVertices` of a cached unit annulus strip (built once on
 * the JS thread) under H·S(R), shaded by `RING_PLANE_SKSL`, which draws the
 * line analytically at a constant screen width. The homography comes from the
 * frame's own clamped pose, so the drawn ring is the ring the hit math uses.
 *
 * Horizon safety (H2): a ring whose whole disc is beyond the camera's near
 * plane is skipped; for a ring that crosses it, the shader discards every
 * fragment at or beyond the near plane (the GPU clips the strip's triangles in
 * homogeneous space), so only the visible arc is drawn — the same open arcs
 * 38.7-05 drew from the projected samples. A body that is itself culled keeps
 * its ring's visible arc, exactly as before.
 *
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import {
  BlendMode,
  type SkCanvas,
  Skia,
  type SkPoint,
  type SkRuntimeEffect,
  type SkVertices,
  VertexMode,
} from "@shopify/react-native-skia";
import { HORIZON_EPSILON } from "@/logic/orrery-camera-logic";
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
import {
  discBeyondHorizon,
  type Homography,
  minRadialScale,
  planeHomography,
  RING_SKIP_ALPHA,
  ringDensityFade,
  ringScreenPerimeter,
  ringScreenSpacing,
} from "@/logic/orrery-plane-logic";
import type { OrreryInk, RingSpecs } from "./scene-specs";

/** Segments of every cached annulus strip. */
export const RING_BAND_SEGMENTS = 128;
/**
 * The geometric ladder of strip half-widths, as fractions of the ring radius
 * (×1.25 per step, so at most 25 % of a strip is wasted fragments). The
 * widest (≈6 R, inner edge at the centre) covers the most compressed legal
 * far side.
 */
export const RING_BAND_EPS: readonly number[] = Array.from(
  { length: 40 },
  (_, k) => 0.001 * 1.25 ** k,
);
/** Safety margin over the sampled minimum radial scale. */
const RING_BAND_MARGIN = 1.15;
/** Dash counts stay in this range (few dashes look broken; many alias). */
const MIN_DASHES = 4;
const MAX_DASHES = 4096;
/** The polygonal strip's outer edge, pushed out so it contains the circle. */
const BAND_GROW = 1 / Math.cos(Math.PI / RING_BAND_SEGMENTS);

/** The cached unit annulus strips, narrowest first. */
export type RingBands = readonly SkVertices[];

/** JS thread, once: the unit annulus strips (null when Skia lacks vertices). */
export function makeRingBands(): RingBands | null {
  const make = Skia?.MakeVertices;
  if (typeof make !== "function") return null;
  return RING_BAND_EPS.map((eps) => {
    const strip: SkPoint[] = [];
    const inner = Math.max(0, 1 - eps);
    const outer = (1 + eps) * BAND_GROW;
    for (let i = 0; i <= RING_BAND_SEGMENTS; i++) {
      const a = (i * 2 * Math.PI) / RING_BAND_SEGMENTS;
      const s = Math.sin(a),
        c = -Math.cos(a);
      strip.push(
        { x: s * inner, y: c * inner },
        { x: s * outer, y: c * outer },
      );
    }
    return make(VertexMode.TriangleStrip, strip);
  });
}

/**
 * The narrowest strip that contains a line of half-width `halfWidthDp` plus
 * the AA feather on the ring of radius `radius`, or −1 when no point of the
 * ring is in front of the camera.
 */
export function ringBandIndex(
  h: Homography,
  radius: number,
  halfWidthDp: number,
  aaDp: number,
): number {
  "worklet";
  if (!(radius > 0)) return -1;
  const scale = minRadialScale(h, radius);
  if (!(scale > 0)) return -1;
  const needed =
    ((halfWidthDp + aaDp + 0.5) / scale / radius) * RING_BAND_MARGIN;
  for (let k = 0; k < RING_BAND_EPS.length; k++)
    if (RING_BAND_EPS[k] >= needed) return k;
  return RING_BAND_EPS.length - 1;
}

/** H·S(R): the unit strip's local coordinates become world coordinates. */
export function ringMatrix(h: Homography, radius: number): number[] {
  "worklet";
  return [
    h[0] * radius,
    h[1] * radius,
    h[2],
    h[3] * radius,
    h[4] * radius,
    h[5],
    h[6] * radius,
    h[7] * radius,
    h[8],
  ];
}

/** RING_PLANE_SKSL uniforms, in declaration order (19 floats). */
export function ringPlaneUniforms(
  h: Homography,
  radius: number,
  halfWidthDp: number,
  aaDp: number,
  dashes: number,
  alpha: number,
  ink: OrreryInk,
): number[] {
  "worklet";
  return [
    h[0],
    h[1],
    h[2],
    h[3],
    h[4],
    h[5],
    h[6],
    h[7],
    h[8],
    radius,
    halfWidthDp,
    aaDp,
    dashes,
    HORIZON_EPSILON,
    alpha,
    ink[0],
    ink[1],
    ink[2],
    ink[3],
  ];
}

/**
 * Draw one world-plane ring (radius `radius` about the sun) with `effect`.
 * Returns false (nothing drawn) when the ring cannot show: no compiled effect
 * or strips, a non-positive radius, or a disc wholly beyond the horizon.
 */
export function drawPlaneRing(
  canvas: SkCanvas,
  h: Homography,
  radius: number,
  halfWidthDp: number,
  aaDp: number,
  dashes: number,
  alpha: number,
  ink: OrreryInk,
  effect: SkRuntimeEffect | null,
  bands: RingBands | null,
): boolean {
  "worklet";
  if (!effect || !bands || bands.length === 0) return false;
  const band = ringBandIndex(h, radius, halfWidthDp, aaDp);
  if (band < 0) return false;
  if (discBeyondHorizon(h, radius * (1 + RING_BAND_EPS[band]) * BAND_GROW))
    return false;
  const paint = Skia.Paint();
  paint.setShader(
    effect.makeShader(
      ringPlaneUniforms(h, radius, halfWidthDp, aaDp, dashes, alpha, ink),
    ),
  );
  canvas.save();
  canvas.concat(ringMatrix(h, radius));
  canvas.drawVertices(bands[band], BlendMode.Dst, paint);
  canvas.restore();
  return true;
}

/** The dash count that keeps a `periodDp` screen period on this ring. */
export function ringDashCount(
  h: Homography,
  radius: number,
  periodDp: number,
): number {
  "worklet";
  if (!(periodDp > 0)) return 0;
  const count = Math.round(ringScreenPerimeter(h, radius) / periodDp);
  return Math.max(MIN_DASHES, Math.min(MAX_DASHES, count));
}

/**
 * Every contact's orbit ring for `frame`, under the frame's homography.
 * A ring is drawn when its body has a spec, a positive world ring radius and a
 * final alpha (transition opacity × status alpha × density fade) of at least
 * RING_SKIP_ALPHA, and some of its disc is in front of the camera.
 * Returns the number of rings drawn.
 */
export function drawPlaneRings(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  specs: RingSpecs,
  effect: SkRuntimeEffect | null,
  bands: RingBands | null,
  aaDp: number,
): number {
  "worklet";
  if (!effect || !bands) return 0;
  const bodies = frame.bodies;
  // Ring density (Lab C): the outer ring over the ring count, at this zoom.
  let rings = 0,
    outer = 0;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (body.kind !== "contact" || !(body.worldRingRadius > 0)) continue;
    rings++;
    if (body.worldRingRadius > outer) outer = body.worldRingRadius;
  }
  if (rings === 0) return 0;
  const fade = ringDensityFade(
    ringScreenSpacing(outer, rings, frame.pose.zoom),
  );
  const h = planeHomography(frame.pose, frame.viewport);
  let drawn = 0;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (body.kind !== "contact") continue;
    const spec = specs[bodyKey(body)];
    if (!spec) continue;
    const alpha = body.opacity * spec.alpha * fade;
    if (!(alpha >= RING_SKIP_ALPHA)) continue;
    const radius = body.worldRingRadius;
    if (
      drawPlaneRing(
        canvas,
        h,
        radius,
        spec.widthDp / 2,
        aaDp,
        ringDashCount(h, radius, spec.dashPeriodDp),
        alpha,
        spec.ink,
        effect,
        bands,
      )
    )
      drawn++;
  }
  return drawn;
}

let sharedBands: RingBands | null | undefined;
/**
 * The app-wide unit strips (immutable, so every canvas mount shares one set;
 * built lazily on the JS thread the first time a V2 canvas mounts).
 */
export function ringBands(): RingBands | null {
  if (sharedBands === undefined) sharedBands = makeRingBands();
  return sharedBands;
}
