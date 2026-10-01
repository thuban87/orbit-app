/** ADR-077: keyed resources; one UI-thread world/projection frame for all layers. */
import {
  Group,
  Path,
  Skia,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWindowDimensions } from "react-native";
import {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
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
  billboardPose,
  bodyKey,
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
import { useLabFxStore } from "@/stores/orrery-labb-fx-store";
import type { ThemePalette } from "@/theme/theme-types";
import { LabBRenderer, type LabTapStamp } from "./labb/LabBRenderer";
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
/**
 * ORRERY LAB B (switch-stall fix): stable empty defaults. A fresh `[]` / `{}`
 * default changes identity on every render, which re-created every worklet
 * that captures it (a Reanimated mapper restart on the UI thread per render).
 */
const NO_IDS: number[] = [];
const NO_RELATIONS: Readonly<Record<number, string>> = {};
const NO_SATELLITES: readonly OrrerySatellite[] = [];
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
  frame,
  colors,
  fontProvider,
  focused,
}: {
  resource: OrreryBodyResource;
  frame: SharedValue<AnimatedFrame>;
  colors: ThemePalette;
  fontProvider: SkTypefaceFontProvider | null;
  focused: boolean;
}) {
  const { body, scene, key } = resource;
  const projection = useDerivedValue(() =>
    billboardPose(frame.value, key, body.radius),
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
  // Each branch returns exactly ONE actual body root Group; no parent wrapper.
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
  clusterIds: clusterIdsProp,
  focusedRelationById = NO_RELATIONS,
  interactive = true,
  camera,
  onFocusLost,
  onReorder,
  onReorderActivated,
  satellites = NO_SATELLITES,
  focusedSatellite,
  switchRuntime,
  themePackage,
  themeMode,
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
  /** ORRERY LAB B: theme package × mode, for the lab effect profile. */
  themePackage?: string;
  themeMode?: string;
}) {
  const { fontScale } = useWindowDimensions();
  // ORRERY LAB B (switch-stall fix): callers pass a fresh `[]` per render; key
  // the cluster list by content so label preparation and the worklets that
  // capture it are not rebuilt on every parent render.
  const clusterSource =
    clusterIdsProp ?? (focusedIds.length > 1 ? focusedIds : NO_IDS);
  const clusterKey = clusterSource.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: content-keyed by clusterKey
  const clusterIds = useMemo(() => clusterSource, [clusterKey]);
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
  // ORRERY LAB B (C-20): resolveTap stamps the tap for the lab feedback layer.
  const fxTap = useSharedValue<LabTapStamp | null>(null);
  const labRenderer = useLabFxStore((s) => s.renderer);
  // ORRERY LAB B (WP-2.1 perf): the lab renderer draws rings from the plane
  // homography and never reads `ringPath`, so the frame worklet projects it
  // only for the legacy renderer / the path-rebuild A/B, and otherwise only for
  // a held reorder body (the ghost). -1 = every body, 0 = only the held body.
  const ringPathsRebuild = useLabFxStore(
    (s) => s.flags?.ringsPathRebuild ?? false,
  );
  const ringPathMode = useSharedValue(-1);
  useEffect(() => {
    ringPathMode.value = labRenderer === "lab" && !ringPathsRebuild ? 0 : -1;
  }, [ringPathMode, labRenderer, ringPathsRebuild]);
  // Capture only the producer's input; the controller also contains its published output.
  const reorder = camera.reorder;
  // ORRERY LAB B (switch-stall fix, docs/…/research/SWITCH-STALL-INVESTIGATION.md):
  // the frame worklet captures ONLY shared values and small, identity-stable
  // data. It used to capture `switchRuntime` (a new object on every
  // OrreryScreen render, carrying `resources` → N × the whole scene) and
  // `scene`: every parent render restarted this mapper, and each restart
  // deserialised that graph on the UI thread and walked it for shared values
  // (≈0.6–0.75 s of main thread per restart on the emulator, ×5–6 per switch).
  const switchTransition = switchRuntime.transition;
  const switchProgress = switchRuntime.progress;
  const switchCameraFrom = switchRuntime.cameraFrom;
  const switchCameraTo = switchRuntime.cameraTo;
  const sceneGeneration = scene.generation;
  const sceneExtent = scene.extent;
  const sceneMembers = scene.systemSnapshot.members;
  const memberIdentities = useMemo(
    () => sceneMembers.map((m) => ({ id: m.id, uid: m.uid })),
    [sceneMembers],
  );
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
      ringPathMode.value < 0 ? true : held?.active ? held.id : false,
    );
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
      const body = current.bodies.find((b) => bodyKey(b) === label.id);
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
        extent: cameraExtent(scene.extent),
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
          const intent = resolveSatelliteTap(
            current,
            x,
            y,
            identities,
            allocations.value.map((label) => label.id),
            members,
          );
          // ORRERY LAB B (C-20): side-stamp only; the intent is unchanged.
          fxTap.value = {
            x,
            y,
            seq: (fxTap.value?.seq ?? 0) + 1,
            kind: intent.kind,
          };
          return intent;
        },
        onNorth: (x, y) => {
          "worklet";
          if (!hitPolaris(frame.value, sceneExtent, x, y)) return false;
          camera.recover(northTarget(pose.value));
          // ORRERY LAB B (C-20, WP-2.2): side-stamp the north tap for the
          // Polaris flare; the recovery above is unchanged.
          fxTap.value = {
            x,
            y,
            seq: (fxTap.value?.seq ?? 0) + 1,
            kind: "north",
          };
          return true;
        },
      }),
    [
      pose,
      frame,
      camera,
      scene.extent,
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
      fxTap,
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
      const body = current.bodies.find(
        (b) => bodyKey(b) === key && b.interactive,
      );
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
  const ghost = (
    <ReorderGhost frame={frame} drag={camera.reorder} color={colors.accent} />
  );
  // ORRERY LAB B: renderer A/B switch. The model half above is shared; only one
  // renderer (one canvas, one clock) is ever mounted.
  if (labRenderer === "lab") {
    return (
      <LabBRenderer
        frame={frame}
        allocations={allocations}
        level={level}
        reorder={camera.reorder}
        pose={pose}
        switchRuntime={switchRuntime}
        fxTap={fxTap}
        cameraActive={camera.active}
        scene={scene}
        resources={resources}
        colors={colors}
        themePackage={themePackage}
        themeMode={themeMode}
        fontProvider={fontProvider}
        labels={labels}
        focusedIds={focusedIds}
        focusedSatellite={focusedSatellite}
        satellites={satellites}
        viewport={viewport}
        gesture={gesture}
        ghost={ghost}
      />
    );
  }
  return (
    <OrreryCanvas
      width={viewport.width}
      height={viewport.height}
      background={colors.background}
      starColors={starColors}
      gesture={gesture}
    >
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
                  resource.scene.contacts.find((c) => c.id === resource.body.id)
                    ?.status ?? null,
                  colors,
                )}
              />
            ))}
        </Group>
        <Polaris frame={frame} extent={scene.extent} colors={colors} />
        {ghost}
        {/* RNRecorder flushes sorting at every non-Group command. Keep this run contiguous. */}
        <Group>
          {resources.map((resource) => (
            <ProjectedBody
              key={resource.key}
              resource={resource}
              frame={frame}
              colors={colors}
              fontProvider={fontProvider}
              focused={focusedIds.includes(resource.body.id)}
            />
          ))}
          {satellites.map((row) => {
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
                frame={frame}
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
    </OrreryCanvas>
  );
}
