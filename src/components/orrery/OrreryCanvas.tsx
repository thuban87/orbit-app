/**
 * OrreryCanvas (ORR-01/ORR-03) — the conditionally-mountable `<Canvas>` subtree of
 * the orrery. OrreryScreen renders it only once the canvas is MEASURED (C2-4:
 * `dimsValid`) AND focused/foregrounded, so that UNMOUNTING it truly stops the Skia
 * render loop (Pitfall 4 — the clock has no pause arg).
 *
 * ── Ambient loop (ORR-03 / M5) ──────────────────────────────────────────────
 * This component is the SOLE home of the ambient `useClock()` (M5): the clock is
 * created HERE and drives BOTH the subtle starfield twinkle rendered here AND — via
 * `OrreryClockContext` — the sun-glow pulse inside `SunBody`. `useClock` appears
 * nowhere else (not in OrreryScreen, not in SunBody), so a blur/background unmount
 * of this subtree cleanly halts every ambient worklet. `useClock` is a NEW-to-repo
 * Skia idiom (not part of the proven CropPhotoScreen surface) — first proven on
 * device in 13-08 UAT; that unmounting this subtree stops the clock is an expected
 * verification point there.
 *
 * The orbit rings, keyed `<OrbitBody/>` planets and the `<SunBody/>` sun are BUILT
 * by OrreryScreen and passed in as `children` (so no per-body hook is ever called
 * in a `.map()` here); they render inside the clock Provider so `SunBody` reads the
 * shared clock. Every colour — the `<Fill>` background and the starfield tones — is
 * a passed theme token (check:colors).
 */
import {
  Canvas,
  Circle,
  Fill,
  Group,
  useClock,
} from "@shopify/react-native-skia";
import { type ReactNode, useMemo } from "react";
import {
  type ComposedGesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import { useDerivedValue } from "react-native-reanimated";
import { OrreryClockContext } from "./orrery-clock-context";

export interface OrreryCanvasProps {
  /** Measured canvas width (C2-4: only mounted when > 0). */
  width: number;
  /** Measured canvas height (C2-4: only mounted when > 0). */
  height: number;
  /** Deep-space background colour (`colors.background`). */
  background: string;
  /** Star tones (`textSecondary`/`textPrimary`/`starPalette`), passed as tokens. */
  starColors: string[];
  /** The composed tap-races-pan gesture. */
  gesture: ComposedGesture | GestureType;
  /** The pre-built Skia subtree: rings, `<OrbitBody/>` planets, `<SunBody/>`. */
  children: ReactNode;
}

/** How many ambient star dots to scatter (subtle — device-UAT tunable, 13-08). */
const STAR_COUNT = 44;
/** Star dot radius range (px). */
const STAR_R_MIN = 0.6;
const STAR_R_MAX = 1.8;
/** Twinkle: the shared Group opacity oscillates within this band. */
const TWINKLE_MIN = 0.18;
const TWINKLE_MAX = 0.55;
/** Twinkle angular speed (rad/ms) → ~2.6s period. */
const TWINKLE_SPEED = 0.0024;

/** One placed star dot. */
interface Star {
  x: number;
  y: number;
  r: number;
  color: string;
  /** Static per-star opacity for a non-uniform field (multiplied by the twinkle). */
  base: number;
}

/**
 * Deterministic 0..1 hash from an integer seed — a tiny LCG-ish mix so the star
 * field is stable across renders (no per-frame allocation, no React state) without
 * pulling in a PRNG dependency.
 */
function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function OrreryCanvas({
  width,
  height,
  background,
  starColors,
  gesture,
  children,
}: OrreryCanvasProps) {
  // M5: the ONE ambient clock (inside this unmountable subtree).
  const clock = useClock();

  // The subtle starfield twinkle — a SINGLE Group-opacity oscillation (cheap; one
  // worklet for the whole field). Per-star `base` opacity keeps the field varied.
  const twinkle = useDerivedValue(() => {
    const t = (Math.sin(clock.value * TWINKLE_SPEED) + 1) / 2; // 0..1
    return TWINKLE_MIN + (TWINKLE_MAX - TWINKLE_MIN) * t;
  });

  // Deterministic star placement — stable for the measured canvas + palette.
  const stars = useMemo<Star[]>(() => {
    if (width <= 0 || height <= 0 || starColors.length === 0) {
      return [];
    }
    const out: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const sx = seeded(i + 1);
      const sy = seeded(i + 101);
      const sr = seeded(i + 201);
      const sb = seeded(i + 301);
      out.push({
        x: sx * width,
        y: sy * height,
        r: STAR_R_MIN + sr * (STAR_R_MAX - STAR_R_MIN),
        color: starColors[i % starColors.length],
        base: 0.4 + sb * 0.6,
      });
    }
    return out;
  }, [width, height, starColors]);

  return (
    <GestureDetector gesture={gesture}>
      <Canvas testID="orrery-canvas" style={{ width, height }}>
        <Fill color={background} />
        {/* Layer 2: ambient starfield (twinkles via the shared clock). */}
        <Group opacity={twinkle}>
          {stars.map((s, i) => (
            <Circle
              // biome-ignore lint/suspicious/noArrayIndexKey: static, stable star field
              key={`star-${i}`}
              cx={s.x}
              cy={s.y}
              r={s.r}
              color={s.color}
              opacity={s.base}
            />
          ))}
        </Group>
        {/* Layers 3-5: rings, planets, sun — SunBody reads the clock via context. */}
        <OrreryClockContext.Provider value={clock}>
          {children}
        </OrreryClockContext.Provider>
      </Canvas>
    </GestureDetector>
  );
}
