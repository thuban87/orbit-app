/** ADR-046/077: contacted-only, snapshot-bound radial preview; no durable geometry. */
import type { RingReorderRequest } from "@/db/ring-seq-dao";
import {
  collectHitCandidates,
  type ProjectedFrame,
  tryUnprojectToWorldPlane,
  type WorldBody,
} from "./orrery-camera-logic";
import { computeRingReorder } from "./ring-reorder-logic";

export type ReorderExpectation = Omit<
  RingReorderRequest,
  "reorderedVisibleIds"
>;
export interface ReorderDrag {
  generation: number;
  id: number;
  request: ReorderExpectation;
  /** World ring radii of the eligible slots, from the frame's `worldRingRadius`. */
  radii: number[];
  offset: { x: number; y: number };
  reorderedVisibleIds: number[];
  active: boolean;
  origin: { x: number; y: number };
}
export interface ReorderIntent {
  generation: number;
  request: RingReorderRequest;
}
export function captureReorder(
  frame: ProjectedFrame,
  request: ReorderExpectation,
  x: number,
  y: number,
): ReorderDrag | null {
  "worklet";
  // A plausible moon hit never authorizes reordering its overlapping contact.
  if (
    frame.bodies.some(
      (body) =>
        body.kind === "satellite" &&
        body.interactive !== false &&
        Math.hypot(x - body.x, y - body.y) <= body.hitRadius,
    )
  )
    return null;
  const hits = collectHitCandidates(frame, x, y);
  if (
    hits.length !== 1 ||
    !request.expectedEligibleVisibleIds.includes(hits[0])
  )
    return null;
  const body = frame.bodies.find(
    (b) => b.id === hits[0] && b.kind === "contact",
  );
  if (!body) return null;
  const center = tryUnprojectToWorldPlane(body, frame.pose, frame.viewport);
  const pointer = tryUnprojectToWorldPlane(
    { x, y },
    frame.pose,
    frame.viewport,
  );
  if (!center || !pointer) return null;
  // D-12: bodies sit on their rings, so the frame's world ring radius is the
  // slot geometry directly (no projected-radius / zoom recovery, no drift).
  const radii = request.expectedEligibleVisibleIds.map(
    (id) => frame.bodies.find((b) => b.id === id)?.worldRingRadius,
  );
  if (radii.some((radius) => radius === undefined || !Number.isFinite(radius)))
    return null;
  return {
    generation: frame.generation,
    id: body.id,
    request,
    radii: radii as number[],
    offset: { x: pointer.x - center.x, y: pointer.y - center.y },
    reorderedVisibleIds: [...request.expectedEligibleVisibleIds],
    active: false,
    origin: { x, y },
  };
}
/** Midpoint ties choose the outer slot (nearest integer); extremes clamp. */
export function moveReorder(
  drag: ReorderDrag,
  frame: ProjectedFrame,
  x: number,
  y: number,
): ReorderDrag | null {
  "worklet";
  // Unreachable samples cancel the entire hold; returning to ground cannot revive it.
  const point = tryUnprojectToWorldPlane({ x, y }, frame.pose, frame.viewport);
  if (!point) return null;
  // The pointer's world radius, corrected only by the grab offset.
  const radius = Math.hypot(point.x - drag.offset.x, point.y - drag.offset.y);
  if (!Number.isFinite(radius)) return null;
  let nearest = 0;
  for (let i = 1; i < drag.radii.length; i++)
    if (radius >= (drag.radii[i - 1] + drag.radii[i]) / 2 - 1e-8) nearest = i;
  return {
    ...drag,
    reorderedVisibleIds: computeRingReorder(
      drag.request.expectedEligibleVisibleIds,
      drag.request.expectedEligibleVisibleIds.indexOf(drag.id),
      nearest,
    ),
  };
}
export function releaseReorder(
  drag: ReorderDrag | null,
  generation: number,
  success: boolean,
): ReorderIntent | null {
  "worklet";
  if (
    !drag ||
    !success ||
    generation !== drag.generation ||
    drag.reorderedVisibleIds.every(
      (id, i) => id === drag.request.expectedEligibleVisibleIds[i],
    )
  )
    return null;
  return {
    generation: drag.generation,
    request: { ...drag.request, reorderedVisibleIds: drag.reorderedVisibleIds },
  };
}
/** Keep each body's angle; only the selected contacted slots swap radii, and a
 * moved body sits on its new ring along its own angle (D-12). */
export function previewReorder<T extends WorldBody>(
  world: readonly T[],
  drag: ReorderDrag | null,
): T[] {
  "worklet";
  if (!drag?.active) return [...world];
  return world.map((body) => {
    const index = drag.reorderedVisibleIds.indexOf(body.id);
    if (index < 0 || body.kind !== "contact") return body;
    const radius = drag.radii[index],
      distance = Math.hypot(body.x, body.y);
    return {
      ...body,
      ringRadius: radius,
      x: distance ? (body.x * radius) / distance : 0,
      y: distance ? (body.y * radius) / distance : -radius,
    };
  });
}
