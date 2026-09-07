/** ADR-077: keyed resources; one UI-thread world/projection frame for all layers. */
import { Group, type SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";
import {
  cancelAnimation,
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { swatchIndex } from "@/components/avatar-initials";
import type {
  CameraPose,
  CameraViewport,
  OrreryIntent,
} from "@/logic/orrery-camera-logic";
import {
  type AnimatedFrame,
  beginWorldTransition,
  billboardPose,
  bodyKey,
  projectAnimatedFrame,
  sampleWorldTransition,
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
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { resolveSunOccupant } from "@/logic/sun-occupant-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import type { ThemePalette } from "@/theme/theme-types";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { OrbitBody } from "./OrbitBody";
import { OrreryCanvas } from "./OrreryCanvas";
import { OrreryLabel, prepareOrreryText } from "./OrreryLabel";
import { Polaris } from "./Polaris";
import { ProjectedOrbitRing } from "./ProjectedOrbitRing";
import { SunBody } from "./SunBody";

export { createOrreryGestures } from "./use-orrery-camera";

import {
  createOrreryGestures,
  type OrreryCameraController,
} from "./use-orrery-camera";

const WORLD_SETTLE_MS = 260;
const LABEL_MAX_WIDTH = 200;
const LABEL_BODY_GAP = 8;
interface BodyResource {
  key: string;
  body: OrrerySceneSnapshot["world"][number];
  scene: OrrerySceneSnapshot;
}
/** Retain photo/font owners until their decorative exit completes. No per-frame React. */
function resourcesFor(scene: OrrerySceneSnapshot): BodyResource[] {
  return scene.world.map((body) => ({ key: bodyKey(body), body, scene }));
}
function mergeResources(
  previous: BodyResource[],
  scene: OrrerySceneSnapshot,
): BodyResource[] {
  const current = resourcesFor(scene);
  return [
    ...previous.map(
      (old) => current.find((item) => item.key === old.key) ?? old,
    ),
    ...current.filter((item) => !previous.some((old) => old.key === item.key)),
  ];
}

function ProjectedBody({
  resource,
  frame,
  colors,
  fontProvider,
  focused,
}: {
  resource: BodyResource;
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
  clusterIds = focusedIds.length > 1 ? focusedIds : [],
  focusedRelationById = {},
  interactive = true,
  camera,
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
}) {
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotionShared();
  const [registry, setRegistry] = useState(() => ({
    scene,
    resources: resourcesFor(scene),
  }));
  // React's guarded render adjustment publishes all new keyed resources together.
  // It runs only on a new immutable snapshot, never on camera/animation frames.
  if (registry.scene !== scene)
    setRegistry({
      scene,
      resources: mergeResources(registry.resources, scene),
    });
  const resources =
    registry.scene === scene
      ? registry.resources
      : mergeResources(registry.resources, scene);
  const transition = useSharedValue(
    beginWorldTransition([], scene.world, scene.generation),
  );
  const progress = useSharedValue(1);
  const frame = useDerivedValue(() =>
    projectAnimatedFrame(
      transition.value,
      reducedMotion.value ? 1 : progress.value,
      pose.value,
      viewport,
    ),
  );
  useEffect(() => {
    const world = scene.world;
    const generation = scene.generation;
    const complete = () =>
      setRegistry((current) =>
        current.scene === scene
          ? {
              scene,
              resources: current.resources.filter((resource) =>
                scene.world.some((body) => bodyKey(body) === resource.key),
              ),
            }
          : current,
      );
    runOnUI(() => {
      "worklet";
      if (transition.value.generation === generation) return;
      const displayed = sampleWorldTransition(
        transition.value,
        reducedMotion.value ? 1 : progress.value,
      ).filter((body) => body.opacity > 0);
      cancelAnimation(progress);
      transition.value = beginWorldTransition(displayed, world, generation);
      progress.value = 0;
      progress.value = withTiming(
        1,
        { duration: reducedMotion.value ? 100 : WORLD_SETTLE_MS },
        (finished) => {
          if (finished) runOnJS(complete)();
        },
      );
    })();
  }, [scene, transition, progress, reducedMotion]);
  useEffect(() => () => cancelAnimation(progress), [progress]);
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
        onNorth: (x, y) => {
          "worklet";
          if (!hitPolaris(frame.value, scene.extent, x, y)) return false;
          camera.recover(northTarget(pose.value));
          return true;
        },
      }),
    [pose, frame, camera, scene.extent, onIntent, interactive],
  );
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
  const level = useSharedValue<SemanticLevel>("overview");
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
