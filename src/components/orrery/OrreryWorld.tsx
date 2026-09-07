/** ADR-077: keyed resources; one UI-thread world/projection frame for all layers. */
import { Group, type SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  runOnJS,
  runOnUI,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { getInitials, swatchIndex } from "@/components/avatar-initials";
import {
  type CameraCell,
  type CameraPose,
  type CameraViewport,
  type OrreryIntent,
  type ProjectedFrame,
  panCamera,
  tapIntent,
} from "@/logic/orrery-camera-logic";
import {
  type AnimatedFrame,
  beginWorldTransition,
  billboardPose,
  bodyKey,
  projectAnimatedFrame,
  sampleWorldTransition,
} from "@/logic/orrery-frame";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { resolveSunOccupant } from "@/logic/sun-occupant-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import type { ThemePalette } from "@/theme/theme-types";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { OrbitBody } from "./OrbitBody";
import { OrreryCanvas } from "./OrreryCanvas";
import { ProjectedOrbitRing } from "./ProjectedOrbitRing";
import { SunBody } from "./SunBody";

const PAN_MIN_DISTANCE = 10;
const WORLD_SETTLE_MS = 260;
/** This exact registration is driven in the real-SQL tracer through native mocks. */
export function createOrreryGestures({
  pose,
  frame,
  panStart,
  extent,
  send,
  stop,
}: {
  pose: CameraCell<CameraPose>;
  frame: CameraCell<ProjectedFrame>;
  panStart: CameraCell<CameraPose | null>;
  extent: number;
  send: (intent: OrreryIntent) => void;
  stop: () => void;
}) {
  const tap = Gesture.Tap()
    .maxDistance(8)
    .onEnd((event, success) => {
      "worklet";
      if (success)
        runOnJS(send)(tapIntent(frame.value, event.x, event.y, success));
    });
  const pan = Gesture.Pan()
    .minDistance(PAN_MIN_DISTANCE)
    .maxPointers(1)
    .onBegin(() => {
      "worklet";
      stop();
      panStart.value = pose.value;
    })
    .onUpdate((event) => {
      "worklet";
      if (panStart.value === null || event.numberOfPointers !== 1) return;
      pose.value = panCamera(
        panStart.value,
        event.translationX,
        event.translationY,
        extent,
        frame.value.viewport,
      );
    })
    .onEnd(() => {
      "worklet";
      // Camera movement is transient. Neither success nor failure owns a DAO.
      panStart.value = null;
    })
    .onFinalize(() => {
      "worklet";
      panStart.value = null;
    });
  return Gesture.Race(tap, pan);
}

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
    initials: getInitials(name),
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
}: {
  scene: OrrerySceneSnapshot;
  pose: SharedValue<CameraPose>;
  viewport: CameraViewport;
  colors: ThemePalette;
  fontProvider: SkTypefaceFontProvider | null;
  onIntent: (intent: OrreryIntent) => void;
  focusedIds: number[];
}) {
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
      if (transition.value.generation === scene.generation) return;
      const displayed = sampleWorldTransition(
        transition.value,
        reducedMotion.value ? 1 : progress.value,
      ).filter((body) => body.opacity > 0);
      cancelAnimation(progress);
      transition.value = beginWorldTransition(
        displayed,
        scene.world,
        scene.generation,
      );
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
  const panStart = useSharedValue<CameraPose | null>(null);
  const gesture = useMemo(
    () =>
      createOrreryGestures({
        pose,
        frame,
        panStart,
        extent: scene.extent,
        send: onIntent,
        stop: () => {
          "worklet";
          cancelAnimation(pose);
        },
      }),
    [pose, frame, panStart, scene.extent, onIntent],
  );
  const starColors = useMemo(
    () => [colors.textSecondary, colors.textPrimary, ...colors.starPalette],
    [colors],
  );
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
      </Group>
    </OrreryCanvas>
  );
}
