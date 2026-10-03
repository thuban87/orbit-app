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
 * - `bodiesBehind`: contacts and moons deeper than the sun (38.7-07);
 * - `sun`: the sun, its glow pulsing on the ambient clock;
 * - `bodiesFront`: contacts and moons nearer than the sun;
 * - `labels`: the label backplates and Paragraphs at their allocations;
 * - `overlay`: Polaris, the reorder outline and the focus outlines.
 * The node count is identical for a 3-body and a 1,000-body System.
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
 * The ONE ambient value (`useOrreryAmbient`, ambient-clock.ts) is owned HERE:
 * quantised milliseconds at AMBIENT_HZ, or −1 under reduced motion. Its
 * driver (Skia's frame clock or a JS interval, per `host.ambientDriver`) is a
 * child of this canvas. OrreryScreen mounts this canvas (through OrreryWorld)
 * only once it is measured AND focused and foregrounded, so unmounting it on
 * blur/background stops the driver and every ambient worklet. The ambient
 * value drives the star twinkle and the sun pulse; an unchanged tick writes
 * nothing, and under reduced motion neither picture re-records at all.
 *
 * ── Base bake (D-49, 38.7-08) ───────────────────────────────────────────────
 * When `host.bakePath === "gpu-offscreen"`, once the live base picture has
 * not changed for BAKE_AFTER_STILL_TICKS ambient ticks (and no switch,
 * gesture or camera motion is running) it is baked into a device-pixel
 * texture and the base layer blits it; any change falls back to the live
 * picture at once. Snapshots are `base`-layer objects in the H3 ledger
 * (base-bake.ts); the base picture acks like every other layer.
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
} from "@shopify/react-native-skia";
import { useMemo } from "react";
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
import type { LabelAllocation } from "@/logic/orrery-label-logic";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { ambientNeeded, useOrreryAmbient } from "./ambient-clock";
import {
  type BakedBase,
  type BakeRegistry,
  type BakeState,
  bakeBaseSnapshot,
  bakeUnavailable,
  INITIAL_BAKE_STATE,
  LIVE_BASE,
  nextBakeState,
  selectBasePicture,
} from "./base-bake";
import { drawBodies, drawSun, orderBodies, sunPulse } from "./draw-bodies";
import { drawLabels } from "./draw-labels";
import { drawOverlay } from "./draw-overlay";
import { drawPlaneRings, ringBands } from "./draw-plane";
import { drawSky, drawStars, twinkleOpacity } from "./draw-sky";
import { resolveOrreryRenderHost } from "./render-host";
import {
  ORRERY_LAYER,
  type OrreryBodySpecs,
  type OrreryLabelLayerSpecs,
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
  /** Label and caption Paragraphs with their backplate ink (JS-built). */
  labels: SharedValue<OrreryLabelLayerSpecs>;
  /** Label id → its allocation this frame (UI-derived from `frame`). */
  allocationIndex: SharedValue<Readonly<Record<string, LabelAllocation>>>;
  /** A switch, gesture or camera motion is running (never bake then). */
  busy: SharedValue<boolean>;
  /** The UI-thread snapshot registry (owned by the world; torn down there). */
  bakeRegistry: SharedValue<BakeRegistry>;
  /**
   * H3: the base layer's spec became `generation` of `mountEpoch`, drawing
   * snapshot `id` (null = live). Must be a stable function.
   */
  onBaseBaked: (
    mountEpoch: number,
    generation: number,
    id: number | null,
  ) => void;
}

/** The ambient consumers on screen today (D-40: twinkle and the sun pulse). */
const AMBIENT_CONSUMERS = { twinkle: true, sunPulse: true } as const;

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
 *
 * `requireNewRecording` (default true): only a NEW picture speaks for a
 * generation. The base layer passes false: its picture value SELECTS the live
 * picture or a snapshot by reading its spec (it records nothing itself), so
 * every run that read generation g shows exactly what g says, even when the
 * selected picture object is unchanged.
 */
function useLayerAck<S extends { generation: number; mountEpoch: number }>(
  layerId: OrreryLayerId,
  picture: SharedValue<SkPicture>,
  specs: SharedValue<S>,
  ackRecorded: OrreryV2CanvasProps["ackRecorded"],
  requireNewRecording = true,
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
      if (requireNewRecording && previous && now.picture === previous.picture)
        return;
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
  labels,
  allocationIndex,
  busy,
  bakeRegistry,
  onBaseBaked,
}: OrreryV2CanvasProps) {
  const host = useMemo(() => resolveOrreryRenderHost(), []);
  // THEME-06: the live reduced-motion signal as a SharedValue (no setState).
  const reducedMotion = useReducedMotionShared();
  // M5/D-49: the ONE quantised ambient value (−1 under reduced motion) and
  // its driver, inside this unmountable subtree.
  const { ambient, driver } = useOrreryAmbient(
    host,
    reducedMotion,
    ambientNeeded(false, AMBIENT_CONSUMERS),
  );
  // Static, JS-thread resources: the compiled ring effect and the unit strips.
  const ringEffect = useMemo(() => orreryShader("ringPlane"), []);
  const bands = useMemo(() => ringBands(), []);
  // The AA feather: one device pixel, in dp (a primitive capture).
  const aaDp = 1 / host.devicePixelRatio();
  // A primitive that changes only on an ambient tick; constant under reduced
  // motion (ambient −1), so the stars picture is not re-recorded then.
  const twinkle = useDerivedValue(() =>
    twinkleOpacity(ambient.value, ambient.value < 0),
  );
  // The LIVE base: re-recorded only when the frame, sky or ring specs change.
  const baseLive = useDerivedValue(() =>
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
  // D-49 base bake (see the header). Primitives only are captured.
  const bakeOn = host.bakePath === "gpu-offscreen";
  const dpr = host.devicePixelRatio();
  const bakeState = useSharedValue<BakeState>(INITIAL_BAKE_STATE);
  const baked = useSharedValue<BakedBase>(LIVE_BASE);
  useAnimatedReaction(
    () => ({
      live: baseLive.value,
      tick: ambient.value,
      busy: busy.value,
      mountEpoch: bodies.value.mountEpoch,
    }),
    (now, previous) => {
      if (!bakeOn) return;
      const step = nextBakeState(bakeState.value, {
        tick: now.tick,
        sceneChanged: previous !== null && now.live !== previous.live,
        busy: now.busy,
        mountEpoch: now.mountEpoch,
      });
      bakeState.value = step.state;
      if (step.action === "bake") {
        const shot = bakeBaseSnapshot(
          bakeRegistry,
          now.live,
          width,
          height,
          dpr,
        );
        if (!shot) {
          bakeState.value = bakeUnavailable(step.state);
          return;
        }
        const generation = baked.value.generation + 1;
        baked.value = {
          generation,
          mountEpoch: now.mountEpoch,
          picture: shot.picture,
          source: now.live,
          id: shot.id,
        };
        runOnJS(onBaseBaked)(now.mountEpoch, generation, shot.id);
      } else if (step.action === "invalidate") {
        const generation = baked.value.generation + 1;
        baked.value = {
          generation,
          mountEpoch: now.mountEpoch,
          picture: null,
          source: null,
          id: null,
        };
        runOnJS(onBaseBaked)(now.mountEpoch, generation, null);
      }
    },
  );
  // The base layer: the snapshot while it matches the live picture, else live.
  const base = useDerivedValue(() =>
    selectBasePicture(baked.value, baseLive.value),
  );
  useLayerAck(ORRERY_LAYER.base, base, baked, ackRecorded, false);
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
  // A primitive: changes only on an ambient tick; still (0) under reduced
  // motion, so the sun picture does not re-record then.
  const pulse = useDerivedValue(() =>
    sunPulse(ambient.value, ambient.value < 0),
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
  const labelsPicture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawLabels(canvas, labels.value, allocationIndex.value);
      },
      { width, height },
    ),
  );
  useLayerAck(ORRERY_LAYER.labels, labelsPicture, labels, ackRecorded);
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
    <>
      {driver}
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
          <Picture picture={labelsPicture} />
          <Picture picture={overlayPicture} />
        </Canvas>
      </GestureDetector>
    </>
  );
}
