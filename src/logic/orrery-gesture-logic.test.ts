import { describe, expect, it } from "vitest";
import { clampCameraPose, projectWorldPoint, unprojectToWorldPlane } from "./orrery-camera-logic";
import { beginInput, cancelInput, cameraGestureStep, initialInput, claimHold, moveInput, PAN_DISTANCE, HOLD_MS, TILT_DISTANCE } from "./orrery-gesture-logic";

const viewport = { width: 400, height: 600 };
const extent = 1000;
const home = clampCameraPose({ x: 0, y: 0, zoom: 1 }, extent);
describe("camera input ownership", () => {
  it("movement before a stationary prolonged hold belongs to pan", () => {
    const pending = beginInput(initialInput(), 1);
    expect(claimHold(pending, HOLD_MS - 1, 0).owner).toBe("pending");
    const moved = moveInput(pending, 1, PAN_DISTANCE);
    expect(moved.owner).toBe("pan");
    expect(claimHold(moved, HOLD_MS + 1, 0).owner).toBe("pan");
    expect(claimHold(pending, HOLD_MS, 0).owner).toBe("reorder");
  });
  it("second pointer cancels rank ownership; release never revives a prior hold", () => {
    const held = claimHold(beginInput(initialInput(), 1), HOLD_MS, 0);
    const multi = moveInput(held, 2, 0);
    expect(multi.owner).toBe("multi");
    expect(multi.generation).toBeGreaterThan(held.generation);
    expect(moveInput(multi, 1, 0).owner).toBe("pan");
    expect(claimHold(moveInput(multi, 1, 0), HOLD_MS, 0).owner).toBe("pan");
    expect(cancelInput(multi).owner).toBe("cancelled");
  });
  it("pinch anchors the current world point and simultaneous yaw does not overwrite zoom", () => {
    const focal = { x: 250, y: 240 };
    const anchor = unprojectToWorldPlane(focal, home, viewport);
    const zoom = cameraGestureStep(home, { kind: "pinch", delta: 1.5, focal }, viewport, extent);
    const yaw = cameraGestureStep(zoom, { kind: "yaw", delta: 0.3 }, viewport, extent);
    expect(projectWorldPoint(anchor, zoom, viewport).x).toBeCloseTo(focal.x, 8);
    expect(projectWorldPoint(anchor, zoom, viewport).y).toBeCloseTo(focal.y, 8);
    expect(yaw.zoom).toBe(1.5);
    expect(yaw.yaw).toBeCloseTo(0.3);
  });
  it("tilt has a deliberate dead zone, bounded axes, and rebased zero deltas do not jump", () => {
    expect(cameraGestureStep(home, { kind: "tilt", delta: 5, travel: TILT_DISTANCE - 1 }, viewport, extent)).toEqual(home);
    const tilted = cameraGestureStep(home, { kind: "tilt", delta: 10000, travel: TILT_DISTANCE }, viewport, extent);
    expect(tilted.tilt).toBeCloseTo(Math.PI / 3);
    expect(cameraGestureStep(tilted, { kind: "pan", dx: 0, dy: 0 }, viewport, extent)).toEqual(tilted);
    expect(cameraGestureStep(tilted, { kind: "pinch", delta: 1, focal: { x: 200, y: 300 } }, viewport, extent)).toEqual(tilted);
  });
});
