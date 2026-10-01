import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));

import { defaultLabFlags, labFxSnapshot } from "@/stores/orrery-labb-fx-store";
import { LAB_FX_PROFILES } from "@/theme/orrery-lab-fx";
import {
  BODY_REACH,
  type LabBodyStatic,
  type LabSunStatic,
  labBodyFrameUniforms,
  labBodyMaterial,
  labHaze,
  labLightDir,
  labMoonFrameUniforms,
  labSeed,
  labSunFrameUniforms,
  SUN_REACH,
  SUN_STILL_T,
} from "./labb-bodies-logic";

const fx = (overrides: Record<string, boolean> = {}, intensity = 1) =>
  labFxSnapshot({
    renderer: "lab",
    flags: { ...defaultLabFlags(), ...overrides },
    intensity,
  });

const bodyStatic: LabBodyStatic = {
  uR: 10,
  uStatus: [0, 1, 0],
  uSky: [0, 0, 0],
  uShadow: [0, 0, 0],
  uHi: [1, 1, 1],
  uBase: [0.5, 0.5, 0.5],
  uBand: [0.3, 0.3, 0.3],
  uSeed: 0.4,
  uFloor: 0.55,
  uWrap: 0.35,
  uRimPx: 2,
  uRimStr: 0.9,
  atmo: 0.6,
  atmoAdd: 0.65,
  shadow: 0,
  fresnel: 0.5,
  desat: 0,
  spec: 0.1,
  haze: 0.15,
  intensity: 1,
  extent: 200,
};

describe("lab body materials", () => {
  it("thins the atmosphere and desaturates as a relationship decays", () => {
    const stable = labBodyMaterial("stable");
    const decay = labBodyMaterial("decay");
    const rogue = labBodyMaterial("rogue");
    const never = labBodyMaterial(null);
    expect(labBodyMaterial("wobble")).toEqual(stable);
    expect(decay.atmosphere).toBeLessThan(stable.atmosphere);
    expect(decay.atmosphere).toBeGreaterThan(0);
    expect(rogue.atmosphere).toBe(0);
    expect(never.atmosphere).toBe(0);
    expect(decay.desaturate).toBeCloseTo(0.25);
    expect(rogue.desaturate).toBeCloseTo(0.45);
    expect(never.spec).toBe(0);
  });

  it("keeps every light floor high enough for faces (dark ≥ 0.55, light ≥ 0.75)", () => {
    for (const pkg of Object.values(LAB_FX_PROFILES)) {
      expect(pkg.dark.bodies.lightFloor).toBeGreaterThanOrEqual(0.55);
      expect(pkg.light.bodies.lightFloor).toBeGreaterThanOrEqual(0.75);
    }
  });

  it("keeps drawn reach inside the frame's culling reach", () => {
    expect(BODY_REACH).toBeLessThanOrEqual(1.3);
    expect(SUN_REACH).toBeLessThanOrEqual(2);
  });
});

describe("lab body lighting helpers", () => {
  it("points the light from the body toward the sun, unit length", () => {
    expect(labLightDir(0, 0, 10, 0)).toEqual([1, 0]);
    const [x, y] = labLightDir(5, 5, 2, 1);
    expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
    // On the sun: a finite default.
    const d = labLightDir(3, 3, 3, 3);
    expect(Math.hypot(d[0], d[1])).toBeCloseTo(1, 9);
  });

  it("hazes only the far side (negative depth) and caps at max", () => {
    expect(labHaze(50, 100, 0.15)).toBe(0);
    expect(labHaze(-50, 100, 0.15)).toBeCloseTo(0.075);
    expect(labHaze(-500, 100, 0.15)).toBeCloseTo(0.15);
    expect(labHaze(-50, 0, 0.15)).toBe(0);
  });

  it("builds finite body uniforms that follow the frame radius and flags", () => {
    const body = { x: 100, y: 50, radius: 20, depth: -100 };
    const u = labBodyFrameUniforms(body, 0, 50, bodyStatic, fx());
    expect(u.uA[0]).toBe(10);
    expect(u.uA[1]).toBeCloseTo(0.5);
    expect(u.uA.slice(2)).toEqual([-1, 0]);
    expect(u.uD[3]).toBeCloseTo(0.075);
    expect(u.uC[3]).toBeCloseTo(0.6);
    const off = labBodyFrameUniforms(
      body,
      0,
      50,
      bodyStatic,
      fx({ bodyAtmosphere: false, depthHaze: false, bodyProcedural: false }),
    );
    expect(off.uC[3]).toBe(0);
    expect(off.uD[3]).toBe(0);
    expect(off.uH[2]).toBe(0);
    for (const v of Object.values(u).flat())
      expect(Number.isFinite(v as number)).toBe(true);
  });

  it("freezes the sun under reduced motion (fixed time, no pulse)", () => {
    const st: LabSunStatic = {
      uR: 30,
      uGlow: [1, 0.8, 0.3],
      uHi: [1, 1, 1],
      uDeep: [0.5, 0.3, 0.1],
      uBase: [0.2, 0.3, 0.6],
      plasma: 1,
      corona: 1,
      coronaAdd: 0.7,
      intensity: 1,
    };
    const body = { x: 0, y: 0, radius: 30, depth: 0 };
    const a = labSunFrameUniforms(body, 1234, true, st, fx());
    const b = labSunFrameUniforms(body, 98765, true, st, fx());
    expect(a).toEqual(b);
    expect(a.uS0[2]).toBe(SUN_STILL_T);
    expect(a.uS2[3]).toBe(1);
    expect(
      labSunFrameUniforms(body, 0, false, st, fx({ sunCorona: false })).uS2[3],
    ).toBe(0);
    expect(
      labSunFrameUniforms(body, 0, false, st, fx({ sunPlasma: false })).uS1[3],
    ).toBe(0);
  });

  it("seeds deterministically from the body key", () => {
    expect(labSeed("contact:1")).toBe(labSeed("contact:1"));
    expect(labSeed("contact:1")).not.toBe(labSeed("contact:2"));
    expect(labSeed("x")).toBeGreaterThanOrEqual(0);
    expect(labSeed("x")).toBeLessThan(1);
  });
});

describe("uniform contract (a missing uniform THROWS on device)", () => {
  const declared = (src: string) =>
    Array.from(
      src.matchAll(/uniform\s+(?:float|float2|float3|float4|half4)\s+(\w+);/g),
      (m) => m[1],
    );
  const sunStatic: LabSunStatic = {
    uR: 30,
    uGlow: [1, 1, 1],
    uHi: [1, 1, 1],
    uDeep: [1, 1, 1],
    uBase: [1, 1, 1],
    plasma: 1,
    corona: 1,
    coronaAdd: 1,
    intensity: 1,
  };
  const body = { x: 1, y: 2, radius: 3, depth: 0 };
  it("supplies every declared uniform of every WP-1.2 effect", async () => {
    const { LAB_EFFECT_SOURCES } = await import("./labb-effects");
    const bodyU = labBodyFrameUniforms(body, 0, 0, bodyStatic, fx());
    const sunU = labSunFrameUniforms(body, 0, false, sunStatic, fx());
    const moonU = labMoonFrameUniforms(
      body,
      0,
      0,
      {
        uTone: [1, 1, 1],
        uHi: [1, 1, 1],
        uSky: [0, 0, 0],
        floor: 0.2,
        haze: 0.1,
        extent: 10,
      },
      fx(),
    );
    const cases: [string, Record<string, unknown>][] = [
      [LAB_EFFECT_SOURCES.bodyPhoto, bodyU],
      [LAB_EFFECT_SOURCES.bodyProcedural, bodyU],
      [LAB_EFFECT_SOURCES.sunStar, sunU],
      [LAB_EFFECT_SOURCES.sunPhoto, sunU],
      [LAB_EFFECT_SOURCES.moon, moonU],
    ];
    for (const [src, uniforms] of cases) {
      const names = declared(src);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) expect(uniforms).toHaveProperty(name);
      for (const value of Object.values(uniforms))
        for (const n of [value].flat() as number[])
          expect(Number.isFinite(n)).toBe(true);
    }
  });
});
