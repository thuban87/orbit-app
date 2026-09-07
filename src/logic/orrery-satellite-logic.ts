import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import type { ContactIdentity } from "@/db/orrery-system-read";
import {
  MIN_HIT_RADIUS,
  type OrreryIntent,
  type ProjectedFrame,
  type WorldBody,
} from "./orrery-camera-logic";
import {
  type OrreryContactTarget,
  orderContactTargets,
  resolveOrreryTap,
} from "./orrery-focus-logic";
import { bodyKey } from "./orrery-frame";
import type { SemanticLevel } from "./orrery-label-logic";

const MOON_RADIUS = 4;
const PARENT_GAP = 24;
export const satelliteKey = bodyKey;
/** World-only placement, applied to the sampled parent before the single projection.
 * D-09/11: membership precedes semantic visibility; no moon can parent another.
 */
export function deriveSatelliteBodies(
  world: readonly (WorldBody & { interactive?: boolean; opacity?: number })[],
  rows: readonly OrrerySatellite[],
  members: readonly ContactIdentity[],
  enabled: boolean,
  level: SemanticLevel,
) {
  "worklet";
  if (!enabled || level === "overview") return [];
  const seen: string[] = [];
  return [...rows]
    .sort(
      (a, b) =>
        a.parentId - b.parentId || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0),
    )
    .flatMap((row) => {
      if (
        !members.some((p) => p.id === row.parentId && p.uid === row.parentUid)
      )
        return [];
      const parent = world.find(
        (b) =>
          b.kind !== "satellite" &&
          b.id === row.parentId &&
          b.interactive !== false,
      );
      if (
        !parent ||
        ![parent.x, parent.y, parent.radius].every(Number.isFinite) ||
        parent.radius <= 0
      )
        return [];
      const target = {
        kind: "satellite" as const,
        uid: row.uid,
        parentId: row.parentId,
        parentUid: row.parentUid,
      };
      const key = JSON.stringify([row.parentId, row.parentUid, row.uid]);
      if (seen.includes(key)) return [];
      seen.push(key);
      let hash = 0;
      for (let i = 0; i < row.uid.length; i++)
        hash = (hash * 31 + row.uid.charCodeAt(i)) >>> 0;
      const angle = ((hash % 3600) / 3600) * Math.PI * 2;
      const offset = parent.radius + PARENT_GAP;
      return [
        {
          id: -1,
          kind: "satellite" as const,
          satelliteTarget: target,
          x: parent.x + Math.cos(angle) * offset,
          y: parent.y + Math.sin(angle) * offset,
          radius: Math.min(MOON_RADIUS, parent.radius * 0.2),
          ringRadius: 0,
          opacity: parent.opacity ?? 1,
          interactive: true,
        },
      ];
    });
}

/** All plausible contact targets survive mixed ambiguity; relationship IDs never
 * flow to Profile, log or rank. Multiple moons use their accessible parent rows.
 */
export function resolveSatelliteTap(
  frame: ProjectedFrame,
  x: number,
  y: number,
  identities: readonly OrreryContactTarget[],
  visibleNames: readonly string[],
  members: readonly ContactIdentity[],
): OrreryIntent {
  "worklet";
  const contact = resolveOrreryTap(
    { ...frame, bodies: frame.bodies.filter((b) => b.kind !== "satellite") },
    x,
    y,
    identities,
    visibleNames,
    members,
  );
  const moons = frame.bodies.filter(
    (b) =>
      b.kind === "satellite" &&
      b.satelliteTarget &&
      b.interactive !== false &&
      members.some(
        (p) =>
          p.id === b.satelliteTarget?.parentId &&
          p.uid === b.satelliteTarget?.parentUid,
      ) &&
      x >= 0 &&
      y >= 0 &&
      x <= frame.viewport.width &&
      y <= frame.viewport.height &&
      Math.hypot(x - b.x, y - b.y) <= Math.max(MIN_HIT_RADIUS, b.hitRadius),
  );
  if (!moons.length) return contact;
  if (!contact.ids.length && moons.length === 1)
    return {
      kind: "satellite",
      generation: frame.generation,
      ids: [],
      satelliteTarget: moons[0].satelliteTarget,
    };
  const targets = orderContactTargets(
    [
      ...(contact.targets ?? []),
      ...moons.flatMap((b) => {
        const target = identities.find(
          (p) =>
            p.id === b.satelliteTarget?.parentId &&
            p.uid === b.satelliteTarget?.parentUid,
        );
        return target ? [target] : [];
      }),
    ],
    members,
  );
  return {
    kind: "group",
    generation: frame.generation,
    ids: targets.map((t) => t.id),
    targets,
  };
}
