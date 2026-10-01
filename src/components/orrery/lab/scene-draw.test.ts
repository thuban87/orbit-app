/** ORRERY LAB A — arch perf pass: pure parts of the imperative renderer. */
import { describe, expect, it, vi } from "vitest";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { FOCUS_BODY_DIM } from "./deep-field-config";
import type { DeepFieldInk } from "./deep-field-ink";
import { BODY_SKSL, CORONA_SKSL, SUN_DISC_SKSL } from "./deep-field-shaders";
import {
  bodyUniforms,
  coronaUniforms,
  fadeIn,
  focusDim,
  type LabBodySpec,
  orderBodies,
  sunDiscUniforms,
} from "./scene-draw";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));

/** Float count of an SkSL source's uniform block (float/float2/half4). */
function declaredFloats(sksl: string): number {
  const size: Record<string, number> = { float: 1, float2: 2, half4: 4 };
  let total = 0;
  for (const m of sksl.matchAll(/uniform\s+(\w+)\s+\w+;/g)) {
    expect(size[m[1]]).toBeDefined();
    total += size[m[1]];
  }
  return total;
}

const ink: DeepFieldInk = {
  chart: false,
  background: [0, 0, 0, 1],
  voidTone: [0, 0, 0, 1],
  nebulaA: [0, 0, 0, 1],
  nebulaB: [0, 0, 0, 1],
  grid: [0, 0, 0, 1],
  starlight: [1, 1, 1, 1],
  shadow: [0, 0, 0, 1],
  textPrimary: [1, 1, 1, 1],
  textSecondary: [1, 1, 1, 1],
};

describe("uniform blocks match their SkSL declarations", () => {
  // RN-Skia's makeShader throws on a length mismatch: a wrong count would
  // crash the render loop on device, so pin it here.
  it("body / corona / sun disc", () => {
    expect(
      bodyUniforms(16, [0.1, 0.2, 0.3], 1, [1, 0, 0, 1], ink),
    ).toHaveLength(declaredFloats(BODY_SKSL));
    expect(coronaUniforms(30, 1, 0, [1, 1, 0, 1], ink)).toHaveLength(
      declaredFloats(CORONA_SKSL),
    );
    expect(sunDiscUniforms(30, 1, false, 1, 0, [1, 1, 0, 1], ink)).toHaveLength(
      declaredFloats(SUN_DISC_SKSL),
    );
  });
});

describe("body draw order", () => {
  const spec = (key: string, order: number): LabBodySpec => ({
    key,
    kind: "contact",
    order,
    radius: 16,
    fill: [1, 1, 1, 1],
    swatch: [1, 1, 1, 1],
    initials: null,
    fontSize: 16,
    image: null,
    imageWidth: 0,
    imageHeight: 0,
    photoAt: 0,
    enterAt: 0,
  });
  const body = (id: number, depth: number) => ({
    id,
    kind: "contact" as const,
    x: 0,
    y: 0,
    radius: 16,
    ringRadius: 0,
    hitRadius: 22,
    ringPath: [],
    depth,
    opacity: 1,
    interactive: true,
    visible: true,
  });
  it("sorts by depth with source-order ties (RN-Skia zIndex flush) and skips absent keys", () => {
    const frame = {
      bodies: [body(1, 5), body(2, 0), body(3, 0)],
    } as unknown as AnimatedFrame;
    const order = orderBodies(frame, [
      spec("contact:1", 0),
      spec("contact:3", 1),
      spec("contact:2", 2),
      spec("contact:9", 3),
    ]);
    expect(order.map((o) => o.spec.key)).toEqual([
      "contact:3",
      "contact:2",
      "contact:1",
    ]);
  });
});

describe("fades and focus dim", () => {
  it("fades linearly from the JS stamp, instantly under reduced motion", () => {
    expect(fadeIn(1000, 1000, 280, false)).toBe(0);
    expect(fadeIn(1000, 1140, 280, false)).toBeCloseTo(0.5, 9);
    expect(fadeIn(1000, 2000, 280, false)).toBe(1);
    expect(fadeIn(1000, 1000, 280, true)).toBe(1);
    expect(fadeIn(0, 5, 280, false)).toBe(1);
  });
  it("dims only unfocused bodies, by the pass-3 amount", () => {
    expect(focusDim("contact:1", { "contact:1": true }, 1)).toBe(1);
    expect(focusDim("contact:2", { "contact:1": true }, 1)).toBeCloseTo(
      1 - FOCUS_BODY_DIM,
      9,
    );
    expect(focusDim("contact:2", {}, 0)).toBe(1);
  });
});
