import { describe, expect, it } from "vitest";
import { collectHitCandidates, HOME_CAMERA, projectWorldPoint, type WorldBody } from "./orrery-camera-logic";
import { beginWorldTransition, sampleWorldTransition, projectAnimatedFrame, bodyKey } from "./orrery-frame";

const viewport = { width: 1000, height: 1000 };
const body = (id: number, radius: number): WorldBody => ({ id, kind: id === 0 ? "sun" : "contact", x: 0, y: id === 0 ? 0 : -radius, radius: 18, ringRadius: id === 0 ? 0 : radius });
describe("one animated Orrery frame", () => {
  it.each([0, 0.25, 0.5, 0.75, 1])("projects displayed rings, bodies and hits together at %s", (fraction) => {
    const start = beginWorldTransition([], [body(1, 70), body(0, 0)], 1);
    const transition = beginWorldTransition(sampleWorldTransition(start, 1), [body(1, 150), body(2, 220), body(0, 0)], 2);
    const pose = { ...HOME_CAMERA, tilt: 0.5, yaw: fraction * 0.4 };
    const frame = projectAnimatedFrame(transition, fraction, pose, viewport);
    const current = sampleWorldTransition(transition, fraction)[0];
    const drawn = frame.bodies[0];
    expect(drawn).toMatchObject(projectWorldPoint(current, frame.pose, viewport));
    expect(drawn.ringPath[0].x).toBeCloseTo(drawn.x, 8);
    expect(drawn.ringPath[0].y).toBeCloseTo(drawn.y, 8);
    expect(collectHitCandidates(frame, drawn.x, drawn.y)).toContain(1);
    const entering = frame.bodies.find((b) => b.id === 2)!;
    expect(collectHitCandidates(frame, entering.x, entering.y).includes(2)).toBe(fraction > 0);
  });
  it("makes exits immediately inert and continues interrupted transitions from displayed world geometry", () => {
    const first = beginWorldTransition([], [body(1, 70), body(2, 120)], 1);
    const next = beginWorldTransition(sampleWorldTransition(first, 1), [body(1, 150)], 2);
    const midpoint = sampleWorldTransition(next, 0.5);
    const interrupted = beginWorldTransition(midpoint, [body(1, 200), body(2, 180)], 3);
    expect(sampleWorldTransition(interrupted, 0)).toEqual(midpoint.map((b) => ({ ...b, interactive: true })));
    const frame = projectAnimatedFrame(next, 0.25, HOME_CAMERA, viewport);
    const exit = frame.bodies.find((b) => b.id === 2)!;
    expect(exit.opacity).toBeGreaterThan(0);
    expect(collectHitCandidates(frame, exit.x, exit.y)).not.toContain(2);
    expect(sampleWorldTransition(next, 1).find((b) => b.id === 2)?.opacity).toBe(0);
  });
  it("keeps equal-depth source order and allows contacts to cross sun depth", () => {
    const seed = beginWorldTransition([], [body(2, 70), body(1, 120), body(0, 0)], 1);
    const flat = projectAnimatedFrame(seed, 1, HOME_CAMERA, viewport);
    expect(flat.bodies.map((b) => b.id)).toEqual([2, 1, 0]);
    expect(flat.bodies.map((b) => b.depth)).toEqual([0, 0, 0]);
    const far = projectAnimatedFrame(seed, 1, { ...HOME_CAMERA, tilt: 0.5 }, viewport);
    const near = projectAnimatedFrame(seed, 1, { ...HOME_CAMERA, tilt: 0.5, yaw: Math.PI }, viewport);
    expect(far.bodies[0].depth).toBeLessThan(far.bodies[2].depth);
    expect(near.bodies[0].depth).toBeGreaterThan(near.bodies[2].depth);
    expect(near.bodies.map(bodyKey)).toEqual(flat.bodies.map(bodyKey));
  });
  it("culls media without dropping world membership or boundary hit access", () => {
    const seed = beginWorldTransition([], [{ ...body(1, 70), x: 10000 }, body(2, 70)], 1);
    const frame = projectAnimatedFrame(seed, 1, HOME_CAMERA, viewport);
    expect(frame.bodies).toHaveLength(2);
    expect(frame.bodies[0].visible).toBe(false);
    expect(frame.bodies[1].visible).toBe(true);
  });
});
