import type {
  CameraPose,
  CameraRect,
  CameraViewport,
} from "@/logic/orrery-camera-logic";
import { sameWindowRect, validWindowRect } from "@/stores/shell-obstacle-store";

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

/**
 * 38.7-16 (D-79, owner-directed; supersedes D-19's cluster-panel obstacle and
 * the "feedback is a framing exclusion" rule): the map stays in its place no
 * matter which button is pressed or which dropdown, panel or notice opens.
 * Only PERSISTENT chrome shapes the map's framing (projection centre, Home,
 * Recenter, focus and cluster framing):
 * - the shell's tab bar and FAB;
 * - the top band: the full canvas width down to the lowest of the Orrery
 *   title bar and the System / View triggers. A band (not the triggers' own
 *   rects) so a System name that widens or narrows its trigger (maxWidth
 *   44 %) can never move the map;
 * - the camera controls column at its RESTING place: `controlsRegion` over
 *   the chrome above, its three plates bottom-anchored — exactly the rect the
 *   controls measure when nothing else is open. Never the live measurement:
 *   the controls still step aside for an open panel or notice (their own
 *   layout is unchanged), and that must not move the map.
 * The System and View panels, the cluster panel, the focus card and every
 * feedback notice are NOT framing inputs; they keep their own layout, the
 * D-55 occlusion dim and the label exclusion.
 */
export const FRAMING_CHROME_OBSTACLES: readonly string[] = [
  "shell-tabs",
  "shell-fab",
];
/** The obstacles whose lowest bottom edge sets the top band. */
export const FRAMING_TOP_BAND_OBSTACLES: readonly string[] = [
  "orrery-immersive-header",
  "orrery-system-trigger",
  "orrery-view-trigger",
];

/** The map's framing viewport (window rects in, canvas units out). */
export function framingViewport(
  canvas: CameraRect | null,
  obstacles: Readonly<Record<string, CameraRect>>,
): CameraViewport {
  const rects: CameraRect[] = [];
  for (const id of FRAMING_CHROME_OBSTACLES) {
    const rect = obstacles[id];
    if (rect) rects.push(rect);
  }
  if (validWindowRect(canvas)) {
    let bottom = Number.NEGATIVE_INFINITY;
    for (const id of FRAMING_TOP_BAND_OBSTACLES) {
      const rect = obstacles[id] ?? null;
      if (validWindowRect(rect))
        bottom = Math.max(bottom, rect.y + rect.height);
    }
    if (bottom > canvas.y)
      rects.push({
        x: canvas.x,
        y: canvas.y,
        width: canvas.width,
        height: bottom - canvas.y,
      });
  }
  const chrome = canvasViewport(canvas, rects);
  const reserve = controlsRestingRect(chrome);
  return reserve
    ? { ...chrome, obstacles: [...(chrome.obstacles ?? []), reserve] }
    : chrome;
}

/** Same size and the same obstacle rects, in order. */
export function sameCameraViewport(
  a: CameraViewport,
  b: CameraViewport,
): boolean {
  if (a === b) return true;
  if (a.width !== b.width || a.height !== b.height) return false;
  const left = a.obstacles ?? [],
    right = b.obstacles ?? [];
  return (
    left.length === right.length &&
    left.every((rect, i) => sameWindowRect(rect, right[i]))
  );
}

const CONTROL_EDGE = 16;
const CONTROL_GAP = 8;
const CONTROL_WIDTH = 200;
const CONTROL_MIN_TARGET = 55;
/** OrreryControls' stack: three 55 dp plates with SPACING.xs (4) between. */
const CONTROL_COUNT = 3;
const CONTROL_STACK_GAP = 4;
/** The controls stack's laid-out height (its root measures this tall). */
export const CONTROLS_STACK_HEIGHT =
  CONTROL_COUNT * CONTROL_MIN_TARGET + (CONTROL_COUNT - 1) * CONTROL_STACK_GAP;

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
/**
 * 38.7-16 (D-79): where the controls stack rests in `controlsRegion` — the
 * full column width (the measured root), bottom-anchored, as tall as the
 * stack (or the column, when shorter). Null when there is no column.
 */
export function controlsRestingRect(
  viewport: CameraViewport,
): CameraRect | null {
  const region = controlsRegion(viewport);
  if (!region) return null;
  const height = Math.min(CONTROLS_STACK_HEIGHT, region.height);
  return {
    x: region.x,
    y: region.y + region.height - height,
    width: region.width,
    height,
  };
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
