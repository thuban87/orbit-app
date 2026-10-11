/**
 * `@/components/ui` barrel — the shared UI primitives (THEME-07/THEME-10).
 * Logic-free re-exports so consuming phases import primitives from one seam.
 */
export {
  AccordionSection,
  type AccordionSectionProps,
} from "./AccordionSection";
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
export { FieldError, type FieldErrorProps } from "./FieldError";
export { GlassSurface, type GlassSurfaceProps } from "./GlassSurface";
export { OrbitSwitch, type OrbitSwitchProps } from "./OrbitSwitch";
export {
  type OverlayLifecycle,
  SCRIM_OPACITY,
} from "./overlay-base";
export { Sheet, type SheetProps, type SheetVariant } from "./Sheet";
