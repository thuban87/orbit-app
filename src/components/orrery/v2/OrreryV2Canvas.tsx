/**
 * OrreryV2Canvas (38.7-06, D-43) — the Orrery's stable picture-tree canvas.
 *
 * The canvas is a small, FIXED list of `<Picture>` layers. Each picture is
 * recorded on the UI thread by a `useDerivedValue(() => createPicture(...))`
 * that reads SharedValues only (the shared `frame` — the same frame the hit
 * math, labels and focus card read, so drawn == tappable — and JS-built specs).
 * Adding or removing contacts, a focus change or any React re-render never
 * adds, removes or restructures a Skia node for rings, Polaris or overlays.
 *
 * Layers (this plan): `base` — the world-plane orbit rings (D-44). Plan 07
 * replaces the `children` slot (the remaining legacy body and label
 * components, an intermediate step) with picture layers.
 */
import { createPicture, Picture } from "@shopify/react-native-skia";
import { type ReactNode, useMemo } from "react";
import type {
  ComposedGesture,
  GestureType,
} from "react-native-gesture-handler";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { OrreryCanvas } from "../OrreryCanvas";
import { drawPlaneRings, ringBands } from "./draw-plane";
import { resolveOrreryRenderHost } from "./render-host";
import type { RingSpecs } from "./scene-specs";
import { orreryShader } from "./shaders";

export interface OrreryV2CanvasProps {
  /** Measured canvas size (the canvas mounts only once measured). */
  width: number;
  height: number;
  /** Deep-space background colour (`colors.background`). */
  background: string;
  /** Star tones (`textSecondary`/`textPrimary`/`starPalette`), passed as tokens. */
  starColors: string[];
  /** The composed tap-races-pan gesture. */
  gesture: ComposedGesture | GestureType;
  /** The ONE UI-thread frame every layer and the hit math consume. */
  frame: SharedValue<AnimatedFrame>;
  /** Per-body ring look (JS-built, rewritten on resource/theme change only). */
  ringSpecs: SharedValue<RingSpecs>;
  /** Legacy body/label components (Plan 07 replaces them with pictures). */
  children?: ReactNode;
}

export function OrreryV2Canvas({
  width,
  height,
  background,
  starColors,
  gesture,
  frame,
  ringSpecs,
  children,
}: OrreryV2CanvasProps) {
  const host = useMemo(() => resolveOrreryRenderHost(), []);
  // Static, JS-thread resources: the compiled ring effect and the unit strips.
  const ringEffect = useMemo(() => orreryShader("ringPlane"), []);
  const bands = useMemo(() => ringBands(), []);
  // The AA feather: one device pixel, in dp (a primitive capture).
  const aaDp = 1 / host.devicePixelRatio();
  const base = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawPlaneRings(
          canvas,
          frame.value,
          ringSpecs.value,
          ringEffect,
          bands,
          aaDp,
        );
      },
      { width, height },
    ),
  );
  return (
    <OrreryCanvas
      width={width}
      height={height}
      background={background}
      starColors={starColors}
      gesture={gesture}
    >
      <Picture picture={base} />
      {children}
    </OrreryCanvas>
  );
}
