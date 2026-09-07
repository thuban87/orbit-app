import { create } from "zustand";
import type { CameraRect } from "@/logic/orrery-camera-logic";

export function validWindowRect(rect: CameraRect | null): rect is CameraRect {
  return (
    rect !== null &&
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width > 0 &&
    rect.height > 0
  );
}
export function sameWindowRect(
  a: CameraRect | null,
  b: CameraRect | null,
): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height)
  );
}
interface ShellObstacleState {
  rects: Readonly<Record<string, CameraRect>>;
  publish: (key: string, rect: CameraRect | null) => void;
}
/** ADR-080/082: runtime window geometry only; existing shell positions stay owned by the shell. */
export function createShellObstacleStore() {
  return create<ShellObstacleState>()((set) => ({
    rects: {},
    publish: (key, candidate) =>
      set((state) => {
        const rect = validWindowRect(candidate) ? candidate : null;
        if (sameWindowRect(state.rects[key] ?? null, rect)) return state;
        const rects = { ...state.rects };
        if (rect) rects[key] = { ...rect };
        else delete rects[key];
        return { rects };
      }),
  }));
}
export const useShellObstacleStore = createShellObstacleStore();

/** Async native measurements may finish after a later layout, hide or unmount. */
export function createWindowMeasurement(
  publish: (rect: CameraRect | null) => void,
) {
  let generation = 0;
  return {
    begin: () => {
      const current = ++generation;
      return (x: number, y: number, width: number, height: number) => {
        if (generation !== current) return;
        const rect = { x, y, width, height };
        publish(validWindowRect(rect) ? rect : null);
      };
    },
    clear: () => {
      generation++;
      publish(null);
    },
  };
}
