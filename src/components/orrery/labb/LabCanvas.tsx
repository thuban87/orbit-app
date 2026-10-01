/**
 * ORRERY LAB B — the lab path's `<Canvas>` (replaces `OrreryCanvas` for the lab
 * renderer only; the legacy path still uses `OrreryCanvas`).
 *
 * Invariants kept from `OrreryCanvas` (ADR-048/077 M5, research 03 §2.6):
 * - It is the ONLY `useClock()` in the lab path. Only one renderer (and so one
 *   canvas, one clock) is ever mounted. It lives inside OrreryScreen's
 *   `visible && sessionReady && scene` mount gate, so blur / background /
 *   invalid measurement unmount it and the clock stops.
 * - It wraps the Orrery `GestureDetector`.
 * - It still provides `OrreryClockContext` (the AMBIENT clock) so any reused
 *   legacy component (e.g. a future SunBody fallback) keeps working.
 *
 * Shader warm-up: for the first `WARMUP_MS` after mount it draws every
 * `WARMUP_EFFECTS` effect into a 2×2 clipped, near-transparent group so the GL
 * program compile happens at Orrery entry, not at the first System switch.
 * One React state flip ends it (never per-frame state).
 */
import {
  Canvas,
  Fill,
  Group,
  Shader,
  useClock,
} from "@shopify/react-native-skia";
import { type ReactNode, useMemo, useState } from "react";
import {
  type ComposedGesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
} from "react-native-reanimated";
import type { LabFxSnapshot } from "@/stores/orrery-labb-fx-store";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { OrreryClockContext } from "../orrery-clock-context";
import { LabRenderContext } from "./labb-context";
import { getLabEffect, WARMUP_EFFECTS } from "./labb-effects";

/** How long the warm-up group stays mounted after the first frame (ms). */
const WARMUP_MS = 400;
/** Warm-up draw alpha: non-zero so the draw is not culled, invisible in practice. */
const WARMUP_ALPHA = 0.004;
const WARMUP_SIZE = 2;

function WarmUp({ color }: { color: number[] }) {
  const effects = WARMUP_EFFECTS.map((name) => getLabEffect(name)).filter(
    (effect) => effect !== null,
  );
  if (effects.length === 0) return null;
  return (
    <Group
      clip={{ x: 0, y: 0, width: WARMUP_SIZE, height: WARMUP_SIZE }}
      opacity={WARMUP_ALPHA}
    >
      {effects.map((effect, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed warm-up list
        <Fill key={`warm-${i}`}>
          <Shader source={effect} uniforms={{ uColor: color }} />
        </Fill>
      ))}
    </Group>
  );
}

export function LabCanvas({
  width,
  height,
  gesture,
  fxFlags,
  warmup,
  warmupColor,
  children,
}: {
  width: number;
  height: number;
  gesture: ComposedGesture | GestureType;
  fxFlags: SharedValue<LabFxSnapshot>;
  /** React-side flag: run the mount warm-up at all. */
  warmup: boolean;
  /** Token-derived RGBA for the warm-up probe uniform. */
  warmupColor: number[];
  children: ReactNode;
}) {
  // The ONE clock of the lab path.
  const clock = useClock();
  const reducedMotion = useReducedMotionShared();
  const ambient = useDerivedValue(() =>
    fxFlags.value.flags.freezeClock ? 0 : clock.value,
  );
  const [warming, setWarming] = useState(warmup);
  useAnimatedReaction(
    () => clock.value > WARMUP_MS,
    (done, previous) => {
      if (done && previous === false) runOnJS(setWarming)(false);
    },
  );
  const context = useMemo(
    () => ({ clock, ambient, fxFlags, reducedMotion }),
    [clock, ambient, fxFlags, reducedMotion],
  );
  return (
    <GestureDetector gesture={gesture}>
      <Canvas testID="orrery-canvas" style={{ width, height }}>
        <OrreryClockContext.Provider value={ambient}>
          <LabRenderContext.Provider value={context}>
            {children}
            {warming && warmup ? <WarmUp color={warmupColor} /> : null}
          </LabRenderContext.Provider>
        </OrreryClockContext.Provider>
      </Canvas>
    </GestureDetector>
  );
}
