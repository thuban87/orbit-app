import { Circle, Group, Skia } from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import { type AnimatedFrame, billboardPose } from "@/logic/orrery-frame";
import type { ThemePalette } from "@/theme/theme-types";

/** One comparable depth Group in the world's contiguous native body batch. */
export function SatelliteBody({
  identity,
  frame,
  colors,
  focused,
}: {
  identity: string;
  frame: SharedValue<AnimatedFrame>;
  colors: ThemePalette;
  focused: boolean;
}) {
  const projected = useDerivedValue(() =>
    billboardPose(frame.value, identity, 1),
  );
  const transform = useDerivedValue(() => [
    { translateX: projected.value.x },
    { translateY: projected.value.y },
    { scale: projected.value.scale },
  ]);
  const depth = useDerivedValue(() => projected.value.depth);
  const layer = useDerivedValue(() => {
    const paint = Skia.Paint();
    paint.setAlphaf(projected.value.opacity);
    return paint;
  });
  return (
    <Group transform={transform} zIndex={depth} layer={layer}>
      <Circle cx={0} cy={0} r={1} color={colors.textSecondary} />
      {focused ? (
        <Circle
          cx={0}
          cy={0}
          r={1.5}
          style="stroke"
          strokeWidth={0.3}
          color={colors.accent}
        />
      ) : null}
    </Group>
  );
}
