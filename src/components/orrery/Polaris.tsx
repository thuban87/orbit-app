/** ADR-077: canonical world north, projected from the same frame as bodies/hits. */
import { Circle, Group, Path } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import type { CameraCell, ProjectedFrame } from "@/logic/orrery-camera-logic";
import {
  POLARIS_RADIUS,
  polarisProjection,
} from "@/logic/orrery-recovery-logic";
import type { ThemePalette } from "@/theme/theme-types";

export function Polaris({
  frame,
  extent,
  colors,
}: {
  frame: Readonly<CameraCell<ProjectedFrame>>;
  extent: number;
  colors: ThemePalette;
}) {
  const transform = useDerivedValue(() => {
    const point = polarisProjection(frame.value, extent);
    return [{ translateX: point.x }, { translateY: point.y }];
  });
  return (
    <Group transform={transform}>
      <Circle
        cx={0}
        cy={0}
        r={POLARIS_RADIUS * 1.5}
        color={colors.starPalette[0] ?? colors.textPrimary}
        opacity={0.25}
      />
      <Path
        path="M 0 -10 L 2 -2 L 10 0 L 2 2 L 0 10 L -2 2 L -10 0 L -2 -2 Z"
        color={colors.textPrimary}
      />
      <Circle cx={0} cy={0} r={2} color={colors.textPrimary} />
    </Group>
  );
}
