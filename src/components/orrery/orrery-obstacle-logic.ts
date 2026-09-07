import type { CameraRect, CameraViewport } from "@/logic/orrery-camera-logic";
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
