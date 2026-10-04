/**
 * 38.7-10 (D-54): co-angular stacks, presentation only (Lab A body-stack.ts,
 * rewritten indexed).
 *
 * Contacts at nearly the same angle can sit almost on top of each other,
 * more so at the 62° tilt (Pitfall 11). Positions are data, so nothing moves:
 * `detectStacks` only GROUPS visibly overlapping contacts of a projected frame
 * so the front body can carry one ring-coloured pip per body hidden behind it.
 * Taps are untouched — an ambiguous tap already resolves to the group panel.
 *
 * Indexed: a screen-space uniform grid (cell = 2 × the largest radius) means
 * only bodies in neighbouring cells are compared — never a pairwise scan.
 * Groups are transitive (union-find), exactly Lab A's grouping.
 *
 * Hermes forward-ref rule: helpers above callers.
 */
import type { BodyStack } from "./orrery-frame";

/**
 * Two discs stack when they overlap by at least this fraction of the smaller
 * radius (equal radii: centre distance < 0.8 × (rA + rB), Lab A's
 * STACK_OVERLAP 0.8).
 */
export const STACK_OVERLAP_FRACTION = 0.4;
/** Most pips per front body; beyond it the last pip is the "more" marker. */
export const PIP_MAX = 4;
/** Bodies fainter than this (mid-transition) never take part (Lab A). */
const STACK_MIN_OPACITY = 0.5;
/** Grid key packing (cells are a few hundred at most on any screen). */
const GRID_SPAN = 65536;
const GRID_BIAS = 32768;

/** The frame-body fields stack detection reads. */
export interface StackBody {
  kind: string;
  x: number;
  y: number;
  radius: number;
  depth: number;
  visible: boolean;
  interactive: boolean;
  opacity: number;
}

/** Whether a frame body takes part in stacks (visible, interactive contacts). */
export function stackEligible(body: StackBody): boolean {
  "worklet";
  return (
    body.kind === "contact" &&
    body.visible &&
    body.interactive &&
    body.opacity >= STACK_MIN_OPACITY &&
    body.radius > 0 &&
    Number.isFinite(body.x) &&
    Number.isFinite(body.y) &&
    Number.isFinite(body.radius)
  );
}

/** Whether two eligible discs overlap enough to stack. */
export function discsStack(a: StackBody, b: StackBody): boolean {
  "worklet";
  const reach =
    a.radius + b.radius - STACK_OVERLAP_FRACTION * Math.min(a.radius, b.radius);
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < reach * reach;
}

function findRoot(parent: number[], i: number): number {
  "worklet";
  let root = i;
  while (parent[root] !== root) root = parent[root];
  // Path compression.
  let at = i;
  while (parent[at] !== root) {
    const next = parent[at];
    parent[at] = root;
    at = next;
  }
  return root;
}

/**
 * Builds the stacks from union-find roots over the eligible frame indices
 * `idx`: per group of ≥ 2, the front (largest depth; ties → the later frame
 * index, drawn on top) and the rest nearest first, capped at PIP_MAX.
 */
export function stacksFromGroups(
  bodies: readonly StackBody[],
  idx: readonly number[],
  parent: number[],
): Record<number, BodyStack> {
  "worklet";
  const groups: Record<number, number[]> = {};
  const roots: number[] = [];
  for (let k = 0; k < idx.length; k++) {
    const root = findRoot(parent, k);
    let group = groups[root];
    if (!group) {
      group = [];
      groups[root] = group;
      roots.push(root);
    }
    group.push(idx[k]);
  }
  const out: Record<number, BodyStack> = {};
  for (let g = 0; g < roots.length; g++) {
    const members = groups[roots[g]];
    if (members.length < 2) continue;
    members.sort((p, q) => bodies[q].depth - bodies[p].depth || q - p);
    const hidden = members.slice(1);
    out[members[0]] = {
      front: members[0],
      hidden: hidden.slice(0, PIP_MAX),
      overflow: hidden.length > PIP_MAX,
    };
  }
  return out;
}

/**
 * D-54: the frame's stacks, keyed by the front body's frame index. Computed
 * once per frame in the frame worklet over the projected bodies.
 */
export function detectStacks(
  bodies: readonly StackBody[],
): Record<number, BodyStack> {
  "worklet";
  const idx: number[] = [];
  let maxRadius = 0;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (!stackEligible(body)) continue;
    idx.push(i);
    if (body.radius > maxRadius) maxRadius = body.radius;
  }
  if (idx.length < 2) return {};
  // Any stacking pair is closer than 2 × maxRadius, so it sits in the same
  // or a neighbouring cell.
  const cell = Math.max(1, maxRadius * 2);
  const grid: Record<number, number[]> = {};
  const gx: number[] = [];
  const gy: number[] = [];
  for (let k = 0; k < idx.length; k++) {
    const body = bodies[idx[k]];
    const x = Math.floor(body.x / cell);
    const y = Math.floor(body.y / cell);
    gx.push(x);
    gy.push(y);
    const key = (x + GRID_BIAS) * GRID_SPAN + (y + GRID_BIAS);
    const list = grid[key];
    if (list) list.push(k);
    else grid[key] = [k];
  }
  const parent: number[] = [];
  for (let k = 0; k < idx.length; k++) parent.push(k);
  for (let k = 0; k < idx.length; k++) {
    const a = bodies[idx[k]];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const list =
          grid[(gx[k] + dx + GRID_BIAS) * GRID_SPAN + (gy[k] + dy + GRID_BIAS)];
        if (!list) continue;
        for (let n = 0; n < list.length; n++) {
          const j = list[n];
          if (j <= k || !discsStack(a, bodies[idx[j]])) continue;
          const ra = findRoot(parent, k);
          const rb = findRoot(parent, j);
          if (ra !== rb) parent[rb] = ra;
        }
      }
  }
  return stacksFromGroups(bodies, idx, parent);
}

/**
 * The pip angles (radians, screen convention) for `count` pips around a
 * front body: centred on the side OPPOSITE its moon bump when it has one
 * (D-54: pips and bumps never share a side), else on `anchor`; `step` apart.
 */
export function pipAngles(
  count: number,
  step: number,
  anchor: number,
  bumpAngle: number | null,
): number[] {
  "worklet";
  const centre = bumpAngle === null ? anchor : bumpAngle + Math.PI;
  const out: number[] = [];
  for (let k = 0; k < count; k++)
    out.push(centre + (k - (count - 1) / 2) * step);
  return out;
}
