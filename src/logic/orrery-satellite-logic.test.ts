import { describe, expect, it } from "vitest";
import {
  HOME_CAMERA,
  projectFrame,
  type WorldBody,
} from "./orrery-camera-logic";
import { reconcileFocus } from "./orrery-focus-logic";
import {
  beginWorldTransition,
  projectAnimatedFrame,
  sampleWorldTransition,
} from "./orrery-frame";
import { IDENTITY_ENTER, IDENTITY_EXIT } from "./orrery-label-logic";
import { captureReorder } from "./orrery-reorder-logic";
import {
  deriveSatelliteBodies,
  EMPTY_SATELLITE_INDEX,
  indexSatellites,
  moonAngle,
  moonSplitFactor,
  resolveSatelliteTap,
  satelliteKey,
} from "./orrery-satellite-logic";

const parent = { id: 1, uid: "p" };
const row = {
  uid: "r",
  parentId: 1,
  parentUid: "p",
  personName: "名字",
  relationType: null,
};
const world: WorldBody[] = [
  { id: 1, kind: "sun", x: 0, y: 0, radius: 20, ringRadius: 0 },
];
const viewport = { width: 600, height: 800 };
const identities = [{ ...parent, kind: "contact-sun" as const }];
/** The pre-38.7-10 moons API: the moon bodies at full split. */
const moonsOf = (
  bodies: readonly WorldBody[],
  rows: (typeof row)[],
  members: { id: number; uid: string }[],
  enabled = true,
  split = 1,
) =>
  deriveSatelliteBodies(bodies, indexSatellites(rows, members), enabled, split)
    .moons;

describe("subordinate relationship bodies", () => {
  it("requires enabled and readable current-System parent membership, with no sun override", () => {
    for (const members of [[], [parent]])
      for (const enabled of [false, true])
        for (const split of [0, 0.5, 1]) {
          const moons = moonsOf(world, [row], members, enabled, split);
          expect(moons).toHaveLength(
            members.length && enabled && split ? 1 : 0,
          );
          expect(reconcileFocus(identities[0], members, parent)).toEqual(
            identities[0],
          );
        }
    expect(
      moonsOf(world, [{ ...row, parentUid: "replaced" }], [parent]),
    ).toEqual([]);
  });
  it("retains UID plus parent identity, small finite deterministic offsets, zero rails or contact semantics", () => {
    const rows = [row, { ...row, uid: "another" }];
    const a = moonsOf(world, rows, [parent]);
    expect(a).toEqual(moonsOf(world, [...rows].reverse(), [parent]));
    expect(new Set(a.map(satelliteKey)).size).toBe(2);
    for (const moon of a) {
      expect(moon.kind).toBe("satellite");
      expect(moon.radius).toBeLessThan(world[0].radius / 2);
      expect(moon.ringRadius).toBe(0);
      expect(moon.id).toBeLessThan(0);
      expect(Number.isFinite(moon.x + moon.y)).toBe(true);
    }
  });
  it("projects and hits moons at the displayed intermediate parent position; isolated hit has no contact command", () => {
    const transition = beginWorldTransition(
      world.map((b) => ({ ...b, opacity: 1, interactive: true })),
      [{ ...world[0], x: 60 }],
      2,
    );
    const sampled = sampleWorldTransition(transition, 0.4);
    const moons = moonsOf(sampled, [row], [parent]);
    const current = projectFrame(
      [...sampled, ...moons],
      { ...HOME_CAMERA, zoom: 2, tilt: 0.5, yaw: 0.3 },
      viewport,
      2,
    );
    const moon = current.bodies.find((b) => b.kind === "satellite")!;
    const intent = resolveSatelliteTap(current, moon.x, moon.y, identities, [
      parent,
    ]);
    expect(intent.kind).toBe("satellite");
    expect(intent.ids).toEqual([]);
    expect(intent.targets).toBeUndefined();
    expect(intent.satelliteTarget?.uid).toBe(row.uid);
    expect(moons[0].x - world[0].x).not.toBe(
      moonsOf(world, [row], [parent])[0].x - world[0].x,
    );
  });
  it("mixed moon/contact ambiguity uses contact group and accessible parent path", () => {
    const moons = moonsOf(world, [row], [parent]);
    const frame = projectFrame(
      [...world, ...moons],
      { ...HOME_CAMERA, zoom: 2 },
      viewport,
      1,
    );
    const moon = frame.bodies[1];
    moon.x = frame.bodies[0].x;
    moon.y = frame.bodies[0].y;
    const intent = resolveSatelliteTap(frame, moon.x, moon.y, identities, [
      parent,
    ]);
    expect(intent.kind).toBe("group");
    expect(intent.ids).toEqual([1]);
    expect(intent.satelliteTarget).toBeUndefined();
    const request = {
      system: { kind: "builtin" as const, id: "all-contacts" as const },
      expectedFullOrderedIds: [1],
      expectedSavedSunContactId: null,
      expectedEligibleVisibleIds: [1],
      expectedContactIdentities: [parent],
    };
    frame.bodies[0].kind = "contact";
    expect(captureReorder(frame, request, moon.x, moon.y)).toBeNull();
  });
  it("removal invalidates every moon target immediately, including decorative parent departures", () => {
    const departed = sampleWorldTransition(
      beginWorldTransition(
        world.map((b) => ({ ...b, opacity: 1, interactive: true })),
        [],
        2,
      ),
      0.2,
    );
    const derived = deriveSatelliteBodies(
      departed,
      indexSatellites([row], [parent]),
      true,
      1,
    );
    expect(derived.moons).toEqual([]);
    expect(derived.bumps).toEqual({});
    const current = projectAnimatedFrame(
      beginWorldTransition([], world, 3),
      1,
      { ...HOME_CAMERA, zoom: 2 },
      viewport,
    );
    expect(resolveSatelliteTap(current, 0, 0, identities, [parent]).kind).toBe(
      "clear",
    );
  });
});

describe("38.7-10 (D-52): the JS-side satellite index", () => {
  const members = [
    { id: 1, uid: "p" },
    { id: 2, uid: "q" },
  ];
  it("deduplicates by (parent, parent uid, uid), sorts by parent then uid and groups per parent", () => {
    const rows = [
      { ...row, uid: "z", parentId: 2, parentUid: "q" },
      { ...row, uid: "b" },
      { ...row, uid: "a" },
      { ...row, uid: "b" },
      { ...row, uid: "a", parentId: 2, parentUid: "q" },
    ];
    const index = indexSatellites(rows, members);
    expect(index.rows.map((r) => [r.parentId, r.uid])).toEqual([
      [1, "a"],
      [1, "b"],
      [2, "a"],
      [2, "z"],
    ]);
    expect(index.parents.map((p) => [p.id, p.moons.map((m) => m.uid)])).toEqual(
      [
        [1, ["a", "b"]],
        [2, ["a", "z"]],
      ],
    );
    expect(index.parentIds).toEqual({ 1: true, 2: true });
    // The uid-hash angle is precomputed, unchanged from the per-frame hash.
    expect(index.parents[0].moons[0].angle).toBe(moonAngle("a"));
    // Input order does not matter.
    expect(indexSatellites([...rows].reverse(), members)).toEqual(index);
  });
  it("ADR-105: only current-System member parents (id AND uid) — a non-member sun gets none", () => {
    const sunRow = { ...row, uid: "s", parentId: 9, parentUid: "sun" };
    const stale = { ...row, uid: "x", parentUid: "replaced" };
    const index = indexSatellites([row, sunRow, stale], members);
    expect(index.rows.map((r) => r.uid)).toEqual(["r"]);
    expect(index.parentIds[9]).toBeUndefined();
    expect(indexSatellites([sunRow], members)).toBe(EMPTY_SATELLITE_INDEX);
    expect(indexSatellites([row], [])).toBe(EMPTY_SATELLITE_INDEX);
    // The world's sun with that id gets no bump and no moons either.
    const sunWorld: WorldBody[] = [
      { id: 9, kind: "sun", x: 0, y: 0, radius: 20, ringRadius: 0 },
    ];
    for (const split of [0, 1]) {
      const derived = deriveSatelliteBodies(sunWorld, index, true, split);
      expect(derived.moons).toEqual([]);
      expect(derived.bumps).toEqual({});
    }
  });
  it("the bump angle is the circular mean of the moon angles", () => {
    const rows = ["m1", "m2", "m3"].map((uid) => ({ ...row, uid }));
    const parentEntry = indexSatellites(rows, members).parents[0];
    const sx = rows.reduce((s, r) => s + Math.cos(moonAngle(r.uid)), 0);
    const sy = rows.reduce((s, r) => s + Math.sin(moonAngle(r.uid)), 0);
    expect(parentEntry.bumpAngle).toBeCloseTo(Math.atan2(sy, sx), 12);
  });
});

describe("38.7-10 (D-31): the far-zoom bump that splits into moons", () => {
  const rows = [row, { ...row, uid: "another" }, { ...row, uid: "third" }];
  const index = indexSatellites(rows, [parent]);
  const contactWorld: (WorldBody & { opacity: number })[] = [
    {
      id: 1,
      kind: "contact",
      x: 40,
      y: -30,
      radius: 16,
      ringRadius: 50,
      opacity: 1,
    },
  ];
  it("moonSplitFactor is 0 up to IDENTITY_EXIT, 1 from IDENTITY_ENTER, monotonic and continuous between", () => {
    expect(moonSplitFactor(0.5)).toBe(0);
    expect(moonSplitFactor(IDENTITY_EXIT)).toBe(0);
    expect(moonSplitFactor(IDENTITY_ENTER)).toBe(1);
    expect(moonSplitFactor(4)).toBe(1);
    expect(moonSplitFactor(Number.NaN)).toBe(0);
    let previous = 0;
    for (let i = 0; i <= 200; i++) {
      const zoom = IDENTITY_EXIT + ((IDENTITY_ENTER - IDENTITY_EXIT) * i) / 200;
      const factor = moonSplitFactor(zoom);
      expect(factor).toBeGreaterThanOrEqual(previous);
      expect(factor - previous).toBeLessThan(0.02);
      previous = factor;
    }
  });
  it("factor 0: one bump per parent with moons (its key, mean angle, count) and no moon bodies", () => {
    const derived = deriveSatelliteBodies(contactWorld, index, true, 0);
    expect(derived.moons).toEqual([]);
    expect(derived.bumps).toEqual({
      "contact:1": { angle: index.parents[0].bumpAngle, count: 3 },
    });
    // So a tap at overview resolves exactly as before: the parent, no moon.
    const frame = projectFrame(
      [...contactWorld, ...derived.moons],
      { ...HOME_CAMERA, zoom: 1, tilt: 0 },
      viewport,
      1,
    );
    expect(frame.bodies.some((b) => b.kind === "satellite")).toBe(false);
  });
  it("factor 1 keeps today's moon positions and interactivity exactly", () => {
    const derived = deriveSatelliteBodies(contactWorld, index, true, 1);
    expect(derived.moons).toHaveLength(3);
    for (const moon of derived.moons) {
      const angle = moonAngle(moon.satelliteTarget?.uid ?? "");
      expect(moon.x).toBe(contactWorld[0].x + Math.cos(angle) * (16 + 24));
      expect(moon.y).toBe(contactWorld[0].y + Math.sin(angle) * (16 + 24));
      expect(moon.radius).toBe(Math.min(4, 16 * 0.2));
      expect(moon.interactive).toBe(true);
      expect(moon.opacity).toBe(1);
    }
  });
  it("in between: moons start at the rim at the bump angle, move out monotonically, fade in and are never interactive", () => {
    const parentAt = contactWorld[0];
    const bump = index.parents[0].bumpAngle;
    const tiny = deriveSatelliteBodies(contactWorld, index, true, 1e-6).moons;
    for (const moon of tiny) {
      expect(moon.x).toBeCloseTo(parentAt.x + Math.cos(bump) * 16, 3);
      expect(moon.y).toBeCloseTo(parentAt.y + Math.sin(bump) * 16, 3);
    }
    const reach = (split: number) =>
      deriveSatelliteBodies(contactWorld, index, true, split).moons.map((m) =>
        Math.hypot(m.x - parentAt.x, m.y - parentAt.y),
      );
    let previous = reach(0.01);
    for (const split of [0.2, 0.4, 0.6, 0.8, 0.99]) {
      const next = reach(split);
      next.forEach((d, i) => {
        expect(d).toBeGreaterThan(previous[i]);
      });
      previous = next;
      for (const moon of deriveSatelliteBodies(contactWorld, index, true, split)
        .moons) {
        expect(moon.interactive).toBe(false);
        expect(moon.opacity).toBeCloseTo(split, 12);
      }
    }
    // Non-interactive moons are never a tap target.
    const frame = projectFrame(
      [
        ...contactWorld,
        ...deriveSatelliteBodies(contactWorld, index, true, 0.5).moons,
      ],
      { ...HOME_CAMERA, zoom: 1.95, tilt: 0 },
      viewport,
      1,
    );
    for (const moon of frame.bodies.filter((b) => b.kind === "satellite"))
      expect(
        resolveSatelliteTap(frame, moon.x, moon.y, identities, [parent]).kind,
      ).not.toBe("satellite");
  });
  it("disabled or empty: nothing at all", () => {
    expect(deriveSatelliteBodies(contactWorld, index, false, 1)).toEqual({
      moons: [],
      bumps: {},
    });
    expect(
      deriveSatelliteBodies(contactWorld, EMPTY_SATELLITE_INDEX, true, 0),
    ).toEqual({ moons: [], bumps: {} });
  });
});
