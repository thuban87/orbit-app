/**
 * ORRERY LAB A — pure, READ-ONLY math for the deep-field renderer.
 *
 * Everything here derives presentation data FROM the existing UI-thread
 * `AnimatedFrame` and switch runtime values; nothing writes back into them, so
 * world/camera/hit/label semantics are untouched (SUBSYSTEM-BRIEF §0, §7).
 *
 * Hermes forward-ref rule: every worklet helper is declared ABOVE its callers
 * (`orrery-worklet-order.test.ts` scans this folder).
 */
import {
  type CameraPose,
  type CameraViewport,
  usableCameraRect,
} from "@/logic/orrery-camera-logic";
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
import {
  ACCELERATE_END,
  CAPTURE_END,
  CAPTURE_START,
  SETTLE_START,
  SHED_END,
  SHED_START,
  type SwitchChoreography,
} from "@/logic/orrery-switch-choreography";
import {
  BODY_FAR_TINT,
  BODY_VISUAL_MAX,
  BODY_VISUAL_MIN_RADIUS,
} from "./deep-field-config";

/** Role codes in `SwitchFx.roles` (index-aligned with `frame.bodies`). */
export const FX_ROLE_RETAINED = 0;
export const FX_ROLE_LEAVING = 1;
export const FX_ROLE_ENTERING = 2;
export const FX_ROLE_ANCHOR = 3;

export interface SwitchFx {
  /** True only while a NON-reduced-motion switch is running (progress < 1). */
  active: boolean;
  progress: number;
  /** 0..1 angular velocity of the spin (plateau = 1). */
  velocity: number;
  /** 0..1 sun flare envelope around the capture window. */
  flare: number;
  /** Signed sky swing (rad) for the starfield/nebula parallax kick. */
  kick: number;
  /** Per entry: FX_ROLE_* (index-aligned with `frame.bodies` for i < length). */
  roles: number[];
  /** Per entry: local stage 0..1 (shed for leaving, capture for entering). */
  stages: number[];
}

export const SWITCH_FX_IDLE: SwitchFx = {
  active: false,
  progress: 1,
  velocity: 0,
  flare: 0,
  kick: 0,
  roles: [],
  stages: [],
};

/**
 * PASS 1: presentation-only body scale for a projected radius (dp). Grows a
 * small body toward BODY_VISUAL_MIN_RADIUS (just under the 22 dp minimum tap
 * radius) capped at BODY_VISUAL_MAX; 1 once the body is already that big, so
 * the drawn disc never exceeds the tap target and labels never collide.
 */
export function bodyVisualScale(projectedRadius: number): number {
  "worklet";
  if (!(projectedRadius > 0)) return 1;
  return Math.max(
    1,
    Math.min(BODY_VISUAL_MAX, BODY_VISUAL_MIN_RADIUS / projectedRadius),
  );
}

function clampUnit(value: number): number {
  "worklet";
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function easeStage(progress: number, start: number, end: number): number {
  "worklet";
  const t = clampUnit((progress - start) / (end - start));
  return t * t * (3 - 2 * t);
}

/**
 * Mirrors the choreography's published velocity curve shape (accelerate → hold
 * → quadratic settle) using only exported stage constants; the runtime's own
 * sampler stays the sole authority for geometry.
 */
function velocityEnvelope(progress: number): number {
  "worklet";
  const p = clampUnit(progress);
  if (p < ACCELERATE_END) return (p / ACCELERATE_END) ** 2;
  if (p < SETTLE_START) return 1;
  const remaining = (1 - p) / (1 - SETTLE_START);
  return remaining * remaining;
}

/**
 * Visual-only switch effects. Returns `SWITCH_FX_IDLE` (all zero) whenever the
 * switch is settled, the transition itself is a reduced-motion choreography, or
 * the live reduced-motion signal is on — so RM gets a plain crossfade only.
 */
export function computeSwitchFx(
  transition: SwitchChoreography,
  progress: number,
  reducedMotion: boolean,
): SwitchFx {
  "worklet";
  if (
    progress >= 1 ||
    reducedMotion ||
    transition.reducedMotion ||
    transition.maximumRotation <= 0
  )
    return SWITCH_FX_IDLE;
  const p = clampUnit(progress);
  const velocity = velocityEnvelope(p);
  const captureMid = (CAPTURE_START + CAPTURE_END) / 2;
  const flareSpan = (CAPTURE_END - CAPTURE_START) * 0.75;
  const flareT = clampUnit(1 - Math.abs(p - captureMid) / flareSpan);
  const roles: number[] = [];
  const stages: number[] = [];
  for (let i = 0; i < transition.entries.length; i++) {
    const entry = transition.entries[i];
    if (entry.role === "leaving") {
      roles.push(FX_ROLE_LEAVING);
      stages.push(
        easeStage(p, SHED_START + entry.stagger, SHED_END + entry.stagger),
      );
    } else if (entry.role === "entering") {
      roles.push(FX_ROLE_ENTERING);
      stages.push(
        easeStage(
          p,
          CAPTURE_START + entry.stagger,
          CAPTURE_END + entry.stagger,
        ),
      );
    } else {
      roles.push(entry.role === "anchor" ? FX_ROLE_ANCHOR : FX_ROLE_RETAINED);
      stages.push(1);
    }
  }
  return {
    active: true,
    progress: p,
    velocity,
    flare:
      flareT * flareT * (3 - 2 * flareT) * (0.55 + 0.45 * transition.intensity),
    kick: velocity * (0.5 + 0.5 * transition.intensity),
    roles,
    stages,
  };
}

/**
 * The exact world-plane → screen homography of `projectWorldPoint`
 * (SUBSYSTEM-BRIEF §2.5), as a row-major Skia 3×3:
 * [scaleX, skewX, transX, skewY, scaleY, transY, persp0, persp1, persp2].
 * Built from the frame's CLAMPED pose so it coincides with hit math.
 */
export function planeHomography(
  pose: CameraPose,
  viewport: CameraViewport,
): number[] {
  "worklet";
  const rect = usableCameraRect(viewport);
  const cx = rect ? rect.x + rect.width / 2 : viewport.width / 2;
  const cy = rect ? rect.y + rect.height / 2 : viewport.height / 2;
  const yaw = pose.yaw ?? 0;
  const tilt = pose.tilt ?? 0;
  const f = pose.focalDistance ?? 256;
  const z = pose.zoom;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const ct = Math.cos(tilt);
  const k = Math.sin(tilt) / f;
  const ox = pose.x;
  const oy = pose.y;
  const w0 = 1 + k * (s * ox + c * oy);
  return [
    z * c - cx * k * s,
    -z * s - cx * k * c,
    -z * (c * ox - s * oy) + cx * w0,
    z * ct * s - cy * k * s,
    z * ct * c - cy * k * c,
    -z * ct * (s * ox + c * oy) + cy * w0,
    -k * s,
    -k * c,
    w0,
  ];
}

/** Inverse of a 3×3 (adjugate / determinant). Identity on a singular input. */
export function invertHomography(m: readonly number[]): number[] {
  "worklet";
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12)
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const inv = 1 / det;
  return [
    A * inv,
    -(b * i - c * h) * inv,
    (b * f - c * e) * inv,
    B * inv,
    (a * i - c * g) * inv,
    -(a * f - c * d) * inv,
    C * inv,
    -(a * h - b * g) * inv,
    (a * e - b * d) * inv,
  ];
}

/** Apply a 3×3 to a point; `w` is the homogeneous divisor (> 0 in front). */
export function mapHomography(
  m: readonly number[],
  x: number,
  y: number,
): { x: number; y: number; w: number } {
  "worklet";
  const w = m[6] * x + m[7] * y + m[8];
  const safe = Math.abs(w) < 1e-9 ? 1e-9 : w;
  return {
    x: (m[0] * x + m[1] * y + m[2]) / safe,
    y: (m[3] * x + m[4] * y + m[5]) / safe,
    w,
  };
}

/** Per-body light data keyed by `bodyKey`: [lightX, lightY, far 0..1]. */
export type BodyLightMap = Record<string, readonly number[]>;

/**
 * One pass over the frame: the screen-space direction from each body to the
 * sun (the single light) and a 0..1 far-depth factor (0 at tilt 0). Bodies
 * keep their own `radius`; this is presentation data only.
 */
export function computeBodyLight(
  frame: AnimatedFrame,
  extent: number,
): BodyLightMap {
  "worklet";
  const out: BodyLightMap = {};
  let sunX = frame.center.x;
  let sunY = frame.center.y;
  for (let i = 0; i < frame.bodies.length; i++) {
    const b = frame.bodies[i];
    if (b.kind === "sun" && b.opacity > 0) {
      sunX = b.x;
      sunY = b.y;
    }
  }
  const sinTilt = Math.sin(frame.pose.tilt ?? 0);
  const span = Math.max(1, extent) * 0.9 * Math.max(sinTilt, 1e-6);
  for (let i = 0; i < frame.bodies.length; i++) {
    const b = frame.bodies[i];
    if (b.kind === "sun") continue;
    const dx = sunX - b.x;
    const dy = sunY - b.y;
    const len = Math.hypot(dx, dy);
    const far = sinTilt > 1e-4 ? clampUnit(-b.depth / span) * BODY_FAR_TINT : 0;
    out[bodyKey(b)] =
      len > 1e-3 ? [dx / len, dy / len, far] : [-0.6, -0.8, far];
  }
  return out;
}
