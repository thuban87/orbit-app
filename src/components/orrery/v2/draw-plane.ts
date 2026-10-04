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
 * 38.7-09: Lab B's thin, SUN-LIT status lines (D-11: dash duties, sun light,
 * far-side depth fade), the optional Lab C-style orbital-plane grid under the
 * rings in the same (baked) base picture (D-09), and the subtle orbit pulses —
 * ring-shader arcs drawn by their own ambient picture, never baked (D-10).
 * D-44/D-64 decided world-plane rings only (no ring field), so these terms
 * exist on this path alone.
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
import type {
  GridSpec,
  OrreryInk,
  PulseSpec,
  RingSpec,
  RingSpecs,
} from "./scene-specs";
import {
  PULSE_ARC_HALF,
  PULSE_CYCLE_MS,
  PULSE_HALF_WIDTH_DP,
  PULSE_SPEED,
  PULSE_TRAVEL_MS,
  RING_SUN_LIGHT_RADIUS,
} from "./visual-tunables";

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

/**
 * One ring line's look for the ring shader: width, AA, dashes, alpha, ink,
 * the D-11 sun light and depth fade, and the D-10 pulse arc (half 0 = the
 * whole ring).
 */
export interface RingLine {
  halfWidthDp: number;
  aaDp: number;
  dashes: number;
  dashDuty: number;
  alpha: number;
  ink: OrreryInk;
  lightGain: number;
  /** World radius of the sun light's falloff. */
  lightRadius: number;
  lightMix: number;
  farAlpha: number;
  light: OrreryInk;
  /** Pulse arc centre (radians, clockwise from north). */
  arcCentre: number;
  /** Pulse arc half-length (radians); 0 = the whole ring. */
  arcHalf: number;
}

/** A plain line: no sun light, no depth fade, no dashes, the whole ring. */
export function plainRingLine(
  halfWidthDp: number,
  aaDp: number,
  ink: OrreryInk,
): RingLine {
  "worklet";
  return {
    halfWidthDp,
    aaDp,
    dashes: 0,
    dashDuty: 1,
    alpha: 1,
    ink,
    lightGain: 0,
    lightRadius: 1,
    lightMix: 0,
    farAlpha: 1,
    light: ink,
    arcCentre: 0,
    arcHalf: 0,
  };
}

/** RING_PLANE_SKSL uniforms, in declaration order (32 floats). */
export function ringPlaneUniforms(
  h: Homography,
  radius: number,
  line: RingLine,
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
    line.halfWidthDp,
    line.aaDp,
    line.dashes,
    HORIZON_EPSILON,
    line.alpha,
    line.ink[0],
    line.ink[1],
    line.ink[2],
    line.ink[3],
    line.dashDuty,
    line.lightGain,
    line.lightRadius,
    line.lightMix,
    line.farAlpha,
    line.light[0],
    line.light[1],
    line.light[2],
    line.light[3],
    line.arcCentre,
    line.arcHalf,
    0,
    0,
  ];
}

/**
 * Draw one world-plane ring (radius `radius` about the sun) with `effect`.
 * Returns false (nothing drawn) when the ring cannot show: no compiled effect
 * or strips, a non-positive radius, or a disc wholly beyond the horizon.
 * `blend` (optional) is the paint's blend mode (pulses: additive on dark).
 */
export function drawPlaneRing(
  canvas: SkCanvas,
  h: Homography,
  radius: number,
  line: RingLine,
  effect: SkRuntimeEffect | null,
  bands: RingBands | null,
  blend?: BlendMode,
): boolean {
  "worklet";
  if (!effect || !bands || bands.length === 0) return false;
  const band = ringBandIndex(h, radius, line.halfWidthDp, line.aaDp);
  if (band < 0) return false;
  if (discBeyondHorizon(h, radius * (1 + RING_BAND_EPS[band]) * BAND_GROW))
    return false;
  const paint = Skia.Paint();
  paint.setShader(effect.makeShader(ringPlaneUniforms(h, radius, line)));
  if (blend !== undefined) paint.setBlendMode(blend);
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

/** The ring line a status spec draws on this frame. */
export function statusRingLine(
  spec: RingSpec,
  alpha: number,
  dashes: number,
  aaDp: number,
  lightRadius: number,
): RingLine {
  "worklet";
  return {
    halfWidthDp: spec.widthDp / 2,
    aaDp,
    dashes,
    dashDuty: spec.dashDuty,
    alpha,
    ink: spec.ink,
    lightGain: spec.lightGain,
    lightRadius,
    lightMix: spec.lightMix,
    farAlpha: spec.farAlpha,
    light: spec.light,
    arcCentre: 0,
    arcHalf: 0,
  };
}

/** The outermost contact orbit and the ring count of a frame. */
export function frameRingExtent(frame: AnimatedFrame): {
  rings: number;
  outer: number;
} {
  "worklet";
  let rings = 0,
    outer = 0;
  const bodies = frame.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (body.kind !== "contact" || !(body.worldRingRadius > 0)) continue;
    rings++;
    if (body.worldRingRadius > outer) outer = body.worldRingRadius;
  }
  return { rings, outer };
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
  const { rings, outer } = frameRingExtent(frame);
  if (rings === 0) return 0;
  const fade = ringDensityFade(
    ringScreenSpacing(outer, rings, frame.pose.zoom),
  );
  const h = planeHomography(frame.pose, frame.viewport);
  const lightRadius = Math.max(1, outer * RING_SUN_LIGHT_RADIUS);
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
        statusRingLine(
          spec,
          alpha,
          ringDashCount(h, radius, spec.dashPeriodDp),
          aaDp,
          lightRadius,
        ),
        effect,
        bands,
      )
    )
      drawn++;
  }
  return drawn;
}

// ── Orbit pulses (D-10/D-37/D-49): never baked, ambient clock only ────────

/** Integer hash → 0..1 (Math.imul keeps it exact; no Math.random). */
export function pulseHash(a: number, b: number): number {
  "worklet";
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** One pulse at an ambient time: the ring it travels and where it is. */
export interface PulsePlacement {
  /** Index into the eligible ring list. */
  ring: number;
  /** Arc centre (radians, clockwise from north). */
  centre: number;
  /** Fade envelope 0..1 (in and out over the travel). */
  envelope: number;
}

/**
 * Where pulse slot `slot` of `budget` is at ambient time `ambientMs` over
 * `ringCount` eligible rings, or null while it rests. Slots are staggered over
 * the cycle; each cycle a slot picks its ring and start angle from a hash of
 * (cycle, slot) — deterministic from the ring index and the ambient time. The
 * same for every status (D-10).
 */
export function pulsePlacement(
  slot: number,
  budget: number,
  ambientMs: number,
  ringCount: number,
): PulsePlacement | null {
  "worklet";
  if (!(ambientMs >= 0) || !(ringCount > 0) || !(budget > 0)) return null;
  const t = ambientMs + (slot * PULSE_CYCLE_MS) / budget;
  const cycle = Math.floor(t / PULSE_CYCLE_MS);
  const local = t - cycle * PULSE_CYCLE_MS;
  if (local >= PULSE_TRAVEL_MS) return null;
  const ring = Math.min(
    ringCount - 1,
    Math.floor(pulseHash(cycle, slot + 1) * ringCount),
  );
  const start = pulseHash(cycle + 7919, slot + 31) * Math.PI * 2;
  return {
    ring,
    centre: start + (PULSE_SPEED * local) / 1000,
    envelope: Math.sin((Math.PI * local) / PULSE_TRAVEL_MS),
  };
}

/**
 * The rings the orbit pulses may travel for one frame and ring-spec set: the
 * frame's homography plus, per eligible ring (a contact ring with a spec whose
 * alpha clears RING_SKIP_ALPHA), its world radius and its body opacity × the
 * ring density fade. `rings` is the eligible count.
 *
 * 38.7-09 (cheaper pulses): this scan (a key string per body) depends only on
 * the frame and the ring specs, never on the ambient time, so the canvas
 * derives it from those two values alone and an ambient tick reuses it.
 */
export interface PulseRings {
  rings: number;
  h: Homography | null;
  radius: number[];
  opacity: number[];
}

/** No eligible rings (the initial value; nothing to pulse). */
export const NO_PULSE_RINGS: PulseRings = {
  rings: 0,
  h: null,
  radius: [],
  opacity: [],
};

/** The eligible pulse rings of `frame` under `specs` (see PulseRings). */
export function pulseRings(frame: AnimatedFrame, specs: RingSpecs): PulseRings {
  "worklet";
  const { rings, outer } = frameRingExtent(frame);
  if (rings === 0) return NO_PULSE_RINGS;
  const fade = ringDensityFade(
    ringScreenSpacing(outer, rings, frame.pose.zoom),
  );
  const radius: number[] = [];
  const opacity: number[] = [];
  const bodies = frame.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (body.kind !== "contact" || !(body.worldRingRadius > 0)) continue;
    const spec = specs[bodyKey(body)];
    if (!spec || !(body.opacity * spec.alpha * fade >= RING_SKIP_ALPHA))
      continue;
    radius.push(body.worldRingRadius);
    opacity.push(body.opacity * fade);
  }
  if (radius.length === 0) return NO_PULSE_RINGS;
  return {
    rings: radius.length,
    h: planeHomography(frame.pose, frame.viewport),
    radius,
    opacity,
  };
}

/**
 * The subtle orbit pulses at ambient time `ambientMs`: at most `pulse.budget`
 * soft arcs in `orreryPulse` at `pulse.intensity`, travelling along the
 * eligible `rings` (from `pulseRings`, computed once per frame/spec change).
 * Nothing under reduced motion (ambient −1), with a zero budget or intensity
 * or no eligible ring. The status of the ring never changes a pulse.
 * Returns the number drawn.
 */
export function drawPlanePulses(
  canvas: SkCanvas,
  rings: PulseRings,
  pulse: PulseSpec,
  ambientMs: number,
  effect: SkRuntimeEffect | null,
  bands: RingBands | null,
  aaDp: number,
): number {
  "worklet";
  if (!effect || !bands) return 0;
  if (!(ambientMs >= 0) || !(pulse.budget > 0) || !(pulse.intensity > 0))
    return 0;
  const h = rings.h;
  if (!h || !(rings.rings > 0)) return 0;
  const blend = pulse.additive ? BlendMode.Plus : BlendMode.SrcOver;
  // One line reused for every slot (only alpha and the arc change).
  const line = plainRingLine(PULSE_HALF_WIDTH_DP, aaDp, pulse.ink);
  line.farAlpha = pulse.farAlpha;
  line.arcHalf = PULSE_ARC_HALF;
  let drawn = 0;
  for (let slot = 0; slot < pulse.budget; slot++) {
    const place = pulsePlacement(slot, pulse.budget, ambientMs, rings.rings);
    if (!place) continue;
    const alpha = pulse.intensity * place.envelope * rings.opacity[place.ring];
    if (!(alpha >= RING_SKIP_ALPHA)) continue;
    line.alpha = alpha;
    line.arcCentre = place.centre;
    if (
      drawPlaneRing(
        canvas,
        h,
        rings.radius[place.ring],
        line,
        effect,
        bands,
        blend,
      )
    )
      drawn++;
  }
  return drawn;
}

// ── The orbital-plane grid (D-09): in the baked base, under the rings ─────

/** Segments of the cached unit disc fan the grid is shaded on. */
export const GRID_DISC_SEGMENTS = 96;

/** JS thread, once: the unit disc fan (null when Skia lacks vertices). */
export function makeGridDisc(): SkVertices | null {
  const make = Skia?.MakeVertices;
  if (typeof make !== "function") return null;
  const grow = 1 / Math.cos(Math.PI / GRID_DISC_SEGMENTS);
  const fan: SkPoint[] = [{ x: 0, y: 0 }];
  for (let i = 0; i <= GRID_DISC_SEGMENTS; i++) {
    const a = (i * 2 * Math.PI) / GRID_DISC_SEGMENTS;
    fan.push({ x: Math.sin(a) * grow, y: -Math.cos(a) * grow });
  }
  return make(VertexMode.TriangleFan, fan);
}

let sharedDisc: SkVertices | null | undefined;
/** The app-wide unit disc (immutable; built lazily on the JS thread). */
export function gridDisc(): SkVertices | null {
  if (sharedDisc === undefined) sharedDisc = makeGridDisc();
  return sharedDisc;
}

/** GRID_PLANE_SKSL uniforms, in declaration order (21 floats). */
export function gridPlaneUniforms(
  h: Homography,
  reach: number,
  grid: GridSpec,
  aaDp: number,
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
    reach,
    grid.halfWidthDp,
    aaDp,
    HORIZON_EPSILON,
    grid.rings,
    grid.spokes,
    grid.opacity,
    grid.farAlpha,
    grid.ink[0],
    grid.ink[1],
    grid.ink[2],
    grid.ink[3],
  ];
}

/**
 * The optional orbital-plane grid (D-09) out to `grid.extent` × the outermost
 * orbit, under the frame's homography. Opacity 0 → nothing is drawn at all
 * (not even a transparent draw). Horizon-safe: a disc wholly beyond the
 * horizon is skipped; the shader discards fragments past the near plane.
 */
export function drawPlaneGrid(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  grid: GridSpec,
  effect: SkRuntimeEffect | null,
  disc: SkVertices | null,
  aaDp: number,
): boolean {
  "worklet";
  if (!(grid.opacity > 0) || !effect || !disc) return false;
  const { outer } = frameRingExtent(frame);
  if (!(outer > 0)) return false;
  const reach = outer * grid.extent;
  const h = planeHomography(frame.pose, frame.viewport);
  if (discBeyondHorizon(h, reach * 1.05)) return false;
  const paint = Skia.Paint();
  paint.setShader(effect.makeShader(gridPlaneUniforms(h, reach, grid, aaDp)));
  canvas.save();
  canvas.concat(ringMatrix(h, reach));
  canvas.drawVertices(disc, BlendMode.Dst, paint);
  canvas.restore();
  return true;
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
