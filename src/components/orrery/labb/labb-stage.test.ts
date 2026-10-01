import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));
vi.mock("react-native-reanimated", () => ({}));

import {
  type CameraPose,
  clampCameraPose,
  projectWorldPoint,
} from "@/logic/orrery-camera-logic";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { useLabFxStore } from "@/stores/orrery-labb-fx-store";
import { LAB_FX_PROFILES } from "@/theme/orrery-lab-fx";
import {
  invert3,
  lensFlareUniforms,
  stagePlaneUniforms,
  tiltShiftBlur,
} from "./LabStage";
import { LAB_HOME_TILT, labHomePose } from "./labb-home-tilt";
import { planeHomography, ringUniforms } from "./labb-rings-logic";

const viewport = { width: 400, height: 800 };
const pose: CameraPose = clampCameraPose(
  { x: 10, y: -20, zoom: 1.4, tilt: 0.56, yaw: 0.7 },
  300,
);

function frame(
  p: CameraPose,
  bodies: AnimatedFrame["bodies"] = [],
): AnimatedFrame {
  return {
    generation: 1,
    pose: p,
    viewport,
    bodies,
    center: { x: 200, y: 400 },
  };
}

describe("R2 stage plane", () => {
  it("invert3 inverts the plane homography (screen → world round trip)", () => {
    const m = planeHomography(pose, viewport);
    expect(m).not.toBeNull();
    const inv = invert3(m as number[]);
    expect(inv).not.toBeNull();
    const world = { x: 37, y: -55 };
    const s = projectWorldPoint(world, pose, viewport);
    const i = inv as number[];
    const hz = i[6] * s.x + i[7] * s.y + i[8];
    expect((i[0] * s.x + i[1] * s.y + i[2]) / hz).toBeCloseTo(world.x, 4);
    expect((i[3] * s.x + i[4] * s.y + i[5]) / hz).toBeCloseTo(world.y, 4);
  });

  it("invert3 returns null for a singular matrix", () => {
    expect(invert3([1, 2, 3, 2, 4, 6, 0, 0, 1])).toBeNull();
  });

  it("stage uniforms switch pool / grid independently and carry tokens only as uniforms", () => {
    const stage = LAB_FX_PROFILES.galaxy.dark.stage;
    const u = stagePlaneUniforms(
      frame(pose),
      300,
      [1, 0.8, 0.4],
      [0.5, 0.5, 0.6],
      stage,
      true,
      false,
      1,
    );
    expect(u.uPool[3]).toBeCloseTo(stage.pool);
    expect(u.uPool2[2]).toBe(0);
    expect(u.uPool2[0]).toBeCloseTo(300 * stage.poolRadius);
    expect(u.uPool2[1]).toBe(1);
    const g = stagePlaneUniforms(
      frame(pose),
      300,
      [1, 0.8, 0.4],
      [0.5, 0.5, 0.6],
      stage,
      false,
      true,
      0.5,
    );
    expect(g.uPool[3]).toBe(0);
    expect(g.uPool2[2]).toBeCloseTo(stage.grid * 0.5);
    for (const k of ["uInv0", "uInv1", "uInv2"]) expect(g[k]).toHaveLength(3);
  });

  it("light themes wash instead of adding light and never bloom or flare", () => {
    for (const pkg of ["galaxy", "standard"] as const) {
      const light = LAB_FX_PROFILES[pkg].light.stage;
      expect(light.poolAdditive).toBe(false);
      expect(light.bloomGain).toBe(0);
      expect(light.flare).toBe(0);
    }
    expect(LAB_FX_PROFILES.standard.dark.stage.grid).toBe(0);
  });
});

describe("R2 lens flare", () => {
  const sun = {
    id: 0,
    kind: "sun" as const,
    x: 200,
    y: 400,
    radius: 30,
    ringRadius: 0,
    hitRadius: 30,
    ringPath: [],
    depth: 0,
    opacity: 1,
    interactive: true,
    visible: true,
  };
  it("is strongest with the sun at the screen centre and zero without a sun", () => {
    const centred = lensFlareUniforms(
      frame(pose, [sun]),
      [1, 1, 1],
      [0, 0, 1],
      1,
    );
    const edge = lensFlareUniforms(
      frame(pose, [{ ...sun, x: 390, y: 790 }]),
      [1, 1, 1],
      [0, 0, 1],
      1,
    );
    const none = lensFlareUniforms(frame(pose), [1, 1, 1], [0, 0, 1], 1);
    expect(centred.uSun[3]).toBeCloseTo(1);
    expect(edge.uSun[3]).toBeLessThan(centred.uSun[3]);
    expect(none.uSun[3]).toBe(0);
  });
});

describe("R2 tilt-shift", () => {
  it("is off on a flat plane and on once tilted", () => {
    expect(tiltShiftBlur(frame({ ...pose, tilt: 0 }), 5)).toBe(0);
    expect(tiltShiftBlur(frame(pose), 5)).toBeGreaterThan(0);
  });
});

describe("R2 rim-lit rings", () => {
  it("puts the sun light in uSpin.zw only when asked", () => {
    const style = {
      mode: 0,
      alpha: 0.5,
      dashPeriod: 0,
      dashDuty: 1,
      farAlpha: 0.3,
      flowStrength: 1,
      flowOn: false,
    };
    const off = ringUniforms(
      [1, 1, 1, 1],
      [1, 1, 1],
      [1, 0, 0, 1],
      [0, 0, 1, 1, 1],
      style,
    );
    expect(off.uSpin.slice(2)).toEqual([0, 0]);
    const on = ringUniforms(
      [1, 1, 1, 1],
      [1, 1, 1],
      [1, 0, 0, 1],
      [0, 0, 1, 1, 1],
      {
        ...style,
        sunLight: [90, 1.1],
      },
    );
    expect(on.uSpin.slice(2)).toEqual([90, 1.1]);
  });
});

describe("R2 home tilt", () => {
  it("tilts Home only while the flag is on and keeps every other axis", () => {
    const home = clampCameraPose({ x: 0, y: 0, zoom: 0.8 }, 300);
    useLabFxStore.getState().setFlag("homeTilt", true);
    expect(labHomePose(home)).toEqual({ ...home, tilt: LAB_HOME_TILT });
    useLabFxStore.getState().setFlag("homeTilt", false);
    expect(labHomePose(home)).toBe(home);
    expect(labHomePose(null)).toBeNull();
    // R3: the legacy renderer keeps the production Home (tilt 0).
    useLabFxStore.getState().setFlag("homeTilt", true);
    useLabFxStore.getState().setRenderer("legacy");
    expect(labHomePose(home)).toBe(home);
    useLabFxStore.getState().reset();
  });
});
