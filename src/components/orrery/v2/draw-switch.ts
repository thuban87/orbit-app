/**
 * 38.7-13 (D-24, D-32, D-53): the System switch's drawn spectacle — Lab B's
 * star warp and Lab A's orbit streaks — and the per-System sky-hue crossfade
 * weight (D-08). Everything is a pure function of the switch signal
 * (`sampleSwitchSignal`, orrery-switch-fx-logic.ts), the shared frame and the
 * JS-built specs; no wall-clock state and nothing mutated inside a mapper.
 *
 * STAR WARP (Lab B, `LabEnvironment.tsx` StarStreakAtlas, ported as drawn):
 * the streaks ARE the painted sky's own mid and near stars, each keeping its
 * own tone, size and alpha — no extra sprites and no texture (D-49's budget
 * is the sky's own star count). Each streak's head sits on its star, its tail
 * points back toward the viewport centre (the vanishing point), twisted by
 * WARP_SWIRL × warp in the spin's direction; length = WARP_STREAK_MAX_DP ×
 * warp × clamp(distance / half-diagonal, 0.12, 1.4) × (0.45 + 2.5 × layer
 * factor); thickness = the star's diameter × WARP_STREAK_THICK; alpha = the
 * star's alpha × WARP_STREAK_ALPHA × min(1, 2.5 × warp). Lab B's streak
 * sprite (transparent tail → 0.30 halo at 72 % → full head) is drawn as
 * WARP_STREAK_SEGMENTS stepped segments, one `drawPoints(Lines)` per star
 * batch per segment. The sky also PUSHES (Lab B WARP_PUSH): every layer
 * zooms about the centre by 1 + 0.14 × warp × (0.6 + 2.5 × factor).
 *
 * ORBIT STREAKS (Lab A, `world-plane.ts` §7a): behind each moving contact, a
 * fading arc on its own orbit drawn by the ring shader's one-sided arc term
 * under the exact homography (never a stroke under perspective, D-44). The
 * arc is analytic — the body's angular speed × TRAIL_MS (TRAIL_LEAVING_MS
 * when leaving), capped at TRAIL_MAX_ARC — so there is no history buffer.
 * Width TRAIL_WIDTH × the drawn radius, alpha TRAIL_ALPHA (dark / light) ×
 * min(1, 1.4 × speed), inner rings thinned (TRAIL_INNER_REF, floor
 * TRAIL_INNER_FLOOR), at most TRAIL_BUDGET bodies, nearest the camera first.
 *
 * Reduced motion: the signal's warp and trail are 0, so nothing is drawn.
 * Colours: every ink is a token already resolved in the specs (star tones,
 * status ring inks). Blend by the resolved mode (D-51): additive on dark.
 * No native object is created here (no streak texture), so the switch layer
 * holds nothing the H3 ledger must track.
 *
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import {
  BlendMode,
  PaintStyle,
  PointMode,
  type SkCanvas,
  Skia,
  type SkRuntimeEffect,
  StrokeCap,
} from "@shopify/react-native-skia";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { bodyKey } from "@/logic/orrery-frame";
import {
  type Homography,
  invertHomography,
  planeHomography,
} from "@/logic/orrery-plane-logic";
import type { SwitchChoreography } from "@/logic/orrery-switch-choreography";
import type { SwitchFxSignal } from "@/logic/orrery-switch-fx-logic";
import { drawPlaneRing, plainRingLine, type RingBands } from "./draw-plane";
import type { RingSpecs, SkySpec, SkyStarGroup } from "./scene-specs";
import {
  TRAIL_INNER_FLOOR,
  TRAIL_INNER_REF,
  TRAIL_LEAVING_GAIN,
  TRAIL_LEAVING_MS,
  TRAIL_MAX_ARC,
  TRAIL_MS,
  TRAIL_RAMP_MID,
  TRAIL_WIDTH,
  WARP_LAYER_FACTOR,
  WARP_PUSH,
  WARP_PUSH_BASE,
  WARP_PUSH_DEPTH,
  WARP_STREAK_ALPHA,
  WARP_STREAK_HALO,
  WARP_STREAK_HALO_AT,
  WARP_STREAK_MAX_DP,
  WARP_STREAK_SEGMENTS,
  WARP_STREAK_THICK,
  WARP_SWIRL,
} from "./visual-tunables";

// ── Sky-hue crossfade (D-08, H9) ───────────────────────────────────────────

/**
 * The drawn tint mix for a sky whose from → to crossfade belongs to the
 * switch to `tintGeneration` (Lab B `displayedSkyHue`): a frame still drawing
 * an OLDER switch shows `tintFrom` (0), a NEWER one `tintTo` (1), the switch
 * itself its crossfade weight. Robust to the order in which the new scene's
 * hue (React) and the new transition (UI thread) arrive.
 */
export function skyHueMix(
  tintGeneration: number,
  signal: SwitchFxSignal | null,
): number {
  "worklet";
  if (!signal) return 1;
  if (signal.generation < tintGeneration) return 0;
  if (signal.generation > tintGeneration) return 1;
  return signal.skyHue;
}

// ── Star warp (Lab B) ──────────────────────────────────────────────────────

/**
 * The mean of Lab B's streak sprite gradient over each of `segments` equal
 * pieces, tail first (0 at the tail, `halo` at `haloAt`, 1 at the head).
 */
export function warpStreakSegmentAlphas(
  segments: number,
  halo: number,
  haloAt: number,
): number[] {
  const n = Math.max(1, Math.floor(segments));
  const g = (u: number) =>
    u <= haloAt
      ? (halo * u) / haloAt
      : halo + ((1 - halo) * (u - haloAt)) / (1 - haloAt);
  const out: number[] = [];
  const steps = 64;
  for (let k = 0; k < n; k++) {
    let sum = 0;
    for (let s = 0; s < steps; s++) sum += g((k + (s + 0.5) / steps) / n);
    out.push(sum / steps);
  }
  return out;
}

/** The stepped streak alphas (computed once, a captured constant). */
const SEGMENT_ALPHA = warpStreakSegmentAlphas(
  WARP_STREAK_SEGMENTS,
  WARP_STREAK_HALO,
  WARP_STREAK_HALO_AT,
);

/** Lab B's layer depth factor of a star batch. */
export function warpLayerFactor(layer: SkyStarGroup["layer"]): number {
  "worklet";
  return layer === "near" ? WARP_LAYER_FACTOR.near : WARP_LAYER_FACTOR.mid;
}

/** Lab B's push: a layer's extra zoom about the centre at `warp`. */
export function warpPushScale(warp: number, factor: number): number {
  "worklet";
  if (!(warp > 0)) return 1;
  return 1 + WARP_PUSH * warp * (WARP_PUSH_BASE + WARP_PUSH_DEPTH * factor);
}

/** One star's streak: tail → head in canvas dp, or null (at the centre). */
export interface WarpStreak {
  tx: number;
  ty: number;
  hx: number;
  hy: number;
}

/**
 * The streak of a star drawn at (px, py) — already pushed — about the
 * vanishing point (cx, cy) with half-diagonal `half`, at `warp`, for layer
 * depth `factor` (Lab B `StarStreakAtlas` xform).
 */
export function warpStreak(
  px: number,
  py: number,
  cx: number,
  cy: number,
  half: number,
  warp: number,
  factor: number,
): WarpStreak | null {
  "worklet";
  let dx = px - cx;
  let dy = py - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (!(d >= 1) || !(warp > 0)) return null;
  dx /= d;
  dy /= d;
  const swirl = WARP_SWIRL * warp;
  const cs = Math.cos(swirl);
  const sn = Math.sin(swirl);
  const rx = dx * cs - dy * sn;
  const ry = dx * sn + dy * cs;
  const depth = 0.45 + 2.5 * factor;
  const len =
    WARP_STREAK_MAX_DP *
    warp *
    Math.min(1.4, Math.max(0.12, d / Math.max(1, half))) *
    depth;
  return { tx: px - rx * len, ty: py - ry * len, hx: px, hy: py };
}

/**
 * The warp streaks of the sky's mid and near stars, drawn at the star
 * positions the dots use (offset by `dx`, `dy` and pushed about the canvas
 * centre). Nothing at warp 0. Returns the number of streaks drawn (≤ the
 * sky's star count: the budget).
 */
export function drawWarpStreaks(
  canvas: SkCanvas,
  sky: SkySpec,
  warp: number,
  dx: number,
  dy: number,
): number {
  "worklet";
  if (!(warp > 0) || sky.stars.length === 0) return 0;
  const cx = sky.width / 2;
  const cy = sky.height / 2;
  const half = Math.sqrt(cx * cx + cy * cy);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeCap(StrokeCap.Butt);
  paint.setBlendMode(sky.additive ? BlendMode.Plus : BlendMode.SrcOver);
  const segments = SEGMENT_ALPHA.length;
  const fade = Math.min(1, warp * 2.5);
  let drawn = 0;
  for (let g = 0; g < sky.stars.length; g++) {
    const group = sky.stars[g];
    const factor = warpLayerFactor(group.layer);
    const push = warpPushScale(warp, factor);
    const lines: { x: number; y: number }[][] = [];
    for (let k = 0; k < segments; k++) lines.push([]);
    for (let i = 0; i < group.points.length; i++) {
      const p = group.points[i];
      const px = cx + (p.x + dx - cx) * push;
      const py = cy + (p.y + dy - cy) * push;
      const s = warpStreak(px, py, cx, cy, half, warp, factor);
      if (!s) continue;
      drawn++;
      for (let k = 0; k < segments; k++) {
        const a = k / segments;
        const b = (k + 1) / segments;
        lines[k].push(
          { x: s.tx + (s.hx - s.tx) * a, y: s.ty + (s.hy - s.ty) * a },
          { x: s.tx + (s.hx - s.tx) * b, y: s.ty + (s.hy - s.ty) * b },
        );
      }
    }
    if (lines[0].length === 0) continue;
    paint.setStrokeWidth(group.diameter * Math.sqrt(push) * WARP_STREAK_THICK);
    const base = group.alpha * WARP_STREAK_ALPHA * fade;
    for (let k = 0; k < segments; k++) {
      paint.setColor(
        Float32Array.of(
          group.ink[0],
          group.ink[1],
          group.ink[2],
          Math.max(0, Math.min(1, group.ink[3] * base * SEGMENT_ALPHA[k])),
        ),
      );
      canvas.drawPoints(PointMode.Lines, lines[k] as never, paint);
    }
  }
  return drawn;
}

// ── Orbit streaks (Lab A) ──────────────────────────────────────────────────

/**
 * Per transition: each contact key's streak role — [leaving (1/0), the
 * body's share of the world's spin]. A retained body travels its forward
 * angle plus the spin's whole turns (`sampleRetained`), so its streak is
 * that much longer; leaving and entering bodies move at the spin. Built once
 * per transition (a publish or a settle), never per frame.
 */
export interface SwitchTrailRoles {
  generation: number;
  byKey: Readonly<Record<string, readonly [number, number]>>;
}
export const NO_TRAIL_ROLES: SwitchTrailRoles = { generation: -1, byKey: {} };

function trailAngle(body: { x: number; y: number }): number {
  "worklet";
  return Math.atan2(body.x, -body.y);
}

export function switchTrailRoles(
  transition: Pick<
    SwitchChoreography,
    "generation" | "entries" | "spinTurns" | "maximumRotation" | "settledWorld"
  >,
): SwitchTrailRoles {
  "worklet";
  // A settled choreography never streaks: no index to build.
  if (transition.settledWorld || !(transition.maximumRotation > 0))
    return { generation: transition.generation, byKey: {} };
  const byKey: Record<string, readonly [number, number]> = {};
  const turn = Math.PI * 2;
  const entries = transition.entries;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.role === "anchor") continue;
    if (entry.role === "leaving") {
      byKey[entry.key] = [1, 1];
      continue;
    }
    if (entry.role === "entering") {
      byKey[entry.key] = [0, 1];
      continue;
    }
    const from = entry.source;
    const to = entry.destination;
    if (!from || !to) continue;
    const forward =
      (((trailAngle(to) - trailAngle(from)) % turn) + turn) % turn;
    byKey[entry.key] = [
      0,
      (forward + transition.spinTurns * turn) / transition.maximumRotation,
    ];
  }
  return { generation: transition.generation, byKey };
}

/**
 * 38.7-15 (D-76): the streak roles while a lead-in spins a settled scene —
 * every contact turns rigidly with the world (share 1). Built once per lead
 * (its start or end), never per frame.
 */
export function switchLeadTrailRoles(
  transition: Pick<SwitchChoreography, "generation" | "entries">,
): SwitchTrailRoles {
  "worklet";
  const byKey: Record<string, readonly [number, number]> = {};
  const entries = transition.entries;
  for (let i = 0; i < entries.length; i++)
    if (entries[i].role !== "anchor") byKey[entries[i].key] = [0, 1];
  return { generation: transition.generation, byKey };
}

/** The streak look the canvas passes (theme-mode keyed; owner knobs). */
export interface TrailLook {
  /** Peak alpha (TRAIL_ALPHA by mode) × the owner strength knob. */
  peak: number;
  /** D-51: additive on dark themes. */
  additive: boolean;
  /** TRAIL_BUDGET. */
  budget: number;
}

/** A screen point mapped back onto the plane by the inverse homography. */
function planeAngleAt(hi: Homography, x: number, y: number): number | null {
  "worklet";
  const w = hi[6] * x + hi[7] * y + hi[8];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-9) return null;
  const px = (hi[0] * x + hi[1] * y + hi[2]) / w;
  const py = (hi[3] * x + hi[4] * y + hi[5]) / w;
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  return Math.atan2(px, -py);
}

/**
 * Lab A's orbit streaks for one frame of a switch: at most `look.budget`
 * contacts (nearest the camera first), each a one-sided ring-shader arc on
 * its own orbit behind it. Nothing when the signal has no trail (reduced
 * motion, settled, no spin), when the roles belong to another transition or
 * without the ring effect. Returns the number drawn.
 */
export function drawOrbitTrails(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  specs: RingSpecs,
  signal: SwitchFxSignal,
  roles: SwitchTrailRoles,
  effect: SkRuntimeEffect | null,
  bands: RingBands | null,
  aaDp: number,
  look: TrailLook,
): number {
  "worklet";
  if (!(signal.trail > 0) || !(look.peak > 0) || !(look.budget > 0)) return 0;
  if (!effect || !bands || roles.generation !== signal.generation) return 0;
  const bodies = frame.bodies;
  const chosen: { index: number; depth: number; role: readonly number[] }[] =
    [];
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (body.kind !== "contact" || body.culled || !(body.opacity > 0)) continue;
    if (!(body.worldRingRadius > 0) || !(body.radius > 0)) continue;
    const key = bodyKey(body);
    const role = roles.byKey[key];
    if (!role || !specs[key]) continue;
    chosen.push({
      index: i,
      depth: Number.isFinite(body.depth) ? body.depth : 0,
      role,
    });
  }
  if (chosen.length === 0) return 0;
  // D-53 budget: the nearest bodies first (depth grows toward the camera).
  if (chosen.length > look.budget) chosen.sort((a, b) => b.depth - a.depth);
  const h = planeHomography(frame.pose, frame.viewport);
  const hi = invertHomography(h);
  if (!hi) return 0;
  const centre = frame.center ?? {
    x: frame.viewport.width / 2,
    y: frame.viewport.height / 2,
  };
  const blend = look.additive ? BlendMode.Plus : BlendMode.SrcOver;
  const count = Math.min(chosen.length, Math.floor(look.budget));
  let drawn = 0;
  for (let n = 0; n < count; n++) {
    const item = chosen[n];
    const body = bodies[item.index];
    const leaving = item.role[0] === 1;
    const arc = Math.min(
      TRAIL_MAX_ARC,
      Math.abs(signal.angularSpeed * item.role[1]) *
        ((leaving ? TRAIL_LEAVING_MS : TRAIL_MS) / 1000),
    );
    if (!(arc > 0.01)) continue;
    const head = planeAngleAt(hi, body.x, body.y);
    if (head === null) continue;
    const inner = Math.max(
      TRAIL_INNER_FLOOR,
      Math.min(
        1,
        Math.hypot(body.x - centre.x, body.y - centre.y) /
          Math.max(1, body.radius * TRAIL_INNER_REF),
      ),
    );
    const alpha =
      look.peak *
      body.opacity *
      signal.trail *
      (leaving ? TRAIL_LEAVING_GAIN : 1) *
      (0.45 + 0.55 * inner);
    if (!(alpha > 0.002)) continue;
    const spec = specs[bodyKey(body)];
    const line = plainRingLine(
      (body.radius * TRAIL_WIDTH * inner) / 2,
      aaDp,
      spec.ink,
    );
    line.alpha = Math.min(1, alpha);
    line.arcCentre = (head + Math.PI * 2) % (Math.PI * 2);
    line.arcHalf = arc;
    line.arcTrail = 1;
    line.arcMid = TRAIL_RAMP_MID;
    if (
      drawPlaneRing(canvas, h, body.worldRingRadius, line, effect, bands, blend)
    )
      drawn++;
  }
  return drawn;
}
