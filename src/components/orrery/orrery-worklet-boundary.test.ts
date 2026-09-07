import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const babel = require("@babel/core");

interface Worklet {
  (...args: unknown[]): unknown;
  __closure: Record<string, unknown>;
  __initData?: { code: string };
}
/** Execute the emitted UI code; ordinary JS closure functions are remote-only. */
function onUI(fn: Worklet): () => void {
  if (!fn.__initData) throw new Error("Synchronous remote function call");
  const closure = Object.fromEntries(
    Object.entries(fn.__closure).map(([key, value]) => [
      key,
      typeof value === "function" ? () => onUI(value as Worklet)() : value,
    ]),
  );
  return runInNewContext(`(${fn.__initData.code})`).bind({
    __closure: closure,
  });
}

describe("production camera worklet boundaries", () => {
  it.each([false, true])(
    "resets samples on disabled setup/cleanup (enabled=%s)",
    (enabled) => {
      const effects: (() => () => void)[] = [];
      const stopped = { value: 0 };
      const stop = (() => {}) as unknown as Worklet;
      stop.__closure = { stopped };
      stop.__initData = { code: "function(){this.__closure.stopped.value++}" };
      const cancelInput = (() => {}) as unknown as Worklet;
      cancelInput.__closure = {};
      cancelInput.__initData = {
        code: 'function(){return {owner:"cancelled"}}',
      };
      const module = {
        exports: {} as {
          useOrreryCamera: (
            args: unknown,
          ) => Record<string, { value: unknown }>;
        },
      };
      const code = babel.transformFileSync(
        "src/components/orrery/use-orrery-camera.ts",
        {
          envName: "production",
        },
      ).code;
      runInNewContext(code, {
        exports: module.exports,
        module,
        require: (id: string) => {
          if (id === "react")
            return {
              useMemo: (fn: () => unknown) => fn(),
              useEffect: (fn: () => () => void) => effects.push(fn),
            };
          if (id === "react-native-reanimated")
            return {
              useSharedValue: (value: unknown) => ({ value }),
              useAnimatedReaction: vi.fn(),
              runOnUI: onUI,
            };
          if (id.includes("orrery-gesture-logic"))
            return { initialInput: () => ({ owner: "idle" }), cancelInput };
          if (id.includes("orrery-recovery-logic"))
            return {
              cameraExtent: (x: number) => x,
              createCameraMotion: () => ({ stop }),
            };
          return {};
        },
      });
      const camera = module.exports.useOrreryCamera({
        enabled,
        extent: 300,
        viewport: { width: 400, height: 700 },
      });
      const cleanup = effects[0]();
      expect(stopped.value).toBe(enabled ? 0 : 1);
      camera.samples.value = { panX: 100, scale: 3 };
      cleanup();
      expect(camera.samples.value).toEqual({
        panX: 0,
        panY: 0,
        scale: 1,
        rotation: 0,
        tiltY: 0,
        tiltActive: false,
      });
      expect(camera.live.value).toBe(false);
      expect(camera.input.value).toEqual({ owner: "cancelled" });
      expect(camera.reorder.value).toBeNull();
      expect(camera.frame.value).toBeNull();
      expect(stopped.value).toBe(enabled ? 1 : 2);
    },
  );
});
