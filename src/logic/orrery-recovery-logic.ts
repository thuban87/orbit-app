/** ADR-077: bounded recovery and restrained continuation, all transient/UI-thread. */
import { polarisWorldPoint } from "@/components/orrery/orrery-obstacle-logic";
import {
  type CameraCell,
  type CameraPose,
  type CameraViewport,
  clampCameraPose,
  type ProjectedFrame,
  panCamera,
  projectWorldPoint,
} from "./orrery-camera-logic";

export const RECOVERY_MIN_MS = 180;
export const RECOVERY_MAX_MS = 850;
export const REDUCED_RECOVERY_MS = 100;
export const COAST_MS = 120;
export const PAN_COAST_POINTS = 18;
export const YAW_COAST_RADIANS = 0.08;
export const POLARIS_RADIUS = 6;
export const POLARIS_HIT_RADIUS = 22;
export const cameraExtent = (extent: number): number => {
  "worklet";
  return Math.max(32, Number.isFinite(extent) ? extent : 32);
};
export interface CameraRecovery {
  from: CameraPose;
  target: CameraPose;
  animatedTarget: CameraPose;
  duration: number;
  reduced: boolean;
}
export function shortestYaw(from: number, to: number): number {
  "worklet";
  return (
    ((((to - from + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) -
    Math.PI
  );
}
export function northTarget(pose: CameraPose): CameraPose {
  "worklet";
  return { ...pose, yaw: 0 };
}
/** A single smooth acquisition→approach→dock polynomial, not stitched segments. */
export function recoveryCurve(t: number): number {
  "worklet";
  return 1 - (1 - Math.max(0, Math.min(1, t))) ** 5;
}
export function planRecovery(
  from: CameraPose,
  target: CameraPose,
  extent: number,
  reduced: boolean,
): CameraRecovery {
  "worklet";
  const bound = cameraExtent(extent);
  const start = clampCameraPose(from, bound),
    end = clampCameraPose(target, bound);
  const angle = shortestYaw(start.yaw ?? 0, end.yaw ?? 0);
  const distance = Math.hypot(
    (end.x - start.x) / bound,
    (end.y - start.y) / bound,
    Math.log(end.zoom / start.zoom),
    (end.tilt ?? 0) - (start.tilt ?? 0),
    angle,
  );
  return {
    from: start,
    target: end,
    animatedTarget: { ...end, yaw: (start.yaw ?? 0) + angle },
    reduced,
    duration: reduced
      ? REDUCED_RECOVERY_MS
      : RECOVERY_MIN_MS +
        (RECOVERY_MAX_MS - RECOVERY_MIN_MS) * (1 - Math.exp(-distance)),
  };
}
export function sampleRecovery(
  plan: CameraRecovery,
  fraction: number,
): CameraPose {
  "worklet";
  if (fraction >= 1) return plan.target;
  if (fraction <= 0) return plan.from;
  const t = plan.reduced ? fraction : recoveryCurve(fraction);
  const mix = (a: number, b: number) => {
    "worklet";
    return a + (b - a) * t;
  };
  return {
    x: mix(plan.from.x, plan.animatedTarget.x),
    y: mix(plan.from.y, plan.animatedTarget.y),
    zoom: mix(plan.from.zoom, plan.animatedTarget.zoom),
    tilt: mix(plan.from.tilt ?? 0, plan.animatedTarget.tilt ?? 0),
    yaw: mix(plan.from.yaw ?? 0, plan.animatedTarget.yaw ?? 0),
    focalDistance: plan.target.focalDistance,
  };
}
export function inertiaTarget(
  pose: CameraPose,
  kind: "pan" | "yaw",
  vx: number,
  vy: number,
  extent: number,
  viewport: CameraViewport,
  reduced: boolean,
): CameraPose {
  "worklet";
  if (reduced) return pose;
  const cap = (v: number, max: number) => {
    "worklet";
    return Number.isFinite(v)
      ? Math.max(-max, Math.min(max, (v * COAST_MS) / 2000))
      : 0;
  };
  return kind === "pan"
    ? panCamera(
        pose,
        cap(vx, PAN_COAST_POINTS),
        cap(vy, PAN_COAST_POINTS),
        cameraExtent(extent),
        viewport,
      )
    : clampCameraPose(
        { ...pose, yaw: (pose.yaw ?? 0) + cap(vx, YAW_COAST_RADIANS) },
        cameraExtent(extent),
      );
}
export function polarisProjection(frame: ProjectedFrame, extent: number) {
  "worklet";
  return projectWorldPoint(
    polarisWorldPoint(extent),
    frame.pose,
    frame.viewport,
  );
}
export function hitPolaris(
  frame: ProjectedFrame,
  extent: number,
  x: number,
  y: number,
): boolean {
  "worklet";
  const p = polarisProjection(frame, extent);
  // Never steal an ambiguous body tap; the accessible north control always exists.
  return (
    p.x >= 0 &&
    p.y >= 0 &&
    p.x <= frame.viewport.width &&
    p.y <= frame.viewport.height &&
    Math.hypot(x - p.x, y - p.y) <= POLARIS_HIT_RADIUS &&
    !frame.bodies.some(
      (b) =>
        b.interactive !== false && Math.hypot(x - b.x, y - b.y) <= b.hitRadius,
    )
  );
}
export interface MotionRequest {
  plan: CameraRecovery;
  kind: "recovery" | "coast";
}
/** Injected scheduling makes stale-completion/live-preference behavior executable in Node. */
export function createCameraMotion({
  pose,
  epoch,
  active,
  live,
  reduced,
  extent,
  viewport,
  animate,
  cancel,
}: {
  pose: CameraCell<CameraPose>;
  epoch: CameraCell<number>;
  active: CameraCell<MotionRequest | null>;
  live: CameraCell<boolean>;
  reduced: CameraCell<boolean>;
  extent: number;
  viewport: CameraViewport;
  animate: (
    plan: CameraRecovery,
    complete: (finished: boolean) => void,
  ) => void;
  cancel: () => void;
}) {
  const stop = () => {
    "worklet";
    epoch.value += 1;
    active.value = null;
    cancel();
  };
  const recover = (
    target: CameraPose,
    kind: "recovery" | "coast" = "recovery",
  ) => {
    "worklet";
    stop();
    if (!live.value || (kind === "coast" && reduced.value)) return;
    const generation = epoch.value;
    const plan = planRecovery(pose.value, target, extent, reduced.value);
    if (kind === "coast") plan.duration = COAST_MS;
    active.value = { plan, kind };
    animate(plan, (finished) => {
      "worklet";
      if (!finished || !live.value || generation !== epoch.value) return;
      pose.value = plan.target;
      active.value = null;
    });
  };
  const motionChanged = () => {
    "worklet";
    const pending = active.value;
    stop();
    if (pending?.kind === "recovery" && live.value)
      recover(pending.plan.target);
  };
  const coast = (kind: "pan" | "yaw", vx: number, vy: number) => {
    "worklet";
    if (!live.value || reduced.value) return;
    recover(
      inertiaTarget(pose.value, kind, vx, vy, extent, viewport, reduced.value),
      "coast",
    );
  };
  return { stop, recover, coast, motionChanged };
}
