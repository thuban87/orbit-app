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
import { semanticLevel } from "@/logic/orrery-label-logic";
import { previewReorder } from "@/logic/orrery-reorder-logic";
import { deriveSatelliteBodies } from "@/logic/orrery-satellite-logic";
import {
  beginSwitchChoreography,
  sampleSwitchChoreography,
} from "@/logic/orrery-switch-choreography";
import { sampleOrrerySwitchCamera } from "./use-orrery-switch-runtime";

const require = createRequire(import.meta.url);
const babel = require("@babel/core");
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
  const available: Record<string, unknown> = {
    switchRuntime: {
      transition,
      progress,
      cameraFrom,
      cameraTo,
    },
    sampleSwitchChoreography,
    sampleOrrerySwitchCamera,
    pose,
    level: cell("overview"),
    viewport: { width: 400, height: 700 },
    scene: { generation: 7, systemSnapshot: { members: [] } },
    satellites: [],
    camera: { reorder, frame: published },
    reorder,
    previewReorder,
    deriveSatelliteBodies,
    semanticLevel,
    projectAnimatedFrame: projection,
  };
  const closure = Object.fromEntries(
    names.map((name) => {
      const key = Object.keys(available)
        .sort((a, b) => b.length - a.length)
        .find(
          (key) =>
            name === key || name.toLowerCase().endsWith(key.toLowerCase()),
        );
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
  expect(names).not.toContain("camera");
  for (const phaseProgress of [0.1, 0.3, 0.55, 0.85, 1]) {
    progress.value = phaseProgress;
    for (let i = 0; i < 5; i++) tick();
    expect(published.value).toBe(projected.value);
  }
  expect(projection).toHaveBeenCalledTimes(6);
  expect(publish).toHaveBeenCalledTimes(6);
});
