/** Rails are a separate layer behind the consecutive native body Group batch. */
import { DashPathEffect, Path, Skia } from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import { traceRingPath } from "@/logic/orrery-camera-logic";
import { type AnimatedFrame, frameBodyByKey } from "@/logic/orrery-frame";
import type { OrreryRingStyle } from "@/logic/orrery-ring-logic";

export function ProjectedOrbitRing({
  identity,
  frame,
  style,
}: {
  identity: string;
  frame: SharedValue<AnimatedFrame>;
  style: OrreryRingStyle;
}) {
  // D-52: O(1) keyed lookups. Two direct lookups are cheaper than a third
  // per-ring mapper feeding both derived values.
  // H2: samples beyond the horizon are omitted; traceRingPath lifts the pen at
  // a gap and never closes an incomplete ring.
  const path = useDerivedValue(() => {
    const body = frameBodyByKey(frame.value, identity);
    const result = Skia.Path.Make();
    if (body) traceRingPath(result, body);
    return result;
  });
  const opacity = useDerivedValue(
    () =>
      (frameBodyByKey(frame.value, identity)?.opacity ?? 0) *
      (style.strokeStyle === "faded"
        ? 0.7
        : style.strokeStyle === "faintTrace"
          ? 0.3
          : style.opacity),
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
        <DashPathEffect intervals={[6, 6]} phase={0} />
      ) : null}
    </Path>
  );
}
