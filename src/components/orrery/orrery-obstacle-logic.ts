import type {
  CameraPose,
  CameraRect,
  CameraViewport,
} from "@/logic/orrery-camera-logic";
import { validWindowRect } from "@/stores/shell-obstacle-store";

/** Shell and panels publish window coordinates; the canvas subtracts its own actual origin. */
export function canvasViewport(
  canvas: CameraRect | null,
  obstacles: readonly CameraRect[],
): CameraViewport {
  if (!validWindowRect(canvas)) return { width: 0, height: 0, obstacles: [] };
  return {
    width: canvas.width,
    height: canvas.height,
    obstacles: obstacles.flatMap((rect) => {
      if (!validWindowRect(rect)) return [];
      const x = Math.max(0, rect.x - canvas.x);
      const y = Math.max(0, rect.y - canvas.y);
      const right = Math.min(canvas.width, rect.x + rect.width - canvas.x);
      const bottom = Math.min(canvas.height, rect.y + rect.height - canvas.y);
      return right > x && bottom > y
        ? [{ x, y, width: right - x, height: bottom - y }]
        : [];
    }),
  };
}

const CONTROL_EDGE = 16;
const CONTROL_GAP = 8;
const CONTROL_WIDTH = 200;
const CONTROL_MIN_TARGET = 44;

/** Bottom-right free column. Native content may grow/scroll, never shrink its targets. */
export function controlsRegion(viewport: CameraViewport): CameraRect | null {
  const width = Math.min(CONTROL_WIDTH, viewport.width - 2 * CONTROL_EDGE);
  if (
    ![viewport.width, viewport.height].every(Number.isFinite) ||
    width < CONTROL_MIN_TARGET ||
    viewport.height < CONTROL_MIN_TARGET + 2 * CONTROL_EDGE
  )
    return null;
  const x = viewport.width - CONTROL_EDGE - width;
  let intervals = [
    { top: CONTROL_EDGE, bottom: viewport.height - CONTROL_EDGE },
  ];
  for (const obstacle of viewport.obstacles ?? []) {
    if (
      !validWindowRect(obstacle) ||
      obstacle.x >= x + width + CONTROL_GAP ||
      obstacle.x + obstacle.width <= x - CONTROL_GAP
    )
      continue;
    intervals = intervals
      .flatMap((interval) => {
        const top = Math.max(interval.top, obstacle.y - CONTROL_GAP);
        const bottom = Math.min(
          interval.bottom,
          obstacle.y + obstacle.height + CONTROL_GAP,
        );
        if (top >= bottom) return [interval];
        return [
          { top: interval.top, bottom: top },
          { top: bottom, bottom: interval.bottom },
        ];
      })
      .filter(
        (interval) => interval.bottom - interval.top >= CONTROL_MIN_TARGET,
      );
  }
  const available = intervals.sort((a, b) => b.bottom - a.bottom)[0];
  return available
    ? { x, y: available.top, width, height: available.bottom - available.top }
    : null;
}
export function cameraControlState(measured: boolean) {
  return {
    contactsDisabled: false,
    recenterDisabled: !measured,
    northDisabled: !measured,
  };
}
export function northOrientation(
  yaw: number,
  measured: boolean,
): string | undefined {
  "worklet";
  if (!measured || !Number.isFinite(yaw)) return undefined;
  const degrees =
    Math.round(((((yaw * 180) / Math.PI) % 360) + 360) % 360) % 360;
  return `${degrees} degrees from north`;
}
export function resetNorthPose(pose: CameraPose): CameraPose {
  "worklet";
  return { ...pose, yaw: 0 };
}
/** Plan 07 consumes this canonical world point in the projected Polaris renderer. */
export function polarisWorldPoint(extent: number) {
  "worklet";
  return {
    x: 0,
    y: -Math.max(32, Number.isFinite(extent) ? extent * 0.85 : 32),
  };
}
