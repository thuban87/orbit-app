/**
 * ORRERY LAB B — L0 environment slot.
 *
 * WP-1.0: parity port of the legacy `OrreryCanvas` background (token `Fill` +
 * 44-star deterministic twinkling field). WP-1.1 replaces the body of this
 * component with the baked nebula + three-depth Atlas starfield; keep the props
 * contract (`frame` for parallax — read `frame.value.pose`, never `pose`).
 */
import { Circle, Fill, Group } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { ThemePalette } from "@/theme/theme-types";
import { useLabRenderContext } from "./labb-context";

// --- Tunables (parity with OrreryCanvas) --------------------------------------
const STAR_COUNT = 44;
const STAR_R_MIN = 0.6;
const STAR_R_MAX = 1.8;
const TWINKLE_MIN = 0.18;
const TWINKLE_MAX = 0.55;
const TWINKLE_SPEED = 0.0024;
const TWINKLE_STATIC = (TWINKLE_MIN + TWINKLE_MAX) / 2;

function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function LabEnvironment({
  width,
  height,
  colors,
  background,
}: {
  width: number;
  height: number;
  colors: ThemePalette;
  /** Sky fill: the lab `sky` role (a palette token). */
  background: string;
  /** Reserved for WP-1.1 parallax (read `frame.value.pose`). */
  frame?: SharedValue<AnimatedFrame>;
}) {
  const ctx = useLabRenderContext();
  const twinkle = useDerivedValue(() => {
    if (!ctx) return TWINKLE_STATIC;
    if (ctx.reducedMotion.value || !ctx.fxFlags.value.flags.twinkle)
      return TWINKLE_STATIC;
    const t = (Math.sin(ctx.ambient.value * TWINKLE_SPEED) + 1) / 2;
    return TWINKLE_MIN + (TWINKLE_MAX - TWINKLE_MIN) * t;
  });
  const stars = useMemo(() => {
    const tones = [
      colors.textSecondary,
      colors.textPrimary,
      ...colors.starPalette,
    ];
    if (width <= 0 || height <= 0) return [];
    return Array.from({ length: STAR_COUNT }, (_, i) => ({
      x: seeded(i + 1) * width,
      y: seeded(i + 101) * height,
      r: STAR_R_MIN + seeded(i + 201) * (STAR_R_MAX - STAR_R_MIN),
      color: tones[i % tones.length],
      base: 0.4 + seeded(i + 301) * 0.6,
    }));
  }, [width, height, colors]);
  return (
    <Group>
      <Fill color={background} />
      <Group opacity={twinkle}>
        {stars.map((s, i) => (
          <Circle
            // biome-ignore lint/suspicious/noArrayIndexKey: static star field
            key={`star-${i}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            color={s.color}
            opacity={s.base}
          />
        ))}
      </Group>
    </Group>
  );
}
