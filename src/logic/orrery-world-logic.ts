/**
 * ADR-046/ADR-011: read-time dense rank and timestamp progress; never persist
 * positions or fabricate neutral progress. ADR-077 separates world and camera.
 * ADR-027 retains derived/full-history/floor/connected-scope Gravity policy.
 * Phase08 dossier §E/§Z and ORRC-03/15 authorize modest mass/context, extending
 * its older profile-only restriction (KB partial supersession handoff:29-12).
 */
import type { OrreryDensity } from "@/db/app-settings-dao";
import type { OrrerySystemMember } from "@/db/orrery-system-read";
import { ROGUE_K, WOBBLE_MAX } from "@/db/status";
import type { WorldBody } from "@/logic/orrery-camera-logic";
import {
  DECAY_DRIFT_SPAN,
  PLANET_RADIUS,
  polarToXY,
  progressToAngle,
  ROGUE_DRIFT_SPAN,
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
function drift(member: OrrerySystemMember): number {
  if (member.progress === null || member.status === null) return 0;
  if (member.status === "rogue") return ROGUE_DRIFT_SPAN;
  if (member.status === "decay")
    return (
      Math.max(
        0,
        Math.min(1, (member.progress - WOBBLE_MAX) / (ROGUE_K - WOBBLE_MAX)),
      ) * DECAY_DRIFT_SPAN
    );
  return 0;
}
function uidSign(uid: string): number {
  let hash = 2166136261;
  for (let i = 0; i < uid.length; i++)
    hash = Math.imul(hash ^ uid.charCodeAt(i), 16777619);
  return (hash >>> 0) % 2 === 0 ? 1 : -1;
}
/** Neighborhoods use Balanced geometry, never camera/density. The widest preset
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
  const base = ordered.map((member, index) => {
    const angle =
      member.progress === null
        ? NEUTRAL_RESTING_ANGLE
        : progressToAngle(member.progress);
    const push = drift(member);
    const referenceRadius =
      DENSITY_PRESETS.balanced.ringInner +
      index * DENSITY_PRESETS.balanced.ringGap +
      push;
    return {
      member,
      index,
      angle,
      push,
      radius: PLANET_RADIUS * gravityMassModifier(gravity.get(member.id)),
      ...polarToXY(0, 0, referenceRadius, angle),
    };
  });
  const preset = DENSITY_PRESETS[density];
  const bodies: OrreryWorldBody[] = base.map((entry) => {
    const collision =
      entry.member.progress !== null &&
      base.some(
        (other) =>
          other.member.id !== entry.member.id &&
          Math.hypot(entry.x - other.x, entry.y - other.y) <
            entry.radius + other.radius + COLLISION_CLEARANCE,
      );
    const widestRadius =
      DENSITY_PRESETS.spacious.ringInner +
      entry.index * DENSITY_PRESETS.spacious.ringGap +
      entry.push;
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
      ...polarToXY(0, 0, ringRadius + entry.push, angle),
    };
  });
  bodies.push(sun);
  const extent = bodies.reduce(
    (max, body) =>
      Math.max(
        max,
        body.ringRadius + body.radius,
        Math.hypot(body.x, body.y) + body.radius,
      ),
    sun.radius,
  );
  return { bodies, extent };
}
