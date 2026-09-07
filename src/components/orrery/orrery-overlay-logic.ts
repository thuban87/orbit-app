import type { ContactIdentity } from "@/db/orrery-system-read";
import {
  type CameraViewport,
  usableCameraRect,
} from "@/logic/orrery-camera-logic";
import {
  type OrreryContactTarget,
  orderContactTargets,
  reconcileFocus,
} from "@/logic/orrery-focus-logic";
export function clusterRows(
  targets: readonly OrreryContactTarget[],
  members: readonly ContactIdentity[],
  sun: ContactIdentity | null,
) {
  return orderContactTargets(
    targets.filter((target) => reconcileFocus(target, members, sun)),
    members,
  );
}
export function clusterCount(count: number) {
  return count === 1 ? "1 contact" : `${count} contacts`;
}
export function clusterRegion(viewport: CameraViewport) {
  const region = usableCameraRect(viewport);
  if (!region || region.width < 44 || region.height < 88) return null;
  const height = Math.min(region.height / 2, viewport.height * 0.4);
  return {
    x: region.x,
    y: region.y + region.height - height,
    width: region.width,
    height,
  };
}
/** Used by both conventional surfaces: dismissal occurs synchronously before dispatch. */
export function closeBeforeAction(close: () => void, action: () => void) {
  close();
  action();
}
