/**
 * ORRERY LAB B — L5 Polaris (WP-1.2).
 *
 * Same world position and hit semantics as the legacy `Polaris` (ADR-077:
 * `polarisProjection` from the same frame as bodies and hits; `hitPolaris`
 * untouched in OrreryWorld). The look becomes a distant bright star: a soft
 * BlurMask halo in `starPalette[0]`, long faint diffraction spikes, a crisp
 * 4-point cross and a core — all token colours. Static (no ambient motion),
 * so reduced motion needs nothing. The compass tick on the world rim is
 * instrument-register work (WP-1.3) and is not drawn here.
 */
import { BlurMask, Circle, Group, Path } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import type { CameraCell, ProjectedFrame } from "@/logic/orrery-camera-logic";
import {
  POLARIS_RADIUS,
  polarisProjection,
} from "@/logic/orrery-recovery-logic";
import type { LabFxProfile } from "@/theme/orrery-lab-fx";
import type { ThemePalette } from "@/theme/theme-types";

// --- Tunables -----------------------------------------------------------------
const HALO_R = POLARIS_RADIUS * 2.2;
const HALO_BLUR = 9;
const HALO_ALPHA = 0.45;
const SPIKE_LONG = 26;
const SPIKE_HALF_W = 0.9;
const SPIKE_BLUR = 1.4;
const SPIKE_ALPHA = 0.55;
const CROSS = 9;
const CORE_R = 2.2;

const LONG_SPIKES = `M 0 -${SPIKE_LONG} L ${SPIKE_HALF_W} 0 L 0 ${SPIKE_LONG} L -${SPIKE_HALF_W} 0 Z M -${SPIKE_LONG} 0 L 0 ${SPIKE_HALF_W} L ${SPIKE_LONG} 0 L 0 -${SPIKE_HALF_W} Z`;
const CROSS_PATH = `M 0 -${CROSS} L 1.6 -1.6 L ${CROSS} 0 L 1.6 1.6 L 0 ${CROSS} L -1.6 1.6 L -${CROSS} 0 L -1.6 -1.6 Z`;

export function LabPolaris({
  frame,
  extent,
  colors,
  profile,
}: {
  frame: Readonly<CameraCell<ProjectedFrame>>;
  extent: number;
  colors: ThemePalette;
  profile: LabFxProfile;
}) {
  const transform = useDerivedValue(() => {
    const point = polarisProjection(frame.value, extent);
    return [{ translateX: point.x }, { translateY: point.y }];
  });
  const glow = colors.starPalette[0] ?? colors.textPrimary;
  const additive = profile.blend === "additive";
  return (
    <Group transform={transform}>
      <Circle
        cx={0}
        cy={0}
        r={HALO_R}
        color={glow}
        opacity={HALO_ALPHA * (additive ? 1 : 0.6)}
        blendMode={additive ? "plus" : "srcOver"}
      >
        <BlurMask blur={HALO_BLUR} style="normal" />
      </Circle>
      <Path path={LONG_SPIKES} color={colors.textPrimary} opacity={SPIKE_ALPHA}>
        <BlurMask blur={SPIKE_BLUR} style="normal" />
      </Path>
      <Path path={CROSS_PATH} color={colors.textPrimary} />
      <Circle cx={0} cy={0} r={CORE_R} color={colors.textPrimary} />
    </Group>
  );
}
