/**
 * ORRERY LAB B — L1 orbit-ring slot (instrument register).
 *
 * WP-1.0: parity port of `ProjectedOrbitRing` (status colour, width, solid /
 * dashed / faded / faint-trace styles), resolved in O(1) through `frameIndex`.
 * WP-1.3 adds depth-gradient, flow, progress wake and drift tethers here.
 * One keyed `LabRing` per contact resource (per-ring opacity / trim are needed
 * for switching in WP-2.1).
 */
import { DashPathEffect, Group, Path, Skia } from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import {
  type OrreryRingStyle,
  orreryRingStyle,
} from "@/logic/orrery-ring-logic";
import type { ThemePalette } from "@/theme/theme-types";
import type { OrreryBodyResource } from "../use-orrery-switch-runtime";
import { bodyAt, type FrameIndex } from "./labb-frame-index";

const DASH = [6, 6];
const FADED_ALPHA = 0.7;
const FAINT_ALPHA = 0.3;

function styleAlpha(style: OrreryRingStyle): number {
  return style.strokeStyle === "faded"
    ? FADED_ALPHA
    : style.strokeStyle === "faintTrace"
      ? FAINT_ALPHA
      : style.opacity;
}

export function LabRing({
  identity,
  frame,
  frameIndex,
  style,
}: {
  identity: string;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  style: OrreryRingStyle;
}) {
  const alpha = styleAlpha(style);
  const path = useDerivedValue(() => {
    const result = Skia.Path.Make();
    const points =
      bodyAt(frame.value, frameIndex.value, identity)?.ringPath ?? [];
    if (points.length) {
      result.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++)
        result.lineTo(points[i].x, points[i].y);
      result.close();
    }
    return result;
  });
  const opacity = useDerivedValue(
    () =>
      (bodyAt(frame.value, frameIndex.value, identity)?.opacity ?? 0) * alpha,
  );
  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={style.width}
      color={style.color}
      opacity={opacity}
    >
      {style.strokeStyle === "dashed" || style.strokeStyle === "faintTrace" ? (
        <DashPathEffect intervals={DASH} phase={0} />
      ) : null}
    </Path>
  );
}

export function LabRings({
  resources,
  frame,
  frameIndex,
  colors,
}: {
  resources: readonly OrreryBodyResource[];
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  colors: ThemePalette;
}) {
  return (
    <Group>
      {resources
        .filter((r) => r.body.kind === "contact")
        .map((resource) => (
          <LabRing
            key={resource.key}
            identity={resource.key}
            frame={frame}
            frameIndex={frameIndex}
            style={orreryRingStyle(
              resource.scene.contacts.find((c) => c.id === resource.body.id)
                ?.status ?? null,
              colors,
            )}
          />
        ))}
    </Group>
  );
}
