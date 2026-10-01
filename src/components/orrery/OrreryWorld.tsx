/** ADR-077: keyed resources; one UI-thread world/projection frame for all layers. */
import {
  Group,
  Path,
  type SkImage,
  Skia,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWindowDimensions } from "react-native";
import {
  ReduceMotion,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { swatchIndex } from "@/components/avatar-initials";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
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
  type BillboardMap,
  billboardFromMap,
  billboardMap,
  bodyKey,
  frameBody,
  projectAnimatedFrame,
} from "@/logic/orrery-frame";
import {
  allocateLabels,
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
  type ReorderDrag,
  type ReorderIntent,
} from "@/logic/orrery-reorder-logic";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import {
  deriveSatelliteBodies,
  resolveSatelliteTap,
} from "@/logic/orrery-satellite-logic";
import { sampleSwitchChoreography } from "@/logic/orrery-switch-choreography";
import { resolveSunOccupant } from "@/logic/sun-occupant-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import type { ThemePalette } from "@/theme/theme-types";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { FOCUS_FADE_MS, SPEC_FADE_WINDOW_MS } from "./lab/deep-field-config";
import { resolveDeepFieldInk, tokenInk } from "./lab/deep-field-ink";
import {
  type BodyLightMap,
  computeBodyLight,
  computeSwitchFx,
  FOCUS_NONE,
  type FocusState,
} from "./lab/deep-field-math";
import { useDeepFieldEnabled } from "./lab/deep-field-mode";
import { LabScene } from "./lab/LabScene";
import type { LabBodySpec, LabLabelSpec, LabSceneInks } from "./lab/scene-draw";
import {
  buildBodySpecs,
  type ParagraphCache,
  resourcePhotoPath,
} from "./lab/scene-specs";
import { LabPhotoSlot, useLabPhotoCustody } from "./lab/use-lab-photos";
import type { PlaneRing } from "./lab/world-plane";
import { OrbitBody } from "./OrbitBody";
import { OrreryCanvas } from "./OrreryCanvas";
import { OrreryLabel, prepareOrreryText } from "./OrreryLabel";
import { Polaris } from "./Polaris";
import { ProjectedOrbitRing } from "./ProjectedOrbitRing";
import { SatelliteBody } from "./SatelliteBody";
import { SunBody } from "./SunBody";
import {
  type OrreryBodyResource,
  type OrrerySwitchRuntime,
  sampleOrrerySwitchCamera,
} from "./use-orrery-switch-runtime";

export { createOrreryGestures } from "./use-orrery-camera";

import {
  createOrreryGestures,
  type OrreryCameraController,
} from "./use-orrery-camera";

const LABEL_MAX_WIDTH = 200;
/** Stable default: a fresh `[]` per render would restart every mapper that captures it. */
const NO_SATELLITES: readonly OrrerySatellite[] = [];
const NO_IDS: number[] = [];
const NO_RELATIONS: Readonly<Record<number, string>> = {};
const LABEL_BODY_GAP = 8;

function ReorderGhost({
  frame,
  drag,
  color,
}: {
  frame: SharedValue<AnimatedFrame>;
  drag: SharedValue<ReorderDrag | null>;
  color: string;
}) {
  const path = useDerivedValue(() => {
    const result = Skia.Path.Make();
    const held = drag.value;
    if (!held?.active) return result;
    const body = frame.value.bodies.find((body) => body.id === held.id);
    const points = body?.ringPath ?? [];
    if (points.length) {
      result.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) result.lineTo(point.x, point.y);
      result.close();
    }
    if (body) result.addCircle(body.x, body.y, body.radius + 4);
    return result;
  });
  return <Path path={path} color={color} style="stroke" strokeWidth={2} />;
}
function ProjectedBody({
  resource,
  billboards,
  colors,
  fontProvider,
  focused,
}: {
  resource: OrreryBodyResource;
  /** Per-frame billboard map (perf pass), not the whole frame. */
  billboards: SharedValue<BillboardMap>;
  colors: ThemePalette;
  fontProvider: SkTypefaceFontProvider | null;
  focused: boolean;
}) {
  const { body, scene, key } = resource;
  const projection = useDerivedValue(() =>
    billboardFromMap(billboards.value, key, body.radius),
  );
  const resolved = resolveSunOccupant({
    ...scene.sun,
    starPalette: colors.starPalette,
    colors,
  });
  const contact = scene.contacts.find((item) => item.id === body.id);
  const name =
    body.kind === "sun"
      ? resolved.kind === "self"
        ? scene.sun.selfName
        : scene.sun.sunContactName
      : (contact?.name ?? "");
  const common = {
    cx: 0,
    cy: 0,
    radius: body.radius,
    projection,
    swatch:
      colors.avatarSwatches[swatchIndex(name, colors.avatarSwatches.length)],
    swatchText: colors.avatarSwatchText,
    initials: orreryInitials(name),
    fontProvider,
    focusColor: focused ? colors.accent : undefined,
  };
  // Legacy (non-Lab) renderer only: Lab A draws bodies imperatively
  // (lab/LabScene). Each branch returns exactly ONE actual body root Group.
  return body.kind === "sun" ? (
    <SunBody
      {...common}
      photo={resolved.photo}
      glowColor={resolved.glowColor}
      glowRadius={body.radius * 1.8}
    />
  ) : (
    <OrbitBody
      {...common}
      photo={contact?.photo ?? null}
      bodyFill={orreryRingStyle(contact?.status ?? null, colors).bodyFill}
    />
  );
}

export function OrreryWorld({
  scene,
  pose,
  viewport,
  colors,
  fontProvider,
  onIntent,
  focusedIds,
  clusterIds: clusterIdsProp = focusedIds.length > 1 ? focusedIds : NO_IDS,
  focusedRelationById: focusedRelationProp = NO_RELATIONS,
  interactive = true,
  camera,
  onFocusLost,
  onReorder,
  onReorderActivated,
  satellites: satelliteRows = NO_SATELLITES,
  focusedSatellite,
  switchRuntime,
}: {
  scene: OrrerySceneSnapshot;
  camera: OrreryCameraController;
  pose: SharedValue<CameraPose>;
  viewport: CameraViewport;
  colors: ThemePalette;
  fontProvider: SkTypefaceFontProvider | null;
  onIntent: (intent: OrreryIntent) => void;
  focusedIds: number[];
  clusterIds?: number[];
  /** Already-filtered, existing relation context only; supplied by focus/moon owner. */
  focusedRelationById?: Readonly<Record<number, string>>;
  interactive?: boolean;
  onFocusLost?: () => void;
  onReorder: (intent: ReorderIntent) => void;
  onReorderActivated: () => void;
  satellites?: readonly OrrerySatellite[];
  focusedSatellite?: OrrerySatelliteTarget | null;
  /** Screen-owned runtime survives this canvas consumer being unmounted. */
  switchRuntime: OrrerySwitchRuntime;
}) {
  const { fontScale } = useWindowDimensions();
  // An empty row list is the same as none: keep one identity so the satellite
  // flip during a System load does not re-record the Skia scene.
  const satellites = satelliteRows.length > 0 ? satelliteRows : NO_SATELLITES;
  // Moon COMPONENTS stay mounted while the same scene briefly withholds its
  // rows (a System load hides moons until the new scene is ready). The frame
  // still uses `satellites`, so withheld moons are absent from the frame:
  // their billboards draw nothing and they cannot be hit. Unmounting them
  // instead re-recorded the whole Skia scene mid-load (seconds of JS that
  // delayed the scene read itself on large Systems).
  const drawnSatellitesRef = useRef<{
    generation: number;
    rows: readonly OrrerySatellite[];
  }>({ generation: scene.generation, rows: NO_SATELLITES });
  if (
    satellites.length > 0 ||
    drawnSatellitesRef.current.generation !== scene.generation
  )
    drawnSatellitesRef.current = {
      generation: scene.generation,
      rows: satellites,
    };
  const drawnSatellites = drawnSatellitesRef.current.rows;
  // Same for the label inputs: callers pass fresh `[]`/`{}` per render, which
  // rebuilt every label paragraph and re-recorded the Skia scene each render.
  const clusterIds = clusterIdsProp.length > 0 ? clusterIdsProp : NO_IDS;
  const focusedRelationById =
    Object.keys(focusedRelationProp).length > 0
      ? focusedRelationProp
      : NO_RELATIONS;
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
  // Capture only the producer's input; the controller also contains its published output.
  const reorder = camera.reorder;
  // Perf pass: the frame worklet captures ONLY shared values and small plain
  // data. Capturing `switchRuntime`/`scene` shipped every keyed resource (each
  // holding a whole scene snapshot) to the UI runtime on every mapper (re)start
  // (~240k materialised nodes per restart on 40 bodies, restarted on every
  // screen render) — see lab-a _notes/PERF-PASS.md and orrery-frame-mapper.test.
  const switchTransition = switchRuntime.transition;
  const switchProgress = switchRuntime.progress;
  const switchCameraFrom = switchRuntime.cameraFrom;
  const switchCameraTo = switchRuntime.cameraTo;
  const sceneGeneration = scene.generation;
  const memberIdentities = useMemo(
    () =>
      scene.systemSnapshot.members.map((member) => ({
        id: member.id,
        uid: member.uid,
      })),
    [scene.systemSnapshot.members],
  );
  // ORRERY LAB A: runtime A/B (experiment-only store; see lab/deep-field-mode).
  const deepFieldOn = useDeepFieldEnabled();
  // Camera perf pass: only the legacy renderer reads the frame's 128-point
  // ring polygons; the Lab renderer draws rings from world geometry.
  const ringPaths = !deepFieldOn;
  const frame = useDerivedValue(() => {
    const sampled = sampleSwitchChoreography(
      switchTransition.value,
      switchProgress.value,
    ).world;
    const sampledCamera =
      switchProgress.value >= 1
        ? pose.value
        : sampleOrrerySwitchCamera(
            switchCameraFrom.value,
            switchCameraTo.value,
            switchProgress.value,
          );
    const held = reorder.value;
    const world = previewReorder(
      sampled,
      held?.generation === sceneGeneration ? held : null,
    );
    const moons = deriveSatelliteBodies(
      world,
      satellites,
      memberIdentities,
      true,
      semanticLevel(sampledCamera.zoom, level.value),
    );
    const completeWorld = [...world, ...moons];
    return projectAnimatedFrame(
      {
        generation: switchTransition.value.generation,
        from: completeWorld,
        to: completeWorld,
      },
      1,
      sampledCamera,
      viewport,
      ringPaths,
    );
  });
  // Body/moon billboards read one small per-frame map (perf pass).
  const billboards = useDerivedValue(() => billboardMap(frame.value));
  // Conventional focus positioning consumes this same interpolated frame.
  useAnimatedReaction(
    () => frame.value,
    (value) => {
      camera.frame.value = value;
    },
  );
  // ── ORRERY LAB A: read-only presentation values derived FROM the frame and
  // the switch runtime (separate mappers: the frame worklet's closure is
  // not widened — see orrery-frame-mapper.test).
  const deepInk = useMemo(() => resolveDeepFieldInk(colors), [colors]);
  const reducedMotion = useReducedMotionShared();
  const switchFx = useDerivedValue(() =>
    computeSwitchFx(
      switchTransition.value,
      switchProgress.value,
      reducedMotion.value,
    ),
  );
  const lightExtent = scene.extent;
  const bodyLight = useDerivedValue<BodyLightMap>(() =>
    computeBodyLight(frame.value, lightExtent),
  );
  // ORRERY LAB A (pass 3): focus as UI-thread data. Written in THIS render
  // (a shared-value write is an async hand-off, never a sync read), so the
  // reticle, ring emphasis and body dim land with the focus instead of after
  // the focus commit's full Skia re-record (seconds in debug native). The
  // emphasis fades on the UI thread (instant under reduced motion).
  const focusState = useSharedValue<FocusState>(FOCUS_NONE);
  const focusMix = useSharedValue(0);
  const focusWritten = useRef<{ signature: string; generation: number }>({
    signature: "[[],null]",
    generation: 0,
  });
  const focusSignature = JSON.stringify([focusedIds, focusedSatellite ?? null]);
  if (focusWritten.current.signature !== focusSignature) {
    const generation = focusWritten.current.generation + 1;
    focusWritten.current = { signature: focusSignature, generation };
    const keys: Record<string, boolean> = {};
    const targets: string[] = [];
    for (const id of focusedIds) {
      keys[`contact:${id}`] = true;
      keys[`sun:${id}`] = true;
      targets.push(`contact:${id}`, `sun:${id}`);
    }
    if (focusedSatellite)
      targets.push(
        bodyKey({
          id: -1,
          kind: "satellite",
          satelliteTarget: focusedSatellite,
        }),
      );
    focusState.value = { keys, targets, generation };
  }
  useAnimatedReaction(
    () => focusState.value,
    (state, previous) => {
      if (previous !== null && state.generation === previous.generation) return;
      const target = Object.keys(state.keys).length > 0 ? 1 : 0;
      focusMix.value =
        previous === null || reducedMotion.value
          ? target
          : withTiming(target, { duration: FOCUS_FADE_MS });
    },
  );
  const labInks = useMemo<LabSceneInks>(
    () => ({
      surface: tokenInk(colors.surface),
      textPrimary: tokenInk(colors.textPrimary),
      textSecondary: tokenInk(colors.textSecondary),
      accent: tokenInk(colors.accent),
      polarisHalo: tokenInk(colors.starPalette[0] ?? colors.textPrimary),
    }),
    [colors],
  );
  const planeRings = useMemo<PlaneRing[]>(
    () =>
      resources
        .filter((r) => r.body.kind === "contact")
        .map((resource) => {
          const status =
            resource.scene.contacts.find((c) => c.id === resource.body.id)
              ?.status ?? null;
          const style = orreryRingStyle(status, colors);
          return {
            key: resource.key,
            color: tokenInk(style.color),
            width: style.width,
            strokeStyle: style.strokeStyle,
            opacity: style.opacity,
            progress: status !== null,
          };
        }),
    [resources, colors],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const starColors = useMemo(
    () => [colors.textSecondary, colors.textPrimary, ...colors.starPalette],
    [colors],
  );
  const labels = useMemo(
    () =>
      scene.world.flatMap((body) => {
        if (body.id === 0) return [];
        const member = scene.systemSnapshot.members.find(
          (c) => c.id === body.id,
        );
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
        const width = Math.min(LABEL_MAX_WIDTH * fontScale, viewport.width);
        const text = prepareOrreryText(
          name,
          "label",
          fontScale,
          width,
          fontProvider,
          colors,
        );
        if (!text) return [];
        return [
          {
            id: bodyKey(body),
            name,
            text,
            context: context
              ? prepareOrreryText(
                  context,
                  "caption",
                  fontScale,
                  width,
                  fontProvider,
                  colors,
                )
              : null,
            focused,
            cluster: clusterIds.includes(body.id),
            favorite: member?.favourite_rank != null,
            // ORRERY LAB A: plate status tick (ring hue; neutral → secondary).
            tick:
              member?.status != null
                ? orreryRingStyle(member.status, colors).color
                : colors.textSecondary,
          },
        ];
      }),
    [
      scene,
      colors,
      fontProvider,
      fontScale,
      viewport.width,
      focusedIds,
      clusterIds,
      focusedRelationById,
    ],
  );
  // Share only plain measured data; native paragraph/font resources stay off worklets.
  const measured = useMemo(
    () =>
      labels.map((label) => ({
        id: label.id,
        name: label.name,
        width: label.text.width,
        height: label.text.height,
        context: label.context?.text,
        contextWidth: label.context?.width,
        contextHeight: label.context?.height,
        focused: label.focused,
        cluster: label.cluster,
        favorite: label.favorite,
      })),
    [labels],
  );
  useAnimatedReaction(
    () => frame.value.pose.zoom,
    (zoom) => {
      level.value = semanticLevel(zoom, level.value);
    },
  );
  const allocations = useDerivedValue(() => {
    const current = frame.value;
    const candidates = measured.flatMap((label) => {
      const body = frameBody(current, label.id);
      return body?.visible && body.interactive
        ? [
            {
              ...label,
              x: body.x - label.width / 2,
              y: body.y + body.radius + LABEL_BODY_GAP,
              alternateY: body.y - body.radius - LABEL_BODY_GAP - label.height,
              opacity: body.opacity,
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
      semanticLevel(current.pose.zoom, level.value),
      current.viewport,
      exclusions,
    );
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
  const members = memberIdentities;
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
          return resolveSatelliteTap(
            current,
            x,
            y,
            identities,
            allocations.value.map((label) => label.id),
            members,
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
      allocations,
      members,
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
      // First body with the key, and only if interactive (as the former
      // `find(key && interactive)`: keys are unique per frame).
      const keyed = frameBody(current, key);
      const body = keyed?.interactive
        ? keyed
        : current.bodies.find((b) => bodyKey(b) === key && b.interactive);
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
  // ── ORRERY LAB A (arch perf pass): the imperative scene renderer. ───────
  // Everything the Lab A canvas draws reaches the UI thread as shared
  // values written HERE (an async hand-off, never a sync read), so the Canvas
  // tree (lab/LabScene) never changes and RN-Skia never re-records it.
  const custody = useLabPhotoCustody();
  const enterAt = useRef(new Map<string, number>());
  const paragraphCache = useRef<{
    provider: SkTypefaceFontProvider | null;
    cache: ParagraphCache;
  }>({ provider: fontProvider, cache: new Map() });
  if (paragraphCache.current.provider !== fontProvider)
    paragraphCache.current = { provider: fontProvider, cache: new Map() };
  const bodySpecs = useMemo<LabBodySpec[]>(() => {
    if (!deepFieldOn) return [];
    const now = Date.now();
    const specs = buildBodySpecs({
      resources,
      satellites: drawnSatellites,
      colors,
      ink: deepInk,
      fontProvider,
      photos: custody.photos,
      enterAt: enterAt.current,
      paragraphs: paragraphCache.current.cache,
      now,
    });
    // A key that left and comes back fades in again (as a remounted body).
    const live = new Set(resources.map((r) => r.key));
    for (const key of [...enterAt.current.keys()])
      if (!live.has(key)) enterAt.current.delete(key);
    return specs;
  }, [
    deepFieldOn,
    resources,
    drawnSatellites,
    colors,
    deepInk,
    fontProvider,
    custody.photos,
  ]);
  const labelSpecs = useMemo<LabLabelSpec[]>(
    () =>
      deepFieldOn
        ? labels.map((label) => ({
            id: label.id,
            text: {
              paragraph: label.text.paragraph,
              width: label.text.width,
              height: label.text.height,
            },
            context: label.context
              ? {
                  paragraph: label.context.paragraph,
                  width: label.context.width,
                  height: label.context.height,
                }
              : null,
            tick: tokenInk(label.tick),
          }))
        : [],
    [deepFieldOn, labels],
  );
  const bodySpecsValue = useSharedValue<LabBodySpec[]>([]);
  const labelSpecsValue = useSharedValue<LabLabelSpec[]>([]);
  const ringSpecsValue = useSharedValue<PlaneRing[]>([]);
  const extentValue = useSharedValue(scene.extent);
  const fadeTick = useSharedValue(0);
  const written = useRef<{
    bodies: LabBodySpec[] | null;
    labels: LabLabelSpec[] | null;
    rings: PlaneRing[] | null;
    extent: number;
    fade: number;
  }>({
    bodies: null,
    labels: null,
    rings: null,
    extent: scene.extent,
    fade: 0,
  });
  if (deepFieldOn) {
    const w = written.current;
    if (w.bodies !== bodySpecs) {
      w.bodies = bodySpecs;
      bodySpecsValue.value = bodySpecs;
      // Keep re-recording through the mount / photo fades just written.
      w.fade += 1;
      fadeTick.value = withTiming(w.fade, {
        duration: SPEC_FADE_WINDOW_MS,
        reduceMotion: ReduceMotion.Never,
      });
    }
    if (w.labels !== labelSpecs) {
      w.labels = labelSpecs;
      labelSpecsValue.value = labelSpecs;
    }
    if (w.rings !== planeRings) {
      w.rings = planeRings;
      ringSpecsValue.value = planeRings;
    }
    if (w.extent !== scene.extent) {
      w.extent = scene.extent;
      extentValue.value = scene.extent;
    }
  }
  // Photo custody (lab/use-lab-photos): images retired by their slots are
  // disposed on the UI runtime only after the spec write above stopped
  // referencing them (runs after every commit, after the slots' cleanups).
  useEffect(() => {
    const inUse = new Set<SkImage>();
    for (const spec of written.current.bodies ?? [])
      if (spec.image) inUse.add(spec.image);
    custody.settle(inUse);
  });
  const labScene = useMemo(
    () =>
      deepFieldOn ? (
        <LabScene
          width={viewport.width}
          height={viewport.height}
          ink={deepInk}
          inks={labInks}
          starColors={starColors}
          fontProvider={fontProvider}
          hudText={colors.textSecondary}
          frame={frame}
          switchFx={switchFx}
          light={bodyLight}
          focus={focusState}
          focusMix={focusMix}
          allocations={allocations}
          drag={camera.reorder}
          bodies={bodySpecsValue}
          labels={labelSpecsValue}
          rings={ringSpecsValue}
          extent={extentValue}
          fadeTick={fadeTick}
        />
      ) : undefined,
    [
      deepFieldOn,
      viewport.width,
      viewport.height,
      deepInk,
      labInks,
      starColors,
      fontProvider,
      colors.textSecondary,
      frame,
      switchFx,
      bodyLight,
      focusState,
      focusMix,
      allocations,
      camera.reorder,
      bodySpecsValue,
      labelSpecsValue,
      ringSpecsValue,
      extentValue,
      fadeTick,
    ],
  );
  const photoSlots = deepFieldOn
    ? resources.map((resource) => (
        <LabPhotoSlot
          key={resource.key}
          bodyKey={resource.key}
          path={resourcePhotoPath(resource, colors)}
          report={custody.report}
          retire={custody.retire}
        />
      ))
    : null;
  // Legacy (non-Lab) renderer: the declarative tree, every layer memoised on
  // what it draws so a render that changes nothing drawn never re-records.
  const reorderDrag = camera.reorder;
  const world = useMemo(
    () =>
      deepFieldOn ? null : (
        <Group
          clip={{ x: 0, y: 0, width: viewport.width, height: viewport.height }}
        >
          <Group>
            {resources
              .filter((r) => r.body.kind === "contact")
              .map((resource) => (
                <ProjectedOrbitRing
                  key={resource.key}
                  identity={resource.key}
                  frame={frame}
                  style={orreryRingStyle(
                    resource.scene.contacts.find(
                      (c) => c.id === resource.body.id,
                    )?.status ?? null,
                    colors,
                  )}
                />
              ))}
          </Group>
          <Polaris frame={frame} extent={sceneExtent} colors={colors} />
          <ReorderGhost
            frame={frame}
            drag={reorderDrag}
            color={colors.accent}
          />
          {/* RNRecorder flushes sorting at every non-Group command. Keep this run contiguous. */}
          <Group>
            {resources.map((resource) => (
              <ProjectedBody
                key={resource.key}
                resource={resource}
                billboards={billboards}
                colors={colors}
                fontProvider={fontProvider}
                focused={focusedIds.includes(resource.body.id)}
              />
            ))}
            {drawnSatellites.map((row) => {
              const target = {
                kind: "satellite" as const,
                uid: row.uid,
                parentId: row.parentId,
                parentUid: row.parentUid,
              };
              const identity = bodyKey({
                kind: "satellite",
                id: -1,
                satelliteTarget: target,
              });
              return (
                <SatelliteBody
                  key={identity}
                  identity={identity}
                  billboards={billboards}
                  colors={colors}
                  focused={
                    focusedSatellite?.uid === row.uid &&
                    focusedSatellite.parentId === row.parentId &&
                    focusedSatellite.parentUid === row.parentUid
                  }
                />
              );
            })}
          </Group>
          {/* Labels/backplates are screen-space and never interrupt the body batch. */}
          <Group>
            {labels.map((label) => (
              <Group key={label.id}>
                <OrreryLabel
                  identity={label.id}
                  text={label.text}
                  allocations={allocations}
                  colors={colors}
                />
                {label.context ? (
                  <OrreryLabel
                    identity={label.id}
                    text={label.context}
                    allocations={allocations}
                    colors={colors}
                    context
                  />
                ) : null}
              </Group>
            ))}
          </Group>
        </Group>
      ),
    [
      viewport.width,
      viewport.height,
      deepFieldOn,
      frame,
      billboards,
      sceneExtent,
      resources,
      colors,
      reorderDrag,
      fontProvider,
      focusedIds,
      drawnSatellites,
      focusedSatellite,
      labels,
      allocations,
    ],
  );
  return (
    <>
      {photoSlots}
      <OrreryCanvas
        width={viewport.width}
        height={viewport.height}
        background={colors.background}
        starColors={starColors}
        gesture={gesture}
        backdrop={labScene}
      >
        {world}
      </OrreryCanvas>
    </>
  );
}
