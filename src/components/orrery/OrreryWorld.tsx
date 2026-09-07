/** Keyed resources + UI-thread projection; drawing and touch share one frame. */
import {
  Circle,
  DashPathEffect,
  Group,
  Paragraph,
  Path,
  Skia,
  type SkTypefaceFontProvider,
  TextAlign,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  runOnJS,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { getInitials, swatchIndex } from "@/components/avatar-initials";
import { OrbitBody } from "@/components/orrery/OrbitBody";
import { OrreryCanvas } from "@/components/orrery/OrreryCanvas";
import { SunBody } from "@/components/orrery/SunBody";
import {
  type CameraCell,
  type CameraPose,
  type CameraViewport,
  IDENTITY_ZOOM,
  type OrreryIntent,
  type ProjectedFrame,
  panCamera,
  projectFrame,
  tapIntent,
} from "@/logic/orrery-camera-logic";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { resolveSunOccupant } from "@/logic/sun-occupant-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import type { ThemePalette } from "@/theme/theme-types";

const PAN_MIN_DISTANCE = 10;
const NAME_WIDTH = 180;
const NAME_SIZE = 14;

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

interface ResourceProps {
  index: number;
  scene: OrrerySceneSnapshot;
  frame: SharedValue<ProjectedFrame>;
  colors: ThemePalette;
  fontProvider: SkTypefaceFontProvider | null;
  focused: boolean;
}

function ProjectedContact({
  index,
  scene,
  frame,
  colors,
  fontProvider,
  focused,
}: ResourceProps) {
  const contact = scene.contacts[index];
  // Explicit All/Not neutral members use the canonical border/body treatment.
  const style = orreryRingStyle(contact.status, colors);
  const worldRadius = scene.world[index].radius;
  const transform = useDerivedValue(() => {
    const body = frame.value.bodies[index];
    return [
      { translateX: body.x },
      { translateY: body.y },
      { scale: body.radius / worldRadius },
    ];
  });
  const ringPath = useDerivedValue(() => {
    const points = frame.value.bodies[index].ringPath;
    const path = Skia.Path.Make();
    if (points.length) {
      path.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++)
        path.lineTo(points[i].x, points[i].y);
      path.close();
    }
    return path;
  });
  const dashed =
    style.strokeStyle === "dashed" || style.strokeStyle === "faintTrace";
  return (
    <>
      <Path
        path={ringPath}
        style="stroke"
        strokeWidth={style.width}
        color={style.color}
        opacity={
          style.strokeStyle === "faded"
            ? 0.7
            : style.strokeStyle === "faintTrace"
              ? 0.3
              : style.opacity
        }
      >
        {dashed ? <DashPathEffect intervals={[6, 6]} phase={0} /> : null}
      </Path>
      <Group transform={transform}>
        {focused ? (
          <Circle
            cx={0}
            cy={0}
            r={worldRadius + 4}
            color={colors.accent}
            style="stroke"
            strokeWidth={2}
          />
        ) : null}
        <OrbitBody
          cx={0}
          cy={0}
          radius={worldRadius}
          photo={contact.photo}
          bodyFill={style.bodyFill}
          swatch={
            colors.avatarSwatches[
              swatchIndex(contact.name, colors.avatarSwatches.length)
            ]
          }
          swatchText={colors.avatarSwatchText}
          initials={getInitials(contact.name)}
          fontProvider={fontProvider}
        />
      </Group>
      <IdentityLabel
        index={index}
        name={contact.name}
        frame={frame}
        colors={colors}
        fontProvider={fontProvider}
      />
    </>
  );
}

function IdentityLabel({
  index,
  name,
  frame,
  colors,
  fontProvider,
}: Pick<ResourceProps, "index" | "frame" | "colors" | "fontProvider"> & {
  name: string;
}) {
  const paragraph = useMemo(() => {
    if (!fontProvider) return null;
    const result = Skia.ParagraphBuilder.Make(
      { textAlign: TextAlign.Center, maxLines: 1, ellipsis: "…" },
      fontProvider,
    )
      .pushStyle({
        color: Skia.Color(colors.textPrimary),
        backgroundColor: Skia.Color(colors.surface),
        fontFamilies: ["Inter"],
        fontSize: NAME_SIZE,
      })
      .addText(name)
      .pop()
      .build();
    result.layout(NAME_WIDTH);
    return result;
  }, [fontProvider, name, colors]);
  const x = useDerivedValue(() => frame.value.bodies[index].x - NAME_WIDTH / 2);
  const y = useDerivedValue(
    () => frame.value.bodies[index].y + frame.value.bodies[index].radius + 8,
  );
  const opacity = useDerivedValue(() =>
    frame.value.pose.zoom >= IDENTITY_ZOOM ? 1 : 0,
  );
  return paragraph ? (
    <Group opacity={opacity}>
      <Paragraph paragraph={paragraph} x={x} y={y} width={NAME_WIDTH} />
    </Group>
  ) : null;
}

function ProjectedSun({
  scene,
  frame,
  colors,
  fontProvider,
  focused,
}: Omit<ResourceProps, "index">) {
  const index = scene.world.length - 1;
  const resolved = resolveSunOccupant({
    ...scene.sun,
    starPalette: colors.starPalette,
    colors,
  });
  const name =
    resolved.kind === "self" ? scene.sun.selfName : scene.sun.sunContactName;
  const transform = useDerivedValue(() => {
    const body = frame.value.bodies[index];
    return [
      { translateX: body.x },
      { translateY: body.y },
      { scale: body.radius / 30 },
    ];
  });
  return (
    <>
      <Group transform={transform}>
        {focused ? (
          <Circle
            cx={0}
            cy={0}
            r={36}
            color={colors.accent}
            style="stroke"
            strokeWidth={2}
          />
        ) : null}
        <SunBody
          cx={0}
          cy={0}
          radius={30}
          glowRadius={54}
          photo={resolved.photo}
          glowColor={resolved.glowColor}
          swatch={
            colors.avatarSwatches[
              swatchIndex(name, colors.avatarSwatches.length)
            ]
          }
          swatchText={colors.avatarSwatchText}
          initials={getInitials(name)}
          fontProvider={fontProvider}
        />
      </Group>
      {resolved.kind === "contact" ? (
        <IdentityLabel
          index={index}
          name={name}
          frame={frame}
          colors={colors}
          fontProvider={fontProvider}
        />
      ) : null}
    </>
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
  const frame = useDerivedValue(() =>
    projectFrame(scene.world, pose.value, viewport, scene.generation),
  );
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
      {scene.contacts.map((contact, index) => (
        <ProjectedContact
          key={contact.id}
          index={index}
          scene={scene}
          frame={frame}
          colors={colors}
          fontProvider={fontProvider}
          focused={focusedIds.includes(contact.id)}
        />
      ))}
      <ProjectedSun
        scene={scene}
        frame={frame}
        colors={colors}
        fontProvider={fontProvider}
        focused={focusedIds.includes(scene.world[scene.world.length - 1].id)}
      />
    </OrreryCanvas>
  );
}
