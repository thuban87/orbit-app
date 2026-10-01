/**
 * ORRERY LAB B — per-frame body index (worklets).
 *
 * The legacy renderer runs `frame.bodies.find(bodyKey(b) === key)` in every
 * per-body/per-ring derived value: O(N) per consumer, O(N²) per frame. The lab
 * renderer builds ONE `key → index` map per frame (`indexFrame`) and every
 * keyed consumer resolves through `bodyAt` in O(1).
 *
 * Hermes rule: helpers are declared ABOVE their worklet callers (guarded by
 * `orrery-worklet-order.test.ts`, which scans this folder recursively).
 */
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { bodyKey } from "@/logic/orrery-frame";

export type FrameBody = AnimatedFrame["bodies"][number];
export type FrameIndex = Record<string, number>;

/** Build the key → index map for one frame. */
export function indexFrame(frame: AnimatedFrame): FrameIndex {
  "worklet";
  const index: FrameIndex = {};
  const bodies = frame.bodies;
  for (let i = 0; i < bodies.length; i++) index[bodyKey(bodies[i])] = i;
  return index;
}

/** The body for `key` in `frame`, or undefined (index may be one frame stale). */
export function bodyAt(
  frame: AnimatedFrame,
  index: FrameIndex,
  key: string,
): FrameBody | undefined {
  "worklet";
  const i = index[key];
  if (i === undefined) return undefined;
  const body = frame.bodies[i];
  // Guard a stale index (the map and frame are separate derived values).
  return body && bodyKey(body) === key ? body : undefined;
}

export interface LabBillboard {
  x: number;
  y: number;
  /** projected radius / world radius; 0 hides the body entirely. */
  scale: number;
  depth: number;
  opacity: number;
}

const HIDDEN: LabBillboard = { x: 0, y: 0, scale: 0, depth: 0, opacity: 0 };
/** Below this alpha a body is collapsed to scale 0 (no layer to hide it). */
const MIN_VISIBLE_ALPHA = 0.004;

/**
 * Lab billboard: like `billboardPose`, but an absent / culled / faded-out body
 * collapses to scale 0. The lab draws bodies WITHOUT a per-body saveLayer, so
 * this collapse is what keeps an invisible body (and its glyphs, which ignore
 * paint alpha) from drawing at all.
 */
export function labBillboard(
  frame: AnimatedFrame,
  index: FrameIndex,
  key: string,
  worldRadius: number,
): LabBillboard {
  "worklet";
  const b = bodyAt(frame, index, key);
  if (!b?.visible || b.opacity < MIN_VISIBLE_ALPHA || worldRadius <= 0)
    return HIDDEN;
  return {
    x: b.x,
    y: b.y,
    scale: b.radius / worldRadius,
    depth: b.depth,
    opacity: b.opacity,
  };
}
