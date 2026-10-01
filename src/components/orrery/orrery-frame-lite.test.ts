import { describe, expect, it } from "vitest";
import type { CameraPose, CameraViewport } from "@/logic/orrery-camera-logic";
import {
  type AnimatedWorldBody,
  projectAnimatedFrame,
} from "@/logic/orrery-frame";
import { projectAnimatedFrameLite } from "./orrery-frame-lite";

const world: AnimatedWorldBody[] = [
  {
    id: 0,
    kind: "sun",
    x: 0,
    y: 0,
    radius: 30,
    ringRadius: 0,
    opacity: 1,
    interactive: true,
  },
  {
    id: 4,
    kind: "contact",
    x: 40,
    y: -50,
    radius: 16,
    ringRadius: 64,
    opacity: 1,
    interactive: true,
  },
  {
    id: 7,
    kind: "contact",
    x: -120,
    y: 90,
    radius: 17.6,
    ringRadius: 150,
    opacity: 0.4,
    interactive: false,
  },
  {
    id: 9,
    kind: "contact",
    x: 300,
    y: 260,
    radius: 14.4,
    ringRadius: 397,
    opacity: 0,
    interactive: true,
  },
];

describe("lite frame == projectAnimatedFrame minus ringPath", () => {
  const viewports: CameraViewport[] = [
    { width: 411, height: 725 },
    {
      width: 411,
      height: 725,
      obstacles: [{ x: 330, y: 400, width: 81, height: 325 }],
    },
  ];
  const poses: CameraPose[] = [
    { x: 0, y: 0, zoom: 1, tilt: 0, yaw: 0, focalDistance: 600 },
    { x: 30, y: -10, zoom: 2.4, tilt: 0.7, yaw: 1.3, focalDistance: 900 },
    { x: -200, y: 120, zoom: 0.3, tilt: 1.04, yaw: 5.5 },
  ];
  for (const viewport of viewports)
    for (const pose of poses)
      it(`${JSON.stringify(pose)} obstacles=${!!viewport.obstacles}`, () => {
        const full = projectAnimatedFrame(
          { generation: 3, from: world, to: world },
          1,
          pose,
          viewport,
        );
        const lite = projectAnimatedFrameLite(world, pose, viewport, 3);
        expect(lite.pose).toEqual(full.pose);
        expect(lite.center.x).toBeCloseTo(full.center.x, 6);
        expect(lite.center.y).toBeCloseTo(full.center.y, 6);
        expect(lite.bodies.length).toBe(full.bodies.length);
        full.bodies.forEach((b, i) => {
          const l = lite.bodies[i];
          for (const k of [
            "x",
            "y",
            "radius",
            "ringRadius",
            "hitRadius",
            "depth",
            "opacity",
          ] as const)
            expect(l[k]).toBeCloseTo(b[k], 6);
          expect(l.visible).toBe(b.visible);
          expect(l.interactive).toBe(b.interactive);
          expect(l.ringPath).toEqual([]);
        });
      });
});
