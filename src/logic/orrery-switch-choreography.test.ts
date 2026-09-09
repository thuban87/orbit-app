import { describe, expect, it } from "vitest";
import type { WorldBody } from "./orrery-camera-logic";
import {
  ACCELERATE_END,
  beginSwitchChoreography,
  CAPTURE_END,
  CAPTURE_START,
  SETTLE_START,
  SHED_END,
  SHED_START,
  sampleSwitchChoreography,
} from "./orrery-switch-choreography";

const contact = (id: number, ringRadius: number, angle = 0): WorldBody => ({
  id,
  kind: "contact",
  x: ringRadius * Math.sin(angle),
  y: -ringRadius * Math.cos(angle),
  radius: 18,
  ringRadius,
});

const radialDistance = (body: WorldBody) => Math.hypot(body.x, body.y);

describe("Orrery System-switch choreography", () => {
  it("classifies a disjoint switch and expresses every staged trajectory", () => {
    const source = [contact(1, 80)];
    const destination = [contact(2, 140, 0.4)];
    const transition = beginSwitchChoreography(source, destination, 7, {
      intensity: 1,
      reducedMotion: false,
    });

    expect(transition.entries.map(({ key, role }) => ({ key, role }))).toEqual([
      { key: "contact:1", role: "leaving" },
      { key: "contact:2", role: "entering" },
    ]);

    const accelerated = sampleSwitchChoreography(
      transition,
      ACCELERATE_END * 0.8,
    );
    expect(accelerated.phase).toBe("accelerate");
    expect(accelerated.accumulatedRotation).toBeGreaterThan(0);

    const shedProgress = [0.2, 0.45, 0.7, 0.9].map(
      (t) => SHED_START + (SHED_END - SHED_START) * t,
    );
    const shedRadii = shedProgress.map((progress) =>
      radialDistance(
        sampleSwitchChoreography(transition, progress).world.find(
          (body) => body.id === 1,
        )!,
      ),
    );
    for (let index = 1; index < shedRadii.length; index++)
      expect(shedRadii[index]).toBeGreaterThan(shedRadii[index - 1]);

    const destinationRadius = radialDistance(destination[0]);
    const captureProgress = [0.1, 0.35, 0.65, 0.9].map(
      (t) => CAPTURE_START + (CAPTURE_END - CAPTURE_START) * t,
    );
    const captureDistances = captureProgress.map((progress) =>
      radialDistance(
        sampleSwitchChoreography(transition, progress).world.find(
          (body) => body.id === 2,
        )!,
      ),
    );
    expect(captureDistances[0]).toBeGreaterThan(destinationRadius);
    for (let index = 1; index < captureDistances.length; index++)
      expect(captureDistances[index]).toBeLessThan(captureDistances[index - 1]);

    const settled = sampleSwitchChoreography(transition, 1);
    expect(settled.phase).toBe("complete");
    expect(settled.world.find((body) => body.id === 2)).toMatchObject({
      ...destination[0],
      opacity: 1,
      interactive: true,
    });
    expect(settled.world.find((body) => body.id === 1)?.opacity).toBe(0);
  });

  it("accelerates and then decelerates without reversing", () => {
    const transition = beginSwitchChoreography(
      [contact(1, 80)],
      [contact(2, 120)],
      8,
      { intensity: 1, reducedMotion: false },
    );
    const rotations = (progresses: number[]) =>
      progresses.map(
        (progress) =>
          sampleSwitchChoreography(transition, progress).accumulatedRotation,
      );
    const increments = (values: number[]) =>
      values.slice(1).map((value, index) => value - values[index]);

    const accelerate = increments(
      rotations(
        [0.02, 0.06, 0.1, 0.14, 0.18].map((p) => (p * ACCELERATE_END) / 0.2),
      ),
    );
    expect(accelerate.every((value) => value > 0)).toBe(true);
    for (let index = 1; index < accelerate.length; index++)
      expect(accelerate[index]).toBeGreaterThan(accelerate[index - 1]);

    const settle = increments(
      rotations(
        [0, 0.25, 0.5, 0.75, 1].map(
          (t) => SETTLE_START + (1 - SETTLE_START) * t,
        ),
      ),
    );
    expect(settle.every((value) => value > 0)).toBe(true);
    for (let index = 1; index < settle.length; index++)
      expect(settle[index]).toBeLessThan(settle[index - 1]);
    expect(
      sampleSwitchChoreography(transition, 1).angularVelocity,
    ).toBeLessThan(1e-9);
  });

  it("keeps retained contacts continuous and opaque across every boundary", () => {
    const source = [contact(1, 80, 0.2), contact(2, 120, 0.8)];
    const destination = [contact(1, 150, 1.1), contact(3, 210, 1.8)];
    const transition = beginSwitchChoreography(source, destination, 9, {
      intensity: 0.5,
      reducedMotion: false,
    });
    expect(transition.entries.map(({ role }) => role)).toEqual([
      "retained",
      "leaving",
      "entering",
    ]);
    const epsilon = 1e-6;
    for (const boundary of [
      ACCELERATE_END,
      SHED_START,
      CAPTURE_START,
      SHED_END,
      SETTLE_START,
      CAPTURE_END,
    ]) {
      const samples = [boundary - epsilon, boundary, boundary + epsilon].map(
        (progress) =>
          sampleSwitchChoreography(transition, progress).world.find(
            (body) => body.id === 1,
          )!,
      );
      expect(samples.map(({ opacity }) => opacity)).toEqual([1, 1, 1]);
      expect(
        Math.hypot(samples[1].x - samples[0].x, samples[1].y - samples[0].y),
      ).toBeLessThan(0.01);
      expect(
        Math.hypot(samples[2].x - samples[1].x, samples[2].y - samples[1].y),
      ).toBeLessThan(0.01);
    }
  });

  it("scales visible spin and displacement by turnover, not population size", () => {
    const shared = [1, 2, 3, 4].map((id, index) =>
      contact(id, 80 + index * 30, index * 0.2),
    );
    const overlapDestination = [...shared.slice(0, 3), contact(5, 200, 1.2)];
    const turnoverDestination = [5, 6, 7, 8].map((id, index) =>
      contact(id, 80 + index * 30, 1.2 + index * 0.2),
    );
    const overlap = beginSwitchChoreography(shared, overlapDestination, 10, {
      intensity: 0.25,
      reducedMotion: false,
    });
    const turnover = beginSwitchChoreography(shared, turnoverDestination, 11, {
      intensity: 1,
      reducedMotion: false,
    });
    expect(turnover.maximumRotation).toBeGreaterThan(overlap.maximumRotation);
    expect(turnover.radialDisplacement).toBeGreaterThan(
      overlap.radialDisplacement,
    );

    const overlapLeaving = sampleSwitchChoreography(
      overlap,
      SHED_END,
    ).world.find((body) => body.id === 4)!;
    const turnoverLeaving = sampleSwitchChoreography(
      turnover,
      SHED_END,
    ).world.find((body) => body.id === 1)!;
    expect(
      radialDistance(turnoverLeaving) - radialDistance(shared[0]),
    ).toBeGreaterThan(
      radialDistance(overlapLeaving) - radialDistance(shared[3]),
    );
  });

  it("assigns deterministic per-key stagger without frame-count state", () => {
    const source = [1, 2, 3, 4].map((id) => contact(id, 60 + id * 20));
    const destination = [5, 6, 7, 8].map((id) => contact(id, 60 + id * 20));
    const first = beginSwitchChoreography(source, destination, 12, {
      intensity: 1,
      reducedMotion: false,
    });
    const second = beginSwitchChoreography(source, destination, 13, {
      intensity: 1,
      reducedMotion: false,
    });
    expect(first.entries.map(({ key, stagger }) => ({ key, stagger }))).toEqual(
      second.entries.map(({ key, stagger }) => ({ key, stagger })),
    );
    expect(
      new Set(first.entries.map(({ stagger }) => stagger)).size,
    ).toBeGreaterThan(1);
  });
});
