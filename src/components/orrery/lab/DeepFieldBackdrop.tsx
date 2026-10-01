/**
 * ORRERY LAB A — hypothesis item 1: the environment, as three parallax layers
 * (bottom → top): a procedural nebula baked ONCE on the CPU and cached per
 * palette across remounts (nebula-bake.ts), a far and
 * a near star layer recorded ONCE as SkPictures, and a screen-fixed vignette.
 *
 * Per-frame work is transforms + two opacities only:
 *   - parallax comes from the camera (`frame.pose` / `frame.center`), so it is
 *     free and stops when the camera stops;
 *   - the sky rotates with yaw (it is "at infinity"), slides with tilt and
 *     breathes slightly with zoom, near layers more than far ones;
 *   - the switch "jump" adds a velocity-driven sky swing + star stretch, which
 *     is 0 under reduced motion (`SwitchFx` is idle then);
 *   - twinkle is two near-star groups in opposite phase off the ONE ambient
 *     clock (OrreryCanvas), held static under live reduced motion.
 * Light palettes ("chart paper"): a pale wash + density contour lines instead
 * of emissive gas, sparse ink stars, a soft paper-edge vignette.
 */
import {
  createPicture,
  FilterMode,
  Group,
  Image,
  MipmapMode,
  Picture,
  RadialGradient,
  Rect,
  Skia,
  type SkPicture,
  vec,
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import {
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { useOrreryClock } from "../orrery-clock-context";
import {
  NEBULA_FADE_MS,
  NEBULA_PAN_PARALLAX,
  NEBULA_TILT_SLIDE,
  NEBULA_ZOOM_SCALE,
  SKY_YAW_FACTOR,
  STARS_FAR_COUNT,
  STARS_FAR_COUNT_INK,
  STARS_FAR_PAN_PARALLAX,
  STARS_FAR_R,
  STARS_FAR_TILT_SLIDE,
  STARS_FAR_ZOOM_SCALE,
  STARS_HERO_COUNT,
  STARS_HERO_GLOW,
  STARS_HERO_SPIKE,
  STARS_NEAR_COUNT,
  STARS_NEAR_COUNT_INK,
  STARS_NEAR_PAN_PARALLAX,
  STARS_NEAR_R,
  STARS_NEAR_TILT_SLIDE,
  STARS_NEAR_ZOOM_SCALE,
  SWITCH_SKY_KICK,
  SWITCH_STAR_STRETCH,
  TWINKLE_MAX,
  TWINKLE_MIN,
  TWINKLE_SPEED,
  VIGNETTE_ALPHA_DARK,
  VIGNETTE_ALPHA_LIGHT,
  VIGNETTE_INNER,
  WARP_ALPHA,
  WARP_COPIES,
  WARP_STEP,
} from "./deep-field-config";
import {
  type DeepFieldInk,
  type Rgba,
  tokenInk,
  withAlpha,
} from "./deep-field-ink";
import type { SwitchFx } from "./deep-field-math";
import { nebulaCached, nebulaImage } from "./nebula-bake";

/** Margin (dp) beyond the half-diagonal so pans/tilt never expose an edge. */
const SKY_MARGIN = 140;
/** Deterministic 0..1 hash (no PRNG dependency, stable across renders). */
function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface StarSpec {
  x: number;
  y: number;
  r: number;
  color: Rgba;
  alpha: number;
}

function scatter(
  count: number,
  radius: number,
  band: readonly [number, number],
  palette: readonly Rgba[],
  seed: number,
): StarSpec[] {
  const out: StarSpec[] = [];
  for (let i = 0; i < count; i++) {
    // Uniform over the disc (sqrt) so rotation never reveals an empty corner.
    const a = seeded(seed + i * 3 + 1) * Math.PI * 2;
    const d = Math.sqrt(seeded(seed + i * 3 + 2)) * radius;
    const size = seeded(seed + i * 3 + 3);
    out.push({
      x: Math.cos(a) * d,
      y: Math.sin(a) * d,
      // Power curve: many faint pinpricks, few bright stars.
      r: band[0] + (band[1] - band[0]) * size * size,
      color: palette[i % palette.length],
      alpha: 0.35 + 0.65 * seeded(seed + i * 7 + 5),
    });
  }
  return out;
}

function recordStars(
  stars: readonly StarSpec[],
  heroes: number,
  ink: DeepFieldInk,
  radius: number,
): SkPicture {
  return createPicture(
    (canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      const glow = Skia.Paint();
      glow.setAntiAlias(true);
      const spike = Skia.Paint();
      spike.setAntiAlias(true);
      spike.setStyle(1);
      spike.setStrokeWidth(0.6);
      stars.forEach((s, i) => {
        const alpha = ink.chart ? 0.3 + 0.35 * s.alpha : s.alpha;
        if (i < heroes && !ink.chart) {
          glow.setShader(
            Skia.Shader.MakeRadialGradient(
              { x: s.x, y: s.y },
              s.r * STARS_HERO_GLOW,
              [withAlpha(s.color, 0.55), withAlpha(s.color, 0)],
              null,
              0,
            ),
          );
          canvas.drawCircle(s.x, s.y, s.r * STARS_HERO_GLOW, glow);
          spike.setShader(
            Skia.Shader.MakeRadialGradient(
              { x: s.x, y: s.y },
              STARS_HERO_SPIKE,
              [withAlpha(s.color, 0.8), withAlpha(s.color, 0)],
              null,
              0,
            ),
          );
          canvas.drawLine(
            s.x - STARS_HERO_SPIKE,
            s.y,
            s.x + STARS_HERO_SPIKE,
            s.y,
            spike,
          );
          canvas.drawLine(
            s.x,
            s.y - STARS_HERO_SPIKE,
            s.x,
            s.y + STARS_HERO_SPIKE,
            spike,
          );
        }
        paint.setColor(withAlpha(s.color, alpha));
        canvas.drawCircle(s.x, s.y, s.r, paint);
      });
    },
    Skia.XYWHRect(-radius, -radius, radius * 2, radius * 2),
  );
}

/** One warp ghost of the near-star layer (pass 2). */
function WarpGhost({
  level,
  sky,
  picture,
  cx,
  cy,
  chart,
}: {
  level: number;
  sky: SharedValue<{
    dx: number;
    dy: number;
    yaw: number;
    tilt: number;
    lz: number;
    stretch: number;
    velocity: number;
  }>;
  picture: SkPicture;
  cx: number;
  cy: number;
  chart: boolean;
}) {
  const transform = useDerivedValue(() => {
    const s = sky.value;
    return [
      { translateX: cx + s.dx * STARS_NEAR_PAN_PARALLAX },
      {
        translateY:
          cy + s.dy * STARS_NEAR_PAN_PARALLAX - s.tilt * STARS_NEAR_TILT_SLIDE,
      },
      { rotate: -s.yaw },
      {
        scale:
          1 +
          s.lz * STARS_NEAR_ZOOM_SCALE +
          s.stretch +
          level * WARP_STEP * s.velocity * s.velocity,
      },
    ];
  });
  const opacity = useDerivedValue(() => {
    const v = sky.value.velocity;
    const k = 1 - level / (WARP_COPIES + 1);
    return v > 0.02 ? WARP_ALPHA * v * k * (chart ? 0.5 : 1) : 0;
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Picture picture={picture} />
    </Group>
  );
}

export function DeepFieldBackdrop({
  width,
  height,
  ink,
  starColors,
  frame,
  switchFx,
}: {
  width: number;
  height: number;
  ink: DeepFieldInk;
  /** Star tones as tokens (textSecondary/textPrimary/starPalette…). */
  starColors: readonly string[];
  frame: SharedValue<AnimatedFrame>;
  switchFx: SharedValue<SwitchFx>;
}) {
  const clock = useOrreryClock();
  const reducedMotion = useReducedMotionShared();
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.ceil(Math.hypot(width, height) / 2 + SKY_MARGIN);
  const side = radius * 2;

  const palette = useMemo(() => starColors.map(tokenInk), [starColors]);

  // ── Nebula: CPU-baked once per palette, cached across canvas remounts. ──
  // Fade in only on the very first bake (a cached nebula is there at once).
  const firstBake = useMemo(() => !nebulaCached(ink), [ink]);
  const nebula = useMemo(() => nebulaImage(ink), [ink]);
  const nebulaOpacity = useSharedValue(firstBake ? 0 : 1);
  useEffect(() => {
    if (nebulaOpacity.value >= 1) return;
    nebulaOpacity.value = reducedMotion.value
      ? 1
      : withTiming(1, { duration: NEBULA_FADE_MS });
  }, [nebulaOpacity, reducedMotion]);

  // ── Stars: recorded once per size/palette. ───────────────────────────────
  const far = useMemo(
    () =>
      recordStars(
        scatter(
          ink.chart ? STARS_FAR_COUNT_INK : STARS_FAR_COUNT,
          radius,
          STARS_FAR_R,
          palette,
          11,
        ),
        0,
        ink,
        radius,
      ),
    [ink, palette, radius],
  );
  const [nearA, nearB] = useMemo(() => {
    const all = scatter(
      ink.chart ? STARS_NEAR_COUNT_INK : STARS_NEAR_COUNT,
      radius,
      STARS_NEAR_R,
      palette,
      4001,
    ).sort((a, b) => b.r - a.r);
    const heroesA = Math.ceil(STARS_HERO_COUNT / 2);
    const heroesB = STARS_HERO_COUNT - heroesA;
    // Interleave so each twinkle group has bright and faint stars.
    const a = all.filter((_, i) => i % 2 === 0);
    const b = all.filter((_, i) => i % 2 === 1);
    return [
      recordStars(a, heroesA, ink, radius),
      recordStars(b, heroesB, ink, radius),
    ];
  }, [ink, palette, radius]);

  // ── Parallax transforms (camera-driven; idle when the camera is idle). ────
  const sky = useDerivedValue(() => {
    const f = frame.value;
    const fx = switchFx.value;
    return {
      dx: f.center.x - cx,
      dy: f.center.y - cy,
      yaw: (f.pose.yaw ?? 0) * SKY_YAW_FACTOR + fx.kick * SWITCH_SKY_KICK,
      tilt: f.pose.tilt ?? 0,
      lz: Math.log2(Math.max(0.25, f.pose.zoom)),
      stretch: fx.velocity * SWITCH_STAR_STRETCH,
      velocity: fx.velocity,
    };
  });
  const nebulaTransform = useDerivedValue(() => {
    const s = sky.value;
    return [
      { translateX: cx + s.dx * NEBULA_PAN_PARALLAX },
      {
        translateY:
          cy + s.dy * NEBULA_PAN_PARALLAX - s.tilt * NEBULA_TILT_SLIDE,
      },
      { rotate: -s.yaw },
      { scale: 1 + s.lz * NEBULA_ZOOM_SCALE },
    ];
  });
  const farTransform = useDerivedValue(() => {
    const s = sky.value;
    return [
      { translateX: cx + s.dx * STARS_FAR_PAN_PARALLAX },
      {
        translateY:
          cy + s.dy * STARS_FAR_PAN_PARALLAX - s.tilt * STARS_FAR_TILT_SLIDE,
      },
      { rotate: -s.yaw },
      { scale: 1 + s.lz * STARS_FAR_ZOOM_SCALE + s.stretch * 0.5 },
    ];
  });
  const nearTransform = useDerivedValue(() => {
    const s = sky.value;
    return [
      { translateX: cx + s.dx * STARS_NEAR_PAN_PARALLAX },
      {
        translateY:
          cy + s.dy * STARS_NEAR_PAN_PARALLAX - s.tilt * STARS_NEAR_TILT_SLIDE,
      },
      { rotate: -s.yaw },
      { scale: 1 + s.lz * STARS_NEAR_ZOOM_SCALE + s.stretch },
    ];
  });

  // ── Twinkle: the single ambient clock, gated on LIVE reduced motion. ──────
  const twinkleA = useDerivedValue(() => {
    if (!clock || reducedMotion.value) return (TWINKLE_MIN + TWINKLE_MAX) / 2;
    const t = (Math.sin(clock.value * TWINKLE_SPEED) + 1) / 2;
    return TWINKLE_MIN + (TWINKLE_MAX - TWINKLE_MIN) * t;
  });
  const twinkleB = useDerivedValue(() => {
    if (!clock || reducedMotion.value) return (TWINKLE_MIN + TWINKLE_MAX) / 2;
    const t = (Math.sin(clock.value * TWINKLE_SPEED * 0.83 + Math.PI) + 1) / 2;
    return TWINKLE_MIN + (TWINKLE_MAX - TWINKLE_MIN) * t;
  });

  // ── PASS 2: jump "warp" — ghost copies of the near stars scaled out from
  // the centre by the spin velocity, so the starfield streaks radially at the
  // height of the jump and snaps back as the system settles. `velocity` is 0
  // under reduced motion (SwitchFx idle) → the ghosts are fully transparent.
  const warpLevels = useMemo(
    () => Array.from({ length: WARP_COPIES }, (_, i) => i + 1),
    [],
  );
  const vignette = useMemo(() => {
    const edge = ink.chart ? VIGNETTE_ALPHA_LIGHT : VIGNETTE_ALPHA_DARK;
    return [
      withAlpha(ink.voidTone, 0),
      withAlpha(ink.voidTone, 0),
      withAlpha(ink.voidTone, edge * 0.55),
      withAlpha(ink.voidTone, edge),
    ];
  }, [ink]);

  return (
    <Group>
      <Group transform={nebulaTransform} opacity={nebulaOpacity}>
        <Image
          image={nebula}
          x={-radius}
          y={-radius}
          width={side}
          height={side}
          fit="fill"
          sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.None }}
        />
      </Group>
      <Group transform={farTransform}>
        <Picture picture={far} />
      </Group>
      <Group transform={nearTransform}>
        <Group opacity={twinkleA}>
          <Picture picture={nearA} />
        </Group>
        <Group opacity={twinkleB}>
          <Picture picture={nearB} />
        </Group>
      </Group>
      {warpLevels.map((level) => (
        <WarpGhost
          key={level}
          level={level}
          sky={sky}
          picture={nearA}
          cx={cx}
          cy={cy}
          chart={ink.chart}
        />
      ))}
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(cx, cy)}
          r={Math.hypot(width, height) / 2}
          colors={vignette}
          positions={[0, VIGNETTE_INNER, 0.8, 1]}
        />
      </Rect>
    </Group>
  );
}
