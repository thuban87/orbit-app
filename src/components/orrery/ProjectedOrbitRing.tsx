/** Rails are a separate layer behind the consecutive native body Group batch. */
import { DashPathEffect, Path, Skia } from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
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
  const path = useDerivedValue(() => {
    const points =
      frame.value.bodies.find((b) => bodyKey(b) === identity)?.ringPath ?? [];
    const result = Skia.Path.Make();
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
      (frame.value.bodies.find((b) => bodyKey(b) === identity)?.opacity ?? 0) *
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
