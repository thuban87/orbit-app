import { describe, expect, it } from "vitest";
import {
  detectStacks,
  discsStack,
  PIP_MAX,
  pipAngles,
  type StackBody,
  stackEligible,
  stacksFromGroups,
} from "./orrery-stack-logic";

/** A deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function body(partial: Partial<StackBody>): StackBody {
  return {
    kind: "contact",
    x: 0,
    y: 0,
    radius: 10,
    depth: 0,
    visible: true,
    interactive: true,
    opacity: 1,
    ...partial,
  };
}

/** The pairwise reference: every eligible pair compared (Lab A's scan). */
function bruteForce(bodies: StackBody[]) {
  const idx = bodies.flatMap((b, i) => (stackEligible(b) ? [i] : []));
  const parent = idx.map((_, k) => k);
  const root = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    return r;
  };
  for (let a = 0; a < idx.length; a++)
    for (let c = a + 1; c < idx.length; c++)
      if (discsStack(bodies[idx[a]], bodies[idx[c]])) {
        const ra = root(a);
        const rc = root(c);
        if (ra !== rc) parent[rc] = ra;
      }
  return stacksFromGroups(bodies, idx, parent);
}

function randomFrame(seed: number, count: number): StackBody[] {
  const next = rng(seed);
  return Array.from({ length: count }, () =>
    body({
      kind: next() < 0.03 ? "satellite" : "contact",
      x: next() * 1080,
      y: next() * 2200,
      radius: 9 + next() * 30,
      depth: Math.round(next() * 40) - 20,
      visible: next() > 0.02,
      interactive: next() > 0.02,
      opacity: next() < 0.05 ? 0.3 : 1,
    }),
  );
}

describe("38.7-10 (D-54): indexed stack detection", () => {
  it("equals the brute-force pair scan on random 1,000-body frames", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const bodies = randomFrame(seed, 1000);
      const stacks = detectStacks(bodies);
      expect(stacks).toEqual(bruteForce(bodies));
      // The frames really contain stacks (the test is not vacuous).
      expect(Object.keys(stacks).length).toBeGreaterThan(10);
    }
  });
  it("is a grid scan in code, not a pairwise scan", () => {
    const source = detectStacks.toString();
    expect(source).toMatch(/grid/);
    expect(source).not.toMatch(/for \(let c = a \+ 1/);
  });
  it("front = nearest (ties: the later frame index); hidden nearest first; transitive groups", () => {
    const bodies = [
      body({ x: 0, depth: 1 }),
      body({ x: 12, depth: 5 }),
      body({ x: 24, depth: 3 }), // overlaps only body 1: same group
      body({ x: 400, depth: 0 }),
      body({ x: 404, depth: 0 }),
    ];
    expect(detectStacks(bodies)).toEqual({
      1: { front: 1, hidden: [2, 0], overflow: false },
      4: { front: 4, hidden: [3], overflow: false },
    });
  });
  it("caps the hidden list at PIP_MAX with an overflow flag", () => {
    const bodies = Array.from({ length: PIP_MAX + 3 }, (_, i) =>
      body({ x: i, depth: i }),
    );
    const stacks = detectStacks(bodies);
    const front = PIP_MAX + 2;
    expect(stacks[front].hidden).toHaveLength(PIP_MAX);
    expect(stacks[front].hidden[0]).toBe(front - 1);
    expect(stacks[front].overflow).toBe(true);
    const exact = detectStacks(bodies.slice(0, PIP_MAX + 1));
    expect(exact[PIP_MAX].overflow).toBe(false);
  });
  it("ignores the sun, moons, hidden, non-interactive, fading and degenerate bodies", () => {
    const bodies = [
      body({}),
      body({ kind: "sun", x: 1 }),
      body({ kind: "satellite", x: 2 }),
      body({ visible: false, x: 3 }),
      body({ interactive: false, x: 4 }),
      body({ opacity: 0.2, x: 5 }),
      body({ radius: 0, x: 6 }),
      body({ x: Number.NaN }),
    ];
    expect(detectStacks(bodies)).toEqual({});
    expect(detectStacks([])).toEqual({});
  });
  it("pips sit on the side opposite the moon bump, never sharing its side", () => {
    for (const bump of [-3, -1.2, 0, 0.75, 2, 3.1])
      for (let count = 1; count <= PIP_MAX; count++)
        for (const angle of pipAngles(count, 0.42, -0.75, bump)) {
          const apart = Math.abs(
            Math.atan2(Math.sin(angle - bump), Math.cos(angle - bump)),
          );
          expect(apart).toBeGreaterThan(Math.PI / 2);
        }
    // Without a bump, the pips centre on the anchor.
    expect(pipAngles(1, 0.42, -0.75, null)).toEqual([-0.75]);
  });
});
