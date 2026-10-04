/** ADR-077: keyed resources; one UI-thread world/projection frame for all layers. */
import type { SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useWindowDimensions } from "react-native";
import {
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type {
  CameraPose,
  CameraRect,
  CameraViewport,
  OrreryIntent,
  OrrerySatelliteTarget,
} from "@/logic/orrery-camera-logic";
import {
  type FocusCardRect,
  HIDDEN_FOCUS_CARD,
} from "@/logic/orrery-focus-card-logic";
import {
  focusEffectivelyOffscreen,
  type OrreryContactTarget,
} from "@/logic/orrery-focus-logic";
import {
  type AnimatedFrame,
  bodyKey,
  frameBodyByKey,
  projectAnimatedFrame,
} from "@/logic/orrery-frame";
import {
  allocateLabels,
  type LabelAllocation,
  labelContext,
  orreryInitials,
  type SemanticLevel,
  semanticLevel,
} from "@/logic/orrery-label-logic";
import {
  cameraExtent,
  hitPolaris,
  northTarget,
} from "@/logic/orrery-recovery-logic";
import {
  previewReorder,
  type ReorderIntent,
} from "@/logic/orrery-reorder-logic";
import {
  deriveSatelliteBodies,
  EMPTY_SATELLITE_SPEC,
  moonSplitFactor,
  type OrrerySatelliteSpec,
  resolveSatelliteTap,
} from "@/logic/orrery-satellite-logic";
import { SKY_UNTINTED, systemSkyHueIndex } from "@/logic/orrery-sky-logic";
import { detectStacks } from "@/logic/orrery-stack-logic";
import {
  rotateSwitchWorld,
  sampleSwitchLead,
  sampleSwitchSignalWithLead,
  sampleSwitchWorld,
} from "@/logic/orrery-switch-lead-logic";
import { systemRefId } from "@/logic/orrery-system-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import type {
  ResolvedMode,
  ThemePackage,
  ThemePalette,
} from "@/theme/theme-types";
import { orreryOcclusionDim } from "@/theme/tokens/surface";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import type { OrrerySatelliteSource } from "./orrery-satellite-publisher";
import type { OrreryGenerationLedger } from "./resources/orrery-generation-ledger";
import { createOrreryGenerationLedger } from "./resources/orrery-generation-ledger";
import { orreryPhotoCache } from "./resources/orrery-photo-cache";
import {
  createOrreryTextPublisher,
  ORRERY_INITIALS_MIN_RADIUS_PX,
  ORRERY_LABEL_BODY_GAP,
  ORRERY_LABEL_MAX_WIDTH,
  ORRERY_TEXT_ELIGIBILITY_INTERVAL_MS,
  type OrreryInitialsSource,
  type OrreryLabelSource,
  type OrreryTextPublisher,
  type OrreryTextScene,
  type OrreryTextVisibility,
} from "./resources/orrery-text-service";
import { orreryWarmCache } from "./resources/orrery-warm-cache";
import {
  NORMAL_SWITCH_DURATION_MS,
  type OrrerySwitchRuntime,
  sampleOrrerySwitchCamera,
  sampleSwitchLeadCamera,
} from "./use-orrery-switch-runtime";
import {
  type BakeRegistry,
  createBaseBakeOwner,
  disposeBakedSnapshots,
  EMPTY_BAKE_REGISTRY,
  teardownBakeRegistry,
} from "./v2/base-bake";
import type { ReorderHoldFx } from "./v2/draw-overlay";
import {
  switchLeadTrailRoles,
  switchTrailRoles,
  type TrailLook,
} from "./v2/draw-switch";
import {
  buildFocusSpec,
  collectOcclusion,
  type FocusDraw,
  type FocusSpec,
  labelExclusions,
  NO_FOCUS_SPEC,
} from "./v2/focus-fx";
import {
  createSkyBakeOwner,
  orrerySkyWarmStore,
  SKY_NEBULA_SEED,
  type SkyBakeOwner,
  skyBakeKey,
  skySizeBucket,
} from "./v2/nebula-bake";
import { OrreryV2Canvas } from "./v2/OrreryV2Canvas";
import {
  bodyIdentity,
  bodyInitialsLayout,
  buildBodyLooks,
  buildOverlayInk,
  buildPhotoRequests,
  buildPlaneSpec,
  buildRingSpecs,
  buildSatelliteLooks,
  buildSkySpec,
  createOrrerySpecPublisher,
  EMPTY_BODY_SPECS,
  EMPTY_LABEL_LAYER_SPECS,
  EMPTY_OVERLAY_SPEC,
  EMPTY_PLANE_SPEC,
  EMPTY_RING_SPECS,
  EMPTY_SKY_IMAGE,
  type OrreryBodySpecs,
  type OrreryLabelLayerSpecs,
  type OrreryLayerId,
  type OrrerySpecPublisher,
  type OverlaySpec,
  type PlaneSpec,
  parseLedgerHandle,
  type RingSpecs,
  type SkyImageSpec,
  type SkySpec,
  tokenInk,
} from "./v2/scene-specs";
import {
  FOCUS_MIX_MS,
  FOCUS_RELEASE_MS,
  GRID_EXTENT,
  GRID_HALF_WIDTH_DP,
  GRID_OPACITY,
  GRID_RINGS,
  GRID_SPOKES,
  PULSE_BUDGET,
  PULSE_INTENSITY,
  RETICLE_LOCK_END,
  RETICLE_LOCK_MS,
  RING_LOOKS,
  SKY_LOOKS,
  SKY_NEBULA_PERIOD,
  SKY_NEBULA_TEX,
  SKY_STAR_SEED,
  SKY_TWINKLE_GROUPS,
  TRAIL_ALPHA,
  TRAIL_BUDGET,
  TRAIL_STRENGTH,
} from "./v2/visual-tunables";

export { createOrreryGestures } from "./use-orrery-camera";

import {
  createOrreryGestures,
  type OrreryCameraController,
} from "./use-orrery-camera";

/**
 * D-52: stable empty defaults. A fresh `[]`/`{}` default per render changes the
 * frame worklet's closure (restarting the mapper) and the labels memo's deps
 * (rebuilding every Paragraph) on any unrelated parent render.
 */
const EMPTY_IDS: readonly number[] = Object.freeze([]);
const EMPTY_RELATIONS: Readonly<Record<number, string>> = Object.freeze({});
const NO_RECTS: readonly CameraRect[] = Object.freeze([]);

/** A linear timing curve (the reticle's lock timeline shapes itself, Lab A). */
function linear(t: number): number {
  "worklet";
  return t;
}

type SceneMember = OrrerySceneSnapshot["contacts"][number];
/**
 * D-52: id → FIRST row with that id (exactly what `find` returned), built once
 * per row array instead of a scan per body on every render. Keyed weakly on the
 * array, so an older scene's map is collected with its scene.
 */
const rowsById = new WeakMap<
  readonly SceneMember[],
  ReadonlyMap<number, SceneMember>
>();
function rowById(
  rows: readonly SceneMember[],
  id: number,
): SceneMember | undefined {
  let index = rowsById.get(rows);
  if (!index) {
    const built = new Map<number, SceneMember>();
    for (const row of rows) if (!built.has(row.id)) built.set(row.id, row);
    rowsById.set(rows, built);
    index = built;
  }
  return index.get(id);
}

/**
 * 38.7-04 (D-52/H4): what the text publisher needs from a frame — the visible
 * body keys (labels above overview) and the bodies big enough to show initials.
 * The signature changes only when either key set changes, never on radius alone.
 * A module-level worklet defined above its only caller (Hermes forward-ref rule).
 */
function orreryTextEligibility(
  frame: AnimatedFrame,
  minRadius: number,
): { signature: string; visibility: OrreryTextVisibility } {
  "worklet";
  const visible: string[] = [];
  const eligible: { key: string; radius: number }[] = [];
  const bodies = frame.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (body.kind === "satellite" || !body.visible) continue;
    const key = bodyKey(body);
    visible.push(key);
    if (body.radius >= minRadius) eligible.push({ key, radius: body.radius });
  }
  visible.sort();
  eligible.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  let signature = `${visible.join(",")}|`;
  for (let i = 0; i < eligible.length; i++) signature += `${eligible[i].key},`;
  return { signature, visibility: { visible, eligible } };
}

let worldSerial = 0;
type OrreryLedger = OrreryGenerationLedger<string>;

/** 38.7-15 (D-56): DEBUG tab-return marks (`src/__dev__/orrery-perf-marks.ts`). */
interface OrreryPerfMarks {
  mark(name: string): void;
  markOnce(name: string): void;
}
// DEBUG only: Metro folds this to null in a release bundle.
const perf: OrreryPerfMarks | null =
  typeof __DEV__ !== "undefined" && __DEV__
    ? require("@/__dev__/orrery-perf-marks")
    : null;

/**
 * 38.7-07 (H3): routes the native objects the ledger released back to their
 * holders, in the order given (teardown passes reverse creation order). A
 * photo image is confirmed to the shared cache and a Paragraph to the text
 * service; each is disposed when `dispose` (teardown) or superseded, else it
 * turns warm for reuse. 38.7-08: a baked base snapshot is never reused; its
 * ids go to `disposeBase` (UI-thread disposal) in order. 38.7-09: a baked sky
 * image is never reused either; its ids go to `retireSky` (JS disposal).
 */
function routeRetired(
  owner: string,
  text: OrreryTextPublisher,
  handles: Iterable<string>,
  dispose: boolean,
  disposeBase: (ids: number[]) => void,
  retireSky: (ids: number[]) => void,
): void {
  // Batched per holder and epoch: one confirmation frees the whole set, so a
  // queued publish retries once (C3-L3's generation bound), not per object.
  const photos = new Map<number, number[]>();
  const texts = new Map<number, string[]>();
  const bases: number[] = [];
  const skies: number[] = [];
  for (const handle of handles) {
    const parsed = parseLedgerHandle(handle);
    if (parsed?.kind === "photo")
      photos.set(parsed.epoch, [
        ...(photos.get(parsed.epoch) ?? []),
        parsed.id,
      ]);
    else if (parsed?.kind === "text")
      texts.set(parsed.epoch, [...(texts.get(parsed.epoch) ?? []), parsed.key]);
    else if (parsed?.kind === "base") bases.push(parsed.id);
    else if (parsed?.kind === "sky") skies.push(parsed.id);
  }
  for (const [epoch, ids] of photos)
    orreryPhotoCache.confirmRetired(owner, ids, epoch, { dispose });
  for (const [epoch, keys] of texts) text.confirmRetired(keys, epoch, dispose);
  if (bases.length > 0) disposeBase(bases);
  if (skies.length > 0) retireSky(skies);
}

/**
 * 38.7-13 (D-53, C3-M2): the renderer is memoised, so a screen render that
 * changes none of its props (a persistence-only store change, a satellite
 * state held mid-switch, an obstacle measured mid-switch — the screen holds
 * the renderer viewport until settle) commits nothing here. The un-memoised
 * component stays exported for the direct-call render tests.
 */
export function OrreryWorldInner({
  scene,
  pose,
  viewport,
  colors,
  themeMode,
  themePackage,
  fontProvider,
  onIntent,
  focusedIds,
  clusterIds = focusedIds.length > 1 ? focusedIds : EMPTY_IDS,
  focusedRelationById = EMPTY_RELATIONS,
  interactive = true,
  camera,
  onFocusLost,
  onReorder,
  onReorderActivated,
  satelliteSource,
  focusedSatellite,
  switchRuntime,
  focusCardRect,
  occlusionRects,
}: {
  scene: OrrerySceneSnapshot;
  camera: OrreryCameraController;
  pose: SharedValue<CameraPose>;
  viewport: CameraViewport;
  colors: ThemePalette;
  /** 38.7-09 (D-51): the resolved theme mode keys the sky's blend family. */
  themeMode: ResolvedMode;
  /** 38.7-09: the active package (the sky bake key and look). */
  themePackage: ThemePackage;
  fontProvider: SkTypefaceFontProvider | null;
  onIntent: (intent: OrreryIntent) => void;
  focusedIds: number[];
  clusterIds?: readonly number[];
  /** Already-filtered, existing relation context only; supplied by focus/moon owner. */
  focusedRelationById?: Readonly<Record<number, string>>;
  interactive?: boolean;
  onFocusLost?: () => void;
  onReorder: (intent: ReorderIntent) => void;
  onReorderActivated: () => void;
  /**
   * 38.7-10 (C-M3): the satellite publisher's read side — a stable object
   * whose SharedValue the frame worklet reads and whose JS signal rebuilds the
   * moon looks. Never a rows prop: a satellite load commits no render here.
   */
  satelliteSource?: OrrerySatelliteSource;
  focusedSatellite?: OrrerySatelliteTarget | null;
  /** Screen-owned runtime survives this canvas consumer being unmounted. */
  switchRuntime: OrrerySwitchRuntime;
  /**
   * 38.7-11 (D-19/H5): the docked focus card's UI-thread rect — the same
   * value that positions the card — for its occlusion dim and the label
   * exclusion (it is never a viewport obstacle, C-M2).
   */
  focusCardRect?: SharedValue<FocusCardRect>;
  /** 38.7-11 (D-55): the static text panels' canvas rects (measured). */
  occlusionRects?: SharedValue<readonly CameraRect[]>;
}) {
  const { fontScale } = useWindowDimensions();
  // 38.7-15 (DEBUG): this mount's first render began (the tab-return
  // decomposition: warm-pose → world-render → canvas-mount).
  const renderMarked = useRef(false);
  if (!renderMarked.current) {
    renderMarked.current = true;
    perf?.mark("world-render");
  }
  const resources = switchRuntime.resources;
  const mounted = useRef(true);
  const focusKey = JSON.stringify([
    scene.generation,
    focusedIds,
    focusedSatellite,
  ]);
  const latestFocus = useRef(focusKey);
  latestFocus.current = focusKey;
  const reportFocusLost = useCallback(() => {
    if (mounted.current && latestFocus.current === focusKey) onFocusLost?.();
  }, [focusKey, onFocusLost]);
  const level = useSharedValue<SemanticLevel>("overview");
  // 38.7-04/07 (D-46/D-52/M3): every label and initials Paragraph reaches the
  // pictures through these specs, written by the JS publishers — never React
  // state, so a tier change commits no render here.
  const labelSpecs = useSharedValue<OrreryLabelLayerSpecs>(
    EMPTY_LABEL_LAYER_SPECS,
  );
  // 38.7-07 (D-43/H3): the body specs every body picture layer reads, the
  // shared spec generation and the ledger that gates native-object disposal.
  const bodySpecs = useSharedValue<OrreryBodySpecs>(EMPTY_BODY_SPECS);
  const ledgerRef = useRef<OrreryLedger | null>(null);
  if (!ledgerRef.current) ledgerRef.current = createOrreryGenerationLedger();
  const ledger = ledgerRef.current;
  const specPublisherRef = useRef<OrrerySpecPublisher | null>(null);
  if (!specPublisherRef.current)
    specPublisherRef.current = createOrrerySpecPublisher({
      ledger,
      writeBodies: (specs) => {
        bodySpecs.value = specs;
      },
      writeLabels: (specs) => {
        labelSpecs.value = specs;
      },
    });
  const specPublisher = specPublisherRef.current;
  const publisherRef = useRef<OrreryTextPublisher | null>(null);
  if (!publisherRef.current) {
    const owner = `orrery-world:${++worldSerial}`;
    publisherRef.current = Object.assign(
      createOrreryTextPublisher({
        owner,
        write: (labels, initials) => {
          if (labels) specPublisherRef.current?.setLabels(labels);
          if (initials) specPublisherRef.current?.setInitials(initials);
        },
      }),
      { owner },
    );
  }
  const publisher = publisherRef.current as OrreryTextPublisher & {
    owner: string;
  };
  // 38.7-08 (D-49/H3): the baked-base snapshots live on the UI runtime in this
  // registry; the ledger tracks their ids under the `base` layer.
  const bakeRegistry = useSharedValue<BakeRegistry>(EMPTY_BAKE_REGISTRY);
  const disposeBase = useCallback(
    (ids: number[]) => {
      runOnUI(disposeBakedSnapshots)(bakeRegistry, ids);
    },
    [bakeRegistry],
  );
  const baseOwnerRef = useRef<ReturnType<typeof createBaseBakeOwner> | null>(
    null,
  );
  if (!baseOwnerRef.current)
    baseOwnerRef.current = createBaseBakeOwner({
      ledger,
      dispose: disposeBase,
    });
  const baseOwner = baseOwnerRef.current;
  const onBaseBaked = useCallback(
    (mountEpoch: number, generation: number, id: number | null) => {
      baseOwner.published(mountEpoch, generation, id);
    },
    [baseOwner],
  );
  // 38.7-09 (H9/C-H2): the sky's baked NEUTRAL nebula — one image per
  // (package, mode, size bucket), a `sky`-layer object in the ledger.
  const skyImage = useSharedValue<SkyImageSpec>(EMPTY_SKY_IMAGE);
  const skyOwnerRef = useRef<SkyBakeOwner | null>(null);
  if (!skyOwnerRef.current)
    skyOwnerRef.current = createSkyBakeOwner({
      ledger,
      ensureEpoch: () => specPublisher.ensureEpoch(),
      write: (spec) => {
        skyImage.value = spec;
      },
      // 38.7-15 (D-58): a warm nebula for the same key is adopted at once.
      warm: orrerySkyWarmStore,
    });
  const skyOwner = skyOwnerRef.current;
  const retireSky = useCallback(
    (ids: number[]) => {
      skyOwner.retire(ids);
    },
    [skyOwner],
  );
  // Capture only the producer's input; the controller also contains its published output.
  const reorder = camera.reorder;
  // D-52 freeze: the frame worklet may capture only SharedValues, primitives,
  // module functions and memoised plain values. Capturing `switchRuntime` (every
  // resource holds a full scene) or `scene` re-materialises them on the UI
  // runtime at each mapper start (orrery-frame-mapper.test.ts guards this).
  const { transition, progress, cameraFrom, cameraTo, lead, leadClock } =
    switchRuntime;
  // D-49: the base is never baked during a switch (38.7-15: or its lead-in),
  // a gesture or a camera motion (SharedValues only are captured).
  const { active: cameraActive, input: cameraInput } = camera;
  const busy = useDerivedValue(
    () =>
      progress.value < 1 ||
      lead.value.active ||
      cameraActive.value !== null ||
      cameraInput.value.pointers > 0,
  );
  const generation = scene.generation;
  // The pan bound the pose was clamped to (gestures, Home, recovery); the
  // dolly focal no longer encodes it (38.7-05).
  const frameExtent = cameraExtent(scene.extent);
  const memberIdentities = useMemo(
    () => scene.systemSnapshot.members.map(({ id, uid }) => ({ id, uid })),
    [scene],
  );
  // 38.7-10 (C-M3): the satellite spec SharedValue (a local empty one when
  // no publisher is wired, e.g. previews and tests).
  const ownSatelliteSpec =
    useSharedValue<OrrerySatelliteSpec>(EMPTY_SATELLITE_SPEC);
  const satelliteSpec = satelliteSource
    ? satelliteSource.spec
    : ownSatelliteSpec;
  const frame = useDerivedValue(() => {
    // 38.7-15 (D-76): a lead-in turns the settled world and breathes the
    // camera while the destination loads (pure in its state and clock).
    const leadState = lead.value;
    const leadNow =
      leadState.active && progress.value >= 1
        ? sampleSwitchLead(
            leadState,
            leadClock.value,
            NORMAL_SWITCH_DURATION_MS,
          )
        : null;
    const switchWorld = sampleSwitchWorld(transition.value, progress.value);
    const sampled = leadNow
      ? rotateSwitchWorld(switchWorld, leadNow.rotation)
      : switchWorld;
    // C3-H1 / C4-L2: the one sampler, with the motion of the transition
    // being drawn (never the live reduced-motion flag).
    const sampledCamera =
      progress.value >= 1
        ? leadNow
          ? sampleSwitchLeadCamera(pose.value, leadNow.breath)
          : pose.value
        : sampleOrrerySwitchCamera(
            cameraFrom.value,
            cameraTo.value,
            progress.value,
            transition.value,
          );
    const held = reorder.value;
    const world = previewReorder(
      sampled,
      held?.generation === generation ? held : null,
    );
    // 38.7-10 (D-31/M13): the bump → moons split follows THIS frame's
    // sampled camera zoom, so the moons drawn, their positions and their
    // `interactive` flags all come from the one frame the pictures and the
    // tap resolver read (never the previous frame's magnification or the
    // reaction-updated tier). The index is used only for its own scene.
    const satellite = satelliteSpec.value;
    const sceneGeneration = transition.value.generation;
    const moonSplit = moonSplitFactor(sampledCamera.zoom);
    const satelliteBodies = deriveSatelliteBodies(
      world,
      satellite.index,
      satellite.sceneGeneration === sceneGeneration,
      moonSplit,
    );
    const completeWorld = [...world, ...satelliteBodies.moons];
    const projected = projectAnimatedFrame(
      {
        generation: sceneGeneration,
        from: completeWorld,
        to: completeWorld,
      },
      1,
      sampledCamera,
      viewport,
      { extent: frameExtent },
    );
    projected.moonBumps = satelliteBodies.bumps;
    projected.moonSplit = moonSplit;
    // D-54: the stacks (pips), indexed, once per frame from the same bodies.
    projected.stacks = detectStacks(projected.bodies);
    return projected;
  });
  // 38.7-13 (D-24/D-53): the switch signal of the transition being drawn —
  // transition/progress SharedValues only (C4-L2: never the live reduced-
  // motion flag); the streak roles are rebuilt once per transition.
  const switchFx = useDerivedValue(() =>
    sampleSwitchSignalWithLead(
      transition.value,
      progress.value,
      NORMAL_SWITCH_DURATION_MS,
      lead.value,
      leadClock.value,
    ),
  );
  // 38.7-15: a lead-in's streak roles (every contact turns with the world).
  const switchRoles = useDerivedValue(() =>
    lead.value.active && transition.value.settledWorld
      ? switchLeadTrailRoles(transition.value)
      : switchTrailRoles(transition.value),
  );
  const trailLook = useMemo<TrailLook>(
    () => ({
      peak: TRAIL_ALPHA[themeMode] * TRAIL_STRENGTH,
      additive: themeMode === "dark",
      budget: TRAIL_BUDGET,
    }),
    [themeMode],
  );
  // Conventional focus positioning consumes this same interpolated frame.
  useAnimatedReaction(
    () => frame.value,
    (value) => {
      camera.frame.value = value;
    },
  );
  useEffect(() => {
    mounted.current = true;
    // 38.7-15 (D-58): the warm set is this world's to reuse; no idle release.
    orreryWarmCache.resumeOnFocus();
    perf?.mark("canvas-mount");
    return () => {
      mounted.current = false;
    };
  }, []);
  // 38.7-09 (D-07/D-08/D-50/D-51): the painted sky spec — theme, measured
  // size and the System's tint bucket. A System change rewrites this
  // SharedValue only; the neutral bake below never sees the hue (H9).
  const skyBucket = skySizeBucket(viewport.width, viewport.height);
  const skyLook = SKY_LOOKS[themePackage][themeMode];
  let hueIndex = SKY_UNTINTED;
  try {
    hueIndex = systemSkyHueIndex(
      systemRefId(scene.system),
      colors.orrerySystemHues.length,
    );
  } catch {
    hueIndex = SKY_UNTINTED;
  }
  // 38.7-15 (first frame): the sky spec exists before the first recording —
  // an empty spec draws a transparent sky, which an opaque SurfaceView shows
  // as black (the Galaxy Light black canvas). The effect below keeps it current.
  const initialSky = useRef<SkySpec | null>(null);
  if (!initialSky.current)
    initialSky.current = buildSkySpec({
      colors,
      mode: themeMode,
      themePackage,
      width: viewport.width,
      height: viewport.height,
      cover: skyBucket,
      hueIndex,
      fromHueIndex: hueIndex,
      tintGeneration: generation,
      look: skyLook,
      seed: SKY_STAR_SEED,
      twinkleGroups: SKY_TWINKLE_GROUPS,
    });
  const skySpec = useSharedValue<SkySpec>(initialSky.current);
  // 38.7-13 (D-08/H9): a hue change crossfades from the previous System's
  // hue, tagged with the scene generation whose switch draws the crossfade
  // (the sky picture mixes at DRAW time from the switch signal; no bake).
  const skyTint = useRef<{ hue: number; from: number; generation: number }>(
    null,
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the bucket's numbers and the hue, not the object; the generation is read when the hue changes
  useEffect(() => {
    const last = skyTint.current;
    const tint =
      last === null
        ? { hue: hueIndex, from: hueIndex, generation }
        : last.hue !== hueIndex
          ? { hue: hueIndex, from: last.hue, generation }
          : last;
    skyTint.current = tint;
    // 38.7-15: the first run (this mount's first commit) has exactly the
    // inputs `initialSky` was built from in the same render: no second build
    // and no SharedValue write (which would re-record the sky at mount).
    if (last === null) return;
    skySpec.value = buildSkySpec({
      colors,
      mode: themeMode,
      themePackage,
      width: viewport.width,
      height: viewport.height,
      cover: skyBucket,
      hueIndex,
      fromHueIndex: tint.from,
      tintGeneration: tint.generation,
      look: skyLook,
      seed: SKY_STAR_SEED,
      twinkleGroups: SKY_TWINKLE_GROUPS,
    });
  }, [
    skySpec,
    colors,
    themeMode,
    themePackage,
    viewport.width,
    viewport.height,
    skyBucket.width,
    skyBucket.height,
    hueIndex,
    skyLook,
  ]);
  // H9: bake on mount and on a theme / size-bucket change only (the key has
  // no hue component, so a System change never reaches this effect's deps).
  const skyKey = skyBakeKey(themePackage, themeMode, skyBucket);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by skyKey (package, mode, bucket); the bake holds densities only (no colour, H9)
  useEffect(() => {
    skyOwner.request({
      key: skyKey,
      size: SKY_NEBULA_TEX,
      period: SKY_NEBULA_PERIOD,
      seed: SKY_NEBULA_SEED[themePackage],
    });
  }, [skyOwner, skyKey]);
  // D-43/D-44/D-11: the V2 ring look (Lab B's thin, sun-lit lines), rebuilt
  // on resource or theme change only (never per frame); the base picture
  // reads it with the shared frame.
  const ringLook = RING_LOOKS[themePackage][themeMode];
  const ringSpecs = useSharedValue<RingSpecs>(EMPTY_RING_SPECS);
  useEffect(() => {
    ringSpecs.value = buildRingSpecs(resources, colors, ringLook);
  }, [ringSpecs, resources, colors, ringLook]);
  // 38.7-09 (D-09/D-10): the plane's optional grid and the orbit pulses
  // (theme only; GRID_OPACITY / PULSE_INTENSITY are owner-ruled tunables).
  const planeSpec = useSharedValue<PlaneSpec>(EMPTY_PLANE_SPEC);
  useEffect(() => {
    planeSpec.value = buildPlaneSpec(colors, themeMode, ringLook, {
      gridOpacity: GRID_OPACITY,
      gridRings: GRID_RINGS,
      gridSpokes: GRID_SPOKES,
      gridHalfWidthDp: GRID_HALF_WIDTH_DP,
      gridExtent: GRID_EXTENT,
      pulseIntensity: PULSE_INTENSITY,
      pulseBudget: PULSE_BUDGET,
    });
  }, [planeSpec, colors, themeMode, ringLook]);
  // The overlay picture's inputs (Polaris, the reorder outline, the reticle
  // and occlusion inks).
  const overlaySpec = useSharedValue<OverlaySpec>(EMPTY_OVERLAY_SPEC);
  const focusSignature = focusedIds.join(",");
  const overlay = useMemo<OverlaySpec>(
    () => ({
      ink: buildOverlayInk(colors),
      extent: scene.extent,
      additive: themeMode === "dark",
      occlusionDim: orreryOcclusionDim(themePackage, themeMode),
    }),
    [colors, scene.extent, themeMode, themePackage],
  );
  useEffect(() => {
    overlaySpec.value = overlay;
  }, [overlaySpec, overlay]);
  // 38.7-11 (D-18/D-21): what focus does to the world. The spec is written
  // on a focus change only; `focusMix` (Lab B's world response) and
  // `reticleLock` (Lab A's lock-on) are Reanimated timings — never React
  // state per frame — and instant under reduced motion. On a clear the last
  // spec is kept while the mix fades out (Lab B), so the release fades too.
  const reducedMotion = useReducedMotionShared();
  const satelliteFocus = focusedSatellite
    ? bodyKey({ id: -1, kind: "satellite", satelliteTarget: focusedSatellite })
    : null;
  const clusterSignature = clusterIds.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the focus and cluster ids' contents, not their identity
  const focusSpec = useMemo(
    () =>
      buildFocusSpec(
        resources,
        focusedIds,
        clusterIds,
        satelliteFocus,
        themeMode,
      ),
    [resources, focusSignature, clusterSignature, satelliteFocus, themeMode],
  );
  const focusState = useSharedValue<FocusSpec>(NO_FOCUS_SPEC);
  const focusMix = useSharedValue(0);
  const reticleLock = useSharedValue(RETICLE_LOCK_END);
  const focusReleased = useSharedValue(true);
  useEffect(() => {
    const next = focusSpec;
    runOnUI(() => {
      "worklet";
      const reduced = reducedMotion.value;
      const previous = focusState.value;
      if (next.active) {
        if (
          next.reticle !== null &&
          (focusReleased.value || next.reticle !== previous.reticle)
        ) {
          reticleLock.value = reduced ? RETICLE_LOCK_END : 0;
          if (!reduced)
            reticleLock.value = withTiming(RETICLE_LOCK_END, {
              duration: RETICLE_LOCK_MS,
              easing: linear,
            });
        }
        focusState.value = next;
        focusReleased.value = false;
      } else focusReleased.value = true;
      const target = next.active ? 1 : 0;
      focusMix.value = reduced
        ? target
        : withTiming(target, {
            duration: next.active ? FOCUS_MIX_MS : FOCUS_RELEASE_MS,
          });
    })();
  }, [
    focusSpec,
    focusState,
    focusMix,
    reticleLock,
    focusReleased,
    reducedMotion,
  ]);
  // 38.7-12 (D-23): the reorder hold's live feedback for the overlay — the
  // gesture-owned charge and slot flash (never React state per frame).
  const { reorderCharge, reorderFlash } = camera;
  const holdFx = useDerivedValue<ReorderHoldFx>(() => ({
    charge: reorderCharge.value,
    flash: reorderFlash.value,
    reduced: reducedMotion.value,
  }));
  const focusDraw = useDerivedValue<FocusDraw>(() => ({
    spec: focusState.value,
    mix: focusMix.value,
    lock: reticleLock.value,
  }));
  // D-55 (H5): every Orrery text surface's occlusion rect — the static
  // panels plus the focus card's UI-thread rect (it moves with the card).
  const ownCardRect = useSharedValue<FocusCardRect>(HIDDEN_FOCUS_CARD);
  const ownStaticRects = useSharedValue<readonly CameraRect[]>(NO_RECTS);
  const cardRect = focusCardRect ?? ownCardRect;
  const staticRects = occlusionRects ?? ownStaticRects;
  const occlusion = useDerivedValue<readonly CameraRect[]>(() =>
    collectOcclusion(staticRects.value, cardRect.value),
  );
  // Plain label inputs only (no Paragraphs): one stable label node per
  // labelable body; the publisher decides which ones get text, per tier.
  const labelSources = useMemo<OrreryLabelSource[]>(
    () =>
      scene.world.flatMap((body) => {
        if (body.id === 0) return [];
        const member = rowById(scene.systemSnapshot.members, body.id);
        const name =
          member?.name ??
          (body.kind === "sun" ? scene.sun.sunContactName : undefined);
        if (name === undefined) return [];
        const focused = focusedIds.length === 1 && focusedIds[0] === body.id;
        // D-11: nonmember global sun keeps identity, but no relationship context.
        const context = labelContext(
          member
            ? member.status
            : body.kind === "sun"
              ? scene.sun.occupant?.status
              : undefined,
          scene.gravity.get(body.id),
          focused && member ? focusedRelationById[body.id] : undefined,
        );
        return [
          {
            key: bodyKey(body),
            name,
            context,
            focused,
            cluster: clusterIds.includes(body.id),
            favorite: member?.favourite_rank != null,
          },
        ];
      }),
    [scene, focusedIds, clusterIds, focusedRelationById],
  );
  const initialsSources = useMemo<OrreryInitialsSource[]>(
    () =>
      resources.flatMap((resource) => {
        if (resource.body.kind === "satellite") return [];
        const { name, photo } = bodyIdentity(resource, colors);
        const text = orreryInitials(name);
        if (text.length === 0) return [];
        const layout = bodyInitialsLayout(
          resource.body.kind === "sun" ? "sun" : "contact",
          resource.body.radius,
        );
        return [
          { key: resource.key, text, ...layout, hasPhoto: photo !== null },
        ];
      }),
    [resources, colors],
  );
  // 38.7-07 (D-43): the static body looks — contacts and the sun, then the
  // moons (theme, resources and moons only; 38.7-11: a focused moon carries
  // the overlay reticle, so focus no longer rebuilds looks). 38.7-10
  // (C-M3): the moons come from the satellite publisher's latest spec, read
  // on its JS signal, so a satellite load republishes the looks without a
  // React render.
  // 38.7-10 (D-13/D-14/D-15): the resolved mode selects the lit-body and
  // star-sun looks.
  const bodyLooks = useMemo(
    () => buildBodyLooks(resources, colors, themeMode),
    [resources, colors, themeMode],
  );
  const lookInputs = useRef({ bodyLooks, colors });
  lookInputs.current = { bodyLooks, colors };
  const publishLooks = useCallback(() => {
    const latest = lookInputs.current;
    const rows = satelliteSource?.current().index.rows ?? [];
    specPublisher.setLooks(
      rows.length === 0
        ? latest.bodyLooks
        : [...latest.bodyLooks, ...buildSatelliteLooks(rows, latest.colors)],
    );
  }, [specPublisher, satelliteSource]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: publishLooks reads the latest looks from lookInputs
  useEffect(() => {
    publishLooks();
  }, [publishLooks, bodyLooks, colors]);
  useEffect(
    () => satelliteSource?.subscribe(publishLooks),
    [satelliteSource, publishLooks],
  );
  useEffect(() => {
    specPublisher.setLabelPlate(tokenInk(colors.surface));
  }, [specPublisher, colors]);
  // D-53: photos come from the one shared, bounded cache. A photo arriving
  // calls back synchronously and republishes the body specs (no React state).
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by focusSignature (focusedIds' contents), not its identity
  const focusedKeys = useMemo(
    () =>
      new Set(
        resources
          .filter(
            (resource) =>
              resource.body.kind !== "satellite" &&
              focusedIds.includes(resource.body.id),
          )
          .map((resource) => resource.key),
      ),
    [resources, focusSignature],
  );
  const photoEpoch = useRef<number | null>(null);
  // Moons carry no photo: the contact and sun looks are the whole request.
  const photoInputs = useRef({ looks: bodyLooks, focusedKeys });
  photoInputs.current = { looks: bodyLooks, focusedKeys };
  const visibilityRef = useRef<OrreryTextVisibility | null>(null);
  const requestPhotos = useCallback(() => {
    const { owner } = publisher;
    if (photoEpoch.current === null)
      photoEpoch.current = orreryPhotoCache.mount(owner, () => {
        const epoch = photoEpoch.current;
        if (epoch !== null)
          specPublisher.setPhotos(orreryPhotoCache.drawn(owner), epoch);
      });
    orreryPhotoCache.request(
      owner,
      buildPhotoRequests(
        photoInputs.current.looks,
        photoInputs.current.focusedKeys,
        visibilityRef.current,
      ),
    );
  }, [publisher, specPublisher]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-request when the looks (photo paths) or the focus change; requestPhotos reads them from photoInputs
  useEffect(() => {
    requestPhotos();
  }, [requestPhotos, bodyLooks, focusedKeys]);
  // H3: a layer recorded a generation one UI frame ago. Whatever no layer can
  // still re-record goes back to its holder.
  const ackRecorded = useCallback(
    (layer: OrreryLayerId, generation: number, epoch: number) => {
      if (!ledger.ack(layer, generation, epoch)) return;
      perf?.markOnce("first-recorded");
      routeRetired(
        publisher.owner,
        publisher,
        ledger.retirable(),
        false,
        disposeBase,
        retireSky,
      );
    },
    [ledger, publisher, disposeBase, retireSky],
  );
  const textScene = useMemo<OrreryTextScene>(
    () => ({
      labels: labelSources,
      initials: initialsSources,
      labelWidth: Math.min(ORRERY_LABEL_MAX_WIDTH * fontScale, viewport.width),
      fontScale,
      fontProvider,
      labelInk: colors[TYPOGRAPHY.label.colorToken],
      captionInk: colors[TYPOGRAPHY.caption.colorToken],
      initialsInk: colors.avatarSwatchText,
    }),
    [
      labelSources,
      initialsSources,
      fontScale,
      viewport.width,
      fontProvider,
      colors,
    ],
  );
  useEffect(() => {
    publisher.setScene(textScene);
  }, [publisher, textScene]);
  useEffect(
    () => () => {
      // H3 teardown: pins retire now and the publishing epoch ends; the clock
      // and the pictures stop with the canvas unmounting in this commit. Only
      // after that teardown's queued UI jobs and one more UI frame (no mapper
      // can still record) does the hand-off run. 38.7-15 (D-58, contract rule
      // 3): FIRST the world's released photos, Paragraphs and baked sky are
      // transferred to the warm owner (CPU-backed only, trimmed to the warm
      // caps; released instead while the app is not active); THEN the ledger
      // hands back the rest of the epoch in reverse creation order — the
      // baked base snapshots (GPU textures, never retained), then the
      // offscreen surface (UI thread).
      const { owner } = publisher;
      const textEpoch = publisher.release();
      // 38.7-09: no new sky bake may publish from here on.
      skyOwner.detach();
      const ledgerEpoch = specPublisher.detach();
      const photos = photoEpoch.current;
      photoEpoch.current = null;
      if (photos !== null) orreryPhotoCache.release(owner);
      const finish = () => {
        orreryWarmCache.retainOnBlur({
          photos: photos === null ? null : { owner, epoch: photos },
          text: textEpoch === null ? null : { owner, epoch: textEpoch },
          skies: skyOwner.handOff(),
        });
        const baseIds: number[] = [];
        const collectBase = (ids: number[]) => {
          baseIds.push(...ids);
        };
        if (ledgerEpoch !== null)
          ledger.teardown(
            (handle) =>
              routeRetired(
                owner,
                publisher,
                [handle],
                true,
                collectBase,
                retireSky,
              ),
            ledgerEpoch,
          );
        runOnUI(teardownBakeRegistry)(bakeRegistry, baseIds);
      };
      setTimeout(() => {
        runOnUI(() => {
          "worklet";
          requestAnimationFrame(() => {
            runOnJS(finish)();
          });
        })();
      }, 0);
    },
    [publisher, specPublisher, ledger, bakeRegistry, skyOwner, retireSky],
  );
  const sendTier = useCallback(
    (tier: SemanticLevel) => publisher.setTier(tier),
    [publisher],
  );
  const sendVisibility = useCallback(
    (visibility: OrreryTextVisibility) => {
      publisher.setVisibility(visibility);
      // D-53: visible photos first (the same throttled UI report).
      visibilityRef.current = visibility;
      requestPhotos();
    },
    [publisher, requestPhotos],
  );
  // D-47: the semantic tier follows on-screen magnification, not raw zoom.
  useAnimatedReaction(
    () => frame.value.labelMagnification,
    (magnification) => {
      level.value = semanticLevel(magnification, level.value);
    },
  );
  // M3: the tier reaches text preparation through runOnJS, only on change.
  useAnimatedReaction(
    () => level.value,
    (tier, previous) => {
      if (tier !== previous) runOnJS(sendTier)(tier);
    },
  );
  // H4: visibility/initials eligibility, computed at most every
  // ORRERY_TEXT_ELIGIBILITY_INTERVAL_MS (a trailing timer catches the final
  // pose) and sent only when a key set changed.
  const textReport = useSharedValue({ at: -1e12, signature: "", timer: false });
  useAnimatedReaction(
    () => frame.value,
    () => {
      const state = textReport.value;
      if (state.timer) return;
      const run = () => {
        const latest = orreryTextEligibility(
          frame.value,
          ORRERY_INITIALS_MIN_RADIUS_PX,
        );
        const previous = textReport.value.signature;
        textReport.value = {
          at: Date.now(),
          signature: latest.signature,
          timer: false,
        };
        if (latest.signature !== previous)
          runOnJS(sendVisibility)(latest.visibility);
      };
      const wait = state.at + ORRERY_TEXT_ELIGIBILITY_INTERVAL_MS - Date.now();
      if (wait > 0) {
        textReport.value = { ...state, timer: true };
        setTimeout(run, wait);
      } else run();
    },
  );
  const allocations = useDerivedValue(() => {
    const current = frame.value;
    // Only admitted labels are candidates (the spec carries plain measurements).
    const candidates = labelSpecs.value.measured.flatMap((label) => {
      const body = frameBodyByKey(current, label.id);
      return body?.visible && body.interactive
        ? [
            {
              ...label,
              x: body.x - label.width / 2,
              y: body.y + body.radius + ORRERY_LABEL_BODY_GAP,
              alternateY:
                body.y - body.radius - ORRERY_LABEL_BODY_GAP - label.height,
              opacity: body.opacity,
              // D-47 nearest-first within a priority class.
              depth: body.depth,
            },
          ]
        : [];
    });
    // C-M2: the docked card is no viewport obstacle, so labels avoid it here.
    const exclusions = labelExclusions(current.bodies, cardRect.value);
    return allocateLabels(
      candidates,
      semanticLevel(current.labelMagnification, level.value),
      current.viewport,
      exclusions,
    );
  });
  // D-52: label id → allocation (first per id, as `find` returned), once per
  // frame, so each label reads O(1) instead of scanning every allocation.
  const allocationIndex = useDerivedValue(() => {
    const index: Record<string, LabelAllocation> = {};
    const list = allocations.value;
    for (let i = 0; i < list.length; i++)
      if (index[list[i].id] === undefined) index[list[i].id] = list[i];
    return index;
  });
  const identities = useMemo<OrreryContactTarget[]>(
    () => [
      ...scene.systemSnapshot.members.map((member) => ({
        kind: "member" as const,
        id: member.id,
        uid: member.uid,
      })),
      ...(scene.systemSnapshot.resolvedSunIdentity
        ? [
            {
              ...scene.systemSnapshot.resolvedSunIdentity,
              kind: "contact-sun" as const,
            },
          ]
        : []),
    ],
    [scene],
  );
  // A primitive, so the north-tap worklet never captures the whole scene.
  const sceneExtent = scene.extent;
  const reorderExpectation = useMemo(
    () => ({
      system: scene.system,
      expectedFullOrderedIds: scene.systemSnapshot.completeContactedOrder,
      expectedSavedSunContactId: scene.systemSnapshot.savedSunContactId,
      expectedEligibleVisibleIds:
        scene.systemSnapshot.eligibleContactedVisibleIds,
      expectedContactIdentities: scene.systemSnapshot.contactIdentities,
    }),
    [scene],
  );
  const gesture = useMemo(
    () =>
      createOrreryGestures({
        pose,
        frame,
        camera,
        extent: cameraExtent(sceneExtent),
        send: onIntent,
        enabled: interactive,
        stop: camera.stop,
        coast: camera.coast,
        reorder: {
          drag: camera.reorder,
          expectation: reorderExpectation,
          generation: scene.generation,
          acknowledge: onReorderActivated,
          commit: onReorder,
          charge: camera.reorderCharge,
          flash: camera.reorderFlash,
          reduced: reducedMotion,
        },
        resolveTap: (current, x, y) => {
          "worklet";
          // D-60: a single body tap always focuses, so visible labels no
          // longer take part in tap resolution.
          return resolveSatelliteTap(
            current,
            x,
            y,
            identities,
            memberIdentities,
          );
        },
        onNorth: (x, y) => {
          "worklet";
          if (!hitPolaris(frame.value, sceneExtent, x, y)) return false;
          camera.recover(northTarget(pose.value));
          return true;
        },
      }),
    [
      pose,
      frame,
      camera,
      sceneExtent,
      onIntent,
      interactive,
      identities,
      memberIdentities,
      reorderExpectation,
      onReorder,
      onReorderActivated,
      scene.generation,
      reducedMotion,
    ],
  );
  const singleFocus = focusedIds.length === 1 ? focusedIds[0] : null;
  useAnimatedReaction(
    () =>
      singleFocus !== null &&
      camera.active.value === null &&
      focusEffectivelyOffscreen(frame.value, singleFocus),
    (lost, previous) => {
      if (lost && previous === false && onFocusLost) runOnJS(reportFocusLost)();
    },
  );
  useAnimatedReaction(
    () => {
      if (!focusedSatellite) return false;
      const key = bodyKey({
        id: -1,
        kind: "satellite",
        satelliteTarget: focusedSatellite,
      });
      const current = frame.value;
      // Keys are unique within a frame, so the indexed body is the one `find`
      // matched; a non-interactive body is treated as absent, as before.
      const indexed = frameBodyByKey(current, key);
      const body = indexed?.interactive ? indexed : undefined;
      if (!body) return true;
      const reach = body.hitRadius + 44;
      const rect = current.viewport.usable ?? {
        x: 0,
        y: 0,
        width: current.viewport.width,
        height: current.viewport.height,
      };
      return (
        body.x + reach < rect.x ||
        body.x - reach > rect.x + rect.width ||
        body.y + reach < rect.y ||
        body.y - reach > rect.y + rect.height
      );
    },
    (lost, previous) => {
      if (lost && previous !== true && onFocusLost) runOnJS(reportFocusLost)();
    },
  );
  return (
    <OrreryV2Canvas
      width={viewport.width}
      height={viewport.height}
      gesture={gesture}
      frame={frame}
      sky={skySpec}
      skyImage={skyImage}
      coverColor={colors.orrerySkyBase}
      ringSpecs={ringSpecs}
      plane={planeSpec}
      switchFx={switchFx}
      switchRoles={switchRoles}
      trailLook={trailLook}
      overlay={overlaySpec}
      reorder={camera.reorder}
      hold={holdFx}
      focus={focusDraw}
      occlusion={occlusion}
      bodies={bodySpecs}
      ackRecorded={ackRecorded}
      labels={labelSpecs}
      allocationIndex={allocationIndex}
      busy={busy}
      bakeRegistry={bakeRegistry}
      onBaseBaked={onBaseBaked}
    />
  );
}

/** 38.7-13 (C3-M2): the memoised renderer the screen mounts. */
export const OrreryWorld = memo(OrreryWorldInner);
