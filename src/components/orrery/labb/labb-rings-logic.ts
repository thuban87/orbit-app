/**
 * ORRERY LAB B — L1 instrument orbits: pure maths (WP-1.3).
 *
 * WHY THIS EXISTS. The legacy ring rebuilt a 128-point `SkPath` per ring from
 * `frame.bodies[i].ringPath` and stroked it (thick, often dashed through a
 * CPU `DashPathEffect`) on every canvas replay. On the emulator that was the
 * dominant frame cost (WP-1.1 PERF-LOG run 1).
 *
 * A ring is a circle of world radius `ringRadius` centred on the sun (world
 * origin), and `projectWorldPoint` is an exact PLANE HOMOGRAPHY (yaw → tilted
 * perspective plane → zoom → usable-rect centre). So every ring is static
 * world-space geometry (`<Circle cx=0 cy=0 r=R>`) drawn under ONE per-frame
 * 3×3 matrix (`planeHomography`) shared by all rings, wakes, tethers and ticks.
 * No path is rebuilt per frame and dashes/flow/depth fade are computed in a
 * stroke shader (`ringInstrument`) instead of a CPU path effect.
 *
 * Semantics kept from `orreryRingStyle` / `ringVisual` (they are the product
 * meaning, mapped one-to-one into the instrument language, see
 * `ringInstrumentClass`): status HUE (colour), border WEIGHT ordering (the
 * redundant CVD channel: stable < wobble = rogue < decay), STROKE STYLE
 * (solid / dashed / faded / faint trace) and the never-contacted neutral
 * (border token at half alpha).
 *
 * Hermes rule: helpers are declared ABOVE their worklet callers (guarded by
 * `orrery-worklet-order.test.ts`, which scans this folder recursively).
 */
import type { ProfileStatus } from "@/db/contact-status-read";
import {
  type CameraPose,
  type CameraViewport,
  MAX_TILT,
  usableCameraRect,
} from "@/logic/orrery-camera-logic";
import type { OrreryRingStyle } from "@/logic/orrery-ring-logic";

// --- Tunables -----------------------------------------------------------------
/**
 * Instrument stroke widths in dp. The legacy `ringVisual` weights are
 * stable 2 / wobble 3 / decay 4 / rogue 3 / neutral 2 px; the instrument keeps
 * their ORDER and ratios (×0.42 + 0.2) so weight still carries status for
 * colour-blind users, while every ring reads as a hairline.
 */
export const RING_WIDTH_SCALE = 0.42;
export const RING_WIDTH_BASE = 0.2;
/** Dash patterns in screen dp: [period, duty]. */
export const DASHED_PERIOD = 11;
export const DASHED_DUTY = 0.58;
export const TRACE_PERIOD = 6;
export const TRACE_DUTY = 0.3;
/** Style alpha (legacy: faded 0.7, faint trace 0.3, neutral 0.5, else 1). */
export const FADED_ALPHA = 0.7;
export const TRACE_ALPHA = 0.42;
/** World-unit lengths of the instrument ticks (scale with zoom, like the plane). */
export const NORTH_TICK = 3;
export const SCALE_TICK = 2;
export const SCALE_TICK_MAJOR = 4.5;
export const COMPASS_GAP = 16;
export const COMPASS_SIZE = 5;
/**
 * Density fade: when neighbouring rings are closer than this on screen (dp),
 * ring alpha scales down in proportion (far zoom on a dense System reads as
 * fine instrument grooves instead of a solid moiré), never below the floor.
 */
export const RING_CLUTTER_GAP_DP = 20;
export const RING_CLUTTER_FLOOR = 0.35;

export type RingStrokeStyle = OrreryRingStyle["strokeStyle"];

/** One instrument class = one Group + one shader instance + N ring circles. */
export interface RingInstrumentClass {
  /** Stable class key (Group key, wake/tether path key). */
  id: "stable" | "wobble" | "decay" | "rogue" | "neutral";
  color: string;
  /** Stroke width in screen dp (before perspective). */
  widthDp: number;
  /** 0 = solid, else the dash period (dp). */
  dashPeriod: number;
  dashDuty: number;
  /** Multiplies the profile's base ring alpha. */
  alpha: number;
  /** Whether this status gets a progress wake (never-contacted: no). */
  wake: boolean;
  /** Whether the body is pushed off its rail (decay / rogue): drift tether. */
  tether: boolean;
}

/**
 * Map a resolved legacy ring style + status to the instrument class. The
 * legacy style object stays the single status → colour / weight / style source
 * (`orreryRingStyle` → `ringVisual`); this only restates it as hairlines.
 */
export function ringInstrumentClass(
  status: ProfileStatus | null,
  style: OrreryRingStyle,
): RingInstrumentClass {
  const widthDp = style.width * RING_WIDTH_SCALE + RING_WIDTH_BASE;
  const dashed = style.strokeStyle === "dashed";
  const trace = style.strokeStyle === "faintTrace";
  const alpha =
    style.strokeStyle === "faded"
      ? FADED_ALPHA
      : trace
        ? TRACE_ALPHA
        : style.opacity;
  return {
    id: status ?? "neutral",
    color: style.color,
    widthDp,
    dashPeriod: dashed ? DASHED_PERIOD : trace ? TRACE_PERIOD : 0,
    dashDuty: dashed ? DASHED_DUTY : trace ? TRACE_DUTY : 1,
    alpha,
    wake: status !== null,
    tether: status === "decay" || status === "rogue",
  };
}

/**
 * The world-plane → screen homography of `projectWorldPoint`, as a row-major
 * 3×3 (`[sx, kx, tx, ky, sy, ty, p0, p1, p2]`, the order RN Skia's `matrix`
 * prop parses for 9 numbers). Exact (tested against `projectWorldPoint`).
 * Null when the viewport has no usable rect (same contract as projection).
 */
export function planeHomography(
  pose: CameraPose,
  viewport: CameraViewport,
): number[] | null {
  "worklet";
  const rect = usableCameraRect(viewport);
  if (!rect) return null;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const f = pose.focalDistance ?? 256;
  const z = pose.zoom;
  const tilt = pose.tilt ?? 0;
  const yaw = pose.yaw ?? 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const st = Math.sin(tilt);
  const ct = Math.cos(tilt);
  // Camera plane: px = c·x − s·y + tx ; py = s·x + c·y + ty
  const tx = -(c * pose.x - s * pose.y);
  const ty = -(s * pose.x + c * pose.y);
  // Screen (homogeneous) from (px, py, 1):
  //   X = z·f·px − cx·st·py + cx·f
  //   Y = (z·f·ct − cy·st)·py + cy·f
  //   W = −st·py + f
  const a00 = z * f;
  const a01 = -cx * st;
  const a02 = cx * f;
  const a11 = z * f * ct - cy * st;
  const a12 = cy * f;
  const a21 = -st;
  const a22 = f;
  // Compose with the plane transform and normalise by f.
  return [
    (a00 * c + a01 * s) / f,
    (-a00 * s + a01 * c) / f,
    (a00 * tx + a01 * ty + a02) / f,
    (a11 * s) / f,
    (a11 * c) / f,
    (a11 * ty + a12) / f,
    (a21 * s) / f,
    (a21 * c) / f,
    (a21 * ty + a22) / f,
  ];
}

/** Apply a row-major 3×3 homography to a point (tests + label leaders). */
export function applyHomography(
  m: readonly number[],
  x: number,
  y: number,
): { x: number; y: number } {
  "worklet";
  const w = m[6] * x + m[7] * y + m[8];
  return {
    x: (m[0] * x + m[1] * y + m[2]) / w,
    y: (m[3] * x + m[4] * y + m[5]) / w,
  };
}

/** Normalised tilt (0 flat … 1 at MAX_TILT): drives the far-side depth fade. */
export function tiltDepth(pose: CameraPose): number {
  "worklet";
  const t = Math.max(0, Math.min(MAX_TILT, pose.tilt ?? 0));
  return Math.sin(t) / Math.sin(MAX_TILT);
}

/**
 * Wake angle of a world position: north (−y) = 0, clockwise, in [0, 2π).
 * Same convention as `polarToXY` / `progressToAngle` (ADR-011), so the wake
 * literally draws interval progress.
 */
export function wakeAngle(x: number, y: number): number {
  "worklet";
  if (x === 0 && y === 0) return 0;
  const a = Math.atan2(x, -y);
  return a < 0 ? a + 2 * Math.PI : a;
}

/** Plain-data descriptions of the static world-space instrument geometry. */
export interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Drift tether: rail point (ringRadius along the body's angle) → body. */
export function tetherSegment(
  ringRadius: number,
  bodyX: number,
  bodyY: number,
  bodyRadius: number,
): Segment | null {
  const d = Math.hypot(bodyX, bodyY);
  if (d <= 0 || ringRadius <= 0) return null;
  const ux = bodyX / d;
  const uy = bodyY / d;
  // Stop at the body's limb so the tether never draws over the face.
  const end = d - bodyRadius;
  if (end - ringRadius < 0.5) return null;
  return {
    x0: ux * ringRadius,
    y0: uy * ringRadius,
    x1: ux * end,
    y1: uy * end,
  };
}

/** North tick across a ring (radial, centred on the rail). */
export function northTick(ringRadius: number, length = NORTH_TICK): Segment {
  return {
    x0: 0,
    y0: -ringRadius + length / 2,
    x1: 0,
    y1: -ringRadius - length / 2,
  };
}

/** The focused ring's 12-step "tick scale" (30°), north major. */
export function scaleTicks(ringRadius: number): Segment[] {
  const out: Segment[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    const len = k === 0 ? SCALE_TICK_MAJOR : SCALE_TICK;
    const sx = Math.sin(a);
    const sy = -Math.cos(a);
    out.push({
      x0: sx * (ringRadius - len / 2),
      y0: sy * (ringRadius - len / 2),
      x1: sx * (ringRadius + len / 2),
      y1: sy * (ringRadius + len / 2),
    });
  }
  return out;
}

/** Compass chevron just outside the outermost ring, pointing north. */
export function compassChevron(outerRadius: number): Segment[] {
  const tipY = -(outerRadius + COMPASS_GAP + COMPASS_SIZE);
  const baseY = -(outerRadius + COMPASS_GAP);
  return [
    { x0: -COMPASS_SIZE, y0: baseY, x1: 0, y1: tipY },
    { x0: 0, y0: tipY, x1: COMPASS_SIZE, y1: baseY },
  ];
}

/** Uniforms of `ringInstrument` (every declared uniform; tested). */
export type RingUniforms = {
  uColor: number[];
  uHi: number[];
  uCam: number[];
  uStyle: number[];
  uFlow: number[];
};

/**
 * Build the `ringInstrument` uniforms. `cam` = [cos yaw, sin yaw, tilt depth,
 * zoom]; `flow` = [time s, on, comet length, comet speed, panel intensity].
 */
export function ringUniforms(
  color: readonly number[],
  highlight: readonly number[],
  cam: readonly number[],
  flow: readonly number[],
  style: {
    mode: number;
    alpha: number;
    dashPeriod: number;
    dashDuty: number;
    farAlpha: number;
    flowStrength: number;
    flowOn: boolean;
  },
): RingUniforms {
  "worklet";
  return {
    uColor: [color[0], color[1], color[2], style.alpha],
    uHi: [
      highlight[0],
      highlight[1],
      highlight[2],
      style.flowStrength * flow[4],
    ],
    uCam: [cam[0], cam[1], cam[2], cam[3]],
    uStyle: [style.mode, style.dashPeriod, style.dashDuty, style.farAlpha],
    uFlow: [flow[0], style.flowOn ? flow[1] : 0, flow[2], flow[3]],
  };
}

/** Uniforms of `ringWake` (every declared uniform; tested). */
export type WakeUniforms = {
  uColor: number[];
  uWake: number[];
  uCam: number[];
};

/** `ringWake` uniforms; `cam` = [cos yaw, sin yaw, tilt depth, zoom]. */
export function wakeUniforms(
  color: readonly number[],
  alpha: number,
  bodyAngle: number,
  ringRadius: number,
  widthDp: number,
  farAlpha: number,
  cam: readonly number[],
): WakeUniforms {
  "worklet";
  const zoom = Math.max(cam[3], 1e-4);
  return {
    uColor: [color[0], color[1], color[2], alpha],
    uWake: [bodyAngle, ringRadius, widthDp / 2 / zoom, farAlpha],
    uCam: [cam[0], cam[1], cam[2], 0],
  };
}

/** Drift tether as a radial rect: rotate by the body angle, span rail → limb. */
export interface TetherRect {
  /** Rotation (radians, clockwise on screen) taking north onto the body. */
  angle: number;
  /** Local (north-pointing) rect: y from −outer to −inner. */
  inner: number;
  outer: number;
}
export function tetherRect(
  ringRadius: number,
  bodyX: number,
  bodyY: number,
  bodyRadius: number,
): TetherRect | null {
  const seg = tetherSegment(ringRadius, bodyX, bodyY, bodyRadius);
  if (!seg) return null;
  return {
    angle: wakeAngle(bodyX, bodyY),
    inner: Math.hypot(seg.x0, seg.y0),
    outer: Math.hypot(seg.x1, seg.y1),
  };
}

/** Typical world spacing between neighbouring rings (median gap; 0 if < 2). */
export function typicalRingGap(radii: readonly number[]): number {
  const sorted = [...new Set(radii.filter((r) => r > 0))].sort((a, b) => a - b);
  if (sorted.length < 2) return 0;
  const gaps = sorted.slice(1).map((r, i) => r - sorted[i]);
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor((gaps.length - 1) / 2)];
}

/** Ring alpha multiplier for the on-screen ring spacing (see constants). */
export function ringDensityFade(gapWorld: number, zoom: number): number {
  "worklet";
  if (!(gapWorld > 0) || !(zoom > 0)) return 1;
  return Math.max(
    RING_CLUTTER_FLOOR,
    Math.min(1, (gapWorld * zoom) / RING_CLUTTER_GAP_DP),
  );
}
