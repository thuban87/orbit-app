import { describe, expect, it } from "vitest";
import { HOME_CAMERA, MIN_ZOOM } from "@/logic/orrery-camera-logic";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import {
  buildStarField,
  labSkyPose,
  NEBULA_FACTOR,
  placeSkyPoint,
  S_LAYER,
  S_RANK,
  S_X,
  S_Y,
  STAR_STRIDE,
  skyLayerPlacement,
  starTileSize,
} from "./labb-sky";

const VIEW = { width: 400, height: 800 };

function frameWith(
  pose: Partial<typeof HOME_CAMERA>,
  center: { x: number; y: number },
): AnimatedFrame {
  return {
    generation: 1,
    pose: { ...HOME_CAMERA, ...pose },
    viewport: VIEW,
    bodies: [],
    center,
  } as unknown as AnimatedFrame;
}

describe("Lab B sky parallax (L0)", () => {
  it("reads the DISPLAYED camera from the animated frame, never a pose value", () => {
    // During a switch `pose.value` is the destination while the frame carries
    // the sampled camera: the helper only ever sees the frame.
    const sampled = frameWith(
      { zoom: 2.5, yaw: 1.2, tilt: 0.4 },
      { x: 260, y: 300 },
    );
    const sky = labSkyPose(sampled);
    expect(sky).toEqual({
      cx: 260,
      cy: 300,
      vx: 200,
      vy: 400,
      zoom: 2.5,
      yaw: 1.2,
      tilt: 0.4,
    });
    expect(labSkyPose.length).toBe(1);
  });

  it("moves far layers less than near layers and is identity when parallax is off", () => {
    const sky = labSkyPose(frameWith({ zoom: 3 }, { x: 300, y: 100 }));
    const far = skyLayerPlacement(sky, 0.03, true);
    const near = skyLayerPlacement(sky, 0.22, true);
    expect(Math.abs(far.ox)).toBeLessThan(Math.abs(near.ox));
    expect(far.zs).toBeGreaterThan(1);
    expect(near.zs).toBeGreaterThan(far.zs);
    expect(skyLayerPlacement(sky, 0.22, false)).toEqual({
      ox: 0,
      oy: 0,
      zs: 1,
      c: 1,
      s: 0,
    });
    // Nebula push-in ≈ 1 + 0.08·ln(zoom) (research 03 §1.3).
    const neb = skyLayerPlacement(sky, NEBULA_FACTOR, true);
    expect(neb.zs).toBeCloseTo(1 + 0.08 * Math.log(3), 1);
  });

  it("rotates the sky with yaw about the viewport centre without double-rotating the pan offset", () => {
    const yawed = labSkyPose(
      frameWith({ yaw: Math.PI / 2 }, { x: 200, y: 400 }),
    );
    const place = skyLayerPlacement(yawed, 0.1, true);
    const tile = 1000;
    // A star at the tile centre sits on the pivot regardless of yaw.
    const pivot = placeSkyPoint(500, 500, tile, place, 200, 400);
    expect(pivot.x).toBeCloseTo(200, 6);
    expect(pivot.y).toBeCloseTo(400, 6);
    // +x in sky space maps to +y on screen at yaw π/2.
    const east = placeSkyPoint(600, 500, tile, place, 200, 400);
    expect(east.x).toBeCloseTo(200, 6);
    expect(east.y).toBeCloseTo(500, 6);
    // A screen-space pan offset lands as a screen-space shift.
    const panned = skyLayerPlacement(
      labSkyPose(frameWith({ yaw: Math.PI / 2 }, { x: 300, y: 400 })),
      0.1,
      true,
    );
    const moved = placeSkyPoint(500, 500, tile, panned, 200, 400);
    expect(moved.x - pivot.x).toBeCloseTo(10, 6);
    expect(moved.y - pivot.y).toBeCloseTo(0, 6);
  });

  it("wraps stars inside the tile so the field never runs out", () => {
    const sky = labSkyPose(frameWith({}, { x: 200 + 50000, y: 400 }));
    const place = skyLayerPlacement(sky, 0.22, true);
    const tile = 1200;
    for (let i = 0; i < 50; i++) {
      const p = placeSkyPoint(i * 37, i * 91, tile, place, 200, 400);
      expect(Math.abs(p.x - 200)).toBeLessThanOrEqual(tile / 2);
      expect(Math.abs(p.y - 400)).toBeLessThanOrEqual(tile / 2);
    }
  });

  it("sizes each layer's tile to cover the rotated viewport at the minimum zoom", () => {
    const tile = starTileSize(VIEW.width, VIEW.height, 0.22, MIN_ZOOM);
    const minScale = Math.exp(Math.log(MIN_ZOOM) * 0.22 * 1.3);
    expect(tile * minScale).toBeGreaterThanOrEqual(
      Math.hypot(VIEW.width, VIEW.height),
    );
  });

  it("builds a deterministic, finite star field", () => {
    const layers = [
      {
        count: 20,
        factor: 0.1,
        sizeMin: 1,
        sizeMax: 2,
        alphaMin: 0.4,
        alphaMax: 0.9,
        twinkle: 1,
        spikes: 0,
      },
      {
        count: 10,
        factor: 0.2,
        sizeMin: 2,
        sizeMax: 4,
        alphaMin: 0.5,
        alphaMax: 1,
        twinkle: 0,
        spikes: 0.5,
      },
    ];
    const a = buildStarField(layers, [500, 700], 2, 6, 0.3, 7);
    const b = buildStarField(layers, [500, 700], 2, 6, 0.3, 7);
    expect(a).toEqual(b);
    expect(a.length).toBe(30 * STAR_STRIDE);
    expect(a.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < 30; i++) {
      const k = i * STAR_STRIDE;
      const tile = a[k + S_LAYER] === 0 ? 500 : 700;
      expect(a[k + S_X]).toBeGreaterThanOrEqual(0);
      expect(a[k + S_X]).toBeLessThan(tile);
      expect(a[k + S_Y]).toBeLessThan(tile);
      expect(a[k + S_RANK]).toBeLessThan(1);
    }
  });
});
