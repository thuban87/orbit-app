/**
 * `@/components/ui` barrel — the shared UI primitives (THEME-07/THEME-10).
 * Logic-free re-exports so consuming phases import primitives from one seam.
 */
export { AppText, type AppTextProps } from "./AppText";
export {
  Button,
  type ButtonProps,
  type ButtonRole,
  buttonVisual,
  MIN_TOUCH_TARGET,
} from "./Button";
export {
  ConfirmDialog,
  type ConfirmDialogProps,
} from "./ConfirmDialog";
export { GlassSurface, type GlassSurfaceProps } from "./GlassSurface";
export { Modal, type ModalProps } from "./Modal";
export {
  type OverlayLifecycle,
  SCRIM_OPACITY,
} from "./overlay-base";
export { Sheet, type SheetProps, type SheetVariant } from "./Sheet";
