/**
 * 38.7-09: the V2 SkSL sources compile (CanvasKit's SkSL compiler, the same
 * front end as the device's Skia) and their uniform blocks match the JS
 * uniform builders float for float — a shader that fails to compile is
 * silently skipped on the phone (orreryShader returns null), so this is the
 * only place a typo or a uniform-order drift is caught before a device pass.
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({
  BlendMode: { Dst: 2, SrcOver: 3, Screen: 14 },
  TileMode: { Clamp: 0 },
  ClipOp: { Difference: 0, Intersect: 1 },
  FilterMode: { Nearest: 0, Linear: 1 },
  MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
  PaintStyle: { Fill: 0, Stroke: 1 },
  VertexMode: { TriangleStrip: 1, TriangleFan: 2 },
  Skia: {},
}));

import {
  bodyLitUniforms,
  coronaUniforms,
  sunDiscUniforms,
} from "./draw-bodies";
import {
  gridPlaneUniforms,
  plainRingLine,
  ringPlaneUniforms,
} from "./draw-plane";
import type { BodyLit, SunLook } from "./scene-specs";
import {
  BODY_PHOTO_SKSL,
  BODY_SWATCH_SKSL,
  GRID_PLANE_SKSL,
  RING_PLANE_SKSL,
  SUN_CORONA_SKSL,
  SUN_DISC_SKSL,
} from "./shaders";

interface CanvasKitLike {
  RuntimeEffect: {
    Make(
      source: string,
      onError?: (error: string) => void,
    ): { getUniformFloatCount(): number; delete(): void } | null;
  };
}

let ck: CanvasKitLike;
beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const dir = join(
    require.resolve("canvaskit-wasm/package.json"),
    "..",
    "bin",
    "full",
  );
  const init = require(join(dir, "canvaskit.js")) as (options: {
    locateFile: (file: string) => string;
  }) => Promise<CanvasKitLike>;
  ck = await init({ locateFile: (file) => join(dir, file) });
}, 30_000);

function compile(source: string) {
  let error = "";
  const effect = ck.RuntimeEffect.Make(source, (e) => {
    error = e;
  });
  return { effect, error };
}

const H = [1, 0, 200, 0, 0.5, 400, 0, 0.001, 1];

describe("V2 SkSL", () => {
  it("the ring shader compiles and takes exactly ringPlaneUniforms' 32 floats", () => {
    const { effect, error } = compile(RING_PLANE_SKSL);
    expect(error).toBe("");
    expect(effect?.getUniformFloatCount()).toBe(
      ringPlaneUniforms(H, 100, plainRingLine(1, 0.4, [1, 1, 1, 1])).length,
    );
    effect?.delete();
  });

  it("the grid shader compiles and takes exactly gridPlaneUniforms' 21 floats", () => {
    const { effect, error } = compile(GRID_PLANE_SKSL);
    expect(error).toBe("");
    expect(effect?.getUniformFloatCount()).toBe(
      gridPlaneUniforms(
        H,
        300,
        {
          ink: [1, 1, 1, 1],
          opacity: 0.1,
          rings: 6,
          spokes: 12,
          halfWidthDp: 0.4,
          extent: 1.1,
          farAlpha: 0.5,
        },
        0.4,
      ).length,
    );
    effect?.delete();
  });

  // 38.7-10: the lit bodies and the star sun.
  const ink = [0.5, 0.5, 0.5, 1] as const;
  const lit: BodyLit = {
    rimInk: ink,
    glowInk: ink,
    highlightInk: ink,
    floor: 0.85,
    lightZ: 0.9,
    wrap: 0.5,
    desaturate: 0.25,
    rimDp: 1.5,
    rimStrength: 0.9,
    fresnel: 0.35,
    atmosphere: 0.85,
    atmosphereAdditive: 0.65,
    atmosphereReach: 1.3,
    spec: 0.14,
  };
  const sun: SunLook = {
    starlightInk: ink,
    paperInk: ink,
    chart: false,
    coronaAlpha: 1,
    additive: true,
  };
  it("the lit swatch and photo body shaders compile and take bodyLitUniforms + their 4 floats", () => {
    const base = bodyLitUniforms(16, 0.5, [0.6, -0.8], lit, 0).length;
    expect(base).toBe(28);
    for (const source of [BODY_SWATCH_SKSL, BODY_PHOTO_SKSL]) {
      const { effect, error } = compile(source);
      expect(error).toBe("");
      expect(effect?.getUniformFloatCount()).toBe(base + 4);
      effect?.delete();
    }
  });
  it("the star sun's corona and disc compile and take coronaUniforms' 14 / sunDiscUniforms' 13 floats", () => {
    const corona = compile(SUN_CORONA_SKSL);
    expect(corona.error).toBe("");
    expect(corona.effect?.getUniformFloatCount()).toBe(
      coronaUniforms(30, 1.7, sun, ink).length,
    );
    corona.effect?.delete();
    const disc = compile(SUN_DISC_SKSL);
    expect(disc.error).toBe("");
    expect(disc.effect?.getUniformFloatCount()).toBe(
      sunDiscUniforms(30, 2.3, false, 1, sun, ink).length,
    );
    disc.effect?.delete();
  });
});
