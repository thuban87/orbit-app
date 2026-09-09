import { describe, expect, it } from "vitest";
import {
  collectHitCandidates,
  HOME_CAMERA,
  projectWorldPoint,
  type WorldBody,
} from "./orrery-camera-logic";
import {
  beginWorldTransition,
  bodyKey,
  projectAnimatedFrame,
  sampleWorldTransition,
  spinSwitchWorld,
} from "./orrery-frame";
import { beginSwitchChoreography } from "./orrery-switch-choreography";
import { projectSwitchChoreographyFrame } from "./orrery-frame";

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
    expect(frame.bodies.map(bodyKey)).toEqual(
      frame.sample.world.map(bodyKey),
    );
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
