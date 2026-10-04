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
 * - `sky` (38.7-09): the painted sky — one sky-shader pass (gradient, Lab
 *   B's distant nebula over the baked densities, lobe B tinted per System at
 *   draw time, far stars through the clouds, vignette), then mid/near stars;
 *   drift and twinkle on the ambient clock, parallax from the frame
 *   (draw-sky.ts);
 * - `base`: the optional orbital-plane grid (D-09) and the thin, sun-lit
 *   world-plane orbit rings (D-11/D-44), baked while still;
 * - `pulses` (38.7-09, D-10): the subtle orbit light pulses — ring-shader
 *   arcs on the ambient clock, never baked, none under reduced motion;
 * - `bodiesBehind`: contacts and moons deeper than the sun (38.7-07);
 * - `sun`: the star sun (38.7-10, D-15), its corona and granulation moving
 *   only with the sun pulse on the ambient clock (still under reduced motion);
 * - `bodiesFront`: contacts and moons nearer than the sun;
 * - `labels`: the label backplates and Paragraphs at their allocations;
 * - `overlay`: Polaris, the reorder hold (38.7-12: Lab B's charge arc, then
 *   the glowing held orbit and a locked reticle), the focus reticle and the
 *   occlusion dim under every Orrery text surface (38.7-11).
 * 38.7-11 (D-21): the `focus` value (spec + Lab B's mix + Lab A's lock-on)
 * dims every other body, orbit and label while someone is focused; the base,
 * body, label and overlay pictures re-record only while it animates.
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
 * value drives the sky's star twinkle and drift and the sun pulse; an
 * unchanged tick writes nothing, and under reduced motion neither picture
 * re-records at all.
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
 *
 * ── First frame (38.7-09, carried from 38.7-08) ────────────────────────────
 * The opaque canvas is a SurfaceView, which shows solid black until its
 * surface exists and has presented. While `host.opaqueCanvas`, a non-touchable
 * cover in the sky's base token sits over the canvas and fades out once the
 * native surface reports a size (then two frames), so a tab return shows the
 * themed sky colour instead of a black flash. No React state: an animated
 * style reads a SharedValue.
 */
import {
  Canvas,
  type CanvasRef,
  createPicture,
  Picture,
  type SkPicture,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useRef } from "react";
import {
  type ComposedGesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { CameraRect } from "@/logic/orrery-camera-logic";
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
import {
  drawBodies,
  drawSun,
  type OrreryBodyEffects,
  orderBodies,
  sunPulse,
} from "./draw-bodies";
import { drawLabels } from "./draw-labels";
import { drawOverlay, type ReorderHoldFx } from "./draw-overlay";
import {
  drawPlaneGrid,
  drawPlanePulses,
  drawPlaneRings,
  gridDisc,
  pulseRings,
  ringBands,
} from "./draw-plane";
import { drawSky } from "./draw-sky";
import { watchFirstSurfaceFrame } from "./first-frame";
import type { FocusDraw } from "./focus-fx";
import { resolveOrreryRenderHost } from "./render-host";
import {
  ORRERY_LAYER,
  type OrreryBodySpecs,
  type OrreryLabelLayerSpecs,
  type OrreryLayerId,
  type OverlaySpec,
  type PlaneSpec,
  type RingSpecs,
  type SkyImageSpec,
  type SkySpec,
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
  /** The painted sky (JS-built from the theme, size and System). */
  sky: SharedValue<SkySpec>;
  /** The sky's baked neutral nebula (JS-baked; a `sky`-layer ledger object). */
  skyImage: SharedValue<SkyImageSpec>;
  /** The opaque canvas's first-frame cover colour (`orrerySkyBase`). */
  coverColor: string;
  /** Per-body ring look (JS-built, rewritten on resource/theme change only). */
  ringSpecs: SharedValue<RingSpecs>;
  /** The plane's grid and pulse look (JS-built on theme change only). */
  plane: SharedValue<PlaneSpec>;
  /** Overlay inks (accent, Polaris, reticle, occlusion) and the Polaris extent (JS-built). */
  overlay: SharedValue<OverlaySpec>;
  /** The reorder hold (gesture-owned), for the charge arc and held orbit. */
  reorder: SharedValue<ReorderDrag | null>;
  /** 38.7-12 (D-23): the hold's charge and slot-flash timers (gesture-owned). */
  hold: SharedValue<ReorderHoldFx>;
  /** 38.7-11: focus emphasis, world response and reticle lock-on (UI-derived). */
  focus: SharedValue<FocusDraw>;
  /** 38.7-11 (D-55): canvas rects of every Orrery text surface (UI-derived). */
  occlusion: SharedValue<readonly CameraRect[]>;
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

/** The ambient consumers on screen (D-37/D-40: twinkle, sky drift, sun pulse). */
const AMBIENT_CONSUMERS = {
  twinkle: true,
  sunPulse: true,
  skyDrift: true,
  orbitPulses: true,
} as const;
/** The first-frame cover's fade (ms). */
const COVER_FADE_MS = 160;

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
  skyImage,
  coverColor,
  ringSpecs,
  plane,
  overlay,
  reorder,
  hold,
  focus,
  occlusion,
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
  const gridEffect = useMemo(() => orreryShader("gridPlane"), []);
  // 38.7-09 rework: the sky shader (Lab B's distant nebula over the baked
  // densities); null → the plain gradient.
  const skyEffect = useMemo(() => orreryShader("skyNebula"), []);
  // 38.7-10 (D-13/D-14/D-15): the lit-body and star-sun effects (lazily
  // compiled; a null effect falls back to that body's flat look).
  const bodyEffects = useMemo<OrreryBodyEffects>(
    () => ({
      swatch: orreryShader("bodySwatch"),
      photo: orreryShader("bodyPhoto"),
      corona: orreryShader("sunCorona"),
      sunDisc: orreryShader("sunDisc"),
    }),
    [],
  );
  const bands = useMemo(() => ringBands(), []);
  const disc = useMemo(() => gridDisc(), []);
  // The AA feather: one device pixel, in dp (a primitive capture).
  const aaDp = 1 / host.devicePixelRatio();
  // 38.7-09: the painted sky (bottom). Re-recorded on an ambient tick (drift,
  // twinkle), a camera move (parallax) or a spec/image change; under reduced
  // motion the ambient value holds at −1, so it is still at idle.
  const skyPicture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawSky(
          canvas,
          sky.value,
          skyImage.value,
          frame.value.pose,
          ambient.value,
          skyEffect,
        );
      },
      { width, height },
    ),
  );
  useLayerAck(ORRERY_LAYER.sky, skyPicture, skyImage, ackRecorded);
  // The LIVE base: re-recorded only when the frame or ring specs change.
  const baseLive = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawPlaneGrid(
          canvas,
          frame.value,
          plane.value.grid,
          gridEffect,
          disc,
          aaDp,
        );
        drawPlaneRings(
          canvas,
          frame.value,
          ringSpecs.value,
          ringEffect,
          bands,
          aaDp,
          focus.value,
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
  // D-10/D-37: the orbit pulses' clock — the ambient value, or −1 (constant:
  // no re-recording at all) when the budget or intensity is zero.
  const pulseClock = useDerivedValue(() =>
    plane.value.pulse.budget > 0 && plane.value.pulse.intensity > 0
      ? ambient.value
      : -1,
  );
  // The rings a pulse may travel: read from the frame and ring specs ONLY,
  // so this scan (a key string per body) re-runs when either changes and an
  // ambient tick reuses it (38.7-09, cheaper pulses at budget 40).
  const pulseEligible = useDerivedValue(() =>
    pulseRings(frame.value, ringSpecs.value),
  );
  const pulsesPicture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawPlanePulses(
          canvas,
          pulseEligible.value,
          plane.value.pulse,
          pulseClock.value,
          ringEffect,
          bands,
          aaDp,
          focus.value,
        );
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
          bodyEffects,
          focus.value,
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
          bodyEffects,
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
          bodyEffects,
          focus.value,
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
        drawLabels(canvas, labels.value, allocationIndex.value, focus.value);
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
          hold.value,
          ringEffect,
          bands,
          aaDp,
          focus.value,
          occlusion.value,
        );
      },
      { width, height },
    ),
  );
  // First-frame cover (opaque canvas only; see the header). It lifts only
  // when BOTH the native surface exists (JS poll) AND the first UI mapper
  // pass has recorded the layers (a reaction on the last, non-ambient
  // pictures), then two frames later: a surface can exist seconds before the
  // first content frame on a heavy System (DEBUG All Contacts, 38.7-09).
  const canvasRef = useRef<CanvasRef | null>(null);
  const cover = useSharedValue(host.opaqueCanvas ? 1 : 0);
  const surfaceReady = useSharedValue(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per canvas mount (the cover belongs to this native view)
  useEffect(() => {
    if (!host.opaqueCanvas) return;
    return watchFirstSurfaceFrame(
      () => canvasRef.current?.getNativeId?.() ?? null,
      () => {
        surfaceReady.value = true;
      },
    );
  }, []);
  useAnimatedReaction(
    () =>
      surfaceReady.value &&
      labelsPicture.value !== null &&
      overlayPicture.value !== null,
    (ready, previous) => {
      if (!ready || previous === true || cover.value === 0) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cover.value = 0;
        });
      });
    },
  );
  const coverStyle = useAnimatedStyle(() => ({
    opacity: withTiming(cover.value, { duration: COVER_FADE_MS }),
  }));
  return (
    <>
      {driver}
      <GestureDetector gesture={gesture}>
        <Canvas
          testID="orrery-canvas"
          ref={canvasRef}
          opaque={host.opaqueCanvas}
          style={{ width, height }}
        >
          <Picture picture={skyPicture} />
          <Picture picture={base} />
          <Picture picture={pulsesPicture} />
          <Picture picture={bodiesBehind} />
          <Picture picture={sunPicture} />
          <Picture picture={bodiesFront} />
          <Picture picture={labelsPicture} />
          <Picture picture={overlayPicture} />
        </Canvas>
      </GestureDetector>
      {host.opaqueCanvas ? (
        <Animated.View
          testID="orrery-canvas-cover"
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              width,
              height,
              backgroundColor: coverColor,
            },
            coverStyle,
          ]}
        />
      ) : null}
    </>
  );
}
