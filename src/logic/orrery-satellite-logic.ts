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
import { bodyKey, type MoonBump } from "./orrery-frame";
import { IDENTITY_ENTER, IDENTITY_EXIT } from "./orrery-label-logic";

const MOON_RADIUS = 4;
const PARENT_GAP = 24;
export const satelliteKey = bodyKey;

/** One indexed moon: its identity and its precomputed uid-hash angle. */
export interface IndexedMoon {
  uid: string;
  parentId: number;
  parentUid: string;
  /** World angle (radians) of the moon around its parent. */
  angle: number;
}
/** One member parent with at least one moon. */
export interface SatelliteParent {
  id: number;
  uid: string;
  /** Sorted by uid, deduplicated. */
  moons: readonly IndexedMoon[];
  /** The circular mean of the moon angles: where the far-zoom bump sits. */
  bumpAngle: number;
}
/**
 * 38.7-10 (D-52): satellite rows pre-indexed on the JS side, once per (scene
 * generation, rows). A plain, worklet-safe structure: the frame worklet never
 * sorts, stringifies or linearly searches the rows.
 */
export interface SatelliteIndex {
  /** Ascending (parent id, parent uid). */
  parents: readonly SatelliteParent[];
  /** Parent id → true, for the one pass over the world. */
  parentIds: Readonly<Record<number, true>>;
  /** The deduplicated, member-filtered rows in (parentId, uid) order (JS consumers). */
  rows: readonly OrrerySatellite[];
}
export const EMPTY_SATELLITE_INDEX: SatelliteIndex = Object.freeze({
  parents: Object.freeze([]) as readonly SatelliteParent[],
  parentIds: Object.freeze({}),
  rows: Object.freeze([]) as readonly OrrerySatellite[],
});

/**
 * 38.7-10 (C-M3): what the satellite publisher writes to the SharedValue the
 * frame worklet reads. `sceneGeneration` gates it to the frame's own scene.
 */
export interface OrrerySatelliteSpec {
  sceneGeneration: number | null;
  status: "loading" | "ready" | "error";
  index: SatelliteIndex;
}
export const EMPTY_SATELLITE_SPEC: OrrerySatelliteSpec = Object.freeze({
  sceneGeneration: null,
  status: "ready" as const,
  index: EMPTY_SATELLITE_INDEX,
});

/** The deterministic world angle of a moon (its uid hash; unchanged since phase 29). */
export function moonAngle(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i++)
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  return ((hash % 3600) / 3600) * Math.PI * 2;
}

const compareUid = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * JS only (never in a worklet): sorts (parentId, uid), deduplicates by
 * (parentId, parentUid, uid) and keeps only rows whose parent is a current
 * System member (ADR-105: a non-member sun gets no moons), grouped by parent.
 */
export function indexSatellites(
  rows: readonly OrrerySatellite[],
  members: readonly ContactIdentity[],
): SatelliteIndex {
  if (rows.length === 0 || members.length === 0) return EMPTY_SATELLITE_INDEX;
  const member = new Set(members.map((p) => `${p.id}\u0001${p.uid}`));
  const sorted = [...rows].sort(
    (a, b) =>
      a.parentId - b.parentId ||
      compareUid(a.parentUid, b.parentUid) ||
      compareUid(a.uid, b.uid),
  );
  const seen = new Set<string>();
  const kept: OrrerySatellite[] = [];
  const parents: SatelliteParent[] = [];
  const parentIds: Record<number, true> = {};
  let current: { parent: SatelliteParent; moons: IndexedMoon[] } | null = null;
  for (const row of sorted) {
    const parentKey = `${row.parentId}\u0001${row.parentUid}`;
    if (!member.has(parentKey)) continue;
    const key = JSON.stringify([row.parentId, row.parentUid, row.uid]);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
    if (
      !current ||
      current.parent.id !== row.parentId ||
      current.parent.uid !== row.parentUid
    ) {
      current = {
        parent: {
          id: row.parentId,
          uid: row.parentUid,
          moons: [],
          bumpAngle: 0,
        },
        moons: [],
      };
      current.parent.moons = current.moons;
      parents.push(current.parent);
      parentIds[row.parentId] = true;
    }
    current.moons.push({
      uid: row.uid,
      parentId: row.parentId,
      parentUid: row.parentUid,
      angle: moonAngle(row.uid),
    });
  }
  if (kept.length === 0) return EMPTY_SATELLITE_INDEX;
  for (const parent of parents) {
    let sx = 0;
    let sy = 0;
    for (const moon of parent.moons) {
      sx += Math.cos(moon.angle);
      sy += Math.sin(moon.angle);
    }
    // Opposed moons have no mean direction: the first moon's angle then.
    parent.bumpAngle =
      Math.hypot(sx, sy) > 1e-6 ? Math.atan2(sy, sx) : parent.moons[0].angle;
  }
  return { parents, parentIds, rows: kept };
}

/**
 * D-31/M13: 0 = the far-zoom bump, 1 = the moons fully split. A smoothstep
 * over the identity hysteresis band (IDENTITY_EXIT → IDENTITY_ENTER) of the
 * frame's OWN sampled camera zoom — continuous, no clock, no lag.
 */
export function moonSplitFactor(zoom: number): number {
  "worklet";
  if (!Number.isFinite(zoom)) return 0;
  const t = Math.max(
    0,
    Math.min(1, (zoom - IDENTITY_EXIT) / (IDENTITY_ENTER - IDENTITY_EXIT)),
  );
  return t * t * (3 - 2 * t);
}

type SatelliteWorldBody = WorldBody & {
  interactive?: boolean;
  opacity?: number;
};
export interface SatelliteBodies {
  /** Moon bodies (none at split factor 0); interactive only at factor 1. */
  moons: (WorldBody & { opacity: number; interactive: boolean })[];
  /** Parent body key → bump, for every parent drawing moons this frame. */
  bumps: Record<string, MoonBump>;
}

/**
 * World-only placement, applied to the sampled parent before the single
 * projection. D-09/11: membership precedes semantic visibility (the index is
 * member-filtered); no moon can parent another. 38.7-10 (D-31): every parent
 * with moons gets a bump descriptor; at `splitFactor` 0 there are no moon
 * bodies (taps at overview resolve exactly as before); above 0 the moons move
 * from the parent's rim at the bump angle out to `radius + PARENT_GAP` at
 * their own angle, fading in, and are interactive only at factor 1.
 */
export function deriveSatelliteBodies(
  world: readonly SatelliteWorldBody[],
  index: SatelliteIndex,
  enabled: boolean,
  splitFactor: number,
): SatelliteBodies {
  "worklet";
  const moons: SatelliteBodies["moons"] = [];
  const bumps: Record<string, MoonBump> = {};
  if (!enabled || index.parents.length === 0) return { moons, bumps };
  // The FIRST eligible world body per wanted parent id (what `find` returned).
  const parentAt: Record<number, number> = {};
  for (let i = 0; i < world.length; i++) {
    const body = world[i];
    if (
      body.kind !== "satellite" &&
      body.interactive !== false &&
      index.parentIds[body.id] === true &&
      parentAt[body.id] === undefined
    )
      parentAt[body.id] = i;
  }
  const split = Math.max(
    0,
    Math.min(1, Number.isFinite(splitFactor) ? splitFactor : 0),
  );
  for (let p = 0; p < index.parents.length; p++) {
    const entry = index.parents[p];
    const at = parentAt[entry.id];
    if (at === undefined) continue;
    const parent = world[at];
    if (
      !Number.isFinite(parent.x) ||
      !Number.isFinite(parent.y) ||
      !Number.isFinite(parent.radius) ||
      parent.radius <= 0
    )
      continue;
    bumps[bodyKey(parent)] = {
      angle: entry.bumpAngle,
      count: entry.moons.length,
    };
    if (split <= 0) continue;
    const opacity = parent.opacity ?? 1;
    const radius = Math.min(MOON_RADIUS, parent.radius * 0.2);
    for (let m = 0; m < entry.moons.length; m++) {
      const moon = entry.moons[m];
      let angle = moon.angle;
      let offset = parent.radius + PARENT_GAP;
      if (split < 1) {
        // Shortest arc from the bump to the moon's own angle.
        let delta = moon.angle - entry.bumpAngle;
        delta -= Math.round(delta / (Math.PI * 2)) * Math.PI * 2;
        angle = entry.bumpAngle + delta * split;
        offset = parent.radius + PARENT_GAP * split;
      }
      moons.push({
        id: -1,
        kind: "satellite",
        satelliteTarget: {
          kind: "satellite",
          uid: moon.uid,
          parentId: moon.parentId,
          parentUid: moon.parentUid,
        },
        x: parent.x + Math.cos(angle) * offset,
        y: parent.y + Math.sin(angle) * offset,
        radius,
        ringRadius: 0,
        opacity: split < 1 ? opacity * split : opacity,
        interactive: split >= 1,
      });
    }
  }
  return { moons, bumps };
}

/** All plausible contact targets survive mixed ambiguity; relationship IDs never
 * flow to Profile, log or rank. Multiple moons use their accessible parent rows.
 */
export function resolveSatelliteTap(
  frame: ProjectedFrame,
  x: number,
  y: number,
  identities: readonly OrreryContactTarget[],
  members: readonly ContactIdentity[],
): OrreryIntent {
  "worklet";
  const contact = resolveOrreryTap(
    { ...frame, bodies: frame.bodies.filter((b) => b.kind !== "satellite") },
    x,
    y,
    identities,
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
