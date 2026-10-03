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
  // H2: beyond the horizon the marker hides; the accessible north control stays.
  const transform = useDerivedValue(() => {
    const point = polarisProjection(frame.value, extent);
    return [{ translateX: point?.x ?? 0 }, { translateY: point?.y ?? 0 }];
  });
  const opacity = useDerivedValue(() =>
    polarisProjection(frame.value, extent) ? 1 : 0,
  );
  return (
    <Group transform={transform} opacity={opacity}>
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
