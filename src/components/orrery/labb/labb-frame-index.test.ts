import { describe, expect, it } from "vitest";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { bodyKey } from "@/logic/orrery-frame";
import { bodyAt, indexFrame, labBillboard } from "./labb-frame-index";

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

const satellite = body({
  id: -1,
  kind: "satellite",
  satelliteTarget: {
    kind: "satellite",
    uid: "m1",
    parentId: 1,
    parentUid: "p1",
  },
  radius: 3,
});
const frame = {
  generation: 1,
  pose: {} as never,
  viewport: { width: 100, height: 100 },
  center: { x: 0, y: 0 },
  bodies: [body({ id: 1 }), body({ id: 2, kind: "sun", depth: 5 }), satellite],
} as AnimatedFrame;

describe("labb frame index", () => {
  it("maps every body key (satellites via bodyKey) to its index", () => {
    const index = indexFrame(frame);
    expect(index).toEqual({
      "contact:1": 0,
      "sun:2": 1,
      [bodyKey(satellite)]: 2,
    });
    expect(bodyAt(frame, index, "sun:2")?.depth).toBe(5);
    expect(bodyAt(frame, index, "contact:9")).toBeUndefined();
  });

  it("rejects a stale index instead of returning the wrong body", () => {
    const index = { "contact:1": 1 };
    expect(bodyAt(frame, index, "contact:1")).toBeUndefined();
  });

  it("billboards at the frame radius and collapses hidden bodies to scale 0", () => {
    const index = indexFrame(frame);
    expect(labBillboard(frame, index, "contact:1", 16)).toEqual({
      x: 10,
      y: 20,
      scale: 2,
      depth: 0,
      opacity: 1,
    });
    const culled = {
      ...frame,
      bodies: [body({ id: 1, visible: false }), body({ id: 3, opacity: 0 })],
    } as AnimatedFrame;
    const culledIndex = indexFrame(culled);
    expect(labBillboard(culled, culledIndex, "contact:1", 16).scale).toBe(0);
    expect(labBillboard(culled, culledIndex, "contact:3", 16).scale).toBe(0);
    expect(labBillboard(culled, culledIndex, "contact:404", 16).scale).toBe(0);
  });
});
