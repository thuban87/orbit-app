/**
 * ORRERY LAB C — the true-3D perspective camera.
 *
 * Since the Lab C camera redo the pose's focal distance is a real DOLLY
 * distance F/zoom with a fixed focal length F = LAB_FOCAL_PX (≈50° vertical
 * FOV), and the default tilt looks down ~62°, so the system recedes into
 * depth. The pinhole formula below is still shared with the UI-thread
 * projection, which is what keeps drawn == tappable (not old-view parity).
 *
 * Source of truth stays `projectWorldPoint` in `src/logic/orrery-camera-logic.ts`:
 *   plane  = rotate(p − pivot, yaw)
 *   screen = centre + F · (plane.x, plane.y·cos t) / (f − plane.y·sin t),  F = zoom·f
 * with `centre` = centre of `usableCameraRect(viewport)` (off-axis).
 *
 * World mapping into three.js space (Y up):
 *   orrery (x, y)  →  three (X = x, Y = height, Z = y)     (+y / +Z is south)
 * A camera at distance `f` from the pivot, rotated by yaw and pitched by tilt,
 * with vertical focal length F px and principal point at `centre`, gives the
 * same pixel for every point on the orbital plane (Y = 0). Points off the plane
 * (sphere volume, stars) follow the same perspective naturally.
 *
 * Pure numbers only (no three import) so it is shared by the renderer and the
 * vitest parity check (`orrery-camera-rig.test.ts`).
 */
import {
  type CameraPose,
  type CameraViewport,
  usableCameraRect,
} from "@/logic/orrery-camera-logic";

/** Fallback when a pose carries no focal distance (orrery-camera-logic MIN). */
const MIN_FOCAL = 256;
/** Near plane as a fraction of the focal distance (bodies never get closer). */
export const NEAR_FRACTION = 0.05;
/** Far plane in multiples of the focal distance (keeps the skydome inside). */
export const FAR_MULTIPLE = 40;

export interface OrreryCameraRig {
  /** Column-major camera WORLD matrix (inverse view), three `Matrix4.fromArray`. */
  world: number[];
  /** Camera position in three space. */
  position: [number, number, number];
  /** Vertical FOV in degrees for a full view of `fullHeight`. */
  fovDeg: number;
  aspect: number;
  near: number;
  far: number;
  /** `PerspectiveCamera.setViewOffset` arguments (principal-point shift). */
  viewOffset: [number, number, number, number, number, number];
  /** Focal length in logical px (zoom · f). */
  focalPx: number;
}

export function orreryCameraRig(
  pose: CameraPose,
  viewport: CameraViewport,
): OrreryCameraRig {
  const f = pose.focalDistance ?? MIN_FOCAL;
  const tilt = pose.tilt ?? 0;
  const yaw = pose.yaw ?? 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const C = Math.cos(tilt);
  const S = Math.sin(tilt);
  // Rows of the world→camera rotation R, acting on (dx, h, dz).
  //   x_cam =  c·dx           − s·dz
  //   y_cam = −C·s·dx + S·h − C·c·dz
  //   z_cam =  S·s·dx + C·h + S·c·dz − f
  const rx = [c, 0, -s];
  const ry = [-C * s, S, -C * c];
  const rz = [S * s, C, S * c];
  const position: [number, number, number] = [
    pose.x + f * rz[0],
    f * rz[1],
    pose.y + f * rz[2],
  ];
  const W = viewport.width;
  const H = viewport.height;
  const rect = usableCameraRect(viewport) ?? {
    x: 0,
    y: 0,
    width: W,
    height: H,
  };
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const focalPx = pose.zoom * f;
  return {
    // Columns of R^T are the rows of R; translation = camera position.
    world: [
      rx[0],
      rx[1],
      rx[2],
      0,
      ry[0],
      ry[1],
      ry[2],
      0,
      rz[0],
      rz[1],
      rz[2],
      0,
      position[0],
      position[1],
      position[2],
      1,
    ],
    position,
    fovDeg: (2 * Math.atan(H / 2 / focalPx) * 180) / Math.PI,
    aspect: W / H,
    near: f * NEAR_FRACTION,
    far: f * FAR_MULTIPLE,
    viewOffset: [W, H, W / 2 - cx, H / 2 - cy, W, H],
    focalPx,
  };
}
