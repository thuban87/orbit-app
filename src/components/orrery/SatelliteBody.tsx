import { Circle, Group, Skia } from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import { type BillboardMap, billboardFromMap } from "@/logic/orrery-frame";
import type { ThemePalette } from "@/theme/theme-types";
import {
  BodyLightOverlay,
  type DeepFieldBodyContext,
} from "./lab/BodyOverlays";
import { moonVisualScale } from "./lab/deep-field-math";

/** One comparable depth Group in the world's contiguous native body batch. */
export function SatelliteBody({
  identity,
  billboards,
  colors,
  focused,
  deepField,
}: {
  identity: string;
  /** Per-frame billboard map (OrreryWorld), not the whole frame. */
  billboards: SharedValue<BillboardMap>;
  colors: ThemePalette;
  focused: boolean;
  /** ORRERY LAB A: lit-moon rendering (absent → legacy flat dot). */
  deepField?: DeepFieldBodyContext;
}) {
  const lab = !!deepField;
  const projected = useDerivedValue(() =>
    billboardFromMap(billboards.value, identity, 1),
  );
  const transform = useDerivedValue(() => [
    { translateX: projected.value.x },
    { translateY: projected.value.y },
    {
      scale:
        projected.value.scale *
        (lab && projected.value.opacity > 0
          ? moonVisualScale(projected.value.scale)
          : 1),
    },
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
      {deepField ? (
        // A small lit moon: terminator toward the sun + thin atmosphere.
        <BodyLightOverlay
          radius={1}
          lightKey={identity}
          rimColor={colors.textSecondary}
          projection={projected}
          context={deepField}
        />
      ) : null}
      {/* ORRERY LAB A: the focus reticle is FocusReticleLayer (pass 3). */}
      {focused && deepField ? null : focused ? (
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
