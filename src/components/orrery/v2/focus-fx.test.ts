import { describe, expect, it } from "vitest";
import type { CameraViewport } from "@/logic/orrery-camera-logic";
import type { FocusCardRect } from "@/logic/orrery-focus-card-logic";
import { allocateLabels } from "@/logic/orrery-label-logic";
import {
  bodyDefocus,
  buildFocusSpec,
  type FocusDraw,
  labelExclusions,
  labelTextAlpha,
  NO_FOCUS_SPEC,
  occludedBodyAlpha,
  ringFocusFactor,
  touchesOcclusion,
} from "./focus-fx";
import {
  FOCUS_DIM,
  LABEL_DIM_FLOOR,
  OCCLUDE_PAD_DP,
  OCCLUDED_BODY_ALPHA,
  ORRERY_OCCLUSION_STYLE,
  RETICLE_LOCK_END,
  RING_FOCUS_DIM,
} from "./visual-tunables";

const resources = [
  { key: "sun:0", body: { id: 0, kind: "sun" } },
  { key: "contact:1", body: { id: 1, kind: "contact" } },
  { key: "contact:2", body: { id: 2, kind: "contact" } },
  { key: "contact:3", body: { id: 3, kind: "contact" } },
  { key: 'satellite:[1,"u1","m"]', body: { id: -1, kind: "satellite" } },
];
const draw = (spec: ReturnType<typeof buildFocusSpec>, mix = 1): FocusDraw => ({
  spec,
  mix,
  lock: RETICLE_LOCK_END,
});

describe("38.7-11: the focus spec", () => {
  it("single focus: the person is emphasised and carries the reticle; their moons are exempt", () => {
    const spec = buildFocusSpec(resources, [1], [], null, "dark");
    expect(spec).toEqual({
      keys: { "contact:1": true },
      active: true,
      parents: { 1: true },
      reticle: "contact:1",
      ringDim: RING_FOCUS_DIM.dark,
    });
  });

  it("an open cluster emphasises its members with no reticle; a focused moon carries it", () => {
    const cluster = buildFocusSpec(resources, [1, 2], [1, 2], null, "light");
    expect(cluster.keys).toEqual({ "contact:1": true, "contact:2": true });
    expect(cluster.reticle).toBeNull();
    expect(cluster.ringDim).toBe(RING_FOCUS_DIM.light);
    const moon = 'satellite:[1,"u1","m"]';
    const satellite = buildFocusSpec(resources, [], [], moon, "dark");
    expect(satellite.keys).toEqual({ [moon]: true });
    expect(satellite.reticle).toBe(moon);
    expect(buildFocusSpec(resources, [], [], null, "dark").active).toBe(false);
    // A stale id with no body emphasises nothing.
    expect(buildFocusSpec(resources, [99], [], null, "dark").active).toBe(
      false,
    );
  });
});

describe("38.7-11 (D-21): dim the rest", () => {
  const focus = draw(buildFocusSpec(resources, [1], [], null, "dark"));

  it("dims every other body, never the sun, the focused person or their moons", () => {
    expect(bodyDefocus(focus, "contact:2", "contact", null)).toBe(FOCUS_DIM);
    expect(bodyDefocus(focus, "sun:0", "sun", null)).toBe(0);
    expect(bodyDefocus(focus, "contact:1", "contact", null)).toBe(0);
    expect(bodyDefocus(focus, 'satellite:[1,"u1","m"]', "satellite", 1)).toBe(
      0,
    );
    expect(bodyDefocus(focus, 'satellite:[2,"u2","m"]', "satellite", 2)).toBe(
      FOCUS_DIM,
    );
    // It follows the mix, and nothing dims without focus.
    expect(
      bodyDefocus({ ...focus, mix: 0.5 }, "contact:2", "contact", null),
    ).toBe(FOCUS_DIM * 0.5);
    expect(bodyDefocus(null, "contact:2", "contact", null)).toBe(0);
    expect(bodyDefocus(draw(NO_FOCUS_SPEC), "contact:2", "contact", null)).toBe(
      0,
    );
  });

  it("other orbits fade by the mode's ring dim; the focused orbit keeps full alpha", () => {
    expect(ringFocusFactor(focus, "contact:2")).toBeCloseTo(
      1 - RING_FOCUS_DIM.dark,
      12,
    );
    expect(ringFocusFactor(focus, "contact:1")).toBe(1);
    expect(ringFocusFactor({ ...focus, mix: 0 }, "contact:2")).toBe(1);
  });

  it("other labels' text never drops below the readable floor; the sun's label is untouched", () => {
    expect(labelTextAlpha(focus, "contact:2")).toBeCloseTo(LABEL_DIM_FLOOR, 12);
    expect(
      labelTextAlpha({ ...focus, mix: 4 }, "contact:2"),
    ).toBeGreaterThanOrEqual(LABEL_DIM_FLOOR);
    expect(labelTextAlpha(focus, "contact:1")).toBe(1);
    expect(labelTextAlpha(focus, "sun:0")).toBe(1);
    expect(labelTextAlpha(null, "contact:2")).toBe(1);
  });
});

describe("38.7-11 (C-M2): labels avoid the docked card", () => {
  it("a label candidate under the card is not allocated; elsewhere it is", () => {
    const viewport: CameraViewport = { width: 400, height: 800 };
    const card: FocusCardRect = {
      x: 20,
      y: 600,
      width: 280,
      height: 180,
      maxHeight: 400,
      visible: true,
    };
    const candidate = (id: string, y: number) => ({
      id,
      name: id,
      x: 100,
      y,
      width: 80,
      height: 20,
      opacity: 1,
      focused: true,
      cluster: false,
      favorite: false,
      depth: 0,
    });
    const placed = allocateLabels(
      [candidate("under", 650), candidate("clear", 200)],
      "detail",
      viewport,
      labelExclusions([], card),
    );
    expect(placed.map((p) => p.id)).toEqual(["clear"]);
    // Without a visible card the same label is allocated.
    expect(
      allocateLabels(
        [candidate("under", 650)],
        "detail",
        viewport,
        labelExclusions([], { ...card, visible: false }),
      ).map((p) => p.id),
    ).toEqual(["under"]);
    // Bodies still exclude their own discs.
    expect(
      labelExclusions([{ x: 10, y: 10, radius: 5, visible: true }], null),
    ).toEqual([{ x: 5, y: 5, width: 10, height: 10 }]);
  });
});

describe("38.7-14 (T-DIM): the Lab B under-a-card test", () => {
  const card = { x: 100, y: 500, width: 200, height: 150 };

  it("defaults to the proven full-rect dim; Lab B's values are kept as drawn", () => {
    expect(ORRERY_OCCLUSION_STYLE).toBe("full-rect");
    expect([OCCLUDED_BODY_ALPHA, OCCLUDE_PAD_DP]).toEqual([0.12, 4]);
  });

  it("a body whose reach touches a padded rect draws at Lab B's alpha; one clear of it, or no rects, at 1", () => {
    expect(occludedBodyAlpha([card], 200, 560, 10)).toBe(OCCLUDED_BODY_ALPHA);
    // Reach 10 + pad 4 just touches the card's top edge from above.
    expect(occludedBodyAlpha([card], 200, 486, 10)).toBe(OCCLUDED_BODY_ALPHA);
    expect(occludedBodyAlpha([card], 200, 485, 10)).toBe(1);
    expect(occludedBodyAlpha(null, 200, 560, 10)).toBe(1);
    expect(occludedBodyAlpha([card], Number.NaN, 560, 10)).toBe(1);
  });

  it("labels use the unpadded rect; empty or non-finite rects never occlude", () => {
    expect(touchesOcclusion([card], 40, 480, 99, 499, 0)).toBe(false);
    expect(touchesOcclusion([card], 40, 480, 100, 500, 0)).toBe(true);
    expect(
      touchesOcclusion(
        [
          { x: Number.NaN, y: 0, width: 10, height: 10 },
          { x: 0, y: 0, width: 0, height: 10 },
        ],
        0,
        0,
        5,
        5,
        0,
      ),
    ).toBe(false);
  });
});
