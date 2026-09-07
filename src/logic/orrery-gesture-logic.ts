/** ADR-077: transient input ownership, never a contact/rank mutation. */
import {
  anchorCameraPose,
  type CameraPose,
  type CameraViewport,
  clampCameraPose,
  panCamera,
  type WorldPoint,
} from "./orrery-camera-logic";

export const PAN_DISTANCE = 10;
export const TAP_DISTANCE = 8;
export const HOLD_MS = 850;
export const HOLD_SLOP = 8;
export const TILT_DISTANCE = 28;
export const TILT_RADIANS_PER_POINT = 0.004;
export type InputOwner =
  | "idle"
  | "pending"
  | "pan"
  | "multi"
  | "reorder"
  | "cancelled";
export interface CameraInput {
  owner: InputOwner;
  generation: number;
  pointers: number;
}
export function initialInput(): CameraInput {
  "worklet";
  return { owner: "idle", generation: 0, pointers: 0 };
}
export function beginInput(state: CameraInput, pointers: number): CameraInput {
  "worklet";
  return {
    owner: pointers > 1 ? "multi" : "pending",
    pointers,
    generation: state.generation + 1,
  };
}
export function moveInput(
  state: CameraInput,
  pointers: number,
  distance: number,
): CameraInput {
  "worklet";
  if (state.owner === "cancelled") return state;
  const owner =
    pointers > 1
      ? "multi"
      : state.owner === "multi"
        ? "pan"
        : state.owner === "pending" && distance >= PAN_DISTANCE
          ? "pan"
          : state.owner;
  return {
    owner,
    pointers,
    generation: state.generation + (owner !== state.owner ? 1 : 0),
  };
}
export function claimHold(
  state: CameraInput,
  elapsed: number,
  distance: number,
): CameraInput {
  "worklet";
  return state.owner === "pending" &&
    state.pointers === 1 &&
    elapsed >= HOLD_MS &&
    distance <= HOLD_SLOP
    ? { ...state, owner: "reorder", generation: state.generation + 1 }
    : state;
}
export function cancelInput(state: CameraInput): CameraInput {
  "worklet";
  return { owner: "cancelled", pointers: 0, generation: state.generation + 1 };
}
export type CameraStep =
  | { kind: "pan"; dx: number; dy: number }
  | { kind: "pinch"; delta: number; focal: WorldPoint }
  | { kind: "yaw"; delta: number }
  | { kind: "tilt"; delta: number; travel: number };
/** Incremental samples compose against CURRENT pose, never another recognizer's start pose. */
export function cameraGestureStep(
  pose: CameraPose,
  step: CameraStep,
  viewport: CameraViewport,
  extent: number,
): CameraPose {
  "worklet";
  if (step.kind === "pan")
    return panCamera(pose, step.dx, step.dy, extent, viewport);
  if (step.kind === "pinch") {
    if (
      !Number.isFinite(step.delta) ||
      step.delta <= 0 ||
      !Number.isFinite(step.focal.x) ||
      !Number.isFinite(step.focal.y)
    )
      return pose;
    return anchorCameraPose(
      pose,
      { ...pose, zoom: pose.zoom * step.delta },
      step.focal,
      viewport,
      extent,
    );
  }
  if (!Number.isFinite(step.delta)) return pose;
  if (step.kind === "tilt" && Math.abs(step.travel) < TILT_DISTANCE)
    return pose;
  return clampCameraPose(
    step.kind === "yaw"
      ? { ...pose, yaw: (pose.yaw ?? 0) + step.delta }
      : {
          ...pose,
          tilt: (pose.tilt ?? 0) + step.delta * TILT_RADIANS_PER_POINT,
        },
    extent,
  );
}
