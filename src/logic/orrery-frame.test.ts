import { describe, expect, it } from "vitest";
import {
  collectHitCandidates,
  HOME_CAMERA,
  projectWorldPoint,
  type WorldBody,
} from "./orrery-camera-logic";
import {
  type AnimatedFrame,
  type AnimatedWorldBody,
  beginWorldTransition,
  billboardPose,
  bodyKey,
  frameBodyById,
  frameBodyByKey,
  projectAnimatedFrame,
  projectSwitchChoreographyFrame,
  sampleWorldTransition,
  spinSwitchWorld,
} from "./orrery-frame";
import {
  beginSwitchChoreography,
  retargetSwitchChoreography,
  sampleSwitchChoreography,
} from "./orrery-switch-choreography";

const viewport = { width: 1000, height: 1000 };
const body = (id: number, radius: number): WorldBody => ({
  id,
  kind: id === 0 ? "sun" : "contact",
  x: 0,
  y: id === 0 ? 0 : -radius,
  radius: 18,
  ringRadius: id === 0 ? 0 : radius,
});
describe("one animated Orrery frame", () => {
  it("projects the choreography sample as the sole ring, body, and hit world", () => {
    const transition = beginSwitchChoreography(
      [body(1, 70)],
      [body(2, 180)],
      12,
      { intensity: 1, reducedMotion: false },
    );
    const progress = 0.66;
    const frame = projectSwitchChoreographyFrame(
      transition,
      progress,
      HOME_CAMERA,
      viewport,
    );
    const entering = frame.sample.world.find((entry) => entry.id === 2)!;
    const projected = frame.bodies.find((entry) => entry.id === 2)!;
    expect(projected).toMatchObject(
      projectWorldPoint(entering, frame.pose, viewport),
    );
    expect(projected.ringPath[0]).toMatchObject(
      projectWorldPoint(
        { x: 0, y: -entering.ringRadius },
        frame.pose,
        viewport,
      ),
    );
    expect(collectHitCandidates(frame, projected.x, projected.y)).toEqual([]);
    expect(frame.bodies.map(bodyKey)).toEqual(frame.sample.world.map(bodyKey));
  });
  it("projects an interrupted re-target from the exact displayed geometry", () => {
    const first = beginSwitchChoreography(
      [body(1, 70)],
      [body(1, 140), body(2, 210)],
      13,
      { intensity: 1, reducedMotion: false },
    );
    const displayed = sampleSwitchChoreography(first, 0.57);
    const next = retargetSwitchChoreography(
      first,
      0.57,
      [body(1, 240), body(3, 300)],
      14,
      { intensity: 1, reducedMotion: false },
    );
    const frame = projectSwitchChoreographyFrame(
      next,
      0,
      HOME_CAMERA,
      viewport,
    );
    for (const prior of displayed.world) {
      const sampled = frame.sample.world.find(
        (entry) => bodyKey(entry) === bodyKey(prior),
      )!;
      expect(sampled).toMatchObject({
        x: prior.x,
        y: prior.y,
        radius: prior.radius,
        opacity: prior.opacity,
      });
    }
  });
  it("grows entries and shrinks inert departures without snapping an interrupted size", () => {
    const seed = beginWorldTransition([], [body(1, 70)], 1);
    expect(sampleWorldTransition(seed, 0)[0].radius).toBeLessThan(18);
    const exit = beginWorldTransition(sampleWorldTransition(seed, 1), [], 2);
    const middle = sampleWorldTransition(exit, 0.5);
    expect(middle[0].radius).toBeLessThan(18);
    expect(middle[0].interactive).toBe(false);
    const returnTransition = beginWorldTransition(middle, [body(1, 70)], 3);
    expect(sampleWorldTransition(returnTransition, 0)[0].radius).toBe(
      middle[0].radius,
    );
  });
  it.each([0, 0.25, 0.5, 0.75, 1])(
    "projects displayed rings, bodies and hits together at %s",
    (fraction) => {
      const start = beginWorldTransition([], [body(1, 70), body(0, 0)], 1);
      const transition = beginWorldTransition(
        sampleWorldTransition(start, 1),
        [body(1, 150), body(2, 220), body(0, 0)],
        2,
      );
      const pose = { ...HOME_CAMERA, tilt: 0.5, yaw: fraction * 0.4 };
      const frame = projectAnimatedFrame(transition, fraction, pose, viewport);
      const current = sampleWorldTransition(transition, fraction)[0];
      const drawn = frame.bodies[0];
      expect(drawn).toMatchObject(
        projectWorldPoint(current, frame.pose, viewport),
      );
      expect(drawn.ringPath[0].x).toBeCloseTo(drawn.x, 8);
      expect(drawn.ringPath[0].y).toBeCloseTo(drawn.y, 8);
      expect(collectHitCandidates(frame, drawn.x, drawn.y)).toContain(1);
      const entering = frame.bodies.find((b) => b.id === 2)!;
      expect(
        collectHitCandidates(frame, entering.x, entering.y).includes(2),
      ).toBe(fraction > 0);
    },
  );
  it("makes exits immediately inert and continues interrupted transitions from displayed world geometry", () => {
    const first = beginWorldTransition([], [body(1, 70), body(2, 120)], 1);
    const next = beginWorldTransition(
      sampleWorldTransition(first, 1),
      [body(1, 150)],
      2,
    );
    const midpoint = sampleWorldTransition(next, 0.5);
    const interrupted = beginWorldTransition(
      midpoint,
      [body(1, 200), body(2, 180)],
      3,
    );
    expect(sampleWorldTransition(interrupted, 0)).toEqual(
      midpoint.map((b) => ({ ...b, interactive: true })),
    );
    const frame = projectAnimatedFrame(next, 0.25, HOME_CAMERA, viewport);
    const exit = frame.bodies.find((b) => b.id === 2)!;
    expect(exit.opacity).toBeGreaterThan(0);
    expect(collectHitCandidates(frame, exit.x, exit.y)).not.toContain(2);
    expect(
      sampleWorldTransition(next, 1).find((b) => b.id === 2)?.opacity,
    ).toBe(0);
  });
  it("keeps equal-depth source order and allows contacts to cross sun depth", () => {
    const seed = beginWorldTransition(
      [],
      [body(2, 70), body(1, 120), body(0, 0)],
      1,
    );
    const flat = projectAnimatedFrame(seed, 1, HOME_CAMERA, viewport);
    expect(flat.bodies.map((b) => b.id)).toEqual([2, 1, 0]);
    for (const body of flat.bodies) expect(body.depth).toBeCloseTo(0, 8);
    const far = projectAnimatedFrame(
      seed,
      1,
      { ...HOME_CAMERA, tilt: 0.5 },
      viewport,
    );
    const near = projectAnimatedFrame(
      seed,
      1,
      { ...HOME_CAMERA, tilt: 0.5, yaw: Math.PI },
      viewport,
    );
    expect(far.bodies[0].depth).toBeLessThan(far.bodies[2].depth);
    expect(near.bodies[0].depth).toBeGreaterThan(near.bodies[2].depth);
    expect(near.bodies.map(bodyKey)).toEqual(flat.bodies.map(bodyKey));
  });
  it("culls media without dropping world membership or boundary hit access", () => {
    const seed = beginWorldTransition(
      [],
      [{ ...body(1, 70), x: 10000 }, body(2, 70)],
      1,
    );
    const frame = projectAnimatedFrame(seed, 1, HOME_CAMERA, viewport);
    expect(frame.bodies).toHaveLength(2);
    expect(frame.bodies[0].visible).toBe(false);
    expect(frame.bodies[1].visible).toBe(true);
  });
  it("adds a reversible per-body switch spin without changing the zero-intensity frame", () => {
    const world = sampleWorldTransition(
      beginWorldTransition([], [body(1, 70)], 1),
      1,
    );
    expect(spinSwitchWorld(world, 0, 0.5)).toEqual(world);
    const spun = spinSwitchWorld(world, 1, 0.5);
    expect(spun[0].x).not.toBe(world[0].x);
    expect(spun[0].y).not.toBe(world[0].y);
    expect(spinSwitchWorld(world, 1, 0)).toEqual(world);
    expect(spinSwitchWorld(world, 1, 1)).toEqual(world);
  });
});

describe("D-52 per-frame O(1) body indexes", () => {
  const moon = (parentId: number, uid: string): WorldBody => ({
    id: -1,
    kind: "satellite",
    x: 12,
    y: -60,
    radius: 3,
    ringRadius: 0,
    satelliteTarget: {
      kind: "satellite",
      uid,
      parentId,
      parentUid: `p"${parentId}`,
    },
  });
  const world = [
    body(0, 0),
    body(1, 70),
    moon(1, "a"),
    body(2, 120),
    moon(1, "b"),
    body(3, 200),
  ];
  const settled = (bodies: readonly WorldBody[]) =>
    beginWorldTransition([], bodies, 9);

  it("indexes every body by key and every non-satellite body by id, in the projection pass", () => {
    for (const frame of [
      projectAnimatedFrame(settled(world), 1, HOME_CAMERA, viewport),
      projectSwitchChoreographyFrame(
        beginSwitchChoreography(world, world, 9, {
          intensity: 0,
          reducedMotion: false,
        }),
        1,
        HOME_CAMERA,
        viewport,
      ),
    ]) {
      expect(Object.keys(frame.keyIndex ?? {})).toHaveLength(
        frame.bodies.length,
      );
      frame.bodies.forEach((projected, index) => {
        expect(frame.keyIndex?.[bodyKey(projected)]).toBe(index);
        expect(frameBodyByKey(frame, bodyKey(projected))).toBe(projected);
        if (projected.kind !== "satellite") {
          expect(frame.idIndex?.[projected.id]).toBe(index);
          expect(frameBodyById(frame, projected.id)).toBe(projected);
        }
      });
      // Satellites (id -1) are never in the id index.
      expect(frame.idIndex?.[-1]).toBeUndefined();
      expect(frameBodyById(frame, -1)).toBeUndefined();
      expect(frameBodyByKey(frame, "contact:404")).toBeUndefined();
      expect(frameBodyById(frame, 404)).toBeUndefined();
    }
  });

  it("indexed lookups equal the first-match scans they replaced (also on an unindexed frame)", () => {
    const frame = projectAnimatedFrame(
      settled(world),
      1,
      HOME_CAMERA,
      viewport,
    );
    const { keyIndex: _k, idIndex: _i, ...unindexed } = frame;
    const keys = [...frame.bodies.map(bodyKey), "contact:99", "sun:5"];
    for (const key of keys) {
      const scan = frame.bodies.find((b) => bodyKey(b) === key);
      expect(frameBodyByKey(frame, key)).toBe(scan);
      expect(frameBodyByKey(unindexed, key)).toBe(scan);
    }
    for (const id of [0, 1, 2, 3, -1, 99]) {
      const scan = frame.bodies.find(
        (b) => b.kind !== "satellite" && b.id === id,
      );
      expect(frameBodyById(frame, id)).toBe(scan);
      expect(frameBodyById(unindexed, id)).toBe(scan);
    }
  });

  it("billboardPose is unchanged on a fixture", () => {
    const frame = projectAnimatedFrame(
      settled(world),
      1,
      HOME_CAMERA,
      viewport,
    );
    // FROZEN copy of the pre-38.7 billboardPose (do not edit).
    const legacyBillboard = (f: AnimatedFrame, key: string, radius: number) => {
      const b = f.bodies.find((item) => bodyKey(item) === key);
      return b
        ? {
            x: b.x,
            y: b.y,
            scale: b.radius / radius,
            depth: b.depth,
            opacity: b.visible ? b.opacity : 0,
          }
        : { x: 0, y: 0, scale: 1, depth: 0, opacity: 0 };
    };
    for (const key of [...frame.bodies.map(bodyKey), "contact:77"])
      for (const radius of [1, 18])
        expect(billboardPose(frame, key, radius)).toEqual(
          legacyBillboard(frame, key, radius),
        );
  });

  it("keyed world-transition setup equals the frozen old scan on randomised inputs", () => {
    // FROZEN copy of the pre-38.7 beginWorldTransition (do not edit).
    const legacyBegin = (
      from: readonly AnimatedWorldBody[],
      next: readonly WorldBody[],
      generation: number,
    ) => {
      const keys = [
        ...from.map(bodyKey),
        ...next
          .map(bodyKey)
          .filter((key) => !from.some((b) => bodyKey(b) === key)),
      ];
      const starts: AnimatedWorldBody[] = [],
        ends: AnimatedWorldBody[] = [];
      for (const key of keys) {
        const previous = from.find((b) => bodyKey(b) === key);
        const live = next.find((b) => bodyKey(b) === key);
        const base = live ?? previous;
        if (!base) continue;
        starts.push({
          ...(previous ?? base),
          radius: previous?.radius ?? base.radius * 0.75,
          opacity: previous?.opacity ?? 0,
          interactive: !!live,
        });
        ends.push({
          ...base,
          radius: live ? base.radius : base.radius * 0.75,
          opacity: live ? 1 : 0,
          interactive: !!live,
        });
      }
      return { generation, from: starts, to: ends };
    };
    let state = 3;
    const random = () => {
      state = (state * 48271) % 2147483647;
      return state / 2147483647;
    };
    const pick = () =>
      Array.from({ length: 40 }, (_, slot) => slot)
        .filter(() => random() < 0.55)
        .map((slot) =>
          slot === 0
            ? body(0, 0)
            : slot % 6 === 0
              ? moon(slot % 5, `m${slot}`)
              : body(slot, 40 + slot * 7),
        )
        .sort(() => random() - 0.5);
    for (let round = 0; round < 60; round++) {
      const from = sampleWorldTransition(
        beginWorldTransition([], pick(), round),
        random(),
      );
      const next = pick();
      expect(beginWorldTransition(from, next, round)).toEqual(
        legacyBegin(from, next, round),
      );
    }
    // Repeated keys keep first-match semantics.
    const repeated = [body(1, 70), body(1, 90)];
    const repeatedFrom = sampleWorldTransition(
      beginWorldTransition([], repeated, 1),
      1,
    );
    expect(beginWorldTransition(repeatedFrom, repeated, 2)).toEqual(
      legacyBegin(repeatedFrom, repeated, 2),
    );
  });
});
