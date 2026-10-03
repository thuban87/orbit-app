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
 * - `bodiesBehind`: contacts (and moons) deeper than the sun (38.7-07);
 * - `sun`: the sun, its glow pulsing on the ambient clock;
 * - `bodiesFront`: contacts (and moons) nearer than the sun;
 * - the legacy `children` slot: the remaining label and moon components
 *   (38.7-07 Task 2 replaces them with picture layers);
 * - `overlay`: Polaris, the reorder outline and the focus outlines.
 *
 * ── Resource lifetime (H3, the 38.7-07 ledger contract) ─────────────────────
 * Every layer that draws native objects (photo SkImages, Paragraphs) acks the
 * spec generation it recorded, separately: a reaction chained on the layer's
 * own picture value (so it runs only after that picture's `createPicture`
 * returned) arms a ONE-SHOT UI frame callback, and only that callback calls
 * `ackRecorded(layerId, generation, mountEpoch)` on JS — one further frame,
 * because the native `<Picture>` swap may lag the mapper. The JS ledger
 * disposes an object only after every layer that recorded it acked a newer
 * generation. There is no shared "recorded generation".
 *
 * ── Ambient clock (ORR-03 / M5 / D-49, ADR-048/ADR-077) ────────────────────
 * The Skia frame clock is created HERE and nowhere else. OrreryScreen mounts
 * this canvas (through OrreryWorld) only once it is measured AND focused and
 * foregrounded, so unmounting it on blur/background stops every ambient
 * worklet (the clock has no pause argument). The clock drives the star
 * twinkle and the sun pulse, both picture inputs here. Reduced motion (the
 * live OS signal, read as a SharedValue) holds the twinkle at its band
 * mid-point and the sun glow still, so neither picture re-records on clock
 * ticks. Plan 08 quantises the clock (D-49).
 *
 * ── Platform seam (D-46) ───────────────────────────────────────────────────
 * Platform/GPU choices come from `resolveOrreryRenderHost()` as values
 * (`opaqueCanvas`, the device pixel ratio for the AA feather), never as forks.
 */
import {
  Canvas,
  createPicture,
  Picture,
  type SkPicture,
  useClock,
} from "@shopify/react-native-skia";
import { type ReactNode, useMemo } from "react";
import {
  type ComposedGesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { OrreryClockContext } from "../orrery-clock-context";
import { drawBodies, drawSun, orderBodies, sunPulse } from "./draw-bodies";
import { drawOverlay } from "./draw-overlay";
import { drawPlaneRings, ringBands } from "./draw-plane";
import { drawSky, drawStars, twinkleOpacity } from "./draw-sky";
import { resolveOrreryRenderHost } from "./render-host";
import {
  ORRERY_LAYER,
  type OrreryBodySpecs,
  type OrreryLayerId,
  type OverlaySpec,
  type RingSpecs,
  type SkySpec,
  type StarFieldSpec,
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
  /** Contacts, the sun and moons (JS-built; photos and initials included). */
  bodies: SharedValue<OrreryBodySpecs>;
  /**
   * H3: `layerId` recorded `generation` of `mountEpoch` one UI frame ago.
   * Must be a stable function (it is a reaction input).
   */
  ackRecorded: (
    layerId: OrreryLayerId,
    generation: number,
    mountEpoch: number,
  ) => void;
  /** Legacy label/moon components (38.7-07 Task 2 replaces them with pictures). */
  children?: ReactNode;
}

/** What a layer's ack reaction compares: its picture and the generation it read. */
interface LayerRecord {
  picture: SkPicture;
  generation: number;
  epoch: number;
}

/**
 * H3 rule 1: one layer's acknowledgement. The reaction is chained on the
 * layer's picture value, so it runs only after `createPicture` returned; a
 * new (generation, epoch) arms ONE frame callback (never a running loop), and
 * that callback forwards the latest recorded generation to JS.
 */
function useLayerAck<S extends { generation: number; mountEpoch: number }>(
  layerId: OrreryLayerId,
  picture: SharedValue<SkPicture>,
  specs: SharedValue<S>,
  ackRecorded: OrreryV2CanvasProps["ackRecorded"],
): void {
  const pending = useSharedValue(false);
  const latest = useSharedValue({ generation: 0, epoch: 0 });
  useAnimatedReaction(
    (): LayerRecord => ({
      picture: picture.value,
      generation: specs.value.generation,
      epoch: specs.value.mountEpoch,
    }),
    (now, previous) => {
      // Only a NEW recording speaks for a generation.
      if (previous && now.picture === previous.picture) return;
      if (now.generation === 0) return;
      if (
        previous &&
        previous.generation === now.generation &&
        previous.epoch === now.epoch
      )
        return;
      latest.value = { generation: now.generation, epoch: now.epoch };
      if (pending.value) return;
      pending.value = true;
      requestAnimationFrame(() => {
        pending.value = false;
        const recorded = latest.value;
        runOnJS(ackRecorded)(layerId, recorded.generation, recorded.epoch);
      });
    },
  );
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
  bodies,
  ackRecorded,
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
  // D-43/M14: one depth order per frame, shared by both body layers.
  const bodyOrder = useDerivedValue(() =>
    orderBodies(frame.value, bodies.value.bodies),
  );
  // A primitive: still (0) under reduced motion, so the sun picture does not
  // re-record on clock ticks.
  const pulse = useDerivedValue(() =>
    sunPulse(clock.value, reducedMotion.value),
  );
  const bodiesBehind = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawBodies(
          canvas,
          frame.value,
          bodies.value.bodies,
          bodyOrder.value,
          "behind",
        );
      },
      { width, height },
    ),
  );
  const sunPicture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawSun(
          canvas,
          frame.value,
          bodies.value.bodies,
          bodyOrder.value,
          pulse.value,
        );
      },
      { width, height },
    ),
  );
  const bodiesFront = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawBodies(
          canvas,
          frame.value,
          bodies.value.bodies,
          bodyOrder.value,
          "front",
        );
      },
      { width, height },
    ),
  );
  useLayerAck(ORRERY_LAYER.bodiesBehind, bodiesBehind, bodies, ackRecorded);
  useLayerAck(ORRERY_LAYER.sun, sunPicture, bodies, ackRecorded);
  useLayerAck(ORRERY_LAYER.bodiesFront, bodiesFront, bodies, ackRecorded);
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
        <Picture picture={bodiesBehind} />
        <Picture picture={sunPicture} />
        <Picture picture={bodiesFront} />
        <OrreryClockContext.Provider value={clock}>
          {children}
        </OrreryClockContext.Provider>
        <Picture picture={overlayPicture} />
      </Canvas>
    </GestureDetector>
  );
}
