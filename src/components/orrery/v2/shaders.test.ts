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
  BlendMode: { Dst: 2 },
  VertexMode: { TriangleStrip: 1, TriangleFan: 2 },
  Skia: {},
}));

import {
  gridPlaneUniforms,
  plainRingLine,
  ringPlaneUniforms,
} from "./draw-plane";
import { GRID_PLANE_SKSL, RING_PLANE_SKSL } from "./shaders";

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
});
