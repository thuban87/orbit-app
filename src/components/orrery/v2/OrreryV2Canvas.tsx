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
 * - `switch` (38.7-13, D-24): Lab A's orbit streaks behind the moving
 *   contacts during a System switch (draw-switch.ts) — one shared empty
 *   picture at rest and under reduced motion. Lab B's star warp is drawn by
 *   the sky picture from the same switch signal. Neither creates a native
 *   object (no streak texture), so this layer has nothing to ack (H3);
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
 * ── Frame-rate vote (38.7-15, D-65 FR-B) ────────────────────────────────────
 * On the opaque canvas (Android SurfaceView) the canvas votes AMBIENT_HZ
 * (`Surface.setFrameRate`, API 30+, patched into Skia 2.6.2) while only the
 * ambient clock animates it, and withdraws the vote (0) under reduced motion
 * and while a switch, gesture or camera motion runs (`ambientFrameRateVote`).
 * A UI reaction sends the vote only on change, through the Canvas ref's
 * imperative `setFrameRateVote` (a native prop update) — never React state,
 * so no render commits mid-switch (D-53). The native view re-applies it on
 * every surface (re)creation; a remount (tab return, foreground) votes again.
 *
 * ── Platform seam (D-46) ───────────────────────────────────────────────────
 * Platform/GPU choices come from `resolveOrreryRenderHost()` as values
 * (`opaqueCanvas`, the device pixel ratio for the AA feather), never as forks.
 *
 * ── First frame (38.7-09, carried from 38.7-08; 38.7-15) ───────────────────
 * The opaque canvas is a SurfaceView, which shows solid black until its
 * surface exists and has presented. While `host.opaqueCanvas`, a non-touchable
 * cover in the sky's base token sits over the canvas and fades out once the
 * native surface reports a size (then two frames), so a tab return shows the
 * themed sky colour instead of a black flash. No React state: an animated
 * style reads a SharedValue.
 * 38.7-15 (Galaxy Light black canvas, All Contacts black gap): the first
 * frame the SurfaceView presents must be the theme's sky, and it must present
 * fast. The heavy first frame (every runtime effect compiling on first use,
 * a large System) used to post its first buffer long after the cover lifted,
 * so the SurfaceView's black background showed (DEBUG: ~1–2.5 s in Galaxy
 * Light, ~3.8 s at All Contacts). Now the canvas starts in a FIRST-FRAME
 * state: the sky layer draws its plain gradient and stars (no runtime effect)
 * and every other layer the shared empty picture, so the first buffer posts
 * at once; two frames after the surface exists the full scene records, while
 * the sky-only buffer stays on screen through any shader compile, and only
 * then does the cover fade. Light themes never flash black.
 * 38.7-15 (cold open ~0.42 s / All Contacts warm return ~1.8 s near-black
 * after the cover lifted): the cover no longer lifts on proxies (surface
 * size, first-frame end, two frames). Once the content is RECORDED (first-
 * frame state over, the body specs published), the canvas arms the native
 * "presented" probe (patched Skia: `armPresentProbe` / `onAndroidPresented`)
 * and the cover lifts on its answer — the frame drawn, its GPU work done and
 * (round 3) composited on the display, not just queued — or at the bounded
 * fallbacks of `cover-gate.ts` (never sticks).
 */
import {
  Canvas,
  type CanvasRef,
  createPicture,
  Picture,
  type SkPicture,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type ComposedGesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  runOnUI,
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
import type { SwitchFxSignal } from "@/logic/orrery-switch-fx-logic";
import {
  useReducedMotion,
  useReducedMotionShared,
} from "@/theme/use-reduced-motion";
import {
  ambientFrameRateVote,
  ambientNeeded,
  useOrreryAmbient,
} from "./ambient-clock";
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
  type CoverGate,
  type CoverLiftReason,
  createCoverGate,
  nextPresentToken,
} from "./cover-gate";
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
  type BasePlaneKey,
  basePlaneKey,
  drawPlaneGrid,
  drawPlanePulses,
  drawPlaneRings,
  gridDisc,
  pulseRings,
  ringBands,
  sameBasePlaneKey,
} from "./draw-plane";
import { drawSky } from "./draw-sky";
import {
  drawOrbitTrails,
  type SwitchTrailRoles,
  type TrailLook,
} from "./draw-switch";
import { watchFirstSurfaceFrame } from "./first-frame";
import type { FocusDraw } from "./focus-fx";
import { useLayerAck } from "./layer-ack";
import { resolveOrreryRenderHost } from "./render-host";
import {
  type GridSpec,
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
import { ORRERY_OCCLUSION_STYLE } from "./visual-tunables";

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
  /**
   * 38.7-13 (D-24): the switch signal of the transition being drawn
   * (UI-derived from transition/progress only) — the sky's warp and tint
   * crossfade, the orbit streaks.
   */
  switchFx: SharedValue<SwitchFxSignal>;
  /** 38.7-13: per-transition streak roles (UI-derived once per transition). */
  switchRoles: SharedValue<SwitchTrailRoles>;
  /** 38.7-13: the streaks' theme-mode look (JS-built on theme change only). */
  trailLook: TrailLook;
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

/** 38.7-15 (DEBUG): the first-frame/cover timeline marks (orrery-perf-marks). */
interface OrreryPerfMarks {
  mark(name: string): void;
}
// DEBUG only: Metro folds this to null in a release bundle.
const perf: OrreryPerfMarks | null =
  typeof __DEV__ !== "undefined" && __DEV__
    ? require("@/__dev__/orrery-perf-marks")
    : null;
/** A stable JS target for the UI thread's DEBUG marks (a no-op in release). */
function markPerf(name: string): void {
  perf?.mark(name);
}

/** The ambient consumers on screen (D-37/D-40: twinkle, sky drift, sun pulse). */
const AMBIENT_CONSUMERS = {
  twinkle: true,
  sunPulse: true,
  skyDrift: true,
  orbitPulses: true,
} as const;
/** 38.7-15: the first frame's sky has no baked nebula (no runtime effect). */
const FIRST_FRAME_SKY_IMAGE: SkyImageSpec = Object.freeze({
  generation: 0,
  mountEpoch: 0,
  image: null,
  key: "",
});
/**
 * 38.7-15: the live base's last recording and what it was recorded from
 * (UI runtime only; created there, mutated in place, never re-assigned by the
 * base mapper, so it is no input change for that mapper).
 */
interface BaseMemo {
  key: BasePlaneKey | null;
  picture: SkPicture | null;
  rings: RingSpecs | null;
  grid: GridSpec | null;
  focus: FocusDraw | null;
  width: number;
  height: number;
}
/** The first-frame cover's fade (ms). */
const COVER_FADE_MS = 160;
/** The overlay's occlusion fill under the "lab-b" style: none. */
const NO_OCCLUSION_FILL: readonly CameraRect[] = Object.freeze([]);

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
  switchFx,
  switchRoles,
  trailLook,
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
  // WR-01: its state twin decides whether a driver is mounted at all — under
  // reduced motion none runs (no per-vsync frame callback), and the value
  // holds at AMBIENT_STILL. Never read for drawing (that is the SharedValue).
  const reducedMotionJs = useReducedMotion();
  // M5/D-49: the ONE quantised ambient value (−1 under reduced motion) and
  // its driver, inside this unmountable subtree.
  const { ambient, driver } = useOrreryAmbient(
    host,
    reducedMotion,
    ambientNeeded(reducedMotionJs, AMBIENT_CONSUMERS),
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
  // 38.7-15: the first-frame state (opaque canvas only) — see the header.
  const firstFrame = useSharedValue(host.opaqueCanvas);
  // One shared empty picture (first frame; the switch layer at rest).
  const emptyPicture = useMemo(
    () => createPicture(() => {}, { width: 1, height: 1 }),
    [],
  );
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
          // First frame: the plain gradient (no runtime effect to compile).
          firstFrame.value ? FIRST_FRAME_SKY_IMAGE : skyImage.value,
          frame.value.pose,
          ambient.value,
          skyEffect,
          switchFx.value,
        );
      },
      { width, height },
    ),
  );
  useLayerAck(ORRERY_LAYER.sky, skyPicture, skyImage, ackRecorded);
  // The LIVE base: re-recorded only when what it draws changed — the ring
  // specs, the grid, the focus dim, the canvas size or the frame's
  // BasePlaneKey (homography, zoom, each contact's opacity and orbit). 38.7-15
  // (All Contacts lead-in): a world spinning under a still camera moves no
  // ring, so its ~1,000-ring picture is reused instead of re-recorded (~7,000
  // Skia calls) every frame. The memo lives on the UI runtime (created there
  // after mount); the first run (JS) and tests without it record as before.
  const baseMemo = useSharedValue<BaseMemo | null>(null);
  useEffect(() => {
    runOnUI(() => {
      "worklet";
      baseMemo.value = {
        key: null,
        picture: null,
        rings: null,
        grid: null,
        focus: null,
        width: 0,
        height: 0,
      };
    })();
  }, [baseMemo]);
  const baseLive = useDerivedValue(() => {
    if (firstFrame.value) return emptyPicture;
    const current = frame.value;
    const rings = ringSpecs.value;
    const grid = plane.value.grid;
    const dim = focus.value;
    const memo = baseMemo.value;
    if (
      memo !== null &&
      memo.picture !== null &&
      memo.key !== null &&
      memo.rings === rings &&
      memo.grid === grid &&
      memo.focus === dim &&
      memo.width === width &&
      memo.height === height &&
      sameBasePlaneKey(memo.key, current)
    )
      return memo.picture;
    const picture = createPicture(
      (canvas) => {
        drawPlaneGrid(canvas, current, grid, gridEffect, disc, aaDp);
        drawPlaneRings(canvas, current, rings, ringEffect, bands, aaDp, dim);
      },
      { width, height },
    );
    if (memo !== null) {
      memo.key = basePlaneKey(current, memo.key);
      memo.picture = picture;
      memo.rings = rings;
      memo.grid = grid;
      memo.focus = dim;
      memo.width = width;
      memo.height = height;
    }
    return picture;
  });
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
        // Never bake the first frame's empty base.
        busy: now.busy || firstFrame.value,
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
    firstFrame.value
      ? emptyPicture
      : createPicture(
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
  // 38.7-13 (D-24/D-53): the orbit streaks. At rest (and under reduced
  // motion) the layer holds one shared empty picture, so a pan re-records
  // nothing here.
  const switchPicture = useDerivedValue(() => {
    const signal = switchFx.value;
    if (firstFrame.value || !(signal.trail > 0)) return emptyPicture;
    return createPicture(
      (canvas) => {
        drawOrbitTrails(
          canvas,
          frame.value,
          ringSpecs.value,
          signal,
          switchRoles.value,
          ringEffect,
          bands,
          aaDp,
          trailLook,
        );
      },
      { width, height },
    );
  });
  // 38.7-14 (T-DIM): under ORRERY_OCCLUSION_STYLE "lab-b" the bodies and
  // labels pictures read the occlusion rects (Lab B R1) and the overlay draws
  // no fill; under "full-rect" (default) they never capture it, so a panel
  // opening does not re-record them.
  const worldOcclusion = ORRERY_OCCLUSION_STYLE === "lab-b" ? occlusion : null;
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
    firstFrame.value
      ? emptyPicture
      : createPicture(
          (canvas) => {
            drawBodies(
              canvas,
              frame.value,
              bodies.value.bodies,
              bodyOrder.value,
              "behind",
              bodyEffects,
              focus.value,
              worldOcclusion ? worldOcclusion.value : null,
            );
          },
          { width, height },
        ),
  );
  const sunPicture = useDerivedValue(() =>
    firstFrame.value
      ? emptyPicture
      : createPicture(
          (canvas) => {
            drawSun(
              canvas,
              frame.value,
              bodies.value.bodies,
              bodyOrder.value,
              pulse.value,
              bodyEffects,
              worldOcclusion ? worldOcclusion.value : null,
            );
          },
          { width, height },
        ),
  );
  const bodiesFront = useDerivedValue(() =>
    firstFrame.value
      ? emptyPicture
      : createPicture(
          (canvas) => {
            drawBodies(
              canvas,
              frame.value,
              bodies.value.bodies,
              bodyOrder.value,
              "front",
              bodyEffects,
              focus.value,
              worldOcclusion ? worldOcclusion.value : null,
            );
          },
          { width, height },
        ),
  );
  useLayerAck(ORRERY_LAYER.bodiesBehind, bodiesBehind, bodies, ackRecorded);
  useLayerAck(ORRERY_LAYER.sun, sunPicture, bodies, ackRecorded);
  useLayerAck(ORRERY_LAYER.bodiesFront, bodiesFront, bodies, ackRecorded);
  const labelsPicture = useDerivedValue(() =>
    firstFrame.value
      ? emptyPicture
      : createPicture(
          (canvas) => {
            drawLabels(
              canvas,
              labels.value,
              allocationIndex.value,
              focus.value,
              worldOcclusion ? worldOcclusion.value : null,
            );
          },
          { width, height },
        ),
  );
  useLayerAck(ORRERY_LAYER.labels, labelsPicture, labels, ackRecorded);
  const overlayPicture = useDerivedValue(() =>
    firstFrame.value
      ? emptyPicture
      : createPicture(
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
              worldOcclusion ? NO_OCCLUSION_FILL : occlusion.value,
            );
          },
          { width, height },
        ),
  );
  // First-frame cover (opaque canvas only; see the header). It lifts when
  // the canvas's first CONTENT frame was presented (the native probe's
  // answer), bounded by cover-gate.ts's fallbacks: a surface can exist
  // seconds before the first content frame on a heavy System (DEBUG All
  // Contacts, 38.7-09), and a recorded frame can sit in the GPU (38.7-15).
  const canvasRef = useRef<CanvasRef | null>(null);
  const cover = useSharedValue(host.opaqueCanvas ? 1 : 0);
  const surfaceReady = useSharedValue(false);
  const coverGate = useRef<CoverGate | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per canvas mount (the cover belongs to this native view)
  useEffect(() => {
    if (!host.opaqueCanvas) return;
    const gate = createCoverGate({
      arm: (token) => {
        perf?.mark("present-armed");
        canvasRef.current?.armPresentProbe?.(token);
      },
      lift: (reason: CoverLiftReason) => {
        cover.value = 0;
        perf?.mark(`cover-lift-${reason}`);
      },
      nextToken: nextPresentToken,
    });
    coverGate.current = gate;
    const stopWatching = watchFirstSurfaceFrame(
      () => canvasRef.current?.getNativeId?.() ?? null,
      () => {
        perf?.mark("surface-ready");
        surfaceReady.value = true;
      },
    );
    return () => {
      stopWatching();
      gate.dispose();
      coverGate.current = null;
    };
  }, []);
  const contentRecorded = useCallback(() => {
    coverGate.current?.contentReady();
  }, []);
  const onPresented = useCallback(
    (event: { token: number; outcome: string }) => {
      perf?.mark(`present-${event.outcome}`);
      coverGate.current?.presented(event.token, event.outcome);
    },
    [],
  );
  // 38.7-15: two frames after the surface exists (the sky-only first buffer
  // posted), the full scene records.
  useAnimatedReaction(
    () => surfaceReady.value,
    (ready, previous) => {
      if (!ready || previous === true || !firstFrame.value) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          firstFrame.value = false;
          runOnJS(markPerf)("first-frame-end");
        });
      });
    },
  );
  // 38.7-15: the content is recorded — the full scene (first-frame state
  // over) with the body specs published (a warm return's specs can arrive
  // late): arm the presented probe for the frame just recorded. The JS hop
  // and the native prop update land after that frame was drawn.
  const opaque = host.opaqueCanvas;
  useAnimatedReaction(
    () =>
      surfaceReady.value && !firstFrame.value && bodies.value.generation > 0,
    (ready, previous) => {
      if (!opaque || !ready || previous === true) return;
      runOnJS(contentRecorded)();
    },
  );
  const coverStyle = useAnimatedStyle(() => ({
    opacity: withTiming(cover.value, { duration: COVER_FADE_MS }),
  }));
  // 38.7-15 (D-65 FR-B): the SurfaceView's frame-rate vote, on change only.
  const applyFrameRateVote = useCallback((fps: number) => {
    canvasRef.current?.setFrameRateVote?.(fps);
  }, []);
  useAnimatedReaction(
    () => ambientFrameRateVote(reducedMotion.value, busy.value),
    (vote, previous) => {
      if (opaque && vote !== previous) runOnJS(applyFrameRateVote)(vote);
    },
  );
  return (
    <>
      {driver}
      <GestureDetector gesture={gesture}>
        <Canvas
          testID="orrery-canvas"
          ref={canvasRef}
          opaque={host.opaqueCanvas}
          onAndroidPresented={host.opaqueCanvas ? onPresented : undefined}
          style={{ width, height }}
        >
          <Picture picture={skyPicture} />
          <Picture picture={base} />
          <Picture picture={pulsesPicture} />
          <Picture picture={switchPicture} />
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
