/**
 * Focus card placement, shared by OrreryFocusContext (draws the card) and
 * OrreryWorld3D (reserves the same rect as a label exclusion).
 *
 * Product rule: the card hangs just below the focused body, clamped to the
 * usable rect. Lab C (a measured `viewport.camera` rect is present): the card
 * DOCKS at the canvas bottom, left of the side-controls column, and the camera
 * frames the focused system in the space above it (OrreryScreen.focus) —
 * Checkpoint E orchestrator review: no card floating mid-screen over a void.
 */
import {
  type CameraViewport,
  usableCameraRect,
} from "@/logic/orrery-camera-logic";
import { SPACING } from "@/theme/tokens/spacing";

/** Right-hand controls + FAB column (≈56 px FAB + margins) the docked card clears. */
export const FOCUS_CARD_SIDE_RESERVE = 92;
/** Gap between the docked card and the canvas bottom. */
export const FOCUS_CARD_BOTTOM_GAP = 8;
export const FOCUS_CARD_MAX_WIDTH = 280;

export function focusCardPlacement(
  viewport: CameraViewport,
  body: { x: number; y: number; radius: number; systemRadius?: number },
  height: number,
): { left: number; top: number; width: number; maxHeight: number } | null {
  "worklet";
  const region = usableCameraRect(viewport);
  if (!region) return null;
  const width = Math.min(FOCUS_CARD_MAX_WIDTH, region.width);
  const maxHeight = region.height / 2;
  const limit = Math.min(height, maxHeight);
  if (viewport.camera) {
    const bottom = viewport.height - FOCUS_CARD_BOTTOM_GAP;
    return {
      width,
      maxHeight,
      left: Math.max(
        region.x,
        Math.min(
          viewport.width - FOCUS_CARD_SIDE_RESERVE - width,
          body.x - width / 2,
        ),
      ),
      top: Math.max(region.y, bottom - limit),
    };
  }
  return {
    width,
    maxHeight,
    left: Math.max(
      region.x,
      Math.min(region.x + region.width - width, body.x - width / 2),
    ),
    top: Math.max(
      region.y,
      Math.min(
        region.y + region.height - limit,
        body.y + Math.max(body.radius, body.systemRadius ?? 0) + SPACING.sm,
      ),
    ),
  };
}
