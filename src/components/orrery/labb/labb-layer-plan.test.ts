import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));

import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { LabelAllocation } from "@/logic/orrery-label-logic";
import { LAB_EFFECT_SOURCES } from "./labb-effects";
import { indexFrame, labBillboard } from "./labb-frame-index";
import {
  flattenUniforms,
  hudTagPlacement,
  planBodyDraws,
  planLabelDraws,
  uniformOrder,
} from "./labb-layer-plan";

const body = (over: Partial<AnimatedFrame["bodies"][number]>) =>
  ({
    id: 1,
    kind: "contact",
    x: 10,
    y: 20,
    radius: 32,
    ringRadius: 60,
    hitRadius: 32,
    ringPath: [],
    depth: 0,
    opacity: 1,
    interactive: true,
    visible: true,
    ...over,
  }) as AnimatedFrame["bodies"][number];

const frameOf = (bodies: AnimatedFrame["bodies"]) =>
  ({
    generation: 1,
    pose: {} as never,
    viewport: { width: 100, height: 100 },
    center: { x: 0, y: 0 },
    bodies,
  }) as AnimatedFrame;

describe("uniform flattening", () => {
  it("reads SkSL declaration order and skips child shaders", () => {
    const photo = uniformOrder(LAB_EFFECT_SOURCES.bodyPhoto);
    const procedural = uniformOrder(LAB_EFFECT_SOURCES.bodyProcedural);
    expect(photo.slice(-9)).toEqual([
      "uA",
      "uB",
      "uC",
      "uD",
      "uE",
      "uF",
      "uG",
      "uH",
      "uK",
    ]);
    expect(photo).not.toContain("uImage");
    // The procedural surface declares its band colours after the shared block.
    expect(procedural.slice(-2)).toEqual(["uI", "uJ"]);
  });

  it("flattens a named block in that order (extra names ignored)", () => {
    expect(
      flattenUniforms({ b: [3, 4], a: 1, extra: [9, 9], c: [5] }, [
        "a",
        "b",
        "c",
      ]),
    ).toEqual([1, 3, 4, 5]);
  });
});

describe("planBodyDraws", () => {
  const specs = [
    { key: "contact:1", radius: 16 },
    { key: "contact:2", radius: 16 },
    { key: "contact:3", radius: 16 },
    { key: "contact:4", radius: 16 },
  ];

  it("uses the billboard geometry, skips culled bodies, sorts by depth (stable)", () => {
    const f = frameOf([
      body({ id: 1, depth: 4, radius: 32 }),
      body({ id: 2, depth: -1 }),
      body({ id: 3, depth: 4 }),
      body({ id: 4, visible: false }),
    ]);
    const index = indexFrame(f);
    const plan = planBodyDraws(f, index, specs, null);
    expect(plan.behind).toEqual([]);
    expect(plan.front.map((d) => d.i)).toEqual([1, 0, 2]);
    const first = plan.front[1];
    const ref = labBillboard(f, index, "contact:1", 16);
    expect(first).toEqual({
      i: 0,
      x: ref.x,
      y: ref.y,
      s: ref.scale,
      depth: ref.depth,
      alpha: ref.opacity,
    });
    // frame radius 32 over world radius 16 → local scale 2.
    expect(first.s).toBe(2);
  });

  it("splits around the sun: strictly-farther bodies draw behind it", () => {
    const f = frameOf([
      body({ id: 1, depth: -3 }),
      body({ id: 2, depth: 0 }),
      body({ id: 3, depth: 2 }),
    ]);
    const plan = planBodyDraws(f, indexFrame(f), specs.slice(0, 3), 0);
    expect(plan.behind.map((d) => d.i)).toEqual([0]);
    // Equal depth keeps the component path's order: the sun resource first.
    expect(plan.front.map((d) => d.i)).toEqual([1, 2]);
  });
});

describe("planLabelDraws", () => {
  const allocations: LabelAllocation[] = [
    {
      id: "contact:1",
      name: "A",
      rect: { x: 5, y: 50, width: 40, height: 20 },
      opacity: 0.8,
      contextRect: { x: 5, y: 72, width: 40, height: 16 },
    },
    {
      id: "contact:2",
      name: "B",
      rect: { x: 60, y: 10, width: 40, height: 20 },
      opacity: 0,
    },
  ];
  const specs = [
    { id: "contact:2", w: 40, h: 20 },
    { id: "contact:1", w: 40, h: 20 },
    { id: "contact:3", w: 40, h: 20 },
  ];

  it("HUD: same placement as the component path; transparent / unallocated dropped", () => {
    const plan = planLabelDraws(allocations, () => 90, specs, true);
    expect(plan.map((p) => p.i)).toEqual([1]);
    expect(plan[0].tag).toEqual(
      hudTagPlacement(allocations, "contact:1", 20, 90),
    );
    expect(plan[0].tag?.toward).toBe(1);
    expect(plan[0].caption).toEqual({ x: 5, y: 72, opacity: 0.8 });
  });

  it("legacy plates: the allocation rect and opacity", () => {
    const plan = planLabelDraws(allocations, () => undefined, specs, false);
    expect(plan[0].tag).toMatchObject({ x: 5, y: 50, opacity: 0.8 });
  });
});
