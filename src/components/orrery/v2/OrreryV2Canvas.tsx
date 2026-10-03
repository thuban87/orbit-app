/**
 * OrreryV2Canvas (38.7-06, D-43/D-49) — the Orrery's stable picture-tree
 * canvas and the SOLE owner of the ambient clock.
 *
 * ── Stable tree (D-43) ──────────────────────────────────────────────────────
 * The canvas is a small, FIXED list of `<Picture>` layers. Each picture is
 * recorded on the UI thread by a `useDerivedValue(() => createPicture(...))`
 * that reads SharedValues only (the shared `frame` — the same frame the hit
 * math, labels and focus card read, so drawn == tappable — and JS-built specs).
 * Adding or removing contacts, a focus change or any React re-render never
 * adds, removes or restructures a Skia node for the sky, stars, rings, Polaris
 * or overlays.
 *
 * Layers, bottom to top:
 * - `base`: the background fill and the world-plane orbit rings (D-44);
 * - `stars`: today's 44 seeded twinkling stars;
 * - the legacy `children` slot: the remaining body and label components, an
 *   intermediate step that Plan 07 replaces with picture layers;
 * - `overlay`: Polaris, the reorder outline and the focus outlines.
 *
 * ── Ambient clock (ORR-03 / M5 / D-49, ADR-048/ADR-077) ────────────────────
 * The Skia frame clock is created HERE and nowhere else. OrreryScreen mounts
 * this canvas (through OrreryWorld) only once it is measured AND focused and
 * foregrounded, so unmounting it on blur/background stops every ambient
 * worklet (the clock has no pause argument). The clock drives the star
 * twinkle here and — through `OrreryClockContext`, until Plan 07 — the legacy
 * sun pulse. Reduced motion (the live OS signal, read as a SharedValue) holds
 * the twinkle at its band mid-point. Plan 08 quantises the clock (D-49).
 *
 * ── Platform seam (D-46) ───────────────────────────────────────────────────
 * Platform/GPU choices come from `resolveOrreryRenderHost()` as values
 * (`opaqueCanvas`, the device pixel ratio for the AA feather), never as forks.
 */
import {
  Canvas,
  createPicture,
  Picture,
  useClock,
} from "@shopify/react-native-skia";
import { type ReactNode, useMemo } from "react";
import {
  type ComposedGesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { OrreryClockContext } from "../orrery-clock-context";
import { drawOverlay } from "./draw-overlay";
import { drawPlaneRings, ringBands } from "./draw-plane";
import { drawSky, drawStars, twinkleOpacity } from "./draw-sky";
import { resolveOrreryRenderHost } from "./render-host";
import type {
  OverlaySpec,
  RingSpecs,
  SkySpec,
  StarFieldSpec,
} from "./scene-specs";
import { orreryShader } from "./shaders";

export interface OrreryV2CanvasProps {
  /** Measured canvas size (the canvas mounts only once measured). */
  width: number;
  height: number;
  /** The composed tap-races-pan gesture. */
  gesture: ComposedGesture | GestureType;
  /** The ONE UI-thread frame every layer and the hit math consume. */
  frame: SharedValue<AnimatedFrame>;
  /** Background ink (JS-built from the theme). */
  sky: SharedValue<SkySpec>;
  /** Today's seeded starfield (JS-built for the measured size and theme). */
  stars: SharedValue<StarFieldSpec>;
  /** Per-body ring look (JS-built, rewritten on resource/theme change only). */
  ringSpecs: SharedValue<RingSpecs>;
  /** Overlay inks, Polaris extent and focus outlines (JS-built). */
  overlay: SharedValue<OverlaySpec>;
  /** The reorder hold (gesture-owned), for the held-orbit outline. */
  reorder: SharedValue<ReorderDrag | null>;
  /** Legacy body/label components (Plan 07 replaces them with pictures). */
  children?: ReactNode;
}

export function OrreryV2Canvas({
  width,
  height,
  gesture,
  frame,
  sky,
  stars,
  ringSpecs,
  overlay,
  reorder,
  children,
}: OrreryV2CanvasProps) {
  const host = useMemo(() => resolveOrreryRenderHost(), []);
  // M5/D-49: the ONE ambient clock (inside this unmountable subtree).
  const clock = useClock();
  // THEME-06: the live reduced-motion signal as a SharedValue (no setState).
  const reducedMotion = useReducedMotionShared();
  // Static, JS-thread resources: the compiled ring effect and the unit strips.
  const ringEffect = useMemo(() => orreryShader("ringPlane"), []);
  const bands = useMemo(() => ringBands(), []);
  // The AA feather: one device pixel, in dp (a primitive capture).
  const aaDp = 1 / host.devicePixelRatio();
  // A primitive: under reduced motion it never changes, so the stars picture
  // is not re-recorded on clock ticks.
  const twinkle = useDerivedValue(() =>
    twinkleOpacity(clock.value, reducedMotion.value),
  );
  const base = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawSky(canvas, sky.value);
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
  const starsPicture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawStars(canvas, stars.value, twinkle.value);
      },
      { width, height },
    ),
  );
  const overlayPicture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawOverlay(
          canvas,
          frame.value,
          overlay.value,
          reorder.value,
          ringEffect,
          bands,
          aaDp,
        );
      },
      { width, height },
    ),
  );
  return (
    <GestureDetector gesture={gesture}>
      <Canvas
        testID="orrery-canvas"
        opaque={host.opaqueCanvas}
        style={{ width, height }}
      >
        <Picture picture={base} />
        <Picture picture={starsPicture} />
        <OrreryClockContext.Provider value={clock}>
          {children}
        </OrreryClockContext.Provider>
        <Picture picture={overlayPicture} />
      </Canvas>
    </GestureDetector>
  );
}
