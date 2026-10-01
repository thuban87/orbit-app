/**
 * ORRERY LAB A (pass 2) — co-angular stacks, presentation only.
 *
 * Contacts at nearly the same interval progress share an angle, and at the
 * tilted Home they can sit almost on top of each other ("BB" under "CC").
 * Positions are data, so nothing moves: `findStacks` only GROUPS visibly
 * overlapping bodies (by their DRAWN discs) so the HUD can mark the front
 * body with one pip per body hidden behind it. Taps are untouched — an
 * ambiguous tap already resolves to the existing group panel.
 *
 * Hermes forward-ref rule: helpers above callers (worklet-order test).
 */
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
import { STACK_OVERLAP } from "./deep-field-config";
import { bodyDepthScale, bodyVisualScale } from "./deep-field-math";

export interface BodyStack {
  /** Index (frame.bodies) of the front-most (nearest) body. */
  front: number;
  /** Indices of the bodies behind it, nearest first. */
  hidden: number[];
  /** Drawn radius (dp) of the front body. */
  radius: number;
}

function findRoot(parent: number[], i: number): number {
  "worklet";
  let r = i;
  while (parent[r] !== r) r = parent[r];
  return r;
}

/** Drawn (visual) radius of a frame body, matching OrbitBody's transform. */
export function drawnRadius(radius: number, far: number): number {
  "worklet";
  return radius * bodyVisualScale(radius) * bodyDepthScale(far);
}

/**
 * Groups visible, interactive contact bodies whose DRAWN discs overlap by
 * more than `STACK_OVERLAP` (centre distance < (rA + rB) × overlap).
 * `farOf(key)` supplies the light map's far factor for the depth shrink.
 */
export function findStacks(
  frame: AnimatedFrame,
  far: Record<string, readonly number[]>,
): BodyStack[] {
  "worklet";
  const idx: number[] = [];
  const rad: number[] = [];
  for (let i = 0; i < frame.bodies.length; i++) {
    const b = frame.bodies[i];
    if (b.kind !== "contact" || !b.visible || !b.interactive) continue;
    if (b.opacity < 0.5) continue;
    idx.push(i);
    rad.push(drawnRadius(b.radius, far[bodyKey(b)]?.[2] ?? 0));
  }
  const parent = idx.map((_, k) => k);
  for (let a = 0; a < idx.length; a++)
    for (let c = a + 1; c < idx.length; c++) {
      const A = frame.bodies[idx[a]];
      const C = frame.bodies[idx[c]];
      const reach = (rad[a] + rad[c]) * STACK_OVERLAP;
      if (Math.abs(A.x - C.x) > reach || Math.abs(A.y - C.y) > reach) continue;
      if (Math.hypot(A.x - C.x, A.y - C.y) < reach) {
        const ra = findRoot(parent, a);
        const rc = findRoot(parent, c);
        if (ra !== rc) parent[rc] = ra;
      }
    }
  const groups: Record<number, number[]> = {};
  for (let k = 0; k < idx.length; k++) {
    const r = findRoot(parent, k);
    if (!groups[r]) groups[r] = [];
    groups[r].push(k);
  }
  const out: BodyStack[] = [];
  for (const key of Object.keys(groups)) {
    const members = groups[Number(key)];
    if (members.length < 2) continue;
    // Nearest first (larger depth = nearer; zIndex draws it on top).
    // Ties (tilt 0) → the later-drawn body is on top.
    members.sort(
      (p, q) =>
        frame.bodies[idx[q]].depth - frame.bodies[idx[p]].depth || q - p,
    );
    out.push({
      front: idx[members[0]],
      hidden: members.slice(1).map((m) => idx[m]),
      radius: rad[members[0]],
    });
  }
  return out;
}
