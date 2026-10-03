import { describe, expect, it } from "vitest";
import type { OrrerySystemMember } from "@/db/orrery-system-read";
import { progressToAngle } from "@/logic/orrery-geometry-logic";
import {
  collidingReferenceIndexes,
  DENSITY_PRESETS,
  deriveOrreryWorld,
  gravityMassModifier,
  MAX_NUDGE_ANGLE,
  MAX_NUDGE_WORLD,
  NEUTRAL_RESTING_ANGLE,
} from "@/logic/orrery-world-logic";
import { computeContactGravity } from "@/services/impact";

function member(
  id: number,
  overrides: Partial<OrrerySystemMember> = {},
): OrrerySystemMember {
  return {
    id,
    uid: `uid-${id}`,
    name: `Person ${id}`,
    photo: null,
    ring_seq: id,
    status: "stable",
    progress: 0,
    last_contact: "2026-09-07",
    rarely_responds: 0,
    favourite_rank: null,
    ...overrides,
  };
}
const sun = {
  id: 0,
  kind: "sun" as const,
  x: 0,
  y: 0,
  radius: 30,
  ringRadius: 0,
};
describe("density-aware canonical world", () => {
  it.each([0, 1, 6, 10, 100])(
    "grows %i dense rings with count-independent minimum spacing and finite extent",
    (count) => {
      const members = Array.from({ length: count }, (_, i) => member(i + 1));
      for (const density of ["spacious", "balanced", "compact"] as const) {
        const result = deriveOrreryWorld(members, density, new Map(), sun);
        expect(result.bodies).toHaveLength(count + 1);
        expect(Number.isFinite(result.extent)).toBe(true);
        for (let i = 1; i < count; i++)
          expect(
            result.bodies[i].ringRadius - result.bodies[i - 1].ringRadius,
          ).toBe(DENSITY_PRESETS[density].ringGap);
        if (count === 100) expect(result.extent).toBeGreaterThan(3000);
      }
    },
  );
  it("uses dense display ranks without rewriting sparse/equal/null stored ranks; ties use creation then id", () => {
    const members = [
      { ...member(4, { ring_seq: null }), created_at: "2026-01-01" },
      { ...member(3, { ring_seq: 50 }), created_at: "2026-01-01" },
      { ...member(2, { ring_seq: 50 }), created_at: "2026-01-01" },
      { ...member(1, { ring_seq: 50 }), created_at: "2025-01-01" },
    ];
    const before = structuredClone(members);
    const result = deriveOrreryWorld(members, "balanced", new Map(), sun);
    expect(result.bodies.map((b) => b.id)).toEqual([1, 2, 3, 4, 0]);
    expect(members).toEqual(before);
  });
  it("preserves neutral and timestamp semantics across all densities with deterministic bounded local nudges", () => {
    const members = [
      member(1, { progress: null, status: null, last_contact: null }),
      member(2, { progress: 3, status: "rogue" }),
      member(3, { progress: 0, status: "stable" }),
      member(4, { progress: 0, status: "stable" }),
    ];
    for (const density of ["spacious", "balanced", "compact"] as const) {
      const first = deriveOrreryWorld(members, density, new Map(), sun);
      expect(deriveOrreryWorld(members, density, new Map(), sun)).toEqual(
        first,
      );
      expect(first.bodies[0]).toMatchObject({
        x: 0,
        y: -first.bodies[0].ringRadius,
      });
      for (const body of first.bodies.slice(0, -1)) {
        expect(Math.abs(body.nudgeAngle ?? 0)).toBeLessThanOrEqual(
          MAX_NUDGE_ANGLE,
        );
        expect(
          Math.abs(body.nudgeAngle ?? 0) * Math.hypot(body.x, body.y),
        ).toBeLessThanOrEqual(MAX_NUDGE_WORLD + 1e-9);
      }
      expect(first.bodies[0].angle).toBe(NEUTRAL_RESTING_ANGLE);
      expect(first.bodies[2].angle! - (first.bodies[2].nudgeAngle ?? 0)).toBe(
        progressToAngle(0),
      );
    }
    expect(members[0].progress).toBeNull();
  });
  it("only nudges collision neighbors, leaving isolated canonical angles exact", () => {
    const collision = [
      member(1, { status: "rogue", progress: 3 }),
      member(2),
      member(3),
    ];
    const result = deriveOrreryWorld(collision, "balanced", new Map(), sun);
    expect(result.bodies.some((b) => (b.nudgeAngle ?? 0) !== 0)).toBe(true);
    const isolated = deriveOrreryWorld(
      [member(1, { progress: 0.2 }), member(2, { progress: 0.7 })],
      "balanced",
      new Map(),
      sun,
    );
    expect(isolated.bodies.every((b) => (b.nudgeAngle ?? 0) === 0)).toBe(true);
  });
  it("keeps canonical Gravity connected scope and bounded visual mass secondary to zoom", () => {
    const inputs = {
      trackingEnabled: 1,
      intervalDays: 30,
      rarelyResponds: 1,
      interactions: Array.from({ length: 100 }, () => ({
        occurredAt: "2026-09-07",
        connected: 0,
        direction: "inbound",
      })),
    };
    const low = computeContactGravity(inputs, "2026-09-07");
    const high = computeContactGravity(
      { ...inputs, rarelyResponds: 0 },
      "2026-09-07",
    );
    expect(gravityMassModifier(low)).toBe(0.9);
    expect(gravityMassModifier(high)).toBe(1.1);
    const result = deriveOrreryWorld(
      [member(1), member(2)],
      "balanced",
      new Map([
        [1, low],
        [2, high],
      ]),
      sun,
    );
    expect(result.bodies[0].radius).toBeLessThan(result.bodies[1].radius);
  });
});

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
/** The pre-38.7 all-pairs collision scan, kept verbatim as the oracle. */
function bruteForceColliding(
  base: readonly {
    member: { id: number };
    radius: number;
    x: number;
    y: number;
  }[],
): Set<number> {
  const result = new Set<number>();
  base.forEach((entry, index) => {
    if (
      base.some(
        (other) =>
          other.member.id !== entry.member.id &&
          Math.hypot(entry.x - other.x, entry.y - other.y) <
            entry.radius + other.radius + 8,
      )
    )
      result.add(index);
  });
  return result;
}

describe("D-12: contacts sit on their orbit line", () => {
  const statuses = [
    { status: "stable" as const, progress: 0.3 },
    { status: "wobble" as const, progress: 1.1 },
    { status: "decay" as const, progress: 1.9 },
    { status: "decay" as const, progress: 2.6 },
    { status: "rogue" as const, progress: 3.4 },
    { status: "rogue" as const, progress: 9 },
    { status: null, progress: null },
  ];
  it("places every status exactly on ringRadius at every density", () => {
    const members = statuses.map((entry, index) =>
      member(index + 1, {
        status: entry.status,
        progress: entry.progress,
        last_contact: entry.progress === null ? null : "2026-09-07",
      }),
    );
    for (const density of ["spacious", "balanced", "compact"] as const) {
      const result = deriveOrreryWorld(members, density, new Map(), sun);
      for (const body of result.bodies.slice(0, -1))
        expect(
          Math.abs(Math.hypot(body.x, body.y) - body.ringRadius),
        ).toBeLessThanOrEqual(1e-9);
    }
  });
  it("extent is the outermost ring plus its body radius (and never less than the sun)", () => {
    const members = Array.from({ length: 12 }, (_, i) =>
      member(i + 1, {
        status: i % 2 ? "rogue" : "decay",
        progress: i % 2 ? 5 : 2.5,
      }),
    );
    const result = deriveOrreryWorld(members, "balanced", new Map(), sun);
    const outer = result.bodies[result.bodies.length - 2];
    expect(result.extent).toBe(outer.ringRadius + outer.radius);
    expect(result.extent).toBe(
      DENSITY_PRESETS.balanced.ringInner +
        11 * DENSITY_PRESETS.balanced.ringGap +
        16,
    );
    expect(deriveOrreryWorld([], "balanced", new Map(), sun).extent).toBe(30);
  });
  it("re-pins nudges to the on-ring geometry: same-angle neighbours nudge by min(1°, 4 / widest ring)", () => {
    // Six members at one angle on adjacent balanced rings (34 apart < 16+16+8)
    // all touch a neighbour. Before D-12 a rogue push moved them off this grid.
    const members = Array.from({ length: 6 }, (_, i) =>
      member(i + 1, { progress: 0, status: i === 2 ? "rogue" : "stable" }),
    );
    const result = deriveOrreryWorld(members, "balanced", new Map(), sun);
    const magnitudes = result.bodies
      .slice(0, -1)
      .map((body) => Math.abs(body.nudgeAngle ?? 0));
    expect(magnitudes).toEqual([
      MAX_NUDGE_ANGLE,
      MAX_NUDGE_ANGLE,
      MAX_NUDGE_ANGLE,
      MAX_NUDGE_ANGLE,
      MAX_NUDGE_WORLD / (68 + 4 * 44),
      MAX_NUDGE_WORLD / (68 + 5 * 44),
    ]);
    for (const body of result.bodies.slice(0, -1)) {
      expect(Math.abs(body.nudgeAngle ?? 0)).toBeLessThanOrEqual(
        MAX_NUDGE_ANGLE,
      );
      expect(
        Math.abs(body.nudgeAngle ?? 0) * body.ringRadius,
      ).toBeLessThanOrEqual(MAX_NUDGE_WORLD + 1e-9);
    }
    // A rogue that used to be pushed 80 units out now sits on its own ring at
    // its timestamp angle (plus its bounded nudge).
    expect(result.bodies[2].ringRadius).toBe(58 + 2 * 34);
    expect(Math.hypot(result.bodies[2].x, result.bodies[2].y)).toBeCloseTo(
      58 + 2 * 34,
      9,
    );
  });
  it("grid collision detection equals the all-pairs scan on 1,000 random members", () => {
    const random = seeded(12);
    for (let round = 0; round < 4; round++) {
      // A dense cloud (many touches) and a realistic on-ring System.
      const cloud = Array.from({ length: 1000 }, (_, i) => ({
        member: { id: i % 997 },
        radius: 14.4 + random() * 3.2,
        x: (random() - 0.5) * (round % 2 ? 900 : 4000),
        y: (random() - 0.5) * (round % 2 ? 900 : 4000),
      }));
      expect(
        [...collidingReferenceIndexes(cloud)].sort((a, b) => a - b),
      ).toEqual([...bruteForceColliding(cloud)].sort((a, b) => a - b));
    }
    const members = Array.from({ length: 1000 }, (_, i) =>
      member(i + 1, {
        progress: i % 50 === 0 ? null : random() * 4,
        status: i % 50 === 0 ? null : "stable",
      }),
    );
    const result = deriveOrreryWorld(members, "balanced", new Map(), sun);
    const reference = result.bodies.slice(0, -1).map((body, index) => {
      const progress = members[index].progress;
      const angle =
        progress === null ? NEUTRAL_RESTING_ANGLE : progressToAngle(progress);
      const r = 58 + index * 34;
      return {
        member: { id: body.id },
        radius: 16,
        x: r * Math.sin(angle),
        y: -r * Math.cos(angle),
      };
    });
    const expected = bruteForceColliding(reference);
    result.bodies.slice(0, -1).forEach((body, index) => {
      const neutral = members[index].progress === null;
      expect((body.nudgeAngle ?? 0) !== 0).toBe(
        !neutral && expected.has(index),
      );
    });
  });
});
