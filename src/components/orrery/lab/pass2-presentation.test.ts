/** ORRERY LAB A (pass 2): presentation helpers — stacks and focus card. */
import { describe, expect, it } from "vitest";
import { projectAnimatedFrame } from "@/logic/orrery-frame";
import { findStacks } from "./body-stack";
import { FOCUS_CARD_MIN_HEIGHT, focusCardPlacement } from "./focus-card";

const body = (id: number, x: number, y: number) => ({
  id,
  kind: "contact" as const,
  x,
  y,
  radius: 16,
  ringRadius: Math.hypot(x, y),
  opacity: 1,
  interactive: true,
});

describe("co-angular stacks", () => {
  it("groups visibly overlapping bodies without moving them; front = nearest", () => {
    const world = [body(1, 0, 120), body(2, 2, 126), body(3, 150, 0)];
    const frame = projectAnimatedFrame(
      { generation: 1, from: world, to: world },
      1,
      { x: 0, y: 0, zoom: 1, tilt: 0.7, yaw: 0 },
      { width: 412, height: 840 },
    );
    const before = frame.bodies.map((b) => [b.x, b.y, b.radius, b.hitRadius]);
    const stacks = findStacks(frame, {});
    expect(stacks).toHaveLength(1);
    const ids = [stacks[0].front, ...stacks[0].hidden].map(
      (i) => frame.bodies[i].id,
    );
    expect(ids.sort()).toEqual([1, 2]);
    // Nearest (larger depth) is the front body.
    const front = frame.bodies[stacks[0].front];
    for (const i of stacks[0].hidden)
      expect(front.depth).toBeGreaterThanOrEqual(frame.bodies[i].depth);
    expect(frame.bodies.map((b) => [b.x, b.y, b.radius, b.hitRadius])).toEqual(
      before,
    );
  });
});

describe("focus card placement", () => {
  const region = { y: 0, height: 600 };
  it("goes below the body when it fits, else above", () => {
    const below = focusCardPlacement(region, 100, 20, 150, 8);
    expect(below.top).toBeGreaterThan(100 + 20);
    const above = focusCardPlacement(region, 500, 20, 150, 8);
    expect(above.top + above.maxHeight).toBeLessThan(500 - 20);
  });
  it("caps the card to the free room instead of covering the body", () => {
    const p = focusCardPlacement(region, 300, 20, 300, 8);
    expect(p.maxHeight).toBeGreaterThanOrEqual(FOCUS_CARD_MIN_HEIGHT);
    const overlaps = p.top < 300 + 20 && p.top + p.maxHeight > 300 - 20;
    expect(overlaps).toBe(false);
  });
});
