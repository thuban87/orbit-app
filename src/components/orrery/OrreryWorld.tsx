/** ADR-077: keyed resources; one UI-thread world/projection frame for all layers. */
import type { SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWindowDimensions } from "react-native";
import {
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import type {
  CameraPose,
  CameraViewport,
  OrreryIntent,
  OrrerySatelliteTarget,
} from "@/logic/orrery-camera-logic";
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
import { sampleSwitchChoreography } from "@/logic/orrery-switch-choreography";
import { systemRefId } from "@/logic/orrery-system-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import type {
  ResolvedMode,
  ThemePackage,
  ThemePalette,
} from "@/theme/theme-types";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
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
  orreryTextService,
} from "./resources/orrery-text-service";
import {
  type OrrerySwitchRuntime,
  sampleOrrerySwitchCamera,
} from "./use-orrery-switch-runtime";
import {
  type BakeRegistry,
  createBaseBakeOwner,
  disposeBakedSnapshots,
  EMPTY_BAKE_REGISTRY,
  teardownBakeRegistry,
} from "./v2/base-bake";
import {
  createSkyBakeOwner,
  type SkyBakeOwner,
  skyBakeKey,
  skyBakePixels,
  skySizeBucket,
} from "./v2/nebula-bake";
import { OrreryV2Canvas } from "./v2/OrreryV2Canvas";
import {
  bodyIdentity,
  bodyInitialsLayout,
  buildBodyLooks,
  buildFocusOutlines,
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
  EMPTY_SKY_SPEC,
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
  GRID_EXTENT,
  GRID_HALF_WIDTH_DP,
  GRID_OPACITY,
  GRID_RINGS,
  GRID_SPOKES,
  PULSE_BUDGET,
  PULSE_INTENSITY,
  RING_LOOKS,
  SKY_LOOKS,
  SKY_STAR_SEED,
  SKY_TWINKLE_GROUPS,
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
/** After the post-release UI round trip: the released text entries may go. */
function finishTextRelease(owner: string, epoch: number): void {
  orreryTextService.confirmReleased(owner, epoch);
  orreryTextService.clearUnheld();
}

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

/** The per-package noise seed of the baked nebula (stable across visits). */
const SKY_NEBULA_SEED = { galaxy: 7, standard: 11 } as const;

export function OrreryWorld({
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
}) {
  const { fontScale } = useWindowDimensions();
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
  const { transition, progress, cameraFrom, cameraTo } = switchRuntime;
  // D-49: the base is never baked during a switch, a gesture or a camera
  // motion (SharedValues only are captured).
  const { active: cameraActive, input: cameraInput } = camera;
  const busy = useDerivedValue(
    () =>
      progress.value < 1 ||
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
    const sampled = sampleSwitchChoreography(
      transition.value,
      progress.value,
    ).world;
    const sampledCamera =
      progress.value >= 1
        ? pose.value
        : sampleOrrerySwitchCamera(
            cameraFrom.value,
            cameraTo.value,
            progress.value,
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
    return projected;
  });
  // Conventional focus positioning consumes this same interpolated frame.
  useAnimatedReaction(
    () => frame.value,
    (value) => {
      camera.frame.value = value;
    },
  );
  useEffect(() => {
    mounted.current = true;
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
  const skySpec = useSharedValue<SkySpec>(EMPTY_SKY_SPEC);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the bucket's numbers, not the object
  useEffect(() => {
    skySpec.value = buildSkySpec({
      colors,
      mode: themeMode,
      themePackage,
      width: viewport.width,
      height: viewport.height,
      cover: skyBucket,
      hueIndex,
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by skyKey (package, mode, bucket); the nebula tokens are fixed per package × mode
  useEffect(() => {
    const texels = skyBakePixels(skyBucket);
    skyOwner.request({
      key: skyKey,
      nebula: colors.orreryNebula.map(tokenInk),
      strength: skyLook.nebulaStrength,
      width: texels.width,
      height: texels.height,
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
  // The overlay picture's inputs (Polaris, reorder and focus outlines). The
  // focus set is keyed by its ids, so an unrelated render writes nothing.
  const overlaySpec = useSharedValue<OverlaySpec>(EMPTY_OVERLAY_SPEC);
  const focusSignature = focusedIds.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by focusSignature (focusedIds' contents), not its identity
  const overlay = useMemo<OverlaySpec>(
    () => ({
      ink: buildOverlayInk(colors),
      extent: scene.extent,
      focus: buildFocusOutlines(resources, focusedIds),
    }),
    [colors, scene.extent, resources, focusSignature],
  );
  useEffect(() => {
    overlaySpec.value = overlay;
  }, [overlaySpec, overlay]);
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
  // moons (theme, resources, moons and the focused moon only). 38.7-10
  // (C-M3): the moons come from the satellite publisher's latest spec, read
  // on its JS signal, so a satellite load republishes the looks without a
  // React render.
  const satelliteFocusKey = focusedSatellite
    ? `${focusedSatellite.parentId}|${focusedSatellite.parentUid}|${focusedSatellite.uid}`
    : "";
  const bodyLooks = useMemo(
    () => buildBodyLooks(resources, colors),
    [resources, colors],
  );
  const lookInputs = useRef({ bodyLooks, colors, focusedSatellite });
  lookInputs.current = { bodyLooks, colors, focusedSatellite };
  const publishLooks = useCallback(() => {
    const latest = lookInputs.current;
    const rows = satelliteSource?.current().index.rows ?? [];
    specPublisher.setLooks(
      rows.length === 0
        ? latest.bodyLooks
        : [
            ...latest.bodyLooks,
            ...buildSatelliteLooks(
              rows,
              latest.colors,
              latest.focusedSatellite,
            ),
          ],
    );
  }, [specPublisher, satelliteSource]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by satelliteFocusKey (the focused moon's identity), not the target object; publishLooks reads lookInputs
  useEffect(() => {
    publishLooks();
  }, [publishLooks, bodyLooks, colors, satelliteFocusKey]);
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
      // can still record) is every retained object handed back, in reverse
      // creation order, and everything unheld cleared. Baked base snapshots
      // go back in that order too, then the offscreen surface (UI thread).
      const { owner } = publisher;
      const textEpoch = publisher.release();
      // 38.7-09: no new sky bake may publish from here on.
      skyOwner.detach();
      const ledgerEpoch = specPublisher.detach();
      const photos = photoEpoch.current;
      photoEpoch.current = null;
      if (photos !== null) orreryPhotoCache.release(owner);
      const finish = () => {
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
        if (photos !== null) orreryPhotoCache.confirmReleased(owner, photos);
        orreryPhotoCache.clearUnheld();
        if (textEpoch !== null) finishTextRelease(owner, textEpoch);
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
    const exclusions = current.bodies
      .filter((b) => b.visible)
      .map((b) => ({
        x: b.x - b.radius,
        y: b.y - b.radius,
        width: b.radius * 2,
        height: b.radius * 2,
      }));
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
      overlay={overlaySpec}
      reorder={camera.reorder}
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
