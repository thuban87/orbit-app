/**
 * ADR-046/ADR-011: read-time dense rank and timestamp progress; never persist
 * positions or fabricate neutral progress. ADR-077 separates world and camera.
 * ADR-027 retains derived/full-history/floor/connected-scope Gravity policy.
 * Phase08 dossier §E/§Z and ORRC-03/15 authorize modest mass/context, extending
 * its older profile-only restriction (KB partial supersession handoff:29-12).
 */
import type { OrreryDensity } from "@/db/app-settings-dao";
import type { OrrerySystemMember } from "@/db/orrery-system-read";
import type { WorldBody } from "@/logic/orrery-camera-logic";
import {
  PLANET_RADIUS,
  polarToXY,
  progressToAngle,
} from "@/logic/orrery-geometry-logic";
import type { GravityResult } from "@/services/gravity-logic";

export const DENSITY_PRESETS = {
  spacious: { ringInner: 68, ringGap: 44 },
  balanced: { ringInner: 58, ringGap: 34 },
  compact: { ringInner: 58, ringGap: 32 },
} as const;
export const NEUTRAL_RESTING_ANGLE = 0;
/** At most one degree AND four world units of arc displacement. */
export const MAX_NUDGE_ANGLE = Math.PI / 180;
export const MAX_NUDGE_WORLD = 4;
const COLLISION_CLEARANCE = 8;
const MIN_MASS = 0.9;
const MAX_MASS = 1.1;

export function gravityMassModifier(
  gravity: GravityResult | undefined,
): number {
  return gravity
    ? MIN_MASS +
        (MAX_MASS - MIN_MASS) *
          Math.max(
            0,
            Math.min(1, gravity.tierIndex / Math.max(1, gravity.tierCount - 1)),
          )
    : 1;
}
type RankedMember = OrrerySystemMember & { created_at?: string };
export function orderOrreryMembers(
  members: readonly RankedMember[],
): RankedMember[] {
  return [...members].sort(
    (a, b) =>
      (a.ring_seq ?? 1e9) - (b.ring_seq ?? 1e9) ||
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.id - b.id,
  );
}
export interface OrreryWorldBody extends WorldBody {
  angle?: number;
  nudgeAngle?: number;
}
function uidSign(uid: string): number {
  let hash = 2166136261;
  for (let i = 0; i < uid.length; i++)
    hash = Math.imul(hash ^ uid.charCodeAt(i), 16777619);
  return (hash >>> 0) % 2 === 0 ? 1 : -1;
}
interface ReferenceBody {
  member: RankedMember;
  index: number;
  angle: number;
  radius: number;
  x: number;
  y: number;
}
/**
 * Indexes of the reference bodies that touch another member's reference body
 * (centre distance < r_a + r_b + COLLISION_CLEARANCE). A uniform grid whose
 * cell is at least the largest possible touch distance means only the 3×3
 * neighbouring cells can hold a touching body, so this is O(N) on spread
 * Systems and returns exactly the set the old all-pairs scan returned (pinned
 * by an equivalence test). Neutrals are candidates here; the caller still
 * never nudges them.
 */
export function collidingReferenceIndexes(
  base: readonly {
    member: { id: number };
    radius: number;
    x: number;
    y: number;
  }[],
): Set<number> {
  const colliding = new Set<number>();
  if (base.length < 2) return colliding;
  let largest = 0;
  for (const entry of base)
    if (Number.isFinite(entry.radius))
      largest = Math.max(largest, entry.radius);
  const cell = Math.max(1, largest * 2 + COLLISION_CLEARANCE);
  const grid = new Map<string, number[]>();
  const cellOf = (entry: { x: number; y: number }) =>
    [Math.floor(entry.x / cell), Math.floor(entry.y / cell)] as const;
  // Non-finite positions or radii can never satisfy the strict `<` test, so
  // they are left out of the grid exactly as the brute-force scan ignored them.
  const finite = (entry: { x: number; y: number; radius: number }) =>
    Number.isFinite(entry.x) &&
    Number.isFinite(entry.y) &&
    Number.isFinite(entry.radius);
  base.forEach((entry, index) => {
    if (!finite(entry)) return;
    const [cx, cy] = cellOf(entry);
    const key = `${cx},${cy}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(index);
    else grid.set(key, [index]);
  });
  base.forEach((entry, index) => {
    if (!finite(entry)) return;
    const [cx, cy] = cellOf(entry);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx},${cy + dy}`);
        if (!bucket) continue;
        for (const otherIndex of bucket) {
          const other = base[otherIndex];
          if (
            other.member.id !== entry.member.id &&
            Math.hypot(entry.x - other.x, entry.y - other.y) <
              entry.radius + other.radius + COLLISION_CLEARANCE
          ) {
            colliding.add(index);
            return;
          }
        }
      }
  });
  return colliding;
}
/** D-12: every contact sits exactly ON its orbit line; status is carried by the
 * ring colour and the timestamp angle, never by an outward push.
 * Neighborhoods use Balanced geometry, never camera/density. The widest preset
 * bounds arc displacement, keeping UID correction stable across density changes.
 * Neutrals always retain their fixed resting angle; crowded regions use focus.
 */
export function deriveOrreryWorld(
  members: readonly RankedMember[],
  density: OrreryDensity,
  gravity: ReadonlyMap<number, GravityResult>,
  sun: WorldBody,
): { bodies: OrreryWorldBody[]; extent: number } {
  const ordered = orderOrreryMembers(members);
  const base: ReferenceBody[] = ordered.map((member, index) => {
    const angle =
      member.progress === null
        ? NEUTRAL_RESTING_ANGLE
        : progressToAngle(member.progress);
    const referenceRadius =
      DENSITY_PRESETS.balanced.ringInner +
      index * DENSITY_PRESETS.balanced.ringGap;
    return {
      member,
      index,
      angle,
      radius: PLANET_RADIUS * gravityMassModifier(gravity.get(member.id)),
      ...polarToXY(0, 0, referenceRadius, angle),
    };
  });
  const colliding = collidingReferenceIndexes(base);
  const preset = DENSITY_PRESETS[density];
  const bodies: OrreryWorldBody[] = base.map((entry, index) => {
    const collision = entry.member.progress !== null && colliding.has(index);
    const widestRadius =
      DENSITY_PRESETS.spacious.ringInner +
      entry.index * DENSITY_PRESETS.spacious.ringGap;
    const nudgeAngle = collision
      ? uidSign(entry.member.uid) *
        Math.min(MAX_NUDGE_ANGLE, MAX_NUDGE_WORLD / widestRadius)
      : 0;
    const ringRadius = preset.ringInner + entry.index * preset.ringGap;
    const angle = entry.angle + nudgeAngle;
    return {
      id: entry.member.id,
      kind: "contact",
      radius: entry.radius,
      ringRadius,
      angle,
      nudgeAngle,
      ...polarToXY(0, 0, ringRadius, angle),
    };
  });
  bodies.push(sun);
  // Bodies are on their rings, so the outermost ring plus its body bounds it.
  const extent = bodies.reduce(
    (max, body) => Math.max(max, body.ringRadius + body.radius),
    sun.radius,
  );
  return { bodies, extent };
}
