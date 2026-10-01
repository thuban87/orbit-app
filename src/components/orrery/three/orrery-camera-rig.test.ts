import { Matrix4, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  type CameraPose,
  type CameraViewport,
  clampCameraPose,
  projectWorldPoint,
} from "@/logic/orrery-camera-logic";
import { projectAnimatedFrameLite } from "../orrery-frame-lite";
import { orreryCameraRig } from "./orrery-camera-rig";

/** Project an orrery world point with a three camera built from the rig. */
function threeProject(
  point: { x: number; y: number },
  pose: CameraPose,
  viewport: CameraViewport,
  height = 0,
) {
  const rig = orreryCameraRig(pose, viewport);
  const camera = new PerspectiveCamera(
    rig.fovDeg,
    rig.aspect,
    rig.near,
    rig.far,
  );
  camera.setViewOffset(...rig.viewOffset);
  camera.matrixAutoUpdate = false;
  camera.matrix.copy(new Matrix4().fromArray(rig.world));
  camera.updateMatrixWorld(true);
  const ndc = new Vector3(point.x, height, point.y).project(camera);
  return {
    x: ((ndc.x + 1) / 2) * viewport.width,
    y: ((1 - ndc.y) / 2) * viewport.height,
  };
}

describe("orrery camera rig matches the pinhole projection (drawn == published)", () => {
  const viewports: CameraViewport[] = [
    { width: 412, height: 780 },
    {
      width: 412,
      height: 780,
      obstacles: [{ x: 340, y: 500, width: 72, height: 280 }],
    },
  ];
  const poses: CameraPose[] = [
    { x: 0, y: 0, zoom: 1, tilt: 0, yaw: 0 },
    { x: 40, y: -25, zoom: 2.3, tilt: 0.6, yaw: 1.1 },
    { x: -120, y: 80, zoom: 0.4, tilt: Math.PI / 3, yaw: 4.2 },
    { x: 10, y: 10, zoom: 3.9, tilt: 0.2, yaw: 5.9 },
  ];
  const points = [
    { x: 0, y: 0 },
    { x: 120, y: -40 },
    { x: -200, y: 160 },
    { x: 33, y: 250 },
  ];
  for (const viewport of viewports)
    for (const raw of poses)
      for (const point of points)
        it(`pose ${JSON.stringify(raw)} point ${JSON.stringify(point)} obstacles=${!!viewport.obstacles}`, () => {
          const pose = clampCameraPose(raw, 400);
          const expected = projectWorldPoint(point, pose, viewport);
          const actual = threeProject(point, pose, viewport);
          expect(actual.x).toBeCloseTo(expected.x, 3);
          expect(actual.y).toBeCloseTo(expected.y, 3);
        });
});

describe("lifted bodies (moons on a tilted orbit): frame-lite == three camera", () => {
  const viewport: CameraViewport = { width: 412, height: 780 };
  const poses: CameraPose[] = [
    { x: 0, y: 0, zoom: 1, tilt: 1.08, yaw: 0 },
    { x: 40, y: -25, zoom: 2.3, tilt: 0.6, yaw: 1.1 },
    { x: -120, y: 80, zoom: 0.4, tilt: 0.85, yaw: 4.2 },
  ];
  for (const raw of poses)
    for (const lift of [-18, 0, 12, 30])
      it(`pose ${JSON.stringify(raw)} lift ${lift}`, () => {
        const pose = clampCameraPose(raw, 400);
        const body = {
          id: -1,
          kind: "satellite" as const,
          x: 70,
          y: -45,
          radius: 4,
          ringRadius: 0,
          opacity: 1,
          interactive: true,
          lift,
        };
        const frame = projectAnimatedFrameLite([body], pose, viewport, 1);
        const actual = threeProject(body, frame.pose, viewport, lift);
        expect(frame.bodies[0].x).toBeCloseTo(actual.x, 3);
        expect(frame.bodies[0].y).toBeCloseTo(actual.y, 3);
      });
});
