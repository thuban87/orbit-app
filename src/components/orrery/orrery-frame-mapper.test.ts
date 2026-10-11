import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { expect, it, vi } from "vitest";

vi.mock("react-native-reanimated", () => ({
  cancelAnimation: vi.fn(),
  ReduceMotion: { Never: "never" },
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
  useAnimatedReaction: vi.fn(),
  useSharedValue: (value: unknown) => ({ value }),
  withTiming: (value: unknown) => value,
}));

import { HOME_CAMERA } from "@/logic/orrery-camera-logic";
import { projectAnimatedFrame } from "@/logic/orrery-frame";
import { previewReorder } from "@/logic/orrery-reorder-logic";
import {
  deriveSatelliteBodies,
  EMPTY_SATELLITE_SPEC,
  moonSplitFactor,
} from "@/logic/orrery-satellite-logic";
import { detectStacks } from "@/logic/orrery-stack-logic";
import { beginSwitchChoreography } from "@/logic/orrery-switch-choreography";
import {
  NO_SWITCH_LEAD,
  rotateSwitchWorld,
  sampleSwitchLead,
  sampleSwitchWorld,
} from "@/logic/orrery-switch-lead-logic";
import {
  NORMAL_SWITCH_DURATION_MS,
  sampleOrrerySwitchCamera,
  sampleSwitchLeadCamera,
} from "./use-orrery-switch-runtime";

const require = createRequire(import.meta.url);
const babel = require("@babel/core");

// These tests run the Reanimated Babel plugin over production sources; under
// full-suite machine load one test can exceed the 5 s default. A wider
// per-file budget only, no logic change (38.9 code-review fix pass).
vi.setConfig({ testTimeout: 20_000 });
const traverse = require("@babel/traverse").default;
function cell<T>(initial: T) {
  let value = initial;
  const listeners = new Map<number, () => void>();
  return {
    _isReanimatedSharedValue: true,
    get value() {
      return value;
    },
    set value(next: T) {
      value = next;
      for (const notify of listeners.values()) notify();
    },
    addListener: (id: number, notify: () => void) => listeners.set(id, notify),
    removeListener: (id: number) => listeners.delete(id),
  };
}

it("the emitted projection closure settles after publication under the installed native mapper registry", () => {
  const result = babel.transformFileSync(
    "src/components/orrery/OrreryWorld.tsx",
    { envName: "production", ast: true },
  );
  let code = "";
  traverse(result.ast, {
    ObjectProperty(path: {
      node: { key: { name: string }; value: { value?: unknown } };
    }) {
      const { key, value } = path.node;
      if (
        key.name === "code" &&
        typeof value.value === "string" &&
        value.value.includes("projectAnimatedFrame")
      )
        code = value.value;
    },
  });
  expect(code).not.toBe("");
  // Extract exactly the compiler's mapper inputs, rather than inventing a safe list.
  let names: string[] = [];
  traverse(
    babel.parseSync(`(${code})`, { configFile: false, babelrc: false }),
    {
      VariableDeclarator(path: {
        node: {
          id: { type: string; properties?: { key: { name: string } }[] };
          init?: { property?: { name: string } };
        };
      }) {
        if (
          path.node.init?.property?.name === "__closure" &&
          path.node.id.type === "ObjectPattern"
        )
          names = path.node.id.properties!.map((p) => p.key.name);
      },
    },
  );
  const published = cell<unknown>(null),
    projected = cell<unknown>(null),
    reorder = cell(null);
  const projection = vi.fn(projectAnimatedFrame);
  const progress = cell(1);
  const transition = cell(
    beginSwitchChoreography(
      [],
      [{ id: 0, kind: "sun", x: 0, y: 0, radius: 16, ringRadius: 0 }],
      7,
      { intensity: 0.8, reducedMotion: false },
    ),
  );
  const cameraFrom = cell({ ...HOME_CAMERA, x: 12, zoom: 1.4 });
  const cameraTo = cell({ ...HOME_CAMERA });
  const pose = cell({ ...HOME_CAMERA });
  // D-52 freeze: the only values the frame worklet may capture. SharedValues,
  // primitives, module functions and memoised plain values — never the switch
  // runtime (its resources hold full scenes), a scene snapshot or resources.
  const available: Record<string, unknown> = {
    transition,
    progress,
    cameraFrom,
    cameraTo,
    sampleOrrerySwitchCamera,
    pose,
    // 38.7-15 (D-76): the lead-in's state and clock (SharedValues), its pure
    // samplers and the switch duration (a primitive).
    lead: cell(NO_SWITCH_LEAD),
    leadClock: cell(0),
    sampleSwitchLead,
    sampleSwitchWorld,
    rotateSwitchWorld,
    sampleSwitchLeadCamera,
    NORMAL_SWITCH_DURATION_MS,
    viewport: { width: 400, height: 700 },
    generation: 7,
    // 38.7-05: the camera pan extent, a primitive (the dolly focal no longer
    // encodes it).
    frameExtent: 32,
    // 38.7-10 (C-M3/M13): the satellite spec SharedValue (never rows or
    // members) and the split from the frame's own camera zoom.
    satelliteSpec: cell(EMPTY_SATELLITE_SPEC),
    moonSplitFactor,
    // 38.7-10 (D-54): indexed stack detection on the projected bodies.
    detectStacks,
    reorder,
    previewReorder,
    deriveSatelliteBodies,
    projectAnimatedFrame: projection,
  };
  for (const heavy of ["switchRuntime", "scene", "resources", "camera"])
    expect(names).not.toContain(heavy);
  // Exact allowlist: any new capture must be reviewed here (D-52).
  expect([...names].sort()).toEqual(Object.keys(available).sort());
  const closure = Object.fromEntries(
    names.map((name) => {
      const key = Object.keys(available).find((key) => name === key);
      if (!key) throw new Error(`Unhandled compiled capture ${name}`);
      return [name, available[key]];
    }),
  );
  const updater = runInNewContext(`(${code})`).bind({ __closure: closure });
  // In-memory export of the installed implementation; no dependency file is edited.
  const source = readFileSync(
    "node_modules/react-native-reanimated/src/mappers.ts",
    "utf8",
  ).replace(
    "function createMapperRegistry()",
    "export function createMapperRegistry()",
  );
  const registryModule = {
    exports: {} as {
      createMapperRegistry: () => {
        start: (
          id: number,
          fn: () => void,
          inputs: unknown[],
          outputs: unknown[],
        ) => void;
      };
    },
  };
  const runtime: Record<string, unknown> = {
    Object,
    exports: registryModule.exports,
    module: registryModule,
    requestAnimationFrameFinalizer: () => {},
    require: (id: string) =>
      id === "./common"
        ? { IS_JEST: false, SHOULD_BE_USE_WEB: false }
        : id === "./isSharedValue"
          ? {
              isSharedValue: (value: { _isReanimatedSharedValue?: boolean }) =>
                value?._isReanimatedSharedValue === true,
            }
          : {},
  };
  runtime.global = runtime;
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    runtime,
  );
  const registry = registryModule.exports.createMapperRegistry();
  const publish = vi.fn(() => {
    published.value = projected.value;
  });
  registry.start(
    1,
    () => {
      projected.value = updater();
    },
    Object.values(closure),
    [projected],
  );
  registry.start(2, publish, [projected], []);
  const tick = () => (runtime.__mapperRun as () => void)();
  for (let i = 0; i < 5; i++) tick();
  expect(projection).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledTimes(1);
  expect(published.value).toBe(projected.value);
  for (const phaseProgress of [0.1, 0.3, 0.55, 0.85, 1]) {
    progress.value = phaseProgress;
    for (let i = 0; i < 5; i++) tick();
    expect(published.value).toBe(projected.value);
  }
  expect(projection).toHaveBeenCalledTimes(6);
  expect(publish).toHaveBeenCalledTimes(6);
});

/** Every compiled OrreryWorld worklet: its source and its exact closure names. */
function compiledWorldWorklets(): { code: string; names: string[] }[] {
  const result = babel.transformFileSync(
    "src/components/orrery/OrreryWorld.tsx",
    { envName: "production", ast: true },
  );
  const codes: string[] = [];
  traverse(result.ast, {
    ObjectProperty(path: {
      node: { key: { name: string }; value: { value?: unknown } };
    }) {
      const { key, value } = path.node;
      if (key.name === "code" && typeof value.value === "string")
        codes.push(value.value);
    },
  });
  return codes.map((code) => {
    let names: string[] = [];
    traverse(
      babel.parseSync(`(${code})`, { configFile: false, babelrc: false }),
      {
        VariableDeclarator(path: {
          node: {
            id: { type: string; properties?: { key: { name: string } }[] };
            init?: { property?: { name: string } };
          };
        }) {
          if (
            path.node.init?.property?.name === "__closure" &&
            path.node.id.type === "ObjectPattern" &&
            names.length === 0
          )
            names = path.node.id.properties!.map((p) => p.key.name);
        },
      },
    );
    return { code, names };
  });
}

it("38.7-04: the tap worklet captures member identities only, and no OrreryWorld worklet captures a heavy JS object", () => {
  const worklets = compiledWorldWorklets();
  expect(worklets.length).toBeGreaterThan(5);
  // Rebuilt (and re-serialised) whenever the gesture memo changes: {id, uid}
  // identities, never the full member rows (carried in from 38.7-03).
  const tap = worklets.filter(({ code }) =>
    code.includes("resolveSatelliteTap"),
  );
  expect(tap).toHaveLength(1);
  expect([...tap[0].names].sort()).toEqual(
    // D-60: labels no longer take part in tap resolution (no allocations).
    ["identities", "memberIdentities", "resolveSatelliteTap"].sort(),
  );
  // New UI reactions capture only SharedValues, primitives, module functions
  // and runOnJS callbacks — never the scene, resources, runtime, the text
  // publisher (it holds the whole Paragraph cache) or prepared text.
  for (const { names } of worklets)
    for (const heavy of [
      "switchRuntime",
      "scene",
      "resources",
      "members",
      "publisher",
      "publisherRef",
      "textScene",
      "labelSources",
      "initialsSources",
      "orreryTextService",
    ])
      expect(names).not.toContain(heavy);
});
